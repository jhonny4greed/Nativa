import { obterClienteSupabase } from "./auth.js";
import { BIOMAS } from "./data.js";

export function initializeOnlineArena({onMatch,onLocal}) {
  const $=s=>document.querySelector(s);
  let client=null,userId=null,connected=false,match=null,busy=false,timer=null,lastHeartbeat=0,version=-1;
  let stopped=false;
  const panel=$("#online-arena-lobby"),status=$("#online-arena-status"),nativas=$("#online-arena-nativa");
  const storedKey=()=>`nativa.online.match.${userId}`;
  const tell=text=>{status.textContent=text;};
  async function getClient() {
    client||=await obterClienteSupabase();
    const {data,error}=await client.auth.getUser();if(error||!data.user)throw new Error("Entre na sua conta para jogar online");
    userId=data.user.id;return client;
  }
  async function invoke(action,payload={}) {
    const c=await getClient();
    const {data,error}=await c.functions.invoke("arena-online",{body:{action,payload}});
    if(error){let message;try{message=(await error.context?.clone().json())?.error;}catch{/* network error */}throw new Error(message||error.message||"Não foi possível conectar à arena");}
    if(data?.error)throw new Error(data.error);return data;
  }
  function ownPayload() {if(!nativas.value)throw new Error("Escolha uma Nativa sincronizada. Prepare e sincronize uma ficha no bestiário para jogar online.");return {nativaId:nativas.value,biome:$("#online-arena-biome").value};}
  function remember(value) {try{if(value)sessionStorage.setItem(storedKey(),value);else sessionStorage.removeItem(storedKey());}catch{/* optional recovery */}}
  async function refreshNativas() {
    await getClient();const old=nativas.value;
    const {data,error}=await client.from("nativas").select("id,data").eq("owner_id",userId).is("deleted_at",null);
    if(error)throw new Error("Não foi possível consultar suas fichas sincronizadas");
    nativas.replaceChildren(new Option("Escolha sua Nativa sincronizada",""));
    for(const n of data||[])nativas.add(new Option(`${n.data.name} · nível ${n.data.nivel||1}`,n.id));
    if([...nativas.options].some(o=>o.value===old))nativas.value=old;
    if(!data?.length)tell("Você ainda não tem uma ficha sincronizada. No bestiário, prepare sua Nativa e use Sincronizar agora.");
  }
  function paintMatch(value) {
    if(!value)return;
    if(match?.id===value.id&&value.revision<version)return;
    const changed=value.revision!==version||match?.id!==value.id||match?.ownConfirmed!==value.ownConfirmed||match?.status!==value.status;
    match=value;remember(value.id);
    const waiting=value.status==="waiting";
    $("#online-match-controls").hidden=false;
    $("#online-match-title").textContent=waiting?"Aguardando adversário":value.status==="active"?`Duelo · turno ${value.turn}`:value.status==="completed"?"Duelo encerrado":"Duelo cancelado";
    const code=$("#online-private-code");code.value=value.code||"";code.closest("label").hidden=!value.code||!waiting;
    const cancel=$("#online-match-cancel");cancel.textContent=waiting?"Cancelar convite/busca":value.status==="active"?"Desistir do duelo":"Voltar ao lobby";
    $("#online-match-message").textContent=waiting?(value.mode==="quick"?"Buscando um jogador disponível…":value.mode==="challenge"?"Convite enviado. O jogador precisa aceitar.":"Envie o código ou copie o link para convidar um amigo.")
      :value.status==="active"?(value.ownConfirmed?"Ação confirmada. Aguardando o resultado do turno…":value.opponentConfirmed?"O adversário já confirmou. Escolha sua ação.":"Escolha uma ação e confirme para resolver o turno.")
      :value.reason==="timeout"?"O duelo foi encerrado por inatividade.":value.reason==="forfeit"?"Duelo encerrado por desistência.":"As fichas originais foram preservadas.";
    $("#online-copy-invite").hidden=!waiting||!value.code;
    if(value.state&&changed) {version=value.revision;$("#battle-arena").hidden=false;onMatch(value);}
  }
  function playerRow(player) {
    const row=document.createElement("article");row.className="online-player";
    const text=document.createElement("div"),name=document.createElement("strong"),state=document.createElement("small");
    name.textContent=player.name||"Jogador";state.textContent=player.busy?"Em um duelo":"Disponível para desafio";text.append(name,state);
    const button=document.createElement("button");button.className="small secondary";button.textContent="Desafiar";button.disabled=player.busy||Boolean(match&&["waiting","active"].includes(match.status));
    button.addEventListener("click",()=>{try{void operation("challenge",{...ownPayload(),userId:player.id}).catch(report);}catch(error){report(error);}});
    row.append(text,button);return row;
  }
  function incomingRow(invite) {
    const row=document.createElement("article");row.className="online-player";
    const text=document.createElement("strong");text.textContent=`${invite.name} desafia você com ${invite.nativa}`;
    const accept=document.createElement("button");accept.textContent="Aceitar";accept.className="small";
    accept.addEventListener("click",()=>{try{void operation("accept",{...ownPayload(),matchId:invite.id}).catch(report);}catch(error){report(error);}});
    const reject=document.createElement("button");reject.textContent="Recusar";reject.className="small secondary";
    reject.addEventListener("click",()=>{void invoke("decline",{matchId:invite.id}).then(poll).catch(report);});
    row.append(text,accept,reject);return row;
  }
  function report(error){tell(error.message||"Falha de conexão. Tente novamente.");}
  async function poll() {
    if(!connected||stopped||document.hidden)return;
    try {
      if(Date.now()-lastHeartbeat>20000){await invoke("heartbeat");lastHeartbeat=Date.now();}
      const data=await invoke("lobby");
      const players=$("#online-arena-players"),incoming=$("#online-arena-incoming");
      players.replaceChildren(...data.players.map(playerRow));
      if(!data.players.length){const p=document.createElement("p");p.className="muted";p.textContent="Nenhum outro jogador disponível agora. Convide um amigo para uma sala privada.";players.append(p);}
      incoming.replaceChildren(...data.incoming.map(incomingRow));
      if(!match&&data.current)paintMatch(data.current);
      if(match&&["waiting","active"].includes(match.status))paintMatch(await invoke("snapshot",{matchId:match.id}));
      tell("Conectado · duelos amistosos por turnos, sem recompensas automáticas. Atualização automática ativa.");
    } catch(error){report(error);}
  }
  function schedule(){clearTimeout(timer);if(!connected||stopped)return;timer=setTimeout(async()=>{await poll();schedule();},3000);}
  async function connect() {
    if(connected)return;
    await getClient();connected=true;stopped=false;
    $("#online-connect").textContent="Disponível online";$("#online-connect").disabled=true;
    if(!match){let id;try{id=sessionStorage.getItem(storedKey());}catch{/* no stored match */}if(id){try{paintMatch(await invoke("snapshot",{matchId:id}));}catch{remember(null);}}}
    await poll();schedule();
  }
  async function operation(action,payload) {
    if(busy)return;busy=true;
    try{await connect();tell("Preparando duelo…");paintMatch(await invoke(action,payload));await poll();}
    finally{busy=false;}
  }
  async function setLane(online) {
    if(!online&&match?.status==="active"){tell("Finalize o duelo online antes de trocar de modo.");return;}
    panel.hidden=!online;$(".battle-setup").hidden=online;
    $("#battle-arena").hidden=online&&!match?.state;
    document.querySelectorAll("[data-arena-lane]").forEach(b=>b.setAttribute("aria-pressed",String((b.dataset.arenaLane==="online")===online)));
    if(online){try{await refreshNativas();if(!connected)tell("Conecte-se para encontrar jogadores ou criar um convite privado.");}catch(error){report(error);}}
    else {if(connected){try{await invoke("offline");}catch{/* expires automatically */}connected=false;clearTimeout(timer);$("#online-connect").disabled=false;$("#online-connect").textContent="Ficar disponível online";}match=null;version=-1;remember(null);onLocal();}
  }
  document.querySelectorAll("[data-arena-lane]").forEach(button=>button.addEventListener("click",()=>{void setLane(button.dataset.arenaLane==="online");}));
  for(const biome of BIOMAS)$("#online-arena-biome").add(new Option(biome.nome,biome.nome));
  $("#online-connect").addEventListener("click",()=>{void connect().catch(report);});
  $("#online-refresh-nativas").addEventListener("click",()=>{void refreshNativas().catch(report);});
  $("#online-create-private").addEventListener("click",()=>{try{void operation("private",ownPayload()).catch(report);}catch(error){report(error);}});
  $("#online-quick-match").addEventListener("click",()=>{try{void operation("quick",ownPayload()).catch(report);}catch(error){report(error);}});
  $("#online-join-form").addEventListener("submit",event=>{event.preventDefault();try{let code=$("#online-invite-code").value.trim();try{code=new URL(code).searchParams.get("duelo")||code;}catch{/* raw code */}void operation("join",{...ownPayload(),code}).catch(report);}catch(error){report(error);}});
  $("#online-copy-invite").addEventListener("click",async()=>{try{const link=new URL("./app.html",location.href);link.searchParams.set("duelo",match.code);link.hash="battle";await navigator.clipboard.writeText(link.href);tell("Link copiado. Compartilhe com o jogador que você quer convidar.");}catch{tell("Copie o código do convite para compartilhar.");}});
  $("#online-match-cancel").addEventListener("click",()=>{void (async()=>{if(!match)return;if(["waiting","active"].includes(match.status))paintMatch(await invoke(match.status==="waiting"?"cancel":"forfeit",{matchId:match.id}));else{match=null;version=-1;remember(null);$("#online-match-controls").hidden=true;$("#battle-arena").hidden=true;}await poll();})().catch(report);});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden){void poll();schedule();}});
  window.addEventListener("pagehide",()=>{stopped=true;clearTimeout(timer);});
  const invite=new URL(location.href).searchParams.get("duelo");if(invite){$("#online-invite-code").value=invite;void setLane(true);}
  return {
    async submit(choice,turn){if(!match||match.status!=="active")throw new Error("Duelo não está ativo");const result=await invoke("submit",{matchId:match.id,turn,choice});version=-1;paintMatch(result);await poll();},
    async forfeit(){if(!match||match.status!=="active")throw new Error("Duelo não está ativo");const result=await invoke("forfeit",{matchId:match.id});version=-1;paintMatch(result);await poll();},
    isActive:()=>match?.status==="active",
    isOnline:()=>!panel.hidden
  };
}
