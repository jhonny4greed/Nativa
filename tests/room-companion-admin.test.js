import test from "node:test";
import assert from "node:assert/strict";
import { concederXpCampanha, definirNivelCampanha, concederEssenciaCampanha, concederTracoCampanha, removerTracoCampanha, concederTecnicaCampanha, removerTecnicaCampanha } from "../js/room-companion-admin.js";
import { TECNICAS } from "../js/techniques.js";
import { CATALOGO_TRACOS, obterTracosPadraoLinhagem } from "../js/traits.js";

const base = () => ({ id: "local-campaign-1", name: "Teste", level: 1, nivel: 1, xp: 0, xpTotal: 0, xpa: 1, estagio: 1, lineage: "Felinos", lineageName: "Felinos", archetype: "Predador", affinity: "Água", essencias: [], afinidadesEssencia: [], essenciasDisponiveis: [{ id: "drop-1", origem:"combate" }], techniques: [], tracos: [], attrs: { ATQ: 2 }, unknownField: { kept: true } });

test("XP usa a progressão oficial, distingue XP de XPA e preserva campos desconhecidos", () => {
  const source = base();
  const result = concederXpCampanha(source, 2);
  assert.equal(result.data.nivel, 2);
  assert.equal(result.data.xp, 0);
  assert.equal(result.data.xpa, 3);
  assert.deepEqual(result.data.unknownField, { kept: true });
  assert.equal(source.nivel, 1, "input snapshot remains untouched");
});

test("nível de destino avança somente via XP e não duplica XPA ao repetir o nível", () => {
  const first = definirNivelCampanha(base(), 3);
  assert.equal(first.data.nivel, 3);
  assert.equal(first.data.xpTotal, 5);
  assert.equal(first.data.xpa, 6);
  const same = definirNivelCampanha(first.data, 3);
  assert.equal(same.quantidadeXpConcedida, 0);
  assert.equal(same.data.xpa, first.data.xpa);
  assert.throws(() => definirNivelCampanha(first.data, 2), /só pode avançar/);
});

test("essência exige drop, pré-requisitos, afinidade nova e técnicas oficiais correspondentes", () => {
  const source = { ...base(), nivel: 5, xpTotal: 14 };
  const affinityTech = TECNICAS.find(item => item.origem === "afinidade" && item.grupo === "Fogo");
  const lineageTech = TECNICAS.find(item => item.origem === "linhagem" && item.grupo === "Felinos");
  const result = concederEssenciaCampanha(source, "primeira", "Fogo", [affinityTech.id, lineageTech.id]);
  assert.deepEqual(result.data.essencias, ["primeira"]);
  assert.deepEqual(result.data.afinidadesEssencia, [], "A primeira Essência não muda afinidades nem defesas");
  assert.deepEqual(result.data.techniques, [affinityTech.id, lineageTech.id]);
  assert.deepEqual(result.data.essenciasDisponiveis, []);
  assert.throws(() => concederEssenciaCampanha(source, "primeira", "Água", [affinityTech.id, lineageTech.id]), /afinidade|correspondem/i);
  assert.throws(() => concederEssenciaCampanha({ ...source, essenciasDisponiveis: [] }, "primeira", "Fogo", [affinityTech.id, lineageTech.id]), /obtidas em vitórias/);
});

test("traços vêm do catálogo, não duplicam e protege os derivados da linhagem", () => {
  const source = base();
  const trait = CATALOGO_TRACOS.find(item => !obterTracosPadraoLinhagem("Felinos").includes(item.id));
  const result = concederTracoCampanha(source, trait.id);
  assert.deepEqual(result.data.tracos, [trait.id]);
  assert.throws(() => concederTracoCampanha(result.data, trait.id), /já possui/);
  assert.deepEqual(removerTracoCampanha(result.data, trait.id).data.tracos, []);
  const derived = obterTracosPadraoLinhagem("Felinos")[0];
  assert.throws(() => removerTracoCampanha({ ...source, tracos: [derived] }, derived), /derivado/);
});

test("técnicas vêm do catálogo oficial, sem duplicação e remoção respeita Essências", () => {
  const source = { ...base(), techniques: [{ id: "legacy-tech", unknown: { retained: true } }] };
  const technique = TECNICAS.find(item => item.estadoCatalogo !== "arquivado");
  const result = concederTecnicaCampanha(source, technique.id);
  assert.deepEqual(result.data.techniques, [{ id: "legacy-tech", unknown: { retained: true } }, technique.id]);
  assert.throws(() => concederTecnicaCampanha(result.data, technique.id), /já possui/);
  assert.deepEqual(removerTecnicaCampanha(result.data, technique.id).data.techniques, [{ id: "legacy-tech", unknown: { retained: true } }]);
  assert.throws(() => removerTecnicaCampanha({ ...result.data, essencias: ["primeira"] }, technique.id), /[Nn]ão é possível identificar/);
});

