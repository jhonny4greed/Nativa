import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calcularPGBruto, calcularPGLiquido, calcularDanoV21, calcularCustoEfeitos, CUSTOS_EFEITOS, auditarTecnicaV21 } from '../js/technique-balance.js';
import { TECNICAS_LINHAGEM_V2_1 } from '../js/techniques-v2-1.js';
import { TECNICAS_V1_ARQUIVO } from '../js/techniques.js';
import { podeAprenderTecnica, podeUsarTecnicaEmCombate } from '../js/technique-learning.js';

test('fórmula oficial PG bruto usa os incrementos baseados em P, R e M', () => {
  assert.equal(calcularPGBruto(),2);
  assert.equal(calcularPGBruto({P:1}),3.5);
  assert.equal(calcularPGBruto({R:1}),2.5);
  assert.equal(calcularPGBruto({M:1}),2.5);
  assert.equal(calcularPGBruto({P:2,R:2,M:2}),7);
});

test('PG líquido soma os custos sem arredondar ou limitar a zero', () => {
  assert.equal(calcularPGLiquido(2,1.5),0.5);
  assert.equal(calcularPGLiquido(2,3),-1);
  assert.equal(CUSTOS_EFEITOS.find(e=>e.id==='recuperacao-mp').custo,2);
});

test('custos de múltiplos efeitos são somados e IDs desconhecidos ficam pendentes', () => {
  assert.equal(calcularCustoEfeitos(['queimadura','envenenamento','perseguicao']).custoTotal,3.5);
  const unknown=calcularCustoEfeitos(['efeito-inexistente']);
  assert.equal(unknown.custoTotal,0);
  assert.deepEqual(unknown.desconhecidos,['efeito-inexistente']);
  assert.match(unknown.estado,/pendente/);
});

test('dano físico e especial seguem fórmula e mínimo zero', () => {
  assert.deepEqual(calcularDanoV21({categoria:'Físico',atributo:5,defesa:2,pgLiquido:1}),{dano:4,estado:'calculado'});
  assert.deepEqual(calcularDanoV21({categoria:'Especial',atributo:5,defesa:2,pgLiquido:1}),{dano:4,estado:'calculado'});
  assert.deepEqual(calcularDanoV21({categoria:'Físico',atributo:1,defesa:8,pgLiquido:0}),{dano:0,estado:'calculado'});
});

test('dano fracionado fica pendente sem arredondamento; suporte não recebe dano', () => {
  assert.deepEqual(calcularDanoV21({categoria:'Físico',atributo:2,defesa:1,pgLiquido:0.5}),{dano:null,valorFracionado:1.5,estado:'pendente: dano fracionado; não arredondado'});
  assert.deepEqual(calcularDanoV21({categoria:'Suporte',atributo:20,defesa:0,pgLiquido:10}),{dano:null,estado:'não se aplica: técnica de suporte'});
});

test('efeito desconhecido não recebe custo e auditoria não valida técnica sem parâmetros', () => {
  assert.equal(CUSTOS_EFEITOS.find(e=>e.id==='nao-cadastrado'),undefined);
  const resultado=auditarTecnicaV21({id:'novo',categoria:'Físico',precisao:null,mp:null,recarga:null,dano:null});
  assert.equal(resultado.pgBruto,2);
  assert.equal(resultado.pgLiquidoFinal,null);
  assert.equal(resultado.estado,'pendente de validação individual');
});

test('108 técnicas têm fórmula de referência; só os 28 especiais parametrizados liberam teste controlado', () => {
  assert.equal(TECNICAS_LINHAGEM_V2_1.length,108);
  let testaveis=0;
  for (const tecnica of TECNICAS_LINHAGEM_V2_1) {
    assert.equal(tecnica.auditoriaBalanceamento.pgBruto,tecnica.parametrosBalanceamento?.pgBruto ?? 2,tecnica.id);
    assert.equal(tecnica.auditoriaBalanceamento.pgLiquidoFinal,null,tecnica.id);
    if (tecnica.categoria==='Suporte') assert.equal(tecnica.auditoriaBalanceamento.danoAutomatico,false);
    assert.equal(podeUsarTecnicaEmCombate(tecnica),tecnica.parametrosTecnicosDisponiveis===true,tecnica.id);
    if(tecnica.parametrosTecnicosDisponiveis)testaveis+=1;
  }
  assert.equal(testaveis,28);
});

test('os 42 golpes físicos preservam nome/ID/categoria e só sete têm efeito secundário estruturado', () => {
  const fisicos=TECNICAS_LINHAGEM_V2_1.filter(t=>t.categoria==='Físico');
  assert.equal(fisicos.length,42);
  assert.equal(new Set(fisicos.map(t=>t.id)).size,42);
  const auditoriaAnterior=fs.readFileSync(new URL('../docs/auditoria-fisicos-v2-1.md',import.meta.url),'utf8');
  const identidadeAnterior=[...auditoriaAnterior.matchAll(/^\| ([^|]+) — `([^`]+)` \|/gm)].map(([,nome,id])=>({nome,id}));
  assert.equal(identidadeAnterior.length,42);
  assert.deepEqual(fisicos.map(t=>({nome:t.nome,id:t.id})),identidadeAnterior);
  const efeitosEsperados={
    'linhagem-v2-1-felinos-bote-predatorio':'dano-condicional-alvo-nao-agiu',
    'linhagem-v2-1-felinos-garras-perfurantes':'exposicao',
    'linhagem-v2-1-canideos-mordida-persistente':'sangramento',
    'linhagem-v2-1-ungulados-investida-de-grande-porte':'desorientacao',
    'linhagem-v2-1-psitacideos-bicada-desestabilizadora':'desorientacao',
    'linhagem-v2-1-characiformes-mordida-de-piranha':'dano-condicional-alvo-sangrando',
    'linhagem-v2-1-peixes-cartilaginosos-mordida-serrilhada':'ferimento-profundo'
  };
  for(const [id,efeitoId] of Object.entries(efeitosEsperados)){
    const tecnica=fisicos.find(t=>t.id===id);
    assert.ok(tecnica,id);
    assert.equal(tecnica.auditoriaBalanceamento.efeitos.length,1,id);
    assert.equal(tecnica.auditoriaBalanceamento.efeitos[0].efeitoId,efeitoId,id);
  }
  const resto=fisicos.filter(t=>!efeitosEsperados[t.id]);
  assert.equal(resto.length,35);
  const promises=/sangramento|desorienta|exposi[cç][aã]o|ferimento profundo|restringe|prende|captura|dificulta fuga|contra-ataca|ataques sucessivos|empurr|derruba|interrompe|desestabiliza|afasta o adversário|reduz DEF/i;
  for(const tecnica of resto){
    assert.deepEqual(tecnica.auditoriaBalanceamento.efeitos,[],tecnica.id);
    assert.doesNotMatch(tecnica.efeito,promises,tecnica.id);
  }
});

test('custos dos sete efeitos físicos seguem a consolidação aprovada',()=>{
  const porId=new Map(TECNICAS_LINHAGEM_V2_1.map(t=>[t.id,t]));
  const custos=[
    ['linhagem-v2-1-felinos-garras-perfurantes','exposicao',1.5],
    ['linhagem-v2-1-canideos-mordida-persistente','sangramento',1],
    ['linhagem-v2-1-ungulados-investida-de-grande-porte','desorientacao',1.5],
    ['linhagem-v2-1-psitacideos-bicada-desestabilizadora','desorientacao',1.5],
    ['linhagem-v2-1-peixes-cartilaginosos-mordida-serrilhada','ferimento-profundo',1]
  ];
  for(const [id,efeitoId,custo] of custos){
    const alocacao=porId.get(id).auditoriaBalanceamento.efeitos[0];
    assert.equal(alocacao.efeitoId,efeitoId);
    assert.equal(alocacao.custo,custo);
  }
  const bote=porId.get('linhagem-v2-1-felinos-bote-predatorio');
  assert.equal(bote.auditoriaBalanceamento.efeitos[0].custo,1);
  const piranha=porId.get('linhagem-v2-1-characiformes-mordida-de-piranha');
  assert.equal(piranha.auditoriaBalanceamento.efeitos[0].custo,0.5);
  assert.equal(piranha.parametrosBalanceamento.custoEfeitos,0.5);
});

test('golpes físicos revisados continuam aprendíveis e bloqueados para combate',()=>{
  for(const tecnica of TECNICAS_LINHAGEM_V2_1.filter(t=>t.categoria==='Físico')){
    assert.equal(tecnica.estadoCatalogo,'em-revisao');
    assert.equal(podeAprenderTecnica(tecnica),true,tecnica.id);
    assert.equal(podeUsarTecnicaEmCombate(tecnica),false,tecnica.id);
  }
});

test('primeiros seis golpes permanecem com parâmetros aprovados e cálculos de PG exatos',()=>{
  const expected={
    'linhagem-v2-1-felinos-bote-predatorio':[-2,1,1,0,4,1,3],
    'linhagem-v2-1-felinos-garras-perfurantes':[-2,1,1,1,4.5,1.5,3],
    'linhagem-v2-1-canideos-mordida-persistente':[-2,1,0,1,4,1,3],
    'linhagem-v2-1-canideos-investida-de-matilha':[-3,2,2,0,6,0,6],
    'linhagem-v2-1-mustelideos-agarrao-aquatico':[-2,1,0,1,4,0,4],
    'linhagem-v2-1-mustelideos-mordida-de-fixacao':[-1,0,2,2,4,0,4]
  };
  for(const [id,[precisao,P,R,M,pgBruto,custo,pgLiquido]] of Object.entries(expected)){
    const t=TECNICAS_LINHAGEM_V2_1.find(x=>x.id===id);
    assert.ok(t,id);
    assert.deepEqual([t.precisao,t.parametrosBalanceamento.P,t.parametrosBalanceamento.R,t.parametrosBalanceamento.M,t.parametrosBalanceamento.pgBruto,t.parametrosBalanceamento.custoEfeitos,t.parametrosBalanceamento.pgLiquido],[precisao,P,R,M,pgBruto,custo,pgLiquido],id);
    assert.equal(t.pg,pgBruto,id);
    assert.equal(t.dano,null,id);
  }
  const bite=TECNICAS_LINHAGEM_V2_1.find(t=>t.id==='linhagem-v2-1-canideos-mordida-persistente');
  assert.equal(bite.parametrosBalanceamento.custoEsperadoEfeitos,0.5);
  assert.equal(bite.auditoriaBalanceamento.custoConhecido,1);
  assert.equal(bite.auditoriaBalanceamento.efeitos[0].chanceAplicacao,0.5);
});

test('40 golpes consolidados têm PG líquido inteiro e os dois registros não identificados ficam intactos',()=>{
  const physical=TECNICAS_LINHAGEM_V2_1.filter(t=>t.categoria==='Físico');
  const assigned=physical.filter(t=>t.parametrosBalanceamento);
  assert.equal(physical.length,42);
  assert.equal(assigned.length,40);
  for(const t of assigned){
    const b=t.parametrosBalanceamento;
    assert.equal(t.precisao,[-1,-2,-3,-4,-5][b.P] ?? t.precisao,t.id);
    assert.equal(t.recarga,b.R,t.id);
    assert.equal(t.mp,b.M,t.id);
    assert.equal(t.P,b.P,t.id);
    assert.equal(t.R,b.R,t.id);
    assert.equal(t.M,b.M,t.id);
    assert.equal(t.pg,b.pgBruto,t.id);
    assert.equal(t.auditoriaBalanceamento.pgBruto,b.pgBruto,t.id);
    assert.equal(t.auditoriaBalanceamento.custoConhecido,b.custoEfeitos,t.id);
    assert.equal(b.pgLiquido,b.pgBruto-b.custoEfeitos,t.id);
    assert.equal(Number.isInteger(b.pgLiquido),true,`${t.nome}: PG líquido fracionado`);
    assert.equal(t.dano,null,`${t.nome}: não há dano final aprovado`);
  }
  const pending=physical.filter(t=>!t.parametrosBalanceamento);
  assert.deepEqual(pending.map(t=>[t.id,t.nome,t.grupo]),[
    ['linhagem-v2-1-marsupiais-mordida-defensiva','Mordida Defensiva','Marsupiais'],
    ['linhagem-v2-1-ungulados-chifrada-de-impacto','Chifrada de Impacto','Ungulados']
  ]);
  for(const t of pending) for(const field of ['precisao','recarga','mp','pg','dano']) assert.equal(t[field],null,t.id);
});

test('parâmetros dos 34 golpes adicionados correspondem à tabela consolidada',()=>{
  const expected=[
    ['procionideos-garras-escaladoras',-2,0,1,0],['roedores-incisivos-poderosos',-1,1,1,0],
    ['roedores-impacto-de-roedura',-3,2,0,0],['primatas-manipulacao-de-ferramentas',-2,1,2,0],
    ['morcegos-mergulho-predatorio',-3,1,1,0],['xenartros-garras-escavadoras',-2,1,0,0],
    ['ungulados-investida-de-grande-porte',-2,1,1,1.5],['aves-de-rapina-garras-de-harpia',-2,0,1,0],
    ['aves-de-rapina-mergulho-predatorio',-3,2,0,0],['aves-corredoras-e-campestres-chute-de-ema',-2,2,1,0],
    ['aves-corredoras-e-campestres-patada-predatoria',-2,1,0,0],['aves-aquaticas-e-pernaltas-bico-de-tuiuiu',-1,1,1,0],
    ['psitacideos-bico-poderoso',-2,0,1,0],['psitacideos-bicada-desestabilizadora',-2,1,1,1.5],
    ['serpentes-constricao',-3,2,0,0],['lagartos-cauda-chicote',-2,2,1,0],
    ['lagartos-mordida-de-lagarto',-1,1,1,0],['quelonios-impacto-de-casco',-3,3,1,0],
    ['quelonios-mordida-de-casco',-3,2,0,0],['crocodilianos-giro-mortal',-3,3,1,0],
    ['crocodilianos-mordida-de-emboscada',-2,2,1,0],['anuros-lingua-capturadora',-2,1,2,0],
    ['peixes-eletricos-investida-aquatica',-2,2,1,0],['characiformes-mordida-de-piranha',-2,1,1,0.5],
    ['characiformes-frenesi-alimentar',-3,1,1,0],['siluriformes-espinhos-das-nadadeiras',-2,0,1,0],
    ['siluriformes-succao-poderosa',-2,2,1,0],['peixes-cartilaginosos-investida-subaquatica',-3,1,1,0],
    ['peixes-cartilaginosos-mordida-serrilhada',-2,2,1,1],['aracnideos-pinca-de-escorpiao',-2,1,0,0],
    ['insetos-sociais-mandibulas-de-operaria',-1,0,2,0],['insetos-predadores-captura-do-louva-a-deus',-3,1,1,0],
    ['insetos-predadores-mandibulas-predatorias',-2,1,2,0],['crustaceos-pinca-esmagadora',-3,2,2,0]
  ];
  assert.equal(expected.length,34);
  for(const [suffix,precision,R,M,cost] of expected){
    const t=TECNICAS_LINHAGEM_V2_1.find(x=>x.id.endsWith(suffix));
    assert.ok(t,suffix);
    assert.deepEqual([t.precisao,t.R,t.M,t.parametrosBalanceamento.custoEfeitos],[precision,R,M,cost],t.id);
    const P=Math.abs(precision)-1;
    const gross=2+1.5*P+0.5*R+0.5*M;
    assert.equal(t.pg,gross,t.id);
    assert.equal(t.parametrosBalanceamento.pgLiquido,gross-cost,t.id);
    assert.equal(Number.isInteger(gross-cost),true,t.id);
  }
});

test('interface não expõe PG nem custos de balanceamento', () => {
  const app=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
  assert.doesNotMatch(app,/PG \$\{t\.pg/);
  assert.doesNotMatch(app,/custoConhecido|pgLiquidoProvisorio/);
});

test('catálogo V1 conserva seu conjunto e suas definições originais', () => {
  const baseline=JSON.parse(fs.readFileSync(new URL('./fixtures-lineage-techniques-baseline.json',import.meta.url),'utf8'));
  assert.equal(TECNICAS_V1_ARQUIVO.length,baseline.length);
  assert.deepEqual(TECNICAS_V1_ARQUIVO.map(t=>t.id),baseline.map(t=>t.id));
});
