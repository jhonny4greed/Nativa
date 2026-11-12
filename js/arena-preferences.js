let preferences = { effects: true, speed: "normal" };
export const getArenaPreferences = () => ({ ...preferences });
export function animationDuration(settings) {
  if (!settings.effects) return 0;
  return { fast: 2750, normal: 5500, slow: 8250 }[settings.speed] || 5500;
}
export async function initializeArenaPreferences(client, user) {
  const key = `nativa.arena.preferences:${user.id}`;
  let pending = false;
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    if (value) {
      preferences = {
        effects: value.effects !== false,
        speed: ["fast", "normal", "slow"].includes(value.speed) ? value.speed : "normal"
      };
      pending = Boolean(value.pending);
    }
  } catch {}
  const panel = document.createElement("section");
  panel.className = "form-panel arena-preferences";
  panel.innerHTML =
    '<h3>Efeitos da arena</h3><p>Escolha como acompanhar cada ação. Esta preferência pertence à sua conta e não muda as regras da batalha.</p><label class="checkbox-row"><input id="arena-effects-enabled" type="checkbox"> Ativar efeitos e animações de combate</label><label>Velocidade das animações<select id="arena-effects-speed"><option value="fast">Rápida · cerca de 3 segundos por ação</option><option value="normal">Normal · cerca de 5,5 segundos por ação</option><option value="slow">Lenta · cerca de 8 segundos por ação</option></select></label><p class="muted">Desativar elimina as animações e a espera. A opção de reduzir movimentos do dispositivo também é respeitada.</p><p id="arena-effects-status" role="status"></p>';
  document.querySelector("#settings .section-heading").after(panel);
  const enabled = panel.querySelector("input"),
    speed = panel.querySelector("select"),
    status = panel.querySelector('[role="status"]');
  function render() {
    document.documentElement.classList.toggle("arena-effects-disabled", !preferences.effects);
    enabled.checked = preferences.effects;
    speed.value = preferences.speed;
    speed.disabled = !preferences.effects;
  }
  function cache() {
    try {
      localStorage.setItem(key, JSON.stringify({ ...preferences, pending }));
    } catch {}
  }
  let writes = Promise.resolve();
  function save() {
    const snapshot = { ...preferences };
    pending = true;
    cache();
    writes = writes
      .catch(() => {})
      .then(async () => {
        const { error } = await client.from("player_preferences").upsert({
          user_id: user.id,
          arena_effects: snapshot.effects,
          arena_speed: snapshot.speed,
          updated_at: new Date().toISOString()
        });
        if (error) {
          status.textContent = "Preferência mantida neste dispositivo. O envio à conta será tentado na reconexão.";
          return;
        }
        if (preferences.effects === snapshot.effects && preferences.speed === snapshot.speed) {
          pending = false;
          cache();
          status.textContent = "Preferência salva na sua conta.";
        }
      })
      .catch(() => {
        status.textContent = "Preferência mantida neste dispositivo. O envio à conta será tentado na reconexão.";
      });
    return writes;
  }
  function change() {
    preferences = { effects: enabled.checked, speed: speed.value };
    render();
    document.dispatchEvent(new CustomEvent("nativa:arena-preferences"));
    void save();
  }
  enabled.addEventListener("change", change);
  speed.addEventListener("change", change);
  render();
  window.addEventListener("online", () => {
    if (pending) void save();
  });
  try {
    const { data, error } = await client
      .from("player_preferences")
      .select("arena_effects,arena_speed")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!error && data && !pending) {
      preferences = {
        effects: data.arena_effects !== false,
        speed: ["fast", "normal", "slow"].includes(data.arena_speed) ? data.arena_speed : "normal"
      };
      cache();
      render();
    }
    if (pending) await save();
  } catch {
    status.textContent = "Usando a preferência deste dispositivo enquanto a conta está indisponível.";
  }
}
