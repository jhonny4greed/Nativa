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

const TRACOS_COMUNS_POR_LINHAGEM = {
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

export function obterTracosPadraoLinhagem(linhagem) {
  return (TRACOS_COMUNS_POR_LINHAGEM[linhagem] || []).map(nome => CATALOGO_TRACOS.find(item => item.nome === nome)?.id).filter(Boolean);
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
  return [...(TRACOS_COMUNS_POR_LINHAGEM[linhagem] || [])];
}

export const CATALOGO_HABITOS = [
  ...["Diurno", "Noturno", "Crepuscular"].map((nome, i) => ({ id: `ritmo-${i + 1}`, nome, categoria: "Ritmo diário" })),
  ...["Solitário", "Gregário", "Territorial"].map((nome, i) => ({ id: `social-${i + 1}`, nome, categoria: "Comportamento social" })),
  { id: "caca-emboscada", nome: "Caçador de emboscada", categoria: "Comportamento de caça" },
  { id: "ecologia-migratorio", nome: "Migratório", categoria: "Deslocamento e comportamento ecológico" },
  { id: "ecologia-nomade", nome: "Nômade", categoria: "Deslocamento e comportamento ecológico" }
];

export const PERIODOS_BATALHA = ["Amanhecer", "Dia", "Entardecer", "Noite"];

export function nomesTracos(nativa) {
  return (nativa?.tracos || []).map(id => CATALOGO_TRACOS.find(item => item.id === id)?.nome || id);
}
