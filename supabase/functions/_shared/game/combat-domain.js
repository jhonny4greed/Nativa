import { obterTecnicaPorId } from "./techniques.js";
import { nativaPossuiTraco, obterTracoPorId } from "./traits.js";
import { obterEfeitosCombate } from "./technique-effects-v2-2-1.js";
import { podeUsarTecnicaEmCombate } from "./technique-learning.js";

const RELACOES = {
  Fogo: { fraco: "Água", resiste: "Vento" },
  Vento: { fraco: "Fogo", resiste: "Terra" },
  Terra: { fraco: "Vento", resiste: "Energia" },
  Energia: { fraco: "Terra", resiste: "Água" },
  Água: { fraco: "Energia", resiste: "Fogo" }
};

export function criarCombatente(nativa) {
  const attrs = nativa?.attrs || {};
  const maxHP = (Number(attrs.HP) || 1) * 5;
  const maxMP = (Number(attrs.MP) || 1) * 2;
  return {
    nativa,
    hp: maxHP,
    mp: maxMP,
    cooldowns: {},
    maxHP,
    maxMP,
    animacao: "",
    efeitosV21: [],
    turnoV21: 0
  };
}

export function obterTecnicasCombatente(combatente) {
  return (combatente.nativa.techniques || [])
    .map(id => obterTecnicaPorId(id))
    .filter(Boolean);
}

export function modificadorAfinidade(_atacante, defensor, tecnica) {
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
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  return String(valor).split("+").reduce((soma, parte) => soma + (Number(parte) || 0), 0);
}

function clonarCombatente(combatente) {
  return {
    ...combatente,
    cooldowns: { ...(combatente.cooldowns || {}) },
    efeitosV21: (combatente.efeitosV21 || []).map(efeito => ({ ...efeito }))
  };
}

function obterEfeitos(combatente) {
  return combatente.efeitosV21 || (combatente.efeitosV21 = []);
}

function guardarEfeito(combatente, efeito) {
  const efeitos = obterEfeitos(combatente);
  const indice = efeitos.findIndex(atual => atual.tipo === efeito.tipo);
  if (indice >= 0) efeitos.splice(indice, 1);
  efeitos.push(efeito);
}

function obterEfeito(combatente, tipo) {
  return obterEfeitos(combatente).find(efeito => efeito.tipo === tipo) || null;
}

function consumirEfeito(combatente, tipo) {
  const efeitos = obterEfeitos(combatente);
  const indice = efeitos.findIndex(efeito => efeito.tipo === tipo);
  if (indice < 0) return null;
  return efeitos.splice(indice, 1)[0];
}

function atributoEfetivo(combatente, atributo) {
  const valor = Number(combatente.nativa.attrs?.[atributo]);
  const base = Number.isFinite(valor) ? Math.max(0, valor) : 1;
  const reducao = obterEfeito(combatente, `reducao-${atributo.toLowerCase()}`)?.valor || 0;
  return Math.max(0, base - reducao);
}

function registrarEfeito(eventos, mensagem, tipo = "efeito") {
  eventos.push({ type: "combat-effect", effectType: tipo, message: mensagem });
}

function aplicarDesorientacao(alvo, eventos, origem, duranteTurnoAtivo = false) {
  const turno = alvo.turnoV21 || 0;
  guardarEfeito(alvo, {
    tipo: "desorientacao",
    valor: 1,
    expiraEmTurno: turno + (duranteTurnoAtivo ? 2 : 1),
    origem
  });
  registrarEfeito(eventos, `${alvo.nativa.name} fica Desorientada: -1 de precisão no próximo golpe ofensivo.`, "desorientacao");
}

function aplicarReducaoAtributo(alvo, atributo, eventos, origem, duranteTurnoAtivo = false) {
  const turno = alvo.turnoV21 || 0;
  guardarEfeito(alvo, {
    tipo: `reducao-${atributo.toLowerCase()}`,
    valor: 1,
    expiraEmTurno: turno + (duranteTurnoAtivo ? 2 : 1),
    origem
  });
  registrarEfeito(eventos, `${alvo.nativa.name} sofre -1 ${atributo} até o fim do próximo turno.`, "reducao-atributo");
}

function aplicarReducaoDano(combatente, categoria, valor, eventos, origem) {
  const turno = combatente.turnoV21 || 0;
  guardarEfeito(combatente, {
    tipo: "reducao-dano",
    categoria,
    valor,
    expiraEmTurno: turno + 2,
    origem
  });
  const nomeCategoria = categoria === "geral" ? "o próximo dano" : `o próximo dano ${categoria.toLowerCase()}`;
  registrarEfeito(eventos, `${combatente.nativa.name} reduz ${nomeCategoria} em ${valor}.`, "reducao-dano");
}

function aplicarEfeitosDoGolpe(usuario, alvo, tecnica, eventos) {
  for (const efeito of obterEfeitosCombate(tecnica.id)) {
    const alvoEfeito = efeito.alvo === "alvo" ? alvo : usuario;
    if (alvoEfeito.hp <= 0) continue;

    if (efeito.tipo === "desorientacao") {
      aplicarDesorientacao(alvoEfeito, eventos, tecnica.nome);
    } else if (efeito.tipo === "reducao-atributo") {
      aplicarReducaoAtributo(alvoEfeito, efeito.atributo, eventos, tecnica.nome);
    } else if (efeito.tipo === "reducao-dano") {
      aplicarReducaoDano(alvoEfeito, efeito.categoria, efeito.valor, eventos, tecnica.nome);
    } else if (efeito.tipo === "bonus-precisao") {
      const turno = alvoEfeito.turnoV21 || 0;
      guardarEfeito(alvoEfeito, {
        tipo: "bonus-precisao",
        valor: 1,
        expiraEmTurno: turno + 2,
        origem: tecnica.nome
      });
      registrarEfeito(eventos, `${alvoEfeito.nativa.name} recebe +1 de precisão no próximo golpe ofensivo.`, "bonus-precisao");
    } else if (efeito.tipo === "envenenamento") {
      const anterior = obterEfeito(alvoEfeito, "envenenamento");
      const intensificado = anterior?.intensificado || alvoEfeito.venenoIntensificadoV21 === true;
      guardarEfeito(alvoEfeito, {
        tipo: "envenenamento",
        danoPorTurno: intensificado ? 2 : 1,
        turnosRestantes: 2,
        intensificado,
        origem: tecnica.nome
      });
      registrarEfeito(eventos, `${alvoEfeito.nativa.name} foi envenenada: ${intensificado ? 2 : 1} dano ao fim dos próximos 2 turnos.`, "envenenamento");
    } else if (efeito.tipo === "intensificar-envenenamento") {
      const veneno = obterEfeito(alvoEfeito, "envenenamento");
      if (!veneno) continue;
      veneno.danoPorTurno += 1;
      veneno.intensificado = true;
      alvoEfeito.venenoIntensificadoV21 = true;
      registrarEfeito(eventos, `Peçonha Concentrada aumenta em 1 o dano de cada ocorrência restante do Envenenamento em ${alvoEfeito.nativa.name}.`, "intensificar-envenenamento");
    } else if (efeito.tipo === "digestao") {
      guardarEfeito(alvoEfeito, {
        tipo: "digestao",
        dano: 1,
        turnosRestantes: 1,
        origem: tecnica.nome
      });
      registrarEfeito(eventos, `${alvoEfeito.nativa.name} recebe Digestão: 1 dano ao fim do próximo turno.`, "digestao");
    } else if (efeito.tipo === "preparar-secrecao") {
      const turno = usuario.turnoV21 || 0;
      guardarEfeito(usuario, {
        tipo: "secrecao",
        consequencia: efeito.consequencia,
        valor: efeito.valor,
        expiraEmTurno: turno + 2,
        origem: tecnica.nome
      });
      registrarEfeito(eventos, `${usuario.nativa.name} prepara ${tecnica.nome} por até 2 turnos próprios.`, "secrecao");
    }
  }
}

function obterReducaoDano(combatente, categoria) {
  const efeito = obterEfeito(combatente, "reducao-dano");
  if (!efeito) return { valor: 0, efeito: null };
  if (efeito.categoria === "geral" || efeito.categoria === categoria) return { valor: efeito.valor, efeito };
  return { valor: 0, efeito: null };
}

function aplicarDanoRecebido(defensor, valorBruto, categoria, eventos, origem) {
  const danoBruto = Math.max(0, valorBruto);
  if (danoBruto === 0) return { damage: 0, reduction: 0 };
  const reducao = obterReducaoDano(defensor, categoria);
  const damage = Math.max(0, danoBruto - reducao.valor);
  if (reducao.efeito) {
    consumirEfeito(defensor, "reducao-dano");
    registrarEfeito(eventos, `${defensor.nativa.name} consome a redução de dano preparada por ${reducao.efeito.origem || origem}.`, "reducao-dano-consumida");
  }
  defensor.hp = Math.max(0, defensor.hp - damage);
  return { damage, reduction: reducao.valor };
}

function aplicarSecrecaoReativa(defensor, atacante, tecnica, eventos) {
  if (tecnica.categoria !== "Físico" || defensor.hp <= 0) return;
  const secrecao = obterEfeito(defensor, "secrecao");
  if (!secrecao) return;
  consumirEfeito(defensor, "secrecao");
  registrarEfeito(eventos, `A secreção de ${defensor.nativa.name} é ativada pelo ataque físico de contato.`, "secrecao-ativada");

  if (secrecao.consequencia === "reducao-atq") {
      // A reação ocorre durante o turno do atacante: a redução deve alcançá-lo
      // no próximo turno próprio, sem expirar no fim da ação em andamento.
      aplicarReducaoAtributo(atacante, "ATQ", eventos, secrecao.origem, true);
  } else if (secrecao.consequencia === "desorientacao") {
      aplicarDesorientacao(atacante, eventos, secrecao.origem, true);
  } else if (secrecao.consequencia === "dano-especial") {
    const resultado = aplicarDanoRecebido(atacante, secrecao.valor, "Especial", eventos, secrecao.origem);
    atacante.animacao = "hit";
    registrarEfeito(eventos, `${atacante.nativa.name} recebe ${resultado.damage} dano especial reativo.`, "dano-reativo");
  }
}

function processarFimDeTurno(combatente, eventos) {
  combatente.turnoV21 = (combatente.turnoV21 || 0) + 1;
  const veneno = obterEfeito(combatente, "envenenamento");
  if (veneno && veneno.turnosRestantes > 0) {
    const dano = Math.min(combatente.hp, veneno.danoPorTurno);
    combatente.hp = Math.max(0, combatente.hp - dano);
    veneno.turnosRestantes -= 1;
    registrarEfeito(eventos, `${combatente.nativa.name} sofre ${dano} de dano por Envenenamento (${veneno.turnosRestantes} ocorrência(s) restante(s)).`, "envenenamento");
    if (veneno.turnosRestantes <= 0) consumirEfeito(combatente, "envenenamento");
  }

  const digestao = obterEfeito(combatente, "digestao");
  if (digestao && digestao.turnosRestantes > 0) {
    const dano = Math.min(combatente.hp, digestao.dano);
    combatente.hp = Math.max(0, combatente.hp - dano);
    digestao.turnosRestantes -= 1;
    registrarEfeito(eventos, `${combatente.nativa.name} sofre ${dano} de dano por Digestão.`, "digestao");
    if (digestao.turnosRestantes <= 0) consumirEfeito(combatente, "digestao");
  }

  const efeitos = obterEfeitos(combatente);
  for (let index = efeitos.length - 1; index >= 0; index -= 1) {
    const efeito = efeitos[index];
    if (efeito.expiraEmTurno != null && efeito.expiraEmTurno <= combatente.turnoV21) {
      efeitos.splice(index, 1);
      registrarEfeito(eventos, `O efeito ${efeito.tipo} em ${combatente.nativa.name} termina.`, "efeito-expirado");
    }
  }
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

function validarPrecondicoes(tecnica, alvo) {
  for (const efeito of obterEfeitosCombate(tecnica.id)) {
    if (efeito.tipo === "intensificar-envenenamento") {
      const veneno = obterEfeito(alvo, "envenenamento");
      if (!veneno) throw new Error("Peçonha Concentrada requer que o alvo esteja envenenado. Nenhum recurso foi gasto.");
      if (veneno.intensificado || alvo.venenoIntensificadoV21) throw new Error("O Envenenamento desse alvo já foi intensificado uma vez. Nenhum recurso foi gasto.");
    }
  }
}

function obterSinergiasAtivas(combatente, tecnica) {
  const tracosJaAplicados = new Set();
  return (tecnica.sinergias || []).filter(sinergia => {
    if (!obterTracoPorId(sinergia.tracoId) || tracosJaAplicados.has(sinergia.tracoId)) return false;
    if (!nativaPossuiTraco(combatente.nativa, sinergia.tracoId)) return false;
    tracosJaAplicados.add(sinergia.tracoId);
    return true;
  });
}

function aplicarTecnica(combatentes, indice, tecnicaId, random, eventos) {
  const combatente = combatentes[indice];
  const adversario = combatentes[1 - indice];
  if (combatente.hp <= 0 || adversario.hp <= 0) return;

  const tecnica = obterTecnicasCombatente(combatente).find(item => item.id === tecnicaId);
  if (!tecnica) throw new Error("Golpe não encontrado na ficha.");
  if (!podeUsarTecnicaEmCombate(tecnica)) throw new Error(`${tecnica.nome} ainda não foi liberado para combate.`);
  if (!Number.isFinite(tecnica.mp) || !Number.isFinite(tecnica.recarga)) throw new Error(`${tecnica.nome} não possui custo ou recarga válidos.`);
  if (combatente.cooldowns[tecnica.id] > 0) throw new Error(`${tecnica.nome} está em recarga.`);
  if (combatente.mp < tecnica.mp) throw new Error(`${combatente.nativa.name} não tem MP suficiente.`);

  validarPrecondicoes(tecnica, adversario);
  const sinergiasAtivas = obterSinergiasAtivas(combatente, tecnica);
  const bonusDano = sinergiasAtivas.filter(item => item.efeito.tipo === "bonus_dano").reduce((sum, item) => sum + item.efeito.valor, 0);
  const bonusPrecisao = sinergiasAtivas.filter(item => item.efeito.tipo === "bonus_precisao").reduce((sum, item) => sum + item.efeito.valor, 0);

  combatente.mp -= tecnica.mp;
  combatente.animacao = "attack";
  if (tecnica.recarga > 0) combatente.cooldowns[tecnica.id] = tecnica.recarga + 1;

  if (tecnica.categoria === "Suporte") {
    aplicarEfeitosDoGolpe(combatente, adversario, tecnica, eventos);
    eventos.push({
      type: "support",
      attacker: combatente.nativa.name,
      technique: tecnica.nome,
      description: tecnica.efeito,
      sinergias: sinergiasAtivas
    });
    combatente.animacao = "recover";
    return;
  }

  const efeitoPrecisao = consumirEfeito(combatente, "bonus-precisao");
  const desorientacao = consumirEfeito(combatente, "desorientacao");
  const penalidadeBase = Math.abs(Number(tecnica.precisao) || 0);
  const threshold = Math.max(0, Math.min(10,
    penalidadeBase - bonusPrecisao - (efeitoPrecisao?.valor || 0) + (desorientacao?.valor || 0)
  ));
  const roll = tecnica.precisao == null ? null : rolarD10(random);
  if (roll != null && roll <= threshold) {
    eventos.push({ type: "miss", attacker: combatente.nativa.name, technique: tecnica.nome, roll, threshold, bonusPrecisao: 0, sinergias: [] });
    combatente.animacao = "miss";
    return;
  }

  const fisico = tecnica.categoria === "Físico";
  const ofensivo = fisico ? atributoEfetivo(combatente, "ATQ") : atributoEfetivo(combatente, "POT");
  const defesa = fisico ? atributoEfetivo(adversario, "DEF") : atributoEfetivo(adversario, "RES");
  const danoGolpe = danoNumerico(tecnica.dano);
  const baseDamage = Math.max(0, ofensivo + danoGolpe - defesa);
  const affinityModifier = modificadorAfinidade(combatente, adversario, tecnica);
  const danoSemSinergia = Math.max(0, baseDamage + affinityModifier);
  const danoAntesReducao = Math.max(0, danoSemSinergia + bonusDano);
  const resultado = aplicarDanoRecebido(adversario, danoAntesReducao, fisico ? "Físico" : "Especial", eventos, tecnica.nome);
  adversario.animacao = "hit";

  const precisaoMudouResultado = tecnica.precisao != null && roll <= penalidadeBase && roll > threshold;
  const sinergiasEfetivas = sinergiasAtivas.filter(item =>
    (item.efeito.tipo === "bonus_dano" && resultado.damage > danoSemSinergia)
    || (item.efeito.tipo === "bonus_precisao" && precisaoMudouResultado)
  );
  const bonusDanoEfetivo = resultado.damage > danoSemSinergia ? bonusDano : 0;
  eventos.push({
    type: "hit",
    attacker: combatente.nativa.name,
    target: adversario.nativa.name,
    technique: tecnica.nome,
    roll,
    threshold,
    offensive: ofensivo,
    techniqueDamage: danoGolpe,
    defense: defesa,
    baseDamage,
    affinityModifier,
    bonusDano: bonusDanoEfetivo,
    bonusPrecisao: precisaoMudouResultado ? bonusPrecisao : 0,
    reduction: resultado.reduction,
    sinergias: sinergiasEfetivas.map(item => ({ tracoId: item.tracoId, descricao: item.descricao, efeito: item.efeito })),
    damage: resultado.damage
  });

  aplicarEfeitosDoGolpe(combatente, adversario, tecnica, eventos);
  if (fisico) aplicarSecrecaoReativa(adversario, combatente, tecnica, eventos);
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

/** Resolve uma rodada 1v1 sem alterar as fichas de entrada. */
export function resolverTurnoCombate({ fighters, choices, random = Math.random, invalidActionPolicy = "error" }) {
  const combatentes = fighters.map(clonarCombatente);
  const eventos = [];
  const rolls = combatentes.map(combatente => {
    const roll = rolarD10(random);
    const agi = atributoEfetivo(combatente, "AGI");
    // Mantém efeitos de iniciativa antigos apenas em batalhas já persistidas.
    const bonus = obterEfeito(combatente, "bonus-iniciativa")?.valor || 0;
    if (bonus) consumirEfeito(combatente, "bonus-iniciativa");
    return { roll, agi, ...(bonus ? { bonus } : {}) };
  });

  combatentes.forEach((combatente, indice) => {
    combatente.initiative = rolls[indice].roll + rolls[indice].agi + (rolls[indice].bonus || 0);
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
      if (escolha?.tipo === "attack") {
        try {
          aplicarTecnica(combatentes, indice, escolha.tecnicaId, random, eventos);
        } catch (invalid) {
          if (invalidActionPolicy !== "defend") throw invalid;
          eventos.push({ type: "invalid-action", message: `A ação de ${combatente.nativa.name} ficou indisponível durante o turno. A Nativa defende.` });
          aplicarAcaoEspecial(combatentes, indice, "defend", eventos);
        }
      }
      if (escolha?.tipo === "defend" || escolha?.tipo === "recover") {
        aplicarAcaoEspecial(combatentes, indice, escolha.tipo, eventos);
      }
      if (escolha?.tipo === "attack" || escolha?.tipo === "defend" || escolha?.tipo === "recover") {
        processarFimDeTurno(combatente, eventos);
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
