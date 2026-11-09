// Defaults are presentation assets; user portraits always take precedence.
export const CREATURE_ART = Object.freeze({
  "preset-guara": new URL("../assets/generated/nativa-guara.webp", import.meta.url).href,
  "preset-arua": new URL("../assets/generated/nativa-arua.webp", import.meta.url).href,
  "preset-tatua": new URL("../assets/generated/nativa-tatua.webp", import.meta.url).href,
  "preset-quira": new URL("../assets/generated/nativa-quira.webp", import.meta.url).href,
  "preset-ecoa": new URL("../assets/generated/nativa-ecoa.webp", import.meta.url).href
});
export function defaultPortrait(nativa) { return CREATURE_ART[nativa?.id] || null; }
