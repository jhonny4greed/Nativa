# NATIVA/BRASIMON — Planilha de parâmetros: 42 golpes físicos V2.1

Documento de trabalho e registro dos parâmetros já aprovados. A parametrização dos 40 golpes não declara o balanceamento final validado em combate. A auditoria mecânica está em [auditoria-fisicos-v2-1.md](auditoria-fisicos-v2-1.md), e a revisão conceitual em [revisao-mecanica-fisicos-v2-1.md](revisao-mecanica-fisicos-v2-1.md).

## Estrutura atual encontrada

- Existem **42** registros V2.1 com categoria Física em js/techniques-v2-1.js.
- Cada registro usa os campos precisao, recarga, mp, pg e dano; antes desta consolidação, somente os seis primeiros golpes tinham parâmetros. Agora 40 dos 42 golpes identificados têm parâmetros numéricos; Mordida Defensiva e Chifrada de Impacto permanecem sem preenchimento.
- precisao representa a precisão armazenada pelo catálogo; a convenção aprovada define precisão-base −1 e P como penalidades adicionais: −1→0, −2→1, −3→2, −4→3, −5→4. Os 40 valores preenchidos seguem essa correspondência. Não derivamos P dos parâmetros V1.
- Recarga-base = 0 turnos adicionais e MP-base = 0 custo adicional para a fórmula; não significam que os campos finais de recarga/MP sejam definidos como zero.
- O catálogo V1 arquivado armazena os mesmos campos de parâmetro precisao, mp, recarga, pg e dano, com valores numéricos em vários registros. Esses valores são apenas referência do formato/compatibilidade, não foram copiados.
- js/technique-balance.js implementa calcularPGBruto({P=0,R=0,M=0}) = 2 + 1.5P + 0.5R + 0.5M, cálculo líquido como bruto menos custos e cálculo do dano com mínimo 0. O padrão numérico zero nessa função é referência matemática, não resolve os parâmetros finais.
- O catálogo também registra auditoriaBalanceamento com custos reconhecidos e estados de revisão. A tabela usa esses custos sem atribuir efeito/custo novo.

## Valores-base e variáveis adicionais

| Parâmetro | Base oficial | Variável da fórmula | Observação |
|---|---:|---|---|
| Precisão | −1 | P = penalidades adicionais relativas à base (−1→P0; −2→P1; −3→P2; −4→P3; −5→P4) | Precisão final foi definida para os 40 golpes identificados; P é registrado separadamente. |
| Recarga | 0 turnos adicionais | R | A recarga efetiva a definir deve ser comparada com a base segundo convenção do projeto. |
| MP | 0 custo adicional | M | O MP efetivo a definir deve ser comparado com a base segundo convenção do projeto. |
| PG-base | 2 | — | Valor interno. Nunca exibir na interface de jogador. |

## Fórmulas de cálculo e validação

- PG bruto = 2 + 1,5 × P + 0,5 × R + 0,5 × M.
- PG líquido = PG bruto − soma dos custos nominais dos efeitos.
- Dano físico = máx(0, ATQ + PG líquido − DEF).
- Não arredondar valores fracionados nem usar PG líquido como dano. Dano permanece pendente se faltar qualquer parâmetro ou se resultar fracionado.
- Para custos ainda desconhecidos, deixar PG líquido sem calcular. Os bônus de dano condicionais não viram dano-base automaticamente.

## Tabela consolidada de parâmetros

Os parâmetros foram consolidados para 40 golpes. Mordida Defensiva e Chifrada de Impacto são os dois registros sem correspondência com as tabelas aprovadas e permanecem intactos. Os campos “atual” mostram o catálogo já consolidado.

| ID | Nome | Linhagem | Efeito secundário | Precisão atual | Precisão final | P adicional | Recarga atual | Recarga final | R adicional | MP atual | MP final | M adicional | Dano atual | PG bruto | PG bruto calculado | Identificador do efeito | Custo do efeito | PG líquido | Dano calculado (preencher) | Observações |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| linhagem-v2-1-felinos-bote-predatorio | Bote Predatório | Felinos | +1 dano se o alvo ainda não realizou sua ação no turno atual. | -2 | -2 | 1 | 1 | 1 | 1 | 0 | 0 | 0 | null | 4 (aprovado) | 4 | dano-condicional-alvo-nao-agiu | 1 PG nominal | 3 | Pendente: depende de ATQ e DEF da ficha/alvo | Custo de 1 PG adotado nesta parametrização; condição verificada no momento da resolução. |
| linhagem-v2-1-felinos-garras-perfurantes | Garras Perfurantes | Felinos | Exposição: DEF −1 por 1 turno. | -2 | -2 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | null | 4.5 (aprovado) | 4.5 | exposicao | 1,5 PG nominal | 3 | Pendente: depende de ATQ e DEF da ficha/alvo | Exposição: DEF −1 por 1 turno; efeito ainda não implementado no combate. |
| linhagem-v2-1-canideos-mordida-persistente | Mordida Persistente | Canídeos | Sangramento: 1 dano na próxima ação ofensiva do alvo; chance de aplicação: 50% (informada nesta solicitação). | -2 | -2 | 1 | 0 | 0 | 0 | 1 | 1 | 1 | null | 4 (aprovado) | 4 | sangramento | 1 PG nominal; 0,5 PG esperado (50% × 1 PG) | 3 | Pendente: depende de ATQ e DEF da ficha/alvo | 50% de chance; custo nominal 1 PG. Custo esperado 0,5 PG é informativo e não substitui o nominal. |
| linhagem-v2-1-canideos-investida-de-matilha | Investida de Matilha | Canídeos | Nenhum efeito secundário mecânico; ataque físico direto. | -3 | -3 | 2 | 2 | 2 | 2 | 0 | 0 | 0 | null | 6 (aprovado) | 6 | — | 0 PG nominal | 6 | Pendente: depende de ATQ e DEF da ficha/alvo | Ataque físico direto, sem efeito secundário. |
| linhagem-v2-1-mustelideos-agarrao-aquatico | Agarrão Aquático | Mustelídeos | Nenhum efeito secundário mecânico; ataque físico direto. | -2 | -2 | 1 | 0 | 0 | 0 | 1 | 1 | 1 | null | 4 (aprovado) | 4 | — | 0 PG nominal | 4 | Pendente: depende de ATQ e DEF da ficha/alvo | Ataque físico direto, sem efeito secundário. |
| linhagem-v2-1-mustelideos-mordida-de-fixacao | Mordida de Fixação | Mustelídeos | Nenhum efeito secundário mecânico; ataque físico direto. | -1 | -1 | 0 | 2 | 2 | 2 | 2 | 2 | 2 | null | 4 (aprovado) | 4 | — | 0 PG nominal | 4 | Pendente: depende de ATQ e DEF da ficha/alvo | Ataque físico direto; nome e descrição não ativam controle. |
| linhagem-v2-1-procionideos-garras-escaladoras | Garras Escaladoras | Procionídeos | Nenhum efeito secundário mecânico; ataque físico direto. | -2 | -2 | 1 | 0 | 0 | 0 | 1 | 1 | 1 | null | 4 (aprovado) | 4 | — | 0 PG nominal | 4 | Pendente: depende de ATQ e DEF da ficha/alvo | Ataque direto, sem custo secundário identificado. |
| linhagem-v2-1-roedores-incisivos-poderosos | Incisivos Poderosos | Roedores | Nenhum efeito secundário mecânico; ataque físico direto. | -1 | -1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 | null | 3 (aprovado) | 3 | — | 0 PG nominal | 3 | Pendente: depende de ATQ e DEF da ficha/alvo | Ataque direto, sem custo secundário identificado. |
| linhagem-v2-1-roedores-impacto-de-roedura | Impacto de Roedura | Roedores | Nenhum efeito secundário mecânico; ataque físico direto. | -3 | -3 | 2 | 2 | 2 | 2 | 0 | 0 | 0 | null | 6 (aprovado) | 6 | — | 0 PG nominal | 6 | Pendente: depende de ATQ e DEF da ficha/alvo | Ataque direto, sem custo secundário identificado. R recebeu +1 (recarga adicional) para adicionar 0,5 PG e manter o PG líquido inteiro, conforme orientação desta consolidação. |
| linhagem-v2-1-marsupiais-mordida-defensiva | Mordida Defensiva | Marsupiais | Nenhum efeito secundário mecânico; ataque físico direto. | null | ___ | ___ | null | ___ | ___ | null | ___ | ___ | null | 2 (provisório; P=R=M=0) | ___ | — | 0 PG reconhecido nesta etapa | PG bruto − 0 = ___ | ATQ + PG líquido − DEF = ___ (mín. 0) | Ataque direto, sem custo secundário identificado. |
| linhagem-v2-1-primatas-manipulacao-de-ferramentas | Manipulação de Ferramentas | Primatas | Nenhum efeito secundário mecânico; ataque físico direto. | -2 | -2 | 1 | 1 | 1 | 1 | 2 | 2 | 2 | null | 5 (aprovado) | 5 | — | 0 PG nominal | 5 | Pendente: depende de ATQ e DEF da ficha/alvo | Ataque direto, sem custo secundário identificado. R recebeu +1 (recarga adicional) para adicionar 0,5 PG e manter o PG líquido inteiro, conforme orientação desta consolidação. |
| linhagem-v2-1-morcegos-mergulho-predatorio | Mergulho Predatório | Morcegos | Nenhum efeito secundário mecânico; ataque físico direto. | -3 | -3 | 2 | 1 | 1 | 1 | 1 | 1 | 1 | null | 6 (aprovado) | 6 | — | 0 PG nominal | 6 | Pendente: depende de ATQ e DEF da ficha/alvo | Ataque direto, sem custo secundário identificado. |
| linhagem-v2-1-xenartros-garras-escavadoras | Garras Escavadoras | Xenartros | Nenhum efeito secundário mecânico; ataque físico direto. | -2 | -2 | 1 | 1 | 1 | 1 | 0 | 0 | 0 | null | 4 (aprovado) | 4 | — | 0 PG nominal | 4 | Pendente: depende de ATQ e DEF da ficha/alvo | Ataque direto, sem custo secundário identificado. |
| linhagem-v2-1-ungulados-investida-de-grande-porte | Investida de Grande Porte | Ungulados | Desorientação: adiciona 1 penalidade ao próximo golpe do alvo. | -2 | -2 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | null | 4.5 (aprovado) | 4.5 | desorientacao | 1,5 PG nominal | 3 | Pendente: depende de ATQ e DEF da ficha/alvo | Efeito e parâmetros consolidados; aplicação do efeito ainda não é resolvida pelo motor. |
| linhagem-v2-1-ungulados-chifrada-de-impacto | Chifrada de Impacto | Ungulados | Nenhum efeito secundário mecânico; ataque físico direto. | null | ___ | ___ | null | ___ | ___ | null | ___ | ___ | null | 2 (provisório; P=R=M=0) | ___ | — | 0 PG reconhecido nesta etapa | PG bruto − 0 = ___ | ATQ + PG líquido − DEF = ___ (mín. 0) | Ataque direto, sem custo secundário identificado. |
| linhagem-v2-1-aves-de-rapina-garras-de-harpia | Garras de Harpia | Aves de rapina | Nenhum efeito secundário mecânico; ataque físico direto. | -2 | -2 | 1 | 0 | 0 | 0 | 1 | 1 | 1 | null | 4 (aprovado) | 4 | — | 0 PG nominal | 4 | Pendente: depende de ATQ e DEF da ficha/alvo | Ataque direto, sem custo secundário identificado. |
| linhagem-v2-1-aves-de-rapina-mergulho-predatorio | Mergulho Predatório | Aves de rapina | Nenhum efeito secundário mecânico; ataque físico direto. | -3 | -3 | 2 | 2 | 2 | 2 | 0 | 0 | 0 | null | 6 (aprovado) | 6 | — | 0 PG nominal | 6 | Pendente: depende de ATQ e DEF da ficha/alvo | Ataque direto, sem custo secundário identificado. |
| linhagem-v2-1-aves-corredoras-e-campestres-chute-de-ema | Chute de Ema | Aves corredoras e campestres | Nenhum efeito secundário mecânico; ataque físico direto. | -2 | -2 | 1 | 2 | 2 | 2 | 1 | 1 | 1 | null | 5 (aprovado) | 5 | — | 0 PG nominal | 5 | Pendente: depende de ATQ e DEF da ficha/alvo | Ataque direto, sem custo secundário identificado. R recebeu +1 (recarga adicional) para adicionar 0,5 PG e manter o PG líquido inteiro, conforme orientação desta consolidação. |
| linhagem-v2-1-aves-corredoras-e-campestres-patada-predatoria | Patada Predatória | Aves corredoras e campestres | Nenhum efeito secundário mecânico; ataque físico direto. | -2 | -2 | 1 | 1 | 1 | 1 | 0 | 0 | 0 | null | 4 (aprovado) | 4 | — | 0 PG nominal | 4 | Pendente: depende de ATQ e DEF da ficha/alvo | Ataque direto, sem custo secundário identificado. |
| linhagem-v2-1-aves-aquaticas-e-pernaltas-bico-de-tuiuiu | Bico de Tuiuiú | Aves aquáticas e pernaltas | Nenhum efeito secundário mecânico; ataque físico direto. | -1 | -1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 | null | 3 (aprovado) | 3 | — | 0 PG nominal | 3 | Pendente: depende de ATQ e DEF da ficha/alvo | Ataque direto, sem custo secundário identificado. |
| linhagem-v2-1-psitacideos-bico-poderoso | Bico Poderoso | Psitacídeos | Nenhum efeito secundário mecânico; ataque físico direto. | -2 | -2 | 1 | 0 | 0 | 0 | 1 | 1 | 1 | null | 4 (aprovado) | 4 | — | 0 PG nominal | 4 | Pendente: depende de ATQ e DEF da ficha/alvo | Ataque direto, sem custo secundário identificado. |
| linhagem-v2-1-psitacideos-bicada-desestabilizadora | Bicada Desestabilizadora | Psitacídeos | Desorientação: adiciona 1 penalidade ao próximo golpe do alvo. | -2 | -2 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | null | 4.5 (aprovado) | 4.5 | desorientacao | 1,5 PG nominal | 3 | Pendente: depende de ATQ e DEF da ficha/alvo | Parâmetros consolidados; Desorientação ainda não é resolvida pelo motor de combate. |
| linhagem-v2-1-serpentes-constricao | Constrição | Serpentes | Nenhum efeito secundário mecânico; ataque físico direto. | -3 | -3 | 2 | 2 | 2 | 2 | 0 | 0 | 0 | null | 6 (aprovado) | 6 | — | 0 PG nominal | 6 | Pendente: depende de ATQ e DEF da ficha/alvo | Ataque direto, sem custo secundário identificado. |
| linhagem-v2-1-lagartos-cauda-chicote | Cauda Chicote | Lagartos | Nenhum efeito secundário mecânico; ataque físico direto. | -2 | -2 | 1 | 2 | 2 | 2 | 1 | 1 | 1 | null | 5 (aprovado) | 5 | — | 0 PG nominal | 5 | Pendente: depende de ATQ e DEF da ficha/alvo | Ataque direto, sem custo secundário identificado. R recebeu +1 (recarga adicional) para adicionar 0,5 PG e manter o PG líquido inteiro, conforme orientação desta consolidação. |
| linhagem-v2-1-lagartos-mordida-de-lagarto | Mordida de Lagarto | Lagartos | Nenhum efeito secundário mecânico; ataque físico direto. | -1 | -1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 | null | 3 (aprovado) | 3 | — | 0 PG nominal | 3 | Pendente: depende de ATQ e DEF da ficha/alvo | Ataque direto, sem custo secundário identificado. |
| linhagem-v2-1-quelonios-impacto-de-casco | Impacto de Casco | Quelônios | Nenhum efeito secundário mecânico; ataque físico direto. | -3 | -3 | 2 | 3 | 3 | 3 | 1 | 1 | 1 | null | 7 (aprovado) | 7 | — | 0 PG nominal | 7 | Pendente: depende de ATQ e DEF da ficha/alvo | Ataque direto, sem custo secundário identificado. R recebeu +1 (recarga adicional) para adicionar 0,5 PG e manter o PG líquido inteiro, conforme orientação desta consolidação. |
| linhagem-v2-1-quelonios-mordida-de-casco | Mordida de Casco | Quelônios | Nenhum efeito secundário mecânico; ataque físico direto. | -3 | -3 | 2 | 2 | 2 | 2 | 0 | 0 | 0 | null | 6 (aprovado) | 6 | — | 0 PG nominal | 6 | Pendente: depende de ATQ e DEF da ficha/alvo | Ataque direto, sem custo secundário identificado. |
| linhagem-v2-1-crocodilianos-giro-mortal | Giro Mortal | Crocodilianos | Nenhum efeito secundário mecânico; ataque físico direto. | -3 | -3 | 2 | 3 | 3 | 3 | 1 | 1 | 1 | null | 7 (aprovado) | 7 | — | 0 PG nominal | 7 | Pendente: depende de ATQ e DEF da ficha/alvo | Ataque direto, sem custo secundário identificado. R recebeu +1 (recarga adicional) para adicionar 0,5 PG e manter o PG líquido inteiro, conforme orientação desta consolidação. |
| linhagem-v2-1-crocodilianos-mordida-de-emboscada | Mordida de Emboscada | Crocodilianos | Nenhum efeito secundário mecânico; ataque físico direto. | -2 | -2 | 1 | 2 | 2 | 2 | 1 | 1 | 1 | null | 5 (aprovado) | 5 | — | 0 PG nominal | 5 | Pendente: depende de ATQ e DEF da ficha/alvo | Ataque direto, sem custo secundário identificado. |
| linhagem-v2-1-anuros-lingua-capturadora | Língua Capturadora | Anuros | Nenhum efeito secundário mecânico; ataque físico direto. | -2 | -2 | 1 | 1 | 1 | 1 | 2 | 2 | 2 | null | 5 (aprovado) | 5 | — | 0 PG nominal | 5 | Pendente: depende de ATQ e DEF da ficha/alvo | Ataque direto, sem custo secundário identificado. R recebeu +1 (recarga adicional) para adicionar 0,5 PG e manter o PG líquido inteiro, conforme orientação desta consolidação. |
| linhagem-v2-1-peixes-eletricos-investida-aquatica | Investida Aquática | Peixes elétricos | Nenhum efeito secundário mecânico; ataque físico direto. | -2 | -2 | 1 | 2 | 2 | 2 | 1 | 1 | 1 | null | 5 (aprovado) | 5 | — | 0 PG nominal | 5 | Pendente: depende de ATQ e DEF da ficha/alvo | Ataque direto, sem custo secundário identificado. R recebeu +1 (recarga adicional) para adicionar 0,5 PG e manter o PG líquido inteiro, conforme orientação desta consolidação. |
| linhagem-v2-1-characiformes-mordida-de-piranha | Mordida de Piranha | Characiformes | +1 dano se o alvo estiver sob Sangramento. | -2 | -2 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | null | 4.5 (aprovado) | 4.5 | dano-condicional-alvo-sangrando | 0,5 PG nominal | 4 | Pendente: depende de ATQ e DEF da ficha/alvo | Custo de 0,5 PG consolidado; condição depende do Sangramento aplicado no alvo. |
| linhagem-v2-1-characiformes-frenesi-alimentar | Frenesi Alimentar | Characiformes | Nenhum efeito secundário mecânico; ataque físico direto. | -3 | -3 | 2 | 1 | 1 | 1 | 1 | 1 | 1 | null | 6 (aprovado) | 6 | — | 0 PG nominal | 6 | Pendente: depende de ATQ e DEF da ficha/alvo | Ataque direto, sem custo secundário identificado. |
| linhagem-v2-1-siluriformes-espinhos-das-nadadeiras | Espinhos das Nadadeiras | Siluriformes | Nenhum efeito secundário mecânico; ataque físico direto. | -2 | -2 | 1 | 0 | 0 | 0 | 1 | 1 | 1 | null | 4 (aprovado) | 4 | — | 0 PG nominal | 4 | Pendente: depende de ATQ e DEF da ficha/alvo | Ataque direto, sem custo secundário identificado. |
| linhagem-v2-1-siluriformes-succao-poderosa | Sucção Poderosa | Siluriformes | Nenhum efeito secundário mecânico; ataque físico direto. | -2 | -2 | 1 | 2 | 2 | 2 | 1 | 1 | 1 | null | 5 (aprovado) | 5 | — | 0 PG nominal | 5 | Pendente: depende de ATQ e DEF da ficha/alvo | Ataque direto, sem custo secundário identificado. R recebeu +1 (recarga adicional) para adicionar 0,5 PG e manter o PG líquido inteiro, conforme orientação desta consolidação. |
| linhagem-v2-1-peixes-cartilaginosos-investida-subaquatica | Investida Subaquática | Peixes cartilaginosos | Nenhum efeito secundário mecânico; ataque físico direto. | -3 | -3 | 2 | 1 | 1 | 1 | 1 | 1 | 1 | null | 6 (aprovado) | 6 | — | 0 PG nominal | 6 | Pendente: depende de ATQ e DEF da ficha/alvo | Ataque direto, sem custo secundário identificado. |
| linhagem-v2-1-peixes-cartilaginosos-mordida-serrilhada | Mordida Serrilhada | Peixes cartilaginosos | Ferimento Profundo: +1 dano imediato. | -2 | -2 | 1 | 2 | 2 | 2 | 1 | 1 | 1 | null | 5 (aprovado) | 5 | ferimento-profundo | 1 PG nominal | 4 | Pendente: depende de ATQ e DEF da ficha/alvo | Parâmetros consolidados; dano numérico depende de ATQ/DEF e efeito ainda não é resolvido pelo motor. |
| linhagem-v2-1-aracnideos-pinca-de-escorpiao | Pinça de Escorpião | Aracnídeos | Nenhum efeito secundário mecânico; ataque físico direto. | -2 | -2 | 1 | 1 | 1 | 1 | 0 | 0 | 0 | null | 4 (aprovado) | 4 | — | 0 PG nominal | 4 | Pendente: depende de ATQ e DEF da ficha/alvo | Ataque direto, sem custo secundário identificado. |
| linhagem-v2-1-insetos-sociais-mandibulas-de-operaria | Mandíbulas de Operária | Insetos sociais | Nenhum efeito secundário mecânico; ataque físico direto. | -1 | -1 | 0 | 0 | 0 | 0 | 2 | 2 | 2 | null | 3 (aprovado) | 3 | — | 0 PG nominal | 3 | Pendente: depende de ATQ e DEF da ficha/alvo | Ataque direto, sem custo secundário identificado. |
| linhagem-v2-1-insetos-predadores-captura-do-louva-a-deus | Captura do Louva-a-deus | Insetos predadores | Nenhum efeito secundário mecânico; ataque físico direto. | -3 | -3 | 2 | 1 | 1 | 1 | 1 | 1 | 1 | null | 6 (aprovado) | 6 | — | 0 PG nominal | 6 | Pendente: depende de ATQ e DEF da ficha/alvo | Ataque direto, sem custo secundário identificado. |
| linhagem-v2-1-insetos-predadores-mandibulas-predatorias | Mandíbulas Predatórias | Insetos predadores | Nenhum efeito secundário mecânico; ataque físico direto. | -2 | -2 | 1 | 1 | 1 | 1 | 2 | 2 | 2 | null | 5 (aprovado) | 5 | — | 0 PG nominal | 5 | Pendente: depende de ATQ e DEF da ficha/alvo | Ataque direto, sem custo secundário identificado. |
| linhagem-v2-1-crustaceos-pinca-esmagadora | Pinça Esmagadora | Crustáceos | Nenhum efeito secundário mecânico; ataque físico direto. | -3 | -3 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | null | 7 (aprovado) | 7 | — | 0 PG nominal | 7 | Pendente: depende de ATQ e DEF da ficha/alvo | Ataque direto, sem custo secundário identificado. |


## Etapa inicial

Os seis parâmetros do primeiro lote foram preservados na consolidação abaixo.

## Consolidação desta etapa

Foram parametrizados **40 dos 42** registros físicos atuais. Os seis do primeiro lote foram conferidos e preservados. Os outros 34 parâmetros identificados foram adicionados conforme as tabelas fornecidas. Dois registros foram deixados sem alterações: **Mordida Defensiva** (Marsupiais), ID linhagem-v2-1-marsupiais-mordida-defensiva, e **Chifrada de Impacto** (Ungulados), ID linhagem-v2-1-ungulados-chifrada-de-impacto. Não foram criados nomes ou IDs. Mergulho Predatório existe duas vezes e cada registro foi associado pela linhagem e ID.

Nove PG líquidos inicialmente resultavam em fração de 0,5. Conforme a orientação recebida para completar esse decimal com outra penalidade de +0,5, foi acrescentado **R +1 (um turno adicional de recarga)** a cada um desses nove: Impacto de Roedura, Manipulação de Ferramentas, Chute de Ema, Cauda Chicote, Impacto de Casco, Giro Mortal, Língua Capturadora, Investida Aquática e Sucção Poderosa. O efeito é +0,5 PG bruto por fórmula; os PG líquidos resultantes são inteiros. Nenhum custo de efeito foi alterado.

Todos os 40 PG líquidos estão inteiros. O campo dano permanece null em todos, pois faltam atributos ATQ e DEF para calcular dano final; assim, nenhum dano decimal é calculado. Esta é uma etapa de balanceamento, não validação final em combate. Os 42 golpes permanecem em revisão/bloqueados para uso em combate, e o PG continua interno.

## Tratamento dos sete efeitos

| Golpe | Custo nominal | Custo esperado | Nota |
|---|---:|---:|---|
| Bote Predatório | 1 PG | 1 PG | Custo de balanceamento adotado nesta parametrização para o +1 dano condicional. |
| Garras Perfurantes — Exposição | 1,5 PG | 1,5 PG | Custo tabelado. |
| Mordida Persistente — Sangramento | 1 PG | 0,5 PG | Chance de aplicação de 50% informada nesta etapa. O valor esperado não substitui automaticamente o custo nominal na fórmula oficial. |
| Investida de Grande Porte — Desorientação | 1,5 PG | 1,5 PG | Custo por aplicação. |
| Bicada Desestabilizadora — Desorientação | 1,5 PG | 1,5 PG | Custo por aplicação. |
| Mordida de Piranha — +1 contra Sangramento | 0,5 PG | 0,5 PG | Custo aprovado na consolidação. |
| Mordida Serrilhada — Ferimento Profundo | 1 PG | 1 PG | Custo tabelado. |

## Pendências para definição

1. Identificar e revisar os dois golpes sem parâmetros: Mordida Defensiva e Chifrada de Impacto.
2. Testar em combate os parâmetros dos 40 golpes antes de declarar o balanceamento concluído.
3. O custo esperado de Sangramento (0,5 PG) permanece informativo; o cálculo usa o custo nominal de 1 PG.
4. Definir valores de dano/base e validar o cálculo com ATQ/DEF reais, sem herdar valores V1.
5. A integração de efeitos no motor permanece pendente; os parâmetros numéricos não liberam técnicas para combate.

## Fontes consultadas e alterações

Consultados: js/techniques-v2-1.js, js/technique-balance.js, js/techniques.js, docs/auditoria-fisicos-v2-1.md, docs/revisao-mecanica-fisicos-v2-1.md, js/combat-domain.js e testes de balanceamento/combate.

Alterados: js/techniques-v2-1.js (parâmetros dos 40 golpes identificados), js/technique-balance.js (custos aprovados de Bote Predatório e Mordida de Piranha e leitura de P/R/M explícitos), docs/parametros-numericos-fisicos-v2-1.md e testes relacionados ao balanceamento. A V1, interface e resolvedor de combate não foram alterados.
