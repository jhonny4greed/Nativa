import { obterTecnicasCombatente } from "./combat-domain.js";
import { podeUsarTecnicaEmCombate } from "./technique-learning.js";

export const MODOS_BATALHA = Object.freeze({
  CPU: "cpu",
  LOCAL: "local"
});

/** Escolhe uma ação legal existente, sem revelar a técnica na camada de UI. */
export function escolherAcaoCpu(combatente, random = Math.random, adversario = null) {
  const tecnicasDisponiveis = obterTecnicasCombatente(combatente).filter(tecnica =>
    podeUsarTecnicaEmCombate(tecnica) &&
    (combatente.cooldowns?.[tecnica.id] || 0) <= 0 &&
    combatente.mp >= tecnica.mp &&
    (tecnica.id!=='linhagem-v2-1-serpentes-peconha-concentrada' || Boolean(adversario?.efeitosV21?.some(efeito=>efeito.tipo==='envenenamento'&&!efeito.intensificado)&&!adversario?.venenoIntensificadoV21))
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
