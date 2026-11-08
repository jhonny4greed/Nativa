/**
 * Extensão técnica provisória para futura configuração de interações por arena.
 * Chaves: ID da técnica -> nome já existente em BIOMAS -> definição do efeito.
 * Vazio por decisão de design: não há efeitos cadastrados nem aplicados.
 */
export const MODIFICADORES_TECNICA_ARENA = Object.freeze({});

/** Retorna a definição configurada ou null quando não houver interação. */
export function obterModificadorTecnicaArena(tecnicaId, biomaArena, configuracao = MODIFICADORES_TECNICA_ARENA) {
  if (!tecnicaId || !biomaArena || !configuracao || typeof configuracao !== "object") return null;
  return configuracao[tecnicaId]?.[biomaArena] ?? null;
}
