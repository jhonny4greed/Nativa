import { adicionarXP, inicializarProgressao, xpTotalParaNivel } from "./progression.js";
import { ESSENCIAS, absorverEssencia, verificarEssencia } from "./essences.js";
import { CATALOGO_TRACOS, obterTracosPadraoLinhagem } from "./traits.js";
import { TECNICAS } from "./techniques.js";
import { podeAprenderTecnica } from "./technique-learning.js";

function copiar(data) {
  return JSON.parse(JSON.stringify(data));
}

export function concederXpCampanha(data, quantidade) {
  const result = copiar(data);
  inicializarProgressao(result);
  const antes = { nivel: result.nivel, xp: result.xp, xpTotal: result.xpTotal, xpa: result.xpa };
  const progress = adicionarXP(result, quantidade);
  return { data: result, antes, depois: { nivel: result.nivel, xp: result.xp, xpTotal: result.xpTotal, xpa: result.xpa }, progress };
}

export function definirNivelCampanha(data, nivelAlvo) {
  const result = copiar(data);
  inicializarProgressao(result);
  if (!Number.isInteger(nivelAlvo) || nivelAlvo < result.nivel) throw new Error("O nível só pode avançar. A redução exigiria uma regra de reversão de XPA e atributos que ainda não existe.");
  if (nivelAlvo === result.nivel) return { data: result, quantidadeXpConcedida: 0, antes: { nivel: result.nivel, xp: result.xp, xpa: result.xpa }, depois: { nivel: result.nivel, xp: result.xp, xpa: result.xpa } };
  const xpAteAlvo = xpTotalParaNivel(nivelAlvo);
  const quantidade = xpAteAlvo - result.xpTotal;
  if (quantidade < 0) throw new Error("O XP acumulado da ficha não corresponde à progressão atual; não é seguro definir o nível.");
  if (quantidade > 0) adicionarXP(result, quantidade);
  return { data: result, quantidadeXpConcedida: quantidade, antes: { nivel: data.nivel ?? 1, xp: data.xp ?? 0, xpa: data.xpa ?? 1 }, depois: { nivel: result.nivel, xp: result.xp, xpa: result.xpa } };
}

export function concederEssenciaCampanha(data, tipo, afinidade, tecnicaIds) {
  const result = copiar(data);
  inicializarProgressao(result);
  const rule = ESSENCIAS[tipo];
  const check = verificarEssencia(result, tipo);
  if (!check.permitido) throw new Error(check.motivo);
  if (!rule?.ativa) throw new Error("Essa Essência ainda não está disponível.");
  const needed = rule.quantidadeTecnicas;
  if (!Array.isArray(tecnicaIds) || tecnicaIds.length !== needed || new Set(tecnicaIds).size !== needed) throw new Error(`Selecione exatamente ${needed} técnica(s) sem duplicação.`);
  const lineage = result.lineageName || result.lineage;
  for (const id of tecnicaIds) {
    const technique = TECNICAS.find(item => item.id === id);
    if (!podeAprenderTecnica(technique)) throw new Error("A técnica escolhida não pode ser aprendida.");
    const validAffinity = (tipo === "primeira" || tipo === "segunda") && technique.origem === "afinidade" && technique.grupo === afinidade;
    const validLineage = tipo === "primeira" && ((technique.origem === "linhagem" && technique.grupo === lineage) || (technique.origem === "arquetipo" && technique.grupo === result.archetype));
    if (!validAffinity && !validLineage) throw new Error("As técnicas selecionadas não correspondem aos requisitos desta Essência.");
  }
  const affinityCount = tecnicaIds.filter(id => TECNICAS.find(item => item.id === id)?.origem === "afinidade").length;
  const lineageCount = tecnicaIds.length - affinityCount;
  if ((tipo === "primeira" && (affinityCount !== 1 || lineageCount !== 1)) || (tipo === "segunda" && affinityCount !== 1)) throw new Error("As técnicas selecionadas não correspondem aos requisitos desta Essência.");
  const existingEntries = Array.isArray(result.techniques) ? result.techniques : [];
  const existing = new Set(existingEntries.map(item => typeof item === "string" ? item : item?.id).filter(Boolean));
  if (tecnicaIds.some(id => existing.has(id))) throw new Error("A Nativa já possui uma das técnicas selecionadas.");
  absorverEssencia(result, tipo, afinidade);
  result.techniques = [...existingEntries, ...tecnicaIds];
  return { data: result, afinidade, tecnicaIds: [...tecnicaIds] };
}

export function concederTracoCampanha(data, tracoId) {
  const trait = CATALOGO_TRACOS.find(item => item.id === tracoId);
  if (!trait) throw new Error("Selecione um traço do catálogo oficial.");
  const result = copiar(data);
  result.tracos = Array.isArray(result.tracos) ? [...result.tracos] : [];
  if (result.tracos.includes(tracoId)) throw new Error("A Nativa já possui este traço.");
  result.tracos.push(tracoId);
  return { data: result, trait };
}

export function removerTracoCampanha(data, tracoId) {
  const trait = CATALOGO_TRACOS.find(item => item.id === tracoId);
  if (!trait || !Array.isArray(data.tracos) || !data.tracos.includes(tracoId)) throw new Error("O traço não está presente no catálogo ou nesta Nativa.");
  const defaults = obterTracosPadraoLinhagem(data.lineageName || data.lineage);
  if (defaults.includes(tracoId)) throw new Error("Este traço é derivado da linhagem e não pode ser removido.");
  const result = copiar(data);
  result.tracos = result.tracos.filter(id => id !== tracoId);
  return { data: result, trait };
}

export function concederTecnicaCampanha(data, techniqueId) {
  const technique = TECNICAS.find(item => item.id === techniqueId);
  if (!podeAprenderTecnica(technique)) throw new Error("Selecione uma técnica disponível do catálogo oficial.");
  const result = copiar(data);
  const techniques = Array.isArray(result.techniques) ? result.techniques : [];
  const ids = techniques.map(item => typeof item === "string" ? item : item?.id).filter(Boolean);
  if (ids.includes(techniqueId)) throw new Error("A Nativa já possui esta técnica.");
  result.techniques = [...techniques, techniqueId];
  return { data: result, technique };
}

export function removerTecnicaCampanha(data, techniqueId) {
  const technique = TECNICAS.find(item => item.id === techniqueId);
  const techniques = Array.isArray(data.techniques) ? data.techniques : [];
  const ids = techniques.map(item => typeof item === "string" ? item : item?.id).filter(Boolean);
  if (!technique || !ids.includes(techniqueId)) throw new Error("A técnica não está presente no catálogo ou nesta Nativa.");
  if ((data.essencias || []).length) throw new Error("Não é possível identificar com segurança quais técnicas foram concedidas por Essências; a remoção fica bloqueada para preservar os requisitos delas.");
  const result = copiar(data);
  result.techniques = techniques.filter(item => (typeof item === "string" ? item : item?.id) !== techniqueId);
  return { data: result, technique };
}
