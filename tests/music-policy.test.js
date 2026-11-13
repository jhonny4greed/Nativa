import test from "node:test";
import assert from "node:assert/strict";
import { chooseArenaTrack } from "../js/music-policy.js";
const tracks = [{ id: "mata" }, { id: "cerrado" }, { id: "pantanal" }];
test("arena sem faixas fica silenciosa em todos os modos", () => {
  for (const mode of ["standard", "random", "selected"]) assert.equal(chooseArenaTrack(mode, "refugio", []), null);
});
test("trilha padrão e escolha individual usam apenas faixas de arena", () => {
  assert.equal(chooseArenaTrack("standard", null, tracks), tracks[0]);
  assert.equal(chooseArenaTrack("selected", "cerrado", tracks), tracks[1]);
  assert.equal(chooseArenaTrack("selected", "removida", tracks), tracks[0]);
});
test("modo aleatório pode escolher cada música sem ultrapassar a lista", () => {
  assert.equal(
    chooseArenaTrack("random", null, tracks, () => 0),
    tracks[0]
  );
  assert.equal(
    chooseArenaTrack("random", null, tracks, () => 0.5),
    tracks[1]
  );
  assert.equal(
    chooseArenaTrack("random", null, tracks, () => 0.999),
    tracks[2]
  );
});
