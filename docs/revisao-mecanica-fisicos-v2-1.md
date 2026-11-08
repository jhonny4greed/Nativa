# Revisão mecânica dos golpes físicos V2.1

Esta revisão complementa e supersede as conclusões mecânicas da [auditoria anterior](auditoria-fisicos-v2-1.md). Ela mantém os 42 golpes físicos, seus IDs, nomes, linhagens e categorias.

## Resultado da revisão

Somente os sete golpes listados abaixo conservam efeitos secundários mecânicos. Os outros 35 agora têm descrições de ataque físico direto, sem promessas de empurrar, derrubar, prender, capturar, dificultar fuga, reagir, atacar sucessivamente ou obter bônus do ambiente. As alterações são de descrição e metadados de catálogo; não mudam o resolvedor de combate.

| Golpe e ID | Efeito registrado | Custo reconhecido | Estado no jogo |
|---|---|---:|---|
| Bote Predatório — `linhagem-v2-1-felinos-bote-predatorio` | +1 dano se o alvo ainda não realizou sua ação no turno atual. | Pendente; não consta na tabela oficial. | Cadastrado como efeito condicional; custo e cálculo final pendentes. |
| Garras Perfurantes — `linhagem-v2-1-felinos-garras-perfurantes` | Exposição: DEF −1 por 1 turno. | 1,5 PG. | Efeito/custo cadastrados; aplicação de condições não existe no combate V2.1. |
| Mordida Persistente — `linhagem-v2-1-canideos-mordida-persistente` | Sangramento: 1 dano na próxima ação ofensiva do alvo. | 1 PG. | Aplicação direta descrita, sem chance inventada; resolução de condição permanece pendente no motor. |
| Investida de Grande Porte — `linhagem-v2-1-ungulados-investida-de-grande-porte` | Desorientação: 1 penalidade no próximo golpe do alvo. | 1,5 PG. | Efeito/custo cadastrados; aplicação de condições pendente no motor. Empurrão, deslocamento e queda removidos. |
| Bicada Desestabilizadora — `linhagem-v2-1-psitacideos-bicada-desestabilizadora` | Desorientação: 1 penalidade no próximo golpe do alvo. | 1,5 PG. | Efeito/custo cadastrados; aplicação de condições pendente no motor. |
| Mordida de Piranha — `linhagem-v2-1-characiformes-mordida-de-piranha` | +1 dano contra alvo sob Sangramento; interação pretendida com Mordida Persistente. | Pendente; não consta na tabela oficial. | Condição registrada; custo e execução dependente de Sangramento pendentes. |
| Mordida Serrilhada — `linhagem-v2-1-peixes-cartilaginosos-mordida-serrilhada` | Ferimento Profundo: +1 dano imediato. | 1 PG. | Efeito/custo cadastrados; aplicação do efeito pendente no motor V2.1. |

Os custos conhecidos foram referenciados pela tabela central em `js/technique-balance.js`; não foram repetidos nem inventados. Os dois bônus de dano condicional permanecem explicitamente sem custo.

## Os 35 golpes simplificados

Todos permanecem no catálogo como golpes físicos diretos. As descrições foram ajustadas para preservar a identidade temática sem prometer consequências mecânicas não implementadas.

| Linhagem | Golpes |
|---|---|
| Canídeos | Investida de Matilha |
| Mustelídeos | Agarrão Aquático; Mordida de Fixação |
| Procionídeos | Garras Escaladoras |
| Roedores | Incisivos Poderosos; Impacto de Roedura |
| Marsupiais | Mordida Defensiva |
| Primatas | Manipulação de Ferramentas |
| Morcegos | Mergulho Predatório |
| Xenartros | Garras Escavadoras |
| Aves de rapina | Garras de Harpia; Mergulho Predatório |
| Aves corredoras e campestres | Chute de Ema; Patada Predatória |
| Aves aquáticas e pernaltas | Bico de Tuiuiú |
| Psitacídeos | Bico Poderoso |
| Serpentes | Constrição |
| Lagartos | Cauda Chicote; Mordida de Lagarto |
| Quelônios | Impacto de Casco; Mordida de Casco |
| Crocodilianos | Giro Mortal; Mordida de Emboscada |
| Anuros | Língua Capturadora |
| Peixes elétricos | Investida Aquática |
| Characiformes | Frenesi Alimentar |
| Siluriformes | Espinhos das Nadadeiras; Sucção Poderosa |
| Peixes cartilaginosos | Investida Subaquática |
| Aracnídeos | Pinça de Escorpião |
| Insetos sociais | Mandíbulas de Operária |
| Insetos predadores | Captura do Louva-a-deus; Mandíbulas Predatórias |
| Crustáceos | Pinça Esmagadora |

Removidos como promessas de efeito mecânico e mantidos apenas como inspiração temática quando pertinente: deslocar/empurrar/derrubar, restringir/capturar/prender, dificultar fuga, contra-atacar, interromper/desestabilizar, atacar várias vezes, degradar proteção, explorar abertura, depender de aliado, usar obstáculo/terreno/ferramenta ou obter vantagem por surpresa/posição. Nenhum desses efeitos foi convertido em Exposição ou Desorientação.

## Limitação do combate atual

O motor (`js/combat-domain.js`) impede o uso de toda técnica V2.1 enquanto ela estiver em revisão. Ele não aplica Sangramento, Exposição, Desorientação ou Ferimento Profundo como condições estruturadas; hoje processa o dano base e sinergias V1, sem estado de condições V2.1. Por isso, os sete efeitos estão registrados no catálogo/auditoria, mas **não são resolvidos em combate**. A interface de batalha não foi alterada e nenhum golpe foi desbloqueado.

As técnicas continuam aprendíveis pela regra atual, independentemente dos parâmetros pendentes. Precisão, MP, recarga, valores finais de P/R/M e dano continuam sem definição. PG bruto de referência continua sendo 2 apenas sob P=R=M=0 provisórios; PG restante não foi convertido em dano.

## Validação

- Golpes físicos mantidos: **42/42**.
- Efeitos secundários registrados: **7**; dos sete, cinco usam custos conhecidos (Exposição, Sangramento, duas Desorientações e Ferimento Profundo) e dois aguardam custo (Bote Predatório e Mordida de Piranha).
- Golpes simplificados para dano direto: **35**.
- Nomes, IDs, linhagens e categorias: preservados e testados contra a auditoria anterior.
- Uso em combate: V2.1 permanece bloqueada; aprendizagem continua permitida.
- Golpes V1: preservados.
- Arquivos de runtime alterados: `js/techniques-v2-1.js` e `js/technique-balance.js`. Testes alterados: `tests/technique-balance.test.js`. Este documento é o complemento da auditoria anterior.
