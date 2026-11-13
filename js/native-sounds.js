import { obterClienteSupabase } from "./auth.js";
import { ATTACK_SECONDS, CRY_SECONDS, shortClip, SOUND_BUCKET } from "./audio-clips.js";

export async function decodeSound(blob) {
  const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Context) throw new Error("Este navegador não oferece edição de áudio.");
  const context = new Context();
  try {
    return await context.decodeAudioData(await blob.arrayBuffer());
  } catch (error) {
    throw new Error("Não foi possível ler o áudio. Tente MP3, WAV ou OGG.", { cause: error });
  } finally {
    await context.close();
  }
}

export function createNativeSoundService({ clientProvider = obterClienteSupabase, decode = decodeSound } = {}) {
  async function invoke(action, payload = {}) {
    const client = await clientProvider();
    const { data, error } = await client.functions.invoke("epidemic-sound", { body: { action, ...payload } });
    if (error) {
      let message;
      try {
        message = (await error.context?.clone().json())?.error;
      } catch {}
      throw new Error(message || error.message || "O catálogo de sons está indisponível.", { cause: error });
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }
  async function source(selection, action) {
    const blob = selection?.file || (await invoke(action, { id: selection?.id }));
    if (!(blob instanceof Blob) || !blob.size || blob.size > 6 * 1024 * 1024)
      throw new Error("Escolha um áudio válido com até 6 MB.");
    return blob;
  }
  async function session(client) {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (!data?.session?.user?.id) throw new Error("Entre na conta para salvar os sons no servidor.");
    return data.session.user.id;
  }
  async function remove(effect) {
    const paths = [effect?.cryPath, effect?.attackPath].filter(Boolean);
    if (!paths.length) return;
    const client = await clientProvider();
    const { error } = await client.storage.from(SOUND_BUCKET).remove(paths);
    if (error) throw error;
  }
  return {
    async search(term) {
      const data = await invoke("search", { term });
      return data.soundEffects || data.results || data.items || [];
    },
    async preview(selection) {
      const buffer = await decode(await source(selection, "previewAudio"));
      return shortClip(buffer, CRY_SECONDS);
    },
    async save(nativa, selection) {
      const client = await clientProvider(),
        userId = await session(client);
      if (!nativa?.id || (nativa.ownerId && nativa.ownerId !== userId))
        throw new Error("Esta Nativa não pertence à sua conta.");
      if (selection.existing) return selection.existing;
      const buffer = await decode(await source(selection, "download"));
      if ((await session(client)) !== userId) throw new Error("A conta mudou durante o preparo dos sons.");
      const base = `${userId}/${encodeURIComponent(nativa.id)}/${crypto.randomUUID()}`;
      const effect = {
        provider: selection.file ? "upload" : "epidemic-sound",
        id: selection.id || null,
        title: selection.title || "Vocalização personalizada",
        version: 1,
        cryPath: `${base}-cry.wav`,
        attackPath: `${base}-attack.wav`,
        crySeconds: CRY_SECONDS,
        attackSeconds: ATTACK_SECONDS
      };
      try {
        for (const [path, seconds] of [
          [effect.cryPath, CRY_SECONDS],
          [effect.attackPath, ATTACK_SECONDS]
        ]) {
          if ((await session(client)) !== userId) throw new Error("A conta mudou durante o envio dos sons.");
          const { error } = await client.storage
            .from(SOUND_BUCKET)
            .upload(path, shortClip(buffer, seconds), { contentType: "audio/wav", upsert: false });
          if (error) throw error;
        }
        if ((await session(client)) !== userId) throw new Error("A conta mudou durante o envio dos sons.");
        return effect;
      } catch (error) {
        await remove(effect).catch(() => {});
        throw error;
      }
    },
    async load(nativa, kind) {
      const path = nativa.soundEffect?.[kind === "cry" ? "cryPath" : "attackPath"];
      if (!path) return null;
      const client = await clientProvider();
      const { data, error } = await client.storage.from(SOUND_BUCKET).download(path);
      if (error || !data || data.size > 120000) return null;
      return data;
    },
    remove
  };
}
export const nativeSounds = createNativeSoundService();
