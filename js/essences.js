export const ESSENCIAS = {
  primeira: { nome: "Primeira Essência", nivelNecessario: 5, estagioNecessario: 1, ativa: true, quantidadeTecnicas: 2, descricao: "Concede os golpes de linhagem e de afinidade da Nativa de origem. Não altera as defesas." },
  segunda: { nome: "Segunda Essência", nivelNecessario: 12, estagioNecessario: 2, ativa: true, quantidadeTecnicas: 1, descricao: "Concede a afinidade da Nativa de origem e um golpe dessa afinidade. As afinidades combinam fraquezas e resistências." },
  terceira: { nome: "Terceira Essência", estagioNecessario: 3, ativa: false, quantidadeTecnicas: 0, descricao: "Reservada para o último estágio evolutivo. Nível de obtenção ainda não definido; ainda não disponível." }
};

export function verificarEssencia(nativa, tipo) {
  const regra = ESSENCIAS[tipo];
  if (!regra) return { permitido: false, motivo: "Essência inválida." };
  if (!regra.ativa) return { permitido: false, motivo: "Essa Essência ainda não está disponível." };
  if (Number.isInteger(regra.nivelNecessario) && (nativa.nivel || 1) < regra.nivelNecessario) return { permitido: false, motivo: `É necessário atingir o nível ${regra.nivelNecessario}.` };
  if ((nativa.estagio || 1) < regra.estagioNecessario) return { permitido: false, motivo: "A Nativa precisa alcançar o estágio evolutivo necessário." };
  const absorvidas = nativa.essencias || [];
  if (absorvidas.includes(tipo)) return { permitido: false, motivo: "Essa Essência já foi absorvida." };
  if (tipo === "segunda" && !absorvidas.includes("primeira")) return { permitido: false, motivo: "É necessário absorver a primeira Essência antes." };
  return { permitido: true, motivo: "A Nativa pode absorver esta Essência." };
}

export function absorverEssencia(nativa, tipo, novaAfinidade = null, essenciaId = null) {
  const validacao = verificarEssencia(nativa, tipo);
  if (!validacao.permitido) throw new Error(validacao.motivo);
  const disponiveis = Array.isArray(nativa.essenciasDisponiveis) ? nativa.essenciasDisponiveis : [];
  if (!disponiveis.some(item => item?.origem === "combate")) throw new Error("Só é possível absorver Essências obtidas em vitórias de combate.");
  nativa.essencias ??= [];
  nativa.afinidadesEssencia ??= [];
  if (tipo === "segunda") {
    if (!novaAfinidade) throw new Error("Escolha uma afinidade para a Essência.");
    const original = nativa.affinity || nativa.afinidade;
    const existentes = [original, ...nativa.afinidadesEssencia];
    if (existentes.includes(novaAfinidade)) throw new Error("A Nativa já possui essa afinidade.");
    nativa.afinidadesEssencia.push(novaAfinidade);
  }
  const index = essenciaId ? disponiveis.findIndex(item => item?.id === essenciaId && item?.origem === "combate") : disponiveis.findIndex(item => item?.origem === "combate");
  if (index < 0) throw new Error("A Essência selecionada não está mais guardada nesta ficha.");
  const [consumida] = disponiveis.splice(index, 1);
  nativa.essenciasDisponiveis = disponiveis;
  nativa.essencias.push(tipo);
  nativa.historicoProgressao ??= [];
  nativa.historicoProgressao.push({ tipo: "essencia", essencia: tipo, afinidade: novaAfinidade, essenciaDropId: consumida?.id || null, origemOponenteId: consumida?.oponenteId || null, golpesAdquiridos: [] });
  return nativa;
}

export function atualizarEstagio(nativa) {
  const nivel = nativa.nivel || 1;
  nativa.estagio = nivel >= 17 ? 3 : nivel >= 10 ? 2 : 1;
  return nativa.estagio;
}
