import test from "node:test";
import assert from "node:assert/strict";
import { createAdminPanelHandler } from "../supabase/functions/admin-panel/handler.js";

const ADMIN = "a4a4a4a4-0000-4000-8000-0000000000ad";
const JOGADOR = "b5b5b5b5-0000-4000-8000-0000000000b5";
const OUTRO = "c6c6c6c6-0000-4000-8000-0000000000c6";
const SERVICE_KEY = "server-test-service-key";

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

function createServer({ userByBearer = { "token-admin": ADMIN, "token-player": JOGADOR }, roles = {}, allowlistRows = [], fetchOverride } = {}) {
  const calls = [];
  const envValues = {
    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_ANON_KEY: "public-anon-test-key",
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY
  };
  const roleOf = id => roles[id] || (id === ADMIN ? "admin" : "player");
  const fetchImpl = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (fetchOverride) return fetchOverride({ url, init, calls });
    if (url.endsWith("/auth/v1/user")) {
      const bearer = new Headers(init.headers).get("authorization")?.replace(/^Bearer\s+/i, "");
      const id = userByBearer[bearer];
      return id ? jsonResponse({ id }) : jsonResponse({ message: "unauthorized" }, 401);
    }
    if (url.includes("/rest/v1/profiles")) {
      if (init.method === "PATCH") {
        const targetId = new URL(url).searchParams.get("id")?.replace("eq.", "");
        roles[targetId] = JSON.parse(init.body).role;
        return jsonResponse([{ id: targetId, role: roles[targetId] }]);
      }
      const id = new URL(url).searchParams.get("id")?.replace("eq.", "");
      return jsonResponse([{ id, role: roleOf(id) }]);
    }
    if (url.includes("/rest/v1/image_generation_allowlist")) {
      if (init.method === "POST") {
        const row = JSON.parse(init.body);
        if (!allowlistRows.some(r => r.user_id === row.user_id)) allowlistRows.push({ user_id: row.user_id, created_at: "now" });
        return jsonResponse([row]);
      }
      if (init.method === "DELETE") {
        const target = new URL(url).searchParams.get("user_id")?.replace("eq.", "");
        const before = allowlistRows.length;
        for (let i = allowlistRows.length - 1; i >= 0; i--) if (allowlistRows[i].user_id === target) allowlistRows.splice(i, 1);
        return jsonResponse(allowlistRows.length === before ? [] : [{}], 200);
      }
      return jsonResponse(allowlistRows);
    }
    if (url.includes("/auth/v1/admin/users")) {
      return jsonResponse({ users: [
        { id: ADMIN, email: "admin@ex.com", email_confirmed_at: "2026-01-01", created_at: "2026-01-01", app_metadata: { providers: ["email"] }, user_metadata: { display_name: "Admin" } },
        { id: JOGADOR, email: "jogador@ex.com", created_at: "2026-01-02", app_metadata: { providers: ["email"] }, user_metadata: {} }
      ] });
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  const handler = createAdminPanelHandler({ env: name => envValues[name], fetchImpl });
  const request = (body, bearer = "token-admin") => handler(new Request("http://local/functions/v1/admin-panel", {
    method: "POST",
    headers: { "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
    body: JSON.stringify(body)
  }));
  return { handler, request, calls, allowlistRows, roles };
}

test("sessão ausente ou de jogador comum não acessa o painel", async () => {
  const server = createServer();
  assert.equal((await server.request({ action: "users" }, null)).status, 401);
  assert.equal((await server.request({ action: "users" }, "token-player")).status, 403);
  assert.equal(server.calls.some(call => call.url.includes("/auth/v1/admin/users")), false);
});

test("admin lista usuários com dados resumidos", async () => {
  const server = createServer();
  const response = await server.request({ action: "users" });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.users.length, 2);
  assert.equal(body.users[0].email, "admin@ex.com");
  assert.equal(body.users[0].displayName, "Admin");
});

test("allowlist pode ser listada, adicionada e removida somente por admin", async () => {
  const server = createServer();
  const add = await server.request({ action: "allowlist-add", userId: JOGADOR });
  assert.equal(add.status, 200);
  assert.deepEqual(server.allowlistRows.map(r => r.user_id), [JOGADOR]);
  const list = await (await server.request({ action: "allowlist-list" })).json();
  assert.equal(list.allowlist.length, 1);
  const remove = await server.request({ action: "allowlist-remove", userId: JOGADOR });
  assert.equal(remove.status, 200);
  assert.equal(server.allowlistRows.length, 0);
});

test("admin altera papel de outro usuário mas não pode rebaixar a si mesmo", async () => {
  const server = createServer();
  const self = await server.request({ action: "set-role", userId: ADMIN, role: "player" });
  assert.equal(self.status, 400);
  const promote = await server.request({ action: "set-role", userId: JOGADOR, role: "admin" });
  assert.equal(promote.status, 200);
  assert.equal(server.roles[JOGADOR], "admin");
});

test("ações inválidas e ids malformados são recusados", async () => {
  const server = createServer();
  assert.equal((await server.request({ action: "allowlist-add", userId: "não-uuid" })).status, 400);
  assert.equal((await server.request({ action: "set-role", userId: OUTRO, role: "superadmin" })).status, 400);
  assert.equal((await server.request({ action: "desconhecida" })).status, 400);
});
