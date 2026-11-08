import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TECNICAS_LINHAGEM_V2_1 } from "../js/techniques-v2-1.js";
import { obterTecnicaPorId } from "../js/techniques.js";
import { criarNativa } from "../js/nativa-domain.js";
import { podeAprenderTecnica, podeUsarTecnicaEmCombate, obterEstadoSeletorTecnica, adicionarTecnicaSelecionada } from "../js/technique-learning.js";
import { nativaPossuiTraco } from "../js/traits.js";
import { criarCombatente, obterTecnicasCombatente, resolverTurnoCombate } from "../js/combat-domain.js";
import { criarRepositorioLocal } from "../js/repository.js";

const jararaca = TECNICAS_LINHAGEM_V2_1.find(t => t.nome === "Bote de Jararaca");
const tracos = jararaca.sinergiasCandidatas.map(candidata => candidata.tracoId);

test("Bote de Jararaca pode ser aprendido sem Peçonha, sem Presas ou sem ambos quando a técnica está liberada tecnicamente", () => {
  const liberado = { ...jararaca, estadoCatalogo: "validado" };
  const semTracosInformados = criarNativa({ id: "teste-default", name: "Nativa", lineage: "Serpentes", archetype: "Predador", attrs: {}, techniques: [jararaca.id] });
  assert.ok(semTracosInformados.techniques.includes(jararaca.id));
  assert.equal(nativaPossuiTraco(semTracosInformados, tracos[0]), false);
  assert.equal(nativaPossuiTraco(semTracosInformados, tracos[1]), false);
  for (const lista of [[], [tracos[0]], [tracos[1]], tracos]) {
    const ficha = criarNativa({ id: "teste", name: "Nativa", lineage: "Serpentes", archetype: "Predador", attrs: {}, techniques: [jararaca.id], tracos: lista });
    assert.equal(podeAprenderTecnica(liberado), true);
    assert.equal(podeAprenderTecnica(jararaca), true);
    assert.deepEqual(ficha.techniques, [jararaca.id]);
  }
});

test("Bote de Jararaca atual permanece bloqueado somente por revisão técnica, qualquer que seja a lista de Traços", () => {
  assert.equal(jararaca.estadoCatalogo, "em-revisao");
  for (const lista of [[], [tracos[0]], [tracos[1]], tracos]) {
    assert.equal(podeAprenderTecnica(jararaca), true);
    assert.equal(podeUsarTecnicaEmCombate(jararaca), false);
    assert.deepEqual(jararaca.sinergias, []);
    assert.match(jararaca.status, /parâmetros pendentes/i);
  }
});

test("fluxo de criação Felino mostra quatro V2.1 como aprendíveis, seleciona, salva e recarrega os IDs", async () => {
  const felinos = TECNICAS_LINHAGEM_V2_1.filter(t => t.grupo === "Felinos");
  assert.equal(felinos.length, 4);
  const selecionadas = new Set();
  const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(app, /const estado=obterEstadoSeletorTecnica\(t,selected,locked\)/);
  assert.match(app, /adicionarTecnicaSelecionada\(tecnicasSelecionadas,tecnica,LIMITE_TECNICAS\)/);
  assert.match(app, /techniques: tecnicasSelecionadas/);
  const batalhaUI = app.slice(app.indexOf("function cartoesTecnicas"), app.indexOf("function renderizarCombatente"));
  assert.match(batalhaUI, /const lista=tecnicasCombatente\(c\)/);
  assert.match(batalhaUI, /Parâmetros técnicos pendentes · indisponível em combate/);
  for (const tecnica of felinos) {
    const estado = obterEstadoSeletorTecnica(tecnica, false, selecionadas.size >= 6);
    assert.equal(estado.podeAprender, true);
    assert.equal(estado.pendenteCombate, true);
    assert.equal(estado.botaoDesabilitado, false);
    assert.match(estado.aviso, /Pode ser aprendida/);
    assert.equal(adicionarTecnicaSelecionada(selecionadas, tecnica, 6), true);
  }
  assert.deepEqual([...selecionadas], felinos.map(t => t.id));
  const ficha = criarNativa({ id: "ui-felino", name: "Felino UI", lineage: "Felinos", archetype: "Predador", attrs: { ATQ: 3, POT: 3, DEF: 3, RES: 3, AGI: 3, HP: 3, MP: 3 }, techniques: [...selecionadas], tracos: [] });
  const dados = new Map();
  const storage = { getItem: key => dados.get(key) ?? null, setItem: (key, value) => dados.set(key, value) };
  const repo = criarRepositorioLocal({ storage, indexedDBApi: null });
  await repo.salvarNativas([ficha]);
  const reopen = criarRepositorioLocal({ storage, indexedDBApi: null });
  const carregadas = await reopen.listarNativas();
  assert.deepEqual(carregadas[0].techniques, felinos.map(t => t.id));
  assert.deepEqual(carregadas[0].tracos, []);
  assert.ok(carregadas[0].techniques.every(id => obterTecnicaPorId(id)?.estadoCatalogo === "em-revisao"));
  const combatTarget = criarCombatente({ id: "target", name: "Alvo", attrs: { ATQ: 1, POT: 1, DEF: 1, RES: 1, AGI: 1, HP: 5, MP: 5 }, techniques: [] });
  const combat = resolverTurnoCombate({ fighters: [criarCombatente(carregadas[0]), combatTarget], choices: [{ tipo: "attack", tecnicaId: felinos[0].id }, null], random: () => 0.9 });
  assert.match(combat.error.message, /parâmetros técnicos validados para uso em combate/);
});

test("criação e Essências usam o gate técnico sem consultar Traços", () => {
  const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  const essencia = app.slice(app.indexOf("async function iniciarAbsorcaoEssencia"), app.indexOf("\n", app.indexOf("async function iniciarAbsorcaoEssencia")));
  const selecao = app.slice(app.indexOf('$("#technique-groups").addEventListener'), app.indexOf('\n', app.indexOf('$("#technique-groups").addEventListener')));
  assert.match(essencia, /podeAprenderTecnica\(t\)/);
  assert.doesNotMatch(essencia, /traco|sinergia/i);
  const essenciaLinhaSerpentes = TECNICAS_LINHAGEM_V2_1.filter(t => t.grupo === "Serpentes" && podeAprenderTecnica(t));
  assert.equal(essenciaLinhaSerpentes.length, 4);
  assert.ok(essenciaLinhaSerpentes.includes(jararaca));
  assert.match(selecao, /adicionarTecnicaSelecionada\(tecnicasSelecionadas,tecnica,LIMITE_TECNICAS\)/);
  assert.doesNotMatch(selecao, /traco|sinergia/i);
});

test("Peçonha e Presas permanecem relações candidatas opcionais, separadas do efeito-base", () => {
  assert.match(jararaca.efeito, /aplica envenenamento/i);
  assert.deepEqual(jararaca.sinergiasCandidatas.map(x => x.tracoId), ["fisiologia-1", "estrutura-natural-2"]);
  assert.ok(jararaca.sinergiasCandidatas.every(x => x.estadoRevisao === "reservada"));
  assert.equal(nativaPossuiTraco({ tracos: [] }, "fisiologia-1"), false);
});

test("golpe V1 relacionado a Traço segue aprendível e utilizável sem possuir o Traço, inclusive por ficha de outra linhagem", () => {
  const legacy = obterTecnicaPorId("linhagem-serpentes-bote-serpentino");
  const nativa = criarNativa({ id: "outra-linhagem", name: "Nativa", lineage: "Felinos", archetype: "Predador", attrs: { ATQ: 5, POT: 3, DEF: 2, RES: 2, AGI: 10, HP: 5, MP: 5 }, techniques: [legacy.id], tracos: [] });
  const attacker = criarCombatente(nativa);
  const target = criarCombatente({ id: "alvo", name: "Alvo", attrs: { ATQ: 1, POT: 1, DEF: 1, RES: 1, AGI: 1, HP: 10, MP: 5 }, techniques: [], tracos: [] });
  assert.ok(obterTecnicasCombatente(attacker).some(t => t.id === legacy.id));
  const rolls = [0.9, 0, 0.9];
  const result = resolverTurnoCombate({ fighters: [attacker, target], choices: [{ tipo: "attack", tecnicaId: legacy.id }, null], random: () => rolls.shift() });
  assert.equal(result.error, null);
  assert.ok(result.events.some(e => e.type === "hit" && e.technique === legacy.nome));
  assert.ok(result.fighters[1].hp < target.hp);
});

test("fichas antigas conservam golpes aprendidos sem Traços e resolvem seus IDs V1 arquivados", () => {
  const legacyId = "linhagem-serpentes-bote-serpentino";
  const ficha = { id: "old", name: "Antiga", attrs: { ATQ: 3, POT: 3, DEF: 2, RES: 2, AGI: 2, HP: 2, MP: 2 }, techniques: [legacyId], tracos: [] };
  assert.equal(obterTecnicaPorId(legacyId).estadoCatalogo, "arquivado");
  assert.deepEqual(obterTecnicasCombatente(criarCombatente(ficha)).map(t => t.id), [legacyId]);
});
