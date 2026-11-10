import { TECNICAS_V2_2_1 } from "./techniques-v2-2-1.js";

export const DEFINICOES_EFEITOS_V2_2_1 = Object.freeze({
  desorientacao: Object.freeze({
    id: "desorientacao",
    momento: "próximo golpe ofensivo do alvo",
    duracao: "até o fim do próximo turno do alvo",
    acumula: false,
    intensidade: 1
  }),
  reducao_atributo: Object.freeze({
    id: "reducao_atributo",
    atributos: Object.freeze(["ATQ", "AGI"]),
    momento: "cálculo do atributo efetivo",
    duracao: "até o fim do próximo turno do alvo",
    acumula: false,
    intensidade: 1
  }),
  reducao_dano: Object.freeze({
    id: "reducao_dano",
    categorias: Object.freeze(["geral", "Físico", "Especial"]),
    momento: "próximo dano elegível recebido",
    acumula: false
  }),
  bonus_precisao: Object.freeze({
    id: "bonus_precisao",
    momento: "próximo golpe ofensivo próprio",
    expira: "fim do próximo turno do usuário",
    acumula: false,
    intensidade: 1
  }),
  envenenamento: Object.freeze({
    id: "envenenamento",
    momento: "fim do turno do alvo",
    duracao: 2,
    acumula: false,
    renovarDuracao: true,
    danoPorOcorrencia: 1
  }),
  digestao: Object.freeze({
    id: "digestao",
    momento: "fim do próximo turno do alvo",
    duracao: 1,
    acumula: false,
    substituiAnterior: true,
    dano: 1
  }),
  secrecao_defensiva: Object.freeze({
    id: "secrecao_defensiva",
    gatilho: "ataque físico de contato recebido",
    duracaoUsuario: 2,
    ativacoes: 1,
    acumula: false
  })
});

const porIdentidade = new Map(TECNICAS_V2_2_1.map(tecnica => [
  `${tecnica.origem}|${tecnica.grupo}|${tecnica.nome}`,
  tecnica.id
]));
const efeitosPorId = new Map();

function registrar(origem, grupo, nome, ...efeitos) {
  const id = porIdentidade.get(`${origem}|${grupo}|${nome}`);
  if (!id) throw new Error(`Golpe ausente no catálogo V2.2.1: ${origem} / ${grupo} / ${nome}`);
  efeitosPorId.set(id, Object.freeze(efeitos.map(efeito => Object.freeze(efeito))));
}

const efeitoDesorientacao = Object.freeze({ tipo: "desorientacao", alvo: "alvo" });
const efeitoReducao = (atributo, alvo = "alvo") => ({ tipo: "reducao-atributo", atributo, valor: 1, alvo });
const efeitoReducaoDano = (categoria, valor) => ({ tipo: "reducao-dano", categoria, valor, alvo: "usuario" });

// Os valores abaixo seguem as regras explícitas da consolidação. Quando a
// descrição V2.2 traz intensidade maior, prevalece a regra V2.2.1 definida acima.
[
  ["Felinos", "Rugido da Caçadora"],
  ["Primatas", "Grito de Alerta"],
  ["Morcegos", "Pulso Ultrassônico"],
  ["Ungulados", "Investida de Grande Porte"],
  ["Ungulados", "Brado Territorial"],
  ["Psitacídeos", "Bicada Desestabilizadora"],
  ["Psitacídeos", "Vocalização Imitativa"],
  ["Lagartos", "Ameaça Visual"]
].forEach(([grupo, nome]) => registrar("linhagem", grupo, nome, efeitoDesorientacao));

[
  ["Mustelídeos", "Agarrão Aquático", "AGI"],
  ["Xenartros", "Língua Capturadora", "AGI"],
  ["Aves corredoras e campestres", "Chute de Ema", "ATQ"],
  ["Serpentes", "Constrição", "AGI"],
  ["Anuros", "Língua Capturadora", "AGI"],
  ["Siluriformes", "Sucção Poderosa", "AGI"],
  ["Aracnídeos", "Pinça de Escorpião", "ATQ"],
  ["Insetos sociais", "Ácido Defensivo", "ATQ"],
  ["Insetos predadores", "Captura do Louva-a-deus", "AGI"],
  ["Crustáceos", "Pinça Esmagadora", "AGI"]
].forEach(([grupo, nome, atributo]) => registrar("linhagem", grupo, nome, efeitoReducao(atributo)));

registrar("linhagem", "Mustelídeos", "Secreção Defensiva", {
  tipo: "preparar-secrecao",
  consequencia: "reducao-atq",
  valor: 1,
  alvo: "atacante"
});
registrar("linhagem", "Marsupiais", "Secreção Repulsiva", {
  tipo: "preparar-secrecao",
  consequencia: "desorientacao",
  valor: 1,
  alvo: "atacante"
});
registrar("linhagem", "Anuros", "Secreção Defensiva", {
  tipo: "preparar-secrecao",
  consequencia: "dano-especial",
  valor: 2,
  alvo: "atacante"
});

registrar("linhagem", "Serpentes", "Bote de Jararaca", {
  tipo: "envenenamento",
  alvo: "alvo"
});
registrar("linhagem", "Serpentes", "Peçonha Concentrada", {
  tipo: "intensificar-envenenamento",
  alvo: "alvo"
});
registrar("linhagem", "Aracnídeos", "Picada Venenosa", {
  tipo: "envenenamento",
  alvo: "alvo"
});
registrar("linhagem", "Insetos predadores", "Enzimas Digestivas", {
  tipo: "digestao",
  alvo: "alvo"
});

[
  ["Marsupiais", "Falsa Morte", "geral", 3],
  ["Morcegos", "Voo Errático", "Físico", 2],
  ["Quelônios", "Vocalização de Defesa", "geral", 2]
].forEach(([grupo, nome, categoria, valor]) => registrar("linhagem", grupo, nome, efeitoReducaoDano(categoria, valor)));

[
  ["Floresta e Mata", "Camuflagem de Folhas", "geral", 2],
  ["Rios, Lagos e Pantanal", "Mergulho Repentino", "geral", 3],
  ["Caatinga e Cerrado", "Refúgio entre Arbustos", "Físico", 2],
  ["Costa, Restinga e Manguezal", "Salto de Duna", "Físico", 2],
  ["Costa, Restinga e Manguezal", "Casco Salino", "Especial", 2],
  ["Campos Sulinos e Pampa", "Toca de Campo", "geral", 3]
].forEach(([grupo, nome, categoria, valor]) => registrar("bioma", grupo, nome, efeitoReducaoDano(categoria, valor)));

registrar("arquetipo", "Guardião", "Muralha Instintiva", efeitoReducaoDano("geral", 3));
registrar("arquetipo", "Guardião", "Âncora Vital", efeitoReducaoDano("geral", 1));
registrar("afinidade", "Terra", "Muralha Súbita", efeitoReducaoDano("geral", 3));

[
  ["Aves corredoras e campestres", "Chamado de Advertência"],
  ["Peixes cartilaginosos", "Percepção do Tubarão-martelo"]
].forEach(([grupo, nome]) => registrar("linhagem", grupo, nome, {
  tipo: "bonus-precisao",
  valor: 1,
  alvo: "usuario"
}));

export function obterEfeitosCombate(tecnicaId) {
  return efeitosPorId.get(tecnicaId) || Object.freeze([]);
}

export function obterCatalogoEfeitosCombate() {
  return Object.freeze(Object.fromEntries(efeitosPorId));
}
