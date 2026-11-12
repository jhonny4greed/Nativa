import { TUTORIALS, TUTORIAL_LABELS, TUTORIAL_VERSION } from "./tutorial-content.js";
import "../css/tutorial.css";

export function visibleTarget(selector) {
  return [...document.querySelectorAll(selector)].find(
    el => !el.closest("[hidden]") && el.getClientRects().length && getComputedStyle(el).visibility !== "hidden"
  );
}

export async function initializeTutorials(client, user) {
  const key = `nativa.tutorials.v${TUTORIAL_VERSION}:${user.id}`;
  let states = {},
    current = null,
    index = 0,
    steps = [],
    target = null,
    anchorFocus = null,
    frame = 0;
  let pending = {},
    ready = false,
    replaying = false,
    lastView = null;
  try {
    const cached = JSON.parse(localStorage.getItem(key) || "{}");
    states = cached.states || {};
    pending = cached.pending || {};
  } catch {
    /* storage is optional */
  }
  const root = document.createElement("div");
  root.className = "nativa-tour";
  root.hidden = true;
  const spot = document.createElement("div");
  spot.className = "tour-spotlight";
  spot.setAttribute("aria-hidden", "true");
  const popup = document.createElement("section");
  popup.className = "tour-popup";
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-labelledby", "tour-title");
  popup.setAttribute("aria-describedby", "tour-text");
  popup.tabIndex = -1;
  popup.innerHTML =
    '<div class="tour-heading"><span class="tour-kicker">GUIA DO VÍNCULO</span><span class="tour-count"></span></div><h2 id="tour-title"></h2><p id="tour-text"></p><p class="tour-hint">Você pode interagir com a área destacada.</p><div class="tour-progress" aria-hidden="true"><span></span></div><div class="tour-controls"><button type="button" class="tour-skip">Pular</button><button type="button" class="tour-back">Voltar</button><button type="button" class="tour-next">Avançar <span aria-hidden="true">→</span></button></div>';
  root.append(spot, popup);
  document.body.append(root);
  function cache() {
    try {
      localStorage.setItem(key, JSON.stringify({ states, pending }));
    } catch {
      /* server is authoritative */
    }
  }
  async function flush() {
    for (const [id, status] of Object.entries(pending)) {
      const { error } = await client
        .from("player_tutorials")
        .upsert({
          user_id: user.id,
          tour_id: id,
          version: TUTORIAL_VERSION,
          status,
          updated_at: new Date().toISOString()
        });
      if (error) return;
      if (pending[id] === status) delete pending[id];
    }
    cache();
  }
  function close() {
    root.hidden = true;
    current = null;
    target = null;
    cancelAnimationFrame(frame);
    if (anchorFocus?.isConnected) anchorFocus.focus({ preventScroll: true });
  }
  function finish(status) {
    const id = current;
    if (!id) return;
    states[id] = status;
    pending[id] = status;
    cache();
    void flush().catch(() => {});
    close();
    if (id === "general" && status === "completed" && !replaying) queueMicrotask(discover);
  }
  function position() {
    if (!current) return;
    // Re-query because bestiary and arena replace their DOM when an action is taken.
    target = visibleTarget(steps[index].target) || visibleTarget(".view.active");
    const r = target?.getBoundingClientRect();
    if (!r) return;
    const vw = document.documentElement.clientWidth,
      vh = window.visualViewport?.height || innerHeight;
    const padding = 8;
    Object.assign(spot.style, {
      left: `${Math.max(4, r.left - padding)}px`,
      top: `${Math.max(4, r.top - padding)}px`,
      width: `${Math.min(vw - 8, r.width + padding * 2)}px`,
      height: `${Math.min(vh - 8, r.height + padding * 2)}px`
    });
    popup.style.maxHeight = `${vh - 24}px`;
    const w = popup.offsetWidth,
      h = popup.offsetHeight;
    let left = Math.max(12, Math.min(vw - w - 12, r.left));
    let top = r.bottom + 18;
    if (top + h > vh - 12) top = r.top - h - 18;
    if (top < 12) {
      top = Math.max(12, vh - h - 12);
      left = Math.max(12, Math.min(vw - w - 12, r.right + 18));
    }
    if (vw <= 640) {
      left = 12;
      top = Math.max(12, vh - h - 12);
    }
    Object.assign(popup.style, { left: `${left}px`, top: `${Math.min(vh - h - 12, Math.max(12, top))}px` });
  }
  function render() {
    const s = steps[index];
    if (!s) {
      finish("completed");
      return;
    }
    const dialog = document.querySelector("dialog[open]");
    (dialog || document.fullscreenElement || document.body).append(root);
    root.hidden = false;
    popup.querySelector("h2").textContent = s.title;
    popup.querySelector("#tour-text").textContent = s.text;
    popup.querySelector(".tour-count").textContent = `${index + 1} / ${steps.length}`;
    popup.querySelector(".tour-back").disabled = index === 0;
    popup.querySelector(".tour-next").textContent = index === steps.length - 1 ? "Concluir ✓" : "Avançar →";
    popup.querySelector(".tour-progress span").style.width = `${((index + 1) / steps.length) * 100}%`;
    target = visibleTarget(s.target) || visibleTarget(".view.active");
    target?.scrollIntoView({ block: innerWidth <= 640 ? "start" : "center", behavior: "instant" });
    position();
    popup.focus({ preventScroll: true });
  }
  function start(id, force = false) {
    if (!TUTORIALS[id] || (!force && states[id])) return;
    if (current) close();
    steps = TUTORIALS[id].filter(s => !s.optional || visibleTarget(s.target));
    if (!steps.length) return;
    current = id;
    index = 0;
    anchorFocus = document.activeElement;
    replaying = force;
    render();
  }
  popup.querySelector(".tour-skip").onclick = () => finish("skipped");
  popup.querySelector(".tour-back").onclick = () => {
    if (index > 0) {
      index--;
      render();
    }
  };
  popup.querySelector(".tour-next").onclick = () => {
    if (index === steps.length - 1) finish("completed");
    else {
      index++;
      render();
    }
  };
  document.addEventListener("keydown", event => {
    if (!current) return;
    if (event.key === "Escape") {
      event.preventDefault();
      finish("skipped");
    }
    // Trap only keyboard navigation inside the explanation; highlighted controls remain clickable.
    if (event.key === "Tab" && popup.contains(document.activeElement)) {
      const buttons = [...popup.querySelectorAll("button:not(:disabled)")];
      if (event.shiftKey && document.activeElement === buttons[0]) {
        event.preventDefault();
        buttons.at(-1).focus();
      } else if (!event.shiftKey && document.activeElement === buttons.at(-1)) {
        event.preventDefault();
        buttons[0].focus();
      }
    }
  });
  function discover() {
    if (!ready || current) return;
    const view = document.querySelector(".view.active")?.id;
    if (view === "admin") return;
    if (!states.general) {
      start("general");
      return;
    }
    if (visibleTarget("#essence-inventory-dialog[open]")) {
      start("essences");
      return;
    }
    if (visibleTarget(".action-panel") && !states["battle-turn"]) {
      start("battle-turn");
      return;
    }
    if (visibleTarget("#online-arena-lobby") && !states["battle-online"]) {
      start("battle-online");
      return;
    }
    if (visibleTarget("#art-save") && !states["art-save"]) {
      start("art-save");
      return;
    }
    if (visibleTarget("#online-room-admin") && !states["room-master"]) {
      start("room-master");
      return;
    }
    if (visibleTarget("#online-room-details") && !states["room-detail"]) {
      start("room-detail");
      return;
    }
    start(view);
  }
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      if (current) {
        if (current === "essences" && !document.querySelector("#essence-inventory-dialog[open]")) close();
        else position();
      } else discover();
    });
  });
  // Only child replacements and visibility changes matter; do not observe our own positioning styles.
  observer.observe(document.querySelector("#main-content") || document.querySelector("main"), {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["hidden", "open"]
  });
  const essenceDialog = document.querySelector("#essence-inventory-dialog");
  if (essenceDialog)
    observer.observe(essenceDialog, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["open", "hidden"]
    });
  essenceDialog?.addEventListener("close", () => {
    if (current === "essences") close();
  });
  document.addEventListener("nativa:view", event => {
    if (lastView === event.detail.id) return;
    lastView = event.detail.id;
    if (current) close();
    requestAnimationFrame(discover);
  });
  const reposition = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(position);
  };
  document.addEventListener("fullscreenchange", () => {
    if (current) {
      (document.querySelector("dialog[open]") || document.fullscreenElement || document.body).append(root);
      position();
    }
  });
  window.addEventListener("resize", reposition);
  window.addEventListener("scroll", reposition, true);
  window.visualViewport?.addEventListener("resize", reposition);
  window.addEventListener("online", () => void flush().catch(() => {}));
  const panel = document.createElement("section");
  panel.className = "form-panel tutorial-library";
  const heading = document.createElement("h3");
  heading.textContent = "Repetir tutoriais";
  const description = document.createElement("p");
  description.textContent =
    "Reveja uma área ou recomece a introdução. Suas Nativas e sua progressão continuam intactas.";
  const select = document.createElement("select");
  select.id = "tutorial-replay-choice";
  select.setAttribute("aria-label", "Tutorial para repetir");
  for (const [id, label] of Object.entries(TUTORIAL_LABELS)) select.add(new Option(label, id));
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Repetir tutorial";
  const note = document.createElement("p");
  note.className = "muted";
  note.setAttribute("role", "status");
  button.onclick = () => {
    const id = select.value;
    const contextual = {
      "battle-turn": ["battle", ".action-panel"],
      "room-detail": ["multiplayer", "#online-room-details"],
      "room-master": ["multiplayer", "#online-room-admin"],
      essences: ["list", "#essence-inventory-dialog[open]"],
      "art-save": ["art-studio", "#art-save"]
    };
    const view = contextual[id]?.[0] || (id === "battle-online" ? "battle" : id === "general" ? "home" : id);
    document.querySelector(`[data-view="${view}"]`)?.click();
    if (id === "battle-online") document.querySelector('[data-arena-lane="online"]')?.click();
    requestAnimationFrame(() => {
      if (contextual[id] && !visibleTarget(contextual[id][1])) {
        note.textContent =
          "Abra primeiro o recurso correspondente: uma batalha, os detalhes da mesa, o inventário de Essências ou uma imagem gerada.";
        // Show the guidance in the destination too, without pretending an unavailable element exists.
        const message = document.createElement("p");
        message.className = "tutorial-context-message";
        message.setAttribute("role", "status");
        message.textContent = note.textContent;
        document.querySelector(".view.active .section-heading")?.after(message);
        setTimeout(() => message.remove(), 12000);
        return;
      }
      start(id, true);
    });
  };
  panel.append(heading, description, select, button, note);
  document.querySelector("#rules").append(panel);
  try {
    const { data, error } = await client
      .from("player_tutorials")
      .select("tour_id,status")
      .eq("user_id", user.id)
      .eq("version", TUTORIAL_VERSION);
    if (!error) {
      for (const row of data || []) states[row.tour_id] = row.status;
      states = { ...states, ...pending };
      cache();
      await flush();
    }
  } catch {
    /* local, account-scoped fallback retries on the next login */
  }
  ready = true;
  discover();
}
