const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const BODY_LIMIT = 40_000;
const JSON_RESPONSE_LIMIT = 1_000_000;
const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 4_000;
const DEFAULT_CHAT_MODEL = "meta/llama-3.3-70b-instruct";
const DEFAULT_CHAT_BASE_URL = "https://integrate.api.nvidia.com";

const SYSTEM_PROMPT = `Você é o assistente administrativo do NATIVA, um RPG de criaturas inspiradas na biodiversidade brasileira com identidade visual em verde-floresta, lima e dourado. Você ajuda o administrador a gerenciar o projeto e a criar arte com o modelo de imagem FLUX.1-dev.

Responda SEMPRE em português brasileiro e SEMPRE em JSON válido, sem texto fora do objeto, no formato:
{"reply": "mensagem para o administrador", "actions": []}

Cada item de "actions" (pode ser vazio) descreve uma ação que o painel pode executar após confirmação do administrador:
- {"type": "generate-image", "kind": "nativa|biome|technique|other", "title": "até 80 caracteres", "prompt": "descrição visual até 1.400 caracteres, em inglês, sem texto ou letras na imagem"} — gera arte no ateliê.
- {"type": "allowlist-add", "userId": "uuid"} ou {"type": "allowlist-remove", "userId": "uuid"} — libera ou bloqueia a geração de imagens para uma conta.
- {"type": "set-role", "userId": "uuid", "role": "player|admin"} — altera o papel de uma conta.

Regras:
- Nunca invente UUIDs; só sugira ações em usuários cujos IDs apareçam na conversa.
- Para pedidos de imagem, escreva prompts detalhados e coerentes com a estética do projeto (criaturas brasileiras, natureza, fantasia polida), sempre em inglês e sem texto/lettering na imagem.
- Não execute nada sozinho: descreva em "reply" o que propõe e deixe as ações em "actions" para o administrador confirmar.
- Se o pedido estiver fora do escopo (administração, arte, conteúdo do jogo), explique brevemente em "reply" e deixe "actions" vazio.`;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

function resolvePublicApiKey(env) {
  let apiKey = env("SUPABASE_ANON_KEY") || env("SUPABASE_PUBLISHABLE_KEY");
  try { apiKey ||= JSON.parse(env("SUPABASE_PUBLISHABLE_KEYS") || "{}").default; }
  catch { /* Somente a chave pública legacy é usada como fallback. */ }
  return apiKey;
}

async function getAuthenticatedUser(request, env, fetchImpl) {
  const bearer = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const supabaseUrl = env("SUPABASE_URL");
  const apiKey = resolvePublicApiKey(env);
  if (!bearer || !supabaseUrl || !apiKey) return null;
  const response = await fetchImpl(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${bearer}`, apikey: apiKey },
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) return null;
  const user = await readJsonResponse(response, JSON_RESPONSE_LIMIT);
  return typeof user?.id === "string" && user.id ? { id: user.id } : null;
}

async function readBoundedBody(request, limit) {
  if (!request.body) throw Object.assign(new Error("invalid_json"), { status: 400 });
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw Object.assign(new Error("too_large"), { status: 413 });
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw Object.assign(new Error("invalid_json"), { status: 400 }); }
}

async function readJsonResponse(response, limit = JSON_RESPONSE_LIMIT) {
  if (!response.body) throw new Error("empty_body");
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw Object.assign(new Error("too_large"), { status: 413 });
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

function validarMensagens(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) return null;
  const limpa = [];
  for (const msg of messages) {
    const role = msg?.role;
    const content = typeof msg?.content === "string" ? msg.content.slice(0, MAX_MESSAGE_CHARS) : "";
    if (role !== "user" && role !== "assistant") return null;
    if (!content.trim()) return null;
    limpa.push({ role, content });
  }
  return limpa;
}

function extrairResposta(content) {
  const texto = String(content || "").trim();
  const cercado = texto.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidato = cercado ? cercado[1].trim() : texto;
  try {
    const parsed = JSON.parse(candidato);
    if (parsed && typeof parsed.reply === "string") {
      const actions = Array.isArray(parsed.actions) ? parsed.actions.filter(a => a && typeof a === "object" && typeof a.type === "string") : [];
      return { reply: parsed.reply, actions };
    }
  } catch { /* Resposta fora do formato vira mensagem simples. */ }
  return { reply: texto || "O assistente não respondeu.", actions: [] };
}

export function createAdminAssistantHandler({ env = () => undefined, fetchImpl = fetch } = {}) {
  async function isAdmin(userId) {
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SECRET_KEY");
    const supabaseUrl = env("SUPABASE_URL");
    if (!serviceKey || !supabaseUrl) return false;
    const response = await fetchImpl(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=role`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) return false;
    const rows = await readJsonResponse(response);
    return Array.isArray(rows) && rows[0]?.role === "admin";
  }

  return async function handleAdminAssistant(request) {
    if (request.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
    if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

    let user;
    try { user = await getAuthenticatedUser(request, env, fetchImpl); }
    catch { return json({ error: "Não foi possível validar a sessão." }, 401); }
    if (!user) return json({ error: "Entre na conta para usar o assistente." }, 401);

    let body;
    try {
      const contentType = request.headers.get("content-type") || "";
      if (!/^application\/json(?:\s*;|$)/i.test(contentType)) return json({ error: "Envie o pedido em JSON." }, 415);
      body = await readBoundedBody(request, BODY_LIMIT);
      if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "O pedido JSON deve ser um objeto." }, 400);
    } catch (error) {
      return json({ error: error?.status === 413 ? "Pedido muito grande." : "Pedido JSON inválido." }, error?.status || 400);
    }

    let admin;
    try { admin = await isAdmin(user.id); }
    catch { return json({ error: "Não foi possível verificar suas permissões." }, 503); }
    if (!admin) return json({ error: "Esta conta não é administradora." }, 403);

    const apiKey = env("NVIDIA_API_KEY");
    if (!apiKey) return json({ error: "O assistente não está configurado no servidor." }, 503);

    const messages = validarMensagens(body.messages);
    if (!messages) return json({ error: `Envie entre 1 e ${MAX_MESSAGES} mensagens de usuário/assistente.` }, 400);

    const baseUrl = (env("NVIDIA_CHAT_BASE_URL") || DEFAULT_CHAT_BASE_URL).replace(/\/$/, "");
    const model = env("NVIDIA_CHAT_MODEL") || DEFAULT_CHAT_MODEL;

    try {
      const response = await fetchImpl(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        signal: AbortSignal.timeout(60_000),
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
          temperature: 0.6,
          max_tokens: 1024
        })
      });
      if (!response.ok) return json({ error: `O provedor recusou a consulta (HTTP ${response.status}).` }, 502);
      const result = await readJsonResponse(response);
      const content = result?.choices?.[0]?.message?.content;
      return json(extrairResposta(content));
    } catch (error) {
      return json({ error: error?.name === "TimeoutError" ? "O assistente demorou demais para responder." : "Falha ao consultar o assistente." }, 502);
    }
  };
}
