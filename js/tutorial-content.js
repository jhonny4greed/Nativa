export const TUTORIAL_VERSION = 1;
const step = (target, title, text, extra = {}) => ({ target, title, text, ...extra });
export const TUTORIALS = {
  general: [
    step(
      ".refuge-brand, [data-current-view]",
      "Seu vínculo com o mundo NATIVA",
      "Crie uma criatura inspirada na biodiversidade brasileira. Escolha suas características, participe de batalhas, evolua e personalize seu Vínculo Nativa."
    ),
    step(
      '[data-view="create"]',
      "Sua jornada começa com uma Nativa",
      "Em Criar Nativa, você monta seu companheiro. No Bestiário, acompanha sua ficha e evolução. Na Arena, coloca suas escolhas em prática."
    ),
    step(
      '[data-view="rules"], .more-button',
      "A ajuda acompanha você",
      "Cada área apresenta um guia na primeira visita. Você pode pular quando quiser e repetir qualquer tutorial no Guia de jogo. Nenhuma ficha ou progressão será reiniciada."
    )
  ],
  home: [
    step(
      "#home .welcome-line",
      "Bem-vindo ao seu Refúgio",
      "Este é o resumo da sua jornada. Acompanhe seus companheiros e escolha o próximo passo."
    ),
    step(
      "#companion-selector",
      "Conheça seus companheiros",
      "Clique ou toque em um retrato para mudar a Nativa em destaque. As setas permitem navegar pela coleção.",
      { optional: true }
    ),
    step(
      ".creature-dossier",
      "Um resumo da sua Nativa",
      "Aqui aparecem identidade, nível e atributos. Abra a ficha completa no Bestiário para consultar golpes, traços, hábitos e progressão."
    ),
    step(
      '[data-view="create"]',
      "Crie seu próprio vínculo",
      "Use Criar Nativa para montar um novo companheiro. As criaturas de demonstração ajudam a conhecer o jogo; suas fichas ficam no Bestiário."
    )
  ],
  create: [
    step(
      "#create .section-heading",
      "Dê vida à sua Nativa",
      "Crie sua própria Nativa e desenvolva um vínculo único. Quatro características — linhagem, bioma, afinidade e arquétipo — dão identidade ao companheiro e acesso a listas próprias de golpes. Crie, batalhe, evolua e personalize sua jornada."
    ),
    step(
      "#groupBio",
      "Comece pela identidade",
      "Escolha o grupo biológico para liberar as linhagens. Consulte as explicações junto aos campos para definir espécie, bioma, afinidade e arquétipo. Essas escolhas abrem seus quatro grupos de golpes."
    ),
    step(
      "#attrs",
      "Distribua seus XPA",
      "Todos os atributos começam em 1. Subir de 1 para 2 custa 2 XPA; de 2 para 3 custa mais 3. Use os botões + e − para distribuir entre 37 e 42 XPA. Até 5 podem ficar guardados."
    ),
    step(
      "#budget",
      "Pontos gastos não são níveis de atributo",
      "O custo aumenta a cada melhoria. ATQ e DEF participam do combate físico; POT e RES, do especial; AGI participa da iniciativa. A vida máxima é HP × 5 e a magia máxima é MP × 2."
    ),
    step(
      "#technique-picker",
      "Quatro golpes para começar",
      "Escolha exatamente quatro golpes: um da linhagem, um do bioma, um da afinidade e um do arquétipo. Abra os grupos e compare as opções antes de adicionar."
    ),
    step(
      "#technique-groups",
      "Leia a ficha de cada golpe",
      "MP é o custo de magia. Dano é a força básica do golpe, combinada com atributos e defesas. Recarga é o intervalo em turnos até reutilizá-lo. Leia o efeito: técnicas de suporte podem agir de outra forma."
    ),
    step(
      "#selected-techniques",
      "Precisão e escolhas",
      "Precisão −2 significa falha ao tirar 1 ou 2 no D10. Golpes em revisão não podem ser usados em combate. A lista abaixo reúne suas escolhas; remova um golpe para escolher outro da mesma origem."
    ),
    step(
      "#native-sound-query",
      "Uma voz para seu companheiro",
      "Este passo é opcional. Descreva uma vocalização, peça recomendações e ouça os efeitos antes de escolher. São gravações e efeitos sonoros."
    ),
    step(
      "#generate-art-on-create",
      "Uma ilustração para sua Nativa",
      "Se quiser, marque a geração de arte após salvar. A operação pode consumir créditos e está sujeita ao limite diário da conta."
    ),
    step(
      '#create button[type="submit"]',
      "Pronto para começar",
      "Salve após escolher os quatro golpes e distribuir os pontos. Sua Nativa recebe 1 XPA de vínculo, além do saldo guardado. Depois, consulte a ficha e a sincronização no Bestiário."
    )
  ],
  list: [
    step(
      "#list .section-heading",
      "Seu Bestiário",
      "Aqui estão suas Nativas e suas fichas. Você pode consultar características, aumentar atributos, absorver Essências e escolher retratos."
    ),
    step(
      "#cards .profile-tabs",
      "Explore as abas da ficha",
      "Visão geral mostra os atributos e a progressão. Traços e hábitos explica características biológicas. Golpes reúne as técnicas: abra cada uma para ler o efeito, custo e possíveis sinergias.",
      { optional: true }
    ),
    step(
      "#cards .profile-attribute",
      "Melhore seus atributos",
      "Use + para gastar XPA. O custo é o novo valor do atributo: de 3 para 4 custa 4 XPA. O próximo custo aparece no cartão; o botão fica indisponível quando falta saldo ou a ficha não é editável.",
      { optional: true }
    ),
    step(
      "#cards .progress-panel",
      "XP e XPA têm funções diferentes",
      "XP recebido em combate aumenta o nível. Ao subir, você ganha XPA para melhorar atributos. As Essências guardadas são recompensas ainda disponíveis; as absorvidas já concederam seus benefícios.",
      { optional: true }
    ),
    step(
      "#sync-panel",
      "Salve também na sua conta",
      "A ficha é preparada para a conta e entra em uma fila. Quando houver um botão de preparar ou confirmar vínculo, use-o primeiro. Preparar ainda não envia os dados."
    ),
    step(
      "#sync-run",
      "Envie as fichas preparadas",
      "Clique em Sincronizar agora para enviar a fila. Confira pendências, falhas e conflitos. Uma ficha sincronizada pode ser escolhida nos duelos online e nas mesas."
    ),
    step(
      "#sync-conflicts",
      "Se houver versões diferentes",
      "Um conflito significa que a versão local e a do servidor divergem. Compare as versões antes de escolher qual usar. Imagens e retratos são enviados ao servidor; a sincronização das fichas continua sendo uma ação separada."
    )
  ],
  battle: [
    step(
      ".arena-mode-tabs",
      "Escolha seu desafio",
      "Treine contra a CPU ou abra PvP online para enfrentar outro jogador. As mesas têm encontros próprios, com progresso separado."
    ),
    step(
      ".battle-setup",
      "Prepare a batalha contra CPU",
      "Escolha sua Nativa, o adversário, o horário e o bioma. Você pode sortear o adversário. Clique em Iniciar combate quando estiver pronto.",
      { optional: true }
    ),
    step(
      "#battle-arena",
      "Uma escolha por turno",
      "Na batalha, escolha um golpe ou uma ação e confirme a rodada. A iniciativa é sorteada a cada turno: D10 + AGI. Um guia específico aparece quando você abre sua primeira batalha."
    )
  ],
  "battle-turn": [
    step(
      ".battle-hud",
      "Acompanhe HP e MP",
      "HP é sua vida na batalha. MP é a magia disponível para técnicas. Confira também as condições e os valores do adversário."
    ),
    step(
      ".battle-moves",
      "Escolha um golpe",
      "Clique ou toque em uma técnica para selecioná-la e consultar seus detalhes. Custo de MP e recarga podem impedir seu uso. Escolher ainda não confirma o turno."
    ),
    step(
      ".special-actions",
      "Você tem outras opções",
      "Defender passa o turno sem atacar. Recuperar MP também passa o turno e devolve 1 MP. Use essas ações quando quiser aguardar ou recuperar magia."
    ),
    step(
      "#execute-turn",
      "Confirme sua escolha",
      "Depois de escolher a ação, use este botão. Online, aguarde o outro jogador: cada participante confirma uma ação por rodada."
    ),
    step(
      "#battle-arena",
      "O dado mostra a precisão",
      "O D10 exibido na tela testa se o golpe acerta. Uma penalidade −2 faz o ataque falhar em 1 ou 2; acima disso, acerta. Esse dado não representa o valor do dano. Golpes sem teste não precisam dele."
    ),
    step(
      ".battle-history",
      "Entenda o resultado",
      "Abra o histórico para consultar dados, acertos, erros, dano e efeitos. Fraquezas e resistências modificam o dano; a recarga controla quando cada golpe volta a ficar disponível."
    )
  ],
  "battle-online": [
    step(
      "#online-arena-nativa",
      "Leve uma ficha sincronizada",
      "Escolha uma Nativa da sua conta. Se a lista estiver vazia, vá ao Bestiário, prepare a ficha quando necessário e clique em Sincronizar agora."
    ),
    step(
      "#online-connect",
      "Encontre outros jogadores",
      "Fique disponível online para consultar jogadores e receber desafios."
    ),
    step(
      ".online-lobby-grid",
      "Convide ou encontre um adversário",
      "Crie uma sala privada e compartilhe o convite, entre com um código ou busque alguém disponível. Um convite de duelo é diferente de um convite de mesa."
    ),
    step(
      "#online-match-controls",
      "Duelos por turnos",
      "Confirme uma ação por rodada e aguarde a resolução. Os duelos amistosos preservam as fichas originais e não concedem recompensas automáticas.",
      { optional: true }
    )
  ],
  "art-studio": [
    step(
      "#art-kind",
      "Dê forma às suas ideias",
      "Gere imagens de Nativas, biomas, técnicas ou outras ideias. Você pode selecionar uma Nativa para preencher a descrição com suas características."
    ),
    step(
      "#art-prompt",
      "Descreva o que quer ver",
      "Inclua aparência, cores, ambiente, pose e estilo. Exemplo: “Lobo-guará de Fogo, pelagem avermelhada, entre as veredas do Cerrado ao entardecer”."
    ),
    step(
      "#art-generate",
      "Geração com créditos",
      "Gerar uma imagem pode consumir créditos e está sujeito ao limite diário. Aguarde o resultado antes de fazer outro pedido."
    ),
    step(
      "#art-preview",
      "Guarde o resultado na sua conta",
      "Após gerar, clique em Salvar no acervo. A imagem será enviada ao servidor e poderá ser consultada em outros dispositivos com a mesma conta.",
      { optional: true }
    ),
    step(
      "#art-studio-target",
      "Escolha o destino",
      "Selecione uma Nativa para vincular a arte ao salvar ou deixe a imagem apenas no acervo. Gerar uma prévia e salvar no acervo são etapas diferentes."
    )
  ],
  "art-save": [
    step(
      "#art-save",
      "Sua imagem está pronta",
      "Clique em Salvar no acervo para guardar esta imagem no servidor. Só depois de salvar ela fará parte da sua coleção e será vinculada à Nativa escolhida."
    )
  ],
  gallery: [
    step(
      "#gallery .section-heading",
      "Seu acervo na conta",
      "As imagens salvas ficam no servidor, separadas por conta, e podem ser abertas em outros dispositivos. Imagens antigas deste navegador são migradas ao abrir o acervo."
    ),
    step("#art-target-nativa", "Uma arte pode virar retrato", "Primeiro escolha uma ficha editável neste seletor."),
    step(
      "#art-gallery",
      "Aplique sua arte",
      "Nas imagens da categoria Nativa, use Aplicar como retrato. A arte continua no acervo; a ficha passa a usar uma cópia como retrato."
    )
  ],
  multiplayer: [
    step(
      "#online-rooms-panel",
      "Uma jornada compartilhada",
      "Mesas são campanhas com seus amigos. Elas têm participantes, companheiros e encontros próprios."
    ),
    step("#online-create-room-form", "Crie sua campanha", "Dê um nome à sala para começar uma mesa como mestre."),
    step(
      "#online-join-room-form",
      "Entre com um convite",
      "Cole o código ou link enviado pelo mestre. Convites de mesa não são convites de duelo da Arena."
    ),
    step(
      "#online-room-list",
      "Volte às suas mesas",
      "Abra uma sala para escolher seu companheiro, ver participantes e acompanhar os encontros."
    )
  ],
  "room-detail": [
    step(
      "#online-room-companions-title",
      "Um companheiro nesta campanha",
      "Escolha uma Nativa sincronizada. A sala cria seu próprio progresso: mudanças aqui não alteram a ficha original do Bestiário nem outras mesas."
    ),
    step(
      ".room-privacy-note",
      "Quem vê sua ficha",
      "Você e o mestre veem sua ficha completa. Outros jogadores consultam uma prévia. O mestre pode ajustar os dados da campanha."
    ),
    step(
      "#online-room-game",
      "Participe dos encontros",
      "Caçadas solo e desafios PvP usam apenas o companheiro desta sala. Há três caçadas gratuitas por dia; pedidos extras dependem do mestre."
    )
  ],
  "room-master": [
    step(
      "#online-room-invites",
      "Convide seus jogadores",
      "Escolha código ou link, validade e quantidade de usos. Gere o convite e compartilhe-o com quem vai participar."
    ),
    step(
      "#online-room-admin",
      "Cuide da campanha",
      "Como mestre, gerencie participantes e a sala. Essa permissão é independente de ser administrador do NATIVA."
    ),
    step(
      "#online-close-room",
      "Encerrar preserva a história",
      "Encerrar impede novas jogadas e preserva o histórico. Apagar definitivamente remove participantes, convites e histórico da campanha. As fichas originais são preservadas."
    )
  ],
  essences: [
    step(
      "#essence-inventory-title",
      "Novas possibilidades para seu vínculo",
      "Vitórias podem conceder uma Essência, com chance padrão de 5%. Ela guarda características da Nativa de origem e fica no inventário até você poder absorvê-la."
    ),
    step(
      "#essence-inventory-list",
      "Primeira Essência: mais dois golpes",
      "A partir do nível 5, a primeira absorção ensina o golpe de linhagem e o de afinidade da origem. Sua Nativa passa de quatro para seis golpes, sem mudar suas defesas."
    ),
    step(
      "#essence-inventory-list",
      "Segunda Essência: nova afinidade",
      "No nível 12 e estágio 2, depois da primeira, a segunda absorção acrescenta uma afinidade diferente e um golpe dela: sete golpes ao todo. A nova afinidade combina fraquezas e resistências com a original. A terceira Essência ainda não está disponível."
    ),
    step(
      "#essence-inventory-list",
      "Confira antes de absorver",
      "Cada esfera mostra os efeitos e os nomes dos golpes que você aprenderá. O requisito de bloqueio fica visível ao lado do botão. Absorver consome a esfera escolhida."
    )
  ],
  rules: [
    step(
      "#rules",
      "Seu guia de consulta",
      "Consulte as regras de criação, combate, evolução e Essências. Abaixo, escolha qualquer tutorial para repetir sem alterar suas fichas ou seu progresso."
    )
  ],
  settings: [
    step(
      ".arena-preferences",
      "Seu ritmo de combate",
      "Ative ou desative os efeitos e escolha a velocidade de cada ação. O padrão dura cerca de 5 segundos por Nativa; as opções rápida e lenta mudam apenas a apresentação. Sua escolha fica salva na conta."
    ),
    step(
      "#progress-reset-native",
      "Escolha com atenção",
      "Esta área reinicia a progressão de uma ficha específica. Selecione a Nativa antes de continuar."
    ),
    step(
      "#progress-reset-confirm",
      "Reiniciar é uma mudança na ficha",
      "O reset volta ao nível 1, zera XP e XPA, remove Essências e restaura atributos e golpes iniciais registrados. Os companheiros das mesas não mudam. Para rever tutoriais, use o Guia de jogo."
    )
  ],
  account: [
    step(
      "#account .account-card",
      "Sua conta, sua jornada",
      "Confira a conta conectada. Imagens e retratos são guardados no servidor; confira a sincronização das fichas no Bestiário antes de jogar online ou trocar de dispositivo."
    )
  ]
};
export const TUTORIAL_LABELS = {
  general: "Introdução ao NATIVA",
  home: "Refúgio",
  create: "Criar Nativa",
  list: "Bestiário e atributos",
  battle: "Arena contra CPU",
  "battle-turn": "Sua primeira rodada",
  "battle-online": "PvP online",
  "art-studio": "Ateliê de imagens",
  "art-save": "Salvar imagem",
  gallery: "Acervo e retratos",
  multiplayer: "Mesas multiplayer",
  "room-detail": "Dentro da campanha",
  "room-master": "Guia do mestre",
  essences: "Essências",
  rules: "Guia de jogo",
  settings: "Configurações",
  account: "Minha conta"
};
