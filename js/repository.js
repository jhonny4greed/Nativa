// Adaptador local para os dados que hoje pertencem a este navegador.
// A API fica isolada para permitir adicionar outro adaptador futuramente,
// sem mudar o formato legado das fichas nem as chaves já utilizadas.
const CHAVE_DADOS = "nativa.prototype.v1";
const CHAVE_PRESETS = "nativa.prototype.presets.v1";
const DB_NOME = "nativa.prototype.photos";
const DB_STORE = "photos";
const DB_SYNC_NOME = "nativa.prototype.sync";
const DB_SYNC_STORE = "state";
const FORMAT_VERSION_FICHA = 1;

function clonarJson(valor) {
  return valor == null ? valor : JSON.parse(JSON.stringify(valor));
}

function estadoSyncVazio() {
  return { id: "root", origins: [], records: [], operations: [], tombstones: [], associations: [], accountTombstones: [], conflicts: [] };
}

function normalizarEstadoSync(state) {
  const vazio = estadoSyncVazio();
  return Object.assign(vazio, state || {}, {
    origins: Array.isArray(state?.origins) ? state.origins : [],
    records: Array.isArray(state?.records) ? state.records : [],
    operations: Array.isArray(state?.operations) ? state.operations : [],
    tombstones: Array.isArray(state?.tombstones) ? state.tombstones : [],
    associations: Array.isArray(state?.associations) ? state.associations : [],
    accountTombstones: Array.isArray(state?.accountTombstones) ? state.accountTombstones : [],
    conflicts: Array.isArray(state?.conflicts) ? state.conflicts : []
  });
}

function abrirDBSync(indexedDBApi) {
  return new Promise((resolve, reject) => {
    if (!indexedDBApi) {
      reject(new Error("IndexedDB indisponível para metadados de sincronização."));
      return;
    }
    const req = indexedDBApi.open(DB_SYNC_NOME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(DB_SYNC_STORE)) {
        req.result.createObjectStore(DB_SYNC_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Não foi possível abrir o armazenamento de sincronização."));
    req.onblocked = () => reject(new Error("O armazenamento de sincronização está bloqueado por outra aba."));
  });
}

function validarIdentificador(valor, campo) {
  if (typeof valor !== "string" || !valor.trim()) {
    throw new TypeError(`${campo} é obrigatório.`);
  }
  return valor;
}

async function obterUsuarioAutenticado() {
  try {
    const sessao = obterClienteSupabase().then(async client => {
      const { data, error } = await client.auth.getSession();
      if (error) return null;
      const userId = data?.session?.user?.id;
      return typeof userId === "string" && userId ? userId : null;
    });
    let timer;
    const limiteOffline = new Promise(resolve => { timer = setTimeout(() => resolve(null), 500); });
    try { return await Promise.race([sessao, limiteOffline]); }
    finally { clearTimeout(timer); }
  } catch {
    // Login indisponível (inclusive offline) nunca bloqueia o armazenamento local.
    return null;
  }
}

export function criarRepositorioLocal({ storage = globalThis.localStorage, indexedDBApi = globalThis.indexedDB, getAuthenticatedUserId = obterUsuarioAutenticado } = {}) {
  let filaPersistenciaLocal = Promise.resolve();

  function serializarPersistenciaLocal(operacao) {
    const resultado = filaPersistenciaLocal.then(operacao);
    filaPersistenciaLocal = resultado.catch(() => undefined);
    return resultado;
  }

  function lerNativasArmazenadas() {
    try {
      const dados = JSON.parse(storage.getItem(CHAVE_DADOS) || "[]");
      return Array.isArray(dados) ? dados : [];
    } catch (error) {
      if (error instanceof SyntaxError) return [];
      throw error;
    }
  }

  function gravarNativasArmazenadas(nativas) {
    storage.setItem(CHAVE_DADOS, JSON.stringify(nativas));
  }

  async function lerEstadoSync() {
    const db = await abrirDBSync(indexedDBApi);
    return new Promise((resolve, reject) => {
      let estado = estadoSyncVazio();
      let falha = null;
      const tx = db.transaction(DB_SYNC_STORE, "readonly");
      const req = tx.objectStore(DB_SYNC_STORE).get("root");
      req.onsuccess = () => { if (req.result) estado = normalizarEstadoSync(req.result); };
      req.onerror = () => { falha = req.error; };
      tx.oncomplete = () => { db.close(); falha ? reject(falha) : resolve(estado); };
      tx.onerror = () => { falha = tx.error || new Error("Falha ao ler metadados de sincronização."); };
      tx.onabort = () => { db.close(); reject(falha || tx.error || new Error("Leitura de metadados foi cancelada.")); };
    });
  }

  async function atualizarEstadoSync(atualizar) {
    const db = await abrirDBSync(indexedDBApi);
    return new Promise((resolve, reject) => {
      let resultado;
      let falha = null;
      let tx;
      try {
        tx = db.transaction(DB_SYNC_STORE, "readwrite");
        const store = tx.objectStore(DB_SYNC_STORE);
        const req = store.get("root");
        req.onsuccess = () => {
          try {
            const atual = normalizarEstadoSync(req.result || estadoSyncVazio());
            const proximo = clonarJson(atual);
            resultado = atualizar(proximo);
            store.put(proximo);
          } catch (error) {
            falha = error;
            tx.abort();
          }
        };
        req.onerror = () => { falha = req.error; };
        tx.oncomplete = () => { db.close(); resolve(clonarJson(resultado)); };
        tx.onerror = () => { falha = falha || tx.error || new Error("Falha ao gravar metadados de sincronização."); };
        tx.onabort = () => { db.close(); reject(falha || tx.error || new Error("Gravação de metadados foi cancelada.")); };
      } catch (error) {
        db.close();
        reject(error);
      }
    });
  }

  function chaveContaNativa(userId, localId) {
    return JSON.stringify([userId, localId]);
  }

  function clonarEValidarFicha(localId, snapshot) {
    validarIdentificador(localId, "local_id");
    const copia = clonarJson(snapshot);
    if (!copia || typeof copia !== "object" || Array.isArray(copia)) {
      throw new TypeError("O snapshot da Nativa deve ser um objeto JSON.");
    }
    if (copia.id !== localId) {
      throw new TypeError("O id do snapshot precisa corresponder ao local_id.");
    }
    return copia;
  }

  async function registrarOrigemNativa(localId, origin) {
    validarIdentificador(localId, "local_id");
    if (!["preset", "player"].includes(origin)) throw new TypeError("Origem inválida.");
    return atualizarEstadoSync(estado => {
      const existente = estado.origins.find(item => item.localId === localId);
      if (existente && existente.origin !== origin) {
        throw new Error("A origem da Nativa já foi registrada e não pode ser trocada.");
      }
      if (!existente) estado.origins.push({ localId, origin, createdAt: new Date().toISOString() });
      return estado.origins.find(item => item.localId === localId);
    });
  }

  async function obterOrigemNativa(localId) {
    validarIdentificador(localId, "local_id");
    const estado = await lerEstadoSync();
    return clonarJson(estado.origins.find(item => item.localId === localId) || null);
  }

  function erroSync(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  function tombstoneAtivo(item) {
    return item && item.status !== "resolved-remote";
  }

  function obterRegistro(estado, userId, localId, criar = false) {
    const key = chaveContaNativa(userId, localId);
    let registro = estado.records.find(item => item.key === key);
    if (!registro && criar) {
      registro = {
        key, userId, localId, remoteId: null, remoteRevision: null,
        remoteFormatVersion: null, syncState: "local-only", nextSequence: 1,
        lastSyncedSnapshot: null, localConflictSnapshot: null, remoteConflictSnapshot: null
      };
      estado.records.push(registro);
    }
    return registro || null;
  }

  function proprietariosConhecidos(estado, localId) {
    const ids = new Set();
    const associacao = estado.associations.find(item => item.localId === localId);
    if (associacao?.userId) ids.add(associacao.userId);
    for (const item of [...estado.records, ...estado.operations, ...estado.accountTombstones]) {
      if (item.localId === localId && typeof item.userId === "string" && item.userId && item.userId !== "__unassigned__") ids.add(item.userId);
    }
    return [...ids];
  }

  function obterOperacoesDaFicha(estado, userId, localId) {
    return estado.operations
      .filter(item => item.userId === userId && item.localId === localId)
      .sort((a, b) => a.sequence - b.sequence);
  }

  function validarColecaoLocal(localId) {
    const correspondencias = lerNativasArmazenadas().filter(item => item?.id === localId);
    if (correspondencias.length !== 1) {
      throw erroSync("LOCAL_ID_AMBIGUOUS", "A identidade local está ausente ou duplicada. Resolva a ficha antes de prepará-la.");
    }
  }

  function criarOperacaoSave(estado, userId, localId, snapshot, { force = false } = {}) {
    const registro = obterRegistro(estado, userId, localId, true);
    const anteriores = obterOperacoesDaFicha(estado, userId, localId);
    const ultima = anteriores.at(-1) || null;
    const tombstoneConta = estado.accountTombstones.find(item => item.userId === userId && item.localId === localId && tombstoneAtivo(item))
      || estado.tombstones.find(item => item.userId === userId && item.localId === localId && tombstoneAtivo(item));
    if (tombstoneConta) throw erroSync("FICHA_DELETED", "Esta ficha foi excluída para a conta atual e não aceita novos saves.");

    const ultimoSave = [...anteriores].reverse().find(item => item.type === "save");
    if (!force && ultimoSave && ultimoSave.status !== "completed"
      && JSON.stringify(ultimoSave.snapshot) === JSON.stringify(snapshot)) {
      return { operation: clonarJson(ultimoSave), created: false, unchanged: true };
    }
    if (!force && registro.lastSyncedSnapshot
      && JSON.stringify(registro.lastSyncedSnapshot) === JSON.stringify(snapshot)
      && (!ultima || ultima.status === "completed")) {
      return { operation: null, created: false, unchanged: true };
    }
    if (ultima?.type === "delete") throw erroSync("FICHA_DELETED", "Uma operação de exclusão já foi registrada para esta ficha.");

    const predecessor = [...anteriores].reverse().find(item => item.status !== "completed") || null;
    const expectedRevision = predecessor ? null : (Number.isInteger(registro.remoteRevision) ? registro.remoteRevision : null);
    const revisionStrategy = predecessor ? "after-dependency" : "fixed";
    const operation = {
      operationId: crypto.randomUUID(), userId, localId, sequence: registro.nextSequence++, type: "save",
      request: {
        p_local_id: localId, p_format_version: FORMAT_VERSION_FICHA,
        p_data: clonarJson(snapshot), p_expected_revision: expectedRevision
      },
      expectedRevision, revisionStrategy, dependsOn: predecessor?.operationId || null,
      status: predecessor ? "blocked" : "pending", blockedReason: predecessor ? "awaiting-predecessor" : null,
      snapshot: clonarJson(snapshot), createdAt: new Date().toISOString()
    };
    estado.operations.push(operation);
    registro.syncState = predecessor ? "dependency-pending" : "pending";
    return { operation: clonarJson(operation), created: true, unchanged: false };
  }

  function adicionarTombstoneLocal(estado, localId, snapshot, userId = null) {
    let tombstone = estado.tombstones.find(item => item.localId === localId && (item.userId || null) === (userId || null) && tombstoneAtivo(item));
    if (!tombstone) {
      tombstone = { localId, userId, snapshot: clonarJson(snapshot), createdAt: new Date().toISOString(), status: "local-recovery" };
      estado.tombstones.push(tombstone);
    }
    return tombstone;
  }

  async function obterMetadadosSincronizacao(localId) {
    validarIdentificador(localId, "local_id");
    const userId = await getAuthenticatedUserId();
    if (!userId) return null;
    const estado = await lerEstadoSync();
    const registro = obterRegistro(estado, userId, localId);
    return clonarJson(registro);
  }

  async function salvarMetadadosSincronizacao(localId, patch) {
    validarIdentificador(localId, "local_id");
    const userId = await getAuthenticatedUserId();
    if (!userId) return null;
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new TypeError("Metadados inválidos.");
    const camposPermitidos = new Set([
      "remoteId", "remoteRevision", "remoteFormatVersion", "syncState",
      "lastSyncedSnapshot", "localConflictSnapshot", "remoteConflictSnapshot"
    ]);
    for (const campo of Object.keys(patch)) {
      if (!camposPermitidos.has(campo)) throw new TypeError(`Campo de metadados não permitido: ${campo}`);
    }
    return atualizarEstadoSync(estado => {
      const registro = obterRegistro(estado, userId, localId, true);
      Object.assign(registro, clonarJson(patch));
      return registro;
    });
  }

  async function registrarTombstoneLocal(localId, snapshot) {
    const copia = clonarEValidarFicha(localId, snapshot);
    return atualizarEstadoSync(estado => clonarJson(adicionarTombstoneLocal(estado, localId, copia)));
  }

  async function obterTombstoneLocal(localId) {
    validarIdentificador(localId, "local_id");
    const estado = await lerEstadoSync();
    return clonarJson(estado.tombstones.find(item => item.localId === localId) || null);
  }

  async function obterTombstoneDaConta(localId) {
    validarIdentificador(localId, "local_id");
    const userId = await getAuthenticatedUserId();
    if (!userId) return null;
    const estado = await lerEstadoSync();
    return clonarJson(estado.accountTombstones.find(item => item.userId === userId && item.localId === localId) || null);
  }

  async function obterEstadosSincronizacao(localIds) {
    const userId = await getAuthenticatedUserId();
    const estado = await lerEstadoSync();
    const byLocalId = {};
    for (const localId of localIds) {
      if (typeof localId !== "string" || !localId) continue;
      const owners = proprietariosConhecidos(estado, localId);
      const ownerId = owners.length === 1 ? owners[0] : null;
      const ambiguous = owners.length > 1;
      const ownAssociation = estado.associations.find(item => item.localId === localId) || null;
      const origin = estado.origins.find(item => item.localId === localId)?.origin || null;
      const localTombstoneForCurrentAccount = userId
        ? estado.tombstones.find(item => item.localId === localId && item.userId === userId && tombstoneAtivo(item))
        : null;
      const deletedForCurrentAccount = Boolean(userId && (
        estado.accountTombstones.some(item => item.userId === userId && item.localId === localId && tombstoneAtivo(item))
        || localTombstoneForCurrentAccount
      ));
      const accountOperations = userId && ownerId === userId ? obterOperacoesDaFicha(estado, userId, localId) : [];
      const queue = accountOperations.filter(item => ["pending", "blocked", "conflict", "failed"].includes(item.status));
      let associationState = "unassociated";
      if (ambiguous) associationState = "ambiguous";
      else if (deletedForCurrentAccount) associationState = "deleted";
      else if (ownerId && !userId) associationState = "no-session";
      else if (ownerId && ownerId !== userId) associationState = "other-account";
      else if (ownerId && ownAssociation) associationState = "current-account";
      else if (ownerId) associationState = "legacy-account";
      byLocalId[localId] = {
        associationState,
        canEdit: !ambiguous && !deletedForCurrentAccount && (!ownerId || ownerId === userId),
        canAssociate: Boolean(userId && origin !== "preset" && !ambiguous && !deletedForCurrentAccount && (!ownerId || ownerId === userId) && !ownAssociation),
        origin,
        queueCount: queue.length,
        hasBlockedOperations: queue.some(item => item.status === "blocked" || item.status === "conflict" || item.status === "failed"),
        pendingCount: queue.filter(item => item.status === "pending").length
      };
    }
    return { sessionAvailable: Boolean(userId), byLocalId };
  }

  async function associarNativaAConta(snapshot) {
    const localId = snapshot?.id;
    validarIdentificador(localId, "local_id");
    const copia = clonarEValidarFicha(localId, snapshot);
    validarColecaoLocal(localId);
    const userId = await getAuthenticatedUserId();
    if (!userId) throw erroSync("AUTH_REQUIRED", "Entre na sua conta para preparar esta ficha.");
    return atualizarEstadoSync(estado => {
      const origin = estado.origins.find(item => item.localId === localId)?.origin;
      if (origin === "preset") throw erroSync("PRESET_NOT_SYNCABLE", "Presets não podem ser associados à sincronização.");
      const owners = proprietariosConhecidos(estado, localId);
      if (owners.length > 1) throw erroSync("ACCOUNT_AMBIGUOUS", "Esta ficha possui metadados de mais de uma conta e precisa ser revisada.");
      if (owners.length === 1 && owners[0] !== userId) throw erroSync("OTHER_ACCOUNT", "Esta ficha está associada a outra conta e não pode ser transferida.");
      if (estado.accountTombstones.some(item => item.userId === userId && item.localId === localId && tombstoneAtivo(item))) {
        throw erroSync("FICHA_DELETED", "Esta ficha já foi excluída para a conta atual.");
      }
      if (estado.tombstones.some(item => item.localId === localId && item.userId === userId && tombstoneAtivo(item))) {
        throw erroSync("FICHA_DELETED", "Esta ficha possui um tombstone para a conta atual e não pode ser associada novamente.");
      }

      let association = estado.associations.find(item => item.localId === localId);
      if (association?.userId && association.userId !== userId) throw erroSync("OTHER_ACCOUNT", "Esta ficha está associada a outra conta e não pode ser transferida.");
      if (origin !== "player") {
        if (!origin) estado.origins.push({ localId, origin: "player", createdAt: new Date().toISOString() });
        else throw erroSync("INVALID_ORIGIN", "A origem desta ficha não permite associação.");
      }

      const existingOperations = obterOperacoesDaFicha(estado, userId, localId);
      const initialAlreadyQueued = existingOperations.some(item => item.type === "save");
      if (association && initialAlreadyQueued) {
        return { association: clonarJson(association), operation: null, alreadyAssociated: true };
      }
      if (!association) {
        association = { localId, userId, createdAt: new Date().toISOString() };
        estado.associations.push(association);
      }
      const result = criarOperacaoSave(estado, userId, localId, copia, { force: !initialAlreadyQueued });
      return { association: clonarJson(association), operation: result.operation, alreadyAssociated: false };
    });
  }

  async function enfileirarSaveSeAssociada(snapshot) {
    const localId = snapshot?.id;
    validarIdentificador(localId, "local_id");
    const copia = clonarEValidarFicha(localId, snapshot);
    validarColecaoLocal(localId);
    const sessaoAoIniciar = getAuthenticatedUserId();
    const estadoAntes = await lerEstadoSync();
    const proprietarios = proprietariosConhecidos(estadoAntes, localId);
    if (proprietarios.length === 0) return { status: "unassociated", operation: null };
    const userId = await sessaoAoIniciar;
    if (!userId) throw erroSync("AUTH_REQUIRED", "A ficha associada está somente leitura sem sessão.");
    return atualizarEstadoSync(estado => {
      const origin = estado.origins.find(item => item.localId === localId)?.origin;
      if (origin === "preset") return { status: "preset", operation: null };
      const owners = proprietariosConhecidos(estado, localId);
      if (owners.length > 1) throw erroSync("ACCOUNT_AMBIGUOUS", "Esta ficha está bloqueada por associação ambígua entre contas.");
      if (owners.length === 0) return { status: "unassociated", operation: null };
      if (owners[0] !== userId) throw erroSync("READ_ONLY", "Esta ficha pertence a outra conta e está somente leitura.");
      const result = criarOperacaoSave(estado, userId, localId, copia);
      return { status: result.unchanged ? "unchanged" : result.operation?.status || "queued", operation: result.operation };
    });
  }

  async function podeEditarNativa(localId) {
    validarIdentificador(localId, "local_id");
    const sessaoAoIniciar = getAuthenticatedUserId();
    const estado = await lerEstadoSync();
    const owners = proprietariosConhecidos(estado, localId);
    const hasAccountTombstone = estado.tombstones.some(item => item.localId === localId && item.userId && tombstoneAtivo(item))
      || estado.accountTombstones.some(item => item.localId === localId && tombstoneAtivo(item));
    const userId = owners.length || hasAccountTombstone ? await sessaoAoIniciar : null;
    const localTombstone = estado.tombstones.find(item => item.localId === localId && item.userId === userId && tombstoneAtivo(item));
    if (localTombstone) {
      return { allowed: false, reason: "FICHA_DELETED" };
    }
    if (userId && estado.accountTombstones.some(item => item.userId === userId && item.localId === localId && tombstoneAtivo(item))) {
      return { allowed: false, reason: "FICHA_DELETED" };
    }
    if (owners.length === 0) return { allowed: true, reason: null };
    return { allowed: owners.length === 0 || (owners.length === 1 && owners[0] === userId), reason: owners.length > 1 ? "ACCOUNT_AMBIGUOUS" : owners.length === 1 && owners[0] !== userId ? (userId ? "OTHER_ACCOUNT" : "AUTH_REQUIRED") : null };
  }

  async function registrarOperacaoPendente({ operationId, localId, type, request, snapshot = null }) {
    validarIdentificador(operationId, "operation_id");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId)) {
      throw new TypeError("operation_id precisa ser um UUID válido.");
    }
    const userId = await getAuthenticatedUserId();
    if (!userId) throw erroSync("AUTH_REQUIRED", "Uma operação associada exige sessão autenticada.");
    validarIdentificador(localId, "local_id");
    if (type !== "save") throw erroSync("INVALID_OPERATION", "Use o fluxo de exclusão para registrar deletes.");
    if (!request || request.p_local_id !== localId || request.p_data?.id !== localId) throw new TypeError("Payload save_nativa incompatível com a identidade local.");
    validarColecaoLocal(localId);
    const payload = clonarJson(request);
    const snapshotCopy = clonarEValidarFicha(localId, snapshot || payload.p_data);
    return atualizarEstadoSync(estado => {
      const owners = proprietariosConhecidos(estado, localId);
      if (owners.length !== 1 || owners[0] !== userId) throw erroSync("NOT_ASSOCIATED", "Associe esta ficha explicitamente antes de enfileirar operações.");
      const existente = estado.operations.find(item => item.operationId === operationId);
      if (existente) {
        if (existente.userId !== userId || existente.localId !== localId || existente.type !== type
          || JSON.stringify(existente.request) !== JSON.stringify(payload)
          || JSON.stringify(existente.snapshot) !== JSON.stringify(snapshotCopy)) {
          throw new Error("operation_id já registrado com conteúdo diferente.");
        }
        return clonarJson(existente);
      }
      const registro = obterRegistro(estado, userId, localId, true);
      if (estado.accountTombstones.some(item => item.userId === userId && item.localId === localId && tombstoneAtivo(item))) {
        throw erroSync("FICHA_DELETED", "Não é possível enfileirar saves após o tombstone desta conta.");
      }
      const anteriores = obterOperacoesDaFicha(estado, userId, localId);
      const predecessor = [...anteriores].reverse().find(item => item.status !== "completed") || null;
      if (predecessor && payload.p_expected_revision !== null) {
        throw erroSync("REVISION_DEFERRED", "Uma revisão após operação pendente não pode ser prevista; registre-a como dependente.");
      }
      const operation = {
        operationId, userId, localId, sequence: registro.nextSequence++, type,
        request: payload, expectedRevision: payload.p_expected_revision ?? null,
        revisionStrategy: predecessor ? "after-dependency" : "fixed", dependsOn: predecessor?.operationId || null,
        status: predecessor ? "blocked" : "pending", blockedReason: predecessor ? "awaiting-predecessor" : null,
        snapshot: snapshotCopy, createdAt: new Date().toISOString()
      };
      estado.operations.push(operation);
      registro.syncState = predecessor ? "dependency-pending" : "pending";
      return clonarJson(operation);
    });
  }

  async function registrarExclusaoLocal({ operationId, localId, snapshot }) {
    validarIdentificador(localId, "local_id");
    const snapshotTemId = Object.prototype.hasOwnProperty.call(snapshot || {}, "id");
    let copia;
    if (snapshotTemId) {
      copia = clonarEValidarFicha(localId, snapshot);
      validarColecaoLocal(localId);
    } else {
      copia = clonarJson(snapshot);
      if (!copia || typeof copia !== "object" || Array.isArray(copia)) {
        throw new TypeError("O snapshot da Nativa deve ser um objeto JSON.");
      }
      const matches = lerNativasArmazenadas().filter(item => JSON.stringify(item) === JSON.stringify(copia));
      if (matches.length !== 1) throw erroSync("LOCAL_ID_AMBIGUOUS", "A ficha sem ID precisa corresponder a um único registro local antes da exclusão.");
    }
    const userId = await getAuthenticatedUserId();
    return atualizarEstadoSync(estado => {
      const origin = estado.origins.find(item => item.localId === localId)?.origin;
      if (origin === "preset") throw erroSync("PRESET_NOT_SYNCABLE", "Presets não podem ser excluídos por este fluxo.");
      const owners = proprietariosConhecidos(estado, localId);
      if (owners.length > 1) throw erroSync("ACCOUNT_AMBIGUOUS", "Esta ficha possui associação ambígua e não pode ser excluída agora.");
      if (!snapshotTemId && owners.length > 0) throw erroSync("LOCAL_ID_REQUIRED", "Uma ficha sem ID não pode ter associação de conta.");
      if (owners.length === 1 && owners[0] !== userId) throw erroSync("READ_ONLY", "Esta ficha pertence a outra conta e está somente leitura.");

      if (owners.length === 0) {
        const tombstoneUserId = userId || null;
        const idlessTombstone = !snapshotTemId
          ? estado.tombstones.find(item => (item.userId || null) === tombstoneUserId && tombstoneAtivo(item) && JSON.stringify(item.snapshot) === JSON.stringify(copia))
          : null;
        if (idlessTombstone) return { operation: null, tombstone: clonarJson(idlessTombstone), status: "local-only" };
        const tombstoneAnterior = estado.tombstones.find(item => item.localId === localId && (item.userId || null) === tombstoneUserId && tombstoneAtivo(item));
        if (tombstoneAnterior && JSON.stringify(tombstoneAnterior.snapshot) !== JSON.stringify(copia)) {
          throw new Error("A ficha já possui tombstone local com outro snapshot.");
        }
        const tombstone = adicionarTombstoneLocal(estado, localId, copia, tombstoneUserId);
        return { operation: null, tombstone: clonarJson(tombstone), status: "local-only" };
      }
      if (!userId) throw erroSync("AUTH_REQUIRED", "Entre na conta proprietária para excluir esta ficha.");
      const ownerId = owners[0];
      const actualOperationId = operationId || crypto.randomUUID();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(actualOperationId)) {
        throw new TypeError("operation_id precisa ser um UUID válido.");
      }
      const operationIdCollision = estado.operations.find(item => item.operationId === actualOperationId);
      if (operationIdCollision) {
        if (operationIdCollision.type === "delete" && operationIdCollision.userId === ownerId
          && operationIdCollision.localId === localId
          && JSON.stringify(operationIdCollision.snapshot) === JSON.stringify(copia)) {
          return { operation: clonarJson(operationIdCollision), tombstone: null, status: operationIdCollision.status };
        }
        throw new Error("operation_id já registrado com conteúdo diferente.");
      }
      const association = estado.associations.find(item => item.localId === localId);
      if (!association) estado.associations.push({ localId, userId: ownerId, createdAt: new Date().toISOString(), legacy: true });
      const existingTombstone = estado.accountTombstones.find(item => item.userId === ownerId && item.localId === localId && tombstoneAtivo(item));
      if (existingTombstone) {
        const priorDelete = estado.operations.find(item => item.operationId === existingTombstone.operationId);
        if (JSON.stringify(existingTombstone.snapshot) !== JSON.stringify(copia)) {
          throw new Error("A operação de exclusão já foi registrada com conteúdo diferente.");
        }
        if (operationId && priorDelete && operationId === priorDelete.operationId
          && (priorDelete.type !== "delete" || priorDelete.userId !== ownerId
            || priorDelete.localId !== localId || JSON.stringify(priorDelete.snapshot) !== JSON.stringify(copia))) {
          throw new Error("operation_id já registrado com conteúdo diferente.");
        }
        return { operation: clonarJson(priorDelete || null), tombstone: clonarJson(existingTombstone), status: existingTombstone.status };
      }

      const registro = obterRegistro(estado, ownerId, localId, true);
      const previous = obterOperacoesDaFicha(estado, ownerId, localId);
      const latest = previous.at(-1) || null;
      if (latest?.type === "delete") throw erroSync("FICHA_DELETED", "A exclusão desta ficha já está registrada.");
      const predecessor = [...previous].reverse().find(item => item.status !== "completed") || null;
      const hasKnownRemote = Number.isInteger(registro.remoteRevision) && registro.remoteRevision > 0;
      const expectedRevision = predecessor ? null : (hasKnownRemote ? registro.remoteRevision : null);
      const revisionStrategy = predecessor ? "after-dependency" : hasKnownRemote ? "fixed" : "awaiting-remote-create";
      const status = predecessor || !hasKnownRemote ? "blocked" : "pending";
      const operation = {
        operationId: actualOperationId, userId: ownerId, localId, sequence: registro.nextSequence++, type: "delete",
        request: { p_local_id: localId, p_expected_revision: expectedRevision }, expectedRevision,
        revisionStrategy, dependsOn: predecessor?.operationId || null,
        status, blockedReason: predecessor ? "awaiting-predecessor" : !hasKnownRemote ? "awaiting-remote-create" : null,
        snapshot: clonarJson(copia), createdAt: new Date().toISOString()
      };
      estado.operations.push(operation);
      const tombstone = { userId: ownerId, localId, operationId: operation.operationId,
        snapshot: clonarJson(copia), createdAt: operation.createdAt, status };
      estado.accountTombstones.push(tombstone);
      adicionarTombstoneLocal(estado, localId, copia, ownerId);
      registro.syncState = status === "pending" ? "deletion-pending" : "dependency-pending";
      return { operation: clonarJson(operation), tombstone: clonarJson(tombstone), status };
    });
  }

  async function listarOperacoesPendentes(localId = null) {
    const userId = await getAuthenticatedUserId();
    if (!userId) return [];
    const estado = await lerEstadoSync();
    return estado.operations
      .filter(item => item.userId === userId && ["pending", "blocked", "conflict", "failed"].includes(item.status)
        && (localId === null || item.localId === localId))
      .sort((a, b) => a.localId.localeCompare(b.localId) || a.sequence - b.sequence)
      .map(clonarJson);
  }

  async function listarOperacoesSincronizacao() {
    const userId = await getAuthenticatedUserId();
    if (!userId) return [];
    const estado = await lerEstadoSync();
    return estado.operations.filter(item => item.userId === userId)
      .sort((a, b) => a.localId.localeCompare(b.localId) || a.sequence - b.sequence)
      .map(clonarJson);
  }

  async function listarConflitosSincronizacao() {
    const userId = await getAuthenticatedUserId();
    if (!userId) return [];
    const estado = await lerEstadoSync();
    return estado.conflicts.filter(item => item.userId === userId && item.status === "open")
      .sort((a, b) => a.detectedAt.localeCompare(b.detectedAt))
      .map(clonarJson);
  }

  async function listarHistoricoConflitosSincronizacao() {
    const userId = await getAuthenticatedUserId();
    if (!userId) return [];
    const estado = await lerEstadoSync();
    return estado.conflicts.filter(item => item.userId === userId && item.status !== "open")
      .sort((a, b) => (b.resolvedAt || b.detectedAt).localeCompare(a.resolvedAt || a.detectedAt))
      .map(clonarJson);
  }

  async function obterResumoFilaSincronizacao() {
    const userId = await getAuthenticatedUserId();
    if (!userId) return { sessionAvailable: false, pending: 0, completed: 0, failed: 0, conflicts: 0 };
    const estado = await lerEstadoSync();
    const operations = estado.operations.filter(item => item.userId === userId);
    return {
      sessionAvailable: true,
      pending: operations.filter(item => ["pending", "blocked"].includes(item.status)).length,
      completed: operations.filter(item => item.status === "completed").length,
      failed: operations.filter(item => item.status === "failed").length,
      conflicts: estado.conflicts.filter(item => item.userId === userId && item.status === "open").length
    };
  }

  async function prepararOperacaoParaSincronizacao(operationId) {
    validarIdentificador(operationId, "operation_id");
    const userId = await getAuthenticatedUserId();
    if (!userId) throw erroSync("AUTH_REQUIRED", "Entre na conta proprietária para sincronizar.");
    return atualizarEstadoSync(estado => {
      const operation = estado.operations.find(item => item.operationId === operationId && item.userId === userId);
      if (!operation) throw erroSync("OPERATION_NOT_FOUND", "A operação não pertence à sessão atual.");
      if (!["pending", "failed"].includes(operation.status)) throw erroSync("OPERATION_NOT_READY", "A operação ainda depende de outra operação ou precisa de resolução de conflito.");
      const origin = estado.origins.find(item => item.localId === operation.localId)?.origin;
      if (origin === "preset") throw erroSync("PRESET_NOT_SYNCABLE", "Presets não podem ser sincronizados.");
      const owners = proprietariosConhecidos(estado, operation.localId);
      if (owners.length !== 1 || owners[0] !== userId) throw erroSync("READ_ONLY", "A operação não pertence à conta atual.");
      if (operation.dependsOn) {
        const predecessor = estado.operations.find(item => item.operationId === operation.dependsOn && item.userId === userId);
        if (!predecessor || predecessor.status !== "completed") throw erroSync("DEPENDENCY_UNRESOLVED", "A operação anterior ainda não foi confirmada pelo servidor.");
      }
      const record = obterRegistro(estado, userId, operation.localId, true);
      let expectedRevision;
      if (Object.prototype.hasOwnProperty.call(operation, "attemptExpectedRevision")) {
        expectedRevision = operation.attemptExpectedRevision;
      } else if (["after-dependency", "awaiting-remote-create"].includes(operation.revisionStrategy)) {
        if (!Number.isInteger(record.remoteRevision) || record.remoteRevision <= 0) {
          throw erroSync("REMOTE_REVISION_REQUIRED", "A revisão remota anterior ainda não foi confirmada.");
        }
        expectedRevision = record.remoteRevision;
      } else {
        expectedRevision = operation.expectedRevision;
      }
      if (operation.type === "delete" && (!Number.isInteger(expectedRevision) || expectedRevision <= 0)) {
        throw erroSync("REMOTE_REVISION_REQUIRED", "A exclusão depende de uma revisão remota confirmada.");
      }
      operation.attemptExpectedRevision = expectedRevision;
      operation.status = "pending";
      operation.lastAttemptAt = new Date().toISOString();
      operation.attemptCount = (operation.attemptCount || 0) + 1;
      operation.lastError = null;
      const request = clonarJson(operation.request);
      request.p_expected_revision = expectedRevision;
      return { operation: clonarJson(operation), request };
    });
  }

  async function registrarFalhaOperacaoSincronizacao(operationId, error) {
    const userId = await getAuthenticatedUserId();
    if (!userId) throw erroSync("AUTH_REQUIRED", "A sessão terminou durante a sincronização.");
    return atualizarEstadoSync(estado => {
      const operation = estado.operations.find(item => item.operationId === operationId && item.userId === userId);
      if (!operation || !["pending", "failed"].includes(operation.status)) return null;
      operation.status = "failed";
      operation.lastError = String(error?.message || error || "Falha de sincronização").slice(0, 500);
      operation.failedAt = new Date().toISOString();
      const record = obterRegistro(estado, userId, operation.localId, true);
      record.syncState = "failed";
      return clonarJson(operation);
    });
  }

  async function registrarConflitoOperacaoSincronizacao(operationId, serverResult) {
    const userId = await getAuthenticatedUserId();
    if (!userId) throw erroSync("AUTH_REQUIRED", "A sessão terminou ao registrar o conflito.");
    if (!serverResult || typeof serverResult !== "object" || Array.isArray(serverResult)) throw new TypeError("Resposta de conflito inválida.");
    return atualizarEstadoSync(estado => {
      const operation = estado.operations.find(item => item.operationId === operationId && item.userId === userId);
      if (!operation) throw erroSync("OPERATION_NOT_FOUND", "A operação não pertence à sessão atual.");
      const existing = estado.conflicts.find(item => item.operationId === operationId && item.userId === userId);
      if (existing) return clonarJson(existing);
      if (serverResult.local_id !== operation.localId) throw erroSync("INVALID_SERVER_RESPONSE", "O conflito retornado pertence a outra ficha.");
      const hasRemoteRevision = Number.isInteger(serverResult.revision) && serverResult.revision > 0;
      const remoteSnapshot = serverResult.data && typeof serverResult.data === "object" && !Array.isArray(serverResult.data)
        ? clonarJson(serverResult.data) : null;
      if (remoteSnapshot && remoteSnapshot.id !== operation.localId) throw erroSync("INVALID_SERVER_RESPONSE", "A ficha remota retornada possui identidade incompatível.");
      const localMatches = lerNativasArmazenadas().filter(item => item?.id === operation.localId);
      const tombstone = estado.accountTombstones.find(item => item.userId === userId && item.localId === operation.localId && tombstoneAtivo(item));
      const localSnapshot = localMatches.length === 1 ? clonarJson(localMatches[0]) : clonarJson(tombstone?.snapshot || operation.snapshot);
      const related = obterOperacoesDaFicha(estado, userId, operation.localId)
        .filter(item => item.sequence >= operation.sequence && !["completed", "superseded"].includes(item.status));
      const conflict = {
        conflictId: operation.operationId, operationId: operation.operationId,
        userId, localId: operation.localId, operationType: operation.type, sequence: operation.sequence,
        detectedAt: new Date().toISOString(), status: "open",
        localSnapshot, operationSnapshot: clonarJson(operation.snapshot),
        remoteSnapshot, remoteRevision: hasRemoteRevision ? serverResult.revision : null,
        remoteId: serverResult.remote_id || null,
        remoteFormatVersion: Number.isInteger(serverResult.format_version) ? serverResult.format_version : null,
        remoteDeleted: serverResult.status === "deleted",
        remoteDeletedAt: serverResult.deleted_at || null,
        resultStatus: serverResult.status,
        operationIds: related.map(item => item.operationId)
      };
      estado.conflicts.push(conflict);
      operation.status = "conflict";
      operation.lastError = "Conflito de revisão retornado pelo servidor.";
      for (const dependent of related) {
        if (dependent.operationId !== operation.operationId && dependent.status !== "completed") {
          dependent.status = "blocked";
          dependent.blockedReason = "predecessor-conflict";
        }
      }
      const record = obterRegistro(estado, userId, operation.localId, true);
      if (hasRemoteRevision) record.remoteRevision = serverResult.revision;
      if (typeof serverResult.remote_id === "string") record.remoteId = serverResult.remote_id;
      if (Number.isInteger(serverResult.format_version)) record.remoteFormatVersion = serverResult.format_version;
      record.localConflictSnapshot = localSnapshot;
      record.remoteConflictSnapshot = remoteSnapshot;
      record.syncState = "conflict";
      return clonarJson(conflict);
    });
  }

  async function concluirOperacaoSincronizacao(operationId, serverResult) {
    const userId = await getAuthenticatedUserId();
    if (!userId) throw erroSync("AUTH_REQUIRED", "A sessão terminou antes de confirmar a operação.");
    return atualizarEstadoSync(estado => {
      const operation = estado.operations.find(item => item.operationId === operationId && item.userId === userId);
      if (!operation || !["pending", "failed"].includes(operation.status)) throw erroSync("OPERATION_NOT_READY", "A operação já foi concluída ou não está pronta.");
      if (!serverResult || serverResult.local_id !== operation.localId || !Number.isInteger(serverResult.revision) || serverResult.revision <= 0 || typeof serverResult.remote_id !== "string") {
        throw erroSync("INVALID_SERVER_RESPONSE", "A confirmação do servidor não contém identidade e revisão válidas.");
      }
      const currentRecord = obterRegistro(estado, userId, operation.localId, true);
      if (currentRecord.remoteId && currentRecord.remoteId !== serverResult.remote_id) {
        throw erroSync("REMOTE_ID_MISMATCH", "O UUID remoto retornado diverge do vínculo já confirmado para esta ficha.");
      }
      operation.status = "completed";
      operation.completedAt = new Date().toISOString();
      operation.serverResult = clonarJson(serverResult);
      operation.lastError = null;
      const record = currentRecord;
      record.remoteId = serverResult.remote_id;
      record.remoteRevision = serverResult.revision;
      record.remoteFormatVersion = operation.type === "save" ? operation.request.p_format_version : (record.remoteFormatVersion || null);
      record.lastSyncedSnapshot = clonarJson(operation.snapshot);
      record.localConflictSnapshot = null;
      record.remoteConflictSnapshot = null;
      if (operation.type === "delete") {
        const tombstone = estado.accountTombstones.find(item => item.userId === userId && item.localId === operation.localId && item.operationId === operationId);
        if (tombstone) tombstone.status = "completed";
        record.syncState = "deleted";
      } else {
        for (const child of estado.operations.filter(item => item.userId === userId && item.localId === operation.localId && item.dependsOn === operationId && item.status === "blocked")) {
          child.status = "pending";
          child.blockedReason = null;
        }
        const active = obterOperacoesDaFicha(estado, userId, operation.localId)
          .some(item => item.operationId !== operationId && ["pending", "blocked", "failed", "conflict"].includes(item.status));
        record.syncState = active ? "pending" : "synced";
      }
      return clonarJson(operation);
    });
  }

  async function resolverConflitoManterLocal(conflictId) {
    const userId = await getAuthenticatedUserId();
    if (!userId) throw erroSync("AUTH_REQUIRED", "Entre na conta proprietária para resolver o conflito.");
    return atualizarEstadoSync(estado => {
      const conflict = estado.conflicts.find(item => item.conflictId === conflictId && item.userId === userId && item.status === "open");
      if (!conflict) throw erroSync("CONFLICT_NOT_FOUND", "O conflito não está mais aberto para esta conta.");
      const createAfterNotFound = conflict.resultStatus === "not_found" && conflict.operationType === "save";
      const hasActiveRemote = Boolean(conflict.remoteSnapshot && Number.isInteger(conflict.remoteRevision)
        && conflict.remoteRevision > 0 && conflict.remoteId && !conflict.remoteDeleted);
      if (!hasActiveRemote && !createAfterNotFound) {
        throw erroSync("CONFLICT_NOT_RESOLVABLE", "O contrato atual não permite manter esta versão local com segurança.");
      }
      const registry = obterRegistro(estado, userId, conflict.localId, true);
      const related = obterOperacoesDaFicha(estado, userId, conflict.localId)
        .filter(item => !["completed", "superseded"].includes(item.status));
      const deleteIntent = related.filter(item => item.type === "delete").at(-1) || null;
      if (createAfterNotFound && deleteIntent) {
        throw erroSync("CONFLICT_NOT_RESOLVABLE", "A operação de exclusão não pode ser convertida em nova criação com segurança.");
      }
      const fichaLocal = deleteIntent
        ? clonarJson(estado.accountTombstones.find(item => item.userId === userId && item.localId === conflict.localId && tombstoneAtivo(item))?.snapshot || deleteIntent.snapshot)
        : clonarJson(lerNativasArmazenadas().find(item => item?.id === conflict.localId) || conflict.localSnapshot);
      if (!fichaLocal || fichaLocal.id !== conflict.localId) throw erroSync("LOCAL_SNAPSHOT_MISSING", "A versão local recuperável não está disponível.");
      for (const prior of related) {
        prior.status = "superseded";
        prior.supersededAt = new Date().toISOString();
        prior.supersededByResolution = conflictId;
      }
      registry.remoteId = hasActiveRemote ? conflict.remoteId : null;
      registry.remoteRevision = hasActiveRemote ? conflict.remoteRevision : null;
      registry.remoteFormatVersion = hasActiveRemote ? conflict.remoteFormatVersion : null;
      registry.localConflictSnapshot = null;
      registry.remoteConflictSnapshot = null;
      const operationId = crypto.randomUUID();
      const sequence = registry.nextSequence++;
      const latestSave = [...related].reverse().find(item => item.type === "save");
      const formatVersion = latestSave?.request?.p_format_version || FORMAT_VERSION_FICHA;
      const expectedRevision = hasActiveRemote ? conflict.remoteRevision : null;
      const operation = deleteIntent ? {
        operationId, userId, localId: conflict.localId, sequence, type: "delete",
        request: { p_local_id: conflict.localId, p_expected_revision: expectedRevision },
        expectedRevision, revisionStrategy: "fixed", dependsOn: null,
        status: "pending", blockedReason: null, snapshot: fichaLocal, createdAt: new Date().toISOString(),
        attemptExpectedRevision: null
      } : {
        operationId, userId, localId: conflict.localId, sequence, type: "save",
        request: { p_local_id: conflict.localId, p_format_version: formatVersion, p_data: clonarJson(fichaLocal), p_expected_revision: expectedRevision },
        expectedRevision, revisionStrategy: "fixed", dependsOn: null,
        status: "pending", blockedReason: null, snapshot: clonarJson(fichaLocal), createdAt: new Date().toISOString()
      };
      delete operation.attemptExpectedRevision;
      estado.operations.push(operation);
      if (deleteIntent) {
        let tombstone = estado.accountTombstones.find(item => item.userId === userId && item.localId === conflict.localId);
        if (!tombstone) {
          tombstone = { userId, localId: conflict.localId, snapshot: clonarJson(fichaLocal), createdAt: operation.createdAt };
          estado.accountTombstones.push(tombstone);
        }
        tombstone.operationId = operationId;
        tombstone.snapshot = clonarJson(fichaLocal);
        tombstone.status = "pending";
        registry.syncState = "deletion-pending";
      } else {
        registry.syncState = "pending";
      }
      conflict.status = "resolved";
      conflict.resolution = "keep-local";
      conflict.resolvedAt = new Date().toISOString();
      conflict.resolutionOperationId = operationId;
      return { conflict: clonarJson(conflict), operation: clonarJson(operation) };
    });
  }

  async function resolverConflitoAceitarRemoto(conflictId) {
    const userId = await getAuthenticatedUserId();
    if (!userId) throw erroSync("AUTH_REQUIRED", "Entre na conta proprietária para resolver o conflito.");
    return serializarPersistenciaLocal(async () => {
      const before = lerNativasArmazenadas();
      const estadoAntes = await lerEstadoSync();
      const conflict = estadoAntes.conflicts.find(item => item.conflictId === conflictId && item.userId === userId && item.status === "open");
      if (!conflict) throw erroSync("CONFLICT_NOT_FOUND", "O conflito não está mais aberto para esta conta.");
      if (!conflict.remoteSnapshot || conflict.remoteSnapshot.id !== conflict.localId || !Number.isInteger(conflict.remoteRevision) || conflict.remoteRevision <= 0 || conflict.remoteDeleted) {
        throw erroSync("CONFLICT_NOT_RESOLVABLE", "O servidor não forneceu uma versão remota ativa que possa ser aceita.");
      }
      const matches = before.filter(item => item?.id === conflict.localId);
      if (matches.length > 1) throw erroSync("LOCAL_ID_AMBIGUOUS", "Há fichas locais duplicadas; a versão remota não foi aplicada.");
      const localSnapshot = clonarJson(matches[0] || conflict.localSnapshot || conflict.operationSnapshot);
      const after = matches.length
        ? before.map(item => item?.id === conflict.localId ? clonarJson(conflict.remoteSnapshot) : item)
        : [...before, clonarJson(conflict.remoteSnapshot)];
      gravarNativasArmazenadas(after);
      try {
        return await atualizarEstadoSync(estado => {
          const current = estado.conflicts.find(item => item.conflictId === conflictId && item.userId === userId && item.status === "open");
          if (!current) throw erroSync("CONFLICT_NOT_FOUND", "O conflito foi resolvido em outra operação.");
          current.localSnapshot = localSnapshot;
          const relatedIds = new Set(current.operationIds || []);
          for (const operation of estado.operations) {
            if (operation.userId === userId && operation.localId === current.localId
              && (relatedIds.has(operation.operationId) || operation.sequence >= current.sequence)
              && !["completed", "superseded"].includes(operation.status)) {
              operation.status = "superseded";
              operation.supersededAt = new Date().toISOString();
              operation.supersededByResolution = conflictId;
            }
          }
          for (const tombstone of estado.accountTombstones) {
            if (tombstone.userId === userId && tombstone.localId === current.localId && tombstoneAtivo(tombstone)) tombstone.status = "resolved-remote";
          }
          for (const tombstone of estado.tombstones) {
            if (tombstone.localId === current.localId && tombstone.userId === userId && tombstoneAtivo(tombstone)) tombstone.status = "resolved-remote";
          }
          const record = obterRegistro(estado, userId, current.localId, true);
          record.remoteId = current.remoteId;
          record.remoteRevision = current.remoteRevision;
          record.remoteFormatVersion = current.remoteFormatVersion;
          record.lastSyncedSnapshot = clonarJson(current.remoteSnapshot);
          record.localConflictSnapshot = null;
          record.remoteConflictSnapshot = null;
          record.syncState = "synced";
          current.status = "resolved";
          current.resolution = "accept-remote";
          current.resolvedAt = new Date().toISOString();
          return { conflict: clonarJson(current), localSnapshot };
        });
      } catch (error) {
        try { gravarNativasArmazenadas(before); }
        catch (rollbackError) { error.rollbackError = rollbackError; }
        throw error;
      }
    });
  }
  async function obterNativas() {
    return serializarPersistenciaLocal(() => clonarJson(lerNativasArmazenadas()));
  }

  function listarNativas() {
    return obterNativas();
  }

  async function buscarNativaPorId(localId) {
    validarIdentificador(localId, "local_id");
    return serializarPersistenciaLocal(() => {
      const correspondencias = lerNativasArmazenadas().filter(item => item?.id === localId);
      if (correspondencias.length > 1) throw erroSync("LOCAL_ID_AMBIGUOUS", "Há mais de uma ficha com este ID local.");
      return clonarJson(correspondencias[0] || null);
    });
  }

  async function salvarNativas(nativas) {
    if (!Array.isArray(nativas)) return Promise.reject(new TypeError("A coleção de Nativas precisa ser uma lista."));
    const snapshot = clonarJson(nativas);
    return serializarPersistenciaLocal(() => {
      gravarNativasArmazenadas(snapshot);
      return clonarJson(snapshot);
    });
  }

  async function salvarNativa(nativa) {
    const snapshot = clonarJson(nativa);
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return Promise.reject(new TypeError("A Nativa precisa ser um objeto."));
    if (typeof snapshot.id !== "string" || !snapshot.id.trim()) return Promise.reject(new TypeError("A Nativa precisa ter um ID local estável."));
    return serializarPersistenciaLocal(() => {
      const dados = lerNativasArmazenadas();
      const indices = dados.flatMap((item, index) => item?.id === snapshot.id ? [index] : []);
      if (indices.length > 1) throw erroSync("LOCAL_ID_AMBIGUOUS", "Há mais de uma ficha com este ID local.");
      if (indices.length === 1) dados[indices[0]] = snapshot;
      else dados.push(snapshot);
      gravarNativasArmazenadas(dados);
      return clonarJson(snapshot);
    });
  }

  async function excluirNativa(localId) {
    validarIdentificador(localId, "local_id");
    return serializarPersistenciaLocal(() => {
      const dados = lerNativasArmazenadas();
      const correspondencias = dados.filter(item => item?.id === localId);
      if (correspondencias.length > 1) throw erroSync("LOCAL_ID_AMBIGUOUS", "Há mais de uma ficha com este ID local.");
      if (!correspondencias.length) return null;
      const restante = dados.filter(item => item?.id !== localId);
      gravarNativasArmazenadas(restante);
      return clonarJson(correspondencias[0]);
    });
  }

  async function consultarEstadoPersistencia() {
    return serializarPersistenciaLocal(() => {
      storage.getItem(CHAVE_DADOS);
      return { available: true, backend: "localStorage" };
    });
  }

  async function presetsJaCarregados() {
    return serializarPersistenciaLocal(() => storage.getItem(CHAVE_PRESETS) === "1");
  }

  async function marcarPresetsCarregados() {
    return serializarPersistenciaLocal(() => { storage.setItem(CHAVE_PRESETS, "1"); return true; });
  }

  async function salvarNativasComFila(nativas, nativaAlterada = null) {
    if (!Array.isArray(nativas)) return Promise.reject(new TypeError("A coleção de Nativas precisa ser uma lista."));
    const colecao = clonarJson(nativas);
    const snapshot = nativaAlterada ? clonarJson(nativaAlterada) : null;
    return serializarPersistenciaLocal(async () => {
      gravarNativasArmazenadas(colecao);
      if (!snapshot || typeof snapshot.id !== "string" || !snapshot.id.trim()) {
        return { persisted: true, queueResult: null, queueError: null };
      }
      try {
        const queueResult = await enfileirarSaveSeAssociada(snapshot);
        return { persisted: true, queueResult, queueError: null };
      } catch (queueError) {
        return { persisted: true, queueResult: null, queueError };
      }
    });
  }

  async function salvarNativaComFila(nativa) {
    const snapshot = clonarJson(nativa);
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) throw new TypeError("A Nativa precisa ser um objeto.");
    validarIdentificador(snapshot.id, "local_id");
    return serializarPersistenciaLocal(async () => {
      const dados = lerNativasArmazenadas();
      const indices = dados.flatMap((item, index) => item?.id === snapshot.id ? [index] : []);
      if (indices.length > 1) throw erroSync("LOCAL_ID_AMBIGUOUS", "Há mais de uma ficha com este ID local.");
      if (indices.length === 1) dados[indices[0]] = snapshot;
      else dados.push(snapshot);
      gravarNativasArmazenadas(dados);
      try {
        const queueResult = await enfileirarSaveSeAssociada(snapshot);
        return { persisted: true, queueResult, queueError: null };
      } catch (queueError) {
        return { persisted: true, queueResult: null, queueError };
      }
    });
  }

  function abrirDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDBApi.open(DB_NOME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(DB_STORE)) {
          req.result.createObjectStore(DB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function guardarFoto(id, blob) {
    const db = await abrirDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put(blob, id);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }

  async function obterFoto(id) {
    if (!id) return null;
    try {
      const db = await abrirDB();
      return await new Promise((resolve, reject) => {
        const req = db.transaction(DB_STORE).objectStore(DB_STORE).get(id);
        req.onsuccess = () => { db.close(); resolve(req.result || null); };
        req.onerror = () => { db.close(); reject(req.error); };
      });
    } catch {
      return null;
    }
  }

  async function removerFoto(id) {
    if (!id) return;
    try {
      const db = await abrirDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, "readwrite");
        tx.objectStore(DB_STORE).delete(id);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch {
      // Mantém o comportamento tolerante do armazenamento local legado.
    }
  }

  return {
    obterNativas, listarNativas, buscarNativaPorId, salvarNativas, salvarNativa, excluirNativa,
    consultarEstadoPersistencia, salvarNativasComFila, salvarNativaComFila, presetsJaCarregados, marcarPresetsCarregados,
    guardarFoto, obterFoto, removerFoto,
    registrarOrigemNativa, obterOrigemNativa,
    obterMetadadosSincronizacao, salvarMetadadosSincronizacao,
    registrarTombstoneLocal, obterTombstoneLocal, obterTombstoneDaConta, registrarExclusaoLocal,
    registrarOperacaoPendente, listarOperacoesPendentes, listarOperacoesSincronizacao,
    listarConflitosSincronizacao, listarHistoricoConflitosSincronizacao, obterResumoFilaSincronizacao, prepararOperacaoParaSincronizacao,
    registrarFalhaOperacaoSincronizacao, registrarConflitoOperacaoSincronizacao, concluirOperacaoSincronizacao,
    resolverConflitoManterLocal, resolverConflitoAceitarRemoto,
    associarNativaAConta, enfileirarSaveSeAssociada, podeEditarNativa, obterEstadosSincronizacao
  };
}

export const repositorioLocal = criarRepositorioLocal();
import { obterClienteSupabase } from "./auth.js";

