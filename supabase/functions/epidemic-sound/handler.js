const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
export function createEpidemicSoundHandler({env=()=>undefined,fetchImpl=fetch}={}){return async request=>{
  if(request.method==="OPTIONS")return new Response(null,{headers:cors});if(request.method!=="POST")return json({error:"Método não permitido."},405);
  const bearer=request.headers.get("Authorization");const url=(env("SUPABASE_URL")||"").replace(/\/$/,"");const publicKey=env("SUPABASE_ANON_KEY")||env("SUPABASE_PUBLISHABLE_KEY");
  if(!bearer?.startsWith("Bearer ")||!url||!publicKey)return json({error:"Entre na sua conta."},401);
  try{const auth=await fetchImpl(`${url}/auth/v1/user`,{headers:{apikey:publicKey,Authorization:bearer},signal:AbortSignal.timeout(8000)});if(!auth.ok)return json({error:"Sessão inválida."},401);const user=await auth.json();if(!user?.id)return json({error:"Sessão inválida."},401);
    const body=await request.json();const key=env("EPIDEMIC_SOUND_API_KEY");if(!key)return json({error:"Catálogo de áudio não configurado no servidor."},503);
    const headers={Authorization:`Bearer ${key}`,"x-partner-user-id":`nativa-${user.id}`};const base="https://api.epidemicsound.com/v0";
    if(body.action==="search"){const term=String(body.term||"").trim().slice(0,500);if(term.length<3)return json({error:"Descreva o som que procura."},400);const response=await fetchImpl(`${base}/sound-effects/search?term=${encodeURIComponent(term)}&limit=12&sort=best-match&order=desc`,{headers,signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok)return json({error:"A busca de efeitos falhou no catálogo."},502);return json(data);}
    if(body.action==="preview"){const id=String(body.id||"");if(!/^[A-Za-z0-9-]{8,80}$/.test(id))return json({error:"Efeito inválido."},400);const response=await fetchImpl(`${base}/sound-effects/${encodeURIComponent(id)}/preview`,{headers,signal:AbortSignal.timeout(12000)});const data=await response.json();if(!response.ok)return json({error:"Não foi possível criar a prévia."},502);return json(data);}
    return json({error:"Ação desconhecida."},400);
  }catch{return json({error:"Não foi possível acessar o catálogo de áudio."},502);}
};}
