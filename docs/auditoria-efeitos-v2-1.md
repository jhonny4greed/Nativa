# Auditoria dos efeitos de golpes V2.1

V2.1 segue em revisão. Foram auditados 108 golpes (42 Físicos, 33 Especiais e 33 de Suporte). **Nenhum efeito V2.1 foi habilitado no combate:** todos os registros permanecem bloqueados por falta de parâmetros oficiais. Não foram copiados valores da V1.

## Parâmetros pendentes em todo o catálogo

Precisão, custo de MP, recarga, PG e dano estão nulos nos 108 golpes. Sem esses parâmetros, o motor não consegue validar custo, recarga, acerto ou dano, mesmo quando o texto descreve um ataque direto.

## Estado dos efeitos adicionais

Descrições de condições como sangramento, veneno, intimidação, imobilização e redução de atributos não fornecem em geral magnitude, gatilho, duração ou acúmulo. Movimentos, superfícies, áreas, rastros fora da arena ou ambiente aquático não têm representação espacial no combate atual. Referências a aliados, bandos, cardumes, colônias e manadas exigem suporte multi-combatente. Esses pontos permanecem pendentes; não foram simulados.

O motor V1 mantém dano físico/especial, precisão, afinidade, custos e recargas para fichas antigas. Golpes de Suporte V1 continuam registrando a descrição, sem alterar o estado de combate. Essa implementação foi preservada.

## Revisão por golpe

| Linhagem | Golpe | Categoria | Efeito-base textual V2.1 | Pendência principal | Estado |
|---|---|---|---|---|---|
| Felinos | Bote Predatório | Físico | Avança contra o alvo e causa dano adicional quando ele ainda não agiu no turno. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Felinos | Garras Perfurantes | Físico | Ataque concentrado que atravessa parte da proteção do alvo. | regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Felinos | Rugido da Caçadora | Especial | Intimida o alvo e dificulta sua próxima ação ofensiva. | regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Felinos | Foco Predatório | Suporte | Observa um adversário e prepara uma resposta mais eficaz contra ele. | efeito de Suporte sem resolução definida pelo motor; regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Canídeos | Faro de Perseguição | Especial | Identifica e acompanha o rastro de um alvo, mesmo após tentativa de fuga. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Canídeos | Mordida Persistente | Físico | Mordida que mantém pressão sobre o alvo e pode causar sangramento. | regra de estado sem intensidade, gatilho ou duração suficiente; depende de espaço, alcance, ambiente ou posicionamento não modelado | Pendente |
| Canídeos | Investida de Matilha | Físico | Aproveita a pressão de um aliado para executar uma investida mais eficaz. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Canídeos | Uivo Coordenador | Suporte | Coordena aliados e permite que reajustem suas ações diante da movimentação inimiga. | efeito de Suporte sem resolução definida pelo motor | Pendente |
| Mustelídeos | Agarrão Aquático | Físico | Agarra o adversário e restringe sua movimentação, especialmente em ambiente aquático. | regra de estado sem intensidade, gatilho ou duração suficiente; depende de espaço, alcance, ambiente ou posicionamento não modelado | Pendente |
| Mustelídeos | Mordida de Fixação | Físico | Prende o alvo com uma mordida e dificulta sua fuga. | regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Mustelídeos | Secreção Defensiva | Especial | Libera substância irritante que dificulta a aproximação do adversário. | regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Mustelídeos | Instinto de Sobrevivência | Suporte | Reage a uma ameaça iminente, priorizando preservação e fuga. | efeito de Suporte sem resolução definida pelo motor | Pendente |
| Procionídeos | Manipulação Precisa | Suporte | Utiliza as extremidades para manipular objetos ou explorar pontos vulneráveis. | efeito de Suporte sem resolução definida pelo motor | Pendente |
| Procionídeos | Garras Escaladoras | Físico | Ataca utilizando uma superfície ou obstáculo para obter posição favorável. | depende de espaço, alcance, ambiente ou posicionamento não modelado | Pendente |
| Procionídeos | Exploração Atenta | Especial | Investiga o ambiente e identifica elementos úteis, esconderijos ou ameaças. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Procionídeos | Mordida Oportunista | Suporte | Prepara um ataque contra um alvo distraído ou comprometido. | efeito de Suporte sem resolução definida pelo motor; regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Roedores | Mergulho de Fuga | Suporte | Executa fuga rápida em direção a uma posição protegida. | efeito de Suporte sem resolução definida pelo motor | Pendente |
| Roedores | Incisivos Poderosos | Físico | Mordida que desgasta proteções e estruturas resistentes. | regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Roedores | Impacto de Roedura | Físico | Sequência de mordidas rápidas que pressiona o adversário. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Roedores | Alerta da Colônia | Especial | Detecta uma ameaça e transmite o alerta aos aliados. | regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Marsupiais | Falsa Morte | Especial | Simula incapacidade para induzir o adversário a baixar a guarda. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Marsupiais | Mordida Defensiva | Físico | Contra-ataca um adversário que se aproxima ou tenta agarrar a Nativa. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Marsupiais | Secreção Repulsiva | Especial | Libera substância que desestimula aproximação e ataques de contato. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Marsupiais | Recuperação Oportuna | Suporte | Aproveita uma abertura para recuperar parte da capacidade de sobrevivência. | efeito de Suporte sem resolução definida pelo motor; regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Primatas | Manipulação de Ferramentas | Físico | Utiliza objeto do ambiente para executar ataque adaptado à situação. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Primatas | Ataque Coordenado | Suporte | Combina o movimento da Nativa com a ação de um aliado. | efeito de Suporte sem resolução definida pelo motor | Pendente |
| Primatas | Grito de Alerta | Especial | Emite chamado que revela perigo ou prejudica a concentração adversária. | regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Primatas | Observação Inteligente | Suporte | Analisa o comportamento do adversário e identifica padrões exploráveis. | efeito de Suporte sem resolução definida pelo motor | Pendente |
| Morcegos | Ecolocalização | Especial | Detecta posição de criaturas e obstáculos mesmo sem depender da visão. | regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Morcegos | Mergulho Predatório | Físico | Executa ataque descendente aproveitando a velocidade do voo. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Morcegos | Pulso Ultrassônico | Especial | Emite onda sonora que desorienta o adversário. | regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Morcegos | Voo Errático | Especial | Executa movimentos imprevisíveis que dificultam a leitura dos próximos deslocamentos. | regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Xenartros | Defesa Esférica | Suporte | Recolhe o corpo e reduz a exposição a ataques. | efeito de Suporte sem resolução definida pelo motor; regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Xenartros | Garras Escavadoras | Físico | Escava ou golpeia com as garras, podendo desestabilizar o alvo ou criar passagem. | regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Xenartros | Língua Capturadora | Especial | Projeta a língua para capturar um alvo ou objeto. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Xenartros | Couraça Resistente | Suporte | Assume postura defensiva e reduz a eficácia de ataques recebidos. | efeito de Suporte sem resolução definida pelo motor; regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Ungulados | Investida de Grande Porte | Físico | Avança com força contra o alvo e pode deslocá-lo ou quebrar sua postura. | depende de espaço, alcance, ambiente ou posicionamento não modelado | Pendente |
| Ungulados | Chifrada de Impacto | Físico | Golpe frontal que pode empurrar ou derrubar o adversário. | regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Ungulados | Pisoteio | Suporte | Pressiona um alvo próximo ou caído e dificulta sua recuperação de posição. | efeito de Suporte sem resolução definida pelo motor; regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Ungulados | Brado Territorial | Especial | Intimida adversários e protege o espaço ocupado. | regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Aves de rapina | Garras de Harpia | Físico | Agarra e perfura o adversário, podendo prendê-lo. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Aves de rapina | Mergulho Predatório | Físico | Ataque aéreo em alta velocidade. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Aves de rapina | Grito de Rapina | Especial | Chamado intimidante que pode desorganizar a ação adversária. | regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Aves de rapina | Visão Aguçada | Suporte | Observa o campo de batalha e identifica vulnerabilidades e movimentações. | efeito de Suporte sem resolução definida pelo motor; depende de espaço, alcance, ambiente ou posicionamento não modelado | Pendente |
| Aves corredoras e campestres | Chute de Ema | Físico | Golpe de perna que afasta o adversário. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Aves corredoras e campestres | Patada Predatória | Físico | Ataque rápido com as patas que pode interromper ou desestabilizar o alvo. | regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Aves corredoras e campestres | Chamado de Advertência | Especial | Emite sinal de alerta que prepara aliados para uma ameaça. | regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Aves corredoras e campestres | Arrancada Instintiva | Suporte | Deslocamento explosivo para aproximar-se ou escapar. | efeito de Suporte sem resolução definida pelo motor | Pendente |
| Aves aquáticas e pernaltas | Bico de Tuiuiú | Físico | Ataque pontual com o bico, direcionado a um ponto vulnerável. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Aves aquáticas e pernaltas | Pescaria Precisa | Suporte | Calcula o momento ideal para capturar alvo ou objeto em movimento. | efeito de Suporte sem resolução definida pelo motor | Pendente |
| Aves aquáticas e pernaltas | Chamado do Bando | Especial | Coordena aliados e facilita a reação conjunta. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Aves aquáticas e pernaltas | Plumagem Impermeável | Suporte | Reduz prejuízos causados por água e favorece a movimentação em áreas alagadas. | efeito de Suporte sem resolução definida pelo motor; regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Psitacídeos | Bico Poderoso | Físico | Mordida forte que pode comprometer proteções frágeis. | regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Psitacídeos | Bicada Desestabilizadora | Físico | Ataque rápido que desequilibra o alvo. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Psitacídeos | Vocalização Imitativa | Especial | Imita sons para confundir ou distrair adversários. | regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Psitacídeos | Comunicação Inteligente | Suporte | Transmite informações táticas aos aliados. | efeito de Suporte sem resolução definida pelo motor | Pendente |
| Serpentes | Bote de Jararaca | Especial | Ataque rápido que aplica envenenamento. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Serpentes | Constrição | Físico | Envolve o alvo e restringe seus movimentos. | regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Serpentes | Peçonha Concentrada | Especial | Aplica dose concentrada de peçonha, intensificando o efeito nocivo. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Serpentes | Camuflagem | Suporte | Reduz a percepção da Nativa pelo adversário e prepara ação surpresa. | efeito de Suporte sem resolução definida pelo motor; regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Lagartos | Fuga Caudal | Suporte | Utiliza a cauda como distração para facilitar fuga ou reposicionamento. | efeito de Suporte sem resolução definida pelo motor | Pendente |
| Lagartos | Cauda Chicote | Físico | Golpeia o adversário com a cauda, causando impacto e afastamento. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Lagartos | Mordida de Lagarto | Físico | Mordida direta que causa dano e mantém pressão sobre o alvo. | depende de espaço, alcance, ambiente ou posicionamento não modelado | Pendente |
| Lagartos | Ameaça Visual | Especial | Exibe postura e sinais corporais para intimidar ou distrair. | regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Quelônios | Recolhimento Defensivo | Suporte | Recolhe partes vulneráveis do corpo e reduz exposição a ataques. | efeito de Suporte sem resolução definida pelo motor; regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Quelônios | Impacto de Casco | Físico | Colide com o adversário utilizando o casco. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Quelônios | Mordida de Casco | Físico | Mordida forte que pode prender o adversário. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Quelônios | Vocalização de Defesa | Especial | Emite som de advertência que dificulta a aproximação. | regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Crocodilianos | Giro Mortal | Físico | Agarra o alvo e realiza rotação violenta, causando dano e dificultando recuperação. | regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Crocodilianos | Mordida de Emboscada | Físico | Ataque surpresa a partir de posição oculta. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Crocodilianos | Pressão de Mandíbula | Suporte | Mantém mordida de alta pressão e restringe a movimentação do alvo. | efeito de Suporte sem resolução definida pelo motor; regra de estado sem intensidade, gatilho ou duração suficiente; depende de espaço, alcance, ambiente ou posicionamento não modelado | Pendente |
| Crocodilianos | Couraça Escamosa | Suporte | Assume postura defensiva que reduz o impacto de ataques recebidos. | efeito de Suporte sem resolução definida pelo motor; regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Anuros | Secreção Defensiva | Especial | Libera substância nociva que desencoraja ataques de contato. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Anuros | Língua Capturadora | Físico | Projeta a língua para atingir e capturar um alvo. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Anuros | Vocalização Intimidante | Especial | Emite vocalização que confunde ou intimida adversários próximos. | regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Anuros | Pele Úmida | Suporte | Mantém a superfície corporal protegida e favorece adaptação a ambientes úmidos. | efeito de Suporte sem resolução definida pelo motor; depende de espaço, alcance, ambiente ou posicionamento não modelado | Pendente |
| Peixes elétricos | Descarga do Poraquê | Especial | Libera descarga elétrica que causa dano e pode interromper a ação do alvo. | regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Peixes elétricos | Pulso de Alta Voltagem | Especial | Emite descarga em área, atingindo adversários próximos. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Peixes elétricos | Investida Aquática | Físico | Avança rapidamente pela água e colide com o adversário. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Peixes elétricos | Sensibilidade Elétrica | Suporte | Detecta sinais elétricos e identifica presença ou movimentação de criaturas próximas. | efeito de Suporte sem resolução definida pelo motor; regra de estado sem intensidade, gatilho ou duração suficiente; depende de aliados ou múltiplos combatentes ausentes no 1v1 | Pendente |
| Characiformes | Mordida de Piranha | Físico | Mordida agressiva que explora ferimentos existentes. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Characiformes | Frenesi Alimentar | Físico | Executa ataques sucessivos contra um alvo ferido. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Characiformes | Ataque em Cardume | Suporte | Coordena aproximação coletiva e pressão sobre um adversário. | efeito de Suporte sem resolução definida pelo motor | Pendente |
| Characiformes | Descarga de Muco | Especial | Libera substância escorregadia que dificulta contato e movimentação. | regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Siluriformes | Espinhos das Nadadeiras | Físico | Utiliza espinhos para ferir adversário que se aproxima ou tenta agarrar. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Siluriformes | Sucção Poderosa | Físico | Puxa ou prende o alvo por sucção. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Siluriformes | Barbilhões Sensoriais | Especial | Detecta vibrações e sinais químicos no ambiente. | regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Siluriformes | Placas Protetoras | Suporte | Reforça postura defensiva e reduz eficácia de ataques físicos. | efeito de Suporte sem resolução definida pelo motor; regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Peixes cartilaginosos | Percepção do Tubarão-martelo | Especial | Detecta sinais elétricos e movimentações de criaturas próximas. | regra de estado sem intensidade, gatilho ou duração suficiente; depende de aliados ou múltiplos combatentes ausentes no 1v1 | Pendente |
| Peixes cartilaginosos | Investida Subaquática | Físico | Avança em alta velocidade pela água e atinge o adversário. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Peixes cartilaginosos | Mordida Serrilhada | Físico | Mordida que causa ferimentos profundos. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Peixes cartilaginosos | Pele Denticulada | Suporte | Utiliza a textura corporal para dificultar ataques de contato e agarrões. | efeito de Suporte sem resolução definida pelo motor; regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Aracnídeos | Picada Venenosa | Especial | Aplica veneno que causa dano contínuo ou enfraquecimento, conforme a definição final da técnica. | regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Aracnídeos | Pinça de Escorpião | Físico | Prende e golpeia o adversário com as pinças. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Aracnídeos | Teia Imobilizadora | Suporte | Prende o alvo com fios resistentes e restringe suas ações. | efeito de Suporte sem resolução definida pelo motor; regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Aracnídeos | Pelos Urticantes | Especial | Dispersa pelos irritantes que prejudicam aproximação e ação adversária. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Insetos sociais | Fortificação de Montículo | Suporte | Prepara posição defensiva no ambiente. | efeito de Suporte sem resolução definida pelo motor; regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Insetos sociais | Mandíbulas de Operária | Físico | Utiliza mandíbulas para cortar, prender ou transportar. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Insetos sociais | Ácido Defensivo | Especial | Libera substância corrosiva ou irritante para afastar adversários. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Insetos sociais | Comunicação Química | Suporte | Utiliza sinais químicos para transmitir informações e coordenar aliados. | efeito de Suporte sem resolução definida pelo motor | Pendente |
| Insetos predadores | Captura do Louva-a-deus | Físico | Prende o alvo com membros especializados e dificulta sua fuga. | regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Insetos predadores | Mandíbulas Predatórias | Físico | Executa mordida ou corte de precisão, explorando abertura na defesa. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Insetos predadores | Enzimas Digestivas | Especial | Aplica substâncias que degradam ou enfraquecem a proteção do alvo. | regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Insetos predadores | Voo Interceptador | Suporte | Intercepta adversário em deslocamento e pode impedir sua fuga. | efeito de Suporte sem resolução definida pelo motor | Pendente |
| Crustáceos | Pinça Esmagadora | Físico | Prende e comprime o alvo, causando dano e dificultando sua movimentação. | regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
| Crustáceos | Recuo Lateral | Suporte | Executa deslocamento lateral rápido para escapar ou reposicionar-se. | efeito de Suporte sem resolução definida pelo motor | Pendente |
| Crustáceos | Jato Defensivo | Especial | Libera jato de água ou substância para afastar adversário. | parâmetros de dano e acerto ausentes; sem regra adicional detalhada | Pendente |
| Crustáceos | Carapaça Reforçada | Suporte | Assume postura protetora e reduz o impacto de ataques recebidos. | efeito de Suporte sem resolução definida pelo motor; regra de estado sem intensidade, gatilho ou duração suficiente | Pendente |
