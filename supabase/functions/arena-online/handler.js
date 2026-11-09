import { initialState, validateChoice, resolveOnlineRound } from "./engine.js";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createArenaHandler({env=()=>undefined,fetchImpl=fetch,random=()=>{const v=new Uint32Array(1);crypto.getRandomValues(v);return v[0]/4294967296;}}={}) {
  return async request=>{
    if(request.method==="OPTIONS")return new Response(null,{headers:cors});
    if(request.method!=="POST")return json({error:"Método não permitido"},405);
    const url=(env("SUPABASE_URL")||"").replace(/\/$/,"");
    const publicKey=env("SUPABASE_ANON_KEY")||env("SUPABASE_PUBLISHABLE_KEY");
    const secret=env("SUPABASE_SERVICE_ROLE_KEY")||env("SUPABASE_SECRET_KEY");
    const bearer=request.headers.get("Authorization");
    if(!bearer?.startsWith("Bearer "))return json({error:"Entre na sua conta"},401);
    try {
      const authResponse=await fetchImpl(`${url}/auth/v1/user`,{headers:{apikey:publicKey,Authorization:bearer},signal:AbortSignal.timeout(10000)});
      if(!authResponse.ok)return json({error:"Sessão inválida ou expirada"},401);
      const user=await authResponse.json(); if(!uuid.test(user.id))return json({error:"Sessão inválida"},401);
      let size=0;const chunks=[];const reader=request.body?.getReader();if(!reader)return json({error:"Pedido vazio"},400);
      while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();return json({error:"Pedido muito grande"},413);}chunks.push(value);}
      const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
      const body=JSON.parse(new TextDecoder().decode(bytes));
      const payload=body.payload||{};
      async function rpc(name,args,service=false) {
        if(service&&!secret)throw new Error("Serviço de arena indisponível");
        const response=await fetchImpl(`${url}/rest/v1/rpc/${name}`,{method:"POST",headers:{apikey:service?secret:publicKey,Authorization:service?`Bearer ${secret}`:bearer,"Content-Type":"application/json"},body:JSON.stringify(args),signal:AbortSignal.timeout(15000)});
        const text=await response.text();const data=text?JSON.parse(text):null;
        if(!response.ok)throw new Error(data?.message||"A operação da arena falhou");return data;
      }
      async function resolve(id) {
        for(let attempt=0;attempt<3;attempt++) {
          const context=await rpc("arena_server_context",{p_match_id:id},true);
          const m=context?.match;
          if(!m||![m.host_id,m.guest_id].includes(user.id))throw new Error("Duelo indisponível para esta conta");
          if(m.status!=="active")return;
          const initial=!m.state;
          const next=initial?{state:initialState(m),turn:m.turn,ended:false,winner:null}:resolveOnlineRound(m,context.choices,random);
          if(!next)return;
          const changed=await rpc("arena_server_commit",{p_match_id:id,p_revision:m.revision,p_state:next.state,p_turn:next.turn,p_ended:next.ended,p_winner:next.winner},true);
          if(changed&&!initial)return;
        }
      }
      if(body.action==="submit") {
        if(!uuid.test(payload.matchId)||!Number.isInteger(payload.turn))throw new Error("Duelo ou turno inválido");
        const {match:m}=await rpc("arena_server_context",{p_match_id:payload.matchId},true)||{};
        if(!m||![m.host_id,m.guest_id].includes(user.id)||m.status!=="active")throw new Error("Você não participa deste duelo ativo");
        const choice=validateChoice(m.state||initialState(m),user.id===m.host_id?0:1,payload.choice);
        await rpc("arena_server_choice",{p_match_id:m.id,p_user:user.id,p_turn:payload.turn,p_choice:choice},true);
        await resolve(m.id);
        return json(await rpc("arena_lobby",{p_action:"snapshot",p_payload:{matchId:m.id}}));
      }
      const allowed=["heartbeat","offline","lobby","snapshot","private","quick","challenge","join","accept","decline","cancel","forfeit"];
      if(!allowed.includes(body.action))throw new Error("Ação desconhecida");
      let result=await rpc("arena_lobby",{p_action:body.action,p_payload:payload});
      if(result?.id&&result.status==="active"&&body.action!=="forfeit") {
        await resolve(result.id);result=await rpc("arena_lobby",{p_action:"snapshot",p_payload:{matchId:result.id}});
      }
      return json(result);
    } catch(error) { return json({error:String(error.message||"Arena indisponível").slice(0,240)},400); }
  };
}
