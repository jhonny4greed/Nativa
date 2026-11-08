/**
 * Fonte de recompensa de Essências configurável pela mesa.
 * `synchrony` fica reservado para uma estratégia futura; não concede progresso nesta versão.
 */
export const MODOS_RECOMPENSA_ESSENCIA = Object.freeze({
  DROP: "drop",
  SINCRONIA: "synchrony"
});

export const CONFIG_ESSENCIA_PADRAO = Object.freeze({
  modo: MODOS_RECOMPENSA_ESSENCIA.DROP,
  chanceDrop: 20
});

export function rolarDropEssencia(chancePercentual, random = Math.random) {
  const chance = Number(chancePercentual);
  if (!Number.isFinite(chance) || chance < 0 || chance > 100) {
    throw new Error("A chance de drop deve estar entre 0 e 100%.");
  }
  if (chance === 0) return false;
  if (chance === 100) return true;
  return random() * 100 < chance;
}

export function criarEssenciaPendente({ id, oponente, modo = MODOS_RECOMPENSA_ESSENCIA.DROP }) {
  if (modo !== MODOS_RECOMPENSA_ESSENCIA.DROP) return null;
  return {
    id,
    origem: "combate",
    oponenteId: oponente?.id || null,
    oponenteNome: oponente?.name || "Nativa adversária",
    oponenteLinhagem: oponente?.lineageName || oponente?.lineage || "",
    oponenteAfinidade: oponente?.affinity || ""
  };
}
