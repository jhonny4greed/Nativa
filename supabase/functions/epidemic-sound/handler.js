const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
const LIMIT = 6 * 1024 * 1024;
function providerError(status) {
  if (status === 401 || status === 403)
    return "O catálogo recusou a credencial de áudio do servidor. Confira a conta e a chave Epidemic Sound.";
  if (status === 402)
    return "A conta do catálogo atingiu a quota de prévias ou downloads. Você também pode enviar um áudio próprio.";
  if (status === 429) return "O catálogo recebeu muitas solicitações. Aguarde antes de tentar novamente.";
  return "O catálogo de áudio está indisponível. Tente novamente ou envie um áudio próprio.";
}
export function createEpidemicSoundHandler({ env = () => undefined, fetchImpl = fetch } = {}) {
  return async request => {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
    const bearer = request.headers.get("Authorization"),
      url = (env("SUPABASE_URL") || "").replace(/\/$/, "");
    const publicKey = env("SUPABASE_ANON_KEY") || env("SUPABASE_PUBLISHABLE_KEY");
    if (!bearer?.startsWith("Bearer ") || !url || !publicKey) return json({ error: "Entre na sua conta." }, 401);
    try {
      const auth = await fetchImpl(`${url}/auth/v1/user`, {
        headers: { apikey: publicKey, Authorization: bearer },
        signal: AbortSignal.timeout(8000)
      });
      if (!auth.ok) return json({ error: "Sessão inválida." }, 401);
      const user = await auth.json();
      if (!user?.id) return json({ error: "Sessão inválida." }, 401);
      const raw = await request.text();
      if (raw.length > 2048) return json({ error: "Pedido muito grande." }, 413);
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return json({ error: "Pedido inválido." }, 400);
      }
      if (!body || !["search", "preview", "previewAudio", "download"].includes(body.action))
        return json({ error: "Ação desconhecida." }, 400);
      const key = env("EPIDEMIC_SOUND_API_KEY");
      if (!key)
        return json(
          { error: "Catálogo de áudio não configurado no servidor. Você pode enviar um áudio próprio." },
          503
        );
      const headers = { Authorization: `Bearer ${key}`, "x-partner-user-id": `nativa-${user.id}` },
        base = "https://api.epidemicsound.com/v0";
      let endpoint;
      if (body.action === "search") {
        const term = String(body.term || "").trim();
        if (term.length < 3 || term.length > 500) return json({ error: "Descreva o som em 3 a 500 caracteres." }, 400);
        endpoint = `${base}/sound-effects/search?term=${encodeURIComponent(term)}&limit=12&sort=best-match&order=desc`;
      } else {
        const id = String(body.id || "");
        if (!/^[A-Za-z0-9-]{8,80}$/.test(id)) return json({ error: "Efeito inválido." }, 400);
        endpoint = `${base}/sound-effects/${encodeURIComponent(id)}/${body.action === "download" ? "download?quality=normal" : "preview"}`;
      }
      const response = await fetchImpl(endpoint, { headers, signal: AbortSignal.timeout(15000) });
      if (!response.ok) return json({ error: providerError(response.status) }, response.status === 429 ? 429 : 502);
      const data = await response.json();
      if (body.action === "search" || body.action === "preview") return json(data);
      // Only signed URLs returned by the provider, never a URL supplied by a client.
      const mediaUrl = new URL(data.url);
      if (mediaUrl.protocol !== "https:" || !/(^|\.)epidemicsound\.com$|\.cloudfront\.net$/i.test(mediaUrl.hostname))
        return json({ error: "O catálogo retornou um endereço de áudio inválido." }, 502);
      const media = await fetchImpl(mediaUrl.href, { redirect: "error", signal: AbortSignal.timeout(25000) });
      if (!media.ok) return json({ error: "O catálogo recusou o arquivo de áudio. Solicite o som novamente." }, 502);
      if (Number(media.headers.get("content-length")) > LIMIT) {
        await media.body?.cancel();
        return json({ error: "Escolha uma gravação menor, com até 6 MB." }, 413);
      }
      const reader = media.body?.getReader(),
        chunks = [];
      let size = 0;
      if (!reader) return json({ error: "O catálogo retornou um áudio vazio." }, 502);
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > LIMIT) {
          await reader.cancel();
          return json({ error: "Escolha uma gravação menor, com até 6 MB." }, 413);
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      if (!(bytes[0] === 73 && bytes[1] === 68 && bytes[2] === 51) && !(bytes[0] === 255 && (bytes[1] & 224) === 224))
        return json({ error: "O catálogo não retornou um arquivo MP3 válido." }, 502);
      return new Response(bytes, { headers: { ...cors, "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
    } catch {
      return json(
        { error: "Não foi possível acessar o catálogo de áudio. Tente novamente ou envie um áudio próprio." },
        502
      );
    }
  };
}
