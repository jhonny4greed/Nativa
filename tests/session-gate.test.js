import test from "node:test";
import assert from "node:assert/strict";
import { requireAuthenticatedUser, AuthenticationRequiredError } from "../js/session-gate.js";

function client(session, user, error = null) {
  return { auth: { getSession: async () => ({ data: { session } }), getUser: async () => ({ data: { user }, error }) } };
}
test("dashboard rejects anonymous, expired, invalid and mismatched sessions", async () => {
  for (const value of [client(null, null), client({user:{id:"a"}},null), client({user:{id:"a"}},{id:"b"}), client({user:{id:"a"}},{id:"a"},new Error("expired"))]) {
    await assert.rejects(requireAuthenticatedUser(value), AuthenticationRequiredError);
  }
});
test("only the verified session owner opens the game", async () => {
  const user = { id: "verified-player" };
  assert.equal(await requireAuthenticatedUser(client({user},user)), user);
});
