# Validação manual da fila real 2D3

Esta página de diagnóstico usa os módulos de produção `repository.js`, `auth.js` e `sync-service.js`. Ela não inicia servidor, não cria login automaticamente e não sincroniza sem clique.

## Pré-requisitos

- Supabase local já iniciado e saudável.
- Servidor HTTP do projeto já iniciado pelo usuário.
- Chrome com uso de navegador permitido.
- Duas contas locais descartáveis, A e B. Se ainda não existirem, crie-as pela tela de login do NATIVA usando endereços de teste exclusivos e conclua os links somente no Mailpit local; não use uma conta pessoal.
- Use a mesma origem da aplicação principal (`localhost` ou `127.0.0.1`); não alterne entre as duas durante o teste, pois cada host tem armazenamento próprio.

Abra `http://localhost:8000/tests/sync-diagnostic.html` se o app estiver em `http://localhost:8000`. Se estiver usando `127.0.0.1`, mantenha o mesmo host e a porta configurada para o servidor.

## A. Criar, fechar e recuperar com IndexedDB real

1. Entre na Conta A pela tela principal do NATIVA e conclua o login no Mailpit local, se necessário.
2. Abra a página de diagnóstico na mesma origem. Confirme que mostra `user_id` da Conta A e que os botões são habilitados.
3. Clique **Criar ficha local e preparar primeiro save**. Isso grava uma Nativa descartável no localStorage, uma imagem PNG mínima no IndexedDB de fotos e o primeiro save no IndexedDB da fila. A página não envia nada nessa ação.
4. Registre o `localId`, `firstOperationId` e `firstSnapshotSha256Current` do painel de evidências. Confirme `firstSnapshotUnchanged: true`, `firstOperationStatus: pending` e `photoStoredLocally.found: true`.
5. Atualize a página. Os mesmos IDs, hash e Blob devem aparecer.
6. Copie a URL com fragmento `#nativa-2d3d-diagnostic-...`, feche completamente o Chrome e reabra a URL. A fixture deve ser recuperada do mesmo perfil e origem, com o mesmo operation UUID, hash e foto.

Este fluxo usa o IndexedDB e localStorage reais do navegador; nenhum adaptador em memória participa.

## B. Edição, ordenação e envio explícito

1. Clique **Editar ficha e criar novo save** uma vez. Confirme nova operação de sequência posterior, com `dependsOn` apontando para a anterior. O hash do primeiro snapshot deve continuar igual.
2. Clique **Sincronizar agora**. Esse clique é o único gatilho de envio. A ferramenta usa o `sync-service.js` real e o `repository.js` real, com um filtro transparente que limita a listagem à fixture marcada; saves ou deletes pendentes de outras fichas da conta não são enviados por essa ferramenta. Confirme `remoteRevision: 2`, `syncState: synced`, saves concluídos em ordem e leitura remota sob RLS com `photoId` e `diagnosticUnknownField` preservados.
3. Confirme que o Blob continua em `nativa.prototype.photos` e que a leitura remota contém só a referência `photoId`, nunca o Blob.

## C. Troca A → B → A

1. Com a Conta A, faça uma edição e **não** sincronize. Registre o operation UUID pendente.
2. Abra a tela principal, encerre a Conta A, entre na Conta B e retorne à página de diagnóstico.
3. Clique **Atualizar diagnóstico**. A ficha legada pode continuar visível no armazenamento local compartilhado do navegador, mas deve mostrar `associationState: other-account`, `canEdit: false`, sem metadados da Conta A e sem operações da Conta A na fila visível de B.
4. Não clique em sincronização como Conta B. Mesmo se acionado, o serviço só lista operações da sessão B; para este teste basta confirmar o bloqueio local e a ausência da operação A.
5. Saia de B, entre novamente em A e atualize o diagnóstico. O mesmo UUID pendente e snapshot devem reaparecer. Clique **Sincronizar agora** somente de volta na Conta A.

Logout verifica o caminho de sessão ausente. Não representa uma expiração forçada do JWT; a expiração real automática da sessão não é simulada por esta ferramenta.

## D. Tombstone e limpeza da fixture

1. Quando houver uma Nativa de teste sincronizada, clique **Registrar tombstone local**. A ficha deve desaparecer do bestiário local, com snapshot guardado e operação delete posterior à fila existente.
2. Clique **Sincronizar exclusão (ação explícita)**. Confirme que a operação delete concluiu, `remoteRevision` avançou e a leitura RLS já não mostra a ficha tombstonada.
3. Clique **Remover foto descartável após tombstone confirmado** para apagar somente o Blob PNG desta fixture. O tombstone permanece no IndexedDB por desenho.

## Como coletar evidências

No Chrome, abra DevTools com F12 → **Application** → **IndexedDB**:

- `nativa.prototype.sync` → store `state` → registro `root`: `associations`, `records`, `operations`, `accountTombstones` e `conflicts`.
- `nativa.prototype.photos` → store `photos`: registro com o `photoId` da fixture e o Blob local.
- **Local Storage** → chave `nativa.prototype.v1`: ficha descartável (removida do array local após tombstone).
- **Local Storage** → `nativa.prototype.syncDiagnostic.fixture.v1`: marcador técnico da ferramenta, sem credenciais.

Não edite nem exclua registros pelo DevTools. Registre screenshots do painel de evidências antes do reload, depois do reload, sob B e após retorno A, além das telas Network/Console se houver erro.

## Limpeza e segurança

- Use somente contas descartáveis e esta fixture, identificada pelo prefixo `nativa-2d3d-diagnostic-`.
- O botão de limpeza remove apenas a foto com o `photoId` salvo no marcador, e só após confirmação do tombstone remoto.
- Não remova tombstones manualmente. Não limpe o IndexedDB/localStorage geral.
- O destino Supabase é verificado como `localhost`/`127.0.0.1` pela página. A sincronização exige ação explícita.
