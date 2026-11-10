import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TECNICAS, TECNICAS_ARQUIVADAS, obterTecnicaPorId } from "../js/techniques.js";
import { criarNativa } from "../js/nativa-domain.js";
import { podeAprenderTecnica, podeUsarTecnicaEmCombate, obterEstadoSeletorTecnica, adicionarTecnicaSelecionada } from "../js/technique-learning.js";
import { nativaPossuiTraco } from "../js/traits.js";
import { criarCombatente, obterTecnicasCombatente, resolverTurnoCombate } from "../js/combat-domain.js";
import { criarRepositorioLocal } from "../js/repository.js";

const jararaca = TECNICAS.find(item => item.nome === "Bote de Jararaca");

test("golpe V2.2.1 em revisão pode ser aprendido sem Traços, mas não pode entrar em combate", () => {
  const ficha = criarNativa({ id: "teste", name: "Serpente", lineage: "Serpentes", archetype: "Predador", attrs: {}, techniques: [jararaca.id], tracos: [] });
  assert.equal(podeAprenderTecnica(jararaca), true);
  assert.equal(podeUsarTecnicaEmCombate(jararaca), false);
  assert.deepEqual(ficha.techniques, [jararaca.id]);
  assert.equal(nativaPossuiTraco(ficha, "fisiologia-1"), false);
  const state = obterEstadoSeletorTecnica(jararaca, false, false);
  assert.equal(state.botaoDesabilitado, false);
  assert.equal(state.pendenteCombate, true);
  assert.match(state.aviso, /bloqueado em combate/);
});

test("seleção respeita limite, não duplica golpe e não habilita combate", () => {
  const escolhidos = new Set();
  for (const item of TECNICAS.filter(move => move.grupo === "Felinos")) {
    assert.equal(adicionarTecnicaSelecionada(escolhidos, item, 4), true);
  }
  assert.equal(adicionarTecnicaSelecionada(escolhidos, jararaca, 4), false);
  assert.equal(adicionarTecnicaSelecionada(escolhidos, jararaca, 5), true);
  assert.equal(adicionarTecnicaSelecionada(escolhidos, jararaca, 5), false);
  assert.equal(podeUsarTecnicaEmCombate(jararaca), false);
});

test("ficha guarda IDs V2.2.1 e os recupera após persistência local", async () => {
  const ficha = criarNativa({ id: "persistida", name: "Serpente", lineage: "Serpentes", archetype: "Predador", attrs: {}, techniques: [jararaca.id], tracos: [] });
  const memory = new Map();
  const storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  const repo = criarRepositorioLocal({ storage, indexedDBApi: null });
  await repo.salvarNativas([ficha]);
  const [loaded] = await criarRepositorioLocal({ storage, indexedDBApi: null }).listarNativas();
  assert.deepEqual(loaded.techniques, [jararaca.id]);
  assert.equal(obterTecnicaPorId(loaded.techniques[0]), jararaca);
});

test("golpes arquivados não entram no catálogo de aprendizagem, mas fichas antigas mantêm uso compatível", () => {
  const oldId = "linhagem-serpentes-bote-serpentino";
  const legacy = obterTecnicaPorId(oldId);
  assert.ok(legacy);
  assert.equal(legacy.estadoCatalogo, "arquivado");
  assert.equal(podeAprenderTecnica(legacy), false);
  assert.equal(podeUsarTecnicaEmCombate(legacy), true);
  assert.equal(TECNICAS.some(item => item.id === oldId), false);
  assert.equal(TECNICAS_ARQUIVADAS.some(item => item.id === oldId), true);

  const attacker = criarCombatente({ id: "legacy", name: "Ficha antiga", attrs: { ATQ: 5, POT: 3, DEF: 2, RES: 2, AGI: 10, HP: 5, MP: 5 }, techniques: [oldId], tracos: [] });
  const target = criarCombatente({ id: "target", name: "Alvo", attrs: { ATQ: 1, POT: 1, DEF: 1, RES: 1, AGI: 1, HP: 10, MP: 5 }, techniques: [], tracos: [] });
  assert.ok(obterTecnicasCombatente(attacker).some(item => item.id === oldId));
  const rolls = [0.9, 0, 0.9];
  const result = resolverTurnoCombate({ fighters: [attacker, target], choices: [{ tipo: "attack", tecnicaId: oldId }, null], random: () => rolls.shift() });
  assert.equal(result.error, null);
  assert.ok(result.events.some(event => event.type === "hit" && event.technique === legacy.nome));
  assert.ok(result.fighters[1].hp < target.hp);
});

test("interface consulta o mesmo gate em criação e Essências e informa bloqueio de combate", () => {
  const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(app, /const estado=obterEstadoSeletorTecnica\(t,selected,locked\)/);
  assert.match(app, /adicionarTecnicaSelecionada\(tecnicasSelecionadas,tecnica,LIMITE_TECNICAS\)/);
  assert.match(app, /podeAprenderTecnica\(t\)/);
  assert.match(app, /techniques: tecnicasSelecionadas/);
  assert.match(app, /Em revisão · indisponível em combate/);
});
