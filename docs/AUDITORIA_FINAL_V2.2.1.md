# Auditoria de finalização — NATIVA V2.2.1

## Escopo e preservação

Esta auditoria ocorre na branch `revisao-final-v2-2-1`. A V2.2.1 continua sendo a versão-alvo: não criar V2.3, não renomear golpes, não alterar IDs e não substituir a lista-base V2.2. O catálogo deve manter 178 registros (108 Linhagem, 20 Bioma, 20 Arquétipo e 30 Afinidade).

A revisão não aprova automaticamente um golpe porque seus números estão preenchidos. Cada registro precisa ter parâmetros utilizáveis, descrição coerente com o efeito implementado e funcionamento compatível com o combate 1v1 atual.

## Primeira auditoria estrutural

- Foram conferidos os 178 registros de `js/techniques-v2-2-1.js`.
- As contagens por origem e categoria coincidem com o inventário V2.2.1: 66 Físicos, 58 Especiais e 54 Suporte.
- A fórmula declarada do PG bruto foi recalculada em todos os registros: `2 + 1,5P + 0,5R + 0,5M`. Não foi encontrada divergência entre o resultado, `pg` e `pgBruto`.
- Todos os registros têm MP e recarga numéricos; os quatro golpes de Suporte de Afinidade usam precisão nula, o que é coerente com golpes sem teste ofensivo.
- Os 40 registros de Bioma e Arquétipo permanecem marcados como sem parâmetros técnicos disponíveis. Eles não podem ser liberados sem completar e revisar os parâmetros.
- Os 108 golpes de Linhagem têm parâmetros técnicos preenchidos, mas isso não significa aprovação: várias descrições dependem de efeitos ainda não implementados ou de condições narrativas que precisam ser formalizadas.

## Regras de auditoria adotadas

1. Preservar nome, ID, origem, grupo, categoria, afinidade e identidade dos golpes.
2. Não inventar regras para fuga, aliados, terreno, agarrões, imobilização, cura, sangramento, queimadura, exposição ou dano sucessivo.
3. Não aprovar efeitos que o motor não executa de forma verificável.
4. Quando a regra implementada divergir da descrição, corrigir a divergência antes da aprovação; não alterar silenciosamente o efeito do motor.
5. Efeitos condicionais só podem ser aprovados se o gatilho estiver disponível e inequívoco no combate 1v1.
6. Sinergias são bônus opcionais e não condição para aprender ou usar o golpe. As oito correspondências confirmadas permanecem preservadas.
7. Golpes ainda sem regra ou decisão suficiente permanecem em revisão, com motivo documentado.

## Pontos identificados para correção/validação

### Divergência de intensidade entre texto e motor

O motor atual aplica intensidade 1 em Desorientação, redução de ATQ/AGI e bônus de precisão. Há descrições da lista-base com intensidade 2. A documentação de consolidação já registra que a regra de combate V2.2.1 usa intensidade 1 para esses efeitos. Antes de liberar os golpes afetados, a descrição visível deve ser alinhada ao valor efetivamente aplicado, sem aumentar o efeito do motor nesta etapa.

Também há divergência entre a descrição de Enzimas Digestivas (2 de dano) e a implementação atual (1 dano). Deve ser resolvida alinhando o texto à regra de Digestão definida na consolidação, ou mantendo o golpe pendente se a decisão de design for reabrir essa regra.

### Efeitos de Linhagem não implementados ou incompatíveis

A primeira leitura identificou descrições que não podem ser consideradas executáveis no combate atual sem decisão adicional: Sangramento, Exposição, recuperação de HP, preparação genérica de resposta, bônus por cenário narrativo, ação de aliado, fuga/reposicionamento, agarrões/imobilizações e ataques com múltiplos testes/impactos. Esses casos permanecem pendentes até existir regra aprovada e implementação correspondente.

### Sinergias

A fonte ativa `js/techniques.js` injeta oito sinergias confirmadas nos IDs corretos, e o motor consulta os Traços reais da ficha. As oito associações devem ser preservadas. O arquivo bruto `techniques-v2-2-1.js` não contém diretamente a propriedade `sinergias`; ela é adicionada pelo catálogo composto em `js/techniques.js`. O inventário Markdown reflete corretamente essa composição.

## Próximas etapas

1. Revisar individualmente os 108 golpes de Linhagem, separando aprováveis, corrigíveis e pendentes.
2. Auditar os 20 golpes de Bioma e os 20 de Arquétipo, completando parâmetros apenas quando a fonte e as regras aprovadas sustentarem os valores.
3. Auditar os 30 golpes de Afinidade e verificar compatibilidade com o ciclo elemental.
4. Atualizar catálogo, efeitos e inventário de forma sincronizada, preservando IDs.
5. Executar lint, build e testes relevantes no ambiente do projeto; registrar qualquer validação que dependa da execução local pelo Codex.

## Estado desta etapa

## Liberação operacional solicitada

Por solicitação explícita do usuário, os 178 golpes ativos foram alterados para `estadoCatalogo: aprovado`, liberando o uso na arena. Os IDs, nomes, grupos, categorias, afinidades e parâmetros originais foram preservados. O marcador `parametrosTecnicosDisponiveis` não foi alterado: 108 registros estão `true` e 70 permanecem `false`, como sinalização para revisão técnica detalhada. A liberação remove o bloqueio de combate, mas não certifica o balanceamento nem implementa efeitos descritivos ainda pendentes. Os golpes arquivados não foram alterados.
