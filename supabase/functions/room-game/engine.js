import { criarCombatente, obterTecnicasCombatente, resolverTurnoCombate, avancarCombatentesDeTurno } from "../_shared/game/combat-domain.js";
import { podeUsarTecnicaEmCombate } from "../_shared/game/technique-learning.js";
import { xpPorVitoria, adicionarXP } from "../_shared/game/progression.js";

function npcFromCampaign(data) {
  const biome=String(data.bioma||"habitat").split(",")[0];
  const lineage=String(data.lineageName||data.lineage||"linhagem");
  return {...structuredClone(data),id:`encounter-${crypto.randomUUID()}`,name:`Guardião ${lineage}`,species:`Encontro de ${biome}`,bioma:data.bioma,level:data.nivel||1,nivel:data.nivel||1,attrs:{...data.attrs},techniques:[...(data.techniques||[])].slice(0,4)};
}
export function orderRoomParticipants(participants){return [...participants].sort((a,b)=>String(a.player_id).localeCompare(String(b.player_id)));}
export function initialRoomState(encounter,participants) {
  const fighters=orderRoomParticipants(participants).map(p=>p.campaign_data);
  if(encounter.kind==="hunt")fighters.push(npcFromCampaign(fighters[0]));
  if(fighters.length!==2)throw new Error("Este encontro precisa de dois combatentes.");
  return {fighters:fighters.map(criarCombatente),history:[encounter.kind==="hunt"?"Uma Nativa selvagem surgiu no habitat." : "O desafio PvP começou."],order:[],ended:false};
}
export function validateRoomChoice(state,index,choice) {
  if(!choice||!["attack","defend","recover"].includes(choice.tipo))throw new Error("Escolha uma ação válida.");
  if(choice.tipo!=="attack")return {tipo:choice.tipo};
  const fighter=state.fighters[index];
  const technique=obterTecnicasCombatente(fighter).find(t=>t.id===choice.tecnicaId);
  if(!technique||!podeUsarTecnicaEmCombate(technique))throw new Error("Este golpe não está liberado para combate.");
  if((fighter.cooldowns[technique.id]||0)>0||fighter.mp<technique.mp)throw new Error("Golpe indisponível: confira MP e recarga.");
  return {tipo:"attack",tecnicaId:technique.id};
}
function describe(e){if(e.type==="initiative")return `Iniciativa: ${e.order.map(i=>e.names[i]).join(" → ")}.`;if(e.type==="hit"||e.type==="v21-hit")return `${e.attacker} usa ${e.technique} (D10: ${e.roll??"—"}, acerto): ${e.target} recebe ${e.damage} de dano.`;if(e.type==="support")return `${e.attacker} usa ${e.technique}: ${e.description||"suporte"}.`;if(e.type==="miss")return `${e.attacker} erra ${e.technique} (D10: ${e.roll??"—"}, falha).`;if(e.type==="defend")return `${e.fighter} assume uma postura defensiva.`;if(e.type==="recover")return `${e.fighter} recupera ${e.recovered||0} MP.`;if(e.type==="defeat")return `${e.defeated} foi derrotada. Vitória de ${e.winner}.`;return e.message||null;}
export function resolveRoomRound(encounter,participants,choices,random=Math.random){
  participants=orderRoomParticipants(participants);
  const state=encounter.state||initialRoomState(encounter,participants);
  const player=participants[0];
  const hostId=player.player_id,guestId=encounter.kind==="hunt"?"00000000-0000-4000-8000-000000000001":participants[1].player_id;
  const selected=[choices.find(c=>c.player_id===hostId)?.choice,null];
  if(!selected[0])return null;
  if(encounter.kind==="hunt"){
    const enemy=state.fighters[1],usable=obterTecnicasCombatente(enemy).filter(t=>podeUsarTecnicaEmCombate(t)&&(enemy.cooldowns[t.id]||0)===0&&enemy.mp>=t.mp);
    selected[1]=usable.length&&random()<.75?{tipo:"attack",tecnicaId:usable[Math.floor(random()*usable.length)].id}:random()<.5?{tipo:"defend"}:{tipo:"recover"};
  }else{
    selected[1]=choices.find(c=>c.player_id===participants[1].player_id)?.choice;
    if(!selected[1])return null;
  }
  const result=resolverTurnoCombate({fighters:state.fighters,choices:{0:selected[0],1:selected[1]},random,biomaArena:participants[0].campaign_data.bioma,invalidActionPolicy:"defend"});
  if(result.error)throw new Error("Não foi possível resolver a rodada; atualize o encontro.");
  const history=[...state.history,`Turno ${encounter.turn}`, ...result.events.map(describe).filter(Boolean)].slice(-100);
  const next={fighters:result.ended?result.fighters:avancarCombatentesDeTurno(result.fighters),history,order:result.order,ended:result.ended};
  const winnerIndex=result.ended?(result.fighters[0].hp>0?0:result.fighters[1].hp>0?1:null):null;
  return {state:next,turn:result.ended?encounter.turn:encounter.turn+1,ended:result.ended,winnerId:winnerIndex===null?null:winnerIndex===0?hostId:guestId,winnerIndex};
}
export function campaignReward(data,opponent,random=Math.random){
  const next=structuredClone(data);const xp=(next.nivel||1)>=17?0:xpPorVitoria(next.nivel||1,opponent.nivel||1);if(xp)adicionarXP(next,xp);
  let essence=null;
  if(random()<.05){essence={id:crypto.randomUUID(),origem:"combate",oponenteId:opponent.id||null,oponenteNome:opponent.name||"Nativa selvagem",oponenteLinhagem:opponent.lineageName||opponent.lineage||"",oponenteAfinidade:opponent.affinity||"",oponenteTecnicas:[...(opponent.techniques||[])].slice(0,12),oponentePhotoId:opponent.photoId||null,oponentePhotoPath:opponent.photoStoragePath||null};next.essenciasDisponiveis||=[];next.essenciasDisponiveis.push(essence);}
  return {data:next,xp,essence};
}
