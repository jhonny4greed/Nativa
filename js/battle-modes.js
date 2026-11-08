import { obterTecnicasCombatente } from "./combat-domain.js";

export const MODOS_BATALHA = Object.freeze({
  CPU: "cpu",
  LOCAL: "local"
});

/** Escolhe uma ação legal existente, sem revelar a técnica na camada de UI. */
export function escolherAcaoCpu(combatente, random = Math.random) {
  const tecnicasDisponiveis = obterTecnicasCombatente(combatente).filter(tecnica =>
    tecnica.estadoCatalogo !== "em-revisao" &&
    (combatente.cooldowns?.[tecnica.id] || 0) <= 0 &&
    combatente.mp >= tecnica.mp
  );

  if (tecnicasDisponiveis.length) {
    const sorteio = Number(random());
    const indice = Number.isFinite(sorteio)
      ? Math.min(tecnicasDisponiveis.length - 1, Math.max(0, Math.floor(sorteio * tecnicasDisponiveis.length)))
      : 0;
    return { tipo: "attack", tecnicaId: tecnicasDisponiveis[indice].id };
  }

  if (combatente.mp < combatente.maxMP) return { tipo: "recover" };
  return { tipo: "defend" };
}
