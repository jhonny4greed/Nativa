# NATIVA — Protótipo atualizado

## Como executar

1. Instale o Node.js 20 ou superior.
2. Na pasta do projeto, execute `npm install`.
3. Execute `npm run dev` e abra o endereço indicado (normalmente `http://localhost:5173`).

O projeto usa o Vite para resolver pacotes (fontes, ícones, detecção de dispositivo), portanto um servidor estático simples como `python -m http.server` não é suficiente. Para o backend local, veja `docs/AMBIENTE_SUPABASE_LOCAL.md`.

Outros comandos: `npm test` (testes), `npm run lint`, `npm run build` (gera `dist/`, usado pelo `Dockerfile`), `npm run preview` (serve o build) e `NVIDIA_API_KEY=... npm run assets` (gera as imagens de `scripts/asset-prompts.json`).

## Arquivos

- `index.html`: landing page.
- `cadastro.html` e `login.html`: páginas independentes de autenticação.
- `app.html`: dashboard autenticada, com navegação de jogo.
- `js/dashboard.js` e `css/dashboard.css`: refúgio, menu lateral e menu inferior mobile.
- `css/style.css`: identidade visual e responsividade.
- `js/app.js`: criação, bestiário, fotos, progressão e arena.
- `js/data.js`: grupos biológicos, linhagens, biomas, afinidades e arquétipos.
- `js/techniques.js`: catálogo de técnicas fornecido pelo usuário, mantido como fonte oficial do protótipo.
- `js/progression.js`: XP, níveis e XPA.
- `js/essences.js`: regras e validação das essências.

## Dados e compatibilidade

- Mantém a chave `localStorage` `nativa.prototype.v1` para preservar fichas existentes.
- Fotos e retratos são enviados ao bucket privado `nativa-portraits`; o acervo é guardado em `nativa-artworks`, com metadados em `player_artworks`. O navegador pode manter cache para desempenho.
- As fichas são preparadas e sincronizadas explicitamente com a conta. Imagens são enviadas ao servidor ao salvar. No primeiro acesso após a atualização, fotos antigas editáveis são enviadas; ao abrir o acervo, artes antigas da conta são migradas. A migração exige acessar o navegador que contém os arquivos antigos e preserva os originais em caso de falha.

## O que está implementado

- Criação com grupo biológico → linhagem → espécie.
- Perfil biológico com exemplos, descrição e especialidades por linhagem.
- Seleção de quatro golpes iniciais: um de linhagem, um de bioma, um de afinidade e um de arquétipo. A primeira Essência acrescenta dois golpes; a segunda, mais um (4 → 6 → 7).
- Bestiário com foto, atributos, técnicas e progressão.
- XP, níveis, XPA, melhoria de atributos e absorção das duas primeiras essências.
- Arena local 1 contra 1 com iniciativa, precisão, MP, dano, HP, recarga e registro de combate.

## Limitações conhecidas

- Há arena contra CPU, duelos PvP online por turnos e mesas multiplayer com progressão independente. Duelos amistosos online preservam fichas originais e não concedem recompensas automáticas.
- Efeitos textuais de suporte/condição são registrados no histórico, mas não são todos aplicados automaticamente.
- Cada nova batalha cria combatentes próprios; acompanhe HP, MP e recargas no painel de combate.
- A terceira essência permanece desativada, conforme as regras atuais.

## Nova experiência de jogo

Veja [Dashboard e autenticação](docs/DASHBOARD_E_AUTENTICACAO.md) para rotas, configuração do Supabase e role administrativa. A [pesquisa de bibliotecas](docs/BIBLIOTECAS_ANIMACAO.md) registra as alternativas avaliadas.

Os cinco retratos originais estão em `assets/generated/nativa-*.png`; a aplicação usa versões WebP leves, reproduzíveis com `npm run assets:optimize`. Os prompts estão em `docs/nativa-portrait-prompts.json`.

## Tutoriais guiados

- Introdução geral e guias no primeiro acesso a cada área; sem tutorial no login, cadastro ou Administração.
- Destaques em elementos reais, pop-ups responsivos, navegação por teclado e botões Pular, Voltar e Avançar/Concluir.
- Guias específicos para primeira rodada, PvP, Essências, salvamento de arte e papéis da campanha.
- Repetição disponível no **Guia de jogo**, sem reiniciar fichas ou contas.
- O histórico fica em `player_tutorials`, por usuário, tutorial e versão (`TUTORIAL_VERSION` em `js/tutorial-content.js`). Contas antigas sem histórico recebem o tutorial normalmente. Incrementar a versão reapresenta os guias após uma mudança relevante.
- Se o servidor estiver indisponível, o navegador mantém um histórico e uma fila de reenvio separados por conta. A reconexão e o próximo login tentam sincronizar novamente.

## Atualização do banco e armazenamento

Aplique as migrations antes de publicar o frontend (`supabase db push` no projeto correto). A migration `20261112000000_guided_tours_and_gallery.sql` cria o histórico dos tutoriais, o acervo persistente e políticas RLS por proprietário. Os buckets são privados: imagens não são expostas publicamente. Retratos continuam usando as permissões de campanha já definidas em `20261111000000_native_progress_and_portraits.sql`.

Imagens recém-geradas aparecem como prévia até clicar em **Salvar no acervo**. O sucesso só é informado depois de enviar arquivo e metadados. Trocar de navegador não transfere fichas ainda pendentes de sincronização; use **Sincronizar agora** no Bestiário.

## Efeitos da arena

Cada ação tem uma apresentação sequencial: destaque da Nativa, nome do golpe, D10 de precisão quando aplicável e resultado (dano, erro ou efeito de suporte). A próxima Nativa só começa após esse fluxo. O padrão é cerca de 5,5 segundos por ação; as Configurações oferecem velocidade rápida (~3 s), normal e lenta (~8 s), além de desativar os efeitos e a espera. Preferências são salvas por conta em `player_preferences`, com cache e reenvio local. O resolvedor e o servidor continuam sendo a fonte dos resultados; as animações apenas os apresentam. HP e MP visuais acompanham a sequência, sem alterar as fichas.

A confirmação de ação fica sobreposta ao cenário, entre as Nativas, acima dos golpes, sem faixa de fundo. A migration `20261112010000_arena_preferences.sql` cria as preferências com RLS por conta.
