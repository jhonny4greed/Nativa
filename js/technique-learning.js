/**
 * Regra de aprendizagem compartilhada pelos seletores e pela Essência.
 * Parâmetros V2.1 pendentes não bloqueiam aprendizagem; apenas registros
 * arquivados fora do catálogo atual ficam indisponíveis para novas escolhas.
 * Não recebe a ficha da Nativa: Traços nunca autorizam nem bloqueiam
 * aprendizagem. Os requisitos de origem continuam nos filtros chamadores.
 */
export function podeAprenderTecnica(tecnica) {
  return Boolean(tecnica && tecnica.estadoCatalogo !== "arquivado");
}

/** Parâmetros em revisão impedem somente a resolução em combate. */
export function podeUsarTecnicaEmCombate(tecnica) {
  // V1 arquivada ainda pode ser usada em fichas existentes; só a revisão
  // técnica V2.1 bloqueia o combate.
  return Boolean(tecnica && tecnica.estadoCatalogo !== "em-revisao");
}

/** Estado de apresentação do cartão no seletor, compartilhado com os testes do fluxo de UI. */
export function obterEstadoSeletorTecnica(tecnica, selecionada, limiteAtingido) {
  const podeAprender = podeAprenderTecnica(tecnica);
  const pendenteCombate = !podeUsarTecnicaEmCombate(tecnica);
  return {
    podeAprender,
    pendenteCombate,
    botaoDesabilitado: !podeAprender || selecionada || limiteAtingido,
    textoBotao: selecionada ? "Adicionada" : !podeAprender ? "Indisponível" : limiteAtingido ? "Limite de técnicas atingido" : "Adicionar à ficha",
    aviso: pendenteCombate ? "Pode ser aprendida; parâmetros técnicos pendentes impedem apenas o uso em combate." : ""
  };
}

/** Função usada pelo seletor; não consulta nem recebe Traços da ficha. */
export function adicionarTecnicaSelecionada(selecionadas, tecnica, limite) {
  if (!(selecionadas instanceof Set) || !podeAprenderTecnica(tecnica) || selecionadas.has(tecnica.id) || selecionadas.size >= limite) return false;
  selecionadas.add(tecnica.id);
  return true;
}
