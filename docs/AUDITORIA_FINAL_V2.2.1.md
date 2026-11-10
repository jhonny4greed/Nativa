# Auditoria final — NATIVA V2.2.1

## Revisão do GitHub

A atualização encontrada em `revisao-final-v2-2-1` foi incorporada a `main` após comparação com o catálogo anterior. Nos 178 registros ativos, a mudança de catálogo é o estado de liberação: todos agora têm `estadoCatalogo: aprovado`. Nomes, IDs, origem, grupo, categoria, afinidade, descrições e parâmetros foram preservados. Os 12 golpes antigos fora da lista V2.2.1 e os registros V1 continuam no arquivo de compatibilidade; nenhum golpe arquivado foi reativado.

## Integridade do catálogo

- 178 golpes: 108 de Linhagem, 20 de Bioma, 20 de Arquétipo e 30 de Afinidade.
- Categorias: 66 Físico, 58 Especial e 54 Suporte.
- IDs ativos únicos e preservados em relação à lista V2.2.1 anterior.
- MP e recarga numéricos em todos os registros; dano e precisão numéricos em todos os golpes ofensivos. Golpes de Suporte não têm dano.
- A fórmula de PG bruto `2 + 1,5P + 0,5R + 0,5M` foi recalculada para todos os registros e confere com `pg` e `pgBruto`.
- Todos os 178 registros ativos estão aprovados. O marcador `parametrosTecnicosDisponiveis` foi preservado: 108 `true`, 70 `false`. Ele sinaliza completude da auditoria técnica e não volta a bloquear a seleção em combate.

## Liberação e limites funcionais

A liberação operacional foi solicitada explicitamente pelo usuário e removeu todos os estados `em-revisao` do catálogo ativo. Os golpes aprovados podem ser selecionados na arena. O arquivo de compatibilidade mantém golpes antigos disponíveis apenas às fichas que já os possuem.

O motor executa o dano base, custo e recarga dos golpes liberados, além dos 39 efeitos explicitamente associados no registro V2.2.1 e das oito sinergias confirmadas. A liberação não certifica equilíbrio e não cria regras novas para efeitos que ainda não existem no motor. Sangramento, Queimadura, Exposição, cura de HP, alterações de atributos fora da tabela aprovada, aliados, agarrões/imobilizações, deslocamento, fuga e dano sucessivo continuam sem implementação própria. Algumas descrições da fonte citam valores maiores do que o efeito de combate definido; o efeito executável permanece o da regra implementada e a divergência deve ser resolvida numa revisão futura, sem alterar IDs nem aplicar efeitos silenciosamente.

O marcador `parametrosTecnicosDisponiveis: false` permanece em 70 registros para auditoria posterior, embora os campos básicos necessários ao resolvedor atual estejam preenchidos. O balanceamento precisa de partidas reais antes de ser considerado concluído.

## Integração e persistência

Arena local, duelos online e encontros de sala usam o mesmo resolvedor. O espelho dos módulos de jogo do Supabase foi atualizado com `npm run combat:sync`. Os golpes são persistidos por ID em JSONB; o esquema já cobre essa estrutura. Não foi necessária migration SQL e nenhum dado remoto foi regravado. O código fonte das Edge Functions foi sincronizado no repositório; esta atualização não fez deploy remoto das funções.

## Próximas validações de design

1. Implementar regras aprovadas para efeitos ainda narrativos e alinhar descrições cujo valor difere da mecânica executável.
2. Auditar tecnicamente os 70 registros marcados com parâmetros incompletos.
3. Fazer partidas de balanceamento com as quatro origens e ajustar somente após decisão de design.

## Validação desta revisão

`npm test`: 195/195 aprovados; `npm run lint`: aprovado; `npm run build`: aprovado. O catálogo ativo foi conferido em 178 registros e `npm run combat:sync` atualizou os nove módulos compartilhados pelo código de servidor. Não houve migration SQL porque o esquema não mudou. O espelho do código foi versionado, mas não foi feito deploy remoto das Edge Functions.
