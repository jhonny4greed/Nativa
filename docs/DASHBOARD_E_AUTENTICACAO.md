# Refúgio NATIVA — interface e acesso

Implementação baseada no remoto `ae184358f90b34e46982cc670322df5a3898881c`, de 9 de novembro de 2026. A pasta local estava em `b0cd784`.

## Fluxos

- `index.html`: landing preservada. Jogar leva a `cadastro.html`; Entrar leva a `login.html`.
- `cadastro.html`: nome, e-mail, senha e confirmação; alternativa Google; confirmação por e-mail quando exigida pelo Supabase.
- `login.html`: formulário independente, com e-mail/senha e alternativa Google. Uma sessão existente segue para o jogo.
- `app.html`: dashboard autenticada, sem formulários de cadastro/login. Sessão ausente, revogada, expirada ou não validada pelo Auth volta ao login antes de carregar os módulos do jogo. A criação revalida a sessão antes de salvar. O destino `next` aceita apenas `app.html` na mesma origem e conserva o convite e a tela desejada.
- O menu organiza Refúgio, Bestiário, Arena, Criação, Ateliê, Mesas, Guia e Conta. No celular, a barra inferior mostra os quatro destinos principais e Mais. O menu expandido expõe os outros destinos.
- Ateliê concentra a geração; Acervo e retratos concentra a coleção da conta, escolha da ficha e aplicação do retrato. Não há envio automático de fotos nem geração paga automática.
- As cinco Nativas de teste recebem retratos padrão por ID. Um retrato carregado/aplicado pelo jogador prevalece. Fichas e IDs permanecem intactos.

## Administração

Somente `profiles.role = 'admin'`, consultado pela RPC `get_application_role` revela o menu e a tela administrativa. `user_metadata.role`, `app_metadata.role`, valores locais e a role `master` de uma mesa não concedem administração do jogo.

A migration `20261109010000_admin_access_and_overview.sql` cria uma RPC somente de leitura, com verificação de identidade e de role no servidor. Ela retorna contagens de jogadores, fichas sincronizadas e mesas abertas. Não disponibiliza uma função para promover a própria conta. A role deve ser definida por um administrador autorizado pelo painel existente ou pelo backend; nunca uma chave administrativa no navegador. A permissão administrativa é relida no servidor; reabra a dashboard após uma troca de papel.

Esta implementação prepara a migration; não a aplica a um banco remoto. Para usar o observatório em produção, aplique-a no processo de implantação existente.

## Ambiente e publicação

`npm ci`, `npm run dev`, `npm test` e `npm run build`. O Docker serve somente `dist`.

Configure `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e `TURNSTILE_SITE_KEY` no ambiente de destino. No Supabase Auth, autorize as URLs de retorno `/login.html` dos domínios utilizados. Configure o provedor Google e CAPTCHA no serviço correspondente. Em desenvolvimento com Vite, o CAPTCHA é desativado automaticamente somente em localhost, 127.0.0.1 e ::1; o SDK do Turnstile não é carregado e login/cadastro não exigem token CAPTCHA. Builds de produção mantêm a chave configurada, inclusive quando servidos localmente. O Auth local deve manter CAPTCHA desativado no servidor.

A antiga prévia sem sessão foi removida. `/__preview/dashboard` redireciona para `app.html`, que exige login real. Não há fixture de usuário ou cliente simulado servida pelo Vite. O conteúdo permanece oculto até a validação do usuário pelo Supabase.

## Validação

Testes Node cobrem domínio existente, persistência, sincronização simulada e regras de acesso/redirecionamento. A verificação visual usa um build local com uma conta descartável no Auth local e as páginas públicas. Login real, Google, e-mail, Turnstile e RPC administrativa exigem o ambiente configurado; os testes locais não substituem a validação desses serviços em produção.

## Direção visual do refúgio

As referências de hubs de jogos orientam o painel de seleção: criatura em destaque, dossiê de atributos, seletor circular, progresso real de XP e atalhos. A paleta de floresta e ouro e as ilustrações existentes preservam a identidade NATIVA. As transições respeitam redução de movimento; os controles têm foco visível, estado selecionado e resposta ao toque. Nenhum dado de progresso ou conquista é inventado para preencher o layout.

## Arena em perspectiva

O cenário usa a imagem do bioma selecionado, com a Nativa do jogador em primeiro plano e a adversária em um plano mais distante. Retratos personalizados prevalecem sobre os retratos padrão. Os HUDs acompanham os cantos inferior esquerdo e superior direito, com HP/MP reais.

Cada painel de ações tem uma seção nativa `details` chamada Golpes, inicialmente fechada. Somente sua expansão revela os cartões; a preferência de cada jogador é preservada durante os rerenders da batalha e reiniciada em uma nova partida. Defender e recuperar MP continuam como ações diretas. O golpe selecionado aparece pelo nome no painel.

A revisão visual foi conferida com sessão real no Auth local, combate com dano/MP/recarga e tela de 390 px. A alteração é de interface e não modifica fórmulas de combate nem o banco de dados.


## Tutorial e imagens (novembro de 2026)
O histórico dos guias é versionado e separado por conta; contas antigas não precisam de reset. A repetição fica no Guia de jogo. Imagens e retratos são enviados ao armazenamento privado do servidor; IndexedDB é usado para cache e migração de arquivos legados.
