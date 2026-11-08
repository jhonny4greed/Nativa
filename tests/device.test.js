import test from "node:test";
import assert from "node:assert/strict";
import { classifyDevice } from "../js/device.js";

test("preferência manual do jogador vence a detecção automática", () => {
  assert.equal(classifyDevice({ override: "mobile", uaMobile: false, coarsePointer: false, width: 1600 }), "mobile");
  assert.equal(classifyDevice({ override: "desktop", uaMobile: true, coarsePointer: true, width: 390 }), "desktop");
});

test("celulares e tablets pequenos com toque recebem a experiência mobile", () => {
  assert.equal(classifyDevice({ uaMobile: true, width: 390, coarsePointer: true }), "mobile");
  assert.equal(classifyDevice({ uaType: "mobile", width: 412, coarsePointer: true }), "mobile");
  assert.equal(classifyDevice({ uaType: "tablet", width: 820, coarsePointer: true }), "mobile");
  assert.equal(classifyDevice({ uaType: "tablet", width: 1366, coarsePointer: true }), "desktop");
});

test("sem pistas do user agent, ponteiro grosso e tela estreita definem mobile", () => {
  assert.equal(classifyDevice({ coarsePointer: true, width: 600 }), "mobile");
  assert.equal(classifyDevice({ coarsePointer: false, width: 600 }), "desktop");
  assert.equal(classifyDevice({ uaMobile: false, coarsePointer: true, width: 600 }), "desktop");
  assert.equal(classifyDevice({ coarsePointer: true, width: 1440 }), "desktop");
});
