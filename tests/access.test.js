import test from "node:test";
import assert from "node:assert/strict";
import { isAdmin, safeDestination, authHref } from "../js/access.js";

test("administration requires the role returned by the server; user metadata cannot grant access", () => {
  for (const value of [null, {}, "player", "master", { role: "admin" }, { user_metadata: { role: "admin" } }, { app_metadata: { role: "admin" } }]) assert.equal(isAdmin(value), false);
  assert.equal(isAdmin("admin"), true);
});

test("authentication returns to the same-origin game and preserves invitations and view", () => {
  const base = "https://nativa.example/login.html";
  const destination = "/app.html?convite=abc%2F123#multiplayer";
  assert.equal(safeDestination(destination, base), destination);
  for (const value of ["https://evil.example/app.html", "//evil.example/app.html", "javascript:alert(1)", "/login.html", "/cadastro.html", "/app.html.evil"]) assert.equal(safeDestination(value, base), "./app.html");
  const url = new URL(authHref("cadastro", destination), base);
  assert.equal(url.pathname, "/cadastro.html");
  assert.equal(url.searchParams.get("next"), destination);
});
