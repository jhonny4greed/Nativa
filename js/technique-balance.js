/** Regras internas de balanceamento da V2.1. Não expor PG na interface. */
export const CUSTOS_EFEITOS = Object.freeze([
  ['queimadura','Queimadura','Ofensivo',1,'1 dano ao final do próximo turno','definido'],
  ['sangramento','Sangramento','Ofensivo',1,'1 dano na próxima ação ofensiva','definido'],
  ['envenenamento','Envenenamento','Ofensivo',2,'1 dano ao final dos próximos 2 turnos','definido'],
  ['ferimento-profundo','Ferimento profundo','Ofensivo',1,'+1 dano imediato','definido'],
  ['explosao','Explosão','Ofensivo',2,'+1 dano aos alvos adjacentes','pendente: alvos adjacentes não existem no combate 1v1'],
  ['perseguicao','Perseguição','Ofensivo',0.5,'1 dano se o alvo fugir','pendente: mecânica de fuga não existe'],
  ['escudo','Escudo','Defensivo',1,'Absorve 2 pontos de dano','definido'],
  ['protecao','Proteção','Defensivo',1,'Reduz em 1 o próximo dano recebido','definido'],
  ['resistencia','Resistência','Defensivo',1.5,'Reduz em 1 todo dano recebido até o próximo turno','definido'],
  ['regeneracao','Regeneração','Defensivo',1,'Recupera 1 PV ao final do próximo turno','definido'],
  ['recuperacao-hp','Recuperação','Defensivo',2,'Recupera 2 PV imediatamente','definido'],
  ['purificacao','Purificação','Defensivo',1,'Remove uma condição negativa','definido'],
  ['lentidao','Lentidão','Controle',1,'Reduz AGI em 1 por 1 turno','definido'],
  ['imobilizacao','Imobilização','Controle',2,'Impede movimentação por 1 turno','pendente: não há movimento no combate 1v1'],
  ['atordoamento','Atordoamento','Controle',3,'Impede o uso de golpes no próximo turno','definido'],
  ['silenciamento','Silenciamento','Controle',2,'Impede golpes especiais por 1 turno','definido'],
  ['desorientacao','Desorientação','Controle',1.5,'Adiciona 1 penalidade ao próximo golpe do alvo','definido'],
  ['atracao','Atração','Controle',1.5,'Faz o alvo priorizar o usuário no próximo ataque, se possível','pendente: sem decisão de alvo relevante em 1v1'],
  ['avanco','Avanço','Mobilidade',0.5,'Move até 2 metros após atacar','pendente: sem espaço ou distância'],
  ['recuo','Recuo','Mobilidade',0.5,'Move até 2 metros após atacar','pendente: sem espaço ou distância'],
  ['investida','Investida','Mobilidade',1,'Move até 2 metros antes de atacar','pendente: sem espaço ou distância'],
  ['esquiva-preparada','Esquiva preparada','Estratégia',1,'Reduz em 1 o próximo dano recebido','histórico: descartado, não ativo'],
  ['analise','Análise','Estratégia',0.5,'Revela a menor defesa entre DEF e RES','definido'],
  ['exposicao','Exposição','Estratégia',1.5,'Reduz DEF ou RES em 1 por 1 turno','definido'],
  ['precisao-aprimorada','Precisão aprimorada','Estratégia',1.5,'Reduz em 1 a penalidade do próximo golpe','definido'],
  ['recuperacao-mp','Recuperação de MP','Estratégia',2,'Recupera 1 MP','definido']
].map(([id,nome,grupo,custo,resultado,estado]) => Object.freeze({id,nome,grupo,custo,resultado,estado})));

const custosPorId = new Map(CUSTOS_EFEITOS.map(e => [e.id,e]));
// Alocações diretas ou candidatas explícitas. Uma candidata não torna uma técnica validada.
export const ALOCACOES_EFEITOS_V2_1 = Object.freeze({
  'linhagem-v2-1-felinos-bote-predatorio': [{ efeitoId:'dano-condicional-alvo-nao-agiu', nome:'Dano adicional condicional', custo:1, resultado:'+1 dano se o alvo ainda não realizou sua ação no turno atual', estado:'custo adotado na etapa de parametrização' }],
  'linhagem-v2-1-felinos-garras-perfurantes': [{ efeitoId:'exposicao', estado:'efeito definido; execução pendente no sistema de condições V2.1' }],
  'linhagem-v2-1-canideos-mordida-persistente': [{ efeitoId:'sangramento', chanceAplicacao:0.5, estado:'efeito definido; 50% de chance; execução pendente no sistema de condições V2.1' }],
  'linhagem-v2-1-ungulados-investida-de-grande-porte': [{ efeitoId:'desorientacao', estado:'efeito definido; execução pendente no sistema de condições V2.1' }],
  'linhagem-v2-1-psitacideos-bicada-desestabilizadora': [{ efeitoId:'desorientacao', estado:'efeito definido; execução pendente no sistema de condições V2.1' }],
  'linhagem-v2-1-characiformes-mordida-de-piranha': [{ efeitoId:'dano-condicional-alvo-sangrando', nome:'Dano adicional contra alvo sob Sangramento', custo:0.5, resultado:'+1 dano quando o alvo estiver sob Sangramento', estado:'custo adotado na consolidação; interação aguarda aplicação de Sangramento no combate' }],
  'linhagem-v2-1-peixes-cartilaginosos-mordida-serrilhada': [{ efeitoId:'ferimento-profundo', estado:'efeito definido; execução pendente no sistema de efeitos V2.1' }],
  'linhagem-v2-1-serpentes-bote-de-jararaca': [{ efeitoId:'envenenamento', estado:'efeito-base declarado na descrição' }],
  'linhagem-v2-1-morcegos-pulso-ultrassonico': [{ efeitoId:'desorientacao', estado:'correspondência textual; efeito aplicável não validado' }],
  'linhagem-v2-1-aracnideos-teia-imobilizadora': [{ efeitoId:'imobilizacao', estado:'mecânica espacial inexistente no combate atual' }]
});

export function calcularPGBruto({ P=0, R=0, M=0 }={}) {
  for (const [nome,valor] of Object.entries({P,R,M})) {
    if (!Number.isFinite(valor) || valor < 0) throw new RangeError(`${nome} deve ser um número finito não negativo.`);
  }
  return 2 + 1.5*P + 0.5*R + 0.5*M;
}

export function calcularPGLiquido(pgBruto, custos) {
  if (!Number.isFinite(pgBruto) || !Number.isFinite(custos) || custos < 0) throw new RangeError('PG bruto e custos devem ser números válidos; custos não podem ser negativos.');
  return pgBruto - custos;
}

/** Soma somente efeitos cadastrados; IDs desconhecidos voltam explicitamente pendentes. */
export function calcularCustoEfeitos(ids=[]) {
  const efeitos=[];
  const desconhecidos=[];
  for (const id of ids) {
    const efeito=custosPorId.get(id);
    if (efeito) efeitos.push(efeito); else desconhecidos.push(id);
  }
  return { custoTotal:efeitos.reduce((soma,e)=>soma+e.custo,0), efeitos, desconhecidos,
    estado:desconhecidos.length?'pendente: efeito sem custo cadastrado':'calculado' };
}

export function calcularDanoV21({categoria, atributo, defesa, pgLiquido}) {
  if (categoria === 'Suporte') return { dano:null, estado:'não se aplica: técnica de suporte' };
  const fisico = categoria === 'Físico';
  if (!fisico && categoria !== 'Especial') return { dano:null, estado:'pendente: categoria não reconhecida' };
  if (![atributo,defesa,pgLiquido].every(Number.isFinite)) return { dano:null, estado:'pendente: atributos, defesa ou orçamento ausentes' };
  const bruto = atributo + pgLiquido - defesa;
  if (Math.abs(bruto - Math.round(bruto)) > Number.EPSILON * Math.max(1,Math.abs(bruto)) * 4)
    return { dano:null, valorFracionado:Math.max(0,bruto), estado:'pendente: dano fracionado; não arredondado' };
  return { dano:Math.max(0,bruto), estado:'calculado' };
}

export function auditarTecnicaV21(tecnica) {
  const P=tecnica.P ?? tecnica.parametrosBalanceamento?.P ?? 0;
  const R=tecnica.R ?? tecnica.parametrosBalanceamento?.R ?? 0;
  const M=tecnica.M ?? tecnica.parametrosBalanceamento?.M ?? 0;
  const alocacoes=ALOCACOES_EFEITOS_V2_1[tecnica.id] || [];
  const efeitos=alocacoes.map(a => ({...(custosPorId.get(a.efeitoId) || {}), ...a}));
  const custoConhecido=efeitos.reduce((total,e) => total + (Number.isFinite(e.custo)?e.custo:0),0);
  const efeitosPendentes=efeitos.filter(e => !['efeito-base declarado na descrição','efeito declarado na descrição'].includes(e.estado));
  const suporte=tecnica.categoria === 'Suporte';
  const saldo=calcularPGBruto({P,R,M})-custoConhecido;
  const parametrosPendentes=tecnica.precisao == null || tecnica.mp == null || tecnica.recarga == null;
  const excedeOrcamento=saldo < 0;
  const estado=excedeOrcamento ? 'revisão: custos excedem orçamento'
    : parametrosPendentes || efeitosPendentes.length || (efeitos.length===0) || (!suporte && !tecnica.dano)
      ? 'pendente de validação individual' : 'referência calculada';
  return {id:tecnica.id, P,R,M, parametrosBaseProvisorios:!tecnica.parametrosBalanceamento, pgBruto:calcularPGBruto({P,R,M}),
    efeitos, custoConhecido, pgLiquidoProvisorio:saldo, pgLiquidoFinal:estado==='referência calculada'?saldo:null,
    excedeOrcamento, saldoSemDestinacao:suporte?saldo:null, danoAutomatico:false, efeitosPendentes:efeitosPendentes.map(e=>e.efeitoId), estado};
}

export function efeitoV21PorId(id) { return custosPorId.get(id) || null; }
