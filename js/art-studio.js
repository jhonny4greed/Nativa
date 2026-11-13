import { obterClienteSupabase } from "./auth.js";
import { montarPromptImagem } from "./art-prompts.js";

const CATEGORIAS = new Set(["nativa", "biome", "technique", "other"]);
const LIMITE_IMAGEM = 15_000_000;
let sdkPromise;
export function carregarPuter() {
  if (globalThis.puter?.ai?.txt2img) return Promise.resolve(globalThis.puter);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    let script = document.getElementById("nativa-puter-sdk");
    if (!script) {
      script = document.createElement("script");
      script.id = "nativa-puter-sdk";
      script.src = "https://js.puter.com/v2/";
      script.async = true;
      document.head.append(script);
    }
    const started = Date.now();
    const check = setInterval(() => {
      if (globalThis.puter?.ai?.txt2img) {
        clearInterval(check);
        resolve(globalThis.puter);
      } else if (Date.now() - started > 15000) {
        clearInterval(check);
        script.remove();
        reject(
          new Error(
            "Não foi possível carregar o Puter. Confira a conexão ou o bloqueador de scripts e tente conectar novamente."
          )
        );
      }
    }, 50);
  }).catch(error => {
    sdkPromise = null;
    throw error;
  });
  return sdkPromise;
}
// Call directly from the user's click, before awaiting other network operations.
export function conectarPuter() {
  if (!globalThis.puter?.auth?.signIn) throw new Error("Aguarde o carregamento do Puter antes de conectar.");
  return globalThis.puter.auth.signIn();
}
export function erroPuter(error) {
  const code = String(error?.errorCode || error?.code || error?.error?.code || error?.error || "");
  const message = String(error?.message || error?.msg || error?.error?.message || "");
  if (/popup_blocked/i.test(code + message))
    return "O navegador bloqueou o login. Clique em Conectar conta Puter e permita a janela de autenticação.";
  if (/auth_window_closed|cancel/i.test(code))
    return "A conexão com o Puter foi cancelada. Nenhuma nova geração foi iniciada.";
  if (/insufficient|balance|credit|payment|funds|usage_limit/i.test(code + message))
    return "Sua conta Puter não tem saldo ou limite disponível para gerar esta imagem. Confira o saldo no Puter; os créditos são administrados pela conta Puter.";
  if (/moderation|content_policy|safety/i.test(code + message))
    return "O Puter recusou a descrição pelo filtro de conteúdo. Ajuste o pedido antes de tentar novamente.";
  return message || "Não foi possível gerar a imagem com o Puter. Confira a conexão e a conta conectada.";
}
function tipoImagem(bytes) {
  if (
    bytes.length >= 8 &&
    bytes[0] === 137 &&
    bytes[1] === 80 &&
    bytes[2] === 78 &&
    bytes[3] === 71 &&
    bytes[4] === 13 &&
    bytes[5] === 10 &&
    bytes[6] === 26 &&
    bytes[7] === 10
  )
    return "image/png";
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  return null;
}
export function criarEstudioImagens({
  clientProvider = obterClienteSupabase,
  sdkProvider = carregarPuter,
  fetchImpl = globalThis.fetch
} = {}) {
  let generating = false;
  async function gerar({ kind, title, prompt, onProgress = () => {} }) {
    if (!CATEGORIAS.has(kind)) throw new TypeError("Escolha uma categoria de imagem válida.");
    const cleanTitle = String(title || "").trim(),
      cleanPrompt = String(prompt || "").trim();
    if (!cleanTitle || cleanTitle.length > 80 || !cleanPrompt || cleanPrompt.length > 1400)
      throw new TypeError("Informe o tema e uma descrição de até 1.400 caracteres.");
    if (generating) throw new Error("Já há uma geração em andamento. Aguarde antes de iniciar outra.");
    generating = true;
    try {
      const client = await clientProvider();
      async function contaAtual() {
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        return data?.session?.user?.id;
      }
      const userId = await contaAtual();
      if (!userId) throw new Error("Entre na sua conta NATIVA antes de gerar imagens.");
      const sdk = await sdkProvider();
      if (!(await sdk.auth.isSignedIn()))
        throw new Error("Conecte sua conta Puter no Ateliê de imagens antes de gerar a ilustração.");
      const validarConta = async () => {
        if ((await contaAtual()) !== userId)
          throw new Error("A conta mudou durante a geração. A imagem não foi associada à outra conta.");
      };
      await validarConta();
      onProgress({ phase: "generating" });
      let image;
      try {
        image = await sdk.ai.txt2img(
          montarPromptImagem({ kind, title: cleanTitle, prompt: cleanPrompt })
        );
      } catch (error) {
        throw new Error(erroPuter(error), { cause: error });
      }
      await validarConta();
      if (typeof image?.src !== "string" || !image.src) throw new Error("O Puter não retornou uma imagem válida.");
      if (!/^(https?:|blob:|data:image\/(png|jpeg|webp)[;,])/i.test(image.src))
        throw new Error("O Puter retornou um endereço de imagem inválido.");
      onProgress({ phase: "downloading" });
      let response;
      try {
        response = await fetchImpl(image.src, { signal: AbortSignal.timeout(30000), credentials: "omit" });
      } catch {
        throw new Error(
          "A imagem foi gerada, mas não foi possível baixá-la para salvar no acervo. Não será iniciada outra geração automaticamente."
        );
      }
      if (!response.ok) throw new Error("A imagem foi gerada, mas o download foi recusado pelo Puter.");
      if (Number(response.headers.get("content-length")) > LIMITE_IMAGEM)
        throw new Error("A imagem gerada excede o limite de 15 MB do acervo.");
      const blob = await response.blob();
      if (!blob.size || blob.size > LIMITE_IMAGEM)
        throw new Error("O Puter retornou uma imagem vazia ou acima de 15 MB.");
      const bytes = new Uint8Array(await blob.arrayBuffer()),
        type = tipoImagem(bytes);
      if (!type) throw new Error("O Puter retornou um arquivo que não é PNG, JPG ou WebP válido.");
      await validarConta();
      return {
        blob: new Blob([blob], { type }),
        kind,
        title: cleanTitle,
        prompt: cleanPrompt,
        provider: "puter",
        model: "Puter · padrão",
        fallbackUsed: false
      };
    } finally {
      generating = false;
    }
  }
  return { gerar };
}
export const estudioImagens = criarEstudioImagens();
