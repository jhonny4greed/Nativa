import { obterClienteSupabase } from "./auth.js";
import { repositorioLocal } from "./repository.js";

const GALLERY_KEY = "nativa.prototype.generated-art.v1";
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const KINDS = new Set(["nativa", "biome", "technique", "other"]);

function lerGaleria(storage) {
  const value = storage.getItem(GALLERY_KEY);
  if (!value) return [];
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed))
    throw new Error("O índice local do acervo de imagens está inválido; nenhum registro foi alterado.");
  return parsed;
}

export function criarGaleriaImagens({
  clientProvider = obterClienteSupabase,
  repository = repositorioLocal,
  storage = globalThis.localStorage
} = {}) {
  const migrations = new Map();
  let warnings = [];
  async function contexto() {
    const client = await clientProvider();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    const userId = data?.session?.user?.id;
    if (!userId) throw new Error("Entre na conta para acessar seu acervo.");
    return { client, userId };
  }
  function normalizar(row) {
    return {
      id: row.id,
      userId: row.user_id,
      kind: row.kind,
      title: row.title,
      prompt: row.prompt,
      photoId: row.photo_id,
      storagePath: row.storage_path,
      createdAt: row.created_at
    };
  }
  async function salvar({
    blob,
    kind,
    title,
    prompt,
    id = crypto.randomUUID(),
    photoId = `generated-art-${id}`,
    createdAt = new Date().toISOString()
  }) {
    if (
      !(blob instanceof Blob) ||
      !IMAGE_TYPES.has(blob.type.toLowerCase()) ||
      blob.size === 0 ||
      blob.size > 15_000_000
    )
      throw new TypeError("Use uma imagem PNG, JPG ou WebP de até 15 MB.");
    if (
      !KINDS.has(kind) ||
      typeof title !== "string" ||
      !title.trim() ||
      title.length > 80 ||
      typeof prompt !== "string" ||
      !prompt.trim() ||
      prompt.length > 1400
    )
      throw new TypeError("Os metadados da imagem são inválidos.");
    const { client, userId } = await contexto();
    const ext = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[blob.type.toLowerCase()];
    const path = `${userId}/${id}.${ext}`;
    const { error: uploadError } = await client.storage
      .from("nativa-artworks")
      .upload(path, blob, { contentType: blob.type, upsert: true });
    if (uploadError) throw uploadError;
    const { error } = await client
      .from("player_artworks")
      .upsert({
        id,
        user_id: userId,
        kind,
        title,
        prompt,
        photo_id: photoId,
        storage_path: path,
        created_at: createdAt
      });
    // Keep the uploaded object on metadata failure: a retry uses the same path for legacy migration.
    if (error) throw error;
    return { id, userId, kind, title, prompt, photoId, storagePath: path, createdAt };
  }
  async function migrarLegado() {
    const { userId } = await contexto();
    // A failure leaves the original local entry and bytes intact for the next attempt.
    warnings = [];
    for (const entry of lerGaleria(storage).filter(item => item?.userId === userId && !item.serverMigrated)) {
      try {
        const blob = await repository.obterFoto(entry.photoId);
        if (!blob) continue;
        await salvar({ ...entry, blob });
        const entries = lerGaleria(storage);
        const current = entries.find(item => item.id === entry.id && item.userId === userId);
        if (current) current.serverMigrated = true;
        storage.setItem(GALLERY_KEY, JSON.stringify(entries));
      } catch (error) {
        warnings.push(`Não foi possível migrar ${entry.title}: ${error.message}. O original local foi preservado.`);
      }
    }
  }
  async function listar() {
    const { client, userId } = await contexto();
    if (!migrations.has(userId))
      migrations.set(
        userId,
        migrarLegado().catch(error => {
          migrations.delete(userId);
          warnings = [`Migração pendente: ${error.message}`];
        })
      );
    await migrations.get(userId);
    if (warnings.length) migrations.delete(userId);
    const { data, error } = await client
      .from("player_artworks")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(normalizar);
  }
  async function obter(id) {
    const { client, userId } = await contexto();
    const { data, error } = await client
      .from("player_artworks")
      .select("*")
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? normalizar(data) : null;
  }
  async function obterArquivo(art) {
    if (!art?.storagePath) return null;
    const { client } = await contexto();
    const { data, error } = await client.storage.from("nativa-artworks").download(art.storagePath);
    if (error) throw error;
    return data;
  }
  return { salvar, listar, obter, obterArquivo, obterAvisos: () => [...warnings] };
}

export const galeriaImagens = criarGaleriaImagens();

export async function aplicarArteComoRetrato({
  artId,
  target,
  gallery = galeriaImagens,
  repository = repositorioLocal,
  persist
}) {
  if (!target || typeof target !== "object" || typeof persist !== "function")
    throw new TypeError("Ficha ou função de salvamento inválida.");
  const art = await gallery.obter(artId);
  if (!art) throw new Error("Esta imagem não pertence ao acervo da conta atual.");
  const blob = gallery.obterArquivo ? await gallery.obterArquivo(art) : await repository.obterFoto(art.photoId);
  if (
    !(blob instanceof Blob) ||
    !IMAGE_TYPES.has(blob.type.toLowerCase()) ||
    blob.size === 0 ||
    blob.size > 15_000_000
  ) {
    throw new Error("O arquivo não foi encontrado ou não é uma imagem PNG, JPG ou WebP válida.");
  }

  const newPhotoId = `nativa-generated-${crypto.randomUUID()}`;
  const previous = structuredClone(target);
  await repository.guardarFoto(newPhotoId, blob);
  try {
    target.photoId = newPhotoId;
    target.photoStoragePath = null;
    const result = await persist(target, previous);
    if (!result?.persisted) {
      for (const key of Object.keys(target)) delete target[key];
      Object.assign(target, previous);
      await repository.removerFoto(newPhotoId);
      return { persisted: false, photoId: null };
    }
    return { persisted: true, photoId: newPhotoId };
  } catch (error) {
    for (const key of Object.keys(target)) delete target[key];
    Object.assign(target, previous);
    try {
      await repository.removerFoto(newPhotoId);
    } catch (rollbackError) {
      error.rollbackError = rollbackError;
    }
    throw error;
  }
}
