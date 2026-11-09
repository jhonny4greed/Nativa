const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const BODY_LIMIT = 12_000;
const JSON_RESPONSE_LIMIT = 2_000_000;
const ROLES = new Set(["player", "admin"]);

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

function resolveServiceKey(env) {
  return env("SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SECRET_KEY") || env("SUPABASE_SECRET_KEYS");
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

async function readJsonResponse(response, limit = JSON_RESPONSE_LIMIT) {
  const contentType = (response.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json" && !contentType.endsWith("+json")) throw new Error("invalid_json_type");
  if (!response.body) return [];
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

const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createAdminPanelHandler({ env = () => undefined, fetchImpl = fetch } = {}) {
  const baseUrl = () => (env("SUPABASE_URL") || "").replace(/\/$/, "");
  const serviceHeaders = () => {
    const serviceKey = resolveServiceKey(env);
    return serviceKey ? { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } : null;
  };

  async function rest(path, init = {}) {
    return fetchImpl(`${baseUrl()}/rest/v1/${path}`, {
      ...init,
      signal: AbortSignal.timeout(15_000),
      headers: { ...serviceHeaders(), "Content-Type": "application/json", ...(init.headers || {}) }
    });
  }

  async function isAdmin(userId) {
    const response = await rest(`profiles?id=eq.${encodeURIComponent(userId)}&select=role`, { method: "GET" });
    if (!response.ok) return false;
    const rows = await readJsonResponse(response);
    return rows?.[0]?.role === "admin";
  }

  async function listUsers() {
    const response = await fetchImpl(`${baseUrl()}/auth/v1/admin/users?per_page=200`, {
      headers: serviceHeaders(),
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) throw new Error("users_fetch_failed");
    const data = await readJsonResponse(response);
    const users = Array.isArray(data?.users) ? data.users : (Array.isArray(data) ? data : []);
    return users.map(user => ({
      id: user.id,
      email: user.email || "",
      displayName: user.user_metadata?.display_name || "",
      confirmed: Boolean(user.email_confirmed_at),
      providers: Array.isArray(user.app_metadata?.providers) ? user.app_metadata.providers : [],
      createdAt: user.created_at || null,
      lastSignInAt: user.last_sign_in_at || null
    }));
  }

  return async function handleAdminPanel(request) {
    if (request.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
    if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

    let user;
    try { user = await getAuthenticatedUser(request, env, fetchImpl); }
    catch { return json({ error: "Não foi possível validar a sessão." }, 401); }
    if (!user) return json({ error: "Entre na conta para administrar." }, 401);

    let body;
    try {
      const contentType = request.headers.get("content-type") || "";
      if (!/^application\/json(?:\s*;|$)/i.test(contentType)) return json({ error: "Envie o pedido em JSON." }, 415);
      body = await readBoundedBody(request, BODY_LIMIT);
      if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "O pedido JSON deve ser um objeto." }, 400);
    } catch (error) {
      return json({ error: error?.status === 413 ? "Pedido muito grande." : "Pedido JSON inválido." }, error?.status || 400);
    }

    if (!serviceHeaders()) return json({ error: "Painel não configurado corretamente no servidor." }, 503);
    let admin;
    try { admin = await isAdmin(user.id); }
    catch { return json({ error: "Não foi possível verificar suas permissões." }, 503); }
    if (!admin) return json({ error: "Esta conta não é administradora." }, 403);

    const action = body.action;

    try {
      if (action === "users") return json({ users: await listUsers() });

      if (action === "allowlist-list") {
        const response = await rest("image_generation_allowlist?select=user_id,created_at&order=created_at.asc", { method: "GET" });
        if (!response.ok) return json({ error: "Não foi possível consultar a allowlist." }, 502);
        return json({ allowlist: await readJsonResponse(response) });
      }

      if (action === "allowlist-add" || action === "allowlist-remove") {
        const userId = String(body.userId || "");
        if (!USER_ID_PATTERN.test(userId)) return json({ error: "Informe um usuário válido." }, 400);
        if (action === "allowlist-add") {
          const response = await rest("image_generation_allowlist", {
            method: "POST",
            headers: { Prefer: "resolution=merge-duplicates,return=representation" },
            body: JSON.stringify({ user_id: userId, added_by: user.id })
          });
          if (!response.ok) return json({ error: "Não foi possível liberar a geração para este usuário." }, 502);
          return json({ added: userId });
        }
        const response = await rest(`image_generation_allowlist?user_id=eq.${encodeURIComponent(userId)}`, { method: "DELETE" });
        if (!response.ok) return json({ error: "Não foi possível remover a permissão." }, 502);
        return json({ removed: userId });
      }

      if (action === "set-role") {
        const userId = String(body.userId || "");
        const role = String(body.role || "");
        if (!USER_ID_PATTERN.test(userId) || !ROLES.has(role)) return json({ error: "Informe um usuário e um papel válidos." }, 400);
        if (userId === user.id && role !== "admin") return json({ error: "Você não pode remover o próprio acesso de administrador." }, 400);
        const response = await rest(`profiles?id=eq.${encodeURIComponent(userId)}`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ role })
        });
        if (!response.ok) return json({ error: "Não foi possível alterar o papel do usuário." }, 502);
        return json({ updated: userId, role });
      }

      return json({ error: "Ação desconhecida." }, 400);
    } catch {
      return json({ error: "Falha ao executar a ação administrativa." }, 502);
    }
  };
}
