import { atualizarEstagio } from "./essences.js";

export const ATRIBUTOS_PROGRESSAO = ["ATQ", "POT", "DEF", "RES", "AGI", "HP", "MP"];
export const NIVEL_MAXIMO_TEMPORARIO = 17;

export function xpTotalParaNivel(nivel) {
  if (!Number.isInteger(nivel) || nivel < 1) throw new Error("Nível inválido.");
  return (nivel * (nivel + 1)) / 2 - 1;
}

export function xpPorVitoria(nivelVencedor, nivelDerrotado) {
  if (!Number.isInteger(nivelVencedor) || nivelVencedor < 1 || !Number.isInteger(nivelDerrotado) || nivelDerrotado < 1) {
    throw new Error("Os níveis das Nativas precisam ser inteiros positivos para calcular a recompensa.");
  }
  return nivelDerrotado < nivelVencedor ? 1 : nivelDerrotado === nivelVencedor ? 2 : 3;
}

export function inicializarProgressao(nativa) {
  nativa.nivel ??= 1;
  nativa.xp ??= 0;
  nativa.xpa ??= 1;
  // Compatibilidade legada: XP total é derivável do nível e do saldo atual.
  nativa.xpTotal ??= xpTotalParaNivel(nativa.nivel) + nativa.xp;
  nativa.estagio ??= 1;
  nativa.essencias ??= [];
  nativa.afinidadesEssencia ??= [];
  nativa.historicoProgressao ??= [];
  atualizarEstagio(nativa);
  return nativa;
}

export function xpNecessario(nativa) { return nativa.nivel + 1; }

export function adicionarXP(nativa, quantidade) {
  inicializarProgressao(nativa);
  quantidade = Number(quantidade);
  if (!Number.isInteger(quantidade) || quantidade <= 0) throw new Error("Informe uma quantidade inteira e positiva de XP.");
  if (!Number.isInteger(nativa.nivel) || nativa.nivel < 1 || !Number.isInteger(nativa.xp) || nativa.xp < 0 || !Number.isInteger(nativa.xpTotal) || nativa.xpTotal < 0) {
    throw new Error("Os dados de XP ou nível desta ficha são inválidos.");
  }
  if(nativa.nivel>=NIVEL_MAXIMO_TEMPORARIO){nativa.xp=0;return {xpAtual:0,xpNecessario:0,niveisConquistados:[],nivelMaximo:true};}
  nativa.xp += quantidade;
  nativa.xpTotal += quantidade;
  const niveis = [];
  while (nativa.nivel<NIVEL_MAXIMO_TEMPORARIO && nativa.xp >= xpNecessario(nativa)) {
    const anterior = nativa.nivel;
    const custo = xpNecessario(nativa);
    nativa.xp -= custo;
    nativa.nivel += 1;
    nativa.xpa += nativa.nivel;
    const estagioAnterior = nativa.estagio;
    atualizarEstagio(nativa);
    const registro = { tipo: "nivel", nivelAnterior: anterior, nivelNovo: nativa.nivel, xpConsumido: custo, xpaRecebido: nativa.nivel, estagioAnterior, estagioNovo: nativa.estagio };
    nativa.historicoProgressao.push(registro);
    niveis.push(registro);
  }
  if(nativa.nivel===NIVEL_MAXIMO_TEMPORARIO)nativa.xp=0;
  return { xpAtual: nativa.xp, xpNecessario: nativa.nivel===NIVEL_MAXIMO_TEMPORARIO?0:xpNecessario(nativa), niveisConquistados: niveis,nivelMaximo:nativa.nivel===NIVEL_MAXIMO_TEMPORARIO };
}

export function custoAtributo(valorAtual) { return valorAtual + 1; }

export function aumentarAtributo(nativa, atributo) {
  inicializarProgressao(nativa);
  if (!ATRIBUTOS_PROGRESSAO.includes(atributo)) throw new Error("Atributo inválido.");
  const valor = nativa.attrs?.[atributo];
  if (!Number.isInteger(valor) || valor < 1) throw new Error("Atributo não encontrado ou inválido na ficha.");
  if (!Number.isInteger(nativa.xpa) || nativa.xpa < 0) throw new Error("O saldo de XPA desta ficha é inválido.");
  const custo = custoAtributo(valor);
  if (nativa.xpa < custo) throw new Error(`Você precisa de ${custo} XPA para melhorar ${atributo}.`);
  nativa.xpa -= custo;
  nativa.attrs[atributo]++;
  nativa.historicoProgressao.push({ tipo: "atributo", atributo, valorAnterior: valor, valorNovo: nativa.attrs[atributo], xpaGasto: custo });
  return nativa.attrs[atributo];
}

export function obterResumoProgressao(nativa) {
  inicializarProgressao(nativa);
  return { nivel: nativa.nivel, estagio: nativa.estagio, xpAtual: nativa.xp, xpAcumulado: nativa.xpTotal, xpNecessario: xpNecessario(nativa), xpaDisponivel: nativa.xpa, historico: nativa.historicoProgressao };
}
