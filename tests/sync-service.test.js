import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { criarServicoSincronizacao } from "../js/sync-service.js";

const REMOTE_ID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REMOTE_ID_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OP_1 = "11111111-1111-4111-8111-111111111111";
const OP_2 = "22222222-2222-4222-8222-222222222222";
const OP_3 = "33333333-3333-4333-8333-333333333333";

function ficha(id, name, photoId = null) {
  return { id, name, attrs: { ATQ: 2 }, techniques: ["tech-a"], unknownField: { keep: true }, photoId };
}

function save(operationId, localId, sequence, expectedRevision, dependsOn = null, name = `Nativa ${sequence}`) {
  const snapshot = ficha(localId, name, "photo-local-1");
  return {
    operationId, userId: "account-a", localId, sequence, type: "save",
    request: { p_local_id: localId, p_format_version: 1, p_data: structuredClone(snapshot), p_expected_revision: expectedRevision },
    expectedRevision, revisionStrategy: dependsOn ? "after-dependency" : "fixed", dependsOn,
    status: dependsOn ? "blocked" : "pending", snapshot, createdAt: new Date(0).toISOString()
  };
}

function criarRepositorioFake(initialOperations = []) {
  const operations = structuredClone(initialOperations);
  const conflicts = [];
  const remoteRevisions = new Map();
  return {
    operations, conflicts, remoteRevisions,
    async listarOperacoesSincronizacao() { return structuredClone(operations); },
    async obterResumoFilaSincronizacao() {
      return {
        sessionAvailable: true,
        pending: operations.filter(op => ["pending", "blocked"].includes(op.status)).length,
        completed: operations.filter(op => op.status === "completed").length,
        failed: operations.filter(op => op.status === "failed").length,
        conflicts: conflicts.length
      };
    },
    async prepararOperacaoParaSincronizacao(id) {
      const op = operations.find(item => item.operationId === id);
      if (!op || !["pending", "failed"].includes(op.status)) throw Object.assign(new Error("not ready"), { code: "OPERATION_NOT_READY" });
      if (op.dependsOn && operations.find(item => item.operationId === op.dependsOn)?.status !== "completed") {
        throw Object.assign(new Error("dependency"), { code: "DEPENDENCY_UNRESOLVED" });
      }
      const revision = op.revisionStrategy === "after-dependency" || op.revisionStrategy === "awaiting-remote-create"
        ? remoteRevisions.get(op.localId) : op.expectedRevision;
      op.status = "pending";
      op.attemptExpectedRevision = revision;
      return { operation: structuredClone(op), request: { ...structuredClone(op.request), p_expected_revision: revision } };
    },
    async registrarFalhaOperacaoSincronizacao(id, error) {
      const op = operations.find(item => item.operationId === id);
      op.status = "failed"; op.lastError = error.message;
    },
    async registrarConflitoOperacaoSincronizacao(id, result) {
      const op = operations.find(item => item.operationId === id);
      op.status = "conflict";
      const related = operations.filter(item => item.localId === op.localId && item.sequence >= op.sequence);
      for (const child of related) if (child !== op && child.status !== "completed") child.status = "blocked";
      const conflict = { conflictId: id, operationId: id, localId: op.localId,
        localSnapshot: structuredClone(op.snapshot), operationSnapshot: structuredClone(op.snapshot),
        remoteSnapshot: result.data || null, remoteRevision: result.revision || null,
        remoteId: result.remote_id || null, resultStatus: result.status,
        operationIds: related.map(item => item.operationId), status: "open" };
      conflicts.push(conflict);
      return structuredClone(conflict);
    },
    async concluirOperacaoSincronizacao(id, result) {
      const op = operations.find(item => item.operationId === id);
      op.status = "completed";
      remoteRevisions.set(op.localId, result.revision);
      op.serverResult = structuredClone(result);
      for (const child of operations.filter(item => item.dependsOn === id && item.status === "blocked")) child.status = "pending";
    }
  };
}

function clientProvider({ userId = "account-a", rpc, getSession } = {}) {
  return async () => ({
    auth: { getSession: getSession || (async () => ({ data: { session: { user: { id: userId } } }, error: null })) },
    rpc
  });
}

function respostaSave(args, remoteId, revision) {
  return { status: "saved", local_id: args.p_local_id, remote_id: remoteId, revision };
}

test("envia saves em ordem por ficha, separa fichas e inclui apenas snapshots com referência photoId", async () => {
  const queue = criarRepositorioFake([
    save(OP_1, "local-a", 1, null),
    save(OP_2, "local-a", 2, null, OP_1, "Aruã editada"),
    save(OP_3, "local-b", 1, null)
  ]);
  const calls = [];
  const rpc = async (name, args) => {
    calls.push({ name, args: structuredClone(args) });
    assert.equal(args.p_data.photoId, "photo-local-1");
    assert.equal(JSON.stringify(args).includes("Blob"), false);
    const localA = args.p_local_id === "local-a";
    const previous = queue.remoteRevisions.get(args.p_local_id) || 0;
    return { data: respostaSave(args, localA ? REMOTE_ID_A : REMOTE_ID_B, previous + 1), error: null };
  };
  const service = criarServicoSincronizacao({ clientProvider: clientProvider({ rpc }), repository: queue });
  const result = await service.sincronizar();
  assert.deepEqual(calls.map(call => call.args.p_operation_id), [OP_1, OP_2, OP_3]);
  assert.deepEqual(calls.map(call => call.args.p_expected_revision), [null, 1, null]);
  assert.equal(calls.every(call => !Object.hasOwn(call.args, "owner_id") && !Object.hasOwn(call.args, "user_id")), true);
  assert.equal(result.saved, 3);
  assert.equal(queue.operations.every(op => op.status === "completed"), true);
});

test("falha preserva a operação e retry reutiliza UUID e revisão esperada", async () => {
  const queue = criarRepositorioFake([save(OP_1, "local-a", 1, null)]);
  const calls = [];
  let fail = true;
  const rpc = async (_name, args) => {
    calls.push(structuredClone(args));
    if (fail) { fail = false; return { data: null, error: new Error("offline") }; }
    return { data: respostaSave(args, REMOTE_ID_A, 1), error: null };
  };
  const service = criarServicoSincronizacao({ clientProvider: clientProvider({ rpc }), repository: queue });
  const first = await service.sincronizar();
  assert.equal(first.failed, 1);
  assert.equal(queue.operations[0].status, "failed");
  const preservedPayload = structuredClone(queue.operations[0].request);
  const second = await service.sincronizar();
  assert.equal(second.saved, 1);
  assert.equal(calls[0].p_operation_id, calls[1].p_operation_id);
  assert.equal(calls[0].p_expected_revision, calls[1].p_expected_revision);
  assert.deepEqual(queue.operations[0].request, preservedPayload);
});

test("conflito interrompe a sequência da ficha e preserva snapshots local e remoto", async () => {
  const first = save(OP_1, "local-a", 1, 1, null, "local snapshot");
  const second = save(OP_2, "local-a", 2, null, OP_1, "local edit pendente");
  const queue = criarRepositorioFake([first, second]);
  let calls = 0;
  const rpc = async (_name, args) => {
    calls++;
    return { data: { status: "conflict", local_id: args.p_local_id, remote_id: REMOTE_ID_A,
      revision: 4, format_version: 1, data: ficha(args.p_local_id, "remote snapshot") }, error: null };
  };
  const service = criarServicoSincronizacao({ clientProvider: clientProvider({ rpc }), repository: queue });
  const result = await service.sincronizar();
  assert.equal(result.conflicts, 1);
  assert.equal(calls, 1);
  assert.equal(queue.operations[0].status, "conflict");
  assert.equal(queue.operations[1].status, "blocked");
  assert.equal(queue.conflicts[0].localSnapshot.name, "local snapshot");
  assert.equal(queue.conflicts[0].remoteSnapshot.name, "remote snapshot");
  assert.equal(first.request.p_data.name, "local snapshot");
});

test("exclusão só é enviada depois dos saves e usa revisão confirmada", async () => {
  const deletion = { operationId: OP_2, userId: "account-a", localId: "local-a", sequence: 2, type: "delete",
    request: { p_local_id: "local-a", p_expected_revision: null }, expectedRevision: null,
    revisionStrategy: "after-dependency", dependsOn: OP_1, status: "blocked", snapshot: ficha("local-a", "Aruã") };
  const queue = criarRepositorioFake([save(OP_1, "local-a", 1, null), deletion]);
  const calls = [];
  const rpc = async (name, args) => {
    calls.push({ name, args: structuredClone(args) });
    if (name === "save_nativa") return { data: respostaSave(args, REMOTE_ID_A, 1), error: null };
    return { data: { status: "deleted", local_id: args.p_local_id, remote_id: REMOTE_ID_A, revision: 2, deleted_at: "2026-11-04T00:00:00Z" }, error: null };
  };
  const result = await criarServicoSincronizacao({ clientProvider: clientProvider({ rpc }), repository: queue }).sincronizar();
  assert.deepEqual(calls.map(call => call.name), ["save_nativa", "delete_nativa"]);
  assert.deepEqual(calls.map(call => call.args.p_expected_revision), [null, 1]);
  assert.equal(result.saved, 2);
});

test("não chama RPC sem sessão autenticada", async () => {
  const queue = criarRepositorioFake([save(OP_1, "local-a", 1, null)]);
  let calls = 0;
  const rpc = async () => { calls++; return {}; };
  const service = criarServicoSincronizacao({ clientProvider: clientProvider({
    rpc, getSession: async () => ({ data: { session: null }, error: null })
  }), repository: queue });
  await assert.rejects(service.sincronizar(), /Entre na sua conta/);
  assert.equal(calls, 0);
  assert.equal(queue.operations[0].status, "pending");
});

test("fila vazia não envia fichas locais não preparadas", async () => {
  const queue = criarRepositorioFake([]);
  let calls = 0;
  const rpc = async () => { calls++; return {}; };
  const result = await criarServicoSincronizacao({ clientProvider: clientProvider({ rpc }), repository: queue }).sincronizar();
  assert.equal(result.processed, 0);
  assert.equal(calls, 0);
});

test("login apenas atualiza interface e não inicia sincronização automática", () => {
  const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  const start = app.indexOf("client.auth.onAuthStateChange");
  const end = app.indexOf("}).catch", start);
  const authListener = start >= 0 && end > start ? app.slice(start, end) : "";
  assert.match(authListener, /renderizarLista/);
  assert.match(authListener, /atualizarPainelSincronizacao/);
  assert.doesNotMatch(authListener, /sincronizar\(/);
  assert.match(app, /#sync-run[\s\S]*?servicoSincronizacao\.sincronizar\(/);
});

test("resposta inválida não conclui a operação", async () => {
  const queue = criarRepositorioFake([save(OP_1, "local-a", 1, null)]);
  const rpc = async () => ({ data: { status: "saved", local_id: "another-id", remote_id: REMOTE_ID_A, revision: 1 }, error: null });
  const result = await criarServicoSincronizacao({ clientProvider: clientProvider({ rpc }), repository: queue }).sincronizar();
  assert.equal(result.failed, 1);
  assert.equal(queue.operations[0].status, "failed");
  assert.equal(queue.remoteRevisions.has("local-a"), false);
});

test("mudança de conta interrompe o ciclo sem confirmar operação sob a nova sessão", async () => {
  const queue = criarRepositorioFake([save(OP_1, "local-a", 1, null)]);
  let sessionReads = 0;
  let rpcCalls = 0;
  const getSession = async () => ({ data: { session: { user: { id: ++sessionReads >= 3 ? "account-b" : "account-a" } } }, error: null });
  const rpc = async (name, args) => { rpcCalls++; return { data: respostaSave(args, REMOTE_ID_A, 1), error: null }; };
  const service = criarServicoSincronizacao({ clientProvider: clientProvider({ rpc, getSession }), repository: queue });
  await assert.rejects(service.sincronizar(), error => error.code === "SESSION_CHANGED");
  assert.equal(rpcCalls, 0);
  assert.equal(queue.operations[0].status, "pending");
});
