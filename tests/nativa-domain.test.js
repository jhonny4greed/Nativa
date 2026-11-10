import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { criarNativa } from "../js/nativa-domain.js";
import { obterTracosPadraoLinhagem } from "../js/traits.js";
import { inicializarProgressao, adicionarXP } from "../js/progression.js";
import { verificarEssencia, absorverEssencia } from "../js/essences.js";

const dadosBase = () => ({
  id: "local-id-123",
  name: "Aruã",
  player: "Jogadora",
  groupBio: "Mamíferos",
  lineage: "Canídeos",
  species: "Lobo-guará",
  bioma: "Cerrado",
  affinity: "Fogo",
  archetype: "Guardião",
  attrs: { ATQ: 2, POT: 3, DEF: 4, RES: 2, AGI: 3, HP: 4, MP: 2 },
  techniques: ["linhagem-canideos-faro", "arquetipo-guardiao-protecao"]
});

test("produz objeto equivalente ao literal usado antes da extração", () => {
  const fichaAnterior = {
    id: "local-id-123", name: "Aruã", player: "Jogadora",
    groupBio: "Mamíferos", lineage: "Canídeos", lineageName: "Canídeos",
    species: "Lobo-guará", bioma: "Cerrado", affinity: "Fogo", archetype: "Guardião",
    attrs: { ATQ: 2, POT: 3, DEF: 4, RES: 2, AGI: 3, HP: 4, MP: 2 },
    techniques: ["linhagem-canideos-faro", "arquetipo-guardiao-protecao"],
    nivel: 1, xp: 0, xpa: 42, estagio: 1, essencias: [],
    afinidadesEssencia: [], historicoProgressao: [], photoId: null,
    tracos: obterTracosPadraoLinhagem("Canídeos"), tracosQuimericos: [], habitos: []
  };
  assert.deepEqual(criarNativa(dadosBase()), fichaAnterior);
});

test("contém exatamente os campos e os tipos esperados na criação atual", () => {
  const ficha = criarNativa(dadosBase());
  assert.deepEqual(Object.keys(ficha), [
    "id", "name", "player", "groupBio", "lineage", "lineageName", "species",
    "bioma", "affinity", "archetype", "attrs", "techniques", "nivel", "xp",
    "xpa", "estagio", "essencias", "afinidadesEssencia",
    "historicoProgressao", "photoId", "tracos", "tracosQuimericos", "habitos"
  ]);
  for (const field of ["id", "name", "player", "groupBio", "lineage", "lineageName", "species", "bioma", "affinity", "archetype"]) {
    assert.equal(typeof ficha[field], "string", field);
  }
  for (const field of ["nivel", "xp", "xpa", "estagio"]) assert.equal(typeof ficha[field], "number", field);
  assert.equal(typeof ficha.attrs, "object");
  assert.ok(Array.isArray(ficha.techniques));
  assert.ok(Array.isArray(ficha.essencias));
  assert.ok(Array.isArray(ficha.afinidadesEssencia));
  assert.ok(Array.isArray(ficha.historicoProgressao));
  assert.deepEqual(ficha.tracos, obterTracosPadraoLinhagem("Canídeos"));
  assert.deepEqual(ficha.habitos, []);
  assert.deepEqual(ficha.tracosQuimericos, []);
  assert.equal(ficha.photoId, null);
});

test("usa valores iniciais e preserva o ID local sem criar ID remoto", () => {
  const ficha = criarNativa(dadosBase());
  assert.equal(ficha.id, "local-id-123");
  assert.equal(ficha.nivel, 1);
  assert.equal(ficha.xp, 0);
  assert.equal(ficha.xpa, 42);
  assert.equal(ficha.estagio, 1);
  assert.deepEqual(ficha.essencias, []);
  assert.deepEqual(ficha.afinidadesEssencia, []);
  assert.deepEqual(ficha.historicoProgressao, []);
  assert.equal(ficha.photoId, null);
  assert.equal(Object.hasOwn(ficha, "remoteId"), false);
  assert.equal(Object.hasOwn(ficha, "remote_id"), false);
});

test("preserva campos desconhecidos sem alterar os campos canônicos", () => {
  const input = { ...dadosBase(), legacyPayload: { flag: true, values: [1, 2] }, futureField: "keep" };
  const ficha = criarNativa(input);
  assert.deepEqual(ficha.legacyPayload, { flag: true, values: [1, 2] });
  assert.equal(ficha.futureField, "keep");
  assert.equal(ficha.lineageName, input.lineage);
  assert.deepEqual(ficha.attrs, input.attrs);
});

test("campos opcionais vazios mantêm os valores usados pelo formulário", () => {
  const input = dadosBase();
  delete input.player;
  delete input.species;
  delete input.techniques;
  const ficha = criarNativa(input);
  assert.equal(ficha.player, "");
  assert.equal(ficha.species, "");
  assert.deepEqual(ficha.techniques, []);
});

test("copia atributos e técnicas para não manter aliases mutáveis do chamador", () => {
  const input = dadosBase();
  const ficha = criarNativa(input);
  input.attrs.ATQ = 99;
  input.techniques.push("outra-tecnica");
  assert.equal(ficha.attrs.ATQ, 2);
  assert.deepEqual(ficha.techniques, ["linhagem-canideos-faro", "arquetipo-guardiao-protecao"]);
});

test("a ficha criada continua compatível com as funções existentes de progressão e essências", () => {
  const ficha = criarNativa(dadosBase());
  assert.equal(inicializarProgressao(ficha), ficha);
  assert.equal(ficha.nivel, 1);
  assert.equal(verificarEssencia(ficha, "primeira").permitido, false);

  const progresso = adicionarXP(ficha, 2);
  assert.equal(progresso.niveisConquistados.length, 1);
  ficha.nivel = 5;
  assert.equal(verificarEssencia(ficha, "primeira").permitido, true);
  ficha.essenciasDisponiveis = [{ id: "essencia-de-teste" }];
  assert.equal(absorverEssencia(ficha, "primeira", "Água"), ficha);
  assert.deepEqual(ficha.essencias, ["primeira"]);
  assert.deepEqual(ficha.essenciasDisponiveis, []);
});

test("módulo de domínio não depende de interface, armazenamento, autenticação ou Supabase", () => {
  const source = readFileSync(new URL("../js/nativa-domain.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\bdocument\b|\bwindow\b|localStorage|indexedDB|supabase|auth\./i);
});
