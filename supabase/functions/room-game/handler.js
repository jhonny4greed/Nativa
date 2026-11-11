import { initialRoomState, validateRoomChoice, resolveRoomRound, campaignReward, orderRoomParticipants } from "./engine.js";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createRoomGameHandler({env=()=>undefined,fetchImpl=fetch,random=Math.random}={}){
 return async request=>{
  if(request.method==="OPTIONS")return new Response(null,{headers:cors});
  if(request.method!=="POST")return json({error:"Método não permitido"},405);
  const url=(env("SUPABASE_URL")||"").replace(/\/$/,""),anon=env("SUPABASE_ANON_KEY")||env("SUPABASE_PUBLISHABLE_KEY"),secret=env("SUPABASE_SERVICE_ROLE_KEY")||env("SUPABASE_SECRET_KEY"),bearer=request.headers.get("Authorization");
  if(!bearer?.startsWith("Bearer "))return json({error:"Entre na sua conta"},401);
  try{
   const auth=await fetchImpl(`${url}/auth/v1/user`,{headers:{apikey:anon,Authorization:bearer},signal:AbortSignal.timeout(10000)});
   if(!auth.ok)return json({error:"Sessão inválida ou expirada"},401);
   const user=await auth.json();if(!uuid.test(user.id))return json({error:"Sessão inválida"},401);
   const body=await request.json(),payload=body.payload||{};
   async function rpc(name,args,service=false){
    const key=service?secret:anon;if(!key)throw new Error("Serviço de jogo indisponível");
    const res=await fetchImpl(`${url}/rest/v1/rpc/${name}`,{method:"POST",headers:{apikey:key,Authorization:service?`Bearer ${secret}`:bearer,"Content-Type":"application/json"},body:JSON.stringify(args),signal:AbortSignal.timeout(15000)});
    const raw=await res.text();let result;try{result=raw?JSON.parse(raw):null;}catch{result=raw;}
    if(!res.ok)throw new Error(result?.message||"A operação da mesa falhou");return result;
   }
   const initialize=async id=>{
    const context=await rpc("room_game_server_context",{p_encounter_id:id},true),enc=context?.encounter;
    if(!enc||enc.status!=="active")return;
    if(!enc.state){const state=initialRoomState(enc,context.participants);await rpc("room_game_server_commit",{p_encounter_id:id,p_revision:enc.revision,p_state:state,p_turn:enc.turn,p_status:"active",p_winner:null,p_result:{},p_reward:null},true);}
   };
   const submit=async(id,turn,choice)=>{
    const context=await rpc("room_game_server_context",{p_encounter_id:id},true),enc=context?.encounter,parts=orderRoomParticipants(context?.participants||[]);
    if(!enc||enc.status!=="active")throw new Error("Encontro encerrado ou indisponível");
    const index=parts.findIndex(p=>p.player_id===user.id);if(index<0)throw new Error("Você não participa deste encontro");
    const state=enc.state||initialRoomState(enc,parts),normalized=validateRoomChoice(state,index,choice);
    await rpc("room_game_submit_choice",{p_encounter_id:id,p_turn:turn,p_choice:normalized});
    const fresh=await rpc("room_game_server_context",{p_encounter_id:id},true),ready=enc.kind==="hunt"||fresh.choices?.length>=2;
    if(!ready)return;
    const round=resolveRoomRound({...enc,state:enc.state||state},parts,fresh.choices,random);if(!round)return;
    let result={},reward=null;
    if(round.ended&&enc.kind==="hunt"&&round.winnerIndex===0){
      const earned=campaignReward(parts[0].campaign_data,round.state.fighters[1].nativa,random);reward={[parts[0].companion_id]:earned.data};
      result={winnerId:round.winnerId,xp:earned.xp,essence:earned.essence};
    }else if(round.ended)result={winnerId:round.winnerId};
    await rpc("room_game_server_commit",{p_encounter_id:id,p_revision:enc.revision,p_state:round.state,p_turn:round.turn,p_status:round.ended?"completed":"active",p_winner:round.winnerId,p_result:result,p_reward:reward},true);
   };
   let result;
   if(body.action==="context")result=await rpc("room_game_context",{p_room_id:payload.roomId});
   else if(body.action==="start_hunt"||body.action==="request_pvp"||body.action==="accept"||body.action==="decline"){
    result=await rpc("room_game_action",{p_action:body.action,p_room_id:payload.roomId,p_payload:payload});
    if(result?.encounter_id)await initialize(result.encounter_id);
   }else if(body.action==="submit"){
    if(!uuid.test(payload.encounterId)||!Number.isInteger(payload.turn))throw new Error("Encontro ou turno inválido");
    await submit(payload.encounterId,payload.turn,payload.choice);result=await rpc("room_game_context",{p_room_id:payload.roomId});
   }else if(body.action==="cancel"){
    await rpc("room_game_cancel",{p_encounter_id:payload.encounterId});result=await rpc("room_game_context",{p_room_id:payload.roomId});
   }else if(body.action==="forfeit"){
    if(!uuid.test(payload.encounterId))throw new Error("Encontro inválido");
    await rpc("room_game_forfeit",{p_encounter_id:payload.encounterId});result=await rpc("room_game_context",{p_room_id:payload.roomId});
   }else throw new Error("Ação de mesa desconhecida");
   return json(result);
  }catch(error){return json({error:String(error.message||"Mesa indisponível").slice(0,240)},400);}
 };
}
