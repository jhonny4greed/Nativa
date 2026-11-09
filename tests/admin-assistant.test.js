import test from "node:test";
import assert from "node:assert/strict";
import { createAdminAssistantHandler } from "../supabase/functions/admin-assistant/handler.js";

const ADMIN = "a4a4a4a4-0000-4000-8000-0000000000ad";
const JOGADOR = "b5b5b5b5-0000-4000-8000-0000000000b5";
const CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

function createServer({ userByBearer = { "token-admin": ADMIN, "token-player": JOGADOR }, llmContent = "{\"reply\":\"Olá!\",\"actions\":[]}", llmStatus = 200 } = {}) {
  const calls = [];
  const envValues = {
    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_ANON_KEY: "public-anon-test-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-key",
    NVIDIA_API_KEY: "nvapi-test"
  };
  const fetchImpl = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith("/auth/v1/user")) {
      const bearer = new Headers(init.headers).get("authorization")?.replace(/^Bearer\s+/i, "");
      const id = userByBearer[bearer];
      return id ? jsonResponse({ id }) : jsonResponse({ message: "unauthorized" }, 401);
    }
    if (url.includes("/rest/v1/profiles")) {
      const id = new URL(url).searchParams.get("id")?.replace("eq.", "");
      return jsonResponse([{ id, role: id === ADMIN ? "admin" : "player" }]);
    }
    if (url === CHAT_URL) {
      return jsonResponse({ choices: [{ message: { content: llmContent } }] }, llmStatus);
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  const handler = createAdminAssistantHandler({ env: name => envValues[name], fetchImpl });
  const request = (body, bearer = "token-admin") => handler(new Request("http://local/functions/v1/admin-assistant", {
    method: "POST",
    headers: { "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
    body: JSON.stringify(body)
  }));
  return { handler, request, calls };
}

test("somente admin conversa com o assistente", async () => {
  const server = createServer();
  assert.equal((await server.request({ messages: [{ role: "user", content: "oi" }] }, null)).status, 401);
  assert.equal((await server.request({ messages: [{ role: "user", content: "oi" }] }, "token-player")).status, 403);
  assert.equal(server.calls.some(call => call.url === CHAT_URL), false);
});

test("resposta JSON do modelo vira reply e ações estruturadas", async () => {
  const server = createServer({
    llmContent: "```json\n{\"reply\":\"Crio a arte para você.\",\"actions\":[{\"type\":\"generate-image\",\"kind\":\"nativa\",\"title\":\"Sapo-jade\",\"prompt\":\"detailed frog\"}]}\n```"
  });
  const response = await server.request({ messages: [{ role: "user", content: "gere um sapo" }] });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.reply, "Crio a arte para você.");
  assert.equal(body.actions.length, 1);
  assert.equal(body.actions[0].type, "generate-image");
  const llmCall = server.calls.find(call => call.url === CHAT_URL);
  const payload = JSON.parse(llmCall.init.body);
  assert.equal(payload.messages[0].role, "system");
  assert.equal(payload.messages[1].role, "user");
  assert.equal(new Headers(llmCall.init.headers).get("authorization"), "Bearer nvapi-test");
});

test("resposta fora do formato vira mensagem simples sem ações", async () => {
  const server = createServer({ llmContent: "Desculpe, não entendi o pedido." });
  const body = await (await server.request({ messages: [{ role: "user", content: "x" }] })).json();
  assert.equal(body.reply, "Desculpe, não entendi o pedido.");
  assert.deepEqual(body.actions, []);
});

test("histórico inválido e erro do provedor são recusados", async () => {
  const server = createServer();
  assert.equal((await server.request({ messages: [] })).status, 400);
  assert.equal((await server.request({ messages: [{ role: "system", content: "hack" }] })).status, 400);
  const falha = createServer({ llmStatus: 429 });
  assert.equal((await falha.request({ messages: [{ role: "user", content: "oi" }] })).status, 502);
});
