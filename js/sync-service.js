import { obterClienteSupabase } from "./auth.js";
import { repositorioLocal } from "./repository.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validarResposta(data, localId) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("O Supabase retornou uma resposta de sincronização inválida.");
  if (data.local_id !== localId) throw new Error("A resposta do Supabase corresponde a outra ficha.");
  if (!new Set(["saved", "conflict", "deleted", "not_found"]).has(data.status)) {
    throw new Error(`Status de sincronização inesperado: ${String(data.status)}.`);
  }
  if (["saved", "conflict", "deleted"].includes(data.status)) {
    if (typeof data.remote_id !== "string" || !UUID.test(data.remote_id)) throw new Error("A resposta do Supabase não contém um UUID remoto válido.");
    if (!Number.isInteger(data.revision) || data.revision <= 0) throw new Error("A resposta do Supabase não contém uma revisão válida.");
  }
  if (data.format_version !== undefined && data.format_version !== null
    && (!Number.isInteger(data.format_version) || data.format_version <= 0)) {
    throw new Error("A resposta do Supabase contém uma versão de formato inválida.");
  }
  if (data.data !== undefined && data.data !== null
    && (typeof data.data !== "object" || Array.isArray(data.data) || data.data.id !== localId)) {
    throw new Error("A resposta do Supabase contém uma ficha remota incompatível.");
  }
  return data;
}

export function criarServicoSincronizacao({ clientProvider = obterClienteSupabase, repository = repositorioLocal } = {}) {
  let syncing = false;

  async function sincronizar({ onProgress = () => {} } = {}) {
    if (syncing) throw new Error("Já existe uma sincronização em andamento nesta aba.");
    syncing = true;
    let processed = 0;
    let saved = 0;
    let conflicts = 0;
    let failed = 0;
    try {
      const client = await clientProvider();
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      const userId = data?.session?.user?.id;
      if (!userId) throw new Error("Entre na sua conta para iniciar a sincronização manual.");
      const assertSameSession = async () => {
        const current = await client.auth.getSession();
        if (current.error) throw current.error;
        if (current.data?.session?.user?.id !== userId) {
          const error = new Error("A conta ativa mudou durante a sincronização. A operação atual não foi confirmada localmente; entre na conta original e tente novamente.");
          error.code = "SESSION_CHANGED";
          throw error;
        }
      };

      const initial = await repository.listarOperacoesSincronizacao();
      const localIds = [...new Set(initial
        .filter(item => ["pending", "blocked", "failed", "conflict"].includes(item.status))
        .map(item => item.localId))];
      const total = initial.filter(item => ["pending", "failed"].includes(item.status)).length;
      onProgress({ phase: "started", total, processed, saved, conflicts, failed });

      for (const localId of localIds) {
        while (true) {
          await assertSameSession();
          const current = await repository.listarOperacoesSincronizacao();
          const queue = current.filter(item => item.localId === localId
            && ["pending", "blocked", "failed", "conflict"].includes(item.status))
            .sort((a, b) => a.sequence - b.sequence);
          const next = queue[0];
          if (!next || ["blocked", "conflict"].includes(next.status)) break;

          let prepared;
          try {
            prepared = await repository.prepararOperacaoParaSincronizacao(next.operationId);
          } catch (prepareError) {
            if (["DEPENDENCY_UNRESOLVED", "REMOTE_REVISION_REQUIRED", "OPERATION_NOT_READY"].includes(prepareError.code)) break;
            await repository.registrarFalhaOperacaoSincronizacao(next.operationId, prepareError);
            failed++;
            processed++;
            onProgress({ phase: "operation-failed", localId, operationId: next.operationId, message: prepareError.message, total, processed, saved, conflicts, failed });
            break;
          }

          const rpcName = prepared.operation.type === "delete" ? "delete_nativa" : "save_nativa";
          const args = { p_operation_id: prepared.operation.operationId, ...prepared.request };
          try {
            await assertSameSession();
            const { data: response, error: rpcError } = await client.rpc(rpcName, args);
            if (rpcError) throw rpcError;
            const result = validarResposta(response, localId);
            await assertSameSession();
            const success = prepared.operation.type === "delete" ? result.status === "deleted" : result.status === "saved";
            if (success) {
              await repository.concluirOperacaoSincronizacao(prepared.operation.operationId, result);
              saved++;
              processed++;
              onProgress({ phase: "operation-saved", localId, operationId: prepared.operation.operationId, type: prepared.operation.type, total, processed, saved, conflicts, failed });
              continue;
            }
            if (["conflict", "deleted", "not_found"].includes(result.status)) {
              const conflict = await repository.registrarConflitoOperacaoSincronizacao(prepared.operation.operationId, result);
              conflicts++;
              processed++;
              onProgress({ phase: "conflict", localId, operationId: prepared.operation.operationId, conflictId: conflict.conflictId, status: result.status, total, processed, saved, conflicts, failed });
              break;
            }
            throw new Error(`Resposta incompatível com operação ${prepared.operation.type}.`);
          } catch (operationError) {
            if (operationError.code === "SESSION_CHANGED") throw operationError;
            await repository.registrarFalhaOperacaoSincronizacao(prepared.operation.operationId, operationError);
            failed++;
            processed++;
            onProgress({ phase: "operation-failed", localId, operationId: prepared.operation.operationId, message: operationError.message || "Falha na comunicação com o Supabase.", total, processed, saved, conflicts, failed });
            break;
          }
        }
      }

      const summary = await repository.obterResumoFilaSincronizacao();
      const result = { processed, saved, conflicts, failed, summary };
      onProgress({ phase: "complete", ...result });
      return result;
    } finally {
      syncing = false;
    }
  }

  return { sincronizar, get syncing() { return syncing; } };
}

export const servicoSincronizacao = criarServicoSincronizacao();
