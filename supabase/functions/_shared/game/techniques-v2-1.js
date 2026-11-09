// Catálogo conceitual V2.1 em revisão. Parâmetros numéricos requerem fonte V2.0 validada.
import { CATALOGO_TRACOS } from './traits.js';
import { auditarTecnicaV21, calcularPGBruto, calcularPGLiquido, calcularCustoEfeitos, obterParametrosEspeciaisV2_1 } from './technique-balance.js';
import { obterEfeitosConceituaisV2_1 } from './technique-effects-v2-1.js';

const registros = [
  {
    "name": "Bote Predatório",
    "category": "Físico",
    "group": "Felinos",
    "effect": "Avança contra o alvo e causa dano adicional quando ele ainda não agiu no turno.",
    "synergyCandidates": [
      "Garras",
      "melhorando a execução do bote"
    ]
  },
  {
    "name": "Garras Perfurantes",
    "category": "Físico",
    "group": "Felinos",
    "effect": "Ataque concentrado que atravessa parte da proteção do alvo.",
    "synergyCandidates": [
      "Garras retráteis",
      "favorecendo o ataque surpresa"
    ]
  },
  {
    "name": "Rugido da Caçadora",
    "category": "Especial",
    "group": "Felinos",
    "effect": "Intimida o alvo e dificulta sua próxima ação ofensiva.",
    "synergyCandidates": []
  },
  {
    "name": "Foco Predatório",
    "category": "Suporte",
    "group": "Felinos",
    "effect": "Observa um adversário e prepara uma resposta mais eficaz contra ele.",
    "synergyCandidates": [
      "Visão aguçada",
      "melhorando a leitura dos movimentos"
    ]
  },
  {
    "name": "Faro de Perseguição",
    "category": "Especial",
    "group": "Canídeos",
    "effect": "Identifica e acompanha o rastro de um alvo, mesmo após tentativa de fuga.",
    "synergyCandidates": [
      "Faro desenvolvido",
      "melhorando o rastreamento"
    ]
  },
  {
    "name": "Mordida Persistente",
    "category": "Físico",
    "group": "Canídeos",
    "effect": "Mordida que mantém pressão sobre o alvo e pode causar sangramento.",
    "synergyCandidates": []
  },
  {
    "name": "Investida de Matilha",
    "category": "Físico",
    "group": "Canídeos",
    "effect": "Aproveita a pressão de um aliado para executar uma investida mais eficaz.",
    "synergyCandidates": []
  },
  {
    "name": "Uivo Coordenador",
    "category": "Suporte",
    "group": "Canídeos",
    "effect": "Coordena aliados e permite que reajustem suas ações diante da movimentação inimiga.",
    "synergyCandidates": []
  },
  {
    "name": "Agarrão Aquático",
    "category": "Físico",
    "group": "Mustelídeos",
    "effect": "Agarra o adversário e restringe sua movimentação, especialmente em ambiente aquático.",
    "synergyCandidates": []
  },
  {
    "name": "Mordida de Fixação",
    "category": "Físico",
    "group": "Mustelídeos",
    "effect": "Prende o alvo com uma mordida e dificulta sua fuga.",
    "synergyCandidates": [
      "Mandíbulas poderosas"
    ]
  },
  {
    "name": "Secreção Defensiva",
    "category": "Especial",
    "group": "Mustelídeos",
    "effect": "Libera substância irritante que dificulta a aproximação do adversário.",
    "synergyCandidates": [
      "Secreção irritante"
    ]
  },
  {
    "name": "Instinto de Sobrevivência",
    "category": "Suporte",
    "group": "Mustelídeos",
    "effect": "Reage a uma ameaça iminente, priorizando preservação e fuga.",
    "synergyCandidates": []
  },
  {
    "name": "Manipulação Precisa",
    "category": "Suporte",
    "group": "Procionídeos",
    "effect": "Utiliza as extremidades para manipular objetos ou explorar pontos vulneráveis.",
    "synergyCandidates": []
  },
  {
    "name": "Garras Escaladoras",
    "category": "Físico",
    "group": "Procionídeos",
    "effect": "Ataca utilizando uma superfície ou obstáculo para obter posição favorável.",
    "synergyCandidates": [
      "Garras"
    ]
  },
  {
    "name": "Exploração Atenta",
    "category": "Especial",
    "group": "Procionídeos",
    "effect": "Investiga o ambiente e identifica elementos úteis, esconderijos ou ameaças.",
    "synergyCandidates": []
  },
  {
    "name": "Mordida Oportunista",
    "category": "Suporte",
    "group": "Procionídeos",
    "effect": "Prepara um ataque contra um alvo distraído ou comprometido.",
    "synergyCandidates": []
  },
  {
    "name": "Mergulho de Fuga",
    "category": "Suporte",
    "group": "Roedores",
    "effect": "Executa fuga rápida em direção a uma posição protegida.",
    "synergyCandidates": []
  },
  {
    "name": "Incisivos Poderosos",
    "category": "Físico",
    "group": "Roedores",
    "effect": "Mordida que desgasta proteções e estruturas resistentes.",
    "synergyCandidates": []
  },
  {
    "name": "Impacto de Roedura",
    "category": "Físico",
    "group": "Roedores",
    "effect": "Sequência de mordidas rápidas que pressiona o adversário.",
    "synergyCandidates": []
  },
  {
    "name": "Alerta da Colônia",
    "category": "Especial",
    "group": "Roedores",
    "effect": "Detecta uma ameaça e transmite o alerta aos aliados.",
    "synergyCandidates": []
  },
  {
    "name": "Falsa Morte",
    "category": "Especial",
    "group": "Marsupiais",
    "effect": "Simula incapacidade para induzir o adversário a baixar a guarda.",
    "synergyCandidates": []
  },
  {
    "name": "Mordida Defensiva",
    "category": "Físico",
    "group": "Marsupiais",
    "effect": "Contra-ataca um adversário que se aproxima ou tenta agarrar a Nativa.",
    "synergyCandidates": []
  },
  {
    "name": "Secreção Repulsiva",
    "category": "Especial",
    "group": "Marsupiais",
    "effect": "Libera substância que desestimula aproximação e ataques de contato.",
    "synergyCandidates": [
      "Secreção irritante"
    ]
  },
  {
    "name": "Recuperação Oportuna",
    "category": "Suporte",
    "group": "Marsupiais",
    "effect": "Aproveita uma abertura para recuperar parte da capacidade de sobrevivência.",
    "synergyCandidates": []
  },
  {
    "name": "Manipulação de Ferramentas",
    "category": "Físico",
    "group": "Primatas",
    "effect": "Utiliza objeto do ambiente para executar ataque adaptado à situação.",
    "synergyCandidates": []
  },
  {
    "name": "Ataque Coordenado",
    "category": "Suporte",
    "group": "Primatas",
    "effect": "Combina o movimento da Nativa com a ação de um aliado.",
    "synergyCandidates": []
  },
  {
    "name": "Grito de Alerta",
    "category": "Especial",
    "group": "Primatas",
    "effect": "Emite chamado que revela perigo ou prejudica a concentração adversária.",
    "synergyCandidates": []
  },
  {
    "name": "Observação Inteligente",
    "category": "Suporte",
    "group": "Primatas",
    "effect": "Analisa o comportamento do adversário e identifica padrões exploráveis.",
    "synergyCandidates": []
  },
  {
    "name": "Ecolocalização",
    "category": "Especial",
    "group": "Morcegos",
    "effect": "Detecta posição de criaturas e obstáculos mesmo sem depender da visão.",
    "synergyCandidates": [
      "Ecolocalização",
      "ampliando a detecção"
    ]
  },
  {
    "name": "Mergulho Predatório",
    "category": "Físico",
    "group": "Morcegos",
    "effect": "Executa ataque descendente aproveitando a velocidade do voo.",
    "synergyCandidates": [
      "Asas"
    ]
  },
  {
    "name": "Pulso Ultrassônico",
    "category": "Especial",
    "group": "Morcegos",
    "effect": "Emite onda sonora que desorienta o adversário.",
    "synergyCandidates": []
  },
  {
    "name": "Voo Errático",
    "category": "Especial",
    "group": "Morcegos",
    "effect": "Executa movimentos imprevisíveis que dificultam a leitura dos próximos deslocamentos.",
    "synergyCandidates": []
  },
  {
    "name": "Defesa Esférica",
    "category": "Suporte",
    "group": "Xenartros",
    "effect": "Recolhe o corpo e reduz a exposição a ataques.",
    "synergyCandidates": [
      "Carapaça"
    ]
  },
  {
    "name": "Garras Escavadoras",
    "category": "Físico",
    "group": "Xenartros",
    "effect": "Escava ou golpeia com as garras, podendo desestabilizar o alvo ou criar passagem.",
    "synergyCandidates": [
      "Escavador"
    ]
  },
  {
    "name": "Língua Capturadora",
    "category": "Especial",
    "group": "Xenartros",
    "effect": "Projeta a língua para capturar um alvo ou objeto.",
    "synergyCandidates": []
  },
  {
    "name": "Couraça Resistente",
    "category": "Suporte",
    "group": "Xenartros",
    "effect": "Assume postura defensiva e reduz a eficácia de ataques recebidos.",
    "synergyCandidates": [
      "Placas ósseas"
    ]
  },
  {
    "name": "Investida de Grande Porte",
    "category": "Físico",
    "group": "Ungulados",
    "effect": "Avança com força contra o alvo e pode deslocá-lo ou quebrar sua postura.",
    "synergyCandidates": [
      "Quadrúpede"
    ]
  },
  {
    "name": "Chifrada de Impacto",
    "category": "Físico",
    "group": "Ungulados",
    "effect": "Golpe frontal que pode empurrar ou derrubar o adversário.",
    "synergyCandidates": [
      "Chifres"
    ]
  },
  {
    "name": "Pisoteio",
    "category": "Suporte",
    "group": "Ungulados",
    "effect": "Pressiona um alvo próximo ou caído e dificulta sua recuperação de posição.",
    "synergyCandidates": []
  },
  {
    "name": "Brado Territorial",
    "category": "Especial",
    "group": "Ungulados",
    "effect": "Intimida adversários e protege o espaço ocupado.",
    "synergyCandidates": []
  },
  {
    "name": "Garras de Harpia",
    "category": "Físico",
    "group": "Aves de rapina",
    "effect": "Agarra e perfura o adversário, podendo prendê-lo.",
    "synergyCandidates": [
      "Garras"
    ]
  },
  {
    "name": "Mergulho Predatório",
    "category": "Físico",
    "group": "Aves de rapina",
    "effect": "Ataque aéreo em alta velocidade.",
    "synergyCandidates": [
      "Voador"
    ]
  },
  {
    "name": "Grito de Rapina",
    "category": "Especial",
    "group": "Aves de rapina",
    "effect": "Chamado intimidante que pode desorganizar a ação adversária.",
    "synergyCandidates": []
  },
  {
    "name": "Visão Aguçada",
    "category": "Suporte",
    "group": "Aves de rapina",
    "effect": "Observa o campo de batalha e identifica vulnerabilidades e movimentações.",
    "synergyCandidates": []
  },
  {
    "name": "Chute de Ema",
    "category": "Físico",
    "group": "Aves corredoras e campestres",
    "effect": "Golpe de perna que afasta o adversário.",
    "synergyCandidates": []
  },
  {
    "name": "Patada Predatória",
    "category": "Físico",
    "group": "Aves corredoras e campestres",
    "effect": "Ataque rápido com as patas que pode interromper ou desestabilizar o alvo.",
    "synergyCandidates": []
  },
  {
    "name": "Chamado de Advertência",
    "category": "Especial",
    "group": "Aves corredoras e campestres",
    "effect": "Emite sinal de alerta que prepara aliados para uma ameaça.",
    "synergyCandidates": []
  },
  {
    "name": "Arrancada Instintiva",
    "category": "Suporte",
    "group": "Aves corredoras e campestres",
    "effect": "Deslocamento explosivo para aproximar-se ou escapar.",
    "synergyCandidates": []
  },
  {
    "name": "Bico de Tuiuiú",
    "category": "Físico",
    "group": "Aves aquáticas e pernaltas",
    "effect": "Ataque pontual com o bico, direcionado a um ponto vulnerável.",
    "synergyCandidates": [
      "Bico"
    ]
  },
  {
    "name": "Pescaria Precisa",
    "category": "Suporte",
    "group": "Aves aquáticas e pernaltas",
    "effect": "Calcula o momento ideal para capturar alvo ou objeto em movimento.",
    "synergyCandidates": []
  },
  {
    "name": "Chamado do Bando",
    "category": "Especial",
    "group": "Aves aquáticas e pernaltas",
    "effect": "Coordena aliados e facilita a reação conjunta.",
    "synergyCandidates": []
  },
  {
    "name": "Plumagem Impermeável",
    "category": "Suporte",
    "group": "Aves aquáticas e pernaltas",
    "effect": "Reduz prejuízos causados por água e favorece a movimentação em áreas alagadas.",
    "synergyCandidates": []
  },
  {
    "name": "Bico Poderoso",
    "category": "Físico",
    "group": "Psitacídeos",
    "effect": "Mordida forte que pode comprometer proteções frágeis.",
    "synergyCandidates": [
      "Bico"
    ]
  },
  {
    "name": "Bicada Desestabilizadora",
    "category": "Físico",
    "group": "Psitacídeos",
    "effect": "Ataque rápido que desequilibra o alvo.",
    "synergyCandidates": []
  },
  {
    "name": "Vocalização Imitativa",
    "category": "Especial",
    "group": "Psitacídeos",
    "effect": "Imita sons para confundir ou distrair adversários.",
    "synergyCandidates": []
  },
  {
    "name": "Comunicação Inteligente",
    "category": "Suporte",
    "group": "Psitacídeos",
    "effect": "Transmite informações táticas aos aliados.",
    "synergyCandidates": []
  },
  {
    "name": "Bote de Jararaca",
    "category": "Especial",
    "group": "Serpentes",
    "effect": "Ataque rápido que aplica envenenamento.",
    "synergyCandidates": ["Peçonha", "Presas"],
    "synergyCandidateNote": "O envenenamento é efeito-base e não depende desses Traços."
  },
  {
    "name": "Constrição",
    "category": "Físico",
    "group": "Serpentes",
    "effect": "Envolve o alvo e restringe seus movimentos.",
    "synergyCandidates": [
      "Ápode"
    ]
  },
  {
    "name": "Peçonha Concentrada",
    "category": "Especial",
    "group": "Serpentes",
    "effect": "Aplica dose concentrada de peçonha, intensificando o efeito nocivo.",
    "synergyCandidates": [
      "Peçonha"
    ]
  },
  {
    "name": "Camuflagem",
    "category": "Suporte",
    "group": "Serpentes",
    "effect": "Reduz a percepção da Nativa pelo adversário e prepara ação surpresa.",
    "synergyCandidates": []
  },
  {
    "name": "Fuga Caudal",
    "category": "Suporte",
    "group": "Lagartos",
    "effect": "Utiliza a cauda como distração para facilitar fuga ou reposicionamento.",
    "synergyCandidates": [
      "Cauda"
    ]
  },
  {
    "name": "Cauda Chicote",
    "category": "Físico",
    "group": "Lagartos",
    "effect": "Golpeia o adversário com a cauda, causando impacto e afastamento.",
    "synergyCandidates": [
      "Cauda"
    ]
  },
  {
    "name": "Mordida de Lagarto",
    "category": "Físico",
    "group": "Lagartos",
    "effect": "Mordida direta que causa dano e mantém pressão sobre o alvo.",
    "synergyCandidates": []
  },
  {
    "name": "Ameaça Visual",
    "category": "Especial",
    "group": "Lagartos",
    "effect": "Exibe postura e sinais corporais para intimidar ou distrair.",
    "synergyCandidates": []
  },
  {
    "name": "Recolhimento Defensivo",
    "category": "Suporte",
    "group": "Quelônios",
    "effect": "Recolhe partes vulneráveis do corpo e reduz exposição a ataques.",
    "synergyCandidates": [
      "Carapaça"
    ]
  },
  {
    "name": "Impacto de Casco",
    "category": "Físico",
    "group": "Quelônios",
    "effect": "Colide com o adversário utilizando o casco.",
    "synergyCandidates": []
  },
  {
    "name": "Mordida de Casco",
    "category": "Físico",
    "group": "Quelônios",
    "effect": "Mordida forte que pode prender o adversário.",
    "synergyCandidates": []
  },
  {
    "name": "Vocalização de Defesa",
    "category": "Especial",
    "group": "Quelônios",
    "effect": "Emite som de advertência que dificulta a aproximação.",
    "synergyCandidates": []
  },
  {
    "name": "Giro Mortal",
    "category": "Físico",
    "group": "Crocodilianos",
    "effect": "Agarra o alvo e realiza rotação violenta, causando dano e dificultando recuperação.",
    "synergyCandidates": []
  },
  {
    "name": "Mordida de Emboscada",
    "category": "Físico",
    "group": "Crocodilianos",
    "effect": "Ataque surpresa a partir de posição oculta.",
    "synergyCandidates": [
      "Mandíbulas poderosas"
    ]
  },
  {
    "name": "Pressão de Mandíbula",
    "category": "Suporte",
    "group": "Crocodilianos",
    "effect": "Mantém mordida de alta pressão e restringe a movimentação do alvo.",
    "synergyCandidates": []
  },
  {
    "name": "Couraça Escamosa",
    "category": "Suporte",
    "group": "Crocodilianos",
    "effect": "Assume postura defensiva que reduz o impacto de ataques recebidos.",
    "synergyCandidates": [
      "Escamas"
    ]
  },
  {
    "name": "Secreção Defensiva",
    "category": "Especial",
    "group": "Anuros",
    "effect": "Libera substância nociva que desencoraja ataques de contato.",
    "synergyCandidates": [
      "Secreção irritante"
    ]
  },
  {
    "name": "Língua Capturadora",
    "category": "Físico",
    "group": "Anuros",
    "effect": "Projeta a língua para atingir e capturar um alvo.",
    "synergyCandidates": []
  },
  {
    "name": "Vocalização Intimidante",
    "category": "Especial",
    "group": "Anuros",
    "effect": "Emite vocalização que confunde ou intimida adversários próximos.",
    "synergyCandidates": []
  },
  {
    "name": "Pele Úmida",
    "category": "Suporte",
    "group": "Anuros",
    "effect": "Mantém a superfície corporal protegida e favorece adaptação a ambientes úmidos.",
    "synergyCandidates": [
      "Aquático"
    ]
  },
  {
    "name": "Descarga do Poraquê",
    "category": "Especial",
    "group": "Peixes elétricos",
    "effect": "Libera descarga elétrica que causa dano e pode interromper a ação do alvo.",
    "synergyCandidates": [
      "Descarga elétrica"
    ]
  },
  {
    "name": "Pulso de Alta Voltagem",
    "category": "Especial",
    "group": "Peixes elétricos",
    "effect": "Emite descarga em área, atingindo adversários próximos.",
    "synergyCandidates": []
  },
  {
    "name": "Investida Aquática",
    "category": "Físico",
    "group": "Peixes elétricos",
    "effect": "Avança rapidamente pela água e colide com o adversário.",
    "synergyCandidates": [
      "Nadadeiras"
    ]
  },
  {
    "name": "Sensibilidade Elétrica",
    "category": "Suporte",
    "group": "Peixes elétricos",
    "effect": "Detecta sinais elétricos e identifica presença ou movimentação de criaturas próximas.",
    "synergyCandidates": [
      "Sensibilidade elétrica",
      "química"
    ]
  },
  {
    "name": "Mordida de Piranha",
    "category": "Físico",
    "group": "Characiformes",
    "effect": "Mordida agressiva que explora ferimentos existentes.",
    "synergyCandidates": []
  },
  {
    "name": "Frenesi Alimentar",
    "category": "Físico",
    "group": "Characiformes",
    "effect": "Executa ataques sucessivos contra um alvo ferido.",
    "synergyCandidates": []
  },
  {
    "name": "Ataque em Cardume",
    "category": "Suporte",
    "group": "Characiformes",
    "effect": "Coordena aproximação coletiva e pressão sobre um adversário.",
    "synergyCandidates": []
  },
  {
    "name": "Descarga de Muco",
    "category": "Especial",
    "group": "Characiformes",
    "effect": "Libera substância escorregadia que dificulta contato e movimentação.",
    "synergyCandidates": []
  },
  {
    "name": "Espinhos das Nadadeiras",
    "category": "Físico",
    "group": "Siluriformes",
    "effect": "Utiliza espinhos para ferir adversário que se aproxima ou tenta agarrar.",
    "synergyCandidates": []
  },
  {
    "name": "Sucção Poderosa",
    "category": "Físico",
    "group": "Siluriformes",
    "effect": "Puxa ou prende o alvo por sucção.",
    "synergyCandidates": []
  },
  {
    "name": "Barbilhões Sensoriais",
    "category": "Especial",
    "group": "Siluriformes",
    "effect": "Detecta vibrações e sinais químicos no ambiente.",
    "synergyCandidates": [
      "Barbilhões"
    ]
  },
  {
    "name": "Placas Protetoras",
    "category": "Suporte",
    "group": "Siluriformes",
    "effect": "Reforça postura defensiva e reduz eficácia de ataques físicos.",
    "synergyCandidates": [
      "Placas ósseas"
    ]
  },
  {
    "name": "Percepção do Tubarão-martelo",
    "category": "Especial",
    "group": "Peixes cartilaginosos",
    "effect": "Detecta sinais elétricos e movimentações de criaturas próximas.",
    "synergyCandidates": [
      "Sensibilidade elétrica",
      "química"
    ]
  },
  {
    "name": "Investida Subaquática",
    "category": "Físico",
    "group": "Peixes cartilaginosos",
    "effect": "Avança em alta velocidade pela água e atinge o adversário.",
    "synergyCandidates": [
      "Nadadeiras"
    ]
  },
  {
    "name": "Mordida Serrilhada",
    "category": "Físico",
    "group": "Peixes cartilaginosos",
    "effect": "Mordida que causa ferimentos profundos.",
    "synergyCandidates": []
  },
  {
    "name": "Pele Denticulada",
    "category": "Suporte",
    "group": "Peixes cartilaginosos",
    "effect": "Utiliza a textura corporal para dificultar ataques de contato e agarrões.",
    "synergyCandidates": []
  },
  {
    "name": "Picada Venenosa",
    "category": "Especial",
    "group": "Aracnídeos",
    "effect": "Aplica veneno que causa dano contínuo ou enfraquecimento, conforme a definição final da técnica.",
    "synergyCandidates": [
      "Veneno"
    ]
  },
  {
    "name": "Pinça de Escorpião",
    "category": "Físico",
    "group": "Aracnídeos",
    "effect": "Prende e golpeia o adversário com as pinças.",
    "synergyCandidates": []
  },
  {
    "name": "Teia Imobilizadora",
    "category": "Suporte",
    "group": "Aracnídeos",
    "effect": "Prende o alvo com fios resistentes e restringe suas ações.",
    "synergyCandidates": []
  },
  {
    "name": "Pelos Urticantes",
    "category": "Especial",
    "group": "Aracnídeos",
    "effect": "Dispersa pelos irritantes que prejudicam aproximação e ação adversária.",
    "synergyCandidates": [
      "Pelos urticantes"
    ]
  },
  {
    "name": "Fortificação de Montículo",
    "category": "Suporte",
    "group": "Insetos sociais",
    "effect": "Prepara posição defensiva no ambiente.",
    "synergyCandidates": []
  },
  {
    "name": "Mandíbulas de Operária",
    "category": "Físico",
    "group": "Insetos sociais",
    "effect": "Utiliza mandíbulas para cortar, prender ou transportar.",
    "synergyCandidates": []
  },
  {
    "name": "Ácido Defensivo",
    "category": "Especial",
    "group": "Insetos sociais",
    "effect": "Libera substância corrosiva ou irritante para afastar adversários.",
    "synergyCandidates": []
  },
  {
    "name": "Comunicação Química",
    "category": "Suporte",
    "group": "Insetos sociais",
    "effect": "Utiliza sinais químicos para transmitir informações e coordenar aliados.",
    "synergyCandidates": []
  },
  {
    "name": "Captura do Louva-a-deus",
    "category": "Físico",
    "group": "Insetos predadores",
    "effect": "Prende o alvo com membros especializados e dificulta sua fuga.",
    "synergyCandidates": []
  },
  {
    "name": "Mandíbulas Predatórias",
    "category": "Físico",
    "group": "Insetos predadores",
    "effect": "Executa mordida ou corte de precisão, explorando abertura na defesa.",
    "synergyCandidates": []
  },
  {
    "name": "Enzimas Digestivas",
    "category": "Especial",
    "group": "Insetos predadores",
    "effect": "Aplica substâncias que degradam ou enfraquecem a proteção do alvo.",
    "synergyCandidates": []
  },
  {
    "name": "Voo Interceptador",
    "category": "Suporte",
    "group": "Insetos predadores",
    "effect": "Intercepta adversário em deslocamento e pode impedir sua fuga.",
    "synergyCandidates": []
  },
  {
    "name": "Pinça Esmagadora",
    "category": "Físico",
    "group": "Crustáceos",
    "effect": "Prende e comprime o alvo, causando dano e dificultando sua movimentação.",
    "synergyCandidates": [
      "Pinças"
    ]
  },
  {
    "name": "Recuo Lateral",
    "category": "Suporte",
    "group": "Crustáceos",
    "effect": "Executa deslocamento lateral rápido para escapar ou reposicionar-se.",
    "synergyCandidates": []
  },
  {
    "name": "Jato Defensivo",
    "category": "Especial",
    "group": "Crustáceos",
    "effect": "Libera jato de água ou substância para afastar adversário.",
    "synergyCandidates": []
  },
  {
    "name": "Carapaça Reforçada",
    "category": "Suporte",
    "group": "Crustáceos",
    "effect": "Assume postura protetora e reduz o impacto de ataques recebidos.",
    "synergyCandidates": [
      "Carapaça"
    ]
  }
];
const slug = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const porNome = new Map(CATALOGO_TRACOS.map(traco => [traco.nome.toLocaleLowerCase('pt-BR'), traco]));
function candidatasConhecidas(nomes) {
  const conhecidas = [];
  for (let i = 0; i < nomes.length; i += 1) {
    let nome = nomes[i];
    if (nome.toLocaleLowerCase('pt-BR') === 'sensibilidade elétrica' && nomes[i + 1]?.toLocaleLowerCase('pt-BR') === 'química') {
      nome = 'Sensibilidade elétrica e química';
      i += 1;
    }
    if (nome.toLocaleLowerCase('pt-BR') === 'sensibilidade elétrica') nome = 'Sensibilidade elétrica e química';
    const traco = porNome.get(nome.toLocaleLowerCase('pt-BR'));
    if (traco) conhecidas.push({ nome: traco.nome, tracoId: traco.id });
  }
  return conhecidas;
}

// Ajustes descritivos aprovados para o combate 1v1; não alteram ID, nome ou categoria.
const DESCRICOES_FISICAS_REVISADAS = Object.freeze({
  'felinos-bote-predatorio': 'Causa +1 dano se o alvo ainda não realizou sua ação no turno atual.',
  'felinos-garras-perfurantes': 'Ataque concentrado que aplica Exposição: reduz DEF do alvo em 1 por 1 turno.',
  'canideos-mordida-persistente': 'Mordida que aplica Sangramento, causando 1 dano na próxima ação ofensiva do alvo.',
  'canideos-investida-de-matilha': 'Investida vigorosa característica dos canídeos.',
  'mustelideos-agarrao-aquatico': 'Golpe corporal de um mustelídeo em ambiente aquático.',
  'mustelideos-mordida-de-fixacao': 'Mordida forte característica dos mustelídeos.',
  'procionideos-garras-escaladoras': 'Ataque com as garras características dos procionídeos.',
  'roedores-incisivos-poderosos': 'Mordida executada com os incisivos fortes dos roedores.',
  'roedores-impacto-de-roedura': 'Ataque de mordida característico dos roedores.',
  'marsupiais-mordida-defensiva': 'Mordida curta característica dos marsupiais.',
  'primatas-manipulacao-de-ferramentas': 'Ataque físico adaptado com uma ferramenta empunhada.',
  'morcegos-mergulho-predatorio': 'Ataque descendente característico dos morcegos.',
  'xenartros-garras-escavadoras': 'Ataque físico com as garras escavadoras dos xenartros.',
  'ungulados-investida-de-grande-porte': 'Investida que aplica Desorientação: o próximo golpe do alvo recebe 1 penalidade.',
  'ungulados-chifrada-de-impacto': 'Golpe frontal desferido com os chifres.',
  'aves-de-rapina-garras-de-harpia': 'Ataque perfurante com as garras de harpia.',
  'aves-de-rapina-mergulho-predatorio': 'Ataque aéreo de mergulho das aves de rapina.',
  'aves-corredoras-e-campestres-chute-de-ema': 'Chute vigoroso característico da ema.',
  'aves-corredoras-e-campestres-patada-predatoria': 'Patada rápida desferida com as patas.',
  'aves-aquaticas-e-pernaltas-bico-de-tuiuiu': 'Ataque pontual desferido com o bico.',
  'psitacideos-bico-poderoso': 'Bicada poderosa característica dos psitacídeos.',
  'psitacideos-bicada-desestabilizadora': 'Ataque rápido que aplica Desorientação: o próximo golpe do alvo recebe 1 penalidade.',
  'serpentes-constricao': 'Golpe corporal característico das serpentes por constrição.',
  'lagartos-cauda-chicote': 'Golpeia o adversário com a cauda.',
  'lagartos-mordida-de-lagarto': 'Mordida direta característica dos lagartos.',
  'quelonios-impacto-de-casco': 'Colisão poderosa com o casco.',
  'quelonios-mordida-de-casco': 'Mordida forte característica dos quelônios.',
  'crocodilianos-giro-mortal': 'Giro corporal violento característico dos crocodilianos.',
  'crocodilianos-mordida-de-emboscada': 'Mordida de emboscada característica dos crocodilianos.',
  'anuros-lingua-capturadora': 'Ataque desferido com a língua dos anuros.',
  'peixes-eletricos-investida-aquatica': 'Colisão física veloz pela água.',
  'characiformes-mordida-de-piranha': 'Causa +1 dano quando o alvo estiver sob efeito de Sangramento.',
  'characiformes-frenesi-alimentar': 'Mordida agressiva característica dos characiformes.',
  'siluriformes-espinhos-das-nadadeiras': 'Ataque físico com os espinhos das nadadeiras.',
  'siluriformes-succao-poderosa': 'Ataque de sucção potente característico dos siluriformes.',
  'peixes-cartilaginosos-investida-subaquatica': 'Ataque físico veloz executado sob a água.',
  'peixes-cartilaginosos-mordida-serrilhada': 'Mordida que aplica Ferimento Profundo, causando +1 dano imediato.',
  'aracnideos-pinca-de-escorpiao': 'Golpe desferido com as pinças do escorpião.',
  'insetos-sociais-mandibulas-de-operaria': 'Ataque de corte executado com as mandíbulas de operária.',
  'insetos-predadores-captura-do-louva-a-deus': 'Ataque cortante com os membros especializados do louva-a-deus.',
  'insetos-predadores-mandibulas-predatorias': 'Mordida ou corte executado com mandíbulas predatórias.',
  'crustaceos-pinca-esmagadora': 'Compressão poderosa executada com a pinça.'
});

// Descrições conceituais aprovadas para os golpes especiais e de suporte.
// Valores numéricos permanecem pendentes; Jato Defensivo aguarda confirmação biológica.
const DESCRICOES_ESPECIAIS_V2_1 = Object.freeze({
  'linhagem-v2-1-felinos-rugido-da-cacadora':'Aplica Desorientação ao acertar. O próximo golpe ofensivo do adversário recebe penalidade de precisão.',
  'linhagem-v2-1-canideos-faro-de-perseguicao':'Técnica de exploração para identificar e acompanhar rastros, mesmo após uma tentativa de fuga. Não concede bônus automático de combate.',
  'linhagem-v2-1-mustelideos-secrecao-defensiva':'Mantém secreção ativa por 2 turnos do usuário. Quando o adversário acerta ataque físico de contato, sofre redução temporária de ATQ. Uma ativação; não acumula.',
  'linhagem-v2-1-procionideos-exploracao-atenta':'Investiga ambientes para encontrar pistas, objetos, esconderijos e perigos.',
  'linhagem-v2-1-roedores-alerta-da-colonia':'Detecta ameaças fora de combate. Em combate, concede bônus à próxima rolagem de iniciativa.',
  'linhagem-v2-1-marsupiais-falsa-morte':'Assume postura de falsa incapacidade e reduz o dano do próximo ataque recebido. Proteção geral de maior intensidade.',
  'linhagem-v2-1-marsupiais-secrecao-repulsiva':'Mantém secreção ativa por 2 turnos do usuário. Quando o adversário acerta ataque físico de contato, recebe Desorientação. Uma ativação; não acumula.',
  'linhagem-v2-1-primatas-grito-de-alerta':'Aplica Desorientação ao adversário. O próximo golpe ofensivo dele recebe penalidade de precisão.',
  'linhagem-v2-1-morcegos-ecolocalizacao':'Detecta criaturas e obstáculos sem depender da visão, inclusive em ambientes escuros ou com visibilidade prejudicada.',
  'linhagem-v2-1-morcegos-pulso-ultrassonico':'Causa dano especial e aplica Desorientação ao adversário.',
  'linhagem-v2-1-morcegos-voo-erratico':'Reduz o próximo dano físico recebido, representando movimentos aéreos imprevisíveis.',
  'linhagem-v2-1-xenartros-lingua-capturadora':'Causa dano especial e reduz temporariamente a AGI do adversário até o final do próximo turno dele. A redução também afeta a iniciativa.',
  'linhagem-v2-1-ungulados-brado-territorial':'Aplica Desorientação ao adversário.',
  'linhagem-v2-1-aves-de-rapina-grito-de-rapina':'Reduz o próximo dano especial recebido, representando antecipação de ameaça.',
  'linhagem-v2-1-aves-corredoras-e-campestres-chamado-de-advertencia':'Fora de combate, alerta sobre ameaças próximas. Em combate, concede bônus de precisão ao próximo golpe ofensivo próprio.',
  'linhagem-v2-1-aves-aquaticas-e-pernaltas-chamado-do-bando':'Técnica de comunicação fora de combate, permitindo transmitir alertas e informações a outras aves próximas.',
  'linhagem-v2-1-psitacideos-vocalizacao-imitativa':'Fora de combate, reproduz sons para distrair, atrair ou confundir criaturas. Em combate, pode aplicar Desorientação.',
  'linhagem-v2-1-serpentes-bote-de-jararaca':'Causa dano especial e aplica Envenenamento ao acertar.',
  'linhagem-v2-1-serpentes-peconha-concentrada':'Intensifica o Envenenamento já aplicado. Não permite intensificações indefinidas.',
  'linhagem-v2-1-lagartos-ameaca-visual':'Aplica Desorientação ao adversário.',
  'linhagem-v2-1-quelonios-vocalizacao-de-defesa':'Reduz o próximo dano recebido. Proteção geral de menor intensidade.',
  'linhagem-v2-1-anuros-secrecao-defensiva':'Mantém secreção ativa por 2 turnos do usuário. Quando o adversário acerta ataque físico de contato, recebe dano especial. Uma ativação; não acumula.',
  'linhagem-v2-1-anuros-vocalizacao-intimidante':'Reduz temporariamente o ATQ do adversário até o final do próximo turno dele.',
  'linhagem-v2-1-peixes-eletricos-descarga-do-poraque':'Causa dano especial e reduz temporariamente o ATQ do adversário até o final do próximo turno dele.',
  'linhagem-v2-1-peixes-eletricos-pulso-de-alta-voltagem':'Causa dano especial elevado e penaliza a precisão do próximo golpe ofensivo do adversário.',
  'linhagem-v2-1-characiformes-descarga-de-muco':'Penaliza a precisão do próximo golpe ofensivo do adversário.',
  'linhagem-v2-1-siluriformes-barbilhoes-sensoriais':'Revela qual defesa do adversário, DEF ou RES, é menor.',
  'linhagem-v2-1-peixes-cartilaginosos-percepcao-do-tubarao-martelo':'Concede bônus de precisão ao próximo golpe ofensivo próprio.',
  'linhagem-v2-1-aracnideos-picada-venenosa':'Causa dano especial e aplica Envenenamento.',
  'linhagem-v2-1-aracnideos-pelos-urticantes':'Penaliza a precisão do próximo golpe ofensivo do adversário.',
  'linhagem-v2-1-insetos-sociais-acido-defensivo':'Causa dano especial e reduz temporariamente o ATQ do adversário até o final do próximo turno dele.',
  'linhagem-v2-1-insetos-predadores-enzimas-digestivas':'Causa dano especial e aplica Digestão, provocando uma ocorrência adicional de dano ao final do próximo turno do alvo.'
});

// Somente golpes parametrizados e aprovados até esta etapa. Não preencher demais registros por padrão.
const PARAMETROS_NUMERICOS_FISICOS_V2_1 = Object.freeze({
  'felinos-bote-predatorio': { precisao:-2, P:1, recarga:1, R:1, mp:0, M:0, custoEfeitos:1 },
  'felinos-garras-perfurantes': { precisao:-2, P:1, recarga:1, R:1, mp:1, M:1, custoEfeitos:1.5 },
  'canideos-mordida-persistente': { precisao:-2, P:1, recarga:0, R:0, mp:1, M:1, custoEfeitos:1, custoEsperadoEfeitos:0.5 },
  'canideos-investida-de-matilha': { precisao:-3, P:2, recarga:2, R:2, mp:0, M:0, custoEfeitos:0 },
  'mustelideos-agarrao-aquatico': { precisao:-2, P:1, recarga:0, R:0, mp:1, M:1, custoEfeitos:0 },
  'mustelideos-mordida-de-fixacao': { precisao:-1, P:0, recarga:2, R:2, mp:2, M:2, custoEfeitos:0 },
  'procionideos-garras-escaladoras': { precisao:-2, P:1, recarga:0, R:0, mp:1, M:1, custoEfeitos:0 },
  'roedores-incisivos-poderosos': { precisao:-1, P:0, recarga:1, R:1, mp:1, M:1, custoEfeitos:0 },
  'roedores-impacto-de-roedura': { precisao:-3, P:2, recarga:2, R:2, mp:0, M:0, custoEfeitos:0 },
  'primatas-manipulacao-de-ferramentas': { precisao:-2, P:1, recarga:1, R:1, mp:2, M:2, custoEfeitos:0 },
  'morcegos-mergulho-predatorio': { precisao:-3, P:2, recarga:1, R:1, mp:1, M:1, custoEfeitos:0 },
  'xenartros-garras-escavadoras': { precisao:-2, P:1, recarga:1, R:1, mp:0, M:0, custoEfeitos:0 },
  'ungulados-investida-de-grande-porte': { precisao:-2, P:1, recarga:1, R:1, mp:1, M:1, custoEfeitos:1.5 },
  'aves-de-rapina-garras-de-harpia': { precisao:-2, P:1, recarga:0, R:0, mp:1, M:1, custoEfeitos:0 },
  'aves-de-rapina-mergulho-predatorio': { precisao:-3, P:2, recarga:2, R:2, mp:0, M:0, custoEfeitos:0 },
  'aves-corredoras-e-campestres-chute-de-ema': { precisao:-2, P:1, recarga:2, R:2, mp:1, M:1, custoEfeitos:0 },
  'aves-corredoras-e-campestres-patada-predatoria': { precisao:-2, P:1, recarga:1, R:1, mp:0, M:0, custoEfeitos:0 },
  'aves-aquaticas-e-pernaltas-bico-de-tuiuiu': { precisao:-1, P:0, recarga:1, R:1, mp:1, M:1, custoEfeitos:0 },
  'psitacideos-bico-poderoso': { precisao:-2, P:1, recarga:0, R:0, mp:1, M:1, custoEfeitos:0 },
  'serpentes-constricao': { precisao:-3, P:2, recarga:2, R:2, mp:0, M:0, custoEfeitos:0 },
  'lagartos-mordida-de-lagarto': { precisao:-1, P:0, recarga:1, R:1, mp:1, M:1, custoEfeitos:0 },
  'lagartos-cauda-chicote': { precisao:-2, P:1, recarga:2, R:2, mp:1, M:1, custoEfeitos:0 },
  'quelonios-impacto-de-casco': { precisao:-3, P:2, recarga:3, R:3, mp:1, M:1, custoEfeitos:0 },
  'quelonios-mordida-de-casco': { precisao:-3, P:2, recarga:2, R:2, mp:0, M:0, custoEfeitos:0 },
  'crocodilianos-giro-mortal': { precisao:-3, P:2, recarga:3, R:3, mp:1, M:1, custoEfeitos:0 },
  'crocodilianos-mordida-de-emboscada': { precisao:-2, P:1, recarga:2, R:2, mp:1, M:1, custoEfeitos:0 },
  'characiformes-frenesi-alimentar': { precisao:-3, P:2, recarga:1, R:1, mp:1, M:1, custoEfeitos:0 },
  'anuros-lingua-capturadora': { precisao:-2, P:1, recarga:1, R:1, mp:2, M:2, custoEfeitos:0 },
  'peixes-eletricos-investida-aquatica': { precisao:-2, P:1, recarga:2, R:2, mp:1, M:1, custoEfeitos:0 },
  'siluriformes-espinhos-das-nadadeiras': { precisao:-2, P:1, recarga:0, R:0, mp:1, M:1, custoEfeitos:0 },
  'siluriformes-succao-poderosa': { precisao:-2, P:1, recarga:2, R:2, mp:1, M:1, custoEfeitos:0 },
  'peixes-cartilaginosos-investida-subaquatica': { precisao:-3, P:2, recarga:1, R:1, mp:1, M:1, custoEfeitos:0 },
  'aracnideos-pinca-de-escorpiao': { precisao:-2, P:1, recarga:1, R:1, mp:0, M:0, custoEfeitos:0 },
  'insetos-sociais-mandibulas-de-operaria': { precisao:-1, P:0, recarga:0, R:0, mp:2, M:2, custoEfeitos:0 },
  'insetos-predadores-captura-do-louva-a-deus': { precisao:-3, P:2, recarga:1, R:1, mp:1, M:1, custoEfeitos:0 },
  'insetos-predadores-mandibulas-predatorias': { precisao:-2, P:1, recarga:1, R:1, mp:2, M:2, custoEfeitos:0 },
  'crustaceos-pinca-esmagadora': { precisao:-3, P:2, recarga:2, R:2, mp:2, M:2, custoEfeitos:0 },
  'psitacideos-bicada-desestabilizadora': { precisao:-2, P:1, recarga:1, R:1, mp:1, M:1, custoEfeitos:1.5 },
  'characiformes-mordida-de-piranha': { precisao:-2, P:1, recarga:1, R:1, mp:1, M:1, custoEfeitos:0.5 },
  'peixes-cartilaginosos-mordida-serrilhada': { precisao:-2, P:1, recarga:2, R:2, mp:1, M:1, custoEfeitos:1 }
});

export const TECNICAS_LINHAGEM_V2_1 = registros.map(registro => {
  const id = `linhagem-v2-1-${slug(registro.group)}-${slug(registro.name)}`;
  const parametrosFisicos = PARAMETROS_NUMERICOS_FISICOS_V2_1[id.replace('linhagem-v2-1-', '')] || null;
  const parametrosEspeciais = registro.category === 'Especial' ? obterParametrosEspeciaisV2_1(id) : null;
  const custosEspeciais = parametrosEspeciais ? calcularCustoEfeitos(parametrosEspeciais.custosEfeitoIds) : null;
  const parametros = parametrosFisicos || (parametrosEspeciais ? {
    P:parametrosEspeciais.P,R:parametrosEspeciais.R,M:parametrosEspeciais.M,
    precisao:-1-parametrosEspeciais.P,recarga:parametrosEspeciais.R,mp:parametrosEspeciais.M,
    custoEfeitos:custosEspeciais.custoTotal,custosEfeitoIds:parametrosEspeciais.custosEfeitoIds
  } : null);
  const parametrosBalanceamento = parametros ? {
    P:parametros.P, R:parametros.R, M:parametros.M,
    custoEfeitos:parametros.custoEfeitos,
    ...(parametros.custoEsperadoEfeitos == null ? {} : {custoEsperadoEfeitos:parametros.custoEsperadoEfeitos}),
    pgBruto:calcularPGBruto({P:parametros.P,R:parametros.R,M:parametros.M}),
    pgLiquido:calcularPGLiquido(calcularPGBruto({P:parametros.P,R:parametros.R,M:parametros.M}),parametros.custoEfeitos)
  } : null;
  const tecnica = {
  id,
  nome: registro.name,
  origem: 'linhagem',
  grupo: registro.group,
  categoria: registro.category,
  precisao: parametros?.precisao ?? null,
  mp: parametros?.mp ?? null,
  recarga: parametros?.recarga ?? null,
  pg: parametrosBalanceamento?.pgBruto ?? null,
  dano: null,
  efeito: DESCRICOES_ESPECIAIS_V2_1[id] || DESCRICOES_FISICAS_REVISADAS[id.replace('linhagem-v2-1-', '')] || registro.effect,
  status: parametrosEspeciais ? 'TESTE CONTROLADO V2.1 · REVISÃO DE EQUILÍBRIO EM ABERTO' : 'REVISÃO V2.1 · PARÂMETROS PENDENTES',
  versao: '2.1',
  estadoCatalogo: 'em-revisao',
  sinergias: [],
  sinergiasCandidatas: candidatasConhecidas(registro.synergyCandidates).map(candidata => ({
    id: `sinergia-v2-1-${slug(registro.group)}-${slug(registro.name)}-${slug(candidata.tracoId)}`,
    ...candidata,
    estadoRevisao: 'reservada',
    nota: registro.synergyCandidateNote || null
  })),
  ...(parametrosBalanceamento ? {P:parametros.P,R:parametros.R,M:parametros.M,parametrosBalanceamento} : {})
  };
  const efeitosConceituais = obterEfeitosConceituaisV2_1(id);
  if (efeitosConceituais.length) tecnica.efeitosV2_1 = efeitosConceituais;
  if (parametrosEspeciais) tecnica.parametrosTecnicosDisponiveis = true;
  tecnica.auditoriaBalanceamento = auditarTecnicaV21(tecnica);
  return tecnica;
});
