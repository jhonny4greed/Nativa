const ART={
  "preset-guara":new URL("../assets/generated/arena-guara.webp",import.meta.url).href,
  "preset-arua":new URL("../assets/generated/arena-arua.webp",import.meta.url).href,
  "preset-tatua":new URL("../assets/generated/arena-tatua.webp",import.meta.url).href,
  "preset-quira":new URL("../assets/generated/arena-quira.webp",import.meta.url).href,
  "preset-ecoa":new URL("../assets/generated/arena-ecoa.webp",import.meta.url).href
};
const SPECIES={"Lobo-guará":"preset-guara","Dourado":"preset-arua","Tatu-canastra":"preset-tatua","Quero-quero":"preset-quira","Morcego-pescador":"preset-ecoa"};
export function arenaPortrait(nativa) {return ART[nativa?.arenaArtId]||ART[nativa?.id]||ART[SPECIES[nativa?.species]]||null;}
