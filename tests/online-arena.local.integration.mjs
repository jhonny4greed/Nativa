import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createArenaHandler} from '../supabase/functions/arena-online/handler.js';
const base='http://127.0.0.1:54321';
const inspection=JSON.parse(execFileSync('docker',['inspect','supabase_edge_runtime_NATIVA_Prototipo_Atualizado'],{encoding:'utf8'}));
const environment=Object.fromEntries(inspection[0].Config.Env.map(v=>{const i=v.indexOf('=');return[v.slice(0,i),v.slice(i+1)];}));
const secret=environment.SUPABASE_SERVICE_ROLE_KEY;
if(!secret)throw new Error('Chave local não encontrada');
const anon='sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
const users=[];
async function rest(path,body,method='POST') {
 const r=await fetch(`${base}/rest/v1/${path}`,{method,headers:{apikey:secret,Authorization:`Bearer ${secret}`,'Content-Type':'application/json',Prefer:'return=representation'},...(body?{body:JSON.stringify(body)}:{})});
 const data=await r.json();if(!r.ok)throw new Error(data.message);return data;
}
const handler=createArenaHandler({env:n=>({SUPABASE_URL:base,SUPABASE_ANON_KEY:anon,SUPABASE_SERVICE_ROLE_KEY:secret})[n],random:()=>.95});
async function action(user,action,payload={},expected=200){const r=await handler(new Request('http://local/arena',{method:'POST',headers:{Authorization:`Bearer ${user.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({action,payload})}));const d=await r.json();assert.equal(r.status,expected,d.error);return d;}
try {
 for(let i=0;i<3;i++) {
  const r=await fetch(`${base}/auth/v1/signup`,{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({email:`arena-e2e-${Date.now()}-${i}@example.test`,password:'Nativa-Local-QA-2026!'})});
  const u=await r.json();if(!r.ok)throw new Error(u.msg);users.push(u);
  await rest('profiles',{id:u.user.id,display_name:`QA ${i}`});
  const id=randomUUID();const [n]=await rest('nativas',{owner_id:u.user.id,local_id:id,format_version:1,data:{id,name:`Nativa QA ${i}`,species:'Lobo-guará',lineage:'Canídeos',affinity:'Fogo',bioma:'Floresta e Mata',archetype:'Predador',attrs:{ATQ:3,POT:3,DEF:3,RES:3,AGI:3,HP:20,MP:20},techniques:['afinidade-fogo-jato-de-labaredas'],nivel:1}});u.nativaId=n.id;
  await action(u,'heartbeat');
 }
 const [a,b,c]=users;
 const lobby=await action(a,'lobby');assert.equal(lobby.players.some(p=>p.id===b.user.id),true);assert.equal(JSON.stringify(lobby).includes('@example.test'),false);
 let match=await action(a,'private',{nativaId:a.nativaId,biome:'Floresta e Mata'});assert.equal(match.status,'waiting');const id=match.id;
 await action(c,'snapshot',{matchId:id},400);
 match=await action(b,'join',{code:match.code,nativaId:b.nativaId});assert.equal(match.status,'active');assert.ok(match.state.fighters.length===2);
 await action(c,'join',{code:'not-a-real-code',nativaId:c.nativaId},400);
 let first=await action(a,'submit',{matchId:id,turn:1,choice:{tipo:'attack',tecnicaId:'afinidade-fogo-jato-de-labaredas'}});assert.equal(first.ownConfirmed,true);
 const hidden=await action(b,'snapshot',{matchId:id});assert.equal(hidden.ownChoice,null);assert.equal(hidden.opponentConfirmed,true);assert.equal(JSON.stringify(hidden).includes('"choice"'),false);
 const resolved=await action(b,'submit',{matchId:id,turn:1,choice:{tipo:'defend'}});assert.equal(resolved.turn,2);assert.ok(resolved.state.fighters[1].hp<100);
 await action(a,'submit',{matchId:id,turn:1,choice:{tipo:'recover'}},400);
 await action(c,'submit',{matchId:id,turn:2,choice:{tipo:'recover'}},400);
 await action(a,'submit',{matchId:id,turn:2,choice:{tipo:'attack',tecnicaId:'invented-technique'}},400);
 const duplicate=await Promise.all([action(a,'submit',{matchId:id,turn:2,choice:{tipo:'recover'}}),action(a,'submit',{matchId:id,turn:2,choice:{tipo:'recover'}})]);assert.equal(duplicate.every(d=>d.turn===2),true);
 assert.equal((await action(b,'submit',{matchId:id,turn:2,choice:{tipo:'defend'}})).turn,3);
 assert.equal((await action(a,'forfeit',{matchId:id})).winnerIndex,1);
 const challenge=await action(a,'challenge',{nativaId:a.nativaId,userId:b.user.id});assert.equal((await action(b,'lobby')).incoming.some(i=>i.id===challenge.id),true);
 assert.equal((await action(b,'decline',{matchId:challenge.id})).status,'cancelled');
 const queue=await action(a,'quick',{nativaId:a.nativaId});assert.equal(queue.status,'waiting');
 const paired=await action(b,'quick',{nativaId:b.nativaId});assert.equal(paired.id,queue.id);assert.equal(paired.status,'active');
 await action(a,'forfeit',{matchId:paired.id});
 const denied=await fetch(`${base}/rest/v1/rpc/arena_server_context`,{method:'POST',headers:{apikey:anon,Authorization:`Bearer ${c.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({p_match_id:id})});assert.ok(denied.status===401||denied.status===403||denied.status===404);
 console.log('E2E OK: 3 contas, presença, convite privado, escolha oculta, turno autoritativo, idempotência, isolamento, desafio, recusa, busca automática e desistência.');
} finally {
 for(const u of users){await fetch(`${base}/auth/v1/admin/users/${u.user.id}`,{method:'DELETE',headers:{apikey:secret,Authorization:`Bearer ${secret}`}});}
}
