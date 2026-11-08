# Ambiente Supabase local do NATIVA

## Serviços de aplicação

O NATIVA utiliza localmente PostgreSQL, Auth, PostgREST, Storage e Edge Runtime. O protótipo não referencia diretamente Logflare, Vector ou o Logs Explorer do Studio.

Na instalação Windows atual, Analytics/Vector está desativado em `supabase/config.toml`. O Vector precisa consultar a API Docker para coletar logs; a configuração gerada pelo Supabase CLI usa `host.docker.internal:2375`, indisponível neste ambiente. A porta 2375 permanece desativada porque a API Docker TCP sem autenticação concede acesso privilegiado ao Engine.

Com Analytics/Vector desativado:

- PostgreSQL, Auth, PostgREST, Realtime, Storage e Edge Runtime continuam disponíveis.
- O Logs Explorer do Studio e a coleta centralizada no Logflare ficam indisponíveis.
- Os logs continuam acessíveis no Docker Desktop ou por `docker logs <nome-do-container>`.
- Nenhum dado do PostgreSQL ou volume de Storage é removido por esta configuração.

## Iniciar e conferir

Abra PowerShell na pasta do projeto e confirme que o Docker Desktop está aberto. Se o comando `docker` não estiver no `PATH` desta sessão, acrescente o caminho da instalação per-user:

```powershell
$env:PATH = "C:\Users\Ramos\AppData\Local\Programs\DockerDesktop\resources\bin;$env:PATH"
```

Confira a stack local:

```powershell
.\node_modules\.bin\supabase.cmd status
```

Se a stack estiver parada, `supabase start` lê `supabase/config.toml` e inicia os serviços habilitados; com Analytics desativado, não deve iniciar Logflare nem Vector. Antes de executar `supabase start`, confira migrations pendentes: a CLI pode aplicar migrations locais durante a inicialização. Não use `db reset`, `db push` ou `link` para iniciar o ambiente.

Para abrir a aplicação, em outro PowerShell execute:

```powershell
python -m http.server 8000
```

Abra `http://localhost:8000` no navegador.

## Consultar logs

Use a aba de logs do Docker Desktop ou consulte um container específico:

```powershell
docker logs --tail 100 supabase_db_NATIVA_Prototipo_Atualizado
docker logs --tail 100 supabase_edge_runtime_NATIVA_Prototipo_Atualizado
```

## Reativar Analytics no futuro

Analytics/Vector é opcional para o desenvolvimento e não deve ser reativado apenas para corrigir o status do Vector. Para reativar, altere `analytics.enabled` para `true` em `supabase/config.toml` e valide primeiro uma forma segura de acesso do Vector à API Docker.

No Windows, a integração documentada pelo Supabase depende da API TCP 2375. Essa API é sem autenticação no modo usado pelo CLI e pode permitir controle privilegiado do Docker Engine. Mantenha-a desativada salvo decisão de segurança explícita. Uma execução do CLI em ambiente Linux com socket Unix pode ser investigada separadamente, mas precisa ser validada com Docker Desktop/WSL antes de ser adotada.

Após uma alteração de configuração, siga a ajuda da versão local da CLI. Evite `supabase stop` se não for necessário, pois ele para todos os containers locais, inclusive o PostgreSQL.
