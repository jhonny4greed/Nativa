const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "X-Image-Content-Type"
};

const BODY_LIMIT = 12_000;
const JSON_RESPONSE_LIMIT = 1_000_000;
const RESULT_LIMIT = 15_000_000;
const RESULT_TTL = 15 * 60 * 1000;
const TASK_TOKEN_TTL = 30 * 60 * 1000;
const TASK_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const DEFAULT_MODEL = "black-forest-labs/flux.1-dev";
const DEFAULT_BASE_URL = "https://integrate.api.nvidia.com";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

function b64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromB64url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new TypeError("Invalid token encoding");
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function fromBase64(value) {
  if (typeof value !== "string" || !value) throw new Error("empty_image");
  const binary = atob(value);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function signature(value, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

async function createTaskToken(taskId, userId, secret, now) {
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ taskId, userId, exp: now + TASK_TOKEN_TTL })));
  return `${payload}.${await signature(payload, secret)}`;
}

async function readTaskToken(token, userId, secret, now) {
  try {
    if (typeof token !== "string" || token.length > 2048) return null;
    const [payload, providedSignature, extra] = token.split(".");
    if (!payload || !providedSignature || extra) return null;
    const expectedBytes = fromB64url(await signature(payload, secret));
    const actualBytes = fromB64url(providedSignature);
    if (actualBytes.length !== expectedBytes.length) return null;
    let mismatch = 0;
    for (let i = 0; i < actualBytes.length; i++) mismatch |= actualBytes[i] ^ expectedBytes[i];
    if (mismatch !== 0) return null;
    const claims = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    if (claims?.userId !== userId || typeof claims.taskId !== "string" || !TASK_ID_PATTERN.test(claims.taskId)
      || !Number.isSafeInteger(claims.exp) || claims.exp <= now || claims.exp > now + TASK_TOKEN_TTL + 60_000) return null;
    return claims.taskId;
  } catch { return null; }
}

async function readBoundedBody(request, limit) {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > limit)) {
    throw Object.assign(new Error("too_large"), { status: 413 });
  }
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

function makePrompt(kind, title, prompt) {
  const contexts = {
    nativa: "Original full-body creature character concept art for the NATIVA Brazilian fantasy RPG, biologically coherent animal-inspired fantasy creature, expressive silhouette, polished game illustration, simple uncluttered background, no text, no lettering.",
    biome: "Environment concept art for a Brazilian fantasy tabletop RPG, expansive readable landscape, distinctive plants, terrain and atmosphere, polished game illustration, no characters in foreground, no text, no lettering.",
    technique: "Dynamic fantasy RPG technique illustration, clear readable action and elemental visual effect, dramatic composition, polished game art, no UI, no text, no lettering.",
    other: "Original fantasy RPG concept art, polished game illustration, clear subject and composition, no text, no lettering."
  };
  return `${contexts[kind]} Subject: ${title}. Details: ${prompt}`.slice(0, 1900);
}

function detectImageType(bytes) {
  if (bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12
    && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  return null;
}

async function readJsonResponse(response, limit = JSON_RESPONSE_LIMIT) {
  const contentType = (response.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json" && !contentType.endsWith("+json")) throw new Error("invalid_json_type");
  if (!response.body) throw new Error("empty_body");
  const length = response.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > limit)) throw Object.assign(new Error("too_large"), { status: 413 });
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

export function createGenerateArtHandler({ env = () => undefined, fetchImpl = fetch, now = () => Date.now(), randomUUID = () => crypto.randomUUID() } = {}) {
  // Resultados gerados ficam em memória no isolate por até RESULT_TTL.
  // O provedor NVIDIA responde de forma síncrona; o download é único.
  const results = new Map();

  function sweepResults() {
    const current = now();
    for (const [id, entry] of results) if (entry.expiresAt <= current) results.delete(id);
  }

  async function generateImage(prompt) {
    const baseUrl = (env("NVIDIA_API_BASE_URL") || DEFAULT_BASE_URL).replace(/\/$/, "");
    const model = env("NVIDIA_IMAGE_MODEL") || DEFAULT_MODEL;
    const apiKey = env("NVIDIA_API_KEY");
    const response = await fetchImpl(`${baseUrl}/v1/genai/${model}`, {
      method: "POST",
      signal: AbortSignal.timeout(120_000),
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, width: 1024, height: 1024 })
    });
    if (!response.ok) throw Object.assign(new Error("provider_rejected"), { status: response.status });
    const result = await readJsonResponse(response);
    const encoded = result?.artifacts?.[0]?.base64_image
      || result?.images?.[0]?.base64_image
      || result?.artifacts?.[0]?.image;
    const bytes = fromBase64(encoded);
    if (bytes.byteLength === 0 || bytes.byteLength > RESULT_LIMIT) throw new Error("invalid_image_size");
    const contentType = detectImageType(bytes);
    if (!contentType) throw new Error("invalid_image_content");
    return { bytes, contentType };
  }

  return async function handleGenerateArt(request) {
    if (request.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
    if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

    let user;
    try { user = await getAuthenticatedUser(request, env, fetchImpl); }
    catch { return json({ error: "Não foi possível validar a sessão." }, 401); }
    if (!user) return json({ error: "Entre na conta para gerar imagens." }, 401);

    const allowlist = (env("IMAGE_GENERATION_ALLOWED_USER_IDS") || "").split(",").map(id => id.trim()).filter(Boolean);
    if (!allowlist.includes(user.id)) return json({ error: "Esta conta ainda não está autorizada a consumir créditos de geração." }, 403);

    let body;
    try {
      const contentType = request.headers.get("content-type") || "";
      if (!/^application\/json(?:\s*;|$)/i.test(contentType)) return json({ error: "Envie o pedido em JSON." }, 415);
      body = await readBoundedBody(request, BODY_LIMIT);
      if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "O pedido JSON deve ser um objeto." }, 400);
    } catch (error) {
      return json({ error: error?.status === 413 ? "Pedido muito grande." : "Pedido JSON inválido." }, error?.status || 400);
    }

    const apiKey = env("NVIDIA_API_KEY");
    const signingKey = env("IMAGE_TASK_SIGNING_KEY");
    if (!apiKey || !signingKey || new TextEncoder().encode(signingKey).byteLength < 32) {
      return json({ error: "Geração de imagens não configurada corretamente no servidor." }, 503);
    }

    if (body.action === "start") {
      const kind = body.kind;
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
      if (!new Set(["nativa", "biome", "technique", "other"]).has(String(kind))
        || !title || title.length > 80 || !prompt || prompt.length > 1400) {
        return json({ error: "Informe uma categoria, um tema de até 80 caracteres e uma descrição de até 1.400 caracteres." }, 400);
      }
      try {
        sweepResults();
        const image = await generateImage(makePrompt(kind, title, prompt));
        const taskId = randomUUID();
        results.set(taskId, { ...image, expiresAt: now() + RESULT_TTL });
        return json({ taskToken: await createTaskToken(taskId, user.id, signingKey, now()) });
      } catch (error) {
        const status = error?.status === 413 ? 413 : 502;
        const message = error?.name === "TimeoutError" ? "O provedor demorou demais para gerar a imagem."
          : error?.message === "invalid_image_size" ? "A imagem gerada excede o limite de 15 MB."
          : error?.message === "invalid_image_content" ? "O provedor retornou um conteúdo que não é uma imagem válida."
          : `O provedor recusou a geração (HTTP ${error?.status || "desconhecido"}).`;
        return json({ error: status === 413 ? "A imagem excede o limite de 15 MB." : message }, status);
      }
    }

    if (body.action !== "status" && body.action !== "download") return json({ error: "Ação desconhecida." }, 400);
    const taskId = await readTaskToken(body.taskToken, user.id, signingKey, now());
    if (!taskId) return json({ error: "Tarefa inválida, expirada ou pertencente a outra conta." }, 403);
    sweepResults();
    const entry = results.get(taskId);
    if (!entry) return json({ error: "O resultado desta geração expirou. Inicie uma nova geração." }, 410);

    if (body.action === "status") return json({ status: "succeeded" });

    const bytes = entry.bytes;
    results.delete(taskId);
    return new Response(bytes, {
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/octet-stream",
        "X-Image-Content-Type": entry.contentType,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  };
}
