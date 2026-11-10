import { obterTracosPadraoLinhagem } from "./traits.js";
import { normalizarArquetipoLegado } from "./data.js";

/**
 * Constrói a ficha inicial com o formato legado usado pelo bestiário.
 * Não gera identidade: o chamador fornece o ID local criado pela aplicação.
 */
export function criarNativa(dados) {
  const {
    id,
    name,
    player = "",
    groupBio,
    lineage,
    species = "",
    bioma,
    affinity,
    archetype,
    attrs,
    techniques = [],
    tracos,
    tracosQuimericos = [],
    habitos = [],
    nivel: _nivel,
    xp: _xp,
    xpa: _xpa,
    estagio: _estagio,
    essencias: _essencias,
    afinidadesEssencia: _afinidadesEssencia,
    historicoProgressao: _historicoProgressao,
    photoId: _photoId,
    lineageName: _lineageName,
    ...camposAdicionais
  } = dados || {};

  return {
    id,
    name,
    player,
    groupBio,
    lineage,
    lineageName: lineage,
    species,
    bioma,
    affinity,
    archetype: normalizarArquetipoLegado(archetype),
    attrs: { ...attrs },
    techniques: [...techniques],
    nivel: 1,
    xp: 0,
    xpa: 42,
    estagio: 1,
    essencias: [],
    afinidadesEssencia: [],
    historicoProgressao: [],
    photoId: null,
    tracos: [...(Array.isArray(tracos) ? tracos : obterTracosPadraoLinhagem(lineage))],
    tracosQuimericos: [...(Array.isArray(tracosQuimericos) ? tracosQuimericos : [])],
    habitos: [...habitos],
    ...camposAdicionais
  };
}

