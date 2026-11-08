# Preparação de arquitetura para multiplayer

## Estado desta etapa

O repositório local (`js/repository.js`) expõe operações assíncronas para fichas,
fotos e metadados. Ele preserva as chaves `nativa.prototype.v1` e
`nativa.prototype.presets.v1`, o formato serializado das fichas e o banco
IndexedDB `nativa.prototype.photos`. O armazenamento principal continua em
localStorage; nenhuma ficha é migrada, apagada ou enviada pela rede por esta
camada.

## Limites e dependências

- `js/app.js` continua responsável por eventos e renderização, além de orquestrar
  criação, progressão, essências e combate.
- `js/progression.js` e `js/essences.js` já concentram regras de progressão e
  essências; `js/data.js` e `js/techniques.js` são catálogos de domínio.
- `js/combat-domain.js` resolve ações, iniciativa, dano, afinidade, recursos,
  recargas e fim da rodada sem acesso à interface. `app.js` mantém escolhas,
  mensagens, animações, histórico visual e temporizador.
- `repository.js` agora oferece um contrato assíncrono local comum. A persistência
  e o registro da fila são ordenados; falhas no armazenamento local são
  propagadas, e falhas na fila são reportadas sem descartar a ficha local.

## Dados candidatos à sincronização

- Identidade do jogador, salas, membros, convites e relações entre fichas e
  salas já possuem infraestrutura Supabase nas migrations existentes.
- Dados da ficha: identidade, bioma, afinidade, arquétipo, atributos, técnicas,
  progressão, essências e histórico de progressão.
- Foto da ficha: hoje somente o identificador está no registro; o Blob vive no
  IndexedDB local e não acompanha a ficha para outro dispositivo.
- Estado da sessão de combate: participantes, Nativas escolhidas, turno, HP/MP,
  recargas, escolhas, iniciativa, log e encerramento.
- Permissões e metadados da sala: criador/mestre, jogadores e convite/código.

O servidor valida a propriedade de cada ficha e a autorização para alterar
estado da mesa. Segredos administrativos do Supabase nunca devem ser incluídos
no cliente. O estado compartilhado da mesa e o combate online ainda pertencem
a etapas futuras.

## Companheiros e privacidade por sala

`public.nativas` continua sendo a ficha original, sob propriedade exclusiva do
jogador. A migration incremental `20261107000000_room_companions_and_admin.sql`
adiciona `public.room_companions` como instância independente de campanha. A
associação é explícita e a tabela impõe um único companheiro ativo por jogador
e sala. Trocas aposentam a instância anterior; escolher novamente a mesma ficha
reativa o registro de campanha existente, mantendo progressão e histórico.
`source_nativa_id` e `source_local_id` identificam a origem; se a ficha remota
for excluída, o vínculo remoto fica nulo, mas o snapshot de campanha permanece.

O JSON completo da campanha é uma cópia inicial independente do snapshot remoto
original. Alterações usam revisão otimista por `save_room_companion`; não
escrevem em `public.nativas` e preservam campos desconhecidos. A escolha aceita
somente fichas remotas ativas pertencentes à sessão autenticada. Fichas locais
não preparadas e fotos não são enviadas; o campo `photoId`, se existente, é
apenas referência ao Blob mantido no IndexedDB do dispositivo.

A privacidade é aplicada no banco. RLS permite leitura direta do JSON de campanha
somente ao proprietário do companheiro e ao mestre. Jogadores recebem a lista
por `get_room_companions`: sua própria ficha completa, prévias com campos de
apresentação aprovados para os outros e estados “aguardando escolha”. O mestre
recebe os registros completos e pode editar apenas a instância de campanha. O
valor legado `room_nativas.visibility` é preservado para compatibilidade de
dados, mas não autoriza mais jogadores a ler fichas completas; a tabela antiga
fica somente leitura para clientes. `nativas`, `room_nativas` e
`room_companions` permanecem fora da publicação Postgres Changes.

## Administração de salas

Somente o criador/mestre pode renomear, expulsar jogadores e encerrar uma sala,
por RPCs que derivam a identidade e o papel no servidor. Expulsar remove a
participação e aposenta o companheiro; os registros de campanha permanecem
disponíveis no histórico do mestre. Encerrar é uma exclusão lógica: revoga
convites, aposenta companheiros e registra evento/estado, sem apagar as fichas
originais ou o histórico da sala. Salas antigas mantêm suas relações legadas;
um único vínculo antigo inequívoco é migrado como companheiro inicial, enquanto
múltiplos vínculos não são escolhidos arbitrariamente.

## Riscos e sequência sugerida

1. Extrair operações de domínio de criação/edição mantendo os objetos atuais. (concluído)
2. Definir contrato assíncrono de repositório e adaptar chamadas sem remover o
   adaptador local nem mudar as chaves atuais. (concluído)
3. Extrair a resolução do combate somente com testes de equivalência que cubram
   rolagens, ordem, dano, MP, recarga, empate e fim de batalha. (concluído)
4. Implementar sincronização explícita de fichas, incluindo conflitos e ação de
   consentimento; login não inicia envios e fotos permanecem locais nesta etapa.
   A implementação e os testes automatizados com RPCs simuladas foram concluídos;
   validação visual no navegador e sincronização contra Supabase ainda dependem
   de teste manual autorizado.
5. Empacotar a aplicação existente com Capacitor em etapa própria.

Esta divisão evita misturar sincronização remota com mudanças de regras ou de
interface e permite que cada etapa seja revisada isoladamente.
