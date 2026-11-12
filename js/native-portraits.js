import { obterClienteSupabase } from "./auth.js";
import { repositorioLocal } from "./repository.js";

const BUCKET = "nativa-portraits";
const EXT_BY_TYPE = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);

export async function enviarRetratoNativa(nativa, blob, photoId = nativa?.photoId) {
  if (!nativa?.id || !(blob instanceof Blob)) return null;
  const extension = EXT_BY_TYPE.get(blob.type.toLowerCase());
  if (!extension || blob.size < 1 || blob.size > 8 * 1024 * 1024) throw new Error("O retrato precisa ser JPG, PNG ou WebP com até 8 MB.");
  const client = await obterClienteSupabase();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  const userId = sessionData?.session?.user?.id;
  if (!userId) throw new Error("Entre na conta para salvar o retrato na nuvem.");
  const path = `${userId}/${encodeURIComponent(nativa.id)}/${photoId}.${extension}`;
  const { error } = await client.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: true });
  if (error) throw error;
  return path;
}

export async function obterRetratoNativa(nativa) {
  if (!nativa?.photoId && !nativa?.photoStoragePath) return null;
  const local = nativa.photoId ? await repositorioLocal.obterFoto(nativa.photoId) : null;
  if (local) return local;
  if (!nativa.photoStoragePath) return null;
  const client = await obterClienteSupabase();
  const { data, error } = await client.storage.from(BUCKET).download(nativa.photoStoragePath);
  if (error || !data) return null;
  if(nativa.photoId)await repositorioLocal.guardarFoto(nativa.photoId, data);
  return data;
}

export async function removerRetratoNativa(path) {
  if (!path) return;
  const client = await obterClienteSupabase();
  const { error } = await client.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
