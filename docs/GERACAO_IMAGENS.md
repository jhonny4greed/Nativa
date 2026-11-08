# Ateliê de imagens do NATIVA

O ateliê cria imagens para Nativas, biomas, técnicas/golpes e ideias futuras por
meio da API de geração de imagens da NVIDIA (ai.api.nvidia.com, FLUX.1-dev). A
aplicação chama somente a Edge Function `generate-art` do Supabase; a chave do
provedor permanece no servidor. O botão de gerar pode consumir créditos da
conta NVIDIA.

## Configuração local

1. Revogue e substitua qualquer chave de provedor que tenha sido compartilhada
   em mensagens ou código.
2. Copie `supabase/functions/.env.example` para
   `supabase/functions/.env`.
3. Preencha `NVIDIA_API_KEY` com a chave da NVIDIA, gere pelo menos 32 bytes
   criptograficamente aleatórios para `IMAGE_TASK_SIGNING_KEY` e informe em
   `IMAGE_GENERATION_ALLOWED_USER_IDS` somente os UUIDs das contas autorizadas
   a consumir créditos.
4. Não versione `supabase/functions/.env`; ele está coberto pelo `.gitignore`.
5. Inicie ou sirva a função local conforme a configuração Supabase do projeto.
   A função depende da API/Auth local e não aplica migrations.

O servidor valida a sessão consultando o endpoint `/auth/v1/user`, confere a
allowlist e assina tokens temporários de tarefa vinculados ao usuário. O
gateway não faz a validação JWT legada para essa função; a validação é feita
no handler para compatibilidade com tokens assimétricos. A função não usa
`service_role` nem consulta ou grava tabelas.

## Dados e limites

- A geração usa o endpoint síncrono `POST /v1/genai/{modelo}` da NVIDIA com
  tamanho fixo 1024×1024; o modelo padrão é
  `black-forest-labs/flux.1-dev` e pode ser trocado com
  `NVIDIA_IMAGE_MODEL`.
- O resultado fica em memória no isolate da função por até 15 minutos e o
  token temporário da tarefa expira em 30 minutos; ambos ficam vinculados à
  conta. O download é único e aceita somente PNG, JPEG e WebP até 15 MB.
- O cliente salva o Blob no IndexedDB de fotos existente e metadados do acervo
  em `localStorage`, filtrados pela conta atual.
- Nada é gravado no Supabase Storage, e nenhuma foto é enviada à nuvem.
- Aplicar uma arte como retrato cria uma cópia local do Blob para que remover ou
  trocar a foto da ficha não apague o item original do acervo.
- A allowlist é deliberadamente restrita para evitar que qualquer conta pública
  gaste créditos do proprietário. Para liberar outros usuários, será necessário
  definir limites de consumo duráveis antes da implantação pública.

## Implantação

Antes de uma implantação, cadastre `NVIDIA_API_KEY`,
`IMAGE_TASK_SIGNING_KEY` e `IMAGE_GENERATION_ALLOWED_USER_IDS` no ambiente
server-side do projeto de destino e revise os limites de uso.
