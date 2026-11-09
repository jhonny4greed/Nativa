import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TECNICAS } from '../js/techniques.js';
import { TECNICAS_LINHAGEM_V2_1 as ESPECIAIS } from '../js/techniques-v2-1.js';
import { PARAMETROS_ESPECIAIS_V2_1, calcularPGBruto, calcularCustoEfeitos, calcularPGLiquido } from '../js/technique-balance.js';
import { criarCombatente, resolverTurnoCombate, avancarCombatentesDeTurno } from '../js/combat-domain.js';
import { podeUsarTecnicaEmCombate } from '../js/technique-learning.js';

const esperado = {
  'felinos-rugido-da-cacadora':[1,0,0,1.5,3.5,2],
  'mustelideos-secrecao-defensiva':[0,1,1,1,3,2],
  'roedores-alerta-da-colonia':[0,1,1,1,3,2],
  'marsupiais-falsa-morte':[0,2,2,2,4,2],
  'marsupiais-secrecao-repulsiva':[1,0,0,1.5,3.5,2],
  'primatas-grito-de-alerta':[1,0,0,1.5,3.5,2],
  'morcegos-voo-erratico':[0,2,2,2,4,2],
  'ungulados-brado-territorial':[1,0,0,1.5,3.5,2],
  'aves-de-rapina-grito-de-rapina':[0,2,2,2,4,2],
  'aves-corredoras-e-campestres-chamado-de-advertencia':[1,0,0,1.5,3.5,2],
  'psitacideos-vocalizacao-imitativa':[1,0,0,1.5,3.5,2],
  'serpentes-peconha-concentrada':[0,2,2,2,4,2],
  'lagartos-ameaca-visual':[1,0,0,1.5,3.5,2],
  'quelonios-vocalizacao-de-defesa':[0,1,1,1,3,2],
  'anuros-vocalizacao-intimidante':[0,1,1,1,3,2],
  'characiformes-descarga-de-muco':[1,0,0,1.5,3.5,2],
  'siluriformes-barbilhoes-sensoriais':[0,1,1,1,3,2],
  'peixes-cartilaginosos-percepcao-do-tubarao-martelo':[1,0,0,1.5,3.5,2],
  'aracnideos-pelos-urticantes':[1,0,0,1.5,3.5,2],
  'morcegos-pulso-ultrassonico':[1,1,1,1.5,4.5,3],
  'xenartros-lingua-capturadora':[1,2,1,1,5,4],
  'serpentes-bote-de-jararaca':[1,2,1,2,5,3],
  'anuros-secrecao-defensiva':[0,1,1,1,3,2],
  'peixes-eletricos-descarga-do-poraque':[1,2,1,1,5,4],
  'peixes-eletricos-pulso-de-alta-voltagem':[1,1,1,1.5,4.5,3],
  'aracnideos-picada-venenosa':[1,2,1,2,5,3],
  'insetos-sociais-acido-defensivo':[0,1,1,1,3,2],
  'insetos-predadores-enzimas-digestivas':[0,1,1,1,3,2]
};

const tecnica = (nome,grupo=null) => ESPECIAIS.find(t=>t.nome===nome&&(!grupo||t.grupo===grupo));
function ficha(id,nome,attrs,ids=[]) {
  return criarCombatente({id,name:nome,attrs:{ATQ:3,POT:4,DEF:2,RES:2,AGI:3,HP:10,MP:8,...attrs},affinity:'Fogo',techniques:ids,essencias:[],afinidadesEssencia:[]});
}
function dados(lista) { let i=0; return ()=>((lista[i++]??10)-1)/10; }
function rodada(fighters,choices,rolls) { return resolverTurnoCombate({fighters,choices,random:dados(rolls)}); }

test('os 28 parâmetros correspondem à tabela aprovada e os 28 PG líquidos são inteiros',()=>{
  assert.equal(Object.keys(PARAMETROS_ESPECIAIS_V2_1).length,28);
  assert.deepEqual(Object.keys(PARAMETROS_ESPECIAIS_V2_1).sort(),Object.keys(esperado).sort());
  for(const [sufixo,[P,R,M,custo,bruto,liquido]] of Object.entries(esperado)) {
    const t=ESPECIAIS.find(x=>x.id===`linhagem-v2-1-${sufixo}`);
    assert.ok(t,sufixo);
    const param=PARAMETROS_ESPECIAIS_V2_1[sufixo];
    assert.deepEqual([param.P,param.R,param.M],[P,R,M],sufixo);
    const custoCalculado=calcularCustoEfeitos(param.custosEfeitoIds).custoTotal;
    assert.equal(custoCalculado,custo,sufixo);
    assert.equal(calcularPGBruto({P,R,M}),bruto,sufixo);
    assert.equal(calcularPGLiquido(bruto,custo),liquido,sufixo);
    assert.equal(t.pg,bruto,sufixo);
    assert.equal(t.parametrosBalanceamento.pgLiquido,liquido,sufixo);
    assert.equal(t.precisao,-1-P,sufixo);
    assert.equal(t.recarga,R,sufixo);
    assert.equal(t.mp,M,sufixo);
    assert.equal(t.dano,null,sufixo);
    assert.ok(Number.isInteger(liquido),sufixo);
    assert.equal(t.estadoCatalogo,'em-revisao',sufixo);
    assert.equal(podeUsarTecnicaEmCombate(t),true,sufixo);
  }
});

test('quatro técnicas utilitárias e Jato Defensivo não recebem parâmetros de dano',()=>{
  for(const nome of ['Faro de Perseguição','Exploração Atenta','Ecolocalização','Chamado do Bando','Jato Defensivo']) {
    const t=tecnica(nome);
    assert.ok(t);
    assert.equal(t.pg,null,t.id);
    assert.equal(t.dano,null,t.id);
    assert.equal(t.parametrosTecnicosDisponiveis,undefined,t.id);
    assert.equal(podeUsarTecnicaEmCombate(t),false,t.id);
  }
});

test('a interface não expõe campos internos de balanceamento',()=>{
  const app=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
  assert.doesNotMatch(app,/pgLiquido|pgBruto|custoEfeitos/);
});

test('Bote de Jararaca usa POT + PG líquido - RES e aplica duas ocorrências de veneno',()=>{
  const bote=tecnica('Bote de Jararaca');
  const a=ficha('a','Serpente',{POT:4,AGI:10,MP:8},[bote.id]);
  const b=ficha('b','Alvo',{RES:2,AGI:1});
  const primeiro=rodada([a,b],{0:{tipo:'attack',tecnicaId:bote.id},1:{tipo:'defend'}},[10,1,10]);
  assert.equal(primeiro.error,null);
  assert.equal(primeiro.events.find(e=>e.type==='v21-hit').damage,5);
  assert.equal(primeiro.fighters[1].hp,44); // 5 do golpe + 1 ao fim do turno do alvo
  assert.equal(primeiro.fighters[1].efeitosV21.find(e=>e.tipo==='envenenamento').turnosRestantes,1);
  const segundo=rodada(avancarCombatentesDeTurno(primeiro.fighters),{0:{tipo:'defend'},1:{tipo:'defend'}},[5,5]);
  assert.equal(segundo.fighters[1].hp,43);
  assert.equal(segundo.fighters[1].efeitosV21.some(e=>e.tipo==='envenenamento'),false);
});

test('Peçonha Concentrada exige veneno e uma segunda intensificação é recusada sem consumir MP',()=>{
  const peconha=tecnica('Peçonha Concentrada');
  const a=ficha('a','Serpente',{AGI:10,MP:8},[peconha.id]);
  const b=ficha('b','Alvo',{AGI:1});
  const semVeneno=rodada([a,b],{0:{tipo:'attack',tecnicaId:peconha.id},1:{tipo:'defend'}},[10,1]);
  assert.match(semVeneno.error.message,/requer que o alvo esteja envenenado/);
  assert.equal(semVeneno.fighters[0].mp,16);
  semVeneno.fighters[1].efeitosV21=[{tipo:'envenenamento',danoPorTurno:1,turnosRestantes:2,intensificado:false}];
  const intensifica=rodada(semVeneno.fighters,{0:{tipo:'attack',tecnicaId:peconha.id},1:{tipo:'defend'}},[1,10,10]);
  assert.equal(intensifica.error,null);
  assert.equal(intensifica.fighters[1].efeitosV21.find(e=>e.tipo==='envenenamento').danoPorTurno,2);
  assert.equal(intensifica.fighters[1].efeitosV21.find(e=>e.tipo==='envenenamento').turnosRestantes,1);
  const prox=avancarCombatentesDeTurno(intensifica.fighters);
  prox[0].cooldowns[peconha.id]=0;
  const segunda=rodada(prox,{0:{tipo:'attack',tecnicaId:peconha.id},1:{tipo:'defend'}},[10,1]);
  assert.match(segunda.error.message,/já foi intensificado/);
  assert.equal(segunda.fighters[0].mp,intensifica.fighters[0].mp);
});

test('Desorientação altera a próxima tentativa e é consumida mesmo se o alvo errar',()=>{
  const grito=tecnica('Grito de Alerta');
  const legacy=TECNICAS.find(t=>t.id==='afinidade-fogo-jato-de-labaredas');
  const a=ficha('a','Primata',{AGI:10,MP:8},[grito.id]);
  const b=ficha('b','Alvo',{AGI:1,MP:8},[legacy.id]);
  const result=rodada([a,b],{0:{tipo:'attack',tecnicaId:grito.id},1:{tipo:'attack',tecnicaId:legacy.id}},[10,1,10,3]);
  assert.equal(result.events.find(e=>e.type==='miss').threshold,3);
  assert.equal(result.fighters[1].efeitosV21.some(e=>e.tipo==='desorientacao'),false);
});

test('bônus de precisão afeta apenas o próximo golpe, inclusive contra a precisão V1',()=>{
  const chamado=tecnica('Chamado de Advertência');
  const jato=TECNICAS.find(t=>t.id==='afinidade-fogo-jato-de-labaredas');
  const a=ficha('a','Ave',{AGI:10,MP:8},[chamado.id,jato.id]);
  const b=ficha('b','Alvo',{AGI:1});
  const prep=rodada([a,b],{0:{tipo:'attack',tecnicaId:chamado.id},1:{tipo:'defend'}},[10,1]);
  const ataque=rodada(avancarCombatentesDeTurno(prep.fighters),{0:{tipo:'attack',tecnicaId:jato.id},1:{tipo:'defend'}},[10,1,2]);
  assert.equal(ataque.events.some(e=>e.type==='hit'),true);
  assert.equal(ataque.fighters[0].efeitosV21.some(e=>e.tipo==='bonus-precisao'),false);
});

test('Digestão causa só uma ocorrência de dano ao fim do turno do alvo',()=>{
  const enzimas=tecnica('Enzimas Digestivas');
  const a=ficha('a','Inseto',{AGI:10,MP:8},[enzimas.id]);
  const b=ficha('b','Alvo',{AGI:1,RES:2});
  const result=rodada([a,b],{0:{tipo:'attack',tecnicaId:enzimas.id},1:{tipo:'defend'}},[10,1,10]);
  assert.equal(result.events.find(e=>e.type==='v21-hit').damage,4);
  assert.equal(result.fighters[1].hp,45); // 4 do golpe e 1 de Digestão.
  assert.equal(result.fighters[1].efeitosV21.some(e=>e.tipo==='digestao'),false);
});

test('Alerta da Colônia afeta e consome apenas a próxima rolagem de iniciativa',()=>{
  const alerta=tecnica('Alerta da Colônia');
  const a=ficha('a','Roedor',{AGI:5,MP:8},[alerta.id]);
  const b=ficha('b','Alvo',{AGI:5});
  const first=rodada([a,b],{0:{tipo:'attack',tecnicaId:alerta.id},1:{tipo:'defend'}},[10,1]);
  assert.equal(first.fighters[0].efeitosV21.find(e=>e.tipo==='bonus-iniciativa').valor,1);
  const second=rodada(avancarCombatentesDeTurno(first.fighters),{0:{tipo:'defend'},1:{tipo:'defend'}},[5,5]);
  assert.equal(second.events[0].rolls[0].initiative,11);
  assert.equal(second.events[0].rolls[0].bonus,1);
  assert.equal(second.fighters[0].efeitosV21.some(e=>e.tipo==='bonus-iniciativa'),false);
});

test('redução de AGI altera iniciativa enquanto ativa e expira no próximo turno do alvo',()=>{
  const lingua=tecnica('Língua Capturadora');
  const a=ficha('a','Xenartro',{AGI:1,MP:8},[lingua.id]);
  const b=ficha('b','Alvo',{AGI:10});
  const first=rodada([a,b],{0:{tipo:'attack',tecnicaId:lingua.id},1:{tipo:'defend'}},[1,10,10]);
  assert.equal(first.fighters[1].efeitosV21.find(e=>e.tipo==='reducao-agi').valor,1);
  const second=rodada(avancarCombatentesDeTurno(first.fighters),{0:{tipo:'defend'},1:{tipo:'defend'}},[10,1]);
  assert.equal(second.events[0].rolls[1].agi,9);
  assert.equal(second.fighters[1].efeitosV21.some(e=>e.tipo==='reducao-agi'),false);
});

test('reduções de dano só são consumidas por dano da categoria correspondente',()=>{
  const voo=tecnica('Voo Errático');
  const jato=TECNICAS.find(t=>t.id==='afinidade-fogo-jato-de-labaredas');
  const golpeFisico=TECNICAS.find(t=>t.categoria==='Físico'&&t.versao!=='2.1');
  const a=ficha('a','Atacante',{AGI:5,POT:4,ATQ:8,MP:8},[jato.id,golpeFisico.id]);
  const b=ficha('b','Morcego',{AGI:6,MP:8},[voo.id]);
  const primeira=rodada([a,b],{0:{tipo:'attack',tecnicaId:jato.id},1:{tipo:'attack',tecnicaId:voo.id}},[1,10,10]);
  assert.equal(primeira.fighters[1].hp,44);
  assert.ok(primeira.fighters[1].efeitosV21.some(e=>e.tipo==='reducao-dano'&&e.categoria==='fisico'));
  const segunda=rodada(avancarCombatentesDeTurno(primeira.fighters),{0:{tipo:'attack',tecnicaId:golpeFisico.id},1:{tipo:'defend'}},[10,1,10]);
  assert.equal(segunda.fighters[1].efeitosV21.some(e=>e.tipo==='reducao-dano'),false);
});

test('secreção dos Anuros reage uma vez a contato físico, não a golpe especial',()=>{
  const secrecao=tecnica('Secreção Defensiva','Anuros');
  const jato=TECNICAS.find(t=>t.id==='afinidade-fogo-jato-de-labaredas');
  const physical=TECNICAS.find(t=>t.categoria==='Físico'&&t.versao!=='2.1');
  const a=ficha('a','Anuro',{AGI:5,MP:8},[secrecao.id]);
  const b=ficha('b','Adversário',{AGI:5,ATQ:8,POT:4,MP:8},[jato.id,physical.id]);
  const first=rodada([a,b],{0:{tipo:'attack',tecnicaId:secrecao.id},1:{tipo:'attack',tecnicaId:jato.id}},[10,1,10]);
  assert.equal(first.fighters[0].efeitosV21.some(e=>e.tipo==='secrecao'),true);
  assert.equal(first.fighters[0].hp,44); // V1 especial não ativa a secreção.
  const second=rodada(avancarCombatentesDeTurno(first.fighters),{0:{tipo:'defend'},1:{tipo:'attack',tecnicaId:physical.id}},[1,10,10]);
  assert.equal(second.fighters[0].efeitosV21.some(e=>e.tipo==='secrecao'),false);
  assert.equal(second.fighters[1].hp,49); // 1 dano especial reativo, sem contra-ataque geral.
});

test('secreções de Mustelídeos e Marsupiais só disparam após golpe físico e deixam o efeito no atacante',()=>{
  const golpeFisico=TECNICAS.find(t=>t.categoria==='Físico'&&t.versao!=='2.1');
  for(const [grupo,nome,consequencia] of [
    ['Mustelídeos','Secreção Defensiva','reducao-atq'],
    ['Marsupiais','Secreção Repulsiva','desorientacao']
  ]) {
    const secrecao=tecnica(nome,grupo);
    const a=ficha('a',grupo,{AGI:5,MP:8},[secrecao.id]);
    const b=ficha('b','Atacante',{AGI:5,ATQ:8,MP:8},[golpeFisico.id]);
    const prep=rodada([a,b],{0:{tipo:'attack',tecnicaId:secrecao.id},1:{tipo:'defend'}},[10,1]);
    assert.ok(prep.fighters[0].efeitosV21.some(e=>e.tipo==='secrecao'));
    const hit=rodada(avancarCombatentesDeTurno(prep.fighters),{0:{tipo:'defend'},1:{tipo:'attack',tecnicaId:golpeFisico.id}},[1,10,10]);
    assert.equal(hit.fighters[0].efeitosV21.some(e=>e.tipo==='secrecao'),false);
    assert.ok(hit.fighters[1].efeitosV21.some(e=>e.tipo===consequencia),`${grupo} efeito reativo`);
  }
});

test('cada novo combate começa sem estados temporários de uma batalha anterior',()=>{
  const antigo=ficha('x','Antigo',{AGI:1});
  antigo.efeitosV21=[{tipo:'envenenamento',danoPorTurno:2,turnosRestantes:2}];
  const novo=criarCombatente(antigo.nativa);
  assert.equal(novo.efeitosV21,undefined);
  assert.equal(novo.turnoV21,undefined);
});
