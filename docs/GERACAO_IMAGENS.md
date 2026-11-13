# Geração de imagens com Puter

O Ateliê, a ilustração após criar uma Nativa e o assistente administrativo usam `puter.ai.txt2img()` pelo módulo compartilhado `js/art-studio.js`. A página inclui o SDK oficial `https://js.puter.com/v2/` de forma assíncrona; se ele estiver indisponível, o restante do jogo continua funcionando.

## Validação antes da troca

Em 13/11/2026, a integração foi testada em uma página isolada, antes de modificar a API antiga:

- SDK carregado do endereço fornecido pelo usuário.
- Amostra gratuita: PNG 1024 × 1024, 50.353 bytes; download validado.
- Geração real, iniciada pelo usuário na página de teste: PNG 1024 × 1024, 1.988.210 bytes, aproximadamente 8,7 segundos; download validado.
- A chamada real usou `puter.ai.txt2img(prompt)` sem `testMode`.

Somente depois desse resultado o frontend foi migrado.

## Conta e consumo

O usuário precisa estar conectado ao NATIVA e ao Puter. O botão **Conectar conta Puter** abre a autenticação por um gesto explícito, evitando bloqueios de pop-up. O Puter administra o saldo, os limites e os modelos disponíveis na conta do próprio usuário. O NATIVA não precisa de uma chave Puter no servidor e não promete geração gratuita.

Nenhuma imagem é gerada ao abrir uma página ou carregar o SDK. A geração ocorre somente após uma ação de gerar ou ao salvar uma Nativa com a opção de ilustração marcada. Essa opção exige que o usuário já tenha conectado o Puter no Ateliê. Caso a ilustração falhe, a Nativa continua salva e o motivo aparece no Bestiário.

Não há reenvio automático de pedidos que possam consumir saldo. Cliques paralelos são bloqueados. Falhas de autenticação, saldo, moderação e download recebem mensagens próprias.

## Prévia, acervo e retratos

O `HTMLImageElement` retornado pelo SDK é convertido para um Blob PNG, JPEG ou WebP válido, limitado a 15 MB. Essa conversão foi validada com a imagem real. A conta NATIVA é verificada novamente antes e depois da geração e do download para impedir associação à conta errada.

O resultado aparece como prévia. **Salvar no acervo** envia arquivo e metadados ao Supabase (`nativa-artworks` e `player_artworks`). Retratos continuam no bucket privado `nativa-portraits`. O armazenamento Puter não substitui o acervo do NATIVA.

## Integração anterior

A função NVIDIA `generate-art` permanece no repositório para histórico e recuperação, com seus testes de regressão, mas o frontend não a chama mais. A geração atual não usa a quota antiga de 20 tentativas, a chave NVIDIA ou os tokens de tarefa dessa função. Não foi necessário alterar as tabelas do acervo nem apagar imagens existentes.

Referências: [txt2img](https://docs.puter.com/AI/txt2img/), [autenticação por botão](https://docs.puter.com/Auth/signIn/) e [consumo por conta](https://docs.puter.com/user-pays-model/).
