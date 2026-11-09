import test from "node:test";
import assert from "node:assert/strict";
import { featuredSummary } from "../js/featured-creature.js";

test("featured creature shows actual XP, available XPA and attributes without mutating the ficha", () => {
  const ficha = { nivel: 3, xp: 1, xpa: 7, attrs: { ATQ: 5, POT: 2, HP: 3 } };
  const original = structuredClone(ficha);
  const result = featuredSummary(ficha);
  assert.equal(result.xpPercent, 25);
  assert.equal(result.xpaDisponivel, 7);
  assert.deepEqual(result.attributes[0], { name: "ATQ", value: 5, percent: 50 });
  assert.deepEqual(ficha, original);
});
test("a new creature starts at zero percent XP rather than a decorative achievement value", () => {
  assert.equal(featuredSummary({ attrs: { ATQ: 1 } }).xpPercent, 0);
});
