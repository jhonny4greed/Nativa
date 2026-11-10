import test from "node:test";
import assert from "node:assert/strict";
import { adicionarXP, aumentarAtributo, custoAtributo, inicializarProgressao, obterResumoProgressao, xpNecessario, xpTotalParaNivel, xpPorVitoria } from "../js/progression.js";
import { ESSENCIAS, verificarEssencia } from "../js/essences.js";
import { criarRepositorioLocal } from "../js/repository.js";

const fichaBase = () => ({
  id: "progression-test", name: "Aruã", nivel: 1, xp: 0, xpa: 42, estagio: 1,
  attrs: { ATQ: 1, POT: 1, DEF: 1, RES: 1, AGI: 1, HP: 1, MP: 1 },
  essencias: [], afinidadesEssencia: [], historicoProgressao: []
});

test("XP para próximo nível é o nível de destino e XP acumulado soma saldo e níveis", () => {
  const ficha = fichaBase();
  assert.equal(xpNecessario(ficha), 2);
  adicionarXP(ficha, 5);
  assert.equal(ficha.nivel, 3);
  assert.equal(ficha.xp, 0);
  assert.equal(ficha.xpTotal, 5);
  assert.equal(obterResumoProgressao(ficha).xpAcumulado, 5);
  assert.equal(xpNecessario(ficha), 4);
  assert.equal(xpTotalParaNivel(2), 2);
});

test("recompensa de vitória compara níveis: inferior +1, igual +2, superior +3", () => {
  assert.equal(xpPorVitoria(6, 5), 1);
  assert.equal(xpPorVitoria(5, 5), 2);
  assert.equal(xpPorVitoria(5, 6), 3);
  assert.throws(() => xpPorVitoria(0, 1), /inteiros positivos/);
});

test("simulações até níveis 5, 10, 12 e 17 concedem XPA igual à soma dos níveis alcançados", () => {
  const expected = [[5, 14], [10, 54], [12, 77], [17, 152]];
  for (const [level, total] of expected) {
    const ficha = fichaBase();
    const result = adicionarXP(ficha, total);
    assert.equal(ficha.nivel, level);
    assert.equal(ficha.xp, 0);
    assert.equal(ficha.xpTotal, total);
    assert.equal(ficha.xpa - 42, total, "XPA ganha por nível, excluindo o orçamento inicial");
    assert.equal(result.niveisConquistados.length, level - 1);
    assert.equal(new Set(result.niveisConquistados.map(x => x.nivelNovo)).size, level - 1);
  }
});

test("ganho de XP em parcelas e em lote produz as mesmas recompensas, sem duplicar marcos", () => {
  const lote = fichaBase();
  const parcelas = fichaBase();
  adicionarXP(lote, 152);
  for (let i = 0; i < 152; i++) adicionarXP(parcelas, 1);
  for (const key of ["nivel", "xp", "xpTotal", "xpa", "estagio"]) assert.equal(lote[key], parcelas[key], key);
  assert.equal(lote.historicoProgressao.filter(x => x.tipo === "nivel").length, 16);
  assert.equal(lote.historicoProgressao.filter(x => x.estagioNovo !== x.estagioAnterior).length, 2);
});

test("XP residual legada calcula acumulado ao carregar e mantém a progressão", () => {
  const legada = { ...fichaBase(), nivel: 10, xp: 4 };
  delete legada.xpTotal;
  inicializarProgressao(legada);
  assert.equal(legada.xpTotal, 58);
  adicionarXP(legada, 7);
  assert.equal(legada.nivel, 11);
  assert.equal(legada.xp, 0);
  assert.equal(legada.xpTotal, 65);
});

test("estágios e Essências respeitam marcos definidos e a terceira permanece sem nível", () => {
  const ficha = fichaBase();
  adicionarXP(ficha, 14);
  assert.equal(ficha.nivel, 5);
  assert.equal(ficha.estagio, 1);
  assert.equal(verificarEssencia(ficha, "primeira").permitido, true);
  adicionarXP(ficha, 40);
  assert.equal(ficha.nivel, 10);
  assert.equal(ficha.estagio, 2);
  adicionarXP(ficha, 23);
  assert.equal(ficha.nivel, 12);
  assert.equal(verificarEssencia({ ...ficha, essencias: ["primeira"] }, "segunda").permitido, true);
  adicionarXP(ficha, 75);
  assert.equal(ficha.nivel, 17);
  assert.equal(ficha.estagio, 3);
  assert.equal(Object.hasOwn(ESSENCIAS.terceira, "nivelNecessario"), false);
  assert.equal(verificarEssencia({ ...ficha, essencias: ["primeira", "segunda"] }, "terceira").permitido, false);
});

test("custos de atributos são N+1 e gastos inválidos não deixam XPA negativa", () => {
  const ficha = fichaBase();
  ficha.xpa = 5;
  assert.equal(custoAtributo(1), 2);
  assert.equal(custoAtributo(2), 3);
  assert.equal(aumentarAtributo(ficha, "ATQ"), 2);
  assert.equal(ficha.xpa, 3);
  assert.equal(aumentarAtributo(ficha, "ATQ"), 3);
  assert.equal(ficha.xpa, 0);
  assert.throws(() => aumentarAtributo(ficha, "ATQ"), /precisa de 4 XPA/);
  assert.equal(ficha.xpa, 0);
  ficha.xpa = -1;
  assert.throws(() => aumentarAtributo(ficha, "DEF"), /saldo de XPA.*inválido/i);
  assert.equal(ficha.attrs.DEF, 1);
});

test("persistência local conserva XP, XP acumulado, XPA e histórico após salvar e carregar", async () => {
  const memory = new Map();
  const storage = {
    getItem: key => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: key => memory.delete(key)
  };
  const repository = criarRepositorioLocal({ storage, indexedDBApi: undefined, getAuthenticatedUserId: async () => null });
  const ficha = fichaBase();
  adicionarXP(ficha, 14);
  aumentarAtributo(ficha, "ATQ");
  await repository.salvarNativas([ficha]);
  const [carregada] = await repository.listarNativas();
  assert.equal(carregada.nivel, 5);
  assert.equal(carregada.xp, 0);
  assert.equal(carregada.xpTotal, 14);
  assert.equal(carregada.xpa, 54);
  assert.equal(carregada.attrs.ATQ, 2);
  assert.equal(carregada.historicoProgressao.length, 5);
});
