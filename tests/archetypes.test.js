import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ARQUETIPOS, normalizarArquetipoLegado } from "../js/data.js";
import { TECNICAS, TECNICAS_ARQUETIPO_LEGADO, obterTecnicaPorId } from "../js/techniques.js";
import { criarNativa } from "../js/nativa-domain.js";

test("os cinco arquétipos atuais incluem Infiltrador e Controlador separadamente, sem Veloz", () => {
  const nomes = ARQUETIPOS.map(x => x.nome);
  assert.deepEqual(nomes, ["Predador", "Guardião", "Infiltrador", "Canalizador", "Controlador"]);
  assert.equal(new Set(nomes).size, 5);
  assert.equal(nomes.includes("Veloz"), false);
});

test("normalização troca somente o rótulo legado Veloz por Infiltrador", () => {
  assert.equal(normalizarArquetipoLegado("Veloz"), "Infiltrador");
  for (const nome of ["Predador", "Guardião", "Infiltrador", "Canalizador", "Controlador"]) assert.equal(normalizarArquetipoLegado(nome), nome);
  const nativa = criarNativa({ id: "legacy", name: "Nativa", lineage: "Felinos", archetype: "Veloz", attrs: {}, techniques: ["arquetipo-veloz-ataque-relampago"] });
  assert.equal(nativa.archetype, "Infiltrador");
  assert.deepEqual(nativa.techniques, ["arquetipo-veloz-ataque-relampago"]);
});

test("golpes atuais usam os cinco arquétipos; Veloz e os 12 golpes substituídos seguem arquivados", () => {
  assert.equal(TECNICAS.some(t => t.grupo === "Veloz"), false);
  assert.equal(TECNICAS.some(t => t.grupo === "Infiltrador"), true);
  assert.equal(TECNICAS.some(t => t.grupo === "Controlador"), true);
  assert.equal(TECNICAS_ARQUETIPO_LEGADO.length, 4);
  for (const t of TECNICAS_ARQUETIPO_LEGADO) {
    assert.equal(t.grupo, "Veloz");
    assert.equal(t.estadoCatalogo, "arquivado");
    assert.equal(obterTecnicaPorId(t.id).id, t.id);
    assert.equal(obterTecnicaPorId(t.id).compatibilidadeCombate, true);
  }
  const source = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(source, /n\.archetype = normalizarArquetipoLegado\(n\.archetype\)/);
});
