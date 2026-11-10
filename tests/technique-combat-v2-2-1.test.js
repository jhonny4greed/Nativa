import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TECNICAS, TECNICAS_ARQUIVADAS, obterTecnicaPorId } from "../js/techniques.js";
import { obterEfeitosCombate, obterCatalogoEfeitosCombate, DEFINICOES_EFEITOS_V2_2_1 } from "../js/technique-effects-v2-2-1.js";
import { CATALOGO_TRACOS } from "../js/traits.js";
import { podeAprenderTecnica, podeUsarTecnicaEmCombate } from "../js/technique-learning.js";

const categorias = ["Físico", "Especial", "Suporte"];

test("catálogo ativo contém 178 golpes únicos nos quatro grupos e contagens de categoria da fonte", () => {
  assert.equal(TECNICAS.length, 178);
  assert.equal(new Set(TECNICAS.map(item => item.id)).size, 178);
  assert.deepEqual(Object.fromEntries(["linhagem", "bioma", "arquetipo", "afinidade"].map(group => [group, TECNICAS.filter(item => item.origem === group).length])), {
    linhagem: 108, bioma: 20, arquetipo: 20, afinidade: 30
  });
  assert.deepEqual(Object.fromEntries(categorias.map(category => [category, TECNICAS.filter(item => item.categoria === category).length])), {
    "Físico": 66, "Especial": 58, "Suporte": 54
  });
});

test("41 Traços e oito sinergias validadas preservam IDs; sinergia não é requisito", () => {
  assert.equal(CATALOGO_TRACOS.length, 41);
  assert.equal(new Set(CATALOGO_TRACOS.map(item => item.id)).size, 41);
  const active = TECNICAS.flatMap(item => item.sinergias.map(synergy => ({ move: item, synergy })));
  assert.equal(active.length, 8);
  assert.ok(active.every(({ synergy }) => CATALOGO_TRACOS.some(trait => trait.id === synergy.tracoId)));
  assert.ok(TECNICAS.every(item => item.sinergiasCandidatas.length === 0));
  const clawMove = TECNICAS.find(item => item.id === "linhagem-v2-1-felinos-bote-predatorio");
  assert.equal(podeAprenderTecnica(clawMove), true);
  assert.equal(podeUsarTecnicaEmCombate(clawMove), false);
});

test("estados em revisão e propostas não liberam combate; parâmetros não alteram aprovação", () => {
  assert.ok(TECNICAS.every(item => item.estadoCatalogo === "em-revisao"));
  assert.ok(TECNICAS.every(item => podeAprenderTecnica(item)));
  assert.ok(TECNICAS.every(item => !podeUsarTecnicaEmCombate(item)));
  assert.ok(TECNICAS.filter(item => item.parametrosTecnicosDisponiveis).length > 0);
  assert.ok(TECNICAS.filter(item => item.status === "Novo — proposta V2.2").every(item => !item.parametrosTecnicosDisponiveis));
});

test("154 IDs coincidem com a versão anterior; 12 golpes de arquétipo removidos continuam arquivados", () => {
  const previousIds = JSON.parse(readFileSync(new URL("./fixtures-active-catalog-v2-1-ids.json", import.meta.url), "utf8"));
  const currentIds = new Set(TECNICAS.map(item => item.id));
  const matchedIds = previousIds.filter(id => currentIds.has(id));
  assert.equal(previousIds.length, 166);
  assert.equal(matchedIds.length, 154);
  assert.equal(TECNICAS.filter(item => !previousIds.includes(item.id)).length, 24);
  const prevArchive = TECNICAS_ARQUIVADAS.filter(item => item.origem === "arquetipo" && item.versao === "2.1");
  assert.equal(prevArchive.length, 12);
  assert.ok(prevArchive.every(item => item.estadoCatalogo === "arquivado" && item.compatibilidadeCombate === true));
  assert.equal(TECNICAS_ARQUIVADAS.filter(item => item.origem === "linhagem").length, 105);
  for (const id of ["arquetipo-predador-golpe-de-oportunidade", "arquetipo-guardiao-postura-de-fortaleza"]) {
    assert.equal(obterTecnicaPorId(id)?.estadoCatalogo, "arquivado");
  }
});

test("fórmulas PG bruto e líquido correspondem à fonte e preservam meios pontos", () => {
  for (const item of TECNICAS) {
    const p = item.parametrosBalanceamento;
    assert.equal(p.pgBruto, 2 + 1.5 * p.P + 0.5 * p.R + 0.5 * p.M, item.id);
    assert.equal(item.pg, p.pgBruto, item.id);
    if (item.categoria === "Suporte") {
      assert.equal(p.pgLiquidoDeclarado, null, item.id);
      continue;
    }
    assert.equal(p.pgLiquido, p.pgBruto - p.custoEfeitos, item.id);
    assert.equal(p.pgLiquidoDeclarado, p.pgLiquido, item.id);
  }
});

test("todos os efeitos implementados apontam para IDs do catálogo e conceitos listados", () => {
  const validIds = new Set(TECNICAS.map(item => item.id));
  const registry = Object.keys(obterCatalogoEfeitosCombate());
  assert.ok(registry.length > 0);
  assert.ok(registry.every(id => validIds.has(id)));
  assert.deepEqual(Object.keys(DEFINICOES_EFEITOS_V2_2_1).sort(), [
    "bonus_precisao", "desorientacao", "digestao", "envenenamento", "reducao_atributo", "reducao_dano", "secrecao_defensiva"
  ]);
  assert.ok(TECNICAS.filter(item => item.estadoCatalogo === "arquivado").every(item => obterEfeitosCombate(item.id).length === 0));
});
