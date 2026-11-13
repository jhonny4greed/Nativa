import test from "node:test";
import assert from "node:assert/strict";
import { montarPromptImagem, referenciasVisuaisNativa } from "../js/art-prompts.js";

test("referências da Nativa preservam os traços e as descrições sem duplicar a inspiração", () => {
  const references = referenciasVisuaisNativa({
    species: "Coruja",
    groupBio: "Aves",
    lineageName: "Aves de rapina",
    lineage: "aves-rapina",
    bioma: "Floresta e Mata",
    affinity: "Energia",
    archetype: "Canalizador",
    descricao: "Penas castanhas com reflexos violetas.",
    description: "Penas castanhas com reflexos violetas.",
    inspiracao: "Olhos luminosos.",
    visualDescription: "Aura psíquica sutil."
  });
  for (const trait of [
    "Coruja",
    "Aves de rapina",
    "Floresta e Mata",
    "Energia",
    "Canalizador",
    "Olhos luminosos",
    "Aura psíquica sutil"
  ])
    assert.ok(references.includes(trait), `referência preservada: ${trait}`);
  assert.equal(references.match(/Penas castanhas/g).length, 1);
  assert.doesNotMatch(references, /aves-rapina|undefined|null/);
});

test("o pedido da coruja usa os dados como design visual e pede apenas uma criatura sem ficha", () => {
  const prompt = montarPromptImagem({
    kind: "nativa",
    title: "Psicoruja",
    prompt: "Espécie: Coruja. Afinidade: Energia. Arquétipo: Canalizador. Destaques em um painel."
  });
  assert.match(prompt, /exactly one individual.*one single full-body view/s);
  assert.match(prompt, /entire creature.*central 80 percent/s);
  assert.match(prompt, /affinity into colors.*archetype into posture/s);
  assert.match(prompt, /internal visual reference data only, never content to write/);
  assert.match(prompt, /"internalName":"Psicoruja"/);
  assert.match(prompt, /No extra creatures, duplicate views/);
  // Even reference text asking for a panel is followed by the output constraints.
  assert.ok(prompt.indexOf("No text, letters") > prompt.indexOf("Destaques em um painel"));
  assert.match(prompt, /logos.*character sheet.*multiple panels/s);
  assert.match(prompt, /Do not print any reference wording or the subject's name\.$/);
  assert.doesNotMatch(prompt, /for NATIVA|fantasy RPG|collectible.*card/);
});

test("biomas e golpes mantêm suas composições sem herdar a restrição de corpo inteiro", () => {
  for (const [kind, composition] of [
    ["biome", /biome landscape/],
    ["technique", /battle technique illustration/],
    ["other", /cohesive fantasy illustration/]
  ]) {
    const prompt = montarPromptImagem({ kind, title: "Vereda", prompt: "Água azul e luz dourada" });
    assert.match(prompt, composition);
    assert.match(prompt, /Água azul e luz dourada/);
    assert.match(prompt, /No text, letters/);
    assert.doesNotMatch(prompt, /exactly one individual|full-body/);
  }
});

test("referências incompletas respeitam o limite do Ateliê", () => {
  assert.equal(referenciasVisuaisNativa({ species: "Coruja", descricao: null }), "Espécie: Coruja.");
  assert.equal(referenciasVisuaisNativa({ visualDescription: "a".repeat(1500) }).length, 1400);
});
