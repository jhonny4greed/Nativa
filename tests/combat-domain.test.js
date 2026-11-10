import test from "node:test";
import assert from "node:assert/strict";
import { TECNICAS } from "../js/techniques.js";
import { CATALOGO_TRACOS } from "../js/traits.js";
import {
  criarCombatente,
  modificadorAfinidade,
  avancarCombatentesDeTurno,
  resolverTurnoCombate
} from "../js/combat-domain.js";
import { podeUsarTecnicaEmCombate } from "../js/technique-learning.js";

function golpe(nome, grupo) {
  const result = TECNICAS.find(item => item.nome === nome && (!grupo || item.grupo === grupo));
  assert.ok(result, `Golpe V2.2.1 ausente: ${grupo || ""} ${nome}`);
  return result;
}
function comAprovacaoDeTeste(moves, executar) {
  const anteriores = moves.map(move => move.estadoCatalogo);
  try {
    moves.forEach(move => { move.estadoCatalogo = "aprovado"; });
    return executar();
  } finally {
    moves.forEach((move, index) => { move.estadoCatalogo = anteriores[index]; });
  }
}
function nativa(id, name, overrides = {}) {
  return {
    id, name,
    attrs: { ATQ: 3, POT: 4, DEF: 2, RES: 2, AGI: 3, HP: 10, MP: 4 },
    affinity: "Fogo", techniques: [], essencias: [], afinidadesEssencia: [], tracos: [],
    ...overrides
  };
}
function rolagens(values) {
  let index = 0;
  return () => ((values[index++] ?? 10) - 1) / 10;
}
function rodada(fighters, choices, values) {
  return resolverTurnoCombate({ fighters, choices, random: rolagens(values) });
}

 test("novo combatente mantém ficha e começa sem estados temporários", () => {
  const ficha = nativa("a", "Aruã");
  const combatente = criarCombatente(ficha);
  assert.equal(combatente.nativa, ficha);
  assert.equal(combatente.hp, 50);
  assert.equal(combatente.mp, 8);
  assert.deepEqual(combatente.efeitosV21, []);
  assert.equal(combatente.turnoV21, 0);
});

test("golpes em revisão continuam bloqueados mesmo com parâmetros preenchidos", () => {
  const bico = golpe("Bico Poderoso", "Psitacídeos");
  assert.equal(bico.estadoCatalogo, "em-revisao");
  assert.equal(bico.parametrosTecnicosDisponiveis, true);
  assert.equal(podeUsarTecnicaEmCombate(bico), false);
  const a = criarCombatente(nativa("a", "Aruã", { techniques: [bico.id] }));
  const b = criarCombatente(nativa("b", "Bento"));
  const result = rodada([a, b], [{ tipo: "attack", tecnicaId: bico.id }, { tipo: "defend" }], [10, 1]);
  assert.match(result.error.message, /não foi liberado/);
  assert.equal(result.fighters[0].mp, a.mp);
});

test("dano físico usa ATQ contra DEF e preserva ficha e sinergia opcional", () => {
  const bico = golpe("Bico Poderoso", "Psitacídeos");
  const tracoBico = CATALOGO_TRACOS.find(item => item.nome === "Bico").id;
  const a = criarCombatente(nativa("a", "Aruã", { techniques: [bico.id], tracos: [] }));
  const b = criarCombatente(nativa("b", "Bento", { attrs: { ATQ: 1, POT: 1, DEF: 2, RES: 3, AGI: 1, HP: 10, MP: 2 } }));
  const antes = structuredClone([a, b]);
  const result = comAprovacaoDeTeste([bico], () => rodada([a, b], [{ tipo: "attack", tecnicaId: bico.id }, { tipo: "defend" }], [10, 1, 10]));
  const hit = result.events.find(event => event.type === "hit");
  assert.equal(hit.offensive, 3);
  assert.equal(hit.defense, 2);
  assert.equal(hit.damage, 5);
  assert.equal(hit.sinergias.length, 0, "golpes V2.2 não recebem sinergias por inferência de nome do Traço");
  assert.equal(result.fighters[0].mp, a.mp - bico.mp);
  assert.deepEqual([a, b], antes, "a resolução não muta as fichas nem combatentes recebidos");

  const comTraco = criarCombatente(nativa("c", "Psitacídeo", { techniques: [bico.id], tracos: [tracoBico] }));
  const synergyResult = comAprovacaoDeTeste([bico], () => rodada([comTraco, b], [{ tipo: "attack", tecnicaId: bico.id }, { tipo: "defend" }], [10, 1, 10]));
  assert.equal(synergyResult.events.find(event => event.type === "hit").damage, 6);
  assert.equal(synergyResult.events.find(event => event.type === "hit").sinergias.length, 1);
});

test("dano físico e especial não ficam abaixo de zero; afinidades duplas anulam relações opostas", () => {
  const bico = golpe("Bico Poderoso", "Psitacídeos");
  const jato = golpe("Jato de Labaredas", "Fogo");
  const a = criarCombatente(nativa("a", "Aruã", { techniques: [bico.id, jato.id], affinity: "Neutro" }));
  const b = criarCombatente(nativa("b", "Bento", { attrs: { ATQ: 1, POT: 1, DEF: 30, RES: 30, AGI: 1, HP: 10, MP: 2 } }));
  const result = comAprovacaoDeTeste([bico], () => rodada([a, b], [{ tipo: "attack", tecnicaId: bico.id }, { tipo: "defend" }], [10, 1, 10]));
  assert.equal(result.events.find(event => event.type === "hit").damage, 0);
  assert.equal(result.fighters[1].hp, 50);

  const defensor = criarCombatente(nativa("c", "Dupla", {
    affinity: "Vento", essencias: ["segunda"], afinidadesEssencia: ["Vento", "Água"]
  }));
  assert.equal(modificadorAfinidade(a, defensor, jato), 0);
  const vulneravel = criarCombatente(nativa("d", "Vento", { affinity: "Vento" }));
  assert.equal(modificadorAfinidade(a, vulneravel, jato), 2);
  const resistente = criarCombatente(nativa("e", "Água", { affinity: "Água" }));
  assert.equal(modificadorAfinidade(a, resistente, jato), -2);
});

test("golpe de suporte aplica redução de dano sem rolagem ofensiva", () => {
  const muralha = golpe("Muralha Súbita", "Terra");
  const bico = golpe("Bico Poderoso", "Psitacídeos");
  const a = criarCombatente(nativa("a", "Terra", { affinity: "Terra", techniques: [muralha.id] }));
  const b = criarCombatente(nativa("b", "Aruã", { attrs: { ATQ: 3, POT: 1, DEF: 2, RES: 2, AGI: 10, HP: 10, MP: 2 }, techniques: [bico.id] }));
  const preparo = comAprovacaoDeTeste([muralha], () => rodada([a, b], [{ tipo: "attack", tecnicaId: muralha.id }, { tipo: "defend" }], [10, 1]));
  assert.equal(preparo.events.some(event => event.type === "support"), true);
  assert.equal(preparo.events.some(event => event.type === "hit"), false);
  assert.equal(preparo.fighters[0].efeitosV21.some(effect => effect.tipo === "reducao-dano"), true);
  const next = avancarCombatentesDeTurno(preparo.fighters);
  const attack = comAprovacaoDeTeste([bico], () => rodada(next, [{ tipo: "defend" }, { tipo: "attack", tecnicaId: bico.id }], [1, 10, 10]));
  const hit = attack.events.find(event => event.type === "hit");
  assert.equal(hit.damage, 2);
  assert.equal(hit.reduction, 3);
  assert.equal(attack.fighters[0].efeitosV21.some(effect => effect.tipo === "reducao-dano"), false);
});

test("falha de precisão não aplica desorientação e golpe bem-sucedido afeta o próximo ataque", () => {
  const rugido = golpe("Rugido da Caçadora", "Felinos");
  const jato = golpe("Jato Direto", "Água");
  const a = criarCombatente(nativa("a", "Felino", { attrs: { ATQ: 3, POT: 4, DEF: 2, RES: 2, AGI: 10, HP: 10, MP: 4 }, techniques: [rugido.id] }));
  const b = criarCombatente(nativa("b", "Peixe", { affinity: "Água", attrs: { ATQ: 2, POT: 4, DEF: 2, RES: 2, AGI: 1, HP: 10, MP: 2 }, techniques: [jato.id] }));
  const failed = comAprovacaoDeTeste([rugido], () => rodada([a, b], [{ tipo: "attack", tecnicaId: rugido.id }, { tipo: "defend" }], [10, 1, 1]));
  assert.equal(failed.events.some(event => event.type === "miss"), true);
  assert.equal(failed.fighters[1].efeitosV21.some(effect => effect.tipo === "desorientacao"), false);

  const hit = comAprovacaoDeTeste([rugido, jato], () => rodada([a, b], [
    { tipo: "attack", tecnicaId: rugido.id }, { tipo: "attack", tecnicaId: jato.id }
  ], [10, 1, 10, 2]));
  assert.equal(hit.events.find(event => event.type === "miss").threshold, 2);
  assert.equal(hit.fighters[1].efeitosV21.some(effect => effect.tipo === "desorientacao"), false, "o bônus é consumido na próxima tentativa ofensiva");
});

test("envenenamento causa uma ocorrência no fim do turno do alvo e mantém a seguinte", () => {
  const bote = golpe("Bote de Jararaca", "Serpentes");
  const a = criarCombatente(nativa("a", "Jararaca", { attrs: { ATQ: 3, POT: 4, DEF: 2, RES: 2, AGI: 10, HP: 10, MP: 4 }, techniques: [bote.id] }));
  const b = criarCombatente(nativa("b", "Alvo", { attrs: { ATQ: 1, POT: 1, DEF: 1, RES: 2, AGI: 1, HP: 10, MP: 1 } }));
  const result = comAprovacaoDeTeste([bote], () => rodada([a, b], [{ tipo: "attack", tecnicaId: bote.id }, { tipo: "defend" }], [10, 1, 10]));
  assert.equal(result.fighters[1].hp, 44);
  assert.equal(result.fighters[1].efeitosV21.find(effect => effect.tipo === "envenenamento").turnosRestantes, 1);
  assert.equal(result.events.filter(event => event.effectType === "envenenamento").length, 2, "registro do status e uma ocorrência de dano");
});

 test("secreção reativa reduz ATQ até o próximo turno do atacante e ativa uma única vez", () => {
  const secrecao = golpe("Secreção Defensiva", "Mustelídeos");
  const bico = golpe("Bico Poderoso", "Psitacídeos");
  const a = criarCombatente(nativa("a", "Mustelídeo", { attrs: { ATQ: 2, POT: 4, DEF: 2, RES: 2, AGI: 1, HP: 10, MP: 4 }, techniques: [secrecao.id] }));
  const b = criarCombatente(nativa("b", "Psitacídeo", { attrs: { ATQ: 3, POT: 1, DEF: 2, RES: 2, AGI: 10, HP: 10, MP: 4 }, techniques: [bico.id] }));
  const prep = comAprovacaoDeTeste([secrecao], () => rodada([a, b], [{ tipo: "attack", tecnicaId: secrecao.id }, { tipo: "defend" }], [10, 10, 10]));
  assert.equal(prep.fighters[0].efeitosV21.some(effect => effect.tipo === "secrecao"), true);
  const next = avancarCombatentesDeTurno(prep.fighters);
  const reaction = comAprovacaoDeTeste([bico], () => rodada(next, [{ tipo: "defend" }, { tipo: "attack", tecnicaId: bico.id }], [10, 2, 10]));
  assert.equal(reaction.fighters[0].efeitosV21.some(effect => effect.tipo === "secrecao"), false);
  assert.equal(reaction.fighters[1].efeitosV21.some(effect => effect.tipo === "reducao-atq"), true);
  const following = avancarCombatentesDeTurno(reaction.fighters);
  const hit = comAprovacaoDeTeste([bico], () => rodada(following, [{ tipo: "defend" }, { tipo: "attack", tecnicaId: bico.id }], [10, 1, 10]));
  assert.equal(hit.events.find(event => event.type === "hit").offensive, 2);
  assert.equal(hit.fighters[1].efeitosV21.some(effect => effect.tipo === "reducao-atq"), false);
});
