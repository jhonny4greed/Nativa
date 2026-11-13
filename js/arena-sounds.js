import { fallbackVoice } from "./audio-clips.js";
import { nativeSounds } from "./native-sounds.js";

export function defaultSoundUrl(nativa, kind) {
  if (kind === "cry") {
    const voice = fallbackVoice(nativa);
    return new URL(`../assets/audio/sfx/cry-${voice}.wav`, import.meta.url).href;
  }
  const affinity = String(nativa.affinity || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const effect = ["fogo", "agua", "terra", "vento", "energia"].includes(affinity) ? affinity : "impact";
  return new URL(`../assets/audio/sfx/attack-${effect}.wav`, import.meta.url).href;
}

export function createArenaSounds({
  preferences,
  service = nativeSounds,
  fetchImpl = fetch,
  contextFactory = () => new (globalThis.AudioContext || globalThis.webkitAudioContext)()
}) {
  let context,
    generation = 0,
    active = null;
  const cache = new Map();
  function unlock() {
    if (preferences().sounds === false) return;
    try {
      context ||= contextFactory();
      void context.resume().catch(() => {});
    } catch {}
  }
  function stop() {
    generation++;
    active?.stop();
    active = null;
  }
  async function buffer(nativa, kind) {
    const path = nativa.soundEffect?.[kind === "cry" ? "cryPath" : "attackPath"];
    const url = defaultSoundUrl(nativa, kind),
      key = path || url;
    if (cache.has(key)) return cache.get(key);
    const loading = (async () => {
      let blob = path ? await service.load(nativa, kind).catch(() => null) : null;
      if (!blob) {
        const response = await fetchImpl(url);
        if (!response.ok) throw new Error("Som indisponível.");
        blob = await response.blob();
      }
      return context.decodeAudioData(await blob.arrayBuffer());
    })();
    cache.set(key, loading);
    if (cache.size > 40) cache.delete(cache.keys().next().value);
    try {
      return await loading;
    } catch (error) {
      cache.delete(key);
      throw error;
    }
  }
  async function play(nativa, kind, token = generation) {
    if (preferences().sounds === false || token !== generation || globalThis.document?.hidden) return;
    unlock();
    if (!context) return;
    try {
      await context.resume();
      if (context.state !== "running" || token !== generation) return;
      const decoded = await buffer(nativa, kind);
      if (token !== generation || preferences().sounds === false || globalThis.document?.hidden) return;
      const node = context.createBufferSource(),
        gain = context.createGain();
      node.buffer = decoded;
      const seconds = Math.min(kind === "cry" ? 1.8 : 1.5, decoded.duration, 2);
      gain.gain.setValueAtTime(0.5, context.currentTime);
      gain.gain.setTargetAtTime(0, context.currentTime + Math.max(0, seconds - 0.05), 0.015);
      node.connect(gain);
      gain.connect(context.destination);
      await new Promise(resolve => {
        active = node;
        node.onended = () => {
          if (active === node) active = null;
          node.disconnect();
          gain.disconnect();
          resolve();
        };
        node.start(0, 0, seconds);
      });
    } catch {
      /* Missing or blocked audio must never interrupt combat. */
    }
  }
  async function start(fighters) {
    stop();
    const token = generation;
    for (const fighter of fighters) {
      if (token !== generation) return;
      await play(fighter.nativa, "cry", token);
    }
  }
  async function actions(actions, fighters) {
    stop();
    const token = generation;
    for (const action of actions) {
      if (token !== generation) return;
      if (["hit", "v21-hit", "miss", "support"].includes(action.type) && fighters[action.actor])
        await play(fighters[action.actor].nativa, "attack", token);
    }
  }
  return {
    unlock,
    stop,
    start,
    actions,
    preview: async (nativa, kind) => {
      stop();
      unlock();
      await play(nativa, kind);
    }
  };
}
