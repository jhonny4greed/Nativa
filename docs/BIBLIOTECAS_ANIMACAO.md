# Bibliotecas para a experiência de jogo NATIVA

Pesquisa nas fontes oficiais em 9 de novembro de 2026. O jogo atual usa interface HTML, combate por turnos e imagens estáticas. A escolha considera esse funcionamento e o carregamento em celular.

| Biblioteca | Uso principal | Decisão para esta etapa | Fonte |
|---|---|---|---|
| Anime.js | Animações de propriedades, sequências, stagger, SVG e interação | Utilizada nas entradas da dashboard, transições e luzes ambientais; já instalada na landing | https://animejs.com/documentation/ |
| GSAP / ScrollTrigger | Timelines complexas e animações ligadas à rolagem | Alternativa para cenas cinematográficas; não acumular dois motores para as mesmas transições | https://gsap.com/docs/v3/Plugins/ScrollTrigger/ |
| Motion | Animação de interface e gestos em JS | Alternativa de interface; não necessária junto ao Anime.js nesta entrega | https://motion.dev/docs/quick-start |
| PixiJS | Renderização 2D acelerada, sprites, partículas e filtros | Candidata para uma evolução da arena com sprites; exigiria implementar um palco de renderização | https://pixijs.com/8.x/guides/getting-started/intro |
| Phaser | Framework de jogos 2D, cenas, entrada e ciclo de jogo | Candidato se a arena passar a exigir motor de jogo completo; não necessário para a navegação HTML atual | https://www.phaser.io/oss/docs/phaser/getting-started/what-is-phaser |
| tsParticles | Fundos de partículas e efeitos configuráveis | Alternativa para partículas densas; nesta etapa 14 luzes DOM animadas atendem ao efeito ambiental | https://github.com/tsparticles/tsparticles |
| Lottie Web | Reprodução de animações exportadas do After Effects | Reservada para quando existirem arquivos de animação próprios; não anima sozinha os retratos PNG | https://github.com/airbnb/lottie-web |
| Rive | Animações interativas e state machines em assets Rive | Exige assets próprios e runtime; opção futura para mascotes e controles animados | https://rive.app/docs/runtimes/web/web-js |
| React Spring | Movimento de interface por molas em React | Inadequada à estrutura atual, que não usa React | https://github.com/pmndrs/react-spring |
| Three.js | Cenas e renderização 3D | Reservada para uma direção 3D explícita, com modelos e orçamento de performance próprios | https://github.com/mrdoob/three.js |
| Babylon.js | Motor e ferramentas para experiências 3D | Mesma consideração: não há cenas/modelos 3D no projeto atual | https://doc.babylonjs.com/ |
| Howler.js | Áudio de jogos | Opção para trilha/efeitos quando houver assets e controles de volume; não adicionada sem áudio a reproduzir | https://github.com/goldfire/howler.js |
| Canvas Confetti | Celebrações pontuais | Dependência existente preservada na landing; respeita redução de movimento | https://github.com/catdad/canvas-confetti |
| Lucide | Ícones vetoriais consistentes | Dependência existente usada nos menus e ações | https://github.com/lucide-icons/lucide |

## Implementação escolhida

Anime.js, Lucide e as fontes Inter/Fraunces existentes formam a base compartilhada da landing e do refúgio. A dashboard usa entradas escalonadas, pequenas transições e luzes ambientes. Há suporte a `prefers-reduced-motion`; o efeito contínuo pausa com a aba oculta ou fora da área visível. Não foram adicionadas dependências sem uma função concreta.

As bibliotecas resolvem a apresentação; precisão, dano, turnos e persistência continuam nos módulos de domínio existentes.
