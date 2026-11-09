import { obterResumoProgressao } from "./progression.js";

export function featuredSummary(nativa) {
  const progress = obterResumoProgressao(structuredClone(nativa));
  const attributes = Object.entries(nativa.attrs || {});
  const scale = Math.max(10, ...attributes.map(([, value]) => Number(value) || 0));
  return {
    ...progress,
    xpPercent: Math.max(0, Math.min(100, progress.xpAtual / progress.xpNecessario * 100)),
    attributes: attributes.map(([name, value]) => ({ name, value, percent: Math.max(0, Math.min(100, value / scale * 100)) }))
  };
}
