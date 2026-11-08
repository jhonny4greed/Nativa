import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createGenerateArtHandler } from "../supabase/functions/generate-art/handler.js";
import { aplicarArteComoRetrato, criarGaleriaImagens } from "../js/art-gallery.js";
import { criarEstudioImagens } from "../js/art-studio.js";

const USER_A = "user-account-a";
const USER_B = "user-account-b";
const SIGNING_KEY = "test-only-signing-key-with-at-least-32-bytes";
const API_KEY = "server-test-nvidia-key";
const NVIDIA_URL = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev";
const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const PNG_BASE64 = Buffer.from(PNG_BYTES).toString("base64");
const PNG = () => new Blob([PNG_BYTES], { type: "image/png" });

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

function createServer({
  allowedUsers = [USER_A], userByBearer = { "token-a": USER_A, "token-b": USER_B }, nowValue = 1_000_000,
  nvidiaStatus = 200, nvidiaResponse = { artifacts: [{ base64_image: PNG_BASE64 }] },
  fetchOverride
} = {}) {
  let currentNow = nowValue;
  const calls = [];
  const envValues = {
    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_ANON_KEY: "public-anon-test-key",
    NVIDIA_API_KEY: API_KEY,
    IMAGE_TASK_SIGNING_KEY: SIGNING_KEY,
    IMAGE_GENERATION_ALLOWED_USER_IDS: allowedUsers.join(",")
  };
  const fetchImpl = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (fetchOverride) return fetchOverride({ url, init, calls });
    if (url.endsWith("/auth/v1/user")) {
      const bearer = new Headers(init.headers).get("authorization")?.replace(/^Bearer\s+/i, "");
      const id = userByBearer[bearer];
      return id ? jsonResponse({ id }) : jsonResponse({ message: "unauthorized" }, 401);
    }
    if (url === NVIDIA_URL) return jsonResponse(nvidiaResponse, nvidiaStatus);
    throw new Error(`Unexpected request: ${url}`);
  };
  const handler = createGenerateArtHandler({ env: name => envValues[name], fetchImpl, now: () => currentNow });
  const request = (body, bearer = "token-a", headers = {}) => handler(new Request("http://local/functions/v1/generate-art", {
    method: "POST", headers: { "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body)
  }));
  return { handler, request, calls, setNow: value => { currentNow = value; }, envValues };
}

async function createTask(server, bearer = "token-a") {
  const response = await server.request({ action: "start", kind: "nativa", title: "Guardião", prompt: "Folhagem azul" }, bearer);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(typeof result.taskToken, "string");
  return result.taskToken;
}

function mockClient({ userId = USER_A, sessionIds, invoke = async () => ({ data: {}, error: null }) } = {}) {
  let calls = 0;
  return async () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: sessionIds ? sessionIds[Math.min(calls++, sessionIds.length - 1)] : userId } } }, error: null }) },
    functions: { invoke }
  });
}

test("conta autorizada chama o modelo NVIDIA configurado e recebe token opaco", async () => {
  const server = createServer();
  const response = await server.request({ action: "start", kind: "nativa", title: "Guardião", prompt: "Folhas verdes" });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.match(body.taskToken, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  const request = server.calls.find(call => call.url === NVIDIA_URL);
  assert.equal(request.init.method, "POST");
  assert.equal(new Headers(request.init.headers).get("authorization"), `Bearer ${API_KEY}`);
  const payload = JSON.parse(request.init.body);
  assert.equal(payload.width, 1024);
  assert.equal(payload.mode, "base");
  assert.equal(payload.steps, 30);
  assert.equal(payload.height, 1024);
  assert.match(payload.prompt, /Subject: Guardião/);
  assert.equal(server.calls.filter(call => call.url.endsWith("/auth/v1/user")).length, 1);
});

test("conta fora da allowlist e ausência de sessão não iniciam geração", async () => {
  const denied = createServer();
  assert.equal((await denied.request({ action: "start", kind: "nativa", title: "x", prompt: "y" }, "token-b")).status, 403);
  assert.equal(denied.calls.some(call => call.url === NVIDIA_URL), false);
  const anonymous = createServer();
  assert.equal((await anonymous.request({ action: "start", kind: "nativa", title: "x", prompt: "y" }, null)).status, 401);
  assert.equal(anonymous.calls.some(call => call.url === NVIDIA_URL), false);
});

test("allowlist também protege status e download", async () => {
  const server = createServer();
  const status = await server.request({ action: "status", taskToken: "not-needed" }, "token-b");
  const download = await server.request({ action: "download", taskToken: "not-needed" }, "token-b");
  assert.equal(status.status, 403);
  assert.equal(download.status, 403);
  assert.equal(server.calls.some(call => call.url === NVIDIA_URL), false);
});

test("autentica e aplica allowlist antes de ler corpo grande", async () => {
  const server = createServer();
  let streamCancelled = false;
  const request = new Request("http://local/functions/v1/generate-art", {
    method: "POST", headers: { authorization: "Bearer token-b", "content-type": "application/json" },
    body: new ReadableStream({
      pull(controller) { controller.enqueue(new Uint8Array(20_000)); },
      cancel() { streamCancelled = true; }
    }), duplex: "half"
  });
  assert.equal((await server.handler(request)).status, 403);
  assert.equal(streamCancelled, false);
  assert.equal(server.calls.some(call => call.url === NVIDIA_URL), false);
});

test("JSON inválido, array e excesso de corpo são recusados após autenticação", async () => {
  const server = createServer();
  assert.equal((await server.request("{", "token-a")).status, 400);
  assert.equal((await server.request("[]", "token-a")).status, 400);
  const oversized = new Request("http://local/functions/v1/generate-art", {
    method: "POST", headers: { authorization: "Bearer token-a", "content-type": "application/json" },
    body: JSON.stringify({ value: "x".repeat(12_100) })
  });
  assert.equal((await server.handler(oversized)).status, 413);
  assert.equal(server.calls.some(call => call.url === NVIDIA_URL), false);
});

test("token arbitrário é recusado sem consultar o provedor", async () => {
  const server = createServer();
  assert.equal((await server.request({ action: "status", taskToken: "arbitrary" })).status, 403);
  assert.equal(server.calls.some(call => call.url === NVIDIA_URL), false);
});

test("token expirado é recusado", async () => {
  const server = createServer();
  const token = await createTask(server);
  server.setNow(1_000_000 + 31 * 60 * 1000);
  assert.equal((await server.request({ action: "status", taskToken: token })).status, 403);
});

test("resultado expira antes do token e status informa indisponibilidade", async () => {
  const server = createServer();
  const token = await createTask(server);
  server.setNow(1_000_000 + 16 * 60 * 1000);
  const response = await server.request({ action: "status", taskToken: token });
  assert.equal(response.status, 410);
});

test("token de uma conta não pode ser usado por outra conta autorizada", async () => {
  const server = createServer({ allowedUsers: [USER_A, USER_B] });
  const token = await createTask(server);
  assert.equal((await server.request({ action: "status", taskToken: token }, "token-b")).status, 403);
});

test("status retorna sucesso enquanto o resultado está disponível", async () => {
  const server = createServer();
  const token = await createTask(server);
  assert.deepEqual(await (await server.request({ action: "status", taskToken: token })).json(), { status: "succeeded" });
});

test("falha HTTP do provedor e timeout retornam erros limitados", async () => {
  const rejected = createServer({ nvidiaStatus: 429 });
  assert.equal((await rejected.request({ action: "start", kind: "nativa", title: "x", prompt: "y" })).status, 502);
  const timeout = createServer({ fetchOverride: async ({ url }) => {
    if (url.endsWith("/auth/v1/user")) return jsonResponse({ id: USER_A });
    const error = new Error("timeout"); error.name = "TimeoutError"; throw error;
  } });
  const response = await timeout.request({ action: "start", kind: "nativa", title: "x", prompt: "y" });
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /demorou demais/i);
});

test("resposta sem imagem, base64 inválido ou conteúdo não raster são recusados", async () => {
  const cases = [
    { artifacts: [] },
    { artifacts: [{ base64_image: Buffer.from("não é imagem").toString("base64") }] },
    { artifacts: [{ base64_image: Buffer.from(new Uint8Array([60, 115, 118, 103])).toString("base64") }] }
  ];
  for (const nvidiaResponse of cases) {
    const server = createServer({ nvidiaResponse });
    assert.equal((await server.request({ action: "start", kind: "nativa", title: "x", prompt: "y" })).status, 502);
  }
});

test("download válido devolve Blob raster sem cache e é de uso único", async () => {
  const server = createServer();
  const token = await createTask(server);
  const response = await server.request({ action: "download", taskToken: token });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/octet-stream");
  assert.equal(response.headers.get("x-image-content-type"), "image/png");
  assert.match(response.headers.get("access-control-expose-headers"), /x-image-content-type/i);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.arrayBuffer()).byteLength, PNG_BYTES.byteLength);
  assert.equal((await server.request({ action: "download", taskToken: token })).status, 410);
});

test("cliente não inicia geração sem clique explícito e limita tentativas", async () => {
  const source = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
  const viewFn = source.slice(source.indexOf("function mostrarTela("), source.indexOf("document.querySelectorAll(\"[data-view]\")"));
  assert.doesNotMatch(viewFn, /estudioImagens\.gerar|action:\s*["']start/);
  assert.match(source, /#art-generation-form[\s\S]{0,300}addEventListener\("submit"/);
  assert.match(source, /estudioImagens\.gerar\(/);
  let invokes = 0;
  const studio = criarEstudioImagens({ clientProvider: mockClient({ invoke: async () => { invokes++; return { data: {}, error: null }; } }), maxPolls: 2, wait: async () => {} });
  await assert.rejects(studio.gerar({ kind: "nativa", title: "x", prompt: "y" }), /task|tarefa/i);
  assert.equal(invokes, 1);
});

test("fluxo completo do estúdio interpreta resposta octet-stream do supabase-js como Blob raster", async () => {
  const actions = [];
  const invoke = async (_name, options) => {
    actions.push(options.body.action);
    if (options.body.action === "start") return { data: { taskToken: "opaque-signed-token" }, error: null };
    if (options.body.action === "status") return { data: { status: "succeeded" }, error: null };
    assert.equal(options.responseType, undefined);
    return {
      data: new Blob([PNG_BYTES], { type: "application/octet-stream" }),
      response: new Response(null, { headers: { "x-image-content-type": "image/png" } }),
      error: null
    };
  };
  const studio = criarEstudioImagens({ clientProvider: mockClient({ invoke }), wait: async () => {}, maxPolls: 1 });
  const result = await studio.gerar({ kind: "nativa", title: "Guardião", prompt: "Escamas verdes" });
  assert.deepEqual(actions, ["start", "status", "download"]);
  assert.equal(result.blob.type, "image/png");
  assert.equal(result.blob.size, PNG_BYTES.byteLength);
});

test("estúdio rejeita resposta binária sem cabeçalho raster validado", async () => {
  const invoke = async (_name, options) => {
    if (options.body.action === "start") return { data: { taskToken: "opaque-signed-token" }, error: null };
    if (options.body.action === "status") return { data: { status: "succeeded" }, error: null };
    return { data: new Blob([new Uint8Array([1])], { type: "application/octet-stream" }), response: new Response(null), error: null };
  };
  const studio = criarEstudioImagens({ clientProvider: mockClient({ invoke }), wait: async () => {}, maxPolls: 1 });
  await assert.rejects(studio.gerar({ kind: "nativa", title: "x", prompt: "y" }), /imagem inválido/i);
});

test("estúdio interrompe ao trocar de conta antes de baixar e não tenta de novo automaticamente", async () => {
  let downloads = 0;
  const invoke = async (_name, options) => {
    if (options.body.action === "start") return { data: { taskToken: "opaque-signed-token" }, error: null };
    if (options.body.action === "status") return { data: { status: "succeeded" }, error: null };
    downloads++;
    return { data: PNG(), error: null };
  };
  const studio = criarEstudioImagens({ clientProvider: mockClient({ invoke, sessionIds: [USER_A, USER_A, USER_B] }), wait: async () => {}, maxPolls: 1 });
  await assert.rejects(studio.gerar({ kind: "nativa", title: "x", prompt: "y" }), /conta mudou/i);
  assert.equal(downloads, 0);
});

test("acervo usa sessão, separa contas e conserva Blob local entre instâncias do módulo", async () => {
  let userId = USER_A;
  const indexedDbLikeStore = new Map();
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
  const repository = {
    guardarFoto: async (id, blob) => indexedDbLikeStore.set(id, blob),
    obterFoto: async id => indexedDbLikeStore.get(id) || null,
    removerFoto: async id => indexedDbLikeStore.delete(id)
  };
  const clientProvider = async () => ({ auth: { getSession: async () => ({ data: { session: userId ? { user: { id: userId } } : null }, error: null }) } });
  const galleryA = criarGaleriaImagens({ clientProvider, repository, storage });
  const entry = await galleryA.salvar({ blob: PNG(), kind: "biome", title: "Manguezal", prompt: "Neblina" });
  assert.equal(indexedDbLikeStore.get(entry.photoId).type, "image/png");
  const galleryAfterReload = criarGaleriaImagens({ clientProvider, repository, storage });
  assert.equal((await galleryAfterReload.listar()).length, 1);
  userId = USER_B;
  assert.deepEqual(await galleryAfterReload.listar(), []);
  assert.equal(await galleryAfterReload.obter(entry.id), null);
  assert.equal(indexedDbLikeStore.has(entry.photoId), true);
  userId = USER_A;
  assert.equal((await galleryAfterReload.obter(entry.id)).title, "Manguezal");
});

test("galeria rejeita SVG e metadados malformados", async () => {
  const storage = { getItem: () => null, setItem() {} };
  const repository = { guardarFoto: async () => assert.fail("Não deveria persistir"), removerFoto: async () => {} };
  const gallery = criarGaleriaImagens({ clientProvider: mockClient(), repository, storage });
  await assert.rejects(gallery.salvar({ blob: new Blob(["<svg/>"]), kind: "other", title: "x", prompt: "y" }), /imagem local válida/i);
  await assert.rejects(gallery.salvar({ blob: PNG(), kind: "unknown", title: "x", prompt: "y" }), /metadados/i);
});

test("aplicar arte copia a foto e preserva todos os demais campos da ficha", async () => {
  const originalBlob = PNG();
  const files = new Map([["gallery-photo", originalBlob]]);
  const repository = {
    obterFoto: async id => files.get(id) || null,
    guardarFoto: async (id, blob) => files.set(id, blob),
    removerFoto: async id => files.delete(id)
  };
  const target = { id: "local-id", name: "Nativa", attrs: { força: 4 }, techniques: [{ id: "t1" }], essences: ["água"], photoId: "old-photo", unknownField: { kept: true } };
  const before = structuredClone(target);
  const result = await aplicarArteComoRetrato({
    artId: "art-1", target, repository,
    gallery: { obter: async () => ({ id: "art-1", photoId: "gallery-photo" }) },
    persist: async (next, previous) => { assert.deepEqual(previous, before); assert.deepEqual({ ...next, photoId: before.photoId }, before); return { persisted: true }; }
  });
  assert.equal(result.persisted, true);
  assert.notEqual(result.photoId, "gallery-photo");
  assert.equal(target.photoId, result.photoId);
  assert.deepEqual({ ...target, photoId: before.photoId }, before);
  assert.equal(files.get("gallery-photo"), originalBlob);
  assert.equal(files.get(result.photoId), originalBlob);
});

test("falha ao aplicar retrato restaura ficha e remove cópia temporária", async () => {
  const original = PNG();
  const files = new Map([["gallery-photo", original]]);
  const target = { id: "local-id", name: "Nativa", photoId: "old-photo", attrs: { vigor: 2 } };
  const before = structuredClone(target);
  await assert.rejects(aplicarArteComoRetrato({
    artId: "art-1", target,
    repository: { obterFoto: async id => files.get(id) || null, guardarFoto: async (id, blob) => files.set(id, blob), removerFoto: async id => files.delete(id) },
    gallery: { obter: async () => ({ id: "art-1", photoId: "gallery-photo" }) },
    persist: async () => { throw new Error("storage failure"); }
  }), /storage failure/);
  assert.deepEqual(target, before);
  assert.equal(files.size, 1);
});

test("ausência de arquivo local é informada sem modificar ficha nem acervo", async () => {
  const target = { id: "local-id", name: "Nativa", photoId: "old-photo" };
  const before = structuredClone(target);
  await assert.rejects(aplicarArteComoRetrato({ artId: "art-1", target, gallery: { obter: async () => ({ photoId: "missing" }) }, repository: { obterFoto: async () => null, guardarFoto: async () => {}, removerFoto: async () => {} }, persist: async () => ({ persisted: true }) }), /IndexedDB/i);
  assert.deepEqual(target, before);
});

test("synchronization queue receives only photoId references, never Blob", async () => {
  const source = await readFile(new URL("../js/repository.js", import.meta.url), "utf8");
  const tests = await readFile(new URL("./repository-sync.test.js", import.meta.url), "utf8");
  assert.match(source, /p_data:\s*clonarJson\(snapshot\)/);
  assert.match(tests, /photoId[\s\S]{0,250}Blob|Blob[\s\S]{0,250}photoId/i);
});
