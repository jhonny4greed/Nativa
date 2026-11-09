# Refúgio NATIVA — interface e acesso

Implementação baseada no remoto `ae184358f90b34e46982cc670322df5a3898881c`, de 9 de novembro de 2026. A pasta local estava em `b0cd784`.

## Fluxos

- `index.html`: landing preservada. Jogar leva a `cadastro.html`; Entrar leva a `login.html`.
- `cadastro.html`: nome, e-mail, senha e confirmação; alternativa Google; confirmação por e-mail quando exigida pelo Supabase.
- `login.html`: formulário independente, com e-mail/senha e alternativa Google. Uma sessão existente segue para o jogo.
- `app.html`: dashboard autenticada, sem formulários de cadastro/login. Sessão ausente volta ao login. O destino `next` aceita apenas `app.html` na mesma origem e conserva o convite e a tela desejada.
- O menu organiza Refúgio, Bestiário, Arena, Criação, Ateliê, Mesas, Guia e Conta. No celular, a barra inferior mostra os quatro destinos principais e Mais. O menu expandido expõe os outros destinos.
- Ateliê concentra a geração; Acervo e retratos concentra a coleção da conta, escolha da ficha e aplicação do retrato. Não há envio automático de fotos nem geração paga automática.
- As cinco Nativas de teste recebem retratos padrão por ID. Um retrato carregado/aplicado pelo jogador prevalece. Fichas e IDs permanecem intactos.

## Administração

Somente `profiles.role = 'admin'`, consultado pela RPC `get_application_role` revela o menu e a tela administrativa. `user_metadata.role`, `app_metadata.role`, valores locais e a role `master` de uma mesa não concedem administração do jogo.

A migration `20261109010000_admin_access_and_overview.sql` cria uma RPC somente de leitura, com verificação de identidade e de role no servidor. Ela retorna contagens de jogadores, fichas sincronizadas e mesas abertas. Não disponibiliza uma função para promover a própria conta. A role deve ser definida por um administrador autorizado pelo painel existente ou pelo backend; nunca uma chave administrativa no navegador. A permissão administrativa é relida no servidor; reabra a dashboard após uma troca de papel.

Esta implementação prepara a migration; não a aplica a um banco remoto. Para usar o observatório em produção, aplique-a no processo de implantação existente.

## Ambiente e publicação

`npm ci`, `npm run dev`, `npm test` e `npm run build`. O Docker serve somente `dist`.

Configure `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e `TURNSTILE_SITE_KEY` no ambiente de destino. No Supabase Auth, autorize as URLs de retorno `/login.html` dos domínios utilizados. Configure o provedor Google e CAPTCHA no serviço correspondente. A site key de desenvolvimento já presente no repositório pode recusar localhost; isso não deve ser contornado pela interface.

Prévia visual isolada: com Vite iniciado, `/__preview/dashboard` apresenta a dashboard e as fichas locais sem conta real. A rota existe somente no middleware de desenvolvimento; não entra no build. A identidade da prévia é indicada no cabeçalho. Não use a prévia para validar autorização ou chamadas remotas.

## Validação

Testes Node cobrem domínio existente, persistência, sincronização simulada e regras de acesso/redirecionamento. A verificação visual usa a prévia local e as páginas públicas. Login real, Google, e-mail, Turnstile e RPC administrativa exigem o ambiente configurado; a prévia não substitui esses testes.
