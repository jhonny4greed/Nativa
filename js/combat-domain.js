import { TECNICAS, obterTecnicaPorId } from "./techniques.js";
import { nativaPossuiTraco, obterTracoPorId } from "./traits.js";
import { obterModificadorTecnicaArena } from "./arena-technique-modifiers.js";
import { podeUsarTecnicaEmCombate } from "./technique-learning.js";

const RELACOES = {
  Fogo: { fraco: "Água", resiste: "Vento" },
  Vento: { fraco: "Fogo", resiste: "Terra" },
  Terra: { fraco: "Vento", resiste: "Energia" },
  Energia: { fraco: "Terra", resiste: "Água" },
  Água: { fraco: "Energia", resiste: "Fogo" }
};

export function criarCombatente(nativa) {
  return {
    nativa,
    hp: (nativa.attrs.HP || 1) * 5,
    mp: (nativa.attrs.MP || 1) * 2,
    cooldowns: {},
    maxHP: (nativa.attrs.HP || 1) * 5,
    maxMP: (nativa.attrs.MP || 1) * 2,
    animacao: ""
  };
}

export function obterTecnicasCombatente(combatente) {
  return (combatente.nativa.techniques || [])
    .map(id => obterTecnicaPorId(id))
    .filter(Boolean);
}

export function modificadorAfinidade(atacante, defensor, tecnica) {
  if (tecnica.origem !== "afinidade") return 0;

  const ataque = tecnica.grupo;
  const defesas = [
    defensor.nativa.affinity,
    ...((defensor.nativa.essencias || []).includes("segunda")
      ? [defensor.nativa.afinidadesEssencia?.[1]].filter(Boolean)
      : [])
  ];

  let fraco = false;
  let resiste = false;
  for (const afinidade of defesas) {
    const relacao = RELACOES[afinidade];
    if (!relacao) continue;
    if (relacao.fraco === ataque) fraco = true;
    if (relacao.resiste === ataque) resiste = true;
  }

  if (fraco && resiste) return 0;
  return fraco ? 2 : resiste ? -2 : 0;
}

export function danoNumerico(valor) {
  if (valor === null || valor === undefined) return 0;
  if (typeof valor === "number") return valor;
  return String(valor).split("+").reduce((soma, parte) => soma + (Number(parte) || 0), 0);
}

function clonarCombatente(combatente) {
  return { ...combatente, cooldowns: { ...(combatente.cooldowns || {}) } };
}

export function avancarCombatentesDeTurno(combatentes) {
  return combatentes.map(combatente => {
    const atualizado = clonarCombatente(combatente);
    Object.keys(atualizado.cooldowns).forEach(id => {
      atualizado.cooldowns[id] = Math.max(0, atualizado.cooldowns[id] - 1);
      if (atualizado.cooldowns[id] === 0) delete atualizado.cooldowns[id];
    });
    atualizado.animacao = "";
    return atualizado;
  });
}

function rolarD10(random) {
  return Math.floor(random() * 10) + 1;
}

function aplicarTecnica(combatentes, indice, tecnicaId, random, eventos, biomaArena) {
  const combatente = combatentes[indice];
  const adversario = combatentes[1 - indice];
  if (combatente.hp <= 0 || adversario.hp <= 0) return;

  const tecnica = obterTecnicasCombatente(combatente).find(item => item.id === tecnicaId);
  if (!tecnica) throw new Error("Técnica não encontrada na ficha.");
  if (!podeUsarTecnicaEmCombate(tecnica)) throw new Error(`${tecnica.nome} pertence à V2.1 em revisão e ainda não possui parâmetros técnicos validados para uso em combate.`);
  if (combatente.cooldowns[tecnica.id] > 0) throw new Error(`${tecnica.nome} está em recarga.`);
  if (combatente.mp < tecnica.mp) throw new Error(`${combatente.nativa.name} não tem MP suficiente.`);

  // Um mesmo ID de Traço só ativa uma entrada por resolução; nenhum Traço é requisito.
  const tracosJaAplicados = new Set();
  const sinergiasAtivas = (tecnica.sinergias || []).filter(sinergia => {
    if (!obterTracoPorId(sinergia.tracoId) || tracosJaAplicados.has(sinergia.tracoId)) return false;
    if (!nativaPossuiTraco(combatente.nativa, sinergia.tracoId)) return false;
    tracosJaAplicados.add(sinergia.tracoId);
    return true;
  });
  const bonusDano = sinergiasAtivas.filter(x => x.efeito.tipo === "bonus_dano").reduce((sum, x) => sum + x.efeito.valor, 0);
  const bonusPrecisao = sinergiasAtivas.filter(x => x.efeito.tipo === "bonus_precisao").reduce((sum, x) => sum + x.efeito.valor, 0);

  combatente.mp -= tecnica.mp;
  combatente.animacao = "attack";
  if (tecnica.recarga > 0) combatente.cooldowns[tecnica.id] = tecnica.recarga + 1;

  if (tecnica.categoria === "Suporte") {
    eventos.push({ type: "support", attacker: combatente.nativa.name, technique: tecnica.nome, description: tecnica.efeito, sinergias: sinergiasAtivas });
    combatente.animacao = "recover";
    return;
  }

  const roll = rolarD10(random);
  const threshold = Math.max(0, Math.abs(Number(tecnica.precisao) || 0) - bonusPrecisao);
  if (tecnica.precisao !== null && roll <= threshold) {
    eventos.push({ type: "miss", attacker: combatente.nativa.name, technique: tecnica.nome, roll, threshold, bonusPrecisao: 0, sinergias: [] });
    combatente.animacao = "miss";
    return;
  }

  const physical = tecnica.categoria === "Físico";
  const offensive = physical ? (combatente.nativa.attrs.ATQ || 1) : (combatente.nativa.attrs.POT || 1);
  const defense = physical ? (adversario.nativa.attrs.DEF || 1) : (adversario.nativa.attrs.RES || 1);
  const techniqueDamage = danoNumerico(tecnica.dano);
  const baseDamage = Math.max(1, offensive + techniqueDamage - defense);
  const affinityModifier = modificadorAfinidade(combatente, adversario, tecnica);
  // Ponto de integração para consulta futura. Sem configuração, nenhum efeito é aplicado.
  obterModificadorTecnicaArena(tecnica.id, biomaArena);
  const danoSemSinergia = Math.max(0, baseDamage + affinityModifier);
  const damage = Math.max(0, danoSemSinergia + bonusDano);
  const thresholdBase = Math.max(0, Math.abs(Number(tecnica.precisao) || 0));
  const precisaoMudouResultado = tecnica.precisao !== null && roll <= thresholdBase && roll > threshold;
  const sinergiasEfetivas = sinergiasAtivas.filter(x => (x.efeito.tipo === "bonus_dano" && damage > danoSemSinergia) || (x.efeito.tipo === "bonus_precisao" && precisaoMudouResultado));
  const bonusDanoEfetivo = damage > danoSemSinergia ? bonusDano : 0;

  adversario.hp = Math.max(0, adversario.hp - damage);
  adversario.animacao = "hit";
  eventos.push({
    type: "hit", attacker: combatente.nativa.name, target: adversario.nativa.name,
    technique: tecnica.nome, roll, offensive, techniqueDamage, defense,
    baseDamage, affinityModifier, bonusDano: bonusDanoEfetivo, bonusPrecisao: precisaoMudouResultado ? bonusPrecisao : 0, sinergias: sinergiasEfetivas.map(x => ({ tracoId: x.tracoId, descricao: x.descricao, efeito: x.efeito })), damage
  });
}

function aplicarAcaoEspecial(combatentes, indice, tipo, eventos) {
  const combatente = combatentes[indice];
  if (tipo === "defend") {
    combatente.animacao = "defend";
    eventos.push({ type: "defend", fighter: combatente.nativa.name });
    return;
  }
  if (tipo === "recover") {
    const before = combatente.mp;
    combatente.mp = Math.min(combatente.maxMP, combatente.mp + 1);
    const recovered = combatente.mp - before;
    combatente.animacao = "recover";
    eventos.push({ type: "recover", fighter: combatente.nativa.name, recovered, mp: combatente.mp, maxMP: combatente.maxMP });
  }
}

/**
 * Resolve uma rodada seguindo a ordem e os cálculos usados anteriormente em app.js.
 * random deve ter a semântica de Math.random; no uso normal, Math.random é usado.
 */
export function resolverTurnoCombate({ fighters, choices, random = Math.random, biomaArena = null }) {
  const combatentes = fighters.map(clonarCombatente);
  const eventos = [];
  const rolls = combatentes.map(combatente => ({
    roll: rolarD10(random),
    agi: combatente.nativa.attrs.AGI || 1
  }));

  combatentes.forEach((combatente, indice) => {
    combatente.initiative = rolls[indice].roll + rolls[indice].agi;
  });

  const order = combatentes[0].initiative >= combatentes[1].initiative ? [0, 1] : [1, 0];
  eventos.push({
    type: "initiative",
    rolls: rolls.map((item, indice) => ({ ...item, initiative: combatentes[indice].initiative })),
    order,
    names: combatentes.map(item => item.nativa.name)
  });

  let error = null;
  try {
    for (const indice of order) {
      const combatente = combatentes[indice];
      const adversario = combatentes[1 - indice];
      if (combatente.hp <= 0 || adversario.hp <= 0) continue;
      const escolha = choices[indice];
      if (escolha?.tipo === "attack") aplicarTecnica(combatentes, indice, escolha.tecnicaId, random, eventos, biomaArena);
      if (escolha?.tipo === "defend" || escolha?.tipo === "recover") {
        aplicarAcaoEspecial(combatentes, indice, escolha.tipo, eventos);
      }
      if (adversario.hp <= 0) break;
    }
  } catch (caught) {
    error = caught;
  }

  const defeated = error ? null : combatentes.find(combatente => combatente.hp <= 0);
  if (defeated) {
    const winner = combatentes.find(combatente => combatente.hp > 0);
    eventos.push({ type: "defeat", defeated: defeated.nativa.name, winner: winner?.nativa.name || "ninguém" });
  }

  return {
    fighters: combatentes,
    rolls,
    order,
    events: eventos,
    ended: Boolean(defeated),
    error
  };
}
