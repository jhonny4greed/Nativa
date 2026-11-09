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
  ['recuperacao-mp','Recuperação de MP','Estratégia',2,'Recupera 1 MP','definido'],
  ['reducao-atq-v21','Redução de ATQ V2.1','Controle',1,'Reduz ATQ em 1 até o fim do próximo turno do alvo','definido'],
  ['reducao-agi-v21','Redução de AGI V2.1','Controle',1,'Reduz AGI em 1 até o fim do próximo turno do alvo','definido'],
  ['bonus-iniciativa-v21','Bônus de iniciativa V2.1','Estratégia',1,'+1 à próxima iniciativa','definido'],
  ['reducao-dano-geral-1-v21','Redução geral 1 V2.1','Defensivo',1,'Reduz em 1 o próximo dano geral','definido'],
  ['reducao-dano-geral-2-v21','Redução geral 2 V2.1','Defensivo',2,'Reduz em 2 o próximo dano geral','definido'],
  ['reducao-dano-fisico-2-v21','Redução física 2 V2.1','Defensivo',2,'Reduz em 2 o próximo dano físico','definido'],
  ['reducao-dano-especial-2-v21','Redução especial 2 V2.1','Defensivo',2,'Reduz em 2 o próximo dano especial','definido'],
  ['bonus-precisao-v21','Bônus de precisão V2.1','Estratégia',1.5,'+1 precisão no próximo golpe ofensivo','definido'],
  ['penalidade-precisao-v21','Penalidade de precisão V2.1','Controle',1.5,'-1 precisão no próximo golpe ofensivo','definido'],
  ['digestao-v21','Digestão V2.1','Ofensivo',1,'1 dano adicional em uma ocorrência','definido'],
  ['dano-reativo-especial-v21','Dano especial reativo V2.1','Defensivo',1,'1 dano especial quando a secreção ativa','definido'],
  ['revelacao-tatica-v21','Revelação tática V2.1','Estratégia',1,'Identifica a menor defesa entre DEF e RES','definido']
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

// Parâmetros aprovados para os 28 especiais de combate. Os utilitários e Jato
// Defensivo ficam fora desta tabela; as chaves são os sufixos dos IDs estáveis.
const linhaEspecial = (P,R,M,efeitos=[]) => Object.freeze({P,R,M,custosEfeitoIds:Object.freeze(efeitos)});
export const PARAMETROS_ESPECIAIS_V2_1 = Object.freeze({
  'felinos-rugido-da-cacadora':linhaEspecial(1,0,0,['desorientacao']),
  'mustelideos-secrecao-defensiva':linhaEspecial(0,1,1,['reducao-atq-v21']),
  'roedores-alerta-da-colonia':linhaEspecial(0,1,1,['bonus-iniciativa-v21']),
  'marsupiais-falsa-morte':linhaEspecial(0,2,2,['reducao-dano-geral-2-v21']),
  'marsupiais-secrecao-repulsiva':linhaEspecial(1,0,0,['desorientacao']),
  'primatas-grito-de-alerta':linhaEspecial(1,0,0,['desorientacao']),
  'morcegos-voo-erratico':linhaEspecial(0,2,2,['reducao-dano-fisico-2-v21']),
  'ungulados-brado-territorial':linhaEspecial(1,0,0,['desorientacao']),
  'aves-de-rapina-grito-de-rapina':linhaEspecial(0,2,2,['reducao-dano-especial-2-v21']),
  'aves-corredoras-e-campestres-chamado-de-advertencia':linhaEspecial(1,0,0,['bonus-precisao-v21']),
  'psitacideos-vocalizacao-imitativa':linhaEspecial(1,0,0,['desorientacao']),
  'serpentes-peconha-concentrada':linhaEspecial(0,2,2,['envenenamento']),
  'lagartos-ameaca-visual':linhaEspecial(1,0,0,['desorientacao']),
  'quelonios-vocalizacao-de-defesa':linhaEspecial(0,1,1,['reducao-dano-geral-1-v21']),
  'anuros-vocalizacao-intimidante':linhaEspecial(0,1,1,['reducao-atq-v21']),
  'characiformes-descarga-de-muco':linhaEspecial(1,0,0,['penalidade-precisao-v21']),
  'siluriformes-barbilhoes-sensoriais':linhaEspecial(0,1,1,['revelacao-tatica-v21']),
  'peixes-cartilaginosos-percepcao-do-tubarao-martelo':linhaEspecial(1,0,0,['bonus-precisao-v21']),
  'aracnideos-pelos-urticantes':linhaEspecial(1,0,0,['penalidade-precisao-v21']),
  'morcegos-pulso-ultrassonico':linhaEspecial(1,1,1,['desorientacao']),
  'xenartros-lingua-capturadora':linhaEspecial(1,2,1,['reducao-agi-v21']),
  'serpentes-bote-de-jararaca':linhaEspecial(1,2,1,['envenenamento']),
  'anuros-secrecao-defensiva':linhaEspecial(0,1,1,['dano-reativo-especial-v21']),
  'peixes-eletricos-descarga-do-poraque':linhaEspecial(1,2,1,['reducao-atq-v21']),
  'peixes-eletricos-pulso-de-alta-voltagem':linhaEspecial(1,1,1,['desorientacao']),
  'aracnideos-picada-venenosa':linhaEspecial(1,2,1,['envenenamento']),
  'insetos-sociais-acido-defensivo':linhaEspecial(0,1,1,['reducao-atq-v21']),
  'insetos-predadores-enzimas-digestivas':linhaEspecial(0,1,1,['digestao-v21'])
});

export function obterParametrosEspeciaisV2_1(tecnicaId) {
  const sufixo=String(tecnicaId||'').replace(/^linhagem-v2-1-/,'');
  return PARAMETROS_ESPECIAIS_V2_1[sufixo] || null;
}

function obterAlocacoesEspeciaisV2_1(tecnicaId) {
  const parametros=obterParametrosEspeciaisV2_1(tecnicaId);
  return parametros ? parametros.custosEfeitoIds.map(efeitoId=>({efeitoId,estado:'efeito V2.1 parametrizado'})) : null;
}

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
  const alocacoes=obterAlocacoesEspeciaisV2_1(tecnica.id) || ALOCACOES_EFEITOS_V2_1[tecnica.id] || [];
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
