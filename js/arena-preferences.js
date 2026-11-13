const SPEEDS = { very_fast: 3000, fast: 4000, normal: 5000, slow: 6000, very_slow: 8000 };
let preferences = { effects: true, sounds: true, speed: "normal" };
export const getArenaPreferences = () => ({ ...preferences });
export function animationDuration(settings) {
  if (!settings.effects) return 0;
  return SPEEDS[settings.speed] || SPEEDS.normal;
}
export async function initializeArenaPreferences(client, user) {
  const key = `nativa.arena.preferences:${user.id}`;
  let pending = false;
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    if (value) {
      preferences = {
        effects: value.effects !== false,
        sounds: value.sounds !== false,
        speed: Object.hasOwn(SPEEDS, value.speed) ? value.speed : "normal"
      };
      pending = Boolean(value.pending);
    }
  } catch {}
  const panel = document.createElement("section");
  panel.className = "form-panel arena-preferences";
  panel.innerHTML =
    '<h3>Efeitos da arena</h3><p>Escolha como acompanhar cada ação. Esta preferência pertence à sua conta e não muda as regras da batalha.</p><label class="checkbox-row"><input id="arena-effects-enabled" type="checkbox"> Ativar efeitos e animações de combate</label><label>Velocidade das animações<select id="arena-effects-speed"><option value="very_fast">Muito rápido · 3 segundos por ação</option><option value="fast">Rápido · 4 segundos por ação</option><option value="normal">Normal · 5 segundos por ação</option><option value="slow">Devagar · 6 segundos por ação</option><option value="very_slow">Muito devagar · 8 segundos por ação</option></select></label><p class="muted">Desativar elimina as animações e a espera. A opção de reduzir movimentos do dispositivo também é respeitada.</p><p id="arena-effects-status" role="status"></p>';
  document.querySelector("#settings .section-heading").after(panel);
  panel.insertAdjacentHTML(
    "beforeend",
    '<label class="checkbox-row"><input id="arena-sounds-enabled" type="checkbox"> Reproduzir gritos e sons dos golpes (até 2 segundos)</label>'
  );
  const sounds = panel.querySelector("#arena-sounds-enabled");
  const enabled = panel.querySelector("#arena-effects-enabled"),
    speed = panel.querySelector("select"),
    status = panel.querySelector('[role="status"]');
  function render() {
    document.documentElement.classList.toggle("arena-effects-disabled", !preferences.effects);
    enabled.checked = preferences.effects;
    sounds.checked = preferences.sounds;
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
          arena_sounds: snapshot.sounds,
          arena_speed: snapshot.speed,
          updated_at: new Date().toISOString()
        });
        if (error) {
          status.textContent = "Preferência mantida neste dispositivo. O envio à conta será tentado na reconexão.";
          return;
        }
        if (
          preferences.effects === snapshot.effects &&
          preferences.speed === snapshot.speed &&
          preferences.sounds === snapshot.sounds
        ) {
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
    preferences = { effects: enabled.checked, sounds: sounds.checked, speed: speed.value };
    render();
    document.dispatchEvent(new CustomEvent("nativa:arena-preferences"));
    void save();
  }
  enabled.addEventListener("change", change);
  speed.addEventListener("change", change);
  sounds.addEventListener("change", change);
  render();
  window.addEventListener("online", () => {
    if (pending) void save();
  });
  try {
    const { data, error } = await client
      .from("player_preferences")
      .select("arena_effects,arena_speed,arena_sounds")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!error && data && !pending) {
      preferences = {
        effects: data.arena_effects !== false,
        sounds: data.arena_sounds !== false,
        speed: Object.hasOwn(SPEEDS, data.arena_speed) ? data.arena_speed : "normal"
      };
      cache();
      render();
    }
    if (pending) await save();
  } catch {
    status.textContent = "Usando a preferência deste dispositivo enquanto a conta está indisponível.";
  }
}
