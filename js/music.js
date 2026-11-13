import "../css/game-controls.css";
export const HOME_TRACK = {
  id: "desperte-sua-essencia",
  title: "NATIVA — Desperte sua Essência",
  src: new URL("../assets/audio/nativa-desperte-sua-essencia.mp3", import.meta.url).href
};
// Only arena tracks belong here. The refuge song is not repurposed for battles.
export const ARENA_TRACKS = [];
import { chooseArenaTrack as chooseTrack } from "./music-policy.js";
const chooseArenaTrack = (mode, selected) => chooseTrack(mode, selected, ARENA_TRACKS);
let initialized = false;
export async function initializeMusic(client = null, user = null) {
  if (initialized) return;
  initialized = true;
  let remembered;
  try {
    remembered = localStorage.getItem("nativa.music.active-account");
  } catch {}
  const key = `nativa.music:${user?.id || remembered || "guest"}`;
  let settings = { enabled: true, mode: "standard", track: null },
    dirty = false,
    area = client ? "home" : "landing",
    battleTrack = null,
    blocked = false,
    source = null,
    serial = 0;
  try {
    const cache = JSON.parse(localStorage.getItem(key) || "null");
    if (cache) {
      settings = { ...settings, ...cache.settings };
      dirty = Boolean(cache.dirty);
    }
    if (user) localStorage.setItem("nativa.music.active-account", user.id);
  } catch {}
  const audio = new Audio();
  audio.id = "nativa-background-music";
  audio.preload = "none";
  audio.loop = true;
  audio.volume = 0.28;
  document.body.append(audio);
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "music-toggle";
  document.body.append(toggle);
  let panel, enabled, mode, track, status;
  if (client) {
    panel = document.createElement("section");
    panel.className = "form-panel music-settings";
    panel.innerHTML =
      '<h3>Trilha sonora</h3><label class="checkbox-row"><input id="music-enabled" type="checkbox"> Ativar música de fundo</label><label>Música durante as batalhas<select id="arena-music-mode"><option value="standard">Trilha padrão de cada área</option><option value="random">Aleatório entre as músicas da arena</option><option value="selected">Escolher uma música da arena</option></select></label><label>Faixa da arena<select id="arena-music-track"></select></label><p class="music-catalog-note"></p><p id="music-status" role="status"></p>';
    document.querySelector("#settings .section-heading").after(panel);
    enabled = panel.querySelector("#music-enabled");
    mode = panel.querySelector("#arena-music-mode");
    track = panel.querySelector("#arena-music-track");
    status = panel.querySelector("#music-status");
    if (!ARENA_TRACKS.length) {
      track.add(new Option("Nenhuma faixa de arena adicionada ainda", ""));
      panel.querySelector(".music-catalog-note").textContent =
        "A música enviada toca na página inicial e no Refúgio. As batalhas ficam sem música até você adicionar as faixas da arena. As opções abaixo ficam prontas para essas faixas.";
    } else for (const item of ARENA_TRACKS) track.add(new Option(item.title, item.id));
    const change = () => {
      settings = { enabled: enabled.checked, mode: mode.value, track: track.value || null };
      battleTrack = null;
      render();
      void save();
      void sync();
    };
    enabled.onchange = change;
    mode.onchange = change;
    track.onchange = change;
  }
  function cache() {
    try {
      localStorage.setItem(key, JSON.stringify({ settings, dirty }));
    } catch {}
  }
  let writes = Promise.resolve();
  function save() {
    dirty = true;
    cache();
    if (!client || !user) return Promise.resolve();
    const snapshot = { ...settings };
    writes = writes
      .catch(() => {})
      .then(async () => {
        const { error } = await client
          .from("player_preferences")
          .upsert({
            user_id: user.id,
            music_enabled: snapshot.enabled,
            music_mode: snapshot.mode,
            music_track: snapshot.track,
            updated_at: new Date().toISOString()
          });
        if (error) throw error;
        if (JSON.stringify(snapshot) === JSON.stringify(settings)) {
          dirty = false;
          cache();
          status.textContent = "Preferências de música salvas na sua conta.";
        }
      })
      .catch(() => {
        if (status)
          status.textContent = "Preferência mantida neste dispositivo. Vamos tentar salvar na conta ao reconectar.";
      });
    return writes;
  }
  function render() {
    toggle.hidden = !["home", "landing", "arena"].includes(area) || (area === "arena" && !ARENA_TRACKS.length);
    toggle.textContent = !settings.enabled ? "♪ Ativar música" : blocked ? "♪ Ouvir música" : "♫ Silenciar música";
    toggle.setAttribute("aria-pressed", String(settings.enabled));
    toggle.setAttribute("aria-label", toggle.textContent);
    if (panel) {
      enabled.checked = settings.enabled;
      mode.value = settings.mode;
      mode.disabled = !settings.enabled;
      track.value = settings.track || "";
      track.disabled = !settings.enabled || settings.mode !== "selected" || !ARENA_TRACKS.length;
    }
  }
  async function sync() {
    const revision = ++serial;
    const chosen = ["home", "landing"].includes(area)
      ? HOME_TRACK
      : area === "arena"
        ? (battleTrack ||= chooseArenaTrack(settings.mode, settings.track))
        : null;
    if (!settings.enabled || !chosen) {
      audio.pause();
      render();
      return;
    }
    if (source !== chosen.src) {
      audio.pause();
      source = chosen.src;
      audio.src = chosen.src;
      audio.currentTime = 0;
    }
    try {
      await audio.play();
      if (revision !== serial) {
        if (!settings.enabled || !["home", "landing", "arena"].includes(area)) audio.pause();
        return;
      }
      blocked = false;
    } catch {
      blocked = true;
    }
    render();
  }
  toggle.onclick = () => {
    if (blocked && settings.enabled) {
      void sync();
      return;
    }
    settings.enabled = !settings.enabled;
    render();
    void save();
    void sync();
  };
  // Browsers may require a gesture before playback. No autoplay failure disables the user's preference.
  const unlock = () => {
    if (settings.enabled && audio.paused) void sync();
  };
  document.addEventListener("pointerdown", unlock);
  document.addEventListener("keydown", unlock);
  document.addEventListener("nativa:view", event => {
    area =
      event.detail.id === "home"
        ? "home"
        : event.detail.id === "battle" && document.querySelector(".battlefield")
          ? "arena"
          : "other";
    void sync();
  });
  document.addEventListener("nativa:combat-start", () => {
    area = "arena";
    battleTrack = chooseArenaTrack(settings.mode, settings.track);
    void sync();
  });
  document.addEventListener("nativa:combat-close", () => {
    area = "other";
    battleTrack = null;
    void sync();
  });
  window.addEventListener("pagehide", () => audio.pause());
  window.addEventListener("online", () => {
    if (dirty) void save();
  });
  audio.addEventListener("error", () => {
    if (status) status.textContent = "Não foi possível carregar a trilha sonora. Você pode continuar usando o jogo.";
  });
  render();
  void sync();
  if (client && user) {
    try {
      const { data, error } = await client
        .from("player_preferences")
        .select("music_enabled,music_mode,music_track")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!error && data && !dirty) {
        settings = {
          enabled: data.music_enabled !== false,
          mode: ["standard", "random", "selected"].includes(data.music_mode) ? data.music_mode : "standard",
          track: data.music_track || null
        };
        cache();
        render();
        void sync();
      }
      if (dirty) await save();
    } catch {}
  }
}
