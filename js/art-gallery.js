import { obterClienteSupabase } from "./auth.js";
import { repositorioLocal } from "./repository.js";

const GALLERY_KEY = "nativa.prototype.generated-art.v1";
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const KINDS = new Set(["nativa", "biome", "technique", "other"]);

function lerGaleria(storage) {
  const value = storage.getItem(GALLERY_KEY);
  if (!value) return [];
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error("O índice local do acervo de imagens está inválido; nenhum registro foi alterado.");
  return parsed;
}

export function criarGaleriaImagens({ clientProvider = obterClienteSupabase, repository = repositorioLocal, storage = globalThis.localStorage } = {}) {
  async function usuarioAtual() {
    const client = await clientProvider();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    const userId = data?.session?.user?.id;
    if (!userId) throw new Error("Entre na conta autorizada para acessar seu acervo de imagens.");
    return userId;
  }

  async function salvar({ blob, kind, title, prompt }) {
    const userId = await usuarioAtual();
    if (!(blob instanceof Blob) || !IMAGE_TYPES.has(blob.type.toLowerCase()) || blob.size === 0 || blob.size > 15_000_000) {
      throw new TypeError("O arquivo não é uma imagem local válida ou excede 15 MB.");
    }
    if (!KINDS.has(kind) || typeof title !== "string" || !title.trim() || title.trim().length > 80
      || typeof prompt !== "string" || !prompt.trim() || prompt.trim().length > 1400) {
      throw new TypeError("Os metadados da imagem são inválidos.");
    }
    const photoId = `generated-art-${crypto.randomUUID()}`;
    const entry = { id: crypto.randomUUID(), userId, kind, title, prompt, photoId, createdAt: new Date().toISOString() };
    await repository.guardarFoto(photoId, blob);
    try {
      const entries = lerGaleria(storage);
      storage.setItem(GALLERY_KEY, JSON.stringify([...entries, entry]));
    } catch (error) {
      try { await repository.removerFoto(photoId); } catch (rollbackError) { error.rollbackError = rollbackError; }
      throw error;
    }
    return structuredClone(entry);
  }

  async function listar() {
    const userId = await usuarioAtual();
    return lerGaleria(storage).filter(item => item?.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(item => structuredClone(item));
  }

  async function obter(id) {
    const userId = await usuarioAtual();
    const entry = lerGaleria(storage).find(item => item?.id === id && item?.userId === userId);
    return entry ? structuredClone(entry) : null;
  }

  return { salvar, listar, obter };
}

export const galeriaImagens = criarGaleriaImagens();

export async function aplicarArteComoRetrato({ artId, target, gallery = galeriaImagens, repository = repositorioLocal, persist }) {
  if (!target || typeof target !== "object" || typeof persist !== "function") throw new TypeError("Ficha ou função de salvamento inválida.");
  const art = await gallery.obter(artId);
  if (!art) throw new Error("Esta imagem não pertence ao acervo da conta atual.");
  const blob = await repository.obterFoto(art.photoId);
  if (!(blob instanceof Blob) || !IMAGE_TYPES.has(blob.type.toLowerCase()) || blob.size === 0 || blob.size > 15_000_000) {
    throw new Error("O arquivo não foi encontrado ou não é uma imagem local válida no IndexedDB.");
  }

  const newPhotoId = `nativa-generated-${crypto.randomUUID()}`;
  const previous = structuredClone(target);
  await repository.guardarFoto(newPhotoId, blob);
  try {
    target.photoId = newPhotoId;
    const result = await persist(target, previous);
    if (!result?.persisted) {
      Object.assign(target, previous);
      await repository.removerFoto(newPhotoId);
      return { persisted: false, photoId: null };
    }
    return { persisted: true, photoId: newPhotoId };
  } catch (error) {
    Object.assign(target, previous);
    try { await repository.removerFoto(newPhotoId); }
    catch (rollbackError) { error.rollbackError = rollbackError; }
    throw error;
  }
}
