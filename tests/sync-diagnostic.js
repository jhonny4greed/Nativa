import { criarNativa } from "../js/nativa-domain.js";
import { obterClienteSupabase } from "../js/auth.js";
import { SUPABASE_URL } from "../js/supabase-config.js";
import { repositorioLocal } from "../js/repository.js";
import { criarServicoSincronizacao } from "../js/sync-service.js";

const MARKER_KEY = "nativa.prototype.syncDiagnostic.fixture.v1";
const $ = selector => document.querySelector(selector);
const sessionEl = $("#session");
const evidenceEl = $("#evidence");
const actionsEl = $("#actions");
const buttons = {
  create: $("#create"), edit: $("#edit"), sync: $("#sync"),
  delete: $("#delete"), syncDelete: $("#sync-delete"), cleanupPhoto: $("#cleanup-photo")
};

let client = null;
let currentSession = null;
let currentMarker = null;

function assertLocalTarget() {
  const supabaseHost = new URL(SUPABASE_URL).hostname;
  const pageHost = location.hostname;
  if (!new Set(["127.0.0.1", "localhost"]).has(supabaseHost)
    || !new Set(["127.0.0.1", "localhost"]).has(pageHost)) {
    throw new Error("Diagnóstico bloqueado: página e Supabase precisam estar em localhost/127.0.0.1.");
  }
}

function readMarker() {
  try {
    const value = JSON.parse(localStorage.getItem(MARKER_KEY) || "null");
    if (!value || typeof value.localId !== "string" || !value.localId.startsWith("nativa-2d3d-diagnostic-")) return null;
    return value;
  } catch {
    return null;
  }
}

function writeMarker(marker) {
  localStorage.setItem(MARKER_KEY, JSON.stringify(marker));
  currentMarker = marker;
  history.replaceState(null, "", `${location.pathname}${location.search}#${encodeURIComponent(marker.localId)}`);
}

async function hashJson(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function setAction(message) {
  actionsEl.textContent = `${new Date().toLocaleTimeString()} · ${message}`;
}

function ensureOwner() {
  if (!currentSession?.user?.id) throw new Error("Entre na conta de teste pela tela principal do NATIVA.");
  if (!currentMarker) throw new Error("Crie primeiro uma ficha descartável nesta ferramenta.");
  if (currentMarker.ownerId !== currentSession.user.id) {
    throw new Error("Esta fixture pertence a outra conta. A ferramenta bloqueou a edição para preservar o isolamento.");
  }
}

function createFixtureScopedSyncService(localId) {
  const scopedRepository = new Proxy(repositorioLocal, {
    get(target, property) {
      if (property === "listarOperacoesSincronizacao") {
        return async () => (await target.listarOperacoesSincronizacao())
          .filter(operation => operation.localId === localId);
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
  return criarServicoSincronizacao({ repository: scopedRepository });
}

function blobProbe() {
  const base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS6kAAAAASUVORK5CYII=";
  const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
  return new Blob([bytes], { type: "image/png" });
}

async function refreshDiagnostic() {
  if (!client) return;
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  currentSession = data?.session || null;
  currentMarker = readMarker();
  const userId = currentSession?.user?.id || null;
  sessionEl.textContent = userId
    ? `Sessão ativa · user_id ${userId} · ${currentSession.user.email || "sem e-mail"}`
    : "Sem sessão ativa. Volte ao NATIVA, entre na conta e abra novamente este diagnóstico. Dados locais não serão associados nem enviados.";

  buttons.create.disabled = !userId || Boolean(currentMarker && !currentMarker.photoCleaned);
  buttons.edit.disabled = true;
  buttons.sync.disabled = !userId;
  buttons.delete.disabled = true;
  buttons.syncDelete.disabled = !userId;
  buttons.cleanupPhoto.disabled = true;

  const marker = currentMarker;
  if (!marker) {
    evidenceEl.textContent = JSON.stringify({
      pageOrigin: location.origin,
      supabaseUrl: SUPABASE_URL,
      sessionUserId: userId,
      indexedDBAvailable: Boolean(globalThis.indexedDB),
      fixture: null,
      note: "Nenhuma fixture de diagnóstico registrada."
    }, null, 2);
    return;
  }

  const localFicha = await repositorioLocal.buscarNativaPorId(marker.localId);
  const localState = await repositorioLocal.obterEstadosSincronizacao([marker.localId]);
  const association = localState.byLocalId[marker.localId] || null;
  const operations = await repositorioLocal.listarOperacoesSincronizacao();
  const related = operations.filter(operation => operation.localId === marker.localId)
    .sort((left, right) => left.sequence - right.sequence);
  const firstOperation = related.find(operation => operation.operationId === marker.firstOperationId) || null;
  const snapshotHash = firstOperation ? await hashJson(firstOperation.snapshot) : null;
  let photoEvidence = { found: false };
  if (marker.photoId) {
    const photo = await repositorioLocal.obterFoto(marker.photoId);
    photoEvidence = photo
      ? { found: true, isBlob: photo instanceof Blob, type: photo.type, size: photo.size }
      : { found: false };
  }
  const metadata = userId && marker.ownerId === userId
    ? await repositorioLocal.obterMetadadosSincronizacao(marker.localId)
    : null;
  let remoteRead = null;
  if (userId && marker.ownerId === userId && metadata?.remoteId) {
    const { data: remoteData, error: remoteError } = await client.from("nativas")
      .select("id,local_id,revision,data,deleted_at")
      .eq("local_id", marker.localId)
      .maybeSingle();
    remoteRead = remoteError
      ? { error: remoteError.message }
      : remoteData ? {
        id: remoteData.id,
        localId: remoteData.local_id,
        revision: remoteData.revision,
        deletedAt: remoteData.deleted_at,
        photoId: remoteData.data?.photoId || null,
        unknownField: remoteData.data?.diagnosticUnknownField || null,
        containsBlob: false
      } : null;
  }
  const accountTombstone = userId && marker.ownerId === userId
    ? await repositorioLocal.obterTombstoneDaConta(marker.localId)
    : null;
  const localTombstone = await repositorioLocal.obterTombstoneLocal(marker.localId);
  const canEdit = userId ? await repositorioLocal.podeEditarNativa(marker.localId) : { allowed: false, reason: "AUTH_REQUIRED" };

  buttons.edit.disabled = !userId || marker.ownerId !== userId || !localFicha || !canEdit.allowed;
  buttons.delete.disabled = !userId || marker.ownerId !== userId || !localFicha || !canEdit.allowed;
  buttons.sync.disabled = !userId || !related.some(operation => operation.type === "save" && ["pending", "failed"].includes(operation.status));
  buttons.syncDelete.disabled = !userId || marker.ownerId !== userId
    || !related.some(operation => operation.type === "delete" && ["pending", "failed"].includes(operation.status));
  buttons.cleanupPhoto.disabled = !userId || marker.ownerId !== userId || !marker.photoId
    || !accountTombstone || accountTombstone.status !== "completed";

  const evidence = {
    pageOrigin: location.origin,
    supabaseUrl: SUPABASE_URL,
    sessionUserId: userId,
    fixture: {
      localId: marker.localId,
      ownerUserId: marker.ownerId,
      associationState: association?.associationState || null,
      canEdit: canEdit.allowed,
      localFichaPresent: Boolean(localFicha),
      localFichaName: localFicha?.name || null,
      firstOperationId: marker.firstOperationId,
      firstOperationStatus: firstOperation?.status || null,
      firstOperationSequence: firstOperation?.sequence || null,
      firstSnapshotSha256Expected: marker.initialSnapshotSha256,
      firstSnapshotSha256Current: snapshotHash,
      firstSnapshotUnchanged: Boolean(snapshotHash && snapshotHash === marker.initialSnapshotSha256),
      operationsVisibleForCurrentAccount: related.map(operation => ({
        operationId: operation.operationId,
        type: operation.type,
        sequence: operation.sequence,
        status: operation.status,
        expectedRevision: operation.expectedRevision,
        dependsOn: operation.dependsOn
      })),
      remoteId: metadata?.remoteId || null,
      remoteRevision: metadata?.remoteRevision || null,
      syncState: metadata?.syncState || null,
      remoteReadUnderCurrentRls: remoteRead,
      tombstoneStatus: accountTombstone?.status || localTombstone?.status || null,
      tombstoneSnapshotPresent: Boolean(accountTombstone?.snapshot || localTombstone?.snapshot),
      photoId: marker.photoId,
      photoStoredLocally: photoEvidence
    },
    indexedDBAvailable: Boolean(globalThis.indexedDB)
  };
  evidenceEl.textContent = JSON.stringify(evidence, null, 2);
}

buttons.create.addEventListener("click", async () => {
  try {
    if (!currentSession?.user?.id) throw new Error("Entre primeiro na conta descartável A.");
    if (currentMarker && !currentMarker.photoCleaned) {
      throw new Error("Já existe uma fixture marcada. Conclua ou remova a foto da fixture anterior antes de criar outra.");
    }
    const localId = `nativa-2d3d-diagnostic-${crypto.randomUUID()}`;
    const photoId = `nativa-2d3d-photo-${crypto.randomUUID()}`;
    const ficha = criarNativa({
      id: localId,
      name: `Nativa de diagnóstico ${new Date().toISOString()}`,
      player: "Conta descartável de teste",
      groupBio: "Mamíferos",
      lineage: "Felinos",
      species: "Onça-pintada (fixture técnica)",
      bioma: "Floresta e Mata",
      affinity: "Terra",
      archetype: "Guardião",
      attrs: { ATQ: 4, POT: 4, DEF: 4, RES: 4, AGI: 4, HP: 4, MP: 4 },
      techniques: [],
      tracos: []
    });
    ficha.photoId = photoId;
    ficha.diagnosticUnknownField = { retained: true, token: crypto.randomUUID() };
    await repositorioLocal.guardarFoto(photoId, blobProbe());
    await repositorioLocal.salvarNativa(ficha);
    await repositorioLocal.registrarOrigemNativa(localId, "player");
    const associated = await repositorioLocal.associarNativaAConta(ficha);
    if (!associated.operation) throw new Error("A associação explícita não gerou o primeiro save.");
    const marker = {
      localId,
      photoId,
      ownerId: currentSession.user.id,
      firstOperationId: associated.operation.operationId,
      initialSnapshotSha256: await hashJson(associated.operation.snapshot),
      createdAt: new Date().toISOString()
    };
    writeMarker(marker);
    setAction(`Fixture criada localmente. operation_id ${marker.firstOperationId}. Nada foi enviado; use Sincronizar agora para enviar ao Supabase local.`);
    await refreshDiagnostic();
  } catch (error) {
    setAction(`Falha ao criar fixture: ${error.message}`);
  }
});

buttons.edit.addEventListener("click", async () => {
  try {
    ensureOwner();
    const ficha = await repositorioLocal.buscarNativaPorId(currentMarker.localId);
    if (!ficha) throw new Error("A ficha local não está presente; recupere o estado antes de editar.");
    const next = structuredClone(ficha);
    const editCount = (currentMarker.editCount || 0) + 1;
    next.name = `${ficha.name} · edição ${editCount}`;
    next.attrs.ATQ = (Number(next.attrs.ATQ) || 0) + 1;
    next.diagnosticUnknownField = { ...next.diagnosticUnknownField, retained: true, editCount };
    const result = await repositorioLocal.salvarNativaComFila(next);
    if (!result.persisted) throw new Error("A ficha não foi persistida.");
    if (result.queueError) throw new Error(`A ficha ficou salva localmente, mas a fila falhou: ${result.queueError.message}`);
    writeMarker({ ...currentMarker, editCount });
    setAction(`Edição ${editCount} salva no repository real; verifique sequência e snapshot anterior. Não houve envio.`);
    await refreshDiagnostic();
  } catch (error) {
    setAction(`Edição não concluída: ${error.message}`);
  }
});

buttons.sync.addEventListener("click", async () => {
  try {
    ensureOwner();
    buttons.sync.disabled = true;
    setAction("Enviando operações da conta ativa por ação explícita…");
    const result = await createFixtureScopedSyncService(currentMarker.localId).sincronizar();
    setAction(`Sync concluído: ${result.saved} salvos, ${result.conflicts} conflitos, ${result.failed} falhas. Veja IDs, revisão e status abaixo.`);
    await refreshDiagnostic();
  } catch (error) {
    setAction(`Sync não concluído; a fila deve permanecer para inspeção: ${error.message}`);
    await refreshDiagnostic().catch(() => undefined);
  }
});

buttons.delete.addEventListener("click", async () => {
  try {
    ensureOwner();
    const ficha = await repositorioLocal.buscarNativaPorId(currentMarker.localId);
    if (!ficha) throw new Error("A ficha local já não está no bestiário.");
    const deletion = await repositorioLocal.registrarExclusaoLocal({
      operationId: crypto.randomUUID(), localId: currentMarker.localId, snapshot: ficha
    });
    if (!deletion.operation) throw new Error(`A exclusão foi apenas local (${deletion.status}); não há operação remota para enviar.`);
    await repositorioLocal.excluirNativa(currentMarker.localId);
    setAction(`Tombstone e operação delete ${deletion.operation.operationId} registrados; a ficha saiu do bestiário. Clique em Sincronizar exclusão para enviar.`);
    await refreshDiagnostic();
  } catch (error) {
    setAction(`Exclusão não concluída: ${error.message}`);
  }
});

buttons.syncDelete.addEventListener("click", async () => {
  try {
    ensureOwner();
    buttons.syncDelete.disabled = true;
    const result = await createFixtureScopedSyncService(currentMarker.localId).sincronizar();
    setAction(`Sync explícito concluído: ${result.saved} operações confirmadas, ${result.conflicts} conflitos, ${result.failed} falhas.`);
    await refreshDiagnostic();
  } catch (error) {
    setAction(`Exclusão remota não confirmada; tombstone/fila foram mantidos: ${error.message}`);
    await refreshDiagnostic().catch(() => undefined);
  }
});

buttons.cleanupPhoto.addEventListener("click", async () => {
  try {
    ensureOwner();
    const tombstone = await repositorioLocal.obterTombstoneDaConta(currentMarker.localId);
    if (tombstone?.status !== "completed") throw new Error("Só é permitido remover a foto local após confirmar o tombstone remoto.");
    await repositorioLocal.removerFoto(currentMarker.photoId);
    writeMarker({ ...currentMarker, photoCleaned: true });
    setAction("Blob descartável removido do IndexedDB local após o tombstone. O tombstone permanece para recuperação/auditoria.");
    await refreshDiagnostic();
  } catch (error) {
    setAction(`Limpeza da foto não concluída: ${error.message}`);
  }
});

$("#refresh").addEventListener("click", () => {
  refreshDiagnostic().then(() => setAction("Diagnóstico atualizado por leitura dos módulos reais.")).catch(error => setAction(`Falha ao ler estado: ${error.message}`));
});

try {
  assertLocalTarget();
  if (!globalThis.indexedDB || !globalThis.localStorage) throw new Error("Este navegador não oferece localStorage/IndexedDB reais.");
  client = await obterClienteSupabase();
  await refreshDiagnostic();
  client.auth.onAuthStateChange(() => {
    // Atualiza apenas a leitura da fila da conta ativa; nunca inicia sync.
    setTimeout(() => { void refreshDiagnostic().catch(error => setAction(`Falha ao atualizar sessão: ${error.message}`)); }, 0);
  });
} catch (error) {
  sessionEl.textContent = `Diagnóstico indisponível: ${error.message}`;
  evidenceEl.textContent = JSON.stringify({ pageOrigin: location.origin, supabaseUrl: SUPABASE_URL, error: error.message }, null, 2);
  for (const button of Object.values(buttons)) button.disabled = true;
}
