# Consolidação NATIVA V2.2.1

## Fonte e reconciliação

O catálogo ativo vem do primeiro arquivo integral de golpes enviado na tarefa. O segundo anexo não continha a lista de golpes e não foi usado como fonte. O inventário completo e gerado está em [catalogo-golpes-v2-2-1.md](catalogo-golpes-v2-2-1.md); `js/techniques-v2-2-1.js` é a única fonte de dados do catálogo ativo.

| Grupo | Golpes |
| --- | ---: |
| Linhagem | 108 |
| Bioma | 20 |
| Arquétipo | 20 |
| Afinidade | 30 |
| **Total** | **178** |

| Categoria | Golpes |
| --- | ---: |
| Físico | 66 |
| Especial | 58 |
| Suporte | 54 |

A V2.1 ativa auditada continha 166 IDs. A comparação individual encontrou 154 IDs mantidos, 12 IDs antigos de Arquétipo ausentes da nova lista e 24 identidades novas (4 de Bioma e 20 de Arquétipo). Os 12 golpes antigos foram arquivados e permanecem resolvíveis para fichas existentes. Os 105 IDs do catálogo V1 também continuam no arquivo de compatibilidade. Os 24 IDs sem equivalente antigo são derivados de origem, grupo e nome para ficarem estáveis; o arquivo da lista integral não trazia IDs explícitos para esses registros.

A divergência histórica de Linhagem fica registrada: 105 registros no arquivo V1 e 108 na lista V2.2. A V2.2 é a fonte ativa. Os 105 registros antigos continuam arquivados, sem preencher nem substituir a contagem atual.

## Traços e sinergias

Os 41 Traços e seus IDs foram preservados em `js/traits.js`. Nenhum Traço foi criado para completar lacunas. A auditoria das 18 associações históricas de sinergia encontrou oito correspondências exatas de golpe, grupo e ID de Traço. Elas permanecem como bônus opcionais no catálogo ativo:

- Bote Predatório — Felinos; Garras; +1 dano.
- Garras Perfurantes — Felinos; Garras; +1 precisão.
- Mordida Persistente — Canídeos; Presas; +1 dano.
- Garras Escavadoras — Xenartros; Garras; +1 dano.
- Mergulho Predatório — Aves de rapina; Voador; +1 precisão.
- Bico Poderoso — Psitacídeos; Bico; +1 dano.
- Mordida de Emboscada — Crocodilianos; Mandíbulas poderosas; +1 dano.
- Pinça Esmagadora — Crustáceos; Pinças; +1 dano.

As dez associações históricas abaixo não existem com identidade e grupo exatos na V2.2 e não foram transferidas para golpes de nomes parecidos: Perseguição Incansável — Canídeos; Patada Habilidosa — Procionídeos; Investida Noturna — Morcegos; Investida Poderosa — Ungulados; Garras Perfurantes — Aves de rapina; Bico Arpoador — Aves aquáticas/pernaltas; Bote Serpentino — Serpentes; Peçonha — Serpentes; Descarga Elétrica — Peixes elétricos; Pinça de Ruptura — Crustáceos. Não há sinergias ativas de suporte. Sinergia não é requisito para aprender ou usar um golpe.

## Estados, aprendizagem e combate

Os quatro estados da fonte foram mantidos: 108 `Revisado V2.2`, 16 `Recuperado`, 24 `Novo — proposta V2.2` e 30 `Recuperado e revisado V2.2`. Como a fonte não fornece estado explícito de aprovação de combate, todos os 178 registros ficam internos como `em-revisao`. A ficha pode aprender esses golpes, mas nenhum entra em combate só por ter parâmetros numéricos. A liberação exige estado `aprovado`. Golpes arquivados só podem ser usados por fichas que já os tinham.

O resolvedor único está em `js/combat-domain.js` e é compartilhado pela arena local, arena online e encontros das mesas. O espelho de módulos de servidor é gerado por `npm run combat:sync`. A resolução mantém estado de efeitos dentro do combatente, sem alterar a ficha salva. Eventos de combate são dados de saída; renderização e histórico não reaplicam efeitos. As RPCs existentes serializam submissões por turno e commit por revisão.

O inventário contém 39 associações explícitas de efeitos com golpes reais. A implementação cobre Desorientação (−1 na precisão do próximo golpe ofensivo), redução de ATQ/AGI (−1 até o fim do próximo turno), redução do próximo dano por categoria, bônus de precisão +1, Envenenamento (1 por duas ocorrências, intensificação única da Peçonha Concentrada), Digestão (1 ocorrência de 1 dano) e as três secreções mapeadas. Efeitos preparados só são consumidos quando o gatilho correspondente acontece; falha de precisão não aplica efeito de acerto; dano físico/especial mínimo é zero.

Descrições que não têm regra aprovada de combate permanecem descritivas enquanto o golpe estiver em revisão. Isso inclui Sangramento, Queimadura, Exposição, cura de HP, bônus de atributo não listados, aliados, agarrões/imobilizações, deslocamento e dano sucessivo. `Âncora Vital` aplica a redução de dano configurada; a cura descrita nela não foi implementada porque a consolidação não definiu regra de cura. O balanceamento de combate ainda precisa de testes reais; os testes técnicos não são certificação de equilíbrio.

## Fichas, progressão e persistência

Novas fichas recebem 42 XPA, nível 1 e XP 0. A inicialização de uma ficha antiga preserva qualquer XPA já gravado; quando o campo está ausente, nível 1 recebe 42 e níveis posteriores recebem 0 por segurança, sem inferir saldo gasto. As regras existentes de XP por nível, XPA por nível, custo de atributo e limite 17 permanecem no módulo de progressão. O valor explícito de XPA já salvo nunca é reescrito nesta atualização.

As fichas persistidas guardam IDs de golpes e Traços dentro de JSONB; estados de combate também são JSONB em mesas e duelos. As migrations existentes já cobrem essas estruturas. Não foi necessária migration SQL: nenhum dado relacional de catálogo precisa ser alterado, os 154 IDs existentes foram mantidos e IDs removidos continuam resolvíveis no arquivo. Nenhuma ficha foi regravada ou apagada.

## Arquivos e validação

Dados ativos: `js/techniques-v2-2-1.js`; seletor e arquivo compatível: `js/techniques.js` e `js/techniques-archive.js`; efeitos: `js/technique-effects-v2-2-1.js`; resolvedor e aprendizagem: `js/combat-domain.js` e `js/technique-learning.js`; progressão: `js/nativa-domain.js` e `js/progression.js`.

Inventário: `npm run catalog:inventory`. Espelho de servidor: `npm run combat:sync`. Os testes V2.2.1 cobrem contagens, estados, IDs, fórmulas, Traços, sinergias, bloqueio de revisão, dano, afinidade, efeitos, progressão e compatibilidade de IDs antigos.

Na validação desta atualização, `npm run lint` e `npm run build` passam, e todos os testes do catálogo, combate, progressão, mesas e arena passam. A suíte completa registra 185/195 aprovações; as dez falhas restantes ficam em `tests/art-studio.test.js`, fora do escopo desta atualização: respostas observadas 503/413 divergem dos status esperados pelos testes. Não houve migration SQL para aplicar, pois o catálogo continua sendo persistido como IDs em JSONB.
