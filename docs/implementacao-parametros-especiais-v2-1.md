# Parametrização e efeitos dos golpes especiais V2.1

Implementação para **testes controlados**. O catálogo segue em revisão de equilíbrio e não está marcado como versão final. IDs, nomes, linhagens, categorias, golpes físicos, afinidades e progressão foram preservados.

## Tabela de balanceamento

P, R e M são os parâmetros adicionais da fórmula oficial. Precisão final = -1 − P; recarga = R; MP = M. Custo é a soma dos efeitos adicionais. PG bruto é armazenado em `pg`; PG líquido fica somente em `parametrosBalanceamento.pgLiquido`; `dano` permanece `null` e nunca recebe PG. IDs abaixo são os IDs estáveis do catálogo.

| ID | Técnica — linhagem | P | Precisão | R / recarga | M / MP | PG bruto | Custo dos efeitos | PG líquido | Efeito computado |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| `linhagem-v2-1-felinos-rugido-da-cacadora` | Rugido da Caçadora — Felinos | 1 | -2 | 0 / 0 | 0 / 0 | 3,5 | 1,5 | 2 | Desorientação -1 |
| `linhagem-v2-1-mustelideos-secrecao-defensiva` | Secreção Defensiva — Mustelídeos | 0 | -1 | 1 / 1 | 1 / 1 | 3 | 1 | 2 | Secreção reativa: -1 ATQ |
| `linhagem-v2-1-roedores-alerta-da-colonia` | Alerta da Colônia — Roedores | 0 | -1 | 1 / 1 | 1 / 1 | 3 | 1 | 2 | +1 na próxima iniciativa |
| `linhagem-v2-1-marsupiais-falsa-morte` | Falsa Morte — Marsupiais | 0 | -1 | 2 / 2 | 2 / 2 | 4 | 2 | 2 | -2 no próximo dano geral |
| `linhagem-v2-1-marsupiais-secrecao-repulsiva` | Secreção Repulsiva — Marsupiais | 1 | -2 | 0 / 0 | 0 / 0 | 3,5 | 1,5 | 2 | Secreção reativa: Desorientação -1 |
| `linhagem-v2-1-primatas-grito-de-alerta` | Grito de Alerta — Primatas | 1 | -2 | 0 / 0 | 0 / 0 | 3,5 | 1,5 | 2 | Desorientação -1 |
| `linhagem-v2-1-morcegos-voo-erratico` | Voo Errático — Morcegos | 0 | -1 | 2 / 2 | 2 / 2 | 4 | 2 | 2 | -2 no próximo dano físico |
| `linhagem-v2-1-ungulados-brado-territorial` | Brado Territorial — Ungulados | 1 | -2 | 0 / 0 | 0 / 0 | 3,5 | 1,5 | 2 | Desorientação -1 |
| `linhagem-v2-1-aves-de-rapina-grito-de-rapina` | Grito de Rapina — Aves de rapina | 0 | -1 | 2 / 2 | 2 / 2 | 4 | 2 | 2 | -2 no próximo dano especial |
| `linhagem-v2-1-aves-corredoras-e-campestres-chamado-de-advertencia` | Chamado de Advertência — Aves corredoras e campestres | 1 | -2 | 0 / 0 | 0 / 0 | 3,5 | 1,5 | 2 | +1 precisão no próximo golpe |
| `linhagem-v2-1-psitacideos-vocalizacao-imitativa` | Vocalização Imitativa — Psitacídeos | 1 | -2 | 0 / 0 | 0 / 0 | 3,5 | 1,5 | 2 | Pode causar Desorientação -1 em combate |
| `linhagem-v2-1-serpentes-peconha-concentrada` | Peçonha Concentrada — Serpentes | 0 | -1 | 2 / 2 | 2 / 2 | 4 | 2 | 2 | +1 dano por ocorrência restante de veneno |
| `linhagem-v2-1-lagartos-ameaca-visual` | Ameaça Visual — Lagartos | 1 | -2 | 0 / 0 | 0 / 0 | 3,5 | 1,5 | 2 | Desorientação -1 |
| `linhagem-v2-1-quelonios-vocalizacao-de-defesa` | Vocalização de Defesa — Quelônios | 0 | -1 | 1 / 1 | 1 / 1 | 3 | 1 | 2 | -1 no próximo dano geral |
| `linhagem-v2-1-anuros-vocalizacao-intimidante` | Vocalização Intimidante — Anuros | 0 | -1 | 1 / 1 | 1 / 1 | 3 | 1 | 2 | -1 ATQ |
| `linhagem-v2-1-characiformes-descarga-de-muco` | Descarga de Muco — Characiformes | 1 | -2 | 0 / 0 | 0 / 0 | 3,5 | 1,5 | 2 | -1 precisão no próximo golpe do alvo |
| `linhagem-v2-1-siluriformes-barbilhoes-sensoriais` | Barbilhões Sensoriais — Siluriformes | 0 | -1 | 1 / 1 | 1 / 1 | 3 | 1 | 2 | Revela DEF ou RES menor; empate revela ambas |
| `linhagem-v2-1-peixes-cartilaginosos-percepcao-do-tubarao-martelo` | Percepção do Tubarão-martelo — Peixes cartilaginosos | 1 | -2 | 0 / 0 | 0 / 0 | 3,5 | 1,5 | 2 | +1 precisão no próximo golpe |
| `linhagem-v2-1-aracnideos-pelos-urticantes` | Pelos Urticantes — Aracnídeos | 1 | -2 | 0 / 0 | 0 / 0 | 3,5 | 1,5 | 2 | -1 precisão no próximo golpe do alvo |
| `linhagem-v2-1-morcegos-pulso-ultrassonico` | Pulso Ultrassônico — Morcegos | 1 | -2 | 1 / 1 | 1 / 1 | 4,5 | 1,5 | 3 | Dano especial + Desorientação -1 |
| `linhagem-v2-1-xenartros-lingua-capturadora` | Língua Capturadora — Xenartros | 1 | -2 | 2 / 2 | 1 / 1 | 5 | 1 | 4 | Dano especial + -1 AGI |
| `linhagem-v2-1-serpentes-bote-de-jararaca` | Bote de Jararaca — Serpentes | 1 | -2 | 2 / 2 | 1 / 1 | 5 | 2 | 3 | Dano especial + Envenenamento |
| `linhagem-v2-1-anuros-secrecao-defensiva` | Secreção Defensiva — Anuros | 0 | -1 | 1 / 1 | 1 / 1 | 3 | 1 | 2 | Secreção reativa: 1 dano especial |
| `linhagem-v2-1-peixes-eletricos-descarga-do-poraque` | Descarga do Poraquê — Peixes elétricos | 1 | -2 | 2 / 2 | 1 / 1 | 5 | 1 | 4 | Dano especial + -1 ATQ |
| `linhagem-v2-1-peixes-eletricos-pulso-de-alta-voltagem` | Pulso de Alta Voltagem — Peixes elétricos | 1 | -2 | 1 / 1 | 1 / 1 | 4,5 | 1,5 | 3 | Dano especial + Desorientação -1 |
| `linhagem-v2-1-aracnideos-picada-venenosa` | Picada Venenosa — Aracnídeos | 1 | -2 | 2 / 2 | 1 / 1 | 5 | 2 | 3 | Dano especial + Envenenamento |
| `linhagem-v2-1-insetos-sociais-acido-defensivo` | Ácido Defensivo — Insetos sociais | 0 | -1 | 1 / 1 | 1 / 1 | 3 | 1 | 2 | Dano especial + -1 ATQ |
| `linhagem-v2-1-insetos-predadores-enzimas-digestivas` | Enzimas Digestivas — Insetos predadores | 0 | -1 | 1 / 1 | 1 / 1 | 3 | 1 | 2 | Dano especial + Digestão |

### Técnicas utilitárias e pendência biológica

| ID | Técnica — linhagem | Tratamento |
|---|---|---|
| `linhagem-v2-1-canideos-faro-de-perseguicao` | Faro de Perseguição — Canídeos | Utilitária; sem PG, dano ou parâmetros de combate |
| `linhagem-v2-1-procionideos-exploracao-atenta` | Exploração Atenta — Procionídeos | Utilitária; sem PG, dano ou parâmetros de combate |
| `linhagem-v2-1-morcegos-ecolocalizacao` | Ecolocalização — Morcegos | Utilitária; sem PG, dano ou parâmetros de combate |
| `linhagem-v2-1-aves-aquaticas-e-pernaltas-chamado-do-bando` | Chamado do Bando — Aves aquáticas e pernaltas | Utilitária; sem PG, dano ou parâmetros de combate |
| `linhagem-v2-1-crustaceos-jato-defensivo` | Jato Defensivo — Crustáceos | Sem alteração; espécie de base ainda precisa ser confirmada |

## Fórmula e custos centralizados

O cálculo permanece `PG bruto = 2 + 1,5P + 0,5R + 0,5M`; `PG líquido = PG bruto − custo dos efeitos`. O dano direto dos golpes especiais é `max(0, POT + PG líquido − RES)`. Valores de PG líquido não são limitados artificialmente nem arredondados. A tabela de testes confere que os 28 resultados são inteiros e idênticos à matriz aprovada. O campo `dano` não recebe PG.

Custos adicionados ou aproveitados em `CUSTOS_EFEITOS` incluem Desorientação/penalidade de precisão 1,5; redução de ATQ/AGI 1; iniciativa +1 custa 1; proteções geral -1 custa 1, geral -2 custa 2, física -2 custa 2, especial -2 custa 2; bônus de precisão +1 custa 1,5; Envenenamento 2; Digestão 1; dano especial reativo 1; revelação tática 1.

## Integração mecânica

- Os 28 registros usam os IDs V2.1 existentes e continuam com `estadoCatalogo: em-revisao`, mas recebem `parametrosTecnicosDisponiveis: true` para teste controlado. Os outros registros da V2.1 continuam bloqueados.
- MP e recarga são cobrados conforme a tabela. O D10 atual é reaproveitado; precisão final -1−P é compatível com a regra existente de erro nos resultados iguais ou abaixo da penalidade. Bônus reduz o limite de erro e penalidade o aumenta; ambos são consumidos na tentativa.
- Técnicas de preparação aplicam proteções, secreções, iniciativa ou bônus sem teste ofensivo. Golpes dirigidos aplicam efeitos após acerto. Golpes com dano calculam dano por POT/PG líquido/RES; os demais de combate aplicam só seus efeitos.
- Desorientação não acumula, aplica -1 ao próximo golpe ofensivo e expira ao fim do próximo turno do alvo. Reduções de ATQ/AGI são -1 até o fim do próximo turno, não acumulam e AGI reduzida participa da próxima iniciativa enquanto ativa.
- Proteções são consumidas somente por dano compatível, expiram ao fim do próximo turno do usuário e não acumulam: Falsa Morte reduz 2 de dano geral; Voo Errático reduz 2 físico; Grito de Rapina reduz 2 especial; Vocalização de Defesa reduz 1 geral.
- Alerta da Colônia aplica +1 à próxima iniciativa, que é consumido nessa rolagem.
- Envenenamento entra ao acertar, causa 1 dano ao fim do turno do alvo por duas ocorrências e é renovado sem acúmulo. Peçonha Concentrada aumenta uma única vez por alvo em 1 o dano por ocorrência restante, sem renovar duração. Reaplicações do veneno renovam a duração e preservam a intensificação já feita.
- Digestão aplica uma ocorrência de 1 dano no fim do próximo turno do alvo e depois termina; reuso substitui a ocorrência anterior.
- Secreções duram até dois turnos próprios, ativam uma vez após acerto de ataque físico de contato: Mustelídeos aplicam -1 ATQ ao atacante; Marsupiais aplicam Desorientação; Anuros causam 1 dano especial reativo. Não reagem a golpes especiais ou a ataques que erram.
- No catálogo atual não há classificação de alcance além das categorias de golpe. Para este combate individual, ataques físicos bem-sucedidos são tratados como contato; golpes especiais nunca ativam secreções.
- Barbilhões revela a menor defesa; em empate informa ambas. Faro, Exploração, Ecolocalização e Chamado do Bando continuam utilitários sem resolução numérica em batalha.
- Se Peçonha Concentrada for usada sem um veneno ativo, a ação é recusada antes de gastar MP ou iniciar recarga. A mesma restrição vale se o alvo já foi intensificado. Esse comportamento usa o padrão do resolvedor para ações inválidas, que valida requisitos antes de consumir recursos.
- Estados de efeito são guardados no combatente da batalha e não alteram fichas. `criarCombatente` inicia estado limpo para cada nova batalha.

## Arquivos e testes

Parâmetros e custos centralizados: `js/technique-balance.js`. Campos numéricos no catálogo: `js/techniques-v2-1.js`. Regras/descritores atualizados: `js/technique-effects-v2-1.js`. Integração no fluxo comum: `js/combat-domain.js`; liberação controlada e seleção de CPU: `js/technique-learning.js` e `js/battle-modes.js`. Histórico em combate e indicação de revisão: `js/app.js`.

Os testes `tests/technique-specials-v2-1.test.js`, `tests/technique-effects-v2-1.test.js` e `tests/combat-domain.test.js` cobrem parâmetros, custos, fórmulas, efeitos temporários, expiração/consumo, estados de novo combate, utilitários, Jato e regressão da V1. A implementação permanece em revisão; resultado de testes não equivale à validação final de equilíbrio.
