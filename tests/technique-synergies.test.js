import test from "node:test";
import assert from "node:assert/strict";
import { TECNICAS, TECNICAS_V1_ARQUIVO, obterTecnicaPorId } from "../js/techniques.js";
import { TECNICAS_LINHAGEM_V2_1 } from "../js/techniques-v2-1.js";
import { LINHAGENS } from "../js/data.js";
import { CATALOGO_TRACOS, obterTracoPorId } from "../js/traits.js";
import { criarCombatente, resolverTurnoCombate } from "../js/combat-domain.js";

test("V2.1 cataloga 108 golpes em 27 linhagens, quatro por linhagem, com a distribuição proposta", () => {
  assert.equal(TECNICAS_LINHAGEM_V2_1.length, 108);
  assert.equal(LINHAGENS.length, 27);
  assert.equal(new Set(TECNICAS_LINHAGEM_V2_1.map(t => t.id)).size, 108);
  assert.deepEqual(Object.fromEntries(LINHAGENS.map(({ nome }) => [nome, TECNICAS_LINHAGEM_V2_1.filter(t => t.grupo === nome).length])), Object.fromEntries(LINHAGENS.map(({ nome }) => [nome, 4])));
  assert.deepEqual(Object.fromEntries(["Físico", "Especial", "Suporte"].map(cat => [cat, TECNICAS_LINHAGEM_V2_1.filter(t => t.categoria === cat).length])), { "Físico": 42, "Especial": 33, "Suporte": 33 });
  assert.ok(TECNICAS_LINHAGEM_V2_1.every(t => t.versao === "2.1" && t.estadoCatalogo === "em-revisao"));
});

test("40 parâmetros V2.1 consolidados são explícitos; dois IDs seguem pendentes sem herdar valores V1", () => {
  const pendentes = new Set([
    "linhagem-v2-1-marsupiais-mordida-defensiva",
    "linhagem-v2-1-ungulados-chifrada-de-impacto"
  ]);
  let count=0;
  let countEspeciais=0;
  for (const t of TECNICAS_LINHAGEM_V2_1) {
    if (t.categoria === "Físico" && !pendentes.has(t.id)) {
      count += 1;
      assert.ok(t.parametrosBalanceamento, `${t.nome}: parâmetros aprovados ausentes`);
      assert.ok(Number.isFinite(t.precisao) && Number.isFinite(t.mp) && Number.isFinite(t.recarga), `${t.nome}: parâmetro numérico ausente`);
      assert.ok(Number.isFinite(t.parametrosBalanceamento.pgBruto) && Number.isFinite(t.parametrosBalanceamento.pgLiquido), `${t.nome}: PG não calculado`);
      assert.ok(Number.isInteger(t.parametrosBalanceamento.pgLiquido), `${t.nome}: PG líquido fracionado`);
      assert.equal(t.dano, null, `${t.nome}: dano final não aprovado`);
      continue;
    }
    if(t.parametrosTecnicosDisponiveis){
      countEspeciais+=1;
      assert.ok(Number.isFinite(t.precisao)&&Number.isFinite(t.mp)&&Number.isFinite(t.recarga),`${t.nome}: parâmetro especial ausente`);
      assert.ok(Number.isInteger(t.parametrosBalanceamento.pgLiquido),`${t.nome}: PG líquido fracionado`);
      assert.equal(t.dano,null,`${t.nome}: PG líquido não deve virar dano`);
      continue;
    }
    for (const campo of ["precisao", "mp", "recarga", "pg", "dano"]) assert.equal(t[campo], null, `${t.nome}: ${campo}`);
    assert.equal(t.parametrosBalanceamento, undefined, `${t.nome}: não deve receber parametrização genérica`);
  }
  assert.equal(count,40);
  assert.equal(countEspeciais,28);
});

test("sinergias candidatas identificam Traços existentes dos seis grupos, mas não são executadas", () => {
  const grupos = new Set();
  for (const t of TECNICAS_LINHAGEM_V2_1) {
    assert.deepEqual(t.sinergias, []);
    for (const candidate of t.sinergiasCandidatas) {
      assert.ok(candidate.tracoId, `${t.nome}: Traço candidato sem ID (${candidate.nome})`);
      const traco = obterTracoPorId(candidate.tracoId);
      assert.ok(traco);
      grupos.add(traco.categoria);
    }
  }
  assert.equal(CATALOGO_TRACOS.length, 41);
  assert.equal(TECNICAS_LINHAGEM_V2_1.reduce((sum, t) => sum + t.sinergiasCandidatas.length, 0), 41);
  const synergyIds = TECNICAS_LINHAGEM_V2_1.flatMap(t => t.sinergiasCandidatas.map(x => x.id));
  assert.equal(new Set(synergyIds).size, 41);
  assert.ok(synergyIds.every(id => id.startsWith("sinergia-v2-1-")));
  const boteDeJararaca = TECNICAS_LINHAGEM_V2_1.find(t => t.nome === "Bote de Jararaca");
  assert.match(boteDeJararaca.efeito, /aplica envenenamento/i);
  assert.deepEqual(boteDeJararaca.sinergiasCandidatas.map(x => x.nome), ["Peçonha", "Presas"]);
  assert.match(boteDeJararaca.sinergiasCandidatas[0].nota, /efeito-base/i);
  assert.deepEqual([...grupos].sort(), ["Adaptações ambientais", "Estrutura corporal", "Estruturas naturais", "Fisiologia e armas naturais", "Proteção", "Sentidos"].sort());
});

test("IDs V1 arquivados continuam resolvíveis para fichas antigas sem integrar o seletor atual", () => {
  assert.equal(TECNICAS_V1_ARQUIVO.length, 105);
  for (const t of TECNICAS_V1_ARQUIVO) {
    assert.equal(t.estadoCatalogo, "arquivado");
    assert.equal(obterTecnicaPorId(t.id).id, t.id);
    assert.equal(obterTecnicaPorId(t.id).compatibilidadeCombate, true);
  }
  assert.equal(TECNICAS.some(t => t.id === "linhagem-felinos-bote-predatorio"), false);
});

test("golpes V1 mantêm sinergia dependente dos Traços e V2.1 pendente não pode ser usado em combate", () => {
  const archived = obterTecnicaPorId("linhagem-felinos-garras-perfurantes");
  assert.ok(archived.sinergias.some(x => obterTracoPorId(x.tracoId)));
  const pending = TECNICAS_LINHAGEM_V2_1.find(t => t.nome === "Bote Predatório");
  const attacker = criarCombatente({ id: "a", name: "A", attrs: { ATQ: 5, POT: 5, DEF: 2, RES: 2, AGI: 5, HP: 5, MP: 5 }, techniques: [pending.id] });
  const target = criarCombatente({ id: "b", name: "B", attrs: { ATQ: 1, POT: 1, DEF: 1, RES: 1, AGI: 1, HP: 5, MP: 5 }, techniques: [] });
  const result = resolverTurnoCombate({ fighters: [attacker, target], choices: [{ tipo: "attack", tecnicaId: pending.id }, null], random: () => 0.9 });
  assert.match(result.error.message, /não foi liberado para combate/);
  assert.equal(result.fighters[0].mp, attacker.mp);
});

test("o histórico não informa sinergia de precisão como ativa quando o golpe ainda erra", () => {
  const legacy = obterTecnicaPorId("linhagem-felinos-garras-perfurantes");
  const attacker = criarCombatente({ id: "a", name: "Com Garras", attrs: { ATQ: 3, POT: 3, DEF: 1, RES: 1, AGI: 10, HP: 5, MP: 5 }, techniques: [legacy.id], tracos: ["estrutura-natural-1"] });
  const target = criarCombatente({ id: "b", name: "Alvo", attrs: { ATQ: 1, POT: 1, DEF: 1, RES: 1, AGI: 1, HP: 5, MP: 5 }, techniques: [] });
  const rolls = [0.9, 0, 0];
  const result = resolverTurnoCombate({ fighters: [attacker, target], choices: [{ tipo: "attack", tecnicaId: legacy.id }, null], random: () => rolls.shift() });
  const miss = result.events.find(event => event.type === "miss");
  assert.ok(miss);
  assert.deepEqual(miss.sinergias, []);
  assert.equal(miss.bonusPrecisao, 0);
});
