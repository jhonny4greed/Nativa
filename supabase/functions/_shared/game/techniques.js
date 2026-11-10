// Fonte de verdade do catálogo ativo NATIVA V2.2.1.
import { obterTracoPorId } from "./traits.js";
import { TECNICAS_V2_2_1 } from "./techniques-v2-2-1.js";
import { TECNICAS_ARQUIVADAS } from "./techniques-archive.js";

export { TECNICAS_ARQUIVADAS };
export const TECNICAS_V1_ARQUIVO = TECNICAS_ARQUIVADAS.filter(tecnica => tecnica.versao === "1.0");
export const TECNICAS_ARQUETIPO_LEGADO = TECNICAS_ARQUIVADAS.filter(tecnica => tecnica.grupo === "Veloz");

const criarSinergia = (tracoId, tipo, valor, descricao) => {
  if (!obterTracoPorId(tracoId)) throw new Error(`ID de Traço inexistente na sinergia: ${tracoId}`);
  return { tracoId, efeito: { tipo, valor }, descricao, estadoRevisao: "confirmada" };
};

// Apenas as oito relações com correspondência exata de golpe, grupo e Traço.
const sinergiasV2_2_1 = {
  "linhagem-v2-1-felinos-bote-predatorio": [criarSinergia("estrutura-natural-1", "bonus_dano", 1, "As garras reforçam o bote.")],
  "linhagem-v2-1-felinos-garras-perfurantes": [criarSinergia("estrutura-natural-1", "bonus_precisao", 1, "As garras ajudam a direcionar a perfuração.")],
  "linhagem-v2-1-canideos-mordida-persistente": [criarSinergia("estrutura-natural-2", "bonus_dano", 1, "As presas aprofundam a mordida.")],
  "linhagem-v2-1-xenartros-garras-escavadoras": [criarSinergia("estrutura-natural-1", "bonus_dano", 1, "As garras concentram força no golpe.")],
  "linhagem-v2-1-aves-de-rapina-mergulho-predatorio": [criarSinergia("adaptacao-5", "bonus_precisao", 1, "O voo ajuda a ajustar a trajetória.")],
  "linhagem-v2-1-psitacideos-bico-poderoso": [criarSinergia("estrutura-natural-4", "bonus_dano", 1, "O bico reforça o impacto da bicada.")],
  "linhagem-v2-1-crocodilianos-mordida-de-emboscada": [criarSinergia("fisiologia-6", "bonus_dano", 1, "As mandíbulas reforçam a mordida.")],
  "linhagem-v2-1-crustaceos-pinca-esmagadora": [criarSinergia("estrutura-natural-5", "bonus_dano", 1, "As pinças reforçam o esmagamento.")]
};

export const TECNICAS = TECNICAS_V2_2_1.map(tecnica => ({
  ...tecnica,
  sinergias: sinergiasV2_2_1[tecnica.id] || [],
  sinergiasCandidatas: []
}));

export function obterTecnicaPorId(id, { incluirArquivo = true } = {}) {
  return TECNICAS.find(tecnica => tecnica.id === id)
    || (incluirArquivo ? TECNICAS_ARQUIVADAS.find(tecnica => tecnica.id === id) : null)
    || null;
}

export const CONTAGEM_TECNICAS = Object.freeze({
  linhagem: TECNICAS.filter(tecnica => tecnica.origem === "linhagem").length,
  linhagemV1Arquivadas: TECNICAS_V1_ARQUIVO.length,
  bioma: TECNICAS.filter(tecnica => tecnica.origem === "bioma").length,
  arquetipo: TECNICAS.filter(tecnica => tecnica.origem === "arquetipo").length,
  afinidade: TECNICAS.filter(tecnica => tecnica.origem === "afinidade").length,
  total: TECNICAS.length
});
