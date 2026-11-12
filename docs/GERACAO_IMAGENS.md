# Ateliê de imagens do NATIVA

A aplicação chama a função `generate-art`; a chave NVIDIA fica apenas no servidor. O modelo padrão é `black-forest-labs/flux.1-dev`, configurável por `NVIDIA_IMAGE_MODEL`. A função valida a sessão real, reserva uma das 20 tentativas diárias por conta e envia o pedido à NVIDIA.

## Configuração

Configure no Supabase `NVIDIA_API_KEY` e `IMAGE_TASK_SIGNING_KEY` (pelo menos 32 bytes). A função usa `SUPABASE_URL` e a credencial de serviço do ambiente para quota e Storage. Não coloque credenciais no frontend nem no Git. A geração está disponível para contas autenticadas, sujeita à quota durável; não há allowlist de usuários.

O modelo FLUX.1-dev usa 1024 × 1024, 30 passos e cfg_scale 3,5. FLUX.1-schnell, quando escolhido explicitamente no servidor, usa 4 passos e cfg_scale 0. A configuração opcional `NVIDIA_IMAGE_FALLBACK_MODEL` permite uma única alternativa quando o principal retorna HTTP 5xx. Não é usada para contornar autenticação, permissão ou rate limit. Só habilite após validar uma geração real do modelo alternativo; a interface informa quando ele foi utilizado.

## Processamento e armazenamento

Respostas NVIDIA 202 são consultadas pelo ID da tarefa em `/v1/status/{requestId}`. Uma geração não é iniciada novamente apenas porque está na fila. Há um limite total de 120 segundos por pedido, incluindo a alternativa.

O resultado validado (PNG, JPEG ou WebP, até 15 MB) fica no bucket privado `nativa-image-task-results` por até 15 minutos, vinculado à conta por token assinado. O download é único. Ao salvar, a imagem vai para `nativa-artworks` e seus metadados para `player_artworks`. Retratos vinculados usam `nativa-portraits`. IndexedDB é cache e fonte para migração de arquivos antigos, não o único armazenamento.

## Diagnóstico de erros

O HTTP 502 da função pode representar uma falha anterior no provedor. A resposta identifica `code`, `providerStatus` e `requestId` quando disponíveis; a interface mostra a mensagem recebida. Os logs `nativa.image_generation_failed` registram apenas esses dados e o modelo, sem chave, prompt ou imagem.

- `image_provider_unavailable`: a NVIDIA respondeu HTTP 5xx antes de entregar a imagem.
- `image_provider_timeout`: o provedor não concluiu dentro do prazo.
- `image_storage_unavailable`: falha no bucket temporário depois da geração.
- HTTP 401/403 da NVIDIA: conferir credencial e permissão do modelo.
- HTTP 429: conferir quota da conta e limites do provedor.

Uma falha do provedor não comprova falha no Storage: são etapas distintas. Não ative uma alternativa sem testar sua disponibilidade. Mensagens de sucesso só são exibidas após receber e validar uma imagem real.

## Implantação

Aplique as migrations de quota e buckets antes de publicar `generate-art`. Publique o frontend para atualizar as mensagens e a identificação do modelo alternativo. O SDK recebe erros estruturados da função; as chaves continuam exclusivamente no servidor.

Referências oficiais: [FLUX.1-dev](https://docs.api.nvidia.com/nim/reference/black-forest-labs-flux_1-dev-infer), [FLUX.1-schnell](https://docs.api.nvidia.com/nim/reference/black-forest-labs-flux_1-schnell-infer) e [consulta de tarefas](https://docs.api.nvidia.com/nim/reference/nvidia-vila-statuspolling).
