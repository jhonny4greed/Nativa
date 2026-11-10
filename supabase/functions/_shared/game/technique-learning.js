/** Regras de aprendizagem e liberação de golpes do catálogo. */
export function podeAprenderTecnica(tecnica) {
  return Boolean(tecnica && tecnica.estadoCatalogo !== "arquivado" && tecnica.estadoCatalogo !== "reservado");
}

/**
 * Golpes aprovados são liberados. Registros em revisão continuam bloqueados,
 * mesmo quando seus valores numéricos estão preenchidos. Arquivados permanecem
 * utilizáveis apenas pelas fichas que já os possuem.
 */
export function podeUsarTecnicaEmCombate(tecnica) {
  if (!tecnica) return false;
  if (tecnica.estadoCatalogo === "aprovado") return true;
  if (tecnica.estadoCatalogo === "arquivado") return tecnica.compatibilidadeCombate === true;
  return false;
}

/** Estado de apresentação compartilhado com o seletor de golpes. */
export function obterEstadoSeletorTecnica(tecnica, selecionada, limiteAtingido) {
  const podeAprender = podeAprenderTecnica(tecnica);
  const podeUsar = podeUsarTecnicaEmCombate(tecnica);
  let aviso = "";

  if (!podeAprender) aviso = "Golpe arquivado; não pode ser aprendido novamente.";
  else if (!podeUsar) {
    aviso = "Golpe em revisão ou pendente; pode ser aprendido, mas está bloqueado em combate. Parâmetros preenchidos não equivalem à aprovação.";
  }

  return {
    podeAprender,
    podeUsar,
    pendenteCombate: !podeUsar,
    botaoDesabilitado: !podeAprender || selecionada || limiteAtingido,
    textoBotao: selecionada ? "Adicionada" : !podeAprender ? "Indisponível" : limiteAtingido ? "Limite de golpes atingido" : "Adicionar à ficha",
    aviso
  };
}

/** Traços não autorizam nem bloqueiam a aprendizagem. */
export function adicionarTecnicaSelecionada(selecionadas, tecnica, limite) {
  if (!(selecionadas instanceof Set) || !podeAprenderTecnica(tecnica) || selecionadas.has(tecnica.id) || selecionadas.size >= limite) return false;
  selecionadas.add(tecnica.id);
  return true;
}
