import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../js/supabase-config.js";
import { criarServicoSincronizacao } from "../js/sync-service.js";

// Deliberately refuses every non-local target. No service_role key is used.
const API = "http://127.0.0.1:54321";
const DB_CONTAINER = "supabase_db_NATIVA_Prototipo_Atualizado";
const DOCKER = "C:\\Users\\Ramos\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker.exe";
const runId = randomUUID();
const prefix = `it-${runId}`;
const ids = { main: `${prefix}-main`, race: `${prefix}-race`, deleted: `${prefix}-deleted` };
const accounts = [];
const rpcCalls = [];

function docker(args) {
  return execFileSync(DOCKER, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function verifyLocalDatabase() {
  const identity = docker(["inspect", "--format", "{{.Name}}|{{.Config.Image}}|{{index .Config.Labels \"com.supabase.cli.project\"}}|{{.State.Status}}", DB_CONTAINER]);
  assert.equal(identity, `/supabase_db_NATIVA_Prototipo_Atualizado|public.ecr.aws/supabase/postgres:17.11.0.011|NATIVA_Prototipo_Atualizado|running`);
  const sql = "select current_database()||'|'||current_setting('server_version'); select version||'|'||name from supabase_migrations.schema_migrations order by version; select p.proname||'|'||pg_get_function_identity_arguments(p.oid)||'|'||p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('save_nativa','delete_nativa') order by p.proname;";
  const rows = docker(["exec", DB_CONTAINER, "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-Atc", sql]).split(/\r?\n/).filter(Boolean);
  assert(rows.some(row => row.startsWith("postgres|17.")));
  assert(rows.includes("20261104050000|nativa_sync_infrastructure"));
  assert(rows.some(row => row.startsWith("save_nativa|p_operation_id uuid, p_local_id text, p_format_version integer, p_data jsonb, p_expected_revision bigint|true")));
  assert(rows.some(row => row.startsWith("delete_nativa|p_operation_id uuid, p_local_id text, p_expected_revision bigint|true")));
  return rows;
}

async function request(path, { method = "GET", token, body, prefer, baseUrl = API } = {}) {
  const headers = { apikey: SUPABASE_PUBLISHABLE_KEY, Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;
  const response = await fetch(`${baseUrl}${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(12000)
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  return { response, data };
}

async function disposableAccount(label) {
  const email = `nativa-rpc-${label}-${runId}@example.invalid`;
  const password = `${randomBytes(30).toString("base64url")}aB1!`;
  const signup = await request("/auth/v1/signup", { method: "POST", body: { email, password, data: { display_name: `NATIVA teste ${label}` } } });
  const user = signup.data?.user || signup.data;
  const account = { label, email, userId: user?.id, accessToken: signup.data?.access_token || null };
  if (account.userId) accounts.push(account);
  assert.equal(signup.response.ok, true, `Signup local ${label} falhou: HTTP ${signup.response.status}`);
  assert.match(account.userId || "", /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  if (!account.accessToken) {
    const login = await request("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } });
    assert.equal(login.response.ok, true, `Login local ${label} falhou: HTTP ${login.response.status}`);
    account.accessToken = login.data?.access_token;
    assert(account.accessToken, `Auth local não retornou JWT para ${label}.`);
    assert.equal(login.data?.user?.id, account.userId);
  } else {
    assert.equal(signup.data?.user?.id, account.userId);
  }
  return account;
}

async function rpc(account, name, args) {
  assert(["save_nativa", "delete_nativa"].includes(name));
  rpcCalls.push({ account: account.label, name, operationId: args.p_operation_id });
  return request(`/rest/v1/rpc/${name}`, { method: "POST", token: account.accessToken, body: args });
}

async function readNativas(account, localId) {
  const params = new URLSearchParams({
    select: "id,owner_id,local_id,format_version,data,revision,deleted_at",
    local_id: `eq.${localId}`
  });
  const result = await request(`/rest/v1/nativas?${params}`, { token: account.accessToken });
  assert.equal(result.response.status, 200, `Leitura RLS falhou: HTTP ${result.response.status}`);
  assert(Array.isArray(result.data));
  return result.data;
}

function makeServiceRpcClient(account, baseUrl = API) {
  return {
    auth: { async getSession() { return { data: { session: { user: { id: account.userId } } }, error: null }; } },
    async rpc(name, args) {
      rpcCalls.push({ account: account.label, name, operationId: args.p_operation_id, via: "sync-service" });
      const result = await request(`/rest/v1/rpc/${name}`, { method: "POST", token: account.accessToken, body: args, baseUrl });
      return result.response.ok
        ? { data: result.data, error: null }
        : { data: null, error: { code: result.data?.code, message: result.data?.message || String(result.data), status: result.response.status } };
    }
  };
}

function makeInMemoryQueue(account, initialOperations = []) {
  const operations = structuredClone(initialOperations);
  const conflicts = [];
  const revisions = new Map();
  const repository = {
    async listarOperacoesSincronizacao() { return structuredClone(operations); },
    async prepararOperacaoParaSincronizacao(operationId) {
      const operation = operations.find(item => item.operationId === operationId && item.userId === account.userId);
      if (!operation) throw Object.assign(new Error("operation missing"), { code: "OPERATION_NOT_FOUND" });
      if (operation.dependsOn && operations.find(item => item.operationId === operation.dependsOn)?.status !== "completed") {
        throw Object.assign(new Error("dependency missing"), { code: "DEPENDENCY_UNRESOLVED" });
      }
      if (operation.status === "blocked" && operation.dependsOn) operation.status = "pending";
      if (!["pending", "failed"].includes(operation.status)) {
        throw Object.assign(new Error("operation is not ready"), { code: "OPERATION_NOT_READY" });
      }
      const expected = operation.revisionStrategy === "after-dependency"
        ? revisions.get(operation.localId) ?? null : operation.expectedRevision;
      const requestBody = structuredClone(operation.request);
      requestBody.p_expected_revision = expected;
      operation.attemptExpectedRevision = expected;
      return { operation: structuredClone(operation), request: requestBody };
    },
    async concluirOperacaoSincronizacao(operationId, result) {
      const operation = operations.find(item => item.operationId === operationId);
      operation.status = "completed";
      operation.serverResult = structuredClone(result);
      revisions.set(operation.localId, result.revision);
      for (const child of operations.filter(item => item.dependsOn === operationId && item.status === "blocked")) child.status = "pending";
      return structuredClone(operation);
    },
    async registrarFalhaOperacaoSincronizacao(operationId, error) {
      const operation = operations.find(item => item.operationId === operationId);
      operation.status = "failed";
      operation.lastError = String(error?.message || error);
      return structuredClone(operation);
    },
    async registrarConflitoOperacaoSincronizacao(operationId, result) {
      const operation = operations.find(item => item.operationId === operationId);
      operation.status = "conflict";
      const conflict = {
        operationId, localId: operation.localId,
        localSnapshot: structuredClone(operation.snapshot),
        remoteSnapshot: structuredClone(result.data),
        remoteRevision: result.revision, resultStatus: result.status
      };
      conflicts.push(conflict);
      return structuredClone(conflict);
    },
    async obterResumoFilaSincronizacao() {
      return {
        sessionAvailable: true,
        pending: operations.filter(item => ["pending", "blocked"].includes(item.status)).length,
        completed: operations.filter(item => item.status === "completed").length,
        failed: operations.filter(item => item.status === "failed").length,
        conflicts: conflicts.length
      };
    }
  };
  return { repository, operations, conflicts, revisions };
}

function queuedOperation(account, { operationId = randomUUID(), localId, type = "save", sequence, request: rpcArgs, snapshot, dependsOn = null, expectedRevision = null, revisionStrategy = dependsOn ? "after-dependency" : "fixed" }) {
  return {
    operationId, userId: account.userId, localId, sequence, type,
    request: structuredClone(rpcArgs), expectedRevision, revisionStrategy, dependsOn,
    status: dependsOn ? "blocked" : "pending", snapshot: structuredClone(snapshot)
  };
}

function ficha(localId, nome, marker) {
  return {
    id: localId, nome, linhagem: "teste-integracao",
    atributos: { vigor: 3, agilidade: 2, foco: 4 },
    tracos: ["it-traco"], tecnicas: ["it-tecnica"],
    progressao: { experiencia: 17, marker },
    photoId: `local-only-${runId}`,
    preservedUnknownField: { marker }
  };
}

async function deleteDisposableUsers() {
  const userIds = accounts.map(account => account.userId).filter(Boolean);
  if (!userIds.length) return;
  assert(userIds.every(id => /^[0-9a-f-]{36}$/i.test(id)));
  const list = userIds.map(id => `'${id}'`).join(",");
  const removed = docker(["exec", DB_CONTAINER, "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-Atc", `with removed as (delete from auth.users where id in (${list}) returning id) select id from removed order by id;`]);
  assert.deepEqual(new Set(removed.split(/\r?\n/).filter(line => /^[0-9a-f-]{36}$/i.test(line))), new Set(userIds), "A limpeza não removeu exatamente os usuários descartáveis desta execução.");
  console.log(`CLEANUP PASS: ${userIds.length} usuários descartáveis removidos por UUID exato; exclusão em cascata local.`);
}

async function main() {
  assert.equal(process.env.NATIVA_RUN_LOCAL_SUPABASE_INTEGRATION, "1", "Defina NATIVA_RUN_LOCAL_SUPABASE_INTEGRATION=1 para autorizar este teste local descartável.");
  assert.equal(SUPABASE_URL, API, "Destino recusado: somente 127.0.0.1:54321 é permitido.");
  assert(SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_"), "Somente a chave pública Supabase local é aceita.");
  const authHealth = await request("/auth/v1/health");
  assert.equal(authHealth.response.status, 200, "Auth local não respondeu HTTP 200.");
  const migrationRows = verifyLocalDatabase();
  console.log(`PRECHECK PASS: Auth local, container NATIVA, PostgreSQL 17, ${migrationRows.filter(row => row.includes("|") && /^2026/.test(row)).length} migrations e RPCs confirmados.`);

  try {
    const a = await disposableAccount("a");
    const b = await disposableAccount("b");
    console.log("AUTH PASS: duas contas locais descartáveis criadas e autenticadas; credenciais não são exibidas.");

    const main = ficha(ids.main, "Nativa de integração", "v1");
    const createId = randomUUID();
    const createArgs = { p_operation_id: createId, p_local_id: ids.main, p_format_version: 1, p_data: main, p_expected_revision: null };
    const create = await rpc(a, "save_nativa", createArgs);
    assert.equal(create.response.status, 200, `save_nativa create HTTP ${create.response.status}: ${JSON.stringify(create.data)}`);
    assert.equal(create.data.status, "saved");
    assert.equal(create.data.local_id, ids.main);
    assert.equal(create.data.revision, 1);
    assert.match(create.data.remote_id, /^[0-9a-f-]{36}$/i);
    const rows = await readNativas(a, ids.main);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].owner_id, a.userId);
    assert.equal(rows[0].id, create.data.remote_id);
    assert.equal(rows[0].data.id, ids.main);
    assert.equal(rows[0].data.preservedUnknownField.marker, "v1");
    assert.equal(rows[0].data.photoId, main.photoId);
    assert(!JSON.stringify(createArgs).includes("Blob"));

    const replay = await rpc(a, "save_nativa", createArgs);
    assert.equal(replay.response.status, 200);
    assert.deepEqual(replay.data, create.data, "Replay do mesmo operation_id deve retornar exatamente o resultado anterior.");
    const reused = await rpc(a, "save_nativa", { ...createArgs, p_data: { ...main, nome: "UUID reutilizado" } });
    assert.equal(reused.response.ok, false, "Reuso de operation_id com conteúdo diferente não foi recusado.");
    assert.equal((await readNativas(a, ids.main))[0].revision, 1);
    console.log("SAVE/IDEMPOTÊNCIA PASS: criação revisão 1, replay sem incremento, conteúdo divergente com mesmo UUID recusado.");

    const updated = ficha(ids.main, "Nativa atualizada", "v2");
    updated.atributos.vigor = 5;
    const updateArgs = { p_operation_id: randomUUID(), p_local_id: ids.main, p_format_version: 1, p_data: updated, p_expected_revision: 1 };
    const update = await rpc(a, "save_nativa", updateArgs);
    assert.equal(update.response.status, 200);
    assert.equal(update.data.status, "saved");
    assert.equal(update.data.revision, 2);
    const conflict = await rpc(a, "save_nativa", { ...updateArgs, p_operation_id: randomUUID(), p_data: ficha(ids.main, "Versão stale", "stale") });
    assert.equal(conflict.response.status, 200);
    assert.equal(conflict.data.status, "conflict");
    assert.equal(conflict.data.revision, 2);
    assert.equal(conflict.data.data.nome, updated.nome);
    assert.equal((await readNativas(a, ids.main))[0].data.atributos.vigor, 5);
    console.log("UPDATE/CONFLICT PASS: revisão 2; operação antiga recebeu conflito com snapshot remoto íntegro.");

    const serviceConflictLocal = ficha(ids.main, "Conflito pelo sync-service", "service-local");
    const serviceConflictOperation = queuedOperation(a, {
      localId: ids.main, sequence: 50, expectedRevision: 1, snapshot: serviceConflictLocal,
      request: { p_local_id: ids.main, p_format_version: 1, p_data: serviceConflictLocal, p_expected_revision: 1 }
    });
    const conflictQueue = makeInMemoryQueue(a, [serviceConflictOperation]);
    const conflictService = criarServicoSincronizacao({ clientProvider: async () => makeServiceRpcClient(a), repository: conflictQueue.repository });
    const serviceConflictResult = await conflictService.sincronizar();
    assert.equal(serviceConflictResult.conflicts, 1);
    assert.equal(conflictQueue.conflicts.length, 1);
    assert.equal(conflictQueue.conflicts[0].localSnapshot.nome, serviceConflictLocal.nome);
    assert.equal(conflictQueue.conflicts[0].remoteSnapshot.nome, updated.nome);
    console.log("SYNC-SERVICE CONFLICT PASS: serviço processou resposta real de conflito e reteve snapshots local e remoto no adaptador de teste.");

    const serviceLocalId = `${prefix}-service`;
    const serviceInitial = ficha(serviceLocalId, "Fila serviço real", "service-v1");
    const serviceEdited = { ...serviceInitial, nome: "Fila serviço editada", progressao: { ...serviceInitial.progressao, marker: "service-v2" } };
    const serviceDeleteSnapshot = structuredClone(serviceEdited);
    const serviceSave1 = queuedOperation(a, {
      localId: serviceLocalId, sequence: 1, snapshot: serviceInitial,
      request: { p_local_id: serviceLocalId, p_format_version: 1, p_data: serviceInitial, p_expected_revision: null }
    });
    const serviceSave2 = queuedOperation(a, {
      localId: serviceLocalId, sequence: 2, snapshot: serviceEdited, dependsOn: serviceSave1.operationId,
      request: { p_local_id: serviceLocalId, p_format_version: 1, p_data: serviceEdited, p_expected_revision: null }
    });
    const serviceDelete = queuedOperation(a, {
      localId: serviceLocalId, type: "delete", sequence: 3, snapshot: serviceDeleteSnapshot,
      dependsOn: serviceSave2.operationId,
      request: { p_local_id: serviceLocalId, p_expected_revision: null }
    });
    const queue = makeInMemoryQueue(a, [serviceSave1, serviceSave2, serviceDelete]);
    const realRpcService = criarServicoSincronizacao({ clientProvider: async () => makeServiceRpcClient(a), repository: queue.repository });
    const serviceResult = await realRpcService.sincronizar();
    assert.equal(serviceResult.saved, 3);
    assert.deepEqual(queue.operations.map(operation => operation.status), ["completed", "completed", "completed"]);
    assert.deepEqual(queue.operations.map(operation => operation.operationId), [serviceSave1.operationId, serviceSave2.operationId, serviceDelete.operationId]);
    const serviceRow = await readNativas(a, serviceLocalId);
    assert.equal(serviceRow.length, 0, "A consulta RLS não deve mostrar a ficha após delete remoto.");
    const serviceDbRow = docker(["exec", DB_CONTAINER, "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-Atc", `select revision||'|'||(deleted_at is not null)::text||'|'||(data->>'nome') from public.nativas where owner_id='${a.userId}' and local_id='${serviceLocalId}';`]);
    assert.equal(serviceDbRow, "3|true|Fila serviço editada");
    assert(rpcCalls.filter(call => call.via === "sync-service" && [serviceSave1.operationId, serviceSave2.operationId, serviceDelete.operationId].includes(call.operationId)).length === 3);
    console.log("SYNC-SERVICE PASS: serviço real chamou as duas RPCs via HTTP/JWT; save, save dependente e delete foram confirmados em ordem. Adaptador de fila em memória, separado do teste de IndexedDB.");

    const retryLocalId = `${prefix}-retry`;
    const retrySnapshot = ficha(retryLocalId, "Retry do sync-service", "retry");
    const retryOperation = queuedOperation(a, {
      localId: retryLocalId, sequence: 1, snapshot: retrySnapshot,
      request: { p_local_id: retryLocalId, p_format_version: 1, p_data: retrySnapshot, p_expected_revision: null }
    });
    const retryQueue = makeInMemoryQueue(a, [retryOperation]);
    const brokenService = criarServicoSincronizacao({
      clientProvider: async () => makeServiceRpcClient(a, "http://127.0.0.1:1"), repository: retryQueue.repository
    });
    const firstAttempt = await brokenService.sincronizar();
    assert.equal(firstAttempt.failed, 1);
    assert.equal(retryQueue.operations[0].status, "failed");
    assert.equal(retryQueue.operations[0].operationId, retryOperation.operationId);
    assert.deepEqual(retryQueue.operations[0].snapshot, retrySnapshot);
    const recoveredService = criarServicoSincronizacao({ clientProvider: async () => makeServiceRpcClient(a), repository: retryQueue.repository });
    const secondAttempt = await recoveredService.sincronizar();
    assert.equal(secondAttempt.saved, 1);
    assert.equal(retryQueue.operations[0].status, "completed");
    assert.equal(retryQueue.operations[0].operationId, retryOperation.operationId);
    assert.equal((await readNativas(a, retryLocalId))[0].revision, 1);
    console.log("SYNC-SERVICE RETRY PASS: falha local de transporte preservou UUID/snapshot; ação seguinte enviou a mesma operação à RPC real.");

    const raceFicha = ficha(ids.race, "Corrida base", "base");
    const raceCreate = await rpc(a, "save_nativa", { p_operation_id: randomUUID(), p_local_id: ids.race, p_format_version: 1, p_data: raceFicha, p_expected_revision: null });
    assert.equal(raceCreate.data.status, "saved");
    const competingArgs = ["one", "two"].map(mark => ({ p_operation_id: randomUUID(), p_local_id: ids.race, p_format_version: 1, p_data: ficha(ids.race, `Concorrente ${mark}`, mark), p_expected_revision: 1 }));
    const competing = await Promise.all(competingArgs.map(args => rpc(a, "save_nativa", args)));
    assert(competing.every(result => result.response.status === 200));
    assert.deepEqual(competing.map(result => result.data.status).sort(), ["conflict", "saved"]);
    const raceRows = await readNativas(a, ids.race);
    assert.equal(raceRows.length, 1);
    assert.equal(raceRows[0].revision, 2);
    console.log("CONCORRÊNCIA PASS: duas chamadas HTTP simultâneas; exatamente um saved, um conflict e revisão final 2.");

    const bData = ficha(ids.main, "Ficha da conta B", "b");
    const bCreate = await rpc(b, "save_nativa", { p_operation_id: randomUUID(), p_local_id: ids.main, p_format_version: 1, p_data: bData, p_expected_revision: null });
    assert.equal(bCreate.response.status, 200);
    assert.equal(bCreate.data.status, "saved");
    assert.notEqual(bCreate.data.remote_id, create.data.remote_id, "Cada proprietário deve ter seu próprio registro remoto.");
    assert.equal((await readNativas(b, ids.main)).length, 1);
    assert.equal((await readNativas(a, ids.main)).length, 1);
    assert.equal((await readNativas(b, ids.race)).length, 0);
    const bWrongUpdate = await rpc(b, "save_nativa", { p_operation_id: randomUUID(), p_local_id: ids.race, p_format_version: 1, p_data: ficha(ids.race, "Tentativa B sobre A", "forbidden"), p_expected_revision: 1 });
    assert.equal(bWrongUpdate.response.status, 200);
    assert.equal(bWrongUpdate.data.status, "not_found");
    const bWrongDelete = await rpc(b, "delete_nativa", { p_operation_id: randomUUID(), p_local_id: ids.race, p_expected_revision: 1 });
    assert.equal(bWrongDelete.response.status, 200);
    assert.equal(bWrongDelete.data.status, "not_found");
    const restPatch = await request(`/rest/v1/nativas?local_id=eq.${encodeURIComponent(ids.race)}`, {
      method: "PATCH", token: b.accessToken, body: { data: ficha(ids.race, "REST B forbidden", "forbidden") }, prefer: "return=representation"
    });
    assert(!restPatch.response.ok || (Array.isArray(restPatch.data) && restPatch.data.length === 0));
    assert.equal((await readNativas(a, ids.race))[0].owner_id, a.userId);
    console.log("ISOLAMENTO PASS: Conta B não leu ficha de A; RPCs sob JWT B retornaram not_found; escrita REST não alterou linha de A.");

    const deletedData = ficha(ids.deleted, "Nativa tombstone", "before-delete");
    const deletedCreate = await rpc(a, "save_nativa", { p_operation_id: randomUUID(), p_local_id: ids.deleted, p_format_version: 1, p_data: deletedData, p_expected_revision: null });
    assert.equal(deletedCreate.data.status, "saved");
    const deletionId = randomUUID();
    const deletionArgs = { p_operation_id: deletionId, p_local_id: ids.deleted, p_expected_revision: 1 };
    const deletion = await rpc(a, "delete_nativa", deletionArgs);
    assert.equal(deletion.response.status, 200);
    assert.equal(deletion.data.status, "deleted");
    assert.equal(deletion.data.revision, 2);
    const deleteReplay = await rpc(a, "delete_nativa", deletionArgs);
    assert.deepEqual(deleteReplay.data, deletion.data);
    const staleSave = await rpc(a, "save_nativa", { p_operation_id: randomUUID(), p_local_id: ids.deleted, p_format_version: 1, p_data: { ...deletedData, nome: "Tentativa de ressurreição" }, p_expected_revision: 1 });
    assert.equal(staleSave.data.status, "deleted");
    const deletedRows = await readNativas(a, ids.deleted);
    assert.equal(deletedRows.length, 0, "RLS deve ocultar tombstone em consulta normal.");
    const pgOutput = docker(["exec", DB_CONTAINER, "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-Atc", `select owner_id||'|'||local_id||'|'||revision||'|'||(deleted_at is not null)::text from public.nativas where owner_id='${a.userId}' and local_id='${ids.deleted}';`]);
    assert.equal(pgOutput, `${a.userId}|${ids.deleted}|2|true`);
    const oldSaveReplay = await rpc(a, "save_nativa", { p_operation_id: randomUUID(), p_local_id: ids.deleted, p_format_version: 1, p_data: deletedData, p_expected_revision: null });
    assert.equal(oldSaveReplay.data.status, "deleted");
    assert.equal(docker(["exec", DB_CONTAINER, "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-Atc", `select revision||'|'||(deleted_at is not null)::text from public.nativas where owner_id='${a.userId}' and local_id='${ids.deleted}';`]), "2|true");
    console.log("DELETE PASS: RPC criou tombstone revisão 2; retry idempotente; saves atrasados não ressuscitaram ficha.");

    const names = [...new Set(rpcCalls.map(call => call.name))].sort();
    assert.deepEqual(names, ["delete_nativa", "save_nativa"]);
    console.log(`RPCs reais chamadas: ${names.join(", ")}. Todos os tokens vieram de Auth local; nenhum service_role foi usado.`);
    console.log("RESULT: LOCAL_RPC_INTEGRATION_PASS");
  } finally {
    await deleteDisposableUsers();
  }
}

main().catch(error => {
  console.error(`LOCAL RPC INTEGRATION FAILED: ${error?.message || error}`);
  process.exitCode = 1;
});
