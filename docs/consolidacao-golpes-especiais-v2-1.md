# Consolidação dos golpes especiais V2.1

Este documento registra os efeitos conceituais aprovados para as 33 técnicas listadas na especificação. Foram ligados ao catálogo 32 registros por seus IDs estáveis. **Jato Defensivo** permanece intacto e sem metadados novos até a confirmação da espécie que fundamenta a técnica.

## Implementação

`js/technique-effects-v2-1.js` contém regras reutilizáveis em `REGRAS_EFEITOS_V2_1` e descritores por ID em `EFEITOS_CONCEITUAIS_POR_TECNICA_V2_1`. Cada técnica também expõe `efeitosV2_1` no catálogo V2.1. As regras especificam gatilhos, durações, consumo e não-acumulação. Valores numéricos ausentes permanecem `null` ou pendentes.

Os textos aprovados foram copiados para `efeito` nos 32 registros correspondentes. Não foram alterados IDs, nomes, categorias, linhagens ou parâmetros. Nenhum efeito foi ligado ao resolvedor de combate: faltam intensidades numéricas e custos aprovados. Assim, exploração, percepção e utilidade continuam apenas descrições disponíveis fora do combate numérico.

## Catálogo das 33 técnicas

| Linhagem | Técnica | Situação |
|---|---|---|
| Felinos | Rugido da Caçadora | Desorientação ao acertar |
| Canídeos | Faro de Perseguição | Rastreamento fora de combate |
| Mustelídeos | Secreção Defensiva | Redução temporária de ATQ após contato |
| Procionídeos | Exploração Atenta | Investigação de ambientes |
| Roedores | Alerta da Colônia | Detecção; iniciativa em combate |
| Marsupiais | Falsa Morte | Redução geral do próximo dano, maior intensidade pendente |
| Marsupiais | Secreção Repulsiva | Desorientação após contato |
| Primatas | Grito de Alerta | Desorientação |
| Morcegos | Ecolocalização | Percepção sem visão |
| Morcegos | Pulso Ultrassônico | Dano especial e Desorientação |
| Morcegos | Voo Errático | Redução do próximo dano físico |
| Xenartros | Língua Capturadora | Dano especial e redução temporária de AGI, afeta iniciativa |
| Ungulados | Brado Territorial | Desorientação |
| Aves de rapina | Grito de Rapina | Redução do próximo dano especial |
| Aves corredoras e campestres | Chamado de Advertência | Alerta e bônus de precisão |
| Aves aquáticas e pernaltas | Chamado do Bando | Comunicação fora de combate |
| Psitacídeos | Vocalização Imitativa | Imitação fora de combate; pode desorientar em combate |
| Serpentes | Bote de Jararaca | Dano especial e Envenenamento |
| Serpentes | Peçonha Concentrada | Intensifica Envenenamento já aplicado; sem acumulação indefinida |
| Lagartos | Ameaça Visual | Desorientação |
| Quelônios | Vocalização de Defesa | Redução geral do próximo dano, menor intensidade pendente |
| Anuros | Secreção Defensiva | Dano especial após contato |
| Anuros | Vocalização Intimidante | Redução temporária de ATQ |
| Peixes elétricos | Descarga do Poraquê | Dano especial e redução temporária de ATQ |
| Peixes elétricos | Pulso de Alta Voltagem | Dano especial elevado e penalidade de precisão |
| Characiformes | Descarga de Muco | Penalidade de precisão |
| Siluriformes | Barbilhões Sensoriais | Revela a menor defesa entre DEF e RES |
| Peixes cartilaginosos | Percepção do Tubarão-martelo | Bônus de precisão |
| Aracnídeos | Picada Venenosa | Dano especial e Envenenamento |
| Aracnídeos | Pelos Urticantes | Penalidade de precisão |
| Insetos sociais | Ácido Defensivo | Dano especial e redução temporária de ATQ |
| Insetos predadores | Enzimas Digestivas | Dano especial e Digestão |
| Crustáceos | Jato Defensivo | Pendente: fundamentação biológica; sem mudança no registro |

## Regras padronizadas e pendências

- Desorientação penaliza a precisão do próximo golpe ofensivo do alvo, é consumida nessa tentativa, expira ao fim do próximo turno do alvo se não usada e não acumula.
- Reduções de ATQ/AGI duram até o fim do próximo turno do alvo; nova aplicação pode renovar duração sem elevar intensidade.
- Redução de dano protege do próximo ataque recebido e expira ao fim do próximo turno do usuário se não consumida; não acumula.
- Bônus de precisão afeta o próximo golpe ofensivo próprio e expira ao fim do próximo turno do usuário se não usado; não acumula.
- Envenenamento é aplicado ao acertar, causa dano no fim do turno do alvo por dois turnos; não acumula e nova aplicação renova duração.
- Digestão causa uma ocorrência adicional no fim do próximo turno do alvo; nova aplicação substitui a anterior.
- Secreções defensivas duram dois turnos do usuário, ativam uma vez quando o adversário acerta ataque físico de contato e expiram sem ativação; não acumulam.
- Permanecem pendentes intensidades, danos por ocorrência, penalidades/bônus, redução de atributos, valores das quatro proteções, limite/intensidade de Peçonha Concentrada, dano de Digestão e custos numéricos.
- Os campos numéricos dos golpes especiais/suporte continuam sem parametrização. Fórmula oficial não foi alterada.

## Verificação

O teste `tests/technique-effects-v2-1.test.js` confere IDs, a exceção de Jato Defensivo, parâmetros pendentes, regras compartilhadas e imutabilidade dos descritores. A implementação não modifica V1 nem o resolvedor de combate.
