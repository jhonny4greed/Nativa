// js/techniques.js
// Formato: nome, categoria, precisão, MP, recarga, PG, dano, efeito, status.
import { obterTracoPorId } from "./traits.js";
import { TECNICAS_LINHAGEM_V2_1 } from "./techniques-v2-1.js";

const criar = (
  origem, grupo, registros, statusPadrao = "MANTIDA"
) => registros.map(([nome, categoria, precisao, mp, recarga, pg, dano, efeito, status]) => ({
  id: `${origem}-${grupo}-${nome}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-"),
  nome,
  origem,
  grupo,
  categoria,
  precisao,
  mp,
  recarga,
  pg,
  dano,
  efeito,
  status: status || statusPadrao
}));

const linhagem = [
  ...criar("linhagem", "Felinos", [
    ["Bote Predatório", "Físico", -2, 1, 1, 4.5, 3, "+1 dano se o alvo ainda não tiver agido no turno."],
    ["Mordida Dominante", "Físico", -3, 2, 2, 7, 5, "Reduz DEF do alvo em 1 até o próximo turno."],
    ["Garras Perfurantes", "Físico", -2, 1, 1, 4.5, 3, "Reduz DEF do alvo em 1 até o próximo turno."],
    ["Caçada Silenciosa", "Suporte", null, 1, 1, 3, null, "Prepara uma emboscada: próximo ataque recebe +1 precisão e +1 dano se o alvo não percebeu a aproximação.", "REVISADA"]
  ]),
  ...criar("linhagem", "Canídeos", [
    ["Mordida Persistente", "Físico", -2, 1, 2, 5, 3, "Sangramento: 1 dano ao final do próximo turno do alvo."],
    ["Investida de Matilha", "Físico", -2, 1, 1, 4.5, 3, "+1 dano se houver um aliado próximo."],
    ["Faro Aguçado", "Suporte", null, 1, 1, 3, null, "Detecta rastros ou adversários ocultos; concede +1 precisão no próximo ataque contra alvo detectado."],
    ["Perseguição Incansável", "Físico", -2, 1, 1, 4.5, 2, "Avança até 2 m em direção a alvo em fuga; nessa situação, causa +1 dano.", "REVISADA"]
  ]),
  ...criar("linhagem", "Mustelídeos", [
    ["Agarrão Aquático", "Físico", -2, 2, 2, 5.5, 2, "Imobiliza o alvo por 1 turno e reduz ATQ em 1."],
    ["Mordida de Fixação", "Físico", -2, 1, 2, 5, 3, "Prende o alvo e reduz DEF em 1 até o próximo turno."],
    ["Nado Ágil", "Suporte", null, 1, 2, 3.5, null, "Recebe +1 AGI até o próximo turno e melhora o deslocamento em ambiente aquático."],
    ["Investida Coordenada", "Físico", -2, 1, 2, 5, 3, "+1 dano se houver um aliado próximo no momento do ataque.", "REVISADA"]
  ]),
  ...criar("linhagem", "Procionídeos", [
    ["Golpe Oportunista", "Físico", -1, 1, 1, 3, 2, "+1 dano contra alvo que já tenha agido no turno."],
    ["Busca por Recursos", "Suporte", null, 1, 2, 3.5, null, "Localiza ou identifica recursos e objetos úteis no ambiente."],
    ["Patada Habilidosa", "Físico", -2, 2, 2, 5.5, 3, "Pode desestabilizar o alvo ou tentar derrubar um item que esteja segurando.", "REVISADA"],
    ["Manipulação Precisa", "Suporte", null, 1, 1, 3, null, "Manipula objetos e elementos do ambiente para resolver situações práticas.", "REVISADA"]
  ]),
  ...criar("linhagem", "Roedores", [
    ["Incisivos Poderosos", "Físico", -3, 2, 1, 6.5, 5, "Reduz DEF do alvo em 1 até o próximo turno."],
    ["Escavação Repentina", "Suporte", null, 2, 2, 4, null, "Fica oculto até o próximo turno; pode reposicionar-se e recebe +1 precisão no próximo ataque."],
    ["Alerta Coletivo", "Suporte", null, 2, 2, 4, null, "Até dois aliados recebem +1 precisão no próximo ataque."]
  ]),
  ...criar("linhagem", "Marsupiais", [
    ["Falsa Rendição", "Suporte", null, 2, 2, 4, null, "Finge vulnerabilidade e impõe -1 precisão à próxima técnica do adversário."],
    ["Resistência Instintiva", "Suporte", null, 2, 2, 4, null, "Reduz em 2 o próximo dano recebido."],
    ["Investida Noturna", "Físico", -2, 1, 2, 5, 2, "Move até 2 m e recebe +1 precisão no ataque em condições de baixa visibilidade.", "REVISADA"]
  ]),
  ...criar("linhagem", "Primatas", [
    ["Arremesso Improvisado", "Físico", -2, 1, 1, 4.5, 3, "Impõe -1 precisão à próxima técnica do alvo."],
    ["Manipulação Precisa", "Suporte", null, 1, 1, 3, null, "Usa objetos ou ferramentas simples e manipula elementos do ambiente."],
    ["Vocalização de Alerta", "Suporte", null, 1, 1, 3, null, "Alerta sobre perigo próximo e concede proteção 1 contra o próximo dano de um aliado."],
    ["Golpe Acrobático", "Físico", -3, 2, 2, 7, 4, "Permite deslocamento de até 2 m durante a execução do ataque.", "REVISADA"]
  ]),
  ...criar("linhagem", "Morcegos", [
    ["Mordida Hematófaga", "Físico", -2, 1, 2, 5, 2, "Recupera 1 HP ao causar dano."],
    ["Ecolocalização", "Suporte", null, 2, 2, 4, null, "Detecta adversários ocultos e concede +1 precisão no próximo ataque contra um deles."],
    ["Voo Errático", "Suporte", null, 1, 1, 3, null, "Altera a trajetória em voo e permite reposicionamento aéreo de até 3 m.", "REVISADA"],
    ["Investida Noturna", "Físico", -3, 2, 2, 7, 4, "Aproxima-se até 2 m antes do ataque; causa +1 dano se o alvo não percebeu a aproximação.", "REVISADA"]
  ]),
  ...criar("linhagem", "Xenartros", [
    ["Garras Escavadoras", "Físico", -2, 1, 1, 4.5, 3, "Reduz DEF do alvo em 1 até o próximo turno."],
    ["Couraça Natural", "Suporte", null, 1, 2, 3.5, null, "Reduz em 2 o próximo dano físico recebido."],
    ["Garra de Fixação", "Suporte", null, 1, 1, 3, null, "Prende-se a uma superfície ou, conforme espécie e situação, impede o movimento do alvo por 1 turno.", "REVISADA"],
    ["Defesa Compacta", "Suporte", null, 1, 2, 3.5, null, "Adota postura defensiva e reduz em 2 o próximo dano físico recebido.", "REVISADA"]
  ]),
  ...criar("linhagem", "Ungulados", [
    ["Pisoteio Pesado", "Físico", -3, 2, 2, 7, 6, "Empurra o alvo em até 2 m após o impacto."],
    ["Defesa de Manada", "Suporte", null, 2, 2, 4, null, "Concede +1 DEF até o próximo turno a até dois aliados próximos; requer comportamento coletivo compatível."],
    ["Investida Poderosa", "Físico", -2, 1, 1, 4.5, 3, "+1 dano se o usuário tiver se deslocado antes do ataque.", "REVISADA"],
    ["Arrancada Muscular", "Físico", -1, 1, 1, 3, 2, "Permite avançar até 2 m antes do ataque.", "REVISADA"]
  ]),
  ...criar("linhagem", "Aves de rapina", [
    ["Mergulho Predatório", "Físico", -3, 2, 2, 7, 5, "+1 dano contra alvo que não percebeu a aproximação."],
    ["Garras Perfurantes", "Físico", -2, 1, 1, 4.5, 3, "Aplica sangramento: 1 dano ao final do próximo turno do alvo."],
    ["Visão Aguçada", "Suporte", null, 1, 1, 3, null, "Detecta adversários ocultos ou identifica características relevantes do alvo."],
    ["Ascensão Aérea", "Suporte", null, 2, 2, 4, null, "Obtém posicionamento aéreo e ignora obstáculos terrestres durante o movimento até o próximo turno.", "REVISADA"]
  ]),
  ...criar("linhagem", "Aves corredoras e campestres", [
    ["Chute Poderoso", "Físico", -3, 2, 1, 6.5, 6, "Empurra o alvo em até 1 m."],
    ["Arrancada Terrestre", "Físico", -2, 1, 1, 4.5, 2, "Avança até 2 m antes do ataque; após o avanço, recebe +1 dano."],
    ["Bicada de Impacto", "Físico", -1, 0, 0, 2, 1, "+1 dano contra alvo que já sofreu dano durante o turno.", "REVISADA"],
    ["Passos Velozes", "Físico", -1, 0, 0, 2, 1, "Move até 2 m antes de realizar o ataque.", "REVISADA"]
  ]),
  ...criar("linhagem", "Aves aquáticas e pernaltas", [
    ["Bico Arpoador", "Físico", -2, 2, 2, 5.5, 3, "Reduz DEF do alvo em 1 até o próximo turno."],
    ["Pesca Precisa", "Físico", -1, 1, 1, 3, 2, "+1 dano ao atacar em ambiente aquático ou próximo à superfície da água."],
    ["Asas Protetoras", "Suporte", null, 2, 2, 4, null, "Reduz em 2 o próximo dano recebido por um aliado e permite aproximar-se dele em até 2 m."],
    ["Golpe de Asa", "Físico", -1, 0, 0, 2, 1, "Reduz ATQ do alvo em 1 até o próximo turno.", "REVISADA"]
  ]),
  ...criar("linhagem", "Psitacídeos", [
    ["Bico Poderoso", "Físico", -2, 1, 1, 4.5, 4, "Sem efeito adicional; concentra o orçamento no dano."],
    ["Vocalização Imitativa", "Suporte", null, 1, 2, 3.5, null, "Pode atrair ou confundir o alvo e impõe -1 precisão à próxima técnica dele."],
    ["Bicada Desestabilizadora", "Físico", -1, 0, 0, 2, 1, "Impõe -1 precisão à próxima técnica do alvo.", "REVISADA"],
    ["Chamado de Alerta", "Suporte", null, 0, 0, 2, null, "Concede proteção 1 contra o próximo dano recebido por um aliado ou por si em combate solo.", "REVISADA"]
  ]),
  ...criar("linhagem", "Serpentes", [
    ["Bote Serpentino", "Físico", -3, 2, 2, 7, 5, "+1 dano se o alvo não percebeu a aproximação."],
    ["Constrição", "Físico", -2, 2, 2, 5.5, 2, "Impede movimento por 1 turno e reduz ATQ do alvo em 1."],
    ["Peçonha", "Especial", -2, 2, 2, 5.5, 2, "Veneno: 1 dano ao final de cada um dos próximos 2 turnos; reduz ATQ em 1."],
    ["Emboscada Silenciosa", "Suporte", null, 0, 1, 2.5, null, "Se ainda não atacou no combate, prepara a emboscada e concede +1 precisão ao próximo ataque.", "REVISADA"]
  ]),
  ...criar("linhagem", "Lagartos", [
    ["Cauda Chicote", "Físico", -2, 1, 1, 4.5, 3, "Impõe -1 precisão à próxima técnica do alvo."],
    ["Mordida de Teiú", "Físico", -3, 2, 1, 6.5, 5, "Aplica sangramento: 1 dano ao final do próximo turno do alvo."],
    ["Regeneração Caudal", "Suporte", null, 2, 2, 4, null, "Remove imobilização e permite recuar até 2 m."],
    ["Escalada Ágil", "Suporte", null, 1, 1, 3, null, "Atravessa obstáculos verticais ou terrenos difíceis durante o movimento até o próximo turno.", "REVISADA"]
  ]),
  ...criar("linhagem", "Quelônios", [
    ["Impacto de Casco", "Físico", -2, 1, 1, 4.5, 4, "Empurra o alvo em até 2 m."],
    ["Recolhimento Natural", "Suporte", null, 1, 2, 3.5, null, "Reduz em 2 o próximo dano físico recebido."],
    ["Defesa Reforçada", "Suporte", null, 1, 2, 3.5, null, "Recebe +1 DEF até o próximo turno.", "REVISADA"]
  ]),
  ...criar("linhagem", "Crocodilianos", [
    ["Mordida de Emboscada", "Físico", -3, 2, 2, 7, 5, "+1 dano contra alvo que não percebeu o ataque."],
    ["Giro Mortal", "Físico", -3, 2, 2, 7, 4, "Imobiliza o alvo por 1 turno e reduz ATQ em 1."],
    ["Imersão Repentina", "Suporte", null, 1, 2, 3.5, null, "Permanece oculto até o próximo turno, pode reposicionar-se até 2 m e recebe +1 precisão no próximo ataque."],
    ["Couraça Escamosa", "Suporte", null, 1, 1, 3, null, "Reduz em 2 o próximo dano físico recebido.", "REVISADA"]
  ]),
  ...criar("linhagem", "Anuros", [
    ["Língua Capturadora", "Físico", -2, 1, 1, 4.5, 2, "Puxa o alvo em até 2 m."],
    ["Secreção Defensiva", "Suporte", null, 1, 2, 3.5, null, "Impõe -1 precisão à próxima técnica do alvo e reduz ATQ em 1."],
    ["Vocalização Intimidante", "Suporte", null, 1, 1, 3, null, "Reduz ATQ em 1 e impõe -1 precisão à próxima técnica do alvo."],
    ["Salto Muscular", "Suporte", null, 0, 1, 2.5, null, "Move até 3 m em um único deslocamento.", "REVISADA"]
  ]),
  ...criar("linhagem", "Peixes elétricos", [
    ["Descarga Elétrica", "Especial", -2, 2, 2, 5.5, 3, "Reduz ATQ em 1 e impõe -1 precisão à próxima técnica do alvo."],
    ["Pulso de Alta Voltagem", "Especial", -3, 2, 2, 7, 5, "Reduz ATQ do alvo em 1 até o próximo turno."],
    ["Sensibilidade Elétrica", "Suporte", null, 1, 1, 3, null, "Detecta presença e posição de adversários próximos por estímulos elétricos."],
    ["Campo Elétrico", "Suporte", null, 1, 1, 3, null, "Revela a posição de adversários ocultos ou camuflados durante o próximo turno.", "REVISADA"]
  ]),
  ...criar("linhagem", "Characiformes", [
    ["Mordida Voraz", "Físico", -2, 2, 1, 5, 4, "+1 dano contra alvo abaixo da metade dos HP."],
    ["Frenesi Alimentar", "Físico", -3, 2, 2, 7, 4, "+2 dano contra alvo que já sofreu dano durante o turno."],
    ["Ataque em Cardume", "Físico", -2, 1, 1, 4.5, 2, "+2 dano se um aliado também atacar o mesmo alvo durante o turno."],
    ["Investida de Correnteza", "Físico", -1, 0, 0, 2, 1, "+1 dano se executada em ambiente aquático com correnteza.", "REVISADA"]
  ]),
  ...criar("linhagem", "Siluriformes", [
    ["Ferrão Defensivo", "Físico", -2, 1, 1, 4.5, 3, "Reduz ATQ do alvo em 1 até o próximo turno."],
    ["Barbilhões Sensoriais", "Suporte", null, 1, 1, 3, null, "Detecta alvos próximos ocultos e concede +1 precisão ao próximo ataque contra um deles."],
    ["Sucção Poderosa", "Físico", -2, 2, 2, 5.5, 3, "Impede o movimento do alvo por 1 turno."],
    ["Escamas Protetoras", "Suporte", null, 1, 2, 3.5, null, "Reduz em 1 o próximo dano físico e em 1 o próximo dano especial.", "REVISADA"]
  ]),
  ...criar("linhagem", "Peixes cartilaginosos", [
    ["Espinho Venenoso", "Especial", -2, 2, 2, 5.5, 2, "Veneno: 1 dano ao final de cada um dos próximos 2 turnos e reduz ATQ em 1."],
    ["Investida Subaquática", "Físico", -3, 2, 2, 7, 5, "+1 dano se executada em ambiente aquático."],
    ["Percepção de Movimento", "Suporte", null, 1, 2, 3.5, null, "Identifica deslocamentos do alvo e concede +1 precisão ao próximo ataque contra ele."],
    ["Enterramento", "Suporte", null, 1, 1, 3, null, "Permanece oculto até o próximo turno e recebe +1 precisão no próximo ataque.", "REVISADA"]
  ]),
  ...criar("linhagem", "Aracnídeos", [
    ["Picada Venenosa", "Físico", -2, 2, 2, 5.5, 3, "Veneno: 1 dano ao final de cada um dos próximos 2 turnos."],
    ["Teia Imobilizadora", "Suporte", null, 2, 2, 4, null, "Impede o movimento do alvo por 1 turno."],
    ["Pinça de Escorpião", "Físico", -2, 1, 1, 4.5, 2, "Reduz ATQ do alvo em 1 até o próximo turno."],
    ["Emboscada Tecelã", "Físico", -2, 1, 1, 4.5, 3, "Recebe +1 precisão contra alvos imobilizados.", "REVISADA"]
  ]),
  ...criar("linhagem", "Insetos sociais", [
    ["Ferrão Defensivo", "Físico", -2, 1, 1, 4.5, 3, "Reduz ATQ do alvo em 1 até o próximo turno."],
    ["Ataque Coordenado", "Físico", -2, 1, 1, 4.5, 3, "+1 dano se um aliado já atacou o alvo durante o turno."],
    ["Defesa de Colônia", "Suporte", null, 1, 2, 3.5, null, "Reduz em 2 o próximo dano recebido por um aliado.", "REVISADA"],
    ["Comunicação Química", "Suporte", null, 2, 2, 4, null, "Marca um adversário; até dois aliados recebem +1 precisão contra ele até o próximo turno.", "REVISADA"]
  ]),
  ...criar("linhagem", "Insetos predadores", [
    ["Captura Relâmpago", "Físico", -1, 1, 1, 3, 3, "Captura rápida, sem efeito adicional."],
    ["Mandíbulas Predatórias", "Físico", -2, 2, 2, 5.5, 5, "Ataque de alto impacto, sem efeito adicional."],
    ["Reflexos Predatórios", "Suporte", null, 1, 1, 3, null, "O próximo ataque recebe +1 precisão contra adversário que já atacou no turno.", "REVISADA"],
    ["Observação de Caça", "Suporte", null, 0, 0, 2, null, "Revela se a menor defesa do alvo é DEF ou RES.", "REVISADA"]
  ]),
  ...criar("linhagem", "Crustáceos", [
    ["Pinça Esmagadora", "Físico", -1, 1, 1, 3, 3, "Ataque direto de pinça, sem efeito adicional."],
    ["Pinça de Ruptura", "Físico", -2, 2, 2, 5.5, 4, "Reduz DEF do alvo em 1 até o próximo turno."],
    ["Carapaça Reforçada", "Suporte", null, 0, 0, 2, null, "Reduz em 2 o próximo dano físico recebido."],
    ["Recuo Lateral", "Suporte", null, 0, 1, 2.5, null, "Move até 2 m lateralmente após um ataque."]
  ])
];

const bioma = [
  ...criar("bioma", "Floresta e Mata", [
    ["Bote de Emboscada", "Físico", -2, 1, 1, 4.5, 3, "+1 dano se agir antes do alvo."],
    ["Camuflagem de Folhas", "Suporte", null, 2, 2, 4, null, "Reduz em 2 o próximo dano recebido."],
    ["Salto entre Galhos", "Suporte", null, 1, 1, 3, null, "Aumenta AGI efetiva em 2 até o próximo turno.", "REVISADA"],
    ["Garras de Tronco", "Físico", -2, 1, 1, 4.5, 3, "Reduz DEF do alvo em 1 até o próximo turno.", "REVISADA"]
  ]),
  ...criar("bioma", "Rios, Lagos e Pantanal", [
    ["Mergulho Repentino", "Suporte", null, 2, 2, 4, null, "Reduz em 3 o próximo dano recebido; não acumula com outra proteção."],
    ["Agarrão de Margem", "Físico", -2, 1, 1, 4.5, 3, "Reduz AGI do alvo em 1 até o próximo turno."],
    ["Investida Ribeirinha", "Físico", -2, 1, 1, 4.5, 3, "Recebe +1 AGI durante o turno em ambiente aquático.", "REVISADA"],
    ["Caça na Superfície", "Físico", -2, 1, 1, 4.5, 3, "Recebe +1 precisão contra alvos com AGI reduzida.", "REVISADA"]
  ]),
  ...criar("bioma", "Caatinga e Cerrado", [
    ["Arrancada Seca", "Físico", -1, 1, 1, 3, 2, "Avança até 2 m antes do ataque."],
    ["Resistência ao Calor", "Suporte", null, 1, 2, 3.5, null, "Reduz em 2 o próximo dano de Fogo recebido."],
    ["Chifrada de Campo", "Físico", -2, 1, 1, 4.5, 3, "+1 dano se o usuário tiver se deslocado antes do ataque.", "REVISADA"],
    ["Refúgio entre Arbustos", "Suporte", null, 1, 2, 3.5, null, "Reduz em 2 o próximo dano físico recebido.", "REVISADA"]
  ]),
  ...criar("bioma", "Costa, Restinga e Manguezal", [
    ["Investida de Maré", "Físico", -3, 2, 2, 7, 5, "Empurra o alvo em até 1 m."],
    ["Pinça de Mangue", "Físico", -2, 1, 2, 5, 3, "Reduz AGI do alvo em 1 até o próximo turno."],
    ["Salto de Duna", "Suporte", null, 1, 1, 3, null, "Move até 2 m depois de atacar.", "REVISADA"],
    ["Casco Salino", "Suporte", null, 1, 2, 3.5, null, "Reduz em 2 o próximo dano especial recebido.", "REVISADA"]
  ])
];

const arquetipo = [
  ...criar("arquetipo", "Predador", [
    ["Golpe de Oportunidade", "Físico", -2, 1, 1, 4.5, 3, "+1 dano se o alvo já tiver agido no turno."],
    ["Mordida de Fixação", "Físico", -2, 1, 2, 5, 3, "Reduz DEF do alvo em 1 até o próximo turno.", "REVISADA"],
    ["Perseguição Implacável", "Suporte", null, 1, 2, 3.5, null, "Recebe +1 AGI quando o alvo estiver abaixo da metade dos HP.", "REVISADA"],
    ["Finalização Precisa", "Físico", -1, 2, 2, 4, 4, "Sem efeito adicional; concentra o orçamento no dano."]
  ]),
  ...criar("arquetipo", "Guardião", [
    ["Postura de Fortaleza", "Suporte", null, 2, 2, 4, null, "Reduz em 2 o próximo dano recebido e concede +1 DEF até o próximo turno."],
    ["Interposição", "Suporte", null, 2, 2, 4, null, "Reduz em 3 o próximo dano recebido por um aliado.", "REVISADA"],
    ["Contra-Impacto", "Físico", -3, 2, 1, 6.5, 4, "+2 dano se o usuário já sofreu dano durante o turno.", "REVISADA"],
    ["Casca Reforçada", "Suporte", null, 1, 2, 3.5, null, "Reduz em 2 o próximo dano recebido."]
  ]),
  ...criar("arquetipo", "Veloz", [
    ["Ataque Relâmpago", "Físico", -2, 1, 1, 4.5, 3, "Recebe +1 AGI para determinar a ordem de ação no turno."],
    ["Zigue-Zague", "Suporte", null, 1, 1, 3, null, "Impõe -1 precisão à próxima técnica do adversário.", "REVISADA"],
    ["Sequência Rápida", "Físico", -2, 2, 2, 5.5, "2+2", "Executa dois ataques separados, cada um com dano 2."],
    ["Retirada Tática", "Suporte", null, 1, 1, 3, null, "Move até 2 m depois de atacar; não concede proteção adicional.", "REVISADA"]
  ]),
  ...criar("arquetipo", "Canalizador", [
    ["Foco Interno", "Suporte", null, 2, 2, 4, null, "Aumenta em 1 a POT do próximo golpe especial."],
    ["Leitura de Movimento", "Suporte", null, 1, 1, 3, null, "Revela se o maior atributo ofensivo do alvo é ATQ ou POT.", "REVISADA"],
    ["Adaptação Rápida", "Suporte", null, 2, 2, 4, null, "Concede +1 DEF ou +1 RES até o próximo turno, conforme o último tipo de ataque recebido."],
    ["Ritmo Recuperado", "Suporte", null, 0, 3, 3.5, null, "Recupera 2 MP; não pode ser usado com MP cheio. Efeito acima do orçamento provisório; pendente de auditoria.", "REVISADA"]
  ])
];

const afinidade = [
  ...criar("afinidade", "Fogo", [
    ["Brasa de Arranque", "Físico", -1, 0, 0, 2, 2, "Ataque básico confiável, sem efeito adicional.", "CANDIDATA — STATUS A CONFIRMAR"],
    ["Mordida Incandescente", "Físico", -2, 1, 1, 4.5, 3, "Queimadura: 1 dano ao final do próximo turno do alvo.", "CANDIDATA — STATUS A CONFIRMAR"],
    ["Jato de Labaredas", "Especial", -2, 2, 1, 5, 4, "Ataque especial à distância; não depende de contato corporal.", "CANDIDATA — STATUS A CONFIRMAR"],
    ["Explosão de Cinzas", "Especial", -3, 2, 2, 7, 4, "Impõe -1 precisão à próxima técnica do alvo.", "CANDIDATA — STATUS A CONFIRMAR"],
    ["Passo de Fagulhas", "Físico", -1, 1, 2, 3.5, 1, "Depois de acertar, aumenta AGI em 1 até o próximo turno.", "CANDIDATA — STATUS A CONFIRMAR"],
    ["Sol do Meio-Dia", "Especial", -3, 2, 2, 7, 6, "Golpe forte, sem efeito adicional.", "CANDIDATA — STATUS A CONFIRMAR"]
  ]),
  ...criar("afinidade", "Água", [
    ["Jato Direto", "Especial", -1, 0, 0, 2, 2, "Ataque especial básico à distância, sem efeito adicional.", "CANDIDATA — STATUS A CONFIRMAR"],
    ["Cauda de Maré", "Físico", -2, 1, 1, 4.5, 3, "Reduz ATQ do alvo em 1 na próxima técnica.", "CANDIDATA — STATUS A CONFIRMAR"],
    ["Redemoinho", "Especial", -2, 2, 2, 5.5, 3, "Reduz AGI do alvo em 1 até o próximo turno.", "CANDIDATA — STATUS A CONFIRMAR"],
    ["Prisão de Bolhas", "Especial", -2, 2, 2, 5.5, 2, "Impede o alvo de receber bônus de AGI no próximo turno.", "CANDIDATA — STATUS A CONFIRMAR"],
    ["Impacto de Correnteza", "Físico", -3, 2, 2, 7, 5, "Causa +1 dano contra alvos que já estejam com AGI reduzida.", "CANDIDATA — STATUS A CONFIRMAR"],
    ["Onda Abissal", "Especial", -3, 2, 2, 7, 6, "Golpe especial forte, sem efeito adicional.", "CANDIDATA — STATUS A CONFIRMAR"]
  ]),
  ...criar("afinidade", "Terra", [
    ["Pedra Arremessada", "Físico", -1, 0, 0, 2, 2, "Ataque básico, sem efeito adicional.", "CANDIDATA — STATUS A CONFIRMAR"],
    ["Garra de Barro", "Físico", -2, 1, 1, 4.5, 3, "Reduz AGI do alvo em 1 até o próximo turno.", "CANDIDATA — STATUS A CONFIRMAR"],
    ["Muralha Súbita", "Suporte", null, 2, 2, 4, null, "Reduz em 2 o próximo dano recebido.", "CANDIDATA — STATUS A CONFIRMAR"],
    ["Tremor Localizado", "Físico", -2, 2, 1, 5, 3, "Impõe -1 precisão à próxima técnica do alvo.", "CANDIDATA — STATUS A CONFIRMAR"],
    ["Estilhaço Mineral", "Físico", -2, 2, 2, 5.5, 5, "Dano elevado, sem efeito adicional.", "CANDIDATA — STATUS A CONFIRMAR"],
    ["Colosso de Rocha", "Físico", -3, 2, 2, 7, 6, "Golpe físico pesado, sem efeito adicional.", "CANDIDATA — STATUS A CONFIRMAR"]
  ]),
  ...criar("afinidade", "Vento", [
    ["Corte de Ar", "Físico", -1, 0, 0, 2, 2, "Ataque básico, sem efeito adicional.", "CANDIDATA — STATUS A CONFIRMAR"],
    ["Rasante", "Físico", -1, 1, 2, 3.5, 2, "Recebe +1 AGI para determinar a ordem de ação no turno.", "CANDIDATA — STATUS A CONFIRMAR"],
    ["Rajada Desviadora", "Especial", -2, 1, 1, 4.5, 3, "Impõe -1 precisão à próxima técnica do alvo.", "CANDIDATA — STATUS A CONFIRMAR"],
    ["Passo de Vendaval", "Suporte", null, 1, 2, 3.5, null, "Concede +1 AGI até o próximo turno.", "CANDIDATA — STATUS A CONFIRMAR"],
    ["Lâminas de Turbilhão", "Especial", -2, 2, 2, 5.5, 3, "Causa 1 dano adicional ao final do próximo turno do alvo.", "CANDIDATA — STATUS A CONFIRMAR"],
    ["Furacão Ascendente", "Especial", -3, 2, 2, 7, 6, "Golpe especial forte, sem efeito adicional.", "CANDIDATA — STATUS A CONFIRMAR"]
  ]),
  ...criar("afinidade", "Energia", [
    ["Pulso Luminoso", "Especial", -1, 0, 0, 2, 2, "Ataque especial básico, sem efeito adicional.", "CANDIDATA — STATUS A CONFIRMAR"],
    ["Arco de Impacto", "Especial", -2, 1, 1, 4.5, 3, "Reduz POT do alvo em 1 na próxima técnica especial.", "CANDIDATA — STATUS A CONFIRMAR"],
    ["Carga Instável", "Especial", -3, 2, 1, 6.5, 6, "O usuário sofre -1 precisão na próxima técnica executada.", "CANDIDATA — STATUS A CONFIRMAR"],
    ["Campo Vibrante", "Suporte", null, 2, 2, 4, null, "Reduz em 1 turno a duração do primeiro efeito negativo recebido até o próximo turno.", "CANDIDATA — STATUS A CONFIRMAR"],
    ["Descarga em Cadeia", "Especial", -2, 2, 2, 5.5, 3, "+1 dano se o alvo já estiver afetado por uma condição negativa.", "CANDIDATA — STATUS A CONFIRMAR"],
    ["Ruptura de Núcleo", "Especial", -3, 2, 2, 7, 6, "Golpe especial de alto impacto, sem efeito adicional.", "CANDIDATA — STATUS A CONFIRMAR"]
  ])
];

export const TECNICAS_V1_ARQUIVO = linhagem.map(tecnica => ({ ...tecnica, versao: "1.0", estadoCatalogo: "arquivado" }));
export const TECNICAS_ARQUETIPO_LEGADO = arquetipo
  .filter(tecnica => tecnica.grupo === "Veloz")
  .map(tecnica => ({ ...tecnica, versao: "legado", estadoCatalogo: "arquivado" }));

export const TECNICAS = [
  ...TECNICAS_LINHAGEM_V2_1,
  ...bioma,
  ...arquetipo.filter(tecnica => tecnica.grupo !== "Veloz"),
  ...afinidade
];

export function obterTecnicaPorId(id, { incluirArquivo = true } = {}) {
  return TECNICAS.find(tecnica => tecnica.id === id)
    || (incluirArquivo ? TECNICAS_V1_ARQUIVO.find(tecnica => tecnica.id === id) : null)
    || (incluirArquivo ? TECNICAS_ARQUETIPO_LEGADO.find(tecnica => tecnica.id === id) : null)
    || null;
}

// Sinergias são dados opcionais independentes do efeito base e consultam a ficha do usuário.
const sinergia = (tracoId, tipo, valor, descricao) => {
  if (!obterTracoPorId(tracoId)) throw new Error(`ID de Traço inexistente na sinergia: ${tracoId}`);
  return { tracoId, efeito: { tipo, valor }, descricao };
};
const sinergiasPorGolpe = {
  "linhagem-felinos-bote-predatorio": [sinergia("estrutura-natural-1", "bonus_dano", 1, "O bote termina com um corte mais eficaz das garras.")],
  "linhagem-felinos-garras-perfurantes": [sinergia("estrutura-natural-1", "bonus_precisao", 1, "As garras permitem direcionar melhor a perfuração.")],
  "linhagem-canideos-mordida-persistente": [sinergia("estrutura-natural-2", "bonus_dano", 1, "As presas aprofundam a mordida que causa sangramento.")],
  "linhagem-canideos-perseguicao-incansavel": [sinergia("sentido-3", "bonus_precisao", 1, "O faro ajuda a manter a perseguição e alinhar o ataque.")],
  "linhagem-procionideos-patada-habilidosa": [sinergia("estrutura-natural-1", "bonus_precisao", 1, "As garras ajudam a controlar o ponto de contato da patada.")],
  "linhagem-morcegos-investida-noturna": [sinergia("adaptacao-5", "bonus_precisao", 1, "O voo permite ajustar a trajetória da investida.")],
  "linhagem-xenartros-garras-escavadoras": [sinergia("estrutura-natural-1", "bonus_dano", 1, "As garras escavadoras concentram força no golpe.")],
  "linhagem-ungulados-investida-poderosa": [sinergia("estrutura-1", "bonus_precisao", 1, "A postura quadrúpede ajuda a estabilizar a investida.")],
  "linhagem-aves-de-rapina-mergulho-predatorio": [sinergia("adaptacao-5", "bonus_precisao", 1, "O voo melhora o controle da trajetória do mergulho.")],
  "linhagem-aves-de-rapina-garras-perfurantes": [sinergia("estrutura-natural-1", "bonus_dano", 1, "As garras aprofundam o ferimento que provoca sangramento.")],
  "linhagem-aves-aquaticas-e-pernaltas-bico-arpoador": [sinergia("estrutura-natural-4", "bonus_precisao", 1, "O bico especializado ajuda a acertar o ponto de impacto.")],
  "linhagem-psitacideos-bico-poderoso": [sinergia("estrutura-natural-4", "bonus_dano", 1, "O bico forte amplia o impacto da bicada.")],
  "linhagem-serpentes-bote-serpentino": [sinergia("estrutura-natural-2", "bonus_precisao", 1, "As presas ajudam a alinhar o bote de contato.")],
  "linhagem-serpentes-peconha": [sinergia("fisiologia-1", "bonus_precisao", 1, "A estrutura inoculadora ajuda a aplicar a peçonha com precisão.")],
  "linhagem-crocodilianos-mordida-de-emboscada": [sinergia("fisiologia-6", "bonus_dano", 1, "As mandíbulas poderosas reforçam a mordida de emboscada.")],
  "linhagem-peixes-eletricos-descarga-eletrica": [sinergia("fisiologia-4", "bonus_dano", 1, "A descarga elétrica especializada concentra mais energia no golpe.")],
  "linhagem-crustaceos-pinca-esmagadora": [sinergia("estrutura-natural-5", "bonus_dano", 1, "As pinças reforçam o impacto do esmagamento.")],
  "linhagem-crustaceos-pinca-de-ruptura": [sinergia("estrutura-natural-5", "bonus_precisao", 1, "As pinças ajudam a direcionar a pressão contra a defesa.")]
};
for (const tecnica of TECNICAS_V1_ARQUIVO) tecnica.sinergias = sinergiasPorGolpe[tecnica.id] || [];
for (const tecnica of TECNICAS_ARQUETIPO_LEGADO) tecnica.sinergias = sinergiasPorGolpe[tecnica.id] || [];
for (const tecnica of TECNICAS) tecnica.sinergias = sinergiasPorGolpe[tecnica.id] || [];

export const CONTAGEM_TECNICAS = {
  linhagem: TECNICAS_LINHAGEM_V2_1.length,
  linhagemV1Arquivadas: TECNICAS_V1_ARQUIVO.length,
  bioma: bioma.length,
  arquetipo: TECNICAS.filter(tecnica => tecnica.origem === "arquetipo").length,
  afinidade: afinidade.length,
  total: TECNICAS.length
};
