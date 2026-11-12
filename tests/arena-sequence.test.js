import test from "node:test";
import assert from "node:assert/strict";
import { combatActions, historyActions } from "../js/arena-sequence.js";
import { animationDuration } from "../js/arena-preferences.js";
const fighters = [{ nativa: { name: "Guarã" } }, { nativa: { name: "Tatuá" } }];
const moves = () => [
  { nome: "Brasa", efeito: "Chamas no alvo." },
  { nome: "Casco", efeito: "Protege o companheiro." }
];
test("preserva iniciativa, dano zero, erros, suporte e ações sem dado na apresentação", () => {
  const events = [
    { type: "initiative" },
    { type: "miss", attacker: "Tatuá", technique: "Brasa", roll: 1 },
    { type: "hit", attacker: "Guarã", target: "Tatuá", technique: "Brasa", roll: 8, damage: 0 },
    { type: "support", attacker: "Guarã", technique: "Casco", description: "Protege." }
  ];
  const actions = combatActions(events, fighters);
  assert.deepEqual(
    actions.map(a => a.actor),
    [1, 0, 0]
  );
  assert.equal(actions[1].damage, 0);
  assert.equal(actions[1].targetIndex, 1);
  assert.equal(actions[2].roll, undefined);
  assert.equal(events[1].actor, undefined, "não modifica os eventos do resolvedor");
});
test("interpreta os logs de PvP e campanha sem inventar dado para suporte", () => {
  const actions = historyActions(
    [
      "Iniciativa: Tatuá → Guarã.",
      "Tatuá erra Brasa (D10: 2, falha).",
      "Guarã usa Brasa (D10: 9, acerto): Tatuá recebe 4 de dano.",
      "Guarã usa Casco: suporte.",
      "Tatuá recupera 1 MP.",
      "Guarã assume uma postura defensiva."
    ],
    fighters,
    moves
  );
  assert.deepEqual(
    actions.map(a => a.type),
    ["miss", "hit", "support", "recover", "defend"]
  );
  assert.equal(actions[0].roll, 2);
  assert.equal(actions[1].damage, 4);
  assert.equal(actions[2].roll, null);
  assert.equal(actions[2].description, "Protege o companheiro.");
  assert.equal(actions[3].recovered, 1);
});
test("sem teste de precisão não interpreta o travessão como dado e não repete outros logs", () => {
  const actions = historyActions(
    ["Guarã usa Brasa (D10: —, acerto): Tatuá recebe 3 de dano.", "Tatuá foi derrotada. Vitória de Guarã."],
    fighters,
    moves
  );
  assert.equal(actions.length, 1);
  assert.equal(actions[0].roll, null);
});
test("velocidades por ação e modo desligado têm durações determinísticas", () => {
  assert.equal(animationDuration({ effects: true, speed: "normal" }), 5500);
  assert.equal(animationDuration({ effects: true, speed: "fast" }), 2750);
  assert.equal(animationDuration({ effects: true, speed: "slow" }), 8250);
  assert.equal(animationDuration({ effects: false, speed: "slow" }), 0);
});
