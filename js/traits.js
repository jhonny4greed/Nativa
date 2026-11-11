/** Catálogos extensíveis de características biológicas e comportamentais. */
export const CATALOGO_TRACOS = [
  ...["Quadrúpede", "Bípede", "Ápode", "Asas", "Cauda", "Nadadeiras"].map((nome, i) => ({ id: `estrutura-${i + 1}`, nome, categoria: "Estrutura corporal", descricao: `Característica anatômica: ${nome.toLowerCase()}.` })),
  ...["Garras", "Presas", "Chifres", "Bico", "Pinças", "Ferrão", "Barbilhões"].map((nome, i) => ({ id: `estrutura-natural-${i + 1}`, nome, categoria: "Estruturas naturais", descricao: `Estrutura natural: ${nome.toLowerCase()}.` })),
  ...["Carapaça", "Escamas", "Couro espesso", "Placas ósseas", "Pelagem densa", "Espinhos", "Exoesqueleto"].map((nome, i) => ({ id: `protecao-${i + 1}`, nome, categoria: "Proteção", descricao: `Adaptação protetora: ${nome.toLowerCase()}.` })),
  ...["Peçonha", "Veneno", "Secreção irritante", "Descarga elétrica", "Garras retráteis", "Mandíbulas poderosas", "Pelos urticantes"].map((nome, i) => ({ id: `fisiologia-${i + 1}`, nome, categoria: "Fisiologia e armas naturais", descricao: nome === "Peçonha" ? "Substância inoculada por estrutura especializada." : nome === "Veneno" ? "Substância tóxica que age por contato ou ingestão." : `Característica fisiológica: ${nome.toLowerCase()}.` })),
  ...["Visão aguçada", "Ecolocalização", "Faro desenvolvido", "Audição aguçada", "Percepção de vibrações", "Sensibilidade elétrica e química"].map((nome, i) => ({ id: `sentido-${i + 1}`, nome, categoria: "Sentidos", descricao: `Capacidade sensorial: ${nome.toLowerCase()}.` })),
  ...["Aquático", "Semiaquático", "Arborícola", "Escavador", "Voador", "Terrestre"].map((nome, i) => ({ id: `adaptacao-${i + 1}`, nome, categoria: "Adaptações ambientais", descricao: `Adaptação ecológica: ${nome.toLowerCase()}.` }))
];

// IDs independentes dos índices do catálogo preservam a compatibilidade quando ele crescer.
CATALOGO_TRACOS.push(
  { id: "protecao-pele-mucosa", nome: "Pele mucosa", categoria: "Proteção", descricao: "Pele fina e úmida, com secreções e permeabilidade características de muitos anfíbios; não concede proteção automática." },
  { id: "sentido-sensibilidade-eletrica", nome: "Sensibilidade elétrica", categoria: "Sentidos", descricao: "Capacidade de perceber campos elétricos no ambiente, útil para localizar ou acompanhar estímulos próximos." }
);

const descricoesTracos = {
  "Quadrúpede": "Locomoção e sustentação corporal apoiadas principalmente em quatro membros.",
  "Bípede": "Locomoção ou postura sustentada principalmente por dois membros.",
  "Ápode": "Corpo sem membros locomotores, com deslocamento por ondulação, rastejamento ou mecanismo equivalente.",
  "Asas": "Membros anteriores modificados em asas; sua presença não implica, por si só, voo ativo.",
  "Cauda": "Prolongamento posterior do corpo, que pode auxiliar no equilíbrio, locomoção, comunicação ou defesa.",
  "Nadadeiras": "Estruturas que auxiliam a estabilidade e a propulsão na água.",
  "Garras": "Extremidades córneas ou queratinizadas usadas para tração, escavação, captura ou defesa.",
  "Presas": "Dentes alongados ou proeminentes que podem auxiliar a captura e o processamento de alimento.",
  "Chifres": "Estruturas permanentes ou desenvolvidas na cabeça, usadas em defesa, disputa ou exibição conforme a espécie.",
  "Bico": "Estrutura córnea que envolve as mandíbulas e auxilia alimentação, captura ou manipulação.",
  "Pinças": "Apêndices articulados capazes de prender, manipular ou esmagar objetos e presas.",
  "Ferrão": "Estrutura especializada de defesa ou inoculação; presença e função dependem do grupo e da espécie.",
  "Barbilhões": "Apêndices sensoriais táteis e químicos, comuns em peixes que exploram o fundo ou águas turvas.",
  "Carapaça": "Cobertura externa rígida que protege parte do corpo; sua forma varia entre grupos.",
  "Escamas": "Peças ou placas dérmicas que cobrem e protegem a superfície corporal.",
  "Couro espesso": "Pele resistente e espessa que protege o corpo contra abrasão e impactos ambientais.",
  "Placas ósseas": "Elementos ósseos ou osteodérmicos que reforçam regiões do corpo.",
  "Pelagem densa": "Cobertura espessa de pelos que auxilia isolamento e proteção ambiental.",
  "Espinhos": "Projeções rígidas que podem dificultar o contato ou auxiliar na defesa.",
  "Exoesqueleto": "Esqueleto externo articulado que sustenta e protege o corpo dos artrópodes.",
  "Peçonha": "Substância tóxica inoculada por estrutura especializada, como ferrão ou presa canaliculada.",
  "Veneno": "Substância tóxica que causa efeito por contato ou ingestão; não pressupõe inoculação.",
  "Secreção irritante": "Secreção que irrita tecidos ou mucosas e pode atuar como defesa química.",
  "Descarga elétrica": "Produção de descargas ou pulsos elétricos por órgãos especializados.",
  "Garras retráteis": "Garras que podem ser recolhidas parcial ou totalmente, reduzindo exposição durante repouso ou locomoção.",
  "Mandíbulas poderosas": "Mandíbulas adaptadas para exercer força elevada ao prender, cortar ou esmagar alimento.",
  "Pelos urticantes": "Pelos especializados que podem causar irritação quando entram em contato com pele ou mucosas.",
  "Visão aguçada": "Capacidade visual especializada para perceber detalhes, movimento ou distância em condições pertinentes.",
  "Ecolocalização": "Emissão e interpretação de ecos para estimar posição e distância de objetos ou alvos.",
  "Faro desenvolvido": "Olfato apurado para reconhecer odores, rastros, alimento ou outros animais.",
  "Audição aguçada": "Capacidade de detectar sons fracos ou distinguir sinais acústicos com precisão elevada.",
  "Percepção de vibrações": "Detecção de vibrações transmitidas pelo solo ou pela água.",
  "Sensibilidade elétrica e química": "Percepção de estímulos elétricos e químicos do ambiente por receptores especializados.",
  "Sensibilidade elétrica": "Percepção de campos elétricos no ambiente por receptores especializados.",
  "Aquático": "Adaptação para viver e realizar atividades principalmente em ambientes aquáticos.",
  "Semiaquático": "Adaptação para alternar atividades entre ambientes aquáticos e terrestres.",
  "Arborícola": "Adaptação para deslocar-se ou viver principalmente sobre árvores e outras estruturas elevadas.",
  "Escavador": "Adaptação corporal ou comportamental para cavar, abrir túneis ou deslocar-se em substrato.",
  "Voador": "Capacidade de voo ativo; não é inferida apenas pela presença de asas.",
  "Terrestre": "Adaptação para deslocar-se e realizar atividades principalmente em substrato terrestre.",
  "Pele mucosa": "Pele fina e úmida, com secreções e permeabilidade características de muitos anfíbios; não concede proteção automática."
};
for (const traco of CATALOGO_TRACOS) traco.descricao = descricoesTracos[traco.nome] || traco.descricao;

const NOMES_TRACOS_POR_LINHAGEM = {
  "Felinos": ["Quadrúpede", "Cauda", "Garras", "Presas", "Faro desenvolvido"],
  "Canídeos": ["Quadrúpede", "Cauda", "Presas", "Faro desenvolvido", "Audição aguçada"],
  "Mustelídeos": ["Quadrúpede", "Cauda", "Garras", "Presas"],
  "Procionídeos": ["Quadrúpede", "Cauda", "Garras", "Faro desenvolvido"],
  "Roedores": ["Quadrúpede", "Cauda", "Garras"],
  "Marsupiais": ["Quadrúpede", "Cauda", "Garras"],
  "Primatas": ["Bípede", "Arborícola", "Cauda", "Visão aguçada"],
  "Morcegos": ["Asas", "Voador", "Ecolocalização"],
  "Xenartros": ["Quadrúpede", "Garras", "Escavador"],
  "Ungulados": ["Quadrúpede", "Couro espesso", "Faro desenvolvido"],
  "Aves de rapina": ["Bípede", "Asas", "Voador", "Garras", "Visão aguçada"],
  "Aves corredoras e campestres": ["Bípede", "Asas", "Garras"],
  "Aves aquáticas e pernaltas": ["Bípede", "Asas", "Voador"],
  "Psitacídeos": ["Bípede", "Asas", "Voador", "Bico"],
  "Serpentes": ["Ápode", "Escamas", "Mandíbulas poderosas"],
  "Lagartos": ["Quadrúpede", "Escamas", "Cauda"],
  "Quelônios": ["Carapaça", "Escamas"],
  "Crocodilianos": ["Quadrúpede", "Escamas", "Cauda", "Mandíbulas poderosas", "Semiaquático"],
  "Anuros": ["Pele mucosa"],
  "Peixes elétricos": ["Aquático", "Nadadeiras", "Descarga elétrica", "Sensibilidade elétrica"],
  "Characiformes": ["Aquático", "Nadadeiras"],
  "Siluriformes": ["Aquático", "Nadadeiras", "Barbilhões"],
  "Peixes cartilaginosos": ["Aquático", "Nadadeiras", "Escamas"],
  "Aracnídeos": ["Exoesqueleto", "Peçonha"],
  "Insetos sociais": ["Exoesqueleto"],
  "Insetos predadores": ["Exoesqueleto", "Mandíbulas poderosas"],
  "Crustáceos": ["Exoesqueleto", "Carapaça", "Pinças"]
};

const TRACOS_POR_LINHAGEM_PADRAO = Object.fromEntries(Object.entries(NOMES_TRACOS_POR_LINHAGEM).map(([linhagem, nomes]) => [
  linhagem,
  nomes.map(nome => CATALOGO_TRACOS.find(item => item.nome === nome)?.id).filter(Boolean)
]));
let tracosPorLinhagem = structuredClone(TRACOS_POR_LINHAGEM_PADRAO);

export function obterTracosPadraoLinhagem(linhagem) {
  return [...(tracosPorLinhagem[linhagem] || [])];
}

/** Retorna o registro estruturado de um traço pelo seu ID persistido. */
export function obterTracoPorId(id) {
  return CATALOGO_TRACOS.find(item => item.id === id) || null;
}

/** Consulta um ID de traço específico na ficha, sem efeitos ou regras implícitas. */
export function nativaPossuiTraco(nativa, tracoId) {
  return Boolean(tracoId && Array.isArray(nativa?.tracos) && nativa.tracos.includes(tracoId));
}

export function obterTracosComunsLinhagem(linhagem) {
  return obterTracosPadraoLinhagem(linhagem).map(id => CATALOGO_TRACOS.find(item => item.id === id)?.nome).filter(Boolean);
}

export const CATALOGO_TRACOS_QUIMERICOS = [];

export const CATALOGO_HABITOS = [
  ...["Diurno", "Noturno", "Crepuscular"].map((nome, i) => ({ id: `ritmo-${i + 1}`, nome, categoria: "Ritmo diário" })),
  ...["Solitário", "Gregário", "Territorial"].map((nome, i) => ({ id: `social-${i + 1}`, nome, categoria: "Comportamento social" })),
  { id: "caca-emboscada", nome: "Caçador de emboscada", categoria: "Comportamento de caça" },
  { id: "ecologia-migratorio", nome: "Migratório", categoria: "Deslocamento e comportamento ecológico" },
  { id: "ecologia-nomade", nome: "Nômade", categoria: "Deslocamento e comportamento ecológico" }
];

function clonar(valor) { return JSON.parse(JSON.stringify(valor)); }

export function obterCatalogoGlobalNativas() {
  return {
    tracos: clonar(CATALOGO_TRACOS),
    tracosQuimericos: clonar(CATALOGO_TRACOS_QUIMERICOS),
    habitos: clonar(CATALOGO_HABITOS.map(item => ({ descricao: "", ...item }))),
    tracosPorLinhagem: clonar(tracosPorLinhagem)
  };
}

export function validarCatalogoGlobalNativas(catalogo) {
  if (!catalogo || typeof catalogo !== "object" || Array.isArray(catalogo)) throw new Error("O catálogo precisa ser um objeto JSON.");
  const validarLista = (chave, { descricao = true, limite = 500 } = {}) => {
    const lista = catalogo[chave];
    if (!Array.isArray(lista) || lista.length > limite) throw new Error(`“${chave}” precisa ser uma lista com até ${limite} itens.`);
    const ids = new Set();
    return lista.map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`Item ${index + 1} de “${chave}” inválido.`);
      const id = String(item.id || "").trim();
      const nome = String(item.nome || "").trim();
      const categoria = String(item.categoria || "").trim();
      const texto = String(item.descricao || "").trim();
      if (!/^[a-z0-9][a-z0-9-]{0,119}$/.test(id)) throw new Error(`ID inválido em “${chave}”: ${id || `item ${index + 1}`}.`);
      if (ids.has(id)) throw new Error(`ID duplicado em “${chave}”: ${id}.`);
      if (!nome || nome.length > 100 || !categoria || categoria.length > 100) throw new Error(`Nome ou categoria inválida em “${chave}” (${id}).`);
      if (descricao && (!texto || texto.length > 1000)) throw new Error(`Informe uma descrição de até 1.000 caracteres para “${nome}”.`);
      if (texto.length > 1000) throw new Error(`A descrição de “${nome}” excede 1.000 caracteres.`);
      ids.add(id);
      return { id, nome, categoria, descricao: texto };
    });
  };
  const tracos = validarLista("tracos");
  const tracosQuimericos = validarLista("tracosQuimericos");
  const habitos = validarLista("habitos", { descricao: false });
  const tracosPorLinhagemFonte = catalogo.tracosPorLinhagem;
  if (!tracosPorLinhagemFonte || typeof tracosPorLinhagemFonte !== "object" || Array.isArray(tracosPorLinhagemFonte)) throw new Error("“tracosPorLinhagem” precisa ser um objeto de linhagens e IDs de traço.");
  const idsTracos = new Set(tracos.map(item => item.id));
  const tracosPorLinhagem = {};
  for (const [linhagem, ids] of Object.entries(tracosPorLinhagemFonte)) {
    if (!linhagem.trim() || linhagem.length > 100 || !Array.isArray(ids) || ids.length > 100) throw new Error(`Lista de traços inválida para a linhagem “${linhagem}”.`);
    const unicos = [...new Set(ids.map(String))];
    if (unicos.some(id => !idsTracos.has(id))) throw new Error(`A linhagem “${linhagem}” contém um ID que não existe em “tracos”.`);
    tracosPorLinhagem[linhagem] = unicos;
  }
  return { tracos, tracosQuimericos, habitos, tracosPorLinhagem };
}

export function aplicarCatalogoGlobalNativas(catalogo) {
  const validado = validarCatalogoGlobalNativas(catalogo);
  CATALOGO_TRACOS.splice(0, CATALOGO_TRACOS.length, ...validado.tracos);
  CATALOGO_TRACOS_QUIMERICOS.splice(0, CATALOGO_TRACOS_QUIMERICOS.length, ...validado.tracosQuimericos);
  CATALOGO_HABITOS.splice(0, CATALOGO_HABITOS.length, ...validado.habitos);
  tracosPorLinhagem = validado.tracosPorLinhagem;
  if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent("nativa:global-catalog-updated", { detail: { revision: null } }));
  return validado;
}

export async function carregarCatalogoGlobalNativas(client) {
  const { data, error } = await client.from("nativa_global_catalog").select("catalog,revision").eq("id", "main").maybeSingle();
  if (error) throw error;
  if (!data?.catalog || !Object.keys(data.catalog).length) return { revision: data?.revision || 0, source: "bundled" };
  aplicarCatalogoGlobalNativas(data.catalog);
  return { revision: data.revision, source: "remote" };
}

export const PERIODOS_BATALHA = ["Amanhecer", "Dia", "Entardecer", "Noite"];

export function nomesTracos(nativa) {
  return (nativa?.tracos || []).map(id => CATALOGO_TRACOS.find(item => item.id === id)?.nome || id);
}
