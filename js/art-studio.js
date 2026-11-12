import { obterClienteSupabase } from "./auth.js";

const CATEGORIAS = new Set(["nativa", "biome", "technique", "other"]);
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

async function mensagemErro(error, fallback) {
  const context=error?.context;
  if(context&&typeof context.clone==="function"){
    try{const payload=await context.clone().json();if(typeof payload?.error==="string"&&payload.error)return payload.error;}catch{/* O servidor pode retornar uma resposta sem JSON. */}
  }
  return error?.message || context?.message || fallback;
}

export function criarEstudioImagens({ clientProvider = obterClienteSupabase, wait = ms => new Promise(resolve => setTimeout(resolve, ms)), maxPolls = 90 } = {}) {
  async function gerar({ kind, title, prompt, onProgress = () => {} }) {
    if (!CATEGORIAS.has(kind)) throw new TypeError("Escolha uma categoria de imagem válida.");
    const cleanTitle = String(title || "").trim();
    const cleanPrompt = String(prompt || "").trim();
    if (!cleanTitle || cleanTitle.length > 80 || !cleanPrompt || cleanPrompt.length > 1400) {
      throw new TypeError("Informe o tema e uma descrição de até 1.400 caracteres.");
    }
    const client = await clientProvider();
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const userId = sessionData?.session?.user?.id;
    if (!userId) throw new Error("Entre na conta autorizada para gerar imagens.");

    onProgress({ phase: "submitting" });
    const { data: task, error: startError } = await client.functions.invoke("generate-art", {
      body: { action: "start", kind, title: cleanTitle, prompt: cleanPrompt }
    });
    if (startError) throw new Error(await mensagemErro(startError, "Não foi possível iniciar a geração."));
    if (typeof task?.taskToken !== "string" || !task.taskToken) throw new Error("O servidor não retornou uma tarefa protegida válida.");

    for (let attempt = 0; attempt < maxPolls; attempt++) {
      const { data: currentSession, error: currentSessionError } = await client.auth.getSession();
      if (currentSessionError) throw currentSessionError;
      if (currentSession?.session?.user?.id !== userId) throw new Error("A conta mudou durante a geração. A imagem não foi associada à outra conta.");
      await wait(attempt === 0 ? 1500 : 2500);
      const { data: status, error: statusError } = await client.functions.invoke("generate-art", {
        body: { action: "status", taskToken: task.taskToken }
      });
      if (statusError) throw new Error(await mensagemErro(statusError, "Não foi possível consultar a geração."));
      if (status?.status === "failed") throw new Error(status.reason || "O provedor não conseguiu gerar a imagem.");
      onProgress({ phase: "processing", progress: Number(status?.progress) || 0, attempt: attempt + 1, maxPolls });
      if (status?.status !== "succeeded") continue;

      const { data: preDownloadSession, error: preDownloadSessionError } = await client.auth.getSession();
      if (preDownloadSessionError) throw preDownloadSessionError;
      if (preDownloadSession?.session?.user?.id !== userId) throw new Error("A conta mudou durante a geração. A imagem não foi associada à outra conta.");

      const { data: downloaded, error: downloadError, response } = await client.functions.invoke("generate-art", {
        body: { action: "download", taskToken: task.taskToken }
      });
      if (downloadError) throw new Error(await mensagemErro(downloadError, "A geração terminou, mas não foi possível baixar a imagem."));
      const imageType = response?.headers?.get("x-image-content-type")?.toLowerCase();
      if (!(downloaded instanceof Blob) || !IMAGE_TYPES.has(imageType) || downloaded.size === 0 || downloaded.size > 15_000_000) {
        throw new Error("O servidor retornou um arquivo de imagem inválido ou acima de 15 MB.");
      }
      const image = new Blob([downloaded], { type: imageType });
      const { data: finalSession, error: finalSessionError } = await client.auth.getSession();
      if (finalSessionError) throw finalSessionError;
      if (finalSession?.session?.user?.id !== userId) throw new Error("A conta mudou durante a geração. A imagem não foi associada à outra conta.");
      return { blob: image, kind, title: cleanTitle, prompt: cleanPrompt,model:task.model||null,fallbackUsed:Boolean(task.fallbackUsed) };
    }
    throw new Error("A geração ainda não terminou após o limite de espera. Você pode tentar novamente mais tarde.");
  }

  return { gerar };
}

export const estudioImagens = criarEstudioImagens();
