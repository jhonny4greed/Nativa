import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { criarRepositorioLocal } from "../js/repository.js";

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function criarIndexedDBFalso() {
  const databases = new Map();
  class FakeDatabase {
    constructor(state) {
      this.state = state;
      this.objectStoreNames = { contains: name => state.stores.has(name) };
    }
    createObjectStore(name, options = {}) {
      this.state.stores.set(name, new Map());
      this.state.keyPaths.set(name, options.keyPath || null);
      return {};
    }
    transaction(name, mode) {
      if (!this.state.stores.has(name)) throw new Error("Object store ausente: " + name);
      return new FakeTransaction(this.state, name, mode);
    }
    close() {}
  }
  class FakeTransaction {
    constructor(state, name, mode) {
      this.state = state; this.name = name; this.mode = mode;
      const current = state.stores.get(name);
      this.values = mode === "readwrite"
        ? new Map([...current.entries()].map(([key, value]) => [key, clone(value)]))
        : current;
      this.pending = 0; this.aborted = false; this.completed = false;
    }
    objectStore(name) {
      const values = this.values;
      const keyPath = this.state.keyPaths.get(name);
      const request = action => {
        const result = { result: undefined, error: null, onsuccess: null, onerror: null };
        this.pending++;
        setTimeout(() => {
          if (!this.aborted) {
            try { result.result = action(values, keyPath); result.onsuccess?.({ target: result }); }
            catch (error) { result.error = error; result.onerror?.({ target: result }); this.abort(error); }
          }
          this.pending--; this.completeWhenIdle();
        }, 0);
        return result;
      };
      return {
        get: key => request(store => clone(store.get(key))),
        put: (value, explicitKey) => request(store => {
          if (this.mode !== "readwrite") throw new Error("Transação somente leitura.");
          if (this.state.failNextPut) { this.state.failNextPut = false; throw new Error("Falha simulada ao persistir IndexedDB."); }
          const copy = clone(value); const storeKey = keyPath ? copy[keyPath] : explicitKey;
          store.set(storeKey, copy); return storeKey;
        }),
        delete: key => request(store => {
          if (this.mode !== "readwrite") throw new Error("Transação somente leitura.");
          store.delete(key);
        })
      };
    }
    abort(error = null) {
      if (this.aborted || this.completed) return;
      this.aborted = true; this.error = error;
      setTimeout(() => this.onabort?.({ target: this }), 0);
    }
    completeWhenIdle() {
      if (this.pending !== 0 || this.aborted || this.completed) return;
      setTimeout(() => {
        if (this.pending !== 0 || this.aborted || this.completed) return;
        this.completed = true;
        if (this.mode === "readwrite") this.state.stores.set(this.name, this.values);
        this.oncomplete?.({ target: this });
      }, 0);
    }
  }
  return {
    failNextPut(name) { const state = databases.get(name); if (state) state.failNextPut = true; },
    open(name, version) {
      const req = { result: null, error: null, onupgradeneeded: null, onsuccess: null, onerror: null };
      setTimeout(() => {
        let state = databases.get(name);
        const needsUpgrade = !state || version > state.version;
        if (!state) { state = { version, stores: new Map(), keyPaths: new Map() }; databases.set(name, state); }
        req.result = new FakeDatabase(state);
        if (needsUpgrade) req.onupgradeneeded?.({ target: req });
        setTimeout(() => req.onsuccess?.({ target: req }), 0);
      }, 0);
      return req;
    }
  };
}

function criarStorageFalso(inicial = {}) {
  const valores = new Map(Object.entries(inicial));
  return {
    getItem: key => valores.has(key) ? valores.get(key) : null,
    setItem: (key, value) => valores.set(key, String(value)),
    removeItem: key => valores.delete(key),
    valores
  };
}

function criarAmbiente({ userId = "account-a", indexedDBApi = criarIndexedDBFalso(), storage = criarStorageFalso() } = {}) {
  let sessaoAtual = userId;
  const repo = criarRepositorioLocal({ storage, indexedDBApi, getAuthenticatedUserId: async () => sessaoAtual });
  return {
    repo, storage, indexedDBApi,
    entrarComo: id => { sessaoAtual = id; },
    sessao: () => sessaoAtual,
    salvarFichas: fichas => repo.salvarNativas(fichas),
    fichas: () => repo.obterNativas()
  };
}

function ficha(id, name = "Aruã", extra = {}) {
  return { id, name, attrs: { ATQ: 2 }, techniques: ["tech-one"], essencias: [], photoId: "photo-" + id,
    unknownLegacyField: { preserved: true }, ...extra };
}

function request(localId, name, expectedRevision = null) {
  return { p_local_id: localId, p_format_version: 1, p_data: ficha(localId, name), p_expected_revision: expectedRevision };
}

async function adicionarFicha(env, nativa, origin = "player") {
  await env.salvarFichas([...(await env.fichas()), nativa]);
  await env.repo.registrarOrigemNativa(nativa.id, origin);
}

async function associar(env, nativa) {
  await adicionarFicha(env, nativa);
  return env.repo.associarNativaAConta(nativa);
}

test("fichas e metadados legados permanecem intactos e fila persiste entre instâncias", async () => {
  const indexedDBApi = criarIndexedDBFalso();
  const original = ficha("legacy-1");
  const storage = criarStorageFalso({ "nativa.prototype.v1": JSON.stringify([original]), "nativa.prototype.presets.v1": "1" });
  const env = criarAmbiente({ indexedDBApi, storage });
  await env.repo.registrarOrigemNativa("legacy-1", "player");
  const associado = await env.repo.associarNativaAConta(original);
  const reopened = criarRepositorioLocal({ indexedDBApi, storage, getAuthenticatedUserId: async () => "account-a" });
  assert.equal((await reopened.listarOperacoesPendentes("legacy-1"))[0].operationId, associado.operation.operationId);
  assert.deepEqual(JSON.parse(storage.getItem("nativa.prototype.v1")), [original]);
  assert.equal(storage.getItem("nativa.prototype.presets.v1"), "1");
});

test("criação normal fica local e não associa nem enfileira automaticamente", async () => {
  const env = criarAmbiente();
  await adicionarFicha(env, ficha("created"), "player");
  assert.deepEqual(await env.repo.listarOperacoesPendentes(), []);
  assert.equal((await env.repo.obterEstadosSincronizacao(["created"])).byLocalId.created.associationState, "unassociated");
});

test("associação explícita registra exatamente um snapshot save sem enviar", async () => {
  const env = criarAmbiente();
  const n = ficha("associate-1", "Inicial", { unknownExtra: ["keep"] });
  const result = await associar(env, n);
  assert.equal(result.association.userId, "account-a");
  assert.equal(result.operation.type, "save");
  assert.equal(result.operation.request.p_data.id, "associate-1");
  assert.deepEqual(result.operation.request.p_data.unknownExtra, ["keep"]);
  assert.equal(result.operation.sequence, 1);
  assert.equal(result.operation.status, "pending");
  assert.equal((await env.repo.listarOperacoesPendentes("associate-1")).length, 1);
  assert.equal((await env.repo.podeEditarNativa("associate-1")).allowed, true);
});

test("associar sem sessão é recusado sem vínculo ou operação parcial", async () => {
  const env = criarAmbiente({ userId: null });
  const n = ficha("association-no-session");
  await adicionarFicha(env, n);
  await assert.rejects(env.repo.associarNativaAConta(n), /Entre na sua conta/);
  assert.equal((await env.repo.obterEstadosSincronizacao([n.id])).byLocalId[n.id].associationState, "unassociated");
  assert.deepEqual(await env.repo.listarOperacoesPendentes(), []);
});

test("ficha antiga sem id recebe UUID local estável somente durante preparação explícita", async () => {
  const env = criarAmbiente();
  const legacy = { name: "Legada sem ID", attrs: { ATQ: 1 }, unknown: { keep: true } };
  await env.salvarFichas([legacy]);
  assert.equal((await env.repo.listarOperacoesPendentes()).length, 0);
  const prepared = { ...legacy, id: crypto.randomUUID() };
  await env.salvarFichas([prepared]);
  const result = await env.repo.associarNativaAConta(prepared);
  assert.equal((await env.fichas())[0].id, prepared.id);
  assert.deepEqual(result.operation.snapshot.unknown, { keep: true });
  assert.equal(result.operation.localId, prepared.id);
});

test("falha ao persistir associação não deixa vínculo ou save parcial", async () => {
  const indexedDBApi = criarIndexedDBFalso();
  const env = criarAmbiente({ indexedDBApi });
  const n = ficha("association-rollback");
  await adicionarFicha(env, n);
  indexedDBApi.failNextPut("nativa.prototype.sync");
  await assert.rejects(env.repo.associarNativaAConta(n), /Falha simulada/);
  assert.equal((await env.repo.obterEstadosSincronizacao([n.id])).byLocalId[n.id].associationState, "unassociated");
  assert.deepEqual(await env.repo.listarOperacoesPendentes(), []);
});

test("falha ao registrar tombstone deixa a ficha local e sem exclusão parcial", async () => {
  const indexedDBApi = criarIndexedDBFalso();
  const env = criarAmbiente({ indexedDBApi });
  const n = ficha("delete-rollback");
  await adicionarFicha(env, n);
  indexedDBApi.failNextPut("nativa.prototype.sync");
  await assert.rejects(env.repo.registrarExclusaoLocal({
    operationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", localId: n.id, snapshot: n
  }), /Falha simulada/);
  assert.deepEqual((await env.fichas()), [n]);
  assert.equal(await env.repo.obterTombstoneLocal(n.id), null);
  assert.deepEqual(await env.repo.listarOperacoesPendentes(), []);
});

test("presets são identificados por origem explícita e nunca são associados", async () => {
  const env = criarAmbiente();
  const preset = ficha("id-com-prefixo-de-preset");
  await adicionarFicha(env, preset, "preset");
  await assert.rejects(env.repo.associarNativaAConta(preset), /Presets não podem/);
  assert.deepEqual(await env.repo.listarOperacoesPendentes(), []);
  const player = ficha("preset-named-player");
  await adicionarFicha(env, player, "player");
  assert.equal((await env.repo.associarNativaAConta(player)).operation.type, "save");
});

test("edições geram snapshots novos imutáveis e preservam ordem/dependência", async () => {
  const env = criarAmbiente();
  const n = ficha("edits");
  const first = await associar(env, n);
  const secondSnapshot = ficha("edits", "Versão 2", { attrs: { ATQ: 3 } });
  await env.salvarFichas([secondSnapshot]);
  const second = await env.repo.enfileirarSaveSeAssociada(secondSnapshot);
  const thirdSnapshot = ficha("edits", "Versão 3", { attrs: { ATQ: 4 } });
  await env.salvarFichas([thirdSnapshot]);
  const third = await env.repo.enfileirarSaveSeAssociada(thirdSnapshot);
  const queue = await env.repo.listarOperacoesPendentes("edits");
  assert.deepEqual(queue.map(x => x.sequence), [1, 2, 3]);
  assert.equal(queue[0].snapshot.name, "Aruã");
  assert.equal(queue[1].snapshot.name, "Versão 2");
  assert.equal(queue[2].snapshot.name, "Versão 3");
  assert.equal(queue[1].dependsOn, first.operation.operationId);
  assert.equal(queue[2].dependsOn, second.operation.operationId);
  assert.equal(queue[1].expectedRevision, null);
  assert.equal(queue[1].revisionStrategy, "after-dependency");
  assert.equal(third.status, "blocked");
});

test("repetir save idêntico não duplica a operação", async () => {
  const env = criarAmbiente();
  const n = ficha("dedupe");
  await associar(env, n);
  const a = await env.repo.enfileirarSaveSeAssociada(n);
  const b = await env.repo.enfileirarSaveSeAssociada(n);
  assert.equal(a.status, "unchanged");
  assert.equal(b.status, "unchanged");
  assert.equal((await env.repo.listarOperacoesPendentes("dedupe")).length, 1);
});

test("UUID de save repetido com conteúdo diferente é recusado", async () => {
  const env = criarAmbiente();
  const n = ficha("op-id");
  await associar(env, n);
  const opId = "55555555-5555-4555-8555-555555555555";
  const first = await env.repo.registrarOperacaoPendente({ operationId: opId, localId: n.id, type: "save", request: request(n.id, "Save 1") });
  const retry = await env.repo.registrarOperacaoPendente({ operationId: opId, localId: n.id, type: "save", request: request(n.id, "Save 1") });
  assert.equal(retry.operationId, first.operationId);
  await assert.rejects(env.repo.registrarOperacaoPendente({
    operationId: opId, localId: n.id, type: "save", request: request(n.id, "Conteúdo diferente")
  }), /conteúdo diferente/);
});

test("conta vem da sessão autenticada e argumento userId arbitrário não tem autoridade", async () => {
  const env = criarAmbiente();
  const n = ficha("identity");
  await associar(env, n);
  const operation = await env.repo.registrarOperacaoPendente({
    operationId: "66666666-6666-4666-8666-666666666666", userId: "forged-user", localId: n.id,
    type: "save", request: request(n.id, "Da sessão")
  });
  assert.equal(operation.userId, "account-a");
  assert.equal((await env.repo.obterMetadadosSincronizacao(n.id)).userId, "account-a");
});

test("sem sessão novas fichas continuam editáveis offline sem associação", async () => {
  const env = criarAmbiente({ userId: null });
  const n = ficha("offline");
  await adicionarFicha(env, n);
  const permitted = await env.repo.podeEditarNativa(n.id);
  assert.equal(permitted.allowed, true);
  await env.salvarFichas([ficha("offline", "Editada offline")]);
  assert.equal((await env.repo.enfileirarSaveSeAssociada(ficha("offline", "Editada offline"))).status, "unassociated");
  assert.deepEqual(await env.repo.listarOperacoesPendentes(), []);
  assert.equal((await env.fichas())[0].name, "Editada offline");
});

test("contas A-B-A não compartilham nem transferem operação ou permissão", async () => {
  const env = criarAmbiente();
  const n = ficha("account-switch");
  const original = await associar(env, n);
  const localOnly = ficha("not-associated");
  await adicionarFicha(env, localOnly);
  const edited = ficha("account-switch", "Conta A editou");
  await env.salvarFichas([...(await env.fichas()).filter(item => item.id !== n.id), edited]);
  const pending = await env.repo.enfileirarSaveSeAssociada(edited);
  env.entrarComo("account-b");
  assert.deepEqual(await env.repo.listarOperacoesPendentes(), []);
  assert.deepEqual(await env.repo.obterMetadadosSincronizacao(n.id), null);
  assert.equal((await env.repo.podeEditarNativa(n.id)).allowed, false);
  const otherAccountState = await env.repo.obterEstadosSincronizacao([n.id]);
  assert.equal(otherAccountState.byLocalId[n.id].associationState, "other-account");
  assert.equal(otherAccountState.byLocalId[n.id].queueCount, 0);
  assert.equal((await env.repo.podeEditarNativa(localOnly.id)).allowed, true);
  assert.equal((await env.repo.enfileirarSaveSeAssociada(localOnly)).status, "unassociated");
  env.entrarComo(null);
  assert.deepEqual(await env.repo.listarOperacoesPendentes(), []);
  assert.deepEqual(await env.repo.obterMetadadosSincronizacao(n.id), null);
  assert.equal((await env.repo.podeEditarNativa(n.id)).allowed, false);
  env.entrarComo("account-b");
  await assert.rejects(env.repo.enfileirarSaveSeAssociada(edited), /outra conta/);
  await assert.rejects(env.repo.associarNativaAConta(edited), /outra conta/);
  const accountBFicha = ficha("account-b-local");
  const accountBInitial = await associar(env, accountBFicha);
  assert.equal(accountBInitial.association.userId, "account-b");
  env.entrarComo("account-a");
  const returned = await env.repo.listarOperacoesPendentes(n.id);
  assert.equal(returned.length, 2);
  assert.equal(returned[0].operationId, original.operation.operationId);
  assert.equal(returned[1].operationId, pending.operation.operationId);
  assert.equal(returned[1].snapshot.name, "Conta A editou");
});

test("exclusão após vários saves preserva snapshots, IDs, sequência e bloqueia novos saves", async () => {
  const env = criarAmbiente();
  const n = ficha("delete-after-saves");
  await associar(env, n);
  const firstEdit = ficha(n.id, "Save editado 1");
  await env.salvarFichas([firstEdit]); await env.repo.enfileirarSaveSeAssociada(firstEdit);
  const secondEdit = ficha(n.id, "Save editado 2");
  await env.salvarFichas([secondEdit]); await env.repo.enfileirarSaveSeAssociada(secondEdit);
  await env.repo.salvarMetadadosSincronizacao(n.id, { remoteId: "remote-id", remoteRevision: 5 });
  const deleteId = "77777777-7777-4777-8777-777777777777";
  const deletion = await env.repo.registrarExclusaoLocal({ operationId: deleteId, localId: n.id, snapshot: secondEdit });
  assert.equal(deletion.operation.sequence, 4);
  assert.equal(deletion.operation.dependsOn, (await env.repo.listarOperacoesPendentes(n.id))[2].operationId);
  assert.equal(deletion.operation.expectedRevision, null);
  assert.equal(deletion.operation.status, "blocked");
  const queue = await env.repo.listarOperacoesPendentes(n.id);
  assert.deepEqual(queue.map(x => x.type), ["save", "save", "save", "delete"]);
  assert.deepEqual(queue.slice(0, 3).map(x => x.snapshot.name), ["Aruã", "Save editado 1", "Save editado 2"]);
  await assert.rejects(env.repo.enfileirarSaveSeAssociada(ficha(n.id, "Ressurreição")), /excluída/);
  assert.equal((await env.repo.obterTombstoneDaConta(n.id)).snapshot.name, "Save editado 2");
});

test("tombstone da conta A não impede outra ficha local da conta B", async () => {
  const env = criarAmbiente();
  const fichaA = ficha("account-a-deleted");
  await associar(env, fichaA);
  await env.repo.registrarExclusaoLocal({
    operationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", localId: fichaA.id, snapshot: fichaA
  });
  env.entrarComo("account-b");
  const fichaB = ficha("account-b-independent");
  const result = await associar(env, fichaB);
  assert.equal(result.association.userId, "account-b");
  assert.equal((await env.repo.listarOperacoesPendentes(fichaB.id)).length, 1);
  assert.equal((await env.repo.podeEditarNativa(fichaA.id)).allowed, false);
});

test("tombstone global de recuperação sem conta não bloqueia associação explícita", async () => {
  const env = criarAmbiente();
  const n = ficha("global-recovery-tombstone");
  await adicionarFicha(env, n);
  await env.repo.registrarTombstoneLocal(n.id, n);
  const result = await env.repo.associarNativaAConta(n);
  assert.equal(result.association.userId, "account-a");
  assert.equal(result.operation.type, "save");
});

test("exclusão é idempotente para o mesmo UUID e recusa reutilização com outro conteúdo", async () => {
  const env = criarAmbiente();
  const n = ficha("delete-idempotency");
  const initial = await associar(env, n);
  const opId = "88888888-8888-4888-8888-888888888888";
  const input = { operationId: opId, localId: n.id, snapshot: n };
  await assert.rejects(env.repo.registrarExclusaoLocal({ ...input, operationId: initial.operation.operationId }), /operation_id.*conteúdo diferente/);
  const first = await env.repo.registrarExclusaoLocal(input);
  const retry = await env.repo.registrarExclusaoLocal(input);
  assert.equal(retry.operation.operationId, first.operation.operationId);
  assert.equal((await env.repo.listarOperacoesPendentes(n.id)).filter(x => x.type === "delete").length, 1);
  await assert.rejects(env.repo.registrarExclusaoLocal({ ...input, snapshot: ficha(n.id, "Outro snapshot") }), /snapshot|conteúdo diferente/);
});

test("ficha nunca associada recebe apenas tombstone recuperável sem operação remota", async () => {
  const env = criarAmbiente();
  const n = ficha("local-delete", "Somente local");
  await adicionarFicha(env, n);
  const result = await env.repo.registrarExclusaoLocal({ operationId: "99999999-9999-4999-8999-999999999999", localId: n.id, snapshot: n });
  assert.equal(result.status, "local-only");
  assert.equal(result.operation, null);
  assert.deepEqual(await env.repo.listarOperacoesPendentes(), []);
  assert.deepEqual((await env.repo.obterTombstoneLocal(n.id)).snapshot, n);
  assert.equal((await env.repo.podeEditarNativa(n.id)).allowed, false);
  assert.equal((await env.repo.enfileirarSaveSeAssociada(n)).status, "unassociated");
  await assert.rejects(env.repo.associarNativaAConta(n), /tombstone/);
  env.entrarComo("account-b");
  assert.equal((await env.repo.podeEditarNativa(n.id)).allowed, true);
  assert.equal((await env.repo.associarNativaAConta(n)).association.userId, "account-b");
});

test("ficha legada sem id recebe tombstone local sem alterar identidade ou objeto original", async () => {
  const env = criarAmbiente();
  const oldFicha = { name: "Sem ID", attrs: { ATQ: 1 }, extension: "preservada" };
  await env.salvarFichas([oldFicha]);
  const first = await env.repo.registrarExclusaoLocal({ localId: "delete-key-a", snapshot: oldFicha });
  const retry = await env.repo.registrarExclusaoLocal({ localId: "delete-key-b", snapshot: oldFicha });
  assert.deepEqual(first.tombstone.snapshot, oldFicha);
  assert.deepEqual(retry.tombstone.snapshot, oldFicha);
  assert.equal(Object.hasOwn((await env.fichas())[0], "id"), false);
  assert.deepEqual(await env.repo.listarOperacoesPendentes(), []);
});

test("foto permanece no IndexedDB local ao preparar save e tombstone", async () => {
  const env = criarAmbiente();
  const image = new Blob(["local-photo"], { type: "image/png" });
  await env.repo.guardarFoto("photo-with-ficha", image);
  const n = ficha("photo-ficha", "Com foto", { photoId: "photo-with-ficha" });
  await associar(env, n);
  const queued = await env.repo.listarOperacoesPendentes(n.id);
  assert.equal(queued[0].request.p_data.photoId, "photo-with-ficha");
  assert.equal(Object.hasOwn(queued[0].request.p_data, "blob"), false);
  await env.repo.registrarExclusaoLocal({ operationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", localId: n.id, snapshot: n });
  const stored = await env.repo.obterFoto("photo-with-ficha");
  assert.equal(stored.type, "image/png");
  assert.equal(await stored.text(), "local-photo");
  assert.equal((await env.repo.obterTombstoneLocal(n.id)).snapshot.photoId, "photo-with-ficha");
});

test("IDs locais inválidos ou duplicados bloqueiam associação sem alterar fichas", async () => {
  const env = criarAmbiente();
  const duplicate = ficha("duplicate");
  await adicionarFicha(env, duplicate);
  await env.salvarFichas([duplicate, ficha("duplicate", "Duplicada")]);
  await assert.rejects(env.repo.associarNativaAConta(duplicate), /ausente ou duplicada/);
  const invalid = { ...ficha(""), id: "" };
  await env.salvarFichas([invalid]);
  await assert.rejects(env.repo.associarNativaAConta(invalid), /local_id é obrigatório/);
});

test("origem preset explícita não depende de prefixo e operações antigas desconhecidas não são inferidas", async () => {
  const env = criarAmbiente();
  const n = ficha("preset-custom");
  await adicionarFicha(env, n, "preset");
  const states = await env.repo.obterEstadosSincronizacao([n.id]);
  assert.equal(states.byLocalId[n.id].origin, "preset");
  assert.equal(states.byLocalId[n.id].canAssociate, false);
  assert.deepEqual(await env.repo.listarOperacoesPendentes(), []);
});

test("fluxo do app e repository não contêm chamadas de RPC ou envio direto", () => {
  const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  const repository = readFileSync(new URL("../js/repository.js", import.meta.url), "utf8");
  for (const source of [app, repository]) {
    assert.doesNotMatch(source, /\.rpc\s*\(/);
    assert.doesNotMatch(source, /\b(?:save_nativa|delete_nativa)\s*\(/);
    assert.doesNotMatch(source, /\bfetch\s*\(/);
  }
});

test("operações públicas do repositório retornam Promise inclusive quando argumentos falham", async () => {
  const repo = criarRepositorioLocal({ storage: criarStorageFalso(), indexedDBApi: criarIndexedDBFalso(), getAuthenticatedUserId: async () => null });
  const chamadas = [
    () => repo.obterNativas(), () => repo.listarNativas(), () => repo.buscarNativaPorId("x"),
    () => repo.salvarNativas([]), () => repo.salvarNativa(ficha("x")), () => repo.excluirNativa("x"),
    () => repo.consultarEstadoPersistencia(), () => repo.salvarNativasComFila([]), () => repo.salvarNativaComFila(ficha("x")),
    () => repo.presetsJaCarregados(), () => repo.marcarPresetsCarregados(),
    () => repo.guardarFoto("x", new Blob()), () => repo.obterFoto("x"), () => repo.removerFoto("x"),
    () => repo.registrarOrigemNativa("", "invalida"), () => repo.obterOrigemNativa("x"),
    () => repo.obterMetadadosSincronizacao("x"), () => repo.salvarMetadadosSincronizacao("x", {}),
    () => repo.registrarTombstoneLocal("x", ficha("x")), () => repo.obterTombstoneLocal("x"),
    () => repo.obterTombstoneDaConta("x", "x"), () => repo.registrarExclusaoLocal({ localId: "x", snapshot: ficha("x") }),
    () => repo.registrarOperacaoPendente({ operationId: "x", localId: "x" }),
    () => repo.listarOperacoesPendentes(), () => repo.associarNativaAConta(ficha("x")),
    () => repo.enfileirarSaveSeAssociada(ficha("x")), () => repo.podeEditarNativa("x"),
    () => repo.obterEstadosSincronizacao(["x"])
  ];
  const promises = chamadas.map(chamada => {
    const result = chamada();
    assert.ok(result instanceof Promise);
    return result.catch(() => undefined);
  });
  await Promise.all(promises);
});

test("leitura, busca, criação, edição e exclusão usam o contrato assíncrono sem mudar o formato", async () => {
  const original = ficha("a", "A", { legacyUnknown: { keep: 1 } });
  const storage = criarStorageFalso({ "nativa.prototype.v1": JSON.stringify([original]) });
  const repo = criarRepositorioLocal({ storage, indexedDBApi: criarIndexedDBFalso() });
  assert.deepEqual(await repo.listarNativas(), [original]);
  assert.equal((await repo.buscarNativaPorId("a")).name, "A");
  await repo.salvarNativa(ficha("b", "B", { customField: [1, 2] }));
  const editada = ficha("a", "Editada", { legacyUnknown: { keep: 1 }, newUnknown: "preservado" });
  await repo.salvarNativa(editada);
  assert.deepEqual(await repo.listarNativas(), [editada, ficha("b", "B", { customField: [1, 2] })]);
  assert.deepEqual(JSON.parse(storage.valores.get("nativa.prototype.v1")), await repo.listarNativas());
  assert.deepEqual(await repo.excluirNativa("b"), ficha("b", "B", { customField: [1, 2] }));
  assert.equal(await repo.buscarNativaPorId("b"), null);
});

test("gravações concorrentes preservam ordem de chamada e snapshots imutáveis", async () => {
  const storage = criarStorageFalso();
  const repo = criarRepositorioLocal({ storage, indexedDBApi: criarIndexedDBFalso() });
  const primeiro = [ficha("one", "Primeiro")];
  const segundo = [ficha("two", "Segundo", { unknown: { retained: true } })];
  const p1 = repo.salvarNativas(primeiro);
  const p2 = repo.salvarNativas(segundo);
  primeiro[0].name = "Mutado após chamar";
  await Promise.all([p1, p2]);
  assert.deepEqual(await repo.listarNativas(), segundo);
  assert.equal((await repo.listarNativas())[0].unknown.retained, true);
  const upsert = await repo.salvarNativa(ficha("three", "Terceiro"));
  assert.equal(upsert.name, "Terceiro");
  assert.deepEqual((await repo.listarNativas()).map(item => item.id), ["two", "three"]);
});

test("erro de localStorage é rejeitado sem sobrescrever a ficha previamente salva", async () => {
  const original = ficha("before", "Original");
  let valorArmazenado = JSON.stringify([original]);
  let falharGravacao = true;
  const storage = {
    getItem: key => key === "nativa.prototype.v1" ? valorArmazenado : null,
    setItem: (_key, value) => { if (falharGravacao) throw new Error("QuotaExceededError"); valorArmazenado = String(value); }
  };
  const repo = criarRepositorioLocal({ storage, indexedDBApi: criarIndexedDBFalso() });
  await assert.rejects(repo.salvarNativas([ficha("after")]), /QuotaExceededError/);
  assert.deepEqual(await repo.listarNativas(), [original]);
  falharGravacao = false;
  assert.deepEqual(await repo.consultarEstadoPersistencia(), { available: true, backend: "localStorage" });
});

test("gravação principal e fila são serializadas com snapshots imutáveis", async () => {
  const env = criarAmbiente();
  const n = ficha("common-async", "Inicial");
  await associar(env, n);
  const v2 = ficha("common-async", "Versão 2", { attrs: { ATQ: 3 } });
  const v3 = ficha("common-async", "Versão 3", { attrs: { ATQ: 4 } });
  const p2 = env.repo.salvarNativasComFila([v2], v2);
  const p3 = env.repo.salvarNativasComFila([v3], v3);
  const [r2, r3] = await Promise.all([p2, p3]);
  assert.equal(r2.persisted, true);
  assert.equal(r3.persisted, true);
  assert.equal(r2.queueError, null);
  assert.equal((await env.repo.listarNativas())[0].name, "Versão 3");
  const queue = await env.repo.listarOperacoesPendentes("common-async");
  assert.deepEqual(queue.map(item => item.snapshot.name), ["Inicial", "Versão 2", "Versão 3"]);
  assert.deepEqual(queue.map(item => item.sequence), [1, 2, 3]);
  const semSessao = criarAmbiente();
  await associar(semSessao, n);
  semSessao.entrarComo(null);
  const falhaFila = await semSessao.repo.salvarNativasComFila([v2], v2);
  assert.equal(falhaFila.persisted, true);
  assert.match(falhaFila.queueError.message, /sessão|associada/i);
  assert.equal((await semSessao.repo.listarNativas())[0].name, "Versão 2");
});

test("edições simultâneas de fichas diferentes não sobrescrevem a coleção umas das outras", async () => {
  const env = criarAmbiente();
  const a = ficha("parallel-a", "A inicial");
  const b = ficha("parallel-b", "B inicial");
  await env.salvarFichas([a, b]);
  await env.repo.registrarOrigemNativa(a.id, "player");
  await env.repo.registrarOrigemNativa(b.id, "player");
  await env.repo.associarNativaAConta(a);
  await env.repo.associarNativaAConta(b);
  const alteradaA = ficha(a.id, "A alterada", { marker: "a" });
  const alteradaB = ficha(b.id, "B alterada", { marker: "b" });
  const [resultA, resultB] = await Promise.all([
    env.repo.salvarNativaComFila(alteradaA),
    env.repo.salvarNativaComFila(alteradaB)
  ]);
  assert.equal(resultA.persisted, true);
  assert.equal(resultB.persisted, true);
  assert.deepEqual((await env.repo.listarNativas()).map(item => [item.id, item.name]).sort(), [
    [a.id, "A alterada"], [b.id, "B alterada"]
  ].sort());
  assert.deepEqual((await env.repo.listarOperacoesPendentes()).map(item => item.snapshot.marker).filter(Boolean).sort(), ["a", "b"]);
});

test("preparação usa conta autenticada e revisão somente após confirmação mantém snapshots antigos", async () => {
  const env = criarAmbiente();
  const original = ficha("sync-lifecycle", "Original");
  await associar(env, original);
  const first = (await env.repo.listarOperacoesPendentes(original.id))[0];
  const prepared = await env.repo.prepararOperacaoParaSincronizacao(first.operationId);
  assert.equal(prepared.request.p_expected_revision, null);
  assert.equal(prepared.operation.userId, "account-a");
  const remoteId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  await env.repo.concluirOperacaoSincronizacao(first.operationId, {
    status: "saved", local_id: original.id, remote_id: remoteId, revision: 1
  });
  const edited = ficha(original.id, "Editada", { attrs: { ATQ: 5 } });
  await env.repo.salvarNativaComFila(edited);
  const queue = (await env.repo.listarOperacoesSincronizacao()).filter(op => op.localId === original.id);
  assert.deepEqual(queue.map(op => op.sequence), [1, 2]);
  assert.deepEqual(queue.map(op => op.status), ["completed", "pending"]);
  const second = await env.repo.prepararOperacaoParaSincronizacao(queue[1].operationId);
  assert.equal(second.request.p_expected_revision, 1);
  assert.deepEqual(queue[0].request.p_data, original);
  assert.deepEqual(queue[1].request.p_data, edited);
  env.entrarComo("account-b");
  assert.deepEqual(await env.repo.listarOperacoesSincronizacao(), []);
  await assert.rejects(env.repo.prepararOperacaoParaSincronizacao(queue[1].operationId), /não pertence à sessão atual/i);
  env.entrarComo("account-a");
  await env.repo.concluirOperacaoSincronizacao(queue[1].operationId, {
    status: "saved", local_id: original.id, remote_id: remoteId, revision: 2
  });
  assert.equal((await env.repo.obterMetadadosSincronizacao(original.id)).remoteRevision, 2);
});

test("conflito mantém snapshots originais e cria operação nova com revisão remota", async () => {
  const env = criarAmbiente();
  const original = ficha("sync-conflict-keep", "Original");
  await associar(env, original);
  const edited = ficha(original.id, "Minha versão", { attrs: { ATQ: 7 }, unknownLegacyField: { retained: "yes" } });
  await env.repo.salvarNativaComFila(edited);
  const before = await env.repo.listarOperacoesPendentes(original.id);
  const originalPayload = clone(before[0].request);
  const originalSnapshot = clone(before[0].snapshot);
  const conflict = await env.repo.registrarConflitoOperacaoSincronizacao(before[0].operationId, {
    status: "conflict", local_id: original.id, remote_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    revision: 8, format_version: 1, data: ficha(original.id, "Versão remota")
  });
  assert.equal(conflict.localSnapshot.name, "Minha versão");
  const resolution = await env.repo.resolverConflitoManterLocal(conflict.conflictId);
  assert.equal(resolution.operation.operationId === before[0].operationId, false);
  assert.equal(resolution.operation.request.p_expected_revision, 8);
  assert.deepEqual(resolution.operation.snapshot, edited);
  const all = await env.repo.listarOperacoesSincronizacao();
  assert.deepEqual(all.find(op => op.operationId === before[0].operationId).request, originalPayload);
  assert.deepEqual(all.find(op => op.operationId === before[0].operationId).snapshot, originalSnapshot);
  assert.equal(all.find(op => op.operationId === before[0].operationId).status, "superseded");
  assert.equal(all.find(op => op.operationId === before[1].operationId).status, "superseded");
  assert.equal((await env.repo.listarConflitosSincronizacao()).length, 0);
});

test("aceitar versão remota preserva versão local no conflito antes de substituir ficha ativa", async () => {
  const env = criarAmbiente();
  const local = ficha("sync-conflict-remote", "Local não enviada", { attrs: { ATQ: 9 } });
  await associar(env, local);
  const pending = (await env.repo.listarOperacoesPendentes(local.id))[0];
  const remote = ficha(local.id, "Versão remota", { attrs: { ATQ: 3 }, unknownRemoteField: [1, 2] });
  const conflict = await env.repo.registrarConflitoOperacaoSincronizacao(pending.operationId, {
    status: "conflict", local_id: local.id, remote_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    revision: 5, format_version: 1, data: remote
  });
  await env.repo.resolverConflitoAceitarRemoto(conflict.conflictId);
  assert.deepEqual(await env.repo.listarNativas(), [remote]);
  const closedConflict = (await env.repo.listarConflitosSincronizacao());
  assert.deepEqual(closedConflict, []);
  const all = await env.repo.listarOperacoesSincronizacao();
  assert.equal(all.find(op => op.operationId === pending.operationId).status, "superseded");
  const history = await env.repo.listarHistoricoConflitosSincronizacao();
  assert.equal(history.length, 1);
  assert.equal(history[0].localSnapshot.name, "Local não enviada");
  assert.equal(history[0].remoteSnapshot.name, "Versão remota");
});

test("not_found em save permite escolha explícita de recriação sem revisão presumida", async () => {
  const env = criarAmbiente();
  const local = ficha("sync-not-found", "Minha ficha preservada");
  await associar(env, local);
  const original = (await env.repo.listarOperacoesPendentes(local.id))[0];
  const originalRequest = clone(original.request);
  const conflict = await env.repo.registrarConflitoOperacaoSincronizacao(original.operationId, {
    status: "not_found", local_id: local.id
  });
  const resolution = await env.repo.resolverConflitoManterLocal(conflict.conflictId);
  assert.equal(resolution.operation.type, "save");
  assert.equal(resolution.operation.request.p_expected_revision, null);
  assert.deepEqual(resolution.operation.snapshot, local);
  const all = await env.repo.listarOperacoesSincronizacao();
  assert.deepEqual(all.find(op => op.operationId === original.operationId).request, originalRequest);
  assert.equal(all.find(op => op.operationId === original.operationId).status, "superseded");
  assert.equal((await env.repo.obterMetadadosSincronizacao(local.id)).remoteRevision, null);
});
