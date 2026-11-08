/** Registro de URLs de objeto pertencentes exclusivamente às fotos da arena. */
export function criarRegistroUrlsFotosArena({ criarUrl, revogarUrl }) {
  const urlsProprias = new Set();

  function criar(blob) {
    if (!blob) return null;
    const url = criarUrl(blob);
    urlsProprias.add(url);
    return url;
  }

  function liberar(url) {
    if (!url || !urlsProprias.has(url)) return false;
    urlsProprias.delete(url);
    revogarUrl(url);
    return true;
  }

  return {
    criar,
    liberar,
    substituir(urlAnterior, blob, atualizarInterface) {
      const novaUrl = criar(blob);
      try {
        // A interface passa a usar a nova URL (ou o fallback) antes de liberar a anterior.
        atualizarInterface(novaUrl);
      } catch (error) {
        liberar(novaUrl);
        throw error;
      }
      liberar(urlAnterior);
      return novaUrl;
    },
    liberarTodasDepoisDe(removerReferencias) {
      // Se não for possível remover as referências, preserva as URLs para não quebrar imagens ativas.
      removerReferencias();
      for (const url of [...urlsProprias]) liberar(url);
    },
    possui(url) {
      return urlsProprias.has(url);
    },
    quantidade() {
      return urlsProprias.size;
    }
  };
}
