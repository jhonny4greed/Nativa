// Normalize the domain events and existing multiplayer logs to the same presentation.
export function combatActions(events, fighters) {
  return events
    .filter(event => ["hit", "v21-hit", "miss", "support", "defend", "recover"].includes(event.type))
    .map(event => {
      const actor = fighters.findIndex(f => f.nativa.name === (event.attacker || event.fighter));
      return {
        ...event,
        actor: Math.max(0, actor),
        targetIndex: event.target ? fighters.findIndex(f => f.nativa.name === event.target) : 1 - Math.max(0, actor),
        technique: event.technique || (event.type === "defend" ? "Defender" : "Recuperar MP")
      };
    });
}
export function historyActions(lines, fighters, techniques) {
  const events = [];
  for (const line of lines) {
    const actor = fighters.findIndex(
      f =>
        String(line).startsWith(`${f.nativa.name} usa `) ||
        String(line).startsWith(`${f.nativa.name} erra `) ||
        String(line).startsWith(`${f.nativa.name} assume `) ||
        String(line).startsWith(`${f.nativa.name} recupera `)
    );
    if (actor < 0) continue;
    if (String(line).startsWith(`${fighters[actor].nativa.name} assume `)) {
      events.push({ type: "defend", fighter: fighters[actor].nativa.name });
      continue;
    }
    if (String(line).startsWith(`${fighters[actor].nativa.name} recupera `)) {
      events.push({
        type: "recover",
        fighter: fighters[actor].nativa.name,
        recovered: Number(String(line).match(/recupera (\d+)/)?.[1] || 1)
      });
      continue;
    }
    const move = techniques(fighters[actor]).find(t => String(line).includes(t.nome));
    if (!move) continue;
    const miss = String(line).startsWith(`${fighters[actor].nativa.name} erra `);
    const roll = String(line).match(/D10:\s*(\d+)/i);
    const damage = String(line).match(/recebe\s+(\d+)\s+de\s+dano/i);
    events.push({
      type: miss ? "miss" : damage ? "hit" : "support",
      attacker: fighters[actor].nativa.name,
      target: fighters[1 - actor].nativa.name,
      technique: move.nome,
      roll: roll ? Number(roll[1]) : null,
      damage: damage ? Number(damage[1]) : 0,
      description: move.efeito
    });
  }
  return combatActions(events, fighters);
}

export function createCombatPresenter({
  getBattle,
  identity,
  preferences,
  duration,
  render,
  techniques,
  wait = ms => new Promise(resolve => setTimeout(resolve, ms))
}) {
  let queue = Promise.resolve(),
    pending = 0,
    session = null,
    controller = null;
  const seen = new Set();
  function layer() {
    let el = document.querySelector("#arena-effects");
    if (!el) {
      el = document.createElement("div");
      el.id = "arena-effects";
      el.className = "arena-effects";
      document.querySelector("#battle").append(el);
    }
    return el;
  }
  function cleanup() {
    document.querySelector("#arena-effects")?.replaceChildren();
    document
      .querySelectorAll(".acting-native,.receiving-hit")
      .forEach(el => el.classList.remove("acting-native", "receiving-hit"));
    document.querySelector(".arena-stage")?.classList.remove("cinematic-stage");
  }
  function cancel() {
    controller?.abort();
    cleanup();
  }
  document.addEventListener("nativa:arena-preferences", () => {
    if (!preferences().effects) cancel();
  });
  document.addEventListener("nativa:view", event => {
    if (event.detail.id !== "battle") cancel();
  });
  const actorNode = index => document.querySelector(`#battle-arena .arena-fighter-${index === 0 ? "one" : "two"}`);
  function place(el) {
    const r = document.querySelector(".arena-stage")?.getBoundingClientRect();
    if (!r) return;
    Object.assign(el.style, {
      left: `${r.left + r.width / 2}px`,
      top: `${Math.max(r.top + 8, Math.min(innerHeight - 100, r.top + r.height * 0.45))}px`,
      maxWidth: `${Math.max(140, r.width - 24)}px`
    });
  }
  async function play(action, id) {
    if (identity(getBattle()) !== id || !preferences().effects || !document.querySelector("#battle.active")) return;
    controller = new AbortController();
    const signal = controller.signal;
    const pause = async ms => {
      if (signal.aborted) return;
      await new Promise(resolve => {
        const done = () => {
          signal.removeEventListener("abort", done);
          resolve();
        };
        signal.addEventListener("abort", done, { once: true });
        Promise.resolve(wait(ms)).then(done, done);
      });
    };
    const total = duration(preferences()),
      reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fighter = getBattle().fighters[action.actor],
      move = techniques(fighter).find(t => t.nome === action.technique);
    const panel = document.createElement("section");
    panel.className = `combat-cinematic${reduced ? " reduced-motion" : ""}`;
    panel.dataset.phase = "focus";
    panel.setAttribute("role", "status");
    panel.setAttribute("aria-live", "polite");
    const kicker = document.createElement("small");
    kicker.textContent = `É A VEZ DE ${fighter.nativa.name.toLocaleUpperCase("pt-BR")}`;
    const title = document.createElement("strong");
    title.className = "cinematic-technique";
    title.textContent = action.technique;
    const info = document.createElement("div");
    info.className = "cinematic-result";
    info.textContent = "Preparando a ação…";
    panel.append(kicker, title, info);
    place(panel);
    layer().append(panel);
    const reposition = () => place(panel);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    document.addEventListener("fullscreenchange", reposition);
    try {
      document.querySelector(".arena-stage")?.classList.add("cinematic-stage");
      actorNode(action.actor)?.classList.add("acting-native");
      await pause(total * 0.2);
      if (signal.aborted || identity(getBattle()) !== id) return;
      panel.dataset.phase = "roll";
      if (action.roll !== null && action.roll !== undefined) {
        info.textContent = "";
        const dice = document.createElement("div");
        dice.className = "d10-shell cinematic-die";
        const face = document.createElement("span");
        face.dataset.d10Face = "";
        dice.append(face);
        info.append(dice);
        const label = document.createElement("small");
        label.textContent = "D10 · PRECISÃO";
        info.append(label);
        const start = performance.now(),
          rollTime = total * 0.24;
        while (performance.now() - start < rollTime && !signal.aborted) {
          face.textContent = reduced ? String(action.roll) : String(1 + Math.floor(Math.random() * 10));
          await pause(80);
        }
        face.textContent = String(action.roll);
        await pause(total * 0.12);
      } else {
        info.textContent = action.type === "support" ? "Canalizando o efeito…" : "Executando a ação…";
        await pause(total * 0.36);
      }
      if (signal.aborted || identity(getBattle()) !== id) return;
      panel.dataset.phase = "result";
      info.replaceChildren();
      const result = document.createElement("b");
      result.className = "cinematic-outcome";
      if (["hit", "v21-hit"].includes(action.type)) {
        result.textContent = `−${action.damage ?? 0} HP`;
        panel.classList.add("is-hit");
        actorNode(action.targetIndex)?.classList.add("receiving-hit");
        if (session?.vitals[action.targetIndex])
          session.vitals[action.targetIndex].hp = Math.max(
            0,
            session.vitals[action.targetIndex].hp - (action.damage || 0)
          );
      } else if (action.type === "miss") {
        result.textContent = "ERROU O GOLPE";
        panel.classList.add("is-miss");
      } else {
        result.textContent =
          action.type === "support"
            ? "EFEITO ATIVADO"
            : action.type === "recover"
              ? `+${action.recovered ?? 1} MP`
              : "DEFENDENDO";
        panel.classList.add("is-support");
      }
      info.append(result);
      const description = document.createElement("p");
      description.textContent =
        action.type === "miss"
          ? "A precisão não foi suficiente."
          : action.description ||
            (["support"].includes(action.type) ? move?.efeito : "") ||
            (action.type === "hit" || action.type === "v21-hit"
              ? `${getBattle().fighters[action.targetIndex]?.nativa.name || "Oponente"} recebeu o dano.`
              : action.type === "defend"
                ? "Passa o turno sem atacar."
                : "Recupera magia para os próximos golpes.");
      info.append(description);
      if (session?.vitals[action.actor] && move)
        session.vitals[action.actor].mp = Math.max(0, session.vitals[action.actor].mp - (move.mp || 0));
      if (action.type === "recover" && session?.vitals[action.actor])
        session.vitals[action.actor].mp = Math.min(
          getBattle().fighters[action.actor].maxMP,
          session.vitals[action.actor].mp + (action.recovered ?? 1)
        );
      render();
      place(panel);
      document.querySelector(".arena-stage")?.classList.add("cinematic-stage");
      if (["hit", "v21-hit"].includes(action.type)) actorNode(action.targetIndex)?.classList.add("receiving-hit");
      await pause(total * 0.44);
    } finally {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      document.removeEventListener("fullscreenchange", reposition);
      panel.remove();
      cleanup();
    }
  }
  function enqueue(actions, key, before) {
    const id = identity(getBattle());
    if (!actions.length || seen.has(key) || !preferences().effects) return Promise.resolve();
    seen.add(key);
    if (seen.size > 600) seen.delete(seen.values().next().value);
    if (!session || session.id !== id) {
      cancel();
      session = { id, vitals: (before || getBattle().fighters).map(f => ({ hp: f.hp, mp: f.mp })) };
    }
    pending++;
    render();
    queue = queue
      .catch(() => {})
      .then(async () => {
        try {
          for (const action of actions) await play(action, id);
        } finally {
          pending--;
          if (!pending) {
            session = null;
            cleanup();
            render();
          }
        }
      });
    return queue;
  }
  return {
    enqueue,
    busy: () => pending > 0 && session?.id === identity(getBattle()),
    vitals: index => (session?.id === identity(getBattle()) ? session.vitals[index] : null),
    cancel
  };
}
