import { criarCombatente, resolverTurnoCombate, avancarCombatentesDeTurno, obterTecnicasCombatente } from "../_shared/game/combat-domain.js";
import { podeUsarTecnicaEmCombate } from "../_shared/game/technique-learning.js";

export function initialState(match) {
  for(const n of [match.host_ficha,match.guest_ficha]) {
    if(!n||typeof n.name!=="string"||!n.name.trim()||!n.attrs||!Array.isArray(n.techniques)||n.techniques.length>6)throw new Error("Ficha de combate inválida");
    for(const key of ["ATQ","POT","DEF","RES","AGI","HP","MP"])if(!Number.isInteger(n.attrs[key])||n.attrs[key]<1||n.attrs[key]>99)throw new Error("Atributos de combate inválidos");
  }
  return {fighters:[criarCombatente(match.host_ficha),criarCombatente(match.guest_ficha)],history:["Duelo online iniciado. Confirme uma ação por turno."],order:[],ended:false};
}
export function validateChoice(state,index,choice) {
  if(!choice||!["attack","defend","recover"].includes(choice.tipo))throw new Error("Escolha uma ação válida");
  if(choice.tipo!=="attack")return {tipo:choice.tipo};
  const fighter=state.fighters[index];
  const technique=obterTecnicasCombatente(fighter).find(t=>t.id===choice.tecnicaId);
  if(!technique||!podeUsarTecnicaEmCombate(technique))throw new Error("Este golpe não está liberado para esta Nativa");
  if((fighter.cooldowns[technique.id]||0)>0)throw new Error("Golpe em recarga");
  if(fighter.mp<technique.mp)throw new Error("MP insuficiente");
  if(technique.id==="linhagem-v2-1-serpentes-peconha-concentrada") {
    const target=state.fighters[1-index];
    if(!target.efeitosV21?.some(e=>e.tipo==="envenenamento"&&!e.intensificado)||target.venenoIntensificadoV21)throw new Error("O alvo precisa ter um veneno ainda não intensificado");
  }
  return {tipo:"attack",tecnicaId:technique.id};
}
function describe(e) {
  if(e.type==="initiative")return `Iniciativa: ${e.order.map(i=>e.names[i]).join(" → ")}.`;
  if(e.type==="hit"||e.type==="v21-hit")return `${e.attacker} usa ${e.technique} (D10: ${e.roll??"—"}, acerto): ${e.target} recebe ${e.damage} de dano.`;
  if(e.type==="miss")return `${e.attacker} erra ${e.technique} (D10: ${e.roll??"—"}, falha).`;
  if(e.type==="support")return `${e.attacker} usa ${e.technique}: suporte.`;
  if(e.type==="defeat")return `${e.defeated} foi derrotada. Vitória de ${e.winner}.`;
  if(e.message)return e.message;
  if(e.type==="defend")return `${e.name||e.actor||"Nativa"} assume uma postura defensiva.`;
  if(e.type==="recover")return `${e.name||e.actor||"Nativa"} recupera MP.`;
  return null;
}
export function resolveOnlineRound(match,choices,random) {
  const state=match.state||initialState(match);
  const selected={0:choices.find(c=>c.user_id===match.host_id)?.choice,1:choices.find(c=>c.user_id===match.guest_id)?.choice};
  if(!selected[0]||!selected[1])return null;
  const result=resolverTurnoCombate({fighters:state.fighters,choices:selected,random,biomaArena:match.biome,invalidActionPolicy:"defend"});
  if(result.error)throw new Error("Não foi possível resolver o turno; reconecte à arena");
  const history=[...state.history,`Turno ${match.turn}`, ...result.events.map(describe).filter(Boolean)].slice(-180);
  return {state:{fighters:result.ended?result.fighters:avancarCombatentesDeTurno(result.fighters),history,order:result.order,ended:result.ended},turn:result.ended?match.turn:match.turn+1,ended:result.ended,winner:result.ended?(result.fighters[0].hp>0?match.host_id:result.fighters[1].hp>0?match.guest_id:null):null};
}
