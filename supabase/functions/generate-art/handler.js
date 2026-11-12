const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "X-Image-Content-Type"
};

const BODY_LIMIT = 12_000;
// FLUX returns a base64 image inside JSON; allow the 15 MB artifact plus encoding overhead.
const JSON_RESPONSE_LIMIT = 22_000_000;
const RESULT_LIMIT = 15_000_000;
const RESULT_TTL = 15 * 60 * 1000;
const TASK_TOKEN_TTL = 30 * 60 * 1000;
const TASK_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const DEFAULT_MODEL = "black-forest-labs/flux.1-dev";
const DEFAULT_BASE_URL = "https://ai.api.nvidia.com";
const DEFAULT_STEPS = 30;
const DEFAULT_CFG_SCALE = 3.5;

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
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ taskId, userId, resultExp: now + RESULT_TTL, exp: now + TASK_TOKEN_TTL })));
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
      || !Number.isSafeInteger(claims.resultExp) || !Number.isSafeInteger(claims.exp)
      || claims.resultExp <= 0 || claims.resultExp > claims.exp || claims.exp <= now || claims.exp > now + TASK_TOKEN_TTL + 60_000) return null;
    return { taskId: claims.taskId, resultExp: claims.resultExp };
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
  const bucket = "nativa-image-task-results";

  function storageConfig() {
    const key = env("SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SECRET_KEY");
    const url = (env("SUPABASE_URL") || "").replace(/\/$/, "");
    if (!key || !url) throw new Error("image_storage_unavailable");
    return { key, url };
  }

  function storageObjectUrl(userId, taskId) {
    const { url } = storageConfig();
    return `${url}/storage/v1/object/${bucket}/${encodeURIComponent(userId)}/${encodeURIComponent(taskId)}`;
  }

  function storageHeaders(contentType) {
    const { key } = storageConfig();
    return { apikey: key, Authorization: `Bearer ${key}`, ...(contentType ? { "Content-Type": contentType } : {}) };
  }

  async function storeImage(userId, taskId, image) {
    const response = await fetchImpl(storageObjectUrl(userId, taskId), {
      method: "POST", headers: { ...storageHeaders(image.contentType), "x-upsert": "false", "Cache-Control": "no-store" },
      body: image.bytes, signal: AbortSignal.timeout(20_000)
    });
    if (!response.ok) throw new Error("image_storage_write_failed");
  }

  async function removeImage(userId, taskId) {
    try { await fetchImpl(storageObjectUrl(userId, taskId), { method: "DELETE", headers: storageHeaders(), signal: AbortSignal.timeout(10_000) }); }
    catch { /* A remoção é oportunista; a tarefa já expirou ou foi entregue. */ }
  }

  async function removeExpiredImages(userId) {
    const { url } = storageConfig();
    try {
      const response = await fetchImpl(`${url}/storage/v1/object/list/${bucket}`, {
        method: "POST", headers: { ...storageHeaders("application/json"), "Cache-Control": "no-store" },
        body: JSON.stringify({ prefix: `${userId}/`, limit: 100, offset: 0, sortBy: { column: "created_at", order: "asc" } }),
        signal: AbortSignal.timeout(10_000)
      });
      if (!response.ok) return;
      const objects = await readJsonResponse(response, 200_000);
      for (const object of Array.isArray(objects) ? objects : []) {
        const createdAt = Date.parse(object.created_at || object.updated_at || "");
        if (object.name && Number.isFinite(createdAt) && createdAt < now() - RESULT_TTL) await removeImage(userId, object.name);
      }
    } catch { /* A limpeza não bloqueia uma geração válida. */ }
  }

  async function generateImage(prompt) {
    const baseUrl = (env("NVIDIA_API_BASE_URL") || DEFAULT_BASE_URL).replace(/\/$/, "");
    const primary = env("NVIDIA_IMAGE_MODEL") || DEFAULT_MODEL;
    const fallback = env("NVIDIA_IMAGE_FALLBACK_MODEL");
    const models = [...new Set([primary,fallback].filter(Boolean))];
    const apiKey = env("NVIDIA_API_KEY");
    const deadline=Date.now()+120_000;
    let failure;
    for(const model of models){
      if(Date.now()>=deadline)throw failure||new DOMException("Provider timed out","TimeoutError");
      try{
        const schnell=model==="black-forest-labs/flux.1-schnell";
        let response = await fetchImpl(`${baseUrl}/v1/genai/${model}`, {
          method: "POST", signal: AbortSignal.timeout(Math.max(1,deadline-Date.now())),
          headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json", "Content-Type": "application/json", "NVCF-POLL-SECONDS":"20" },
          body: JSON.stringify({ prompt, mode: "base", cfg_scale: schnell?0:DEFAULT_CFG_SCALE, width: 1024, height: 1024, seed: 0, steps: schnell?4:DEFAULT_STEPS })
        });
        let requestId=response.headers.get("nvcf-reqid");
        // A queued request is not a failed image: poll it without starting another generation.
        for(let attempt=0;response.status===202&&attempt<20;attempt++){
          const id=response.headers.get("nvcf-reqid")||requestId;
          if(!/^[0-9a-f-]{36}$/i.test(id||""))throw Object.assign(new Error("invalid_provider_response"),{requestId});
          requestId=id;
          await response.body?.cancel();
          if(Date.now()>=deadline)throw new DOMException("Provider timed out","TimeoutError");
          response=await fetchImpl(`${baseUrl}/v1/status/${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${apiKey}`,Accept:"application/json","NVCF-POLL-SECONDS":"20"},signal:AbortSignal.timeout(Math.max(1,deadline-Date.now()))});
        }
        if(response.status===202)throw new DOMException("Provider still processing","TimeoutError");
        if (!response.ok) {await response.body?.cancel();throw Object.assign(new Error("provider_rejected"), { status: response.status,requestId,model });}
        const result = await readJsonResponse(response);
        const encoded = result?.artifacts?.[0]?.base64 || result?.artifacts?.[0]?.base64_image || result?.images?.[0]?.base64_image || result?.artifacts?.[0]?.image;
        if(!encoded)throw Object.assign(new Error("invalid_provider_response"),{requestId,model});
        const bytes = fromBase64(encoded);
        if (bytes.byteLength === 0 || bytes.byteLength > RESULT_LIMIT) throw new Error("invalid_image_size");
        const contentType = detectImageType(bytes);
        if (!contentType) throw new Error("invalid_image_content");
        return { bytes, contentType,model,fallbackUsed:model!==primary };
      }catch(error){
        failure=error;
        // Do not retry bad credentials, permission errors, rate limits or invalid images.
        if(!(error.status>=500))throw error;
      }
    }
    throw failure;
  }

  return async function handleGenerateArt(request) {
    if (request.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
    if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

    let user;
    try { user = await getAuthenticatedUser(request, env, fetchImpl); }
    catch { return json({ error: "Não foi possível validar a sessão." }, 401); }
    if (!user) return json({ error: "Entre na conta para gerar imagens." }, 401);

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
        const serviceKey=env("SUPABASE_SERVICE_ROLE_KEY")||env("SUPABASE_SECRET_KEY");
        const supabaseUrl=(env("SUPABASE_URL")||"").replace(/\/$/,"");
        if(!serviceKey||!supabaseUrl)return json({error:"Limite de geração indisponível no servidor."},503);
        const quota=await fetchImpl(`${supabaseUrl}/rest/v1/rpc/reserve_image_generation`,{method:"POST",headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,"Content-Type":"application/json"},body:JSON.stringify({p_user_id:user.id}),signal:AbortSignal.timeout(10_000)});
        if(!quota.ok)return json({error:"Não foi possível reservar uma geração."},503);
        if(await readJsonResponse(quota)===false)return json({error:"Limite diário atingido: até 20 imagens por conta a cada 24 horas UTC."},429);
        await removeExpiredImages(user.id);
        const image = await generateImage(makePrompt(kind, title, prompt));
        const taskId = randomUUID();
        await storeImage(user.id, taskId, image);
        return json({ taskToken: await createTaskToken(taskId, user.id, signingKey, now()),model:image.model,fallbackUsed:image.fallbackUsed });
      } catch (error) {
        const status = error?.status === 413 ? 413 : 502;
        const message = error?.name === "TimeoutError" ? "O provedor demorou demais para gerar a imagem."
          : error?.message === "invalid_image_size" ? "A imagem gerada excede o limite de 15 MB."
          : error?.message === "invalid_image_content" ? "O provedor retornou um conteúdo que não é uma imagem válida."
          : error?.message === "image_storage_unavailable" || error?.message === "image_storage_write_failed" ? "O armazenamento temporário de imagens está indisponível."
          : error?.status === 401 ? "A chave NVIDIA configurada no servidor foi recusada."
          : error?.status === 403 ? "O projeto NVIDIA não tem permissão para usar este modelo de imagem."
          : error?.message === "invalid_provider_response" ? "A NVIDIA não retornou uma imagem nem uma tarefa válida. Tente novamente mais tarde."
          : error?.status >= 500 ? `A API de imagens da NVIDIA está indisponível (HTTP ${error.status}). O pedido chegou ao provedor, mas ele falhou antes de entregar a imagem. Tente novamente mais tarde.`
          : error?.status === 429 ? "O provedor NVIDIA limitou temporariamente as gerações. Tente novamente mais tarde."
          : `O provedor recusou a geração (HTTP ${error?.status || "desconhecido"}).`;
        const code=error?.name==="TimeoutError"?"image_provider_timeout":error?.message?.startsWith("image_storage")?"image_storage_unavailable":error?.status>=500?"image_provider_unavailable":"image_generation_failed";
        console.warn("nativa.image_generation_failed",JSON.stringify({code,providerStatus:error?.status||null,requestId:error?.requestId||null,model:error?.model||null}));
        return json({ error: status === 413 ? "A imagem excede o limite de 15 MB." : message,code,providerStatus:error?.status||null,requestId:error?.requestId||null }, status);
      }
    }

    if (body.action !== "status" && body.action !== "download") return json({ error: "Ação desconhecida." }, 400);
    const task = await readTaskToken(body.taskToken, user.id, signingKey, now());
    if (!task) return json({ error: "Tarefa inválida, expirada ou pertencente a outra conta." }, 403);
    if (task.resultExp <= now()) {
      await removeImage(user.id, task.taskId);
      return json({ error: "O resultado desta geração expirou. Inicie uma nova geração." }, 410);
    }
    const taskId = task.taskId;
    const objectUrl = storageObjectUrl(user.id, taskId);
    const headers = storageHeaders();
    if (body.action === "status") {
      const response = await fetchImpl(objectUrl, { method: "HEAD", headers, signal: AbortSignal.timeout(10_000) });
      if (response.ok) return json({ status: "succeeded" });
      if (response.status === 404) return json({ error: "O resultado desta geração expirou. Inicie uma nova geração." }, 410);
      return json({ error: "Não foi possível consultar a imagem gerada." }, 503);
    }

    const response = await fetchImpl(objectUrl, { headers, signal: AbortSignal.timeout(20_000) });
    if (response.status === 404) return json({ error: "O resultado desta geração expirou. Inicie uma nova geração." }, 410);
    if (!response.ok) return json({ error: "Não foi possível baixar a imagem gerada." }, 503);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const contentType = detectImageType(bytes);
    if (!contentType || bytes.byteLength === 0 || bytes.byteLength > RESULT_LIMIT) return json({ error: "A imagem gerada não passou na validação." }, 502);
    await removeImage(user.id, taskId);
    return new Response(bytes, {
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/octet-stream",
        "X-Image-Content-Type": contentType,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  };
}
