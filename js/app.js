import { updateVisualPicker } from "./visual-picker.js";
import { getArenaPreferences, animationDuration } from "./arena-preferences.js";
import { createCombatPresenter, combatActions, historyActions } from "./arena-sequence.js";
import { defaultPortrait } from "./creature-art.js";
import { requireAuthenticatedUser } from "./session-gate.js";
import { authHref, safeDestination, isAdmin } from "./access.js";
import { arenaPortrait } from "./arena-art.js";
import { initializeArenaFullscreen } from "./arena-fullscreen.js";
import { initializeOnlineArena } from "./online-arena.js";
import { AFINIDADES, GRUPOS_BIOLOGICOS, LINHAGENS, GRUPOS_POR_LINHAGEM, BIOMAS, ARQUETIPOS, normalizarArquetipoLegado } from "./data.js";
import { TECNICAS, obterTecnicaPorId } from "./techniques.js";
import { CATALOGO_TRACOS, CATALOGO_TRACOS_QUIMERICOS, CATALOGO_HABITOS, PERIODOS_BATALHA, nativaPossuiTraco, obterTracoPorId, obterTracosPadraoLinhagem } from "./traits.js";
import { inicializarProgressao, adicionarXP, aumentarAtributo, obterResumoProgressao, xpPorVitoria } from "./progression.js";
import { ESSENCIAS, verificarEssencia, absorverEssencia } from "./essences.js";
import { CONFIG_ESSENCIA_PADRAO, MODOS_RECOMPENSA_ESSENCIA, criarEssenciaPendente, rolarDropEssencia } from "./essence-rewards.js";
import { criarNativa } from "./nativa-domain.js";
import { podeAprenderTecnica, podeUsarTecnicaEmCombate, obterEstadoSeletorTecnica, adicionarTecnicaSelecionada } from "./technique-learning.js";
import { repositorioLocal } from "./repository.js";
import { obterClienteSupabase } from "./auth.js";
import { inicializarSalas } from "./rooms.js";
import { servicoSincronizacao } from "./sync-service.js";
import { estudioImagens, carregarPuter, conectarPuter, erroPuter } from "./art-studio.js";
import { aplicarArteComoRetrato, galeriaImagens } from "./art-gallery.js";
import { criarRegistroUrlsFotosArena } from "./battle-photo-urls.js";
import { enviarRetratoNativa, obterRetratoNativa, removerRetratoNativa } from "./native-portraits.js";
import {
  criarCombatente, obterTecnicasCombatente as tecnicasCombatente,
  avancarCombatentesDeTurno, resolverTurnoCombate
} from "./combat-domain.js";
import { MODOS_BATALHA, escolherAcaoCpu } from "./battle-modes.js";

const $ = selector => document.querySelector(selector);
const LIMITE_TECNICAS = 4;
const CHAVE_CONFIG_ESSENCIA_MESA = "nativa.table.essence-reward.v2";
const DEFINICOES_ATRIBUTOS = [["ATQ","Ataque"],["POT","Potência"],["DEF","Defesa"],["RES","Resistência"],["AGI","Agilidade"],["HP","Vida"],["MP","Pontos de magia"]];
let atributos = Object.fromEntries(DEFINICOES_ATRIBUTOS.map(([key])=>[key,1]));
let tecnicasSelecionadas = new Set();
let batalha = null;
let onlineArena = null;
const apresentador=createCombatPresenter({getBattle:()=>batalha,identity:identidadeEfeitos,preferences:getArenaPreferences,duration:animationDuration,render:renderizarArena,techniques:tecnicasCombatente});
const urlsFotosArena = criarRegistroUrlsFotosArena({
  criarUrl: blob => URL.createObjectURL(blob),
  revogarUrl: url => URL.revokeObjectURL(url)
});
let arteGeradaPendente = null;
let urlPreviaArte = null;
let urlsAcervoArte = [];

function atualizarRotulosModoBatalha(){
  const labelB=$("#fighter-b-label");
  const adversarioAleatorio=$("#fighter-b")?.value==="random";
  if(labelB)labelB.firstChild.textContent=adversarioAleatorio?"Adversário aleatório ":"Nativa da CPU ";
}

function carregarConfigEssenciaMesa(){
  try{
    if(!isAdmin(document.documentElement.dataset.applicationRole))return {...CONFIG_ESSENCIA_PADRAO};
    const key=`${CHAVE_CONFIG_ESSENCIA_MESA}:${document.documentElement.dataset.userId||"admin"}`;
    const salvo=JSON.parse(localStorage.getItem(key)||"null");
    return {modo:CONFIG_ESSENCIA_PADRAO.modo,chanceDrop:Number.isFinite(Number(salvo?.chanceDrop))?Math.max(0,Math.min(100,Number(salvo.chanceDrop))):CONFIG_ESSENCIA_PADRAO.chanceDrop};
  }catch{return {...CONFIG_ESSENCIA_PADRAO};}
}
function salvarConfigEssenciaMesa(config){
  const admin=isAdmin(document.documentElement.dataset.applicationRole);
  const normalizada={modo:MODOS_RECOMPENSA_ESSENCIA.DROP,chanceDrop:admin?Math.max(0,Math.min(100,Number(config.chanceDrop)||0)):CONFIG_ESSENCIA_PADRAO.chanceDrop};
  try{if(admin){const key=`${CHAVE_CONFIG_ESSENCIA_MESA}:${document.documentElement.dataset.userId||"admin"}`;localStorage.setItem(key,JSON.stringify(normalizada));}}catch{}
  const controle=$("#essence-drop-rate");
  const valor=$("#essence-drop-rate-value");
  if(controle&&admin)controle.value=String(normalizada.chanceDrop);
  if(valor)valor.textContent=`${normalizada.chanceDrop}%`;
  return normalizada;
}

const NATIVAS_DE_TESTE = [
  {
    id: "preset-guara",
    name: "Guarã",
    player: "",
    groupBio: "Mamíferos",
    lineage: "Canídeos",
    lineageName: "Canídeos",
    species: "Lobo-guará",
    bioma: "Caatinga e Cerrado",
    affinity: "Fogo",
    archetype: "Predador",
    attrs: {
      ATQ: 5, POT: 2, DEF: 2,
      RES: 3, AGI: 3, HP: 3, MP: 4
    },
    techniques: [
      "linhagem-v2-1-canideos-faro-de-perseguicao",
      "bioma-caatinga-e-cerrado-arrancada-seca",
      "afinidade-fogo-brasa-de-arranque",
      "arquetipo-predador-rasgo-de-abertura"
    ],
    nivel: 1, xp: 0, xpa: 0, estagio: 1,
    essencias: [],
    afinidadesEssencia: [],
    historicoProgressao: [],
    photoId: null
  },

  {
    id: "preset-arua",
    name: "Aruã",
    player: "",
    groupBio: "Peixes",
    lineage: "Characiformes",
    lineageName: "Characiformes",
    species: "Dourado",
    bioma: "Rios, Lagos e Pantanal",
    affinity: "Água",
    archetype: "Infiltrador",
    attrs: {
      ATQ: 2, POT: 5, DEF: 2,
      RES: 3, AGI: 3, HP: 3, MP: 4
    },
    techniques: [
      "linhagem-v2-1-characiformes-mordida-de-piranha",
      "bioma-rios-lagos-e-pantanal-mergulho-repentino",
      "afinidade-agua-jato-direto",
      "arquetipo-infiltrador-golpe-cego"
    ],
    nivel: 1, xp: 0, xpa: 0, estagio: 1,
    essencias: [],
    afinidadesEssencia: [],
    historicoProgressao: [],
    photoId: null
  },

  {
    id: "preset-tatua",
    name: "Tatuá",
    player: "",
    groupBio: "Mamíferos",
    lineage: "Xenartros",
    lineageName: "Xenartros",
    species: "Tatu-canastra",
    bioma: "Floresta e Mata",
    affinity: "Terra",
    archetype: "Guardião",
    attrs: {
      ATQ: 2, POT: 2, DEF: 5,
      RES: 3, AGI: 3, HP: 3, MP: 4
    },
    techniques: [
      "linhagem-v2-1-xenartros-defesa-esferica",
      "bioma-floresta-e-mata-bote-de-emboscada",
      "afinidade-terra-pedra-arremessada",
      "arquetipo-guardiao-muralha-instintiva"
    ],
    nivel: 1, xp: 0, xpa: 0, estagio: 1,
    essencias: [],
    afinidadesEssencia: [],
    historicoProgressao: [],
    photoId: null
  },

  {
    id: "preset-quira",
    name: "Quirã",
    player: "",
    groupBio: "Aves",
    lineage: "Aves corredoras e campestres",
    lineageName: "Aves corredoras e campestres",
    species: "Quero-quero",
    bioma: "Campos Sulinos e Pampa",
    affinity: "Vento",
    archetype: "Infiltrador",
    attrs: {
      ATQ: 2, POT: 2, DEF: 3,
      RES: 5, AGI: 3, HP: 3, MP: 4
    },
    techniques: [
      "linhagem-v2-1-aves-corredoras-e-campestres-chute-de-ema",
      "bioma-campos-sulinos-e-pampa-arrancada-de-coxilha",
      "afinidade-vento-corte-de-ar",
      "arquetipo-infiltrador-golpe-cego"
    ],
    nivel: 1, xp: 0, xpa: 0, estagio: 1,
    essencias: [],
    afinidadesEssencia: [],
    historicoProgressao: [],
    photoId: null
  },

  {
    id: "preset-ecoa",
    name: "Ecoã",
    player: "",
    groupBio: "Mamíferos",
    lineage: "Morcegos",
    lineageName: "Morcegos",
    species: "Morcego-pescador",
    bioma: "Costa, Restinga e Manguezal",
    affinity: "Energia",
    archetype: "Canalizador",
    attrs: {
      ATQ: 2, POT: 2, DEF: 3,
      RES: 3, AGI: 5, HP: 3, MP: 4
    },
    techniques: [
      "linhagem-v2-1-morcegos-ecolocalizacao",
      "bioma-costa-restinga-e-manguezal-investida-de-mare",
      "afinidade-energia-pulso-luminoso",
      "arquetipo-canalizador-condensacao-arcana"
    ],
    nivel: 1, xp: 0, xpa: 0, estagio: 1,
    essencias: [],
    afinidadesEssencia: [],
    historicoProgressao: [],
    photoId: null
  }
];
let nativas = [];
let nativasCarregadas = false;
let versaoRenderLista = 0;
const operacoesPorFicha = new Map();
const fichasEmExclusao = new Set();
const progressaoEmCurso = new Set();
// A origem é metadado local separado do JSON legado. Use os IDs exatos do
// catálogo para reconhecer presets; o prefixo do ID não define elegibilidade.
const origensPresetsProntas = Promise.all(
  NATIVAS_DE_TESTE.map(n => repositorioLocal.registrarOrigemNativa(n.id, "preset").catch(() => null))
);
const idsPresetCatalogo = new Set(NATIVAS_DE_TESTE.map(n => n.id));
async function carregarNativas() {
  let dados = await repositorioLocal.listarNativas();

  // Adiciona as fichas somente uma vez.
  // Não apaga nem substitui Nativas já existentes.
  if (!(await repositorioLocal.presetsJaCarregados())) {
    const idsExistentes = new Set(
      dados.map(n => n.id)
    );

    const novas = NATIVAS_DE_TESTE
      .filter(n => !idsExistentes.has(n.id))
      .map(n => JSON.parse(JSON.stringify(n)));

    dados = [...dados, ...novas];

    await repositorioLocal.salvarNativas(dados);
    await repositorioLocal.marcarPresetsCarregados();
  }

  dados=dados.map(migrarNativa);
  return await mesclarProgressaoRemotaDaConta(dados);
}

async function mesclarProgressaoRemotaDaConta(dados){
  try{
    const client=await obterClienteSupabase();
    const {data:sessionData,error:sessionError}=await client.auth.getSession();if(sessionError)throw sessionError;
    const userId=sessionData?.session?.user?.id;if(!userId)return dados;
    const {data:remoteRows,error}=await client.from("nativas").select("id,owner_id,local_id,format_version,data,revision").is("deleted_at",null);
    if(error)throw error;
    const operations=await repositorioLocal.listarOperacoesSincronizacao();let changed=false;const lineupUpdates=[];
    for(const row of remoteRows||[]){
      if(row.owner_id!==userId)continue;
      const index=dados.findIndex(n=>n.id===row.local_id);if(idsPresetCatalogo.has(row.local_id))continue;
      const pending=operations.some(op=>op.userId===userId&&op.localId===row.local_id&&["pending","blocked","failed","conflict"].includes(op.status));
      if(pending)continue;
      const metadata=await repositorioLocal.obterMetadadosSincronizacao(row.local_id);
      if((metadata?.remoteRevision||0)>=row.revision)continue;
      const normalized=migrarNativa({...row.data,ownerId:userId});
      normalized.progressResetVersion=1;
      normalized.atributosIniciais ||= structuredClone(normalized.attrs);
      normalized.golpesIniciais=normalizarGolpesIniciais(normalized,row.data.golpesIniciais||row.data.techniques);
      normalized.techniques=[...normalized.golpesIniciais];
      if(index<0)dados.push(normalized);else dados[index]=normalized;
      changed=true;
      if(JSON.stringify(normalized)!==JSON.stringify(row.data))lineupUpdates.push(normalized);
      await repositorioLocal.salvarMetadadosSincronizacao(row.local_id,{remoteId:row.id,remoteRevision:row.revision,remoteFormatVersion:row.format_version,syncState:"synced",lastSyncedSnapshot:row.data,localConflictSnapshot:null,remoteConflictSnapshot:null});
    }
    if(changed)await repositorioLocal.salvarNativas(dados);
    for(const native of lineupUpdates)await repositorioLocal.enfileirarSaveSeAssociada(native);
    return dados;
  }catch(error){console.warn("Não foi possível atualizar o bestiário a partir das fichas da conta.",error);return dados;}
}

function migrarNativa(n){
  const preset=NATIVAS_DE_TESTE.find(item=>item.id===n.id);
  if(preset){n.nivel=1;n.xp=0;n.xpTotal=0;n.xpa=0;n.estagio=1;n.attrs=structuredClone(preset.attrs);n.techniques=[...preset.techniques];n.golpesIniciais=[...preset.techniques];n.atributosIniciais=structuredClone(preset.attrs);n.essencias=[];n.afinidadesEssencia=[];n.essenciasDisponiveis=[];n.historicoProgressao=[];}
  n.attrs ||= {ATQ:1,POT:1,DEF:1,RES:1,AGI:1,HP:1,MP:1};
  n.techniques ||= [];
  if (!Array.isArray(n.tracos)) n.tracos = obterTracosPadraoLinhagem(n.lineageName || n.lineage);
  n.tracosQuimericos ||= [];
  n.habitos ||= [];
  n.essenciasDisponiveis ||= [];
  n.species ||= "";
  n.bioma ||= n.habitat || "";
  n.archetype = normalizarArquetipoLegado(n.archetype);
  // Fichas antigas usavam o nome da linhagem no campo lineage.
  if (GRUPOS_POR_LINHAGEM[n.lineage]) {
    n.groupBio ||= GRUPOS_POR_LINHAGEM[n.lineage];
    n.lineageName ||= n.lineage;
  } else {
    n.groupBio ||= n.group || "";
    n.lineageName ||= n.lineage || "";
  }
  n.groupBio ||= "Não informado";
  n.lineageName ||= "Não informada";
  inicializarProgressao(n);
  return n;
}
function normalizarGolpesIniciais(nativa, lista=nativa.golpesIniciais||nativa.techniques||[]){
  const grupos=[["linhagem",nativa.lineageName||nativa.lineage],["bioma",nativa.bioma],["afinidade",nativa.affinity],["arquetipo",nativa.archetype]];
  return grupos.map(([origin,group])=>{
    const previous=lista.map(id=>obterTecnicaPorId(id,{incluirArquivo:false})).find(move=>move?.origem===origin&&move.grupo===group&&podeAprenderTecnica(move));
    return previous||TECNICAS.find(move=>move.origem===origin&&move.grupo===group&&podeAprenderTecnica(move));
  }).filter(Boolean).map(move=>move.id);
}
async function salvarDados(nativaAlterada = null){
  if(nativaAlterada?.photoId&&!nativaAlterada.photoStoragePath){
    try{
      const blob=await obterFoto(nativaAlterada.photoId);
      if(!blob)throw new Error("Arquivo do retrato não encontrado.");
      nativaAlterada.photoStoragePath=await enviarRetratoNativa(nativaAlterada,blob,nativaAlterada.photoId);
    }catch(error){
      const status=$("#bestiary-status");if(status)status.textContent=`Não foi possível enviar o retrato ao servidor: ${error.message}`;
      return {persisted:false,error};
    }
  }
  const colecao = JSON.parse(JSON.stringify(nativas));
  const snapshot = nativaAlterada ? JSON.parse(JSON.stringify(nativaAlterada)) : null;
  if (snapshot?.id && fichasEmExclusao.has(snapshot.id)) {
    const error = new Error("A ficha está sendo excluída e não aceita novas alterações.");
    return { persisted: false, error };
  }
  let resultado;
  try {
    const gravar = () => snapshot
      ? repositorioLocal.salvarNativaComFila(snapshot)
      : repositorioLocal.salvarNativasComFila(colecao);
    resultado = snapshot?.id ? await serializarPorFicha(snapshot.id, gravar) : await gravar();
  } catch (error) {
    const status = $("#bestiary-status");
    if (status) status.textContent = `Não foi possível salvar a alteração local: ${error.message}`;
    return { persisted: false, error };
  }
  atualizarSelectsBatalha();
  void renderizarLista();
  if (resultado.queueError) {
    const status = $("#bestiary-status");
    if (status) status.textContent = `A alteração local foi salva, mas não entrou na fila: ${resultado.queueError.message}`;
  }
  return resultado;
}

function restaurarFicha(nativa, snapshot) {
  for (const chave of Object.keys(nativa)) delete nativa[chave];
  Object.assign(nativa, JSON.parse(JSON.stringify(snapshot)));
}

async function salvarEdicaoNativa(nativa, snapshotAnterior) {
  const resultado = await salvarDados(nativa);
  if (!resultado.persisted) {
    restaurarFicha(nativa, snapshotAnterior);
    atualizarSelectsBatalha();
    void renderizarLista();
  }
  return resultado;
}

function serializarPorFicha(localId, operacao) {
  const anterior = operacoesPorFicha.get(localId) || Promise.resolve();
  const atual = anterior.catch(() => undefined).then(operacao);
  operacoesPorFicha.set(localId, atual);
  const limpar = () => { if (operacoesPorFicha.get(localId) === atual) operacoesPorFicha.delete(localId); };
  void atual.then(limpar, limpar);
  return atual;
}
async function podeEditarFicha(nativa){
  if (typeof nativa?.id !== "string" || !nativa.id.trim()) return true;
  const permissao = await repositorioLocal.podeEditarNativa(nativa.id);
  if (permissao.allowed) return true;
  alert(permissao.reason === "AUTH_REQUIRED"
    ? "Esta ficha está vinculada a uma conta. Entre nessa conta para editá-la."
    : permissao.reason === "FICHA_DELETED"
      ? "Esta ficha já possui uma exclusão registrada e está somente leitura."
    : "Esta ficha está somente leitura para a conta atual.");
  return false;
}
function escapar(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function htmlSinergiasFicha(tecnica,nativa){
  return (tecnica.sinergias||[]).map(sinergia=>{
    const traco=obterTracoPorId(sinergia.tracoId);
    const ativa=nativaPossuiTraco(nativa,sinergia.tracoId);
    const tipo=sinergia.efeito.tipo==="bonus_dano"?`+${sinergia.efeito.valor} dano`:sinergia.efeito.tipo==="bonus_precisao"?`+${sinergia.efeito.valor} precisão`:"efeito adicional";
    return `<p class="muted"><b>${ativa?"Sinergia ativa":"Traço opcional"} · ${escapar(traco?.nome||sinergia.tracoId)}:</b> ${escapar(sinergia.descricao)} (${escapar(tipo)}).</p>`;
  }).join("");
}
function custoCriacao(v){return v*(v+1)/2-1;}
function xpUsado(){return Object.values(atributos).reduce((s,v)=>s+custoCriacao(v),0);}
function preencherSelect(seletor,itens,placeholder){const el=$(seletor);if(!el)return;const atual=el.value;el.innerHTML=`<option value="">${placeholder}</option>`+itens.map(x=>`<option value="${escapar(x.nome)}">${escapar(x.nome)}</option>`).join("");if(itens.some(x=>x.nome===atual))el.value=atual;}
function descricaoSelect(idDesc,idSelect,itens){const el=$(idSelect);const out=$(idDesc);if(!el||!out)return;const item=itens.find(x=>x.nome===el.value);out.textContent=item?.descricao||"Selecione uma opção para conhecer suas características.";}
function configurarFormularios(){
  salvarConfigEssenciaMesa(carregarConfigEssenciaMesa());
  $("#essence-drop-rate")?.addEventListener("input",event=>salvarConfigEssenciaMesa({chanceDrop:event.target.value}));
  $("#essence-drop-reset")?.addEventListener("click",()=>salvarConfigEssenciaMesa(CONFIG_ESSENCIA_PADRAO));
  preencherSelect("#groupBio",GRUPOS_BIOLOGICOS,"Selecione um grupo");
  preencherSelect("#bioma",BIOMAS,"Selecione um bioma");
  preencherSelect("#affinity",AFINIDADES,"Selecione uma afinidade");
  preencherSelect("#archetype",ARQUETIPOS,"Selecione um arquétipo");
  $("#battle-time").innerHTML='<option value="Aleatório">Aleatório</option>'+PERIODOS_BATALHA.map(x=>`<option value="${escapar(x)}">${escapar(x)}</option>`).join("");
  $("#battle-biome").innerHTML='<option value="Aleatório">Aleatório</option>'+BIOMAS.map(x=>`<option value="${escapar(x.nome)}">${escapar(x.nome)}</option>`).join("");
  [ ["#groupBio-description","#groupBio",GRUPOS_BIOLOGICOS],["#bioma-description","#bioma",BIOMAS],["#affinity-description","#affinity",AFINIDADES],["#archetype-description","#archetype",ARQUETIPOS] ].forEach(([d,s,a])=>$(s).addEventListener("change",()=>descricaoSelect(d,s,a)));
  $("#groupBio").addEventListener("change",()=>{
    const grupo=$("#groupBio").value;
    const linhas=LINHAGENS.filter(x=>x.grupo===grupo);
    const select=$("#lineage");select.disabled=!grupo;
    select.innerHTML=`<option value="">${grupo?"Selecione uma linhagem":"Escolha primeiro o grupo biológico"}</option>`+linhas.map(x=>`<option value="${escapar(x.nome)}">${escapar(x.nome)}</option>`).join("");
    $("#lineage-description").textContent="Escolha uma linhagem para ver sua biologia e especialidades.";
    renderizarPerfilLinhagem();renderizarSeletorTecnicas();
  });
  $("#lineage").addEventListener("change",()=>{renderizarPerfilLinhagem();renderizarSeletorTecnicas();});
  ["#bioma","#affinity","#archetype"].forEach(s=>$(s).addEventListener("change",renderizarSeletorTecnicas));
}
$("#native-sound-search")?.addEventListener("click",async()=>{const status=$("#native-sound-status"),term=$("#native-sound-query").value.trim();if(term.length<3){status.textContent="Descreva a vocalização, timbre ou ambiente.";return;}status.textContent="Buscando efeitos recomendados…";try{const client=await obterClienteSupabase();const {data,error}=await client.functions.invoke("epidemic-sound",{body:{action:"search",term}});if(error)throw error;const items=data.soundEffects||data.results||data.items||[];const select=$("#native-sound-choice");select.replaceChildren(new Option("Sem efeito",""));for(const item of items){const id=item.id||item.soundEffectId;if(id)select.add(new Option(`${item.title||"Efeito sonoro"} · ${Math.round(item.length||0)}s`,id));}status.textContent=items.length?`${items.length} sugestões. Os títulos mantêm a descrição completa do catálogo.`:"Nenhum efeito encontrado.";}catch(error){status.textContent="Busca indisponível: "+(error.message||"verifique a configuração do servidor");}});
$("#native-sound-choice")?.addEventListener("change",async event=>{const player=$("#native-sound-preview"),id=event.target.value;if(!id){player.hidden=true;player.removeAttribute("src");return;}try{const client=await obterClienteSupabase();const {data,error}=await client.functions.invoke("epidemic-sound",{body:{action:"preview",id}});if(error)throw error;player.src=data.url;player.hidden=false;$("#native-sound-status").textContent="Prévia temporária — o link expira e não será armazenado.";}catch(error){$("#native-sound-status").textContent="Não foi possível carregar a prévia: "+error.message;}});
function renderizarPerfilLinhagem(){
  const item=LINHAGENS.find(x=>x.nome===$("#lineage").value);const box=$("#lineage-profile");
  if(!item){box.className="lineage-profile empty";box.innerHTML='<span class="eyebrow">GUIA BIOLÓGICO</span><p>Selecione uma linhagem para consultar exemplos, biologia e especialidades.</p>';return;}
  const tecnicas=TECNICAS.filter(t=>t.origem==="linhagem"&&t.grupo===item.nome);
  box.className="lineage-profile";
  box.innerHTML=`<span class="eyebrow">${escapar(item.grupo)} · PERFIL DE LINHAGEM</span><h4>${escapar(item.nome)}</h4><div class="lineage-facts"><div><strong>Exemplos</strong><span>${escapar(item.exemplos)}</span></div><div><strong>Biologia</strong><span>${escapar(item.biologia)}</span></div><div><strong>Especialidades</strong><span>${escapar(item.especialidades)}</span></div></div><p><b>${tecnicas.length} técnicas catalogadas:</b> ${tecnicas.map(t=>escapar(t.nome)).join(" · ")}</p>`;
  $("#lineage-description").textContent=`${item.exemplos} ${item.especialidades}`;
}
function renderizarAtributos(){
  const usado=xpUsado();
  $("#attrs").innerHTML=DEFINICOES_ATRIBUTOS.map(([key,label])=>`<div class="attr"><span><b>${key}</b><small>${label}</small></span><span class="attr-controls"><button type="button" data-down="${key}" aria-label="Diminuir ${key}">−</button><b>${atributos[key]}</b><button type="button" data-up="${key}" aria-label="Aumentar ${key}" ${usado+atributos[key]+1>42?"disabled":""}>＋</button></span></div>`).join("");
  $("#budget").textContent=`${42-usado} XPA livres · use pelo menos 37 e até 42`;
}
$("#attrs").addEventListener("click",e=>{const key=e.target.dataset.up||e.target.dataset.down;if(!key)return;if(e.target.dataset.up&&xpUsado()+atributos[key]+1<=42)atributos[key]++;if(e.target.dataset.down&&atributos[key]>1)atributos[key]--;renderizarAtributos();});
function tecnicasDaOrigem(origem,grupo){return TECNICAS.filter(t=>t.origem===origem&&t.grupo===grupo);}
function textoPrecisao(t){return t.precisao===null?"Sem teste de precisão":`−${Math.abs(t.precisao)} (falha de 1 a ${Math.abs(t.precisao)})`;}
function cartaoTecnica(t){const selected=tecnicasSelecionadas.has(t.id);const origemOcupada=!selected&&[...tecnicasSelecionadas].some(id=>obterTecnicaPorId(id,{incluirArquivo:false})?.origem===t.origem);const locked=tecnicasSelecionadas.size>=LIMITE_TECNICAS;const estado=obterEstadoSeletorTecnica(t,selected,locked);const candidates=(t.sinergiasCandidatas||[]).filter(x=>x.tracoId);const desabilitado=estado.botaoDesabilitado||origemOcupada;const textoBotao=selected?"Adicionada":origemOcupada?"Grupo já escolhido":estado.textoBotao;return `<article class="technique-card"><div class="technique-heading"><b>${escapar(t.nome)}</b><span class="technique-status">${escapar(t.status)}</span></div><p class="technique-meta">${escapar(t.categoria)} · MP ${t.mp??"pendente"} · Recarga ${t.recarga??"pendente"} · Precisão ${textoPrecisao(t)} · Dano ${t.dano??"pendente"}</p><p>${escapar(t.efeito)}</p>${estado.aviso?`<p class="technique-observation">${escapar(estado.aviso)}</p>`:""}${candidates.length?`<p class="muted">Sinergias candidatas: ${candidates.map(x=>escapar(x.nome)).join(", ")} (não aplicadas).</p>`:""}<button type="button" data-add-technique="${escapar(t.id)}" ${desabilitado?"disabled":""}>${textoBotao}</button></article>`;}
function grupoTecnicas(titulo,origem,grupo){const lista=tecnicasDaOrigem(origem,grupo);const vazio=origem==="arquetipo"?"Este arquétipo ainda não possui golpes cadastrados na versão atual.":"Selecione a característica correspondente para visualizar técnicas.";return `<details class="technique-group"><summary>${titulo}<span>${lista.length} técnicas</span></summary><div class="technique-list">${lista.length?lista.map(cartaoTecnica).join(""):`<p class="muted">${vazio}</p>`}</div></details>`;}
function renderizarSeletorTecnicas(){const lineage=$("#lineage").value;$("#technique-groups").innerHTML=[grupoTecnicas("Afinidade","afinidade",$("#affinity").value),grupoTecnicas("Linhagem","linhagem",lineage),grupoTecnicas("Bioma","bioma",$("#bioma").value),grupoTecnicas("Arquétipo","arquetipo",$("#archetype").value)].join("");renderizarTecnicasSelecionadas();}
function renderizarTecnicasSelecionadas(){const ts=TECNICAS.filter(t=>tecnicasSelecionadas.has(t.id));$("#technique-count").textContent=`${ts.length} de ${LIMITE_TECNICAS} golpes · um por grupo`;$("#selected-techniques").innerHTML=ts.length?ts.map(t=>`<div class="selected-technique"><div><b>${escapar(t.nome)}</b><small>${escapar(t.origem)} · ${escapar(t.grupo)}</small></div><button type="button" data-remove-technique="${escapar(t.id)}">Remover</button></div>`).join(""):'<p class="muted">Nenhum golpe selecionado.</p>';}
$("#technique-groups").addEventListener("click",e=>{const id=e.target.dataset.addTechnique;const tecnica=obterTecnicaPorId(id,{incluirArquivo:false});const origemOcupada=tecnica&&[...tecnicasSelecionadas].some(existingId=>obterTecnicaPorId(existingId,{incluirArquivo:false})?.origem===tecnica.origem);if(!id||origemOcupada||!adicionarTecnicaSelecionada(tecnicasSelecionadas,tecnica,LIMITE_TECNICAS))return;renderizarSeletorTecnicas();});
$("#selected-techniques").addEventListener("click",e=>{const id=e.target.dataset.removeTechnique;if(!id)return;tecnicasSelecionadas.delete(id);renderizarSeletorTecnicas();});

const { guardarFoto, obterFoto, removerFoto } = repositorioLocal;

$("#form").addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.currentTarget;
  let sessionUser;
  try { sessionUser=await requireAuthenticatedUser(await obterClienteSupabase()); }
  catch {
    document.documentElement.removeAttribute("data-authenticated");
    location.replace(authHref("login", safeDestination(location.href, location.href)));
    return;
  }
  if (xpUsado() < 37 || xpUsado() > 42) {
    $("#msg").textContent = `Use entre 37 e 42 XPA na criação. Até 5 podem ficar guardados para melhorar atributos depois; você usou ${xpUsado()}.`;
    return;
  }
  if(tecnicasSelecionadas.size!==4){$("#msg").textContent="Escolha quatro golpes: um de linhagem, um de bioma, um de afinidade e um de arquétipo.";return;}
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  const f = new FormData(form);
  const lineage = f.get("lineage");
  const n = criarNativa({
    id: crypto.randomUUID(), name: f.get("name").trim(), player: f.get("player").trim(),
    groupBio: f.get("groupBio"), lineage,
    species: f.get("species").trim(), bioma: f.get("bioma"), affinity: f.get("affinity"),
    archetype: f.get("archetype"), attrs: atributos, techniques: tecnicasSelecionadas
  });
  n.ownerId=sessionUser.id;
  n.xpa = 1 + (42 - xpUsado());
  n.progressResetVersion=1;
  n.atributosIniciais = structuredClone(atributos);
  n.golpesIniciais = [...tecnicasSelecionadas];
  const soundId=$("#native-sound-choice")?.value;const soundTitle=$("#native-sound-choice")?.selectedOptions[0]?.textContent;
  if(soundId)n.soundEffect={provider:"epidemic-sound",id:soundId,title:soundTitle||"Efeito selecionado"};
  nativas.push(n);
  const persisted = await salvarDados();
  if (!persisted.persisted) {
    nativas = nativas.filter(item => item !== n);
    submit.disabled = false;
    return;
  }
  let creationArtError=null;
  if($("#generate-art-on-create")?.checked){try{const art=await estudioImagens.gerar({kind:"nativa",title:n.name,prompt:`Full-body creature concept for a Brazilian fantasy RPG. Species inspiration: ${n.species}. Biological group: ${n.groupBio}. Lineage: ${n.lineageName||n.lineage}. Habitat: ${n.bioma}. Elemental affinity: ${n.affinity}. Combat archetype: ${n.archetype}. ${n.inspiracao||n.inspiration||n.descricao||""}`.slice(0,1400)});const savedArt=await galeriaImagens.salvar(art);const applied=await aplicarArteComoRetrato({artId:savedArt.id,target:n,persist:(nativa,previous)=>salvarEdicaoNativa(nativa,previous)});if(!applied.persisted)throw new Error("A arte foi salva no acervo, mas o retrato não foi vinculado.");}catch(error){creationArtError=error.message;}}
  let origemPreparada = true;
  try {
    await repositorioLocal.registrarOrigemNativa(n.id, "player");
  } catch {
    origemPreparada = false;
  }
  form.reset();
  atributos = Object.fromEntries(DEFINICOES_ATRIBUTOS.map(([k]) => [k, 1]));
  tecnicasSelecionadas.clear();
  $("#lineage").disabled = true;
  $("#lineage").innerHTML = '<option value="">Escolha primeiro o grupo biológico</option>';
  $("#lineage-profile").className = "lineage-profile empty";
  $("#lineage-profile").innerHTML = '<span class="eyebrow">GUIA BIOLÓGICO</span><p>Selecione uma linhagem para consultar exemplos, biologia e especialidades.</p>';
  renderizarAtributos();
  renderizarSeletorTecnicas();
  $("#msg").textContent = origemPreparada
    ? "Nativa salva no bestiário deste navegador."
    : "Nativa salva localmente. Não foi possível preparar seus metadados locais.";
  mostrarTela("list");
  if(creationArtError)$("#bestiary-status").textContent=`Sua Nativa foi criada. A ilustração não foi gerada: ${creationArtError}`;
  submit.disabled = false;
});

function mostrarTela(id){document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===id));document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===id));if(id==="list")void renderizarLista();if(id==="art-studio"||id==="gallery"){void carregarAlvosArte();void renderizarAcervoArte();}if(id==="battle")atualizarSelectsBatalha();if(id==="settings")void atualizarSeletorResetProgressao();document.dispatchEvent(new CustomEvent("nativa:view",{detail:{id}}));}

document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>mostrarTela(b.dataset.view)));
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>mostrarTela(b.dataset.go)));

function renderizarConflitosSync(conflicts){
  const container=$("#sync-conflicts");
  if(!container)return;
  if(!conflicts.length){container.innerHTML="";return;}
  container.innerHTML=conflicts.map(conflict=>{
    const local=conflict.localSnapshot;
    const remote=conflict.remoteSnapshot;
    const canUseRemote=Boolean(remote&&Number.isInteger(conflict.remoteRevision)&&conflict.remoteRevision>0&&conflict.remoteId&&!conflict.remoteDeleted);
    const canRecreate=conflict.resultStatus==="not_found"&&conflict.operationType==="save";
    const localText=local?escapar(JSON.stringify(local,null,2)):"Snapshot local indisponível";
    const remoteText=remote?escapar(JSON.stringify(remote,null,2)):"O servidor não forneceu uma versão remota que possa ser exibida.";
    const resolution=conflict.status==="open"
      ?((canUseRemote||canRecreate)?`<div class="sync-conflict-actions"><button type="button" class="small" data-sync-keep-local="${escapar(conflict.conflictId)}">${canRecreate?"Criar novamente com minha versão":"Manter minha intenção local"}</button>${canUseRemote?`<button type="button" class="small secondary" data-sync-accept-remote="${escapar(conflict.conflictId)}">Usar versão remota</button>`:""}</div>${canRecreate?'<p class="sync-explanation">O servidor informou que não há ficha remota ativa. A escolha cria uma nova operação de criação; nada será enviado até você sincronizar manualmente.</p>':""}`:'<p class="sync-explanation">A resposta não contém uma versão remota ativa suficiente para resolver com segurança. Os dados e as operações locais permanecem preservados.</p>')
      :`<p class="sync-explanation">Resolvido: ${escapar(conflict.resolution||"ação registrada")} em ${escapar(new Date(conflict.resolvedAt).toLocaleString())}. As versões permanecem no histórico local.</p>`;
    return `<article class="sync-conflict"><h4>${conflict.status==="open"?"Conflito":"Histórico de conflito"}: ${escapar(local?.name||conflict.localId)}</h4><p>Detectado em ${escapar(new Date(conflict.detectedAt).toLocaleString())} · operação ${escapar(conflict.operationType)} · resposta ${escapar(conflict.resultStatus)}.</p><p>Revisão remota: ${escapar(conflict.remoteRevision??"desconhecida")} · ${conflict.operationIds?.length||1} operação(ões) local(is) preservada(s).</p><details><summary>Versão local preservada</summary><pre>${localText}</pre></details><details><summary>Versão recebida do servidor</summary><pre>${remoteText}</pre></details>${resolution}</article>`;
  }).join("");
}

async function atualizarPainelSincronizacao(){
  const panel=$("#sync-panel");
  if(!panel)return;
  const sessionLabel=$("#sync-session-state");
  const button=$("#sync-run");
  try{
    const client=await obterClienteSupabase();
    const {data,error}=await client.auth.getSession();
    if(error)throw error;
    const user=data?.session?.user;
    const summary=await repositorioLocal.obterResumoFilaSincronizacao();
    sessionLabel.textContent=user?`Sessão ativa · ${user.email||"jogador"}. A conexão será confirmada ao sincronizar.`:"Sem sessão autenticada. A fila da conta não é exibida.";
    button.disabled=!user||servicoSincronizacao.syncing;
    $("#sync-pending").textContent=summary.pending;
    $("#sync-completed").textContent=summary.completed;
    $("#sync-failed").textContent=summary.failed;
    $("#sync-conflicts-count").textContent=summary.conflicts;
    const [openConflicts, conflictHistory]=await Promise.all([
      repositorioLocal.listarConflitosSincronizacao(),
      repositorioLocal.listarHistoricoConflitosSincronizacao()
    ]);
    renderizarConflitosSync([...openConflicts,...conflictHistory]);
  }catch(error){
    sessionLabel.textContent=`Sessão/serviço indisponível: ${error.message}. O jogo e os dados locais continuam disponíveis.`;
    button.disabled=true;
    $("#sync-pending").textContent="—";$("#sync-completed").textContent="—";$("#sync-failed").textContent="—";$("#sync-conflicts-count").textContent="—";
    renderizarConflitosSync([]);
  }
}

$("#sync-run")?.addEventListener("click",async event=>{
  const button=event.currentTarget;
  const progress=$("#sync-progress");
  button.disabled=true;
  progress.textContent="Preparando a sincronização solicitada…";
  try{
    const result=await servicoSincronizacao.sincronizar({onProgress:update=>{
      if(update.phase==="started")progress.textContent=`Sincronização iniciada: ${update.total} operação(ões) elegível(is).`;
      else if(update.phase==="operation-saved")progress.textContent=`Operação confirmada pelo servidor (${update.processed} processada(s)).`;
      else if(update.phase==="conflict")progress.textContent="Conflito recebido. A sequência desta ficha foi interrompida; nenhuma versão foi mesclada.";
      else if(update.phase==="operation-failed")progress.textContent=`Operação preservada para nova tentativa: ${update.message}`;
    }});
    progress.textContent=`Concluído: ${result.saved} confirmação(ões), ${result.conflicts} conflito(s), ${result.failed} falha(s). Pendentes: ${result.summary.pending}.`;
  }catch(error){progress.textContent=`Sincronização não concluída. A fila local foi preservada: ${error.message}`;}
  finally{await atualizarPainelSincronizacao();await renderizarLista();}
});

$("#sync-conflicts")?.addEventListener("click",async event=>{
  const keepId=event.target.closest("[data-sync-keep-local]")?.dataset.syncKeepLocal;
  const remoteId=event.target.closest("[data-sync-accept-remote]")?.dataset.syncAcceptRemote;
  if(!keepId&&!remoteId)return;
  const progress=$("#sync-progress");
  try{
    if(keepId){
      if(!confirm("Preservar sua intenção local e criar uma nova operação com a revisão remota atual? Nada será enviado até você clicar em “Sincronizar agora” novamente."))return;
      await repositorioLocal.resolverConflitoManterLocal(keepId);
      progress.textContent="Sua intenção local foi preservada em uma nova operação. Clique em “Sincronizar agora” para enviá-la.";
    }else{
      if(!confirm("Substituir a ficha ativa local pela versão remota? A versão local atual e as operações pendentes serão guardadas no histórico do conflito."))return;
      const resolution=await repositorioLocal.resolverConflitoAceitarRemoto(remoteId);
      nativas=(await repositorioLocal.listarNativas()).map(migrarNativa);
      atualizarSelectsBatalha();
      if(resolution?.rollbackError)throw new Error(`A atualização do armazenamento falhou e a restauração também falhou: ${resolution.rollbackError.message}`);
      progress.textContent="Versão remota aplicada. A versão local anterior permanece recuperável no histórico do conflito.";
    }
    await atualizarPainelSincronizacao();
    await renderizarLista();
  }catch(error){progress.textContent=`Não foi possível resolver o conflito: ${error.message}`;}
});

async function carregarAlvosArte(){
  const available=[];
  for(const n of nativas){
    if(!n?.id||idsPresetCatalogo.has(n.id))continue;
    try{if((await repositorioLocal.podeEditarNativa(n.id)).allowed)available.push(n);}catch{}
  }
  for(const selector of ["#art-target-nativa","#art-studio-target"]){const select=$(selector);if(!select)continue;const selected=select.value;const empty=selector==="#art-studio-target"?"Salvar apenas no acervo":"Escolha uma ficha editável";select.innerHTML=`<option value="">${empty}</option>`+available.map(n=>`<option value="${escapar(n.id)}">${escapar(n.name||n.id)}</option>`).join("");if(available.some(n=>n.id===selected))select.value=selected;}
}
$("#art-studio-target")?.addEventListener("change",()=>{const n=nativas.find(item=>item?.id===$("#art-studio-target").value);if(!n)return;$("#art-kind").value="nativa";$("#art-title").value=n.name||"Nativa";const inspirations=[n.descricao,n.description,n.inspiracao,n.inspiration,n.visualDescription].filter(value=>typeof value==="string"&&value.trim());$("#art-prompt").value=["Espécie: "+(n.species||"")+". Linhagem: "+(n.lineageName||n.lineage||"")+". Habitat: "+(n.bioma||"")+". Afinidade: "+(n.affinity||"")+". Arquétipo: "+(n.archetype||"")+".",...inspirations].join(" ").slice(0,1400);});

async function renderizarAcervoArte(){
  const gallery=$("#art-gallery");
  if(!gallery)return;
  urlsAcervoArte.forEach(url=>URL.revokeObjectURL(url));
  urlsAcervoArte=[];
  try{
    const items=await galeriaImagens.listar();
    const warnings=galeriaImagens.obterAvisos().map(message=>`<p role="status">${escapar(message)}</p>`).join("");
    if(!items.length){gallery.innerHTML=warnings+'<p class="muted">Nenhuma imagem salva nesta conta ainda.</p>';return;}
    const labels={nativa:"Nativa",biome:"Bioma",technique:"Técnica/golpe",other:"Outra ideia"};
    const cards=await Promise.all(items.map(async item=>{
      const blob=await galeriaImagens.obterArquivo(item);
      if(!blob)return "";
      const url=URL.createObjectURL(blob);urlsAcervoArte.push(url);
      return `<article class="art-item"><img src="${url}" alt="Arte: ${escapar(item.title)}"><div class="art-item-body"><span class="tag">${escapar(labels[item.kind]||"Arte")}</span><h4>${escapar(item.title)}</h4><p>Salva ${escapar(new Date(item.createdAt).toLocaleString())}</p><details><summary>Descrição</summary><p>${escapar(item.prompt)}</p></details>${item.kind==="nativa"?`<button type="button" class="small secondary" data-art-apply="${escapar(item.id)}">Aplicar como retrato</button>`:""}</div></article>`;
    }));
    gallery.innerHTML=warnings+(cards.filter(Boolean).join("")||'<p class="muted">Não foi possível carregar os arquivos do servidor. Tente novamente.</p>');
  }catch(error){gallery.innerHTML=`<p role="status">Não foi possível abrir o acervo da conta: ${escapar(error.message)}</p>`;}
}

const puterConnect=$("#art-connect-puter");
async function prepararConexaoPuter(){
  if(!puterConnect)return;
  try{const sdk=await carregarPuter();const connected=await sdk.auth.isSignedIn();puterConnect.disabled=false;puterConnect.textContent=connected?"Conta Puter conectada":"Conectar conta Puter";$("#puter-connection-status").textContent=connected?"Pronto para gerar imagens com sua conta Puter.":"Conecte uma conta Puter para liberar a geração.";}
  catch(error){puterConnect.disabled=false;puterConnect.textContent="Tentar carregar Puter";$("#puter-connection-status").textContent=error.message;}
}
puterConnect?.addEventListener("click",()=>{
  if(!globalThis.puter?.auth?.signIn){void prepararConexaoPuter();return;}
  puterConnect.disabled=true;
  try{Promise.resolve(conectarPuter()).then(()=>prepararConexaoPuter()).catch(error=>{$("#puter-connection-status").textContent=erroPuter(error);puterConnect.disabled=false;});}catch(error){$("#puter-connection-status").textContent=erroPuter(error);puterConnect.disabled=false;}
});
document.addEventListener("nativa:view",event=>{if(["art-studio","create"].includes(event.detail.id))void prepararConexaoPuter();});
void prepararConexaoPuter();

$("#art-generation-form")?.addEventListener("submit",async event=>{
  event.preventDefault();
  const status=$("#art-status");
  const button=$("#art-generate");
  if(arteGeradaPendente&&!confirm("Descartar a prévia atual que ainda não foi salva e iniciar outra geração?"))return;
  button.disabled=true;
  status.textContent="Gerando com o Puter… A operação pode consumir o saldo da sua conta Puter.";
  try{
    const result=await estudioImagens.gerar({
      kind:$("#art-kind").value,
      title:$("#art-title").value,
      prompt:$("#art-prompt").value,
      onProgress:progress=>{
        status.textContent=progress.phase==="downloading"?"Imagem pronta no Puter. Baixando para a prévia…":"Gerando com o Puter… Aguarde sem iniciar outra geração.";
      }
    });
    if(urlPreviaArte)URL.revokeObjectURL(urlPreviaArte);
    arteGeradaPendente=result;
    urlPreviaArte=URL.createObjectURL(result.blob);
    $("#art-preview-image").src=urlPreviaArte;
    $("#art-preview").hidden=false;
    $("#art-save").disabled=false;
    status.textContent=`Imagem pronta${result.fallbackUsed?` com o modelo alternativo ${result.model}`:""}. Salve no acervo para mantê-la na sua conta.`;
  }catch(error){status.textContent=`Não foi possível gerar a imagem: ${error.message}`;}
  finally{button.disabled=false;}
});

$("#art-save")?.addEventListener("click",async event=>{
  const button=event.currentTarget;
  if(!arteGeradaPendente)return;
  button.disabled=true;
  try{
    let statusText="Imagem salva no acervo da sua conta no servidor e desta conta.";
    const entry=await galeriaImagens.salvar(arteGeradaPendente);
    const targetId=$("#art-studio-target")?.value;
    const target=nativas.find(n=>n?.id===targetId);
    if(target&&await podeEditarFicha(target)){
      const attached=await aplicarArteComoRetrato({artId:entry.id,target,persist:(nativa,previous)=>salvarEdicaoNativa(nativa,previous)});
      if(attached.persisted)statusText="Imagem salva no acervo e vinculada à ficha.";
    }
    arteGeradaPendente=null;
    $("#art-status").textContent=statusText;
    await renderizarAcervoArte();
  }catch(error){
    $("#art-status").textContent=`A imagem não foi registrada no acervo: ${error.message}${error.rollbackError?" O arquivo temporário pode precisar de limpeza posterior.":""}`;
    button.disabled=false;
  }
});

$("#art-gallery")?.addEventListener("click",async event=>{
  const artId=event.target.closest("[data-art-apply]")?.dataset.artApply;
  if(!artId)return;
  const targetId=$("#art-target-nativa")?.value;
  const target=nativas.find(n=>n?.id===targetId);
  if(!target){alert("Escolha uma Nativa editável na lista acima.");return;}
  if(!await podeEditarFicha(target))return;
  if(!confirm(`Aplicar esta arte como retrato de ${target.name||"Nativa"}? A imagem original do acervo será preservada.`))return;
  try{
    const result=await aplicarArteComoRetrato({artId,target,persist:(nativa,previous)=>salvarEdicaoNativa(nativa,previous)});
    if(!result.persisted)return;
    $("#art-status").textContent=`Retrato salvo no servidor e aplicado a ${target.name}. O arquivo original permanece no acervo.`;
    await renderizarLista();
  }catch(error){
    $("#art-status").textContent=`Não foi possível aplicar a imagem: ${error.message}`;
  }
});

function afinidadeVisualCard(afinidade){
  const normalizada=String(afinidade||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
  return ({fogo:"fogo",agua:"agua",terra:"terra",vento:"ar",ar:"ar",energia:"energia"})[normalizada]||"neutro";
}

function abasAtivasBestiario(){
  return new Map([...$("#cards").querySelectorAll(".card")].map(card=>[
    card.dataset.card,
    card.querySelector(".profile-tabs [data-profile-tab].active")?.dataset.profileTab||"overview"
  ]));
}

function personalizarCardsBestiario(abAsAtivas){
  const valorSeguro=valor=>escapar(valor??"—");
  $("#cards").querySelectorAll(".card").forEach(card=>{
    const indice=Number(card.dataset.cardIndex),n=nativas[indice];
    if(!n)return;
    const afinidade=afinidadeVisualCard(n.affinity);
    card.dataset.affinity=afinidade;
    card.classList.add(`affinity-${afinidade}`);
    const ambience=document.createElement("div");ambience.className="card-affinity-ambience";ambience.setAttribute("aria-hidden","true");
    card.prepend(ambience);

    const affinityTag=card.querySelector(".card-top > .tag");
    if(affinityTag){affinityTag.classList.add("affinity-tag");affinityTag.dataset.affinity=afinidade;}

    const factParagraphs=[...card.querySelectorAll(":scope > .card-body > p:not(.sync-state)")].slice(0,2);
    if(factParagraphs.length===2){
      const facts=document.createElement("div");facts.className="creature-facts";
      const values=[
        [n.lineageName||n.lineage,n.species].filter(Boolean).join(" · ")||factParagraphs[0].textContent,
        [n.bioma,n.archetype].filter(Boolean).join(" · ")||factParagraphs[1].textContent
      ];
      const labels=["LINHAGEM E ESPÉCIE","BIOMA E ARQUÉTIPO"];
      factParagraphs.forEach((paragraph,index)=>{
        paragraph.className=`creature-fact creature-fact-${index===0?"lineage":"habitat"}`;
        paragraph.innerHTML=`<small>${labels[index]}</small><span>${valorSeguro(values[index])}</span>`;
        facts.append(paragraph);
      });
      card.querySelector(".card-top")?.after(facts);
    }

    const imageTab=card.querySelector('[data-profile-tab="images"]');
    if(imageTab){imageTab.dataset.profileTab="attributes";imageTab.textContent="Atributos";}
    card.querySelector('[data-profile-pane="images"]')?.remove();
    const oldStats=card.querySelector('.stat-chips[data-profile-pane="overview"]');
    const resumo=obterResumoProgressao(n);
    const overview=document.createElement("section");overview.className="profile-overview";overview.dataset.profilePane="overview";
    overview.innerHTML=`<span class="eyebrow">PERFIL DA NATIVA</span><strong>${valorSeguro(n.species||n.groupBio||n.lineageName||n.lineage)}</strong><p>Vínculo ${valorSeguro(n.lineageName||n.lineage)} · ${valorSeguro(n.archetype)} · nível ${resumo.nivel}.</p>`;
    const attributes=document.createElement("section");attributes.className="profile-attributes";attributes.dataset.profilePane="attributes";
    const cardsAtributos=DEFINICOES_ATRIBUTOS.map(([key,label])=>{
      const valor=Number(n.attrs?.[key])||1,custo=valor+1,insuficiente=resumo.xpaDisponivel<custo;
      return `<article class="profile-attribute" data-attribute="${key}"><div class="attribute-rune" aria-hidden="true">${key}</div><div class="attribute-value"><strong>${valor}</strong><span>${label}</span></div><button type="button" class="attribute-up" data-profile-attribute="${key}" data-index="${indice}" aria-label="Aumentar ${label} de ${valorSeguro(n.name)} para ${valor+1} por ${custo} XPA" ${card.classList.contains("card-readonly")||insuficiente?"disabled":""}>＋</button><small class="attribute-cost">PRÓXIMO · ${custo} XPA</small></article>`;
    }).join("");
    attributes.innerHTML=`<div class="attributes-console"><div><span class="eyebrow">EVOLUÇÃO · NÍVEL ${resumo.nivel}</span><strong>Potencial disponível</strong></div><b>${resumo.xpaDisponivel} <small>XPA</small></b></div><div class="profile-attribute-grid">${cardsAtributos}</div><div class="derived-vitals"><div><span>PV MÁXIMO</span><strong>${(Number(n.attrs?.HP)||1)*5}</strong></div><div><span>MP MÁXIMO</span><strong>${(Number(n.attrs?.MP)||1)*2}</strong></div></div>`;
    if(oldStats){oldStats.replaceWith(overview);overview.after(attributes);}
    card.querySelector(".progress-panel > .technique-group")?.remove();

    const aba=abAsAtivas.get(card.dataset.card)||"overview";
    card.querySelectorAll("[data-profile-tab]").forEach(button=>button.classList.toggle("active",button.dataset.profileTab===aba));
    card.querySelectorAll("[data-profile-pane]").forEach(pane=>pane.hidden=pane.dataset.profilePane!==aba);
  });
}

async function renderizarLista(){
  if (!nativasCarregadas) return;
  const abas=abasAtivasBestiario();
  const versao = ++versaoRenderLista;
  const fichasParaRenderizar = JSON.parse(JSON.stringify(nativas));
  await origensPresetsProntas;
  if (versao !== versaoRenderLista) return;
  $("#count").textContent=fichasParaRenderizar.length;
  document.dispatchEvent(new CustomEvent("nativa:updated"));
  const statusEl=$("#bestiary-status");
  if(!fichasParaRenderizar.length){if(versao!==versaoRenderLista)return;$("#cards").innerHTML='<div class="form-panel"><p class="muted">Seu bestiário está vazio. Crie sua primeira Nativa para começar.</p></div>';if(statusEl)statusEl.textContent="";return;}
  const ids=fichasParaRenderizar.map(n=>typeof n.id==="string"&&n.id.trim()?n.id:null).filter(Boolean);
  let sync;
  try { sync=await repositorioLocal.obterEstadosSincronizacao(ids); }
  catch (error) {
    if (versao === versaoRenderLista && statusEl) statusEl.textContent=`Não foi possível consultar o estado local da fila: ${error.message}`;
    return;
  }
  if (versao !== versaoRenderLista) return;
  const contagemIds=new Map();
  for(const n of fichasParaRenderizar)if(typeof n.id==="string"&&n.id.trim())contagemIds.set(n.id,(contagemIds.get(n.id)||0)+1);
  const html=await Promise.all(fichasParaRenderizar.map(async(n,index)=>{
    const idValido=typeof n.id==="string"&&Boolean(n.id.trim());
    const estado=idValido?sync.byLocalId[n.id]:null;
    const origem=estado?.origin||null;
    const preset=origem==="preset"||idsPresetCatalogo.has(n.id);
    const idDuplicado=idValido&&(contagemIds.get(n.id)||0)>1;
    const idInvalido=Object.prototype.hasOwnProperty.call(n,"id")&&!idValido;
    const somenteLeitura=estado?!estado.canEdit:false;
    const bloquearAssociacao=!sync.sessionAvailable||preset||idDuplicado||idInvalido||(estado&&!estado.canAssociate);
    let estadoTexto=preset?"Preset · local":idDuplicado?"ID duplicado · associação bloqueada":idInvalido?"ID inválido · associação bloqueada":"Local · não associada · somente neste navegador";
    if(estado?.associationState==="current-account")estadoTexto="Associada à sua conta · não enviada";
    else if(estado?.associationState==="deleted")estadoTexto="Exclusão registrada · finalize a remoção local";
    else if(estado?.associationState==="legacy-account")estadoTexto="Vínculo anterior · confirme para continuar";
    else if(estado?.associationState==="other-account")estadoTexto="Somente leitura · associada a outra conta";
    else if(estado?.associationState==="no-session")estadoTexto="Somente leitura · entre na conta associada";
    else if(estado?.associationState==="ambiguous")estadoTexto="Somente leitura · vínculo entre contas ambíguo";
    if(estado?.queueCount)estadoTexto+=` · fila local ${estado.pendingCount} pendente${estado.pendingCount===1?"":"s"}${estado.hasBlockedOperations?", dependência ou resolução necessária":""} · ainda não enviada`;
    const foto=await obterRetratoNativa(n);let photoUrl=foto?URL.createObjectURL(foto):defaultPortrait(n);const t=(n.techniques||[]).map(id=>obterTecnicaPorId(id)).filter(Boolean);const maxHP=(n.attrs.HP||1)*5,maxMP=(n.attrs.MP||1)*2;const resumo=obterResumoProgressao(n);const essenciasGuardadas=(n.essenciasDisponiveis||[]).map(x=>x.oponenteNome||"Combate");const fotoHtml=photoUrl?`<img class="creature-photo" src="${photoUrl}" alt="Retrato de ${escapar(n.name)}">`:'<div class="photo-placeholder">✦</div>';
    const idCard=idValido?n.id:`ficha-local-${index}`;
    const disabled=somenteLeitura?"disabled":"";
    const deleteDisabled=somenteLeitura&&estado?.associationState!=="deleted"?"disabled":"";
    const associationAction=(!preset&&!somenteLeitura&&!bloquearAssociacao)
      ?`<button type="button" class="small secondary" data-associate-index="${index}">${estado?.associationState==="legacy-account"?"Confirmar vínculo com esta conta":"Preparar para fila local"}</button>`:"";
    const associationHelp=associationAction?'<small class="sync-explanation">Prepara uma cópia local da ficha para esta conta. Não envia dados pela internet.</small>':"";
    const missingIdHelp=!idValido&&!idInvalido&&!preset?'<small class="sync-explanation">Ao preparar a ficha, será criado e salvo um ID local estável.</small>':"";
    const unassociatedHelp=!sync.sessionAvailable&&!preset&&!somenteLeitura?'<small class="sync-explanation">A ficha continua local e editável. Entre na conta para associá-la explicitamente.</small>':"";
    const listaTracos=(n.tracos||[]).map(id=>CATALOGO_TRACOS.find(x=>x.id===id)).filter(Boolean);
    const tracosHtml=listaTracos.length?listaTracos.map(x=>`<details class="profile-trait"><summary>${escapar(x.nome)} <span class="muted">· ${escapar(x.categoria)}</span></summary><p>${escapar(x.descricao)}</p></details>`).join(""):'<p class="muted">Nenhum traço cadastrado.</p>';
    const listaHabitos=(n.habitos||[]).map(id=>CATALOGO_HABITOS.find(x=>x.id===id)||{id,nome:id,categoria:"Hábito"});const listaTracosQuimericos=(n.tracosQuimericos||[]).map(valor=>CATALOGO_TRACOS_QUIMERICOS.find(x=>x.id===valor||x.nome.toLocaleLowerCase("pt-BR")===String(valor).toLocaleLowerCase("pt-BR"))||{nome:valor,categoria:"Traço quimérico",descricao:"Definição ainda não incluída no catálogo global."});
    return `<article class="card ${somenteLeitura?"card-readonly":""}" data-card="${escapar(idCard)}" data-card-index="${index}">${fotoHtml}<div class="card-body"><div class="card-top"><div><h3>${escapar(n.name)}</h3><span class="tag">Nível ${resumo.nivel} · Estágio ${resumo.estagio}</span></div><span class="tag">${escapar(n.affinity)}</span></div><p>${escapar(n.groupBio)} · ${escapar(n.lineageName||n.lineage)}${n.species?` · ${escapar(n.species)}`:""}</p><p>${escapar(n.bioma)} · ${escapar(n.archetype)}${n.player?` · Jogador: ${escapar(n.player)}`:""}</p><p class="sync-state" role="status">${escapar(estadoTexto)}</p>${associationHelp}${missingIdHelp}${unassociatedHelp}<nav class="profile-tabs" aria-label="Abas da ficha"><button type="button" class="active" data-profile-tab="overview">Visão geral</button><button type="button" data-profile-tab="biology">Traços e hábitos</button><button type="button" data-profile-tab="techniques">Golpes</button><button type="button" data-profile-tab="images">Imagens criadas</button></nav><div class="stat-chips" data-profile-pane="overview">${DEFINICOES_ATRIBUTOS.map(([k])=>`<span>${k} ${n.attrs[k]||1}</span>`).join("")}<span>HP ${maxHP}</span><span>MP ${maxMP}</span></div><section class="profile-biology" data-profile-pane="biology" hidden><h4>Traços</h4><p>${tracosHtml}</p><h4>Traços Quiméricos</h4>${listaTracosQuimericos.length?listaTracosQuimericos.map(x=>`<details class="profile-trait"><summary>${escapar(x.nome)} <span class="muted">· ${escapar(x.categoria)}</span></summary><p>${escapar(x.descricao||"Sem descrição cadastrada.")}</p></details>`).join(""):"<p>Nenhum registrado.</p>"}<h4>Hábitos</h4>${listaHabitos.length?listaHabitos.map(x=>`<details class="profile-trait"><summary>${escapar(x.nome)} <span class="muted">· ${escapar(x.categoria)}</span></summary><p>${escapar(x.descricao||"Sem descrição cadastrada.")}</p></details>`).join(""):"<p>Nenhum hábito cadastrado.</p>"}</section><section class="profile-techniques" data-profile-pane="techniques" hidden><h4 style="margin-top:13px">Golpes (${t.length})</h4>${t.length?t.map(x=>`<details class="technique-detail"><summary>${escapar(x.nome)} · ${escapar(x.categoria)} · MP ${x.mp??"pendente"} · dano ${x.dano??"—"}</summary><p>${escapar(x.efeito)}</p>${x.estadoCatalogo==="em-revisao"?'<p class="muted">Em revisão. Não pode ser usado em combate até receber aprovação.</p>':x.estadoCatalogo==="arquivado"?'<p class="muted">Golpe arquivado; disponível apenas para preservar fichas antigas.</p>':''}${htmlSinergiasFicha(x,n)}</details>`).join(""):'<p class="muted">Nenhum golpe cadastrado.</p>'}</section><section data-profile-pane="images" hidden><p>Arte gerada para Nativas, técnicas e ataques fica no acervo desta conta.</p><button type="button" class="small secondary" data-go="gallery">Abrir imagens criadas</button><button type="button" class="small secondary" data-go="art-studio">Criar imagem</button></section>
    <div class="progress-panel"><h4>Progressão</h4><div class="progress-grid"><div><strong>${resumo.xpAtual}/${resumo.xpNecessario}</strong><span>${resumo.nivel>=17?"Nível máximo temporário · 17":"XP para próximo nível"} · ${resumo.xpAcumulado} acumulado</span></div><div><strong>${resumo.xpaDisponivel}</strong><span>XPA disponível</span></div><div><strong>${(n.essencias||[]).length}/3</strong><span>Essências absorvidas</span></div><div><strong>${(n.essenciasDisponiveis||[]).length}</strong><span>Essências guardadas</span></div></div>${essenciasGuardadas.length?`<p class="pending-essences">Guardadas de: ${essenciasGuardadas.map(escapar).join(" · ")}</p>`:""}<div class="progress-controls"><button type="button" class="small secondary" data-essence-index="${index}" ${disabled}>Essência</button></div><details class="technique-group"><summary>Atributos · gastar XPA</summary><div class="stat-chips">${DEFINICOES_ATRIBUTOS.map(([key,label])=>`<span>${key} ${label}: ${n.attrs[key]||1} <button type="button" data-profile-attribute="${key}" data-index="${index}" ${disabled||resumo.xpaDisponivel<((n.attrs[key]||1)+1)?"disabled":""}>＋</button></span>`).join("")}</div></details></div>
    <div class="card-actions">${associationAction}<label class="small secondary ${somenteLeitura?"disabled-label":""}" style="display:inline-flex;align-items:center;gap:7px;padding:8px 10px;border-radius:8px;cursor:pointer">${n.photoId?"Trocar foto":"Adicionar foto"}<input type="file" accept="image/*" data-photo-index="${index}" ${disabled} hidden></label>${n.photoId?`<button type="button" class="small secondary" data-remove-photo-index="${index}" ${disabled}>Remover foto</button>`:""}<button type="button" class="small danger" data-delete-index="${index}" data-delete-retry="${estado?.associationState==="deleted"?"true":"false"}" ${deleteDisabled}>Excluir</button></div></div></article>`;
  }));
  if (versao === versaoRenderLista){$("#cards").innerHTML=html.join("");personalizarCardsBestiario(abas);personalizarPainelBiologicoGlobal();}
}
function personalizarPainelBiologicoGlobal(){
  const admin=isAdmin(document.documentElement.dataset.applicationRole);
  document.querySelectorAll("#cards [data-edit-traits], #cards [data-edit-chimeric], #cards [data-edit-habits]").forEach(button=>button.remove());
  if(!admin)return;
  document.querySelectorAll("#cards [data-profile-pane=biology]").forEach(pane=>{
    if(pane.querySelector("[data-open-global-catalog]"))return;
    const button=document.createElement("button");button.type="button";button.className="small secondary";button.dataset.openGlobalCatalog="true";button.dataset.go="admin";button.textContent="Gerenciar catálogo global";pane.append(button);
  });
}
document.addEventListener("nativa:global-catalog-updated",()=>{void renderizarLista();});
function nativaNoIndice(valor){const indice=Number(valor);return Number.isInteger(indice)&&indice>=0&&indice<nativas.length?nativas[indice]:null;}
$("#cards").addEventListener("click",async e=>{
  const aba=e.target.closest("[data-profile-tab]");
  if(aba){const card=aba.closest(".card");card.querySelectorAll("[data-profile-tab]").forEach(button=>button.classList.toggle("active",button===aba));card.querySelectorAll("[data-profile-pane]").forEach(pane=>pane.hidden=pane.dataset.profilePane!==aba.dataset.profileTab);return;}
  const associateIndex=e.target.dataset.associateIndex;
  if(associateIndex!==undefined){
    const statusEl=$("#bestiary-status");
    const n=nativaNoIndice(associateIndex);if(!n)return;
    const tinhaId=Object.prototype.hasOwnProperty.call(n,"id");
    if(tinhaId&&(typeof n.id!=="string"||!n.id.trim())){alert("Esta ficha tem um ID local inválido. A associação foi bloqueada para preservar sua identidade.");return;}
    if(!tinhaId){
      if(!globalThis.crypto?.randomUUID){alert("Este navegador não pode gerar um ID local seguro para a ficha.");return;}
      n.id=crypto.randomUUID();
      try{await repositorioLocal.salvarNativas(nativas);}catch(error){delete n.id;alert(`Não foi possível salvar o novo ID local: ${error.message}`);return;}
    }
    if(nativas.filter(item=>item?.id===n.id).length!==1){alert("Há fichas com o mesmo ID local. Resolva a duplicidade antes de associar.");return;}
    try{
      const resultado=await repositorioLocal.associarNativaAConta(JSON.parse(JSON.stringify(n)));
      if(statusEl)statusEl.textContent=resultado.alreadyAssociated?"Esta ficha já estava associada à conta atual.":"Ficha preparada na fila local. Nenhum dado foi enviado pela internet.";
      await renderizarLista();
    }catch(error){
      if(statusEl)statusEl.textContent=`Não foi possível preparar a ficha: ${error.message}`;
      await renderizarLista();
    }
    return;
  }

  const deleteIndex=e.target.dataset.deleteIndex;
  if(deleteIndex!==undefined){
    const n=nativaNoIndice(deleteIndex);if(!n)return;
    const retryTombstone=e.target.dataset.deleteRetry==="true";
    if(!retryTombstone&&!await podeEditarFicha(n))return;
    if((typeof n.id!=="string"||!n.id.trim())&&!globalThis.crypto?.randomUUID){alert("Não foi possível preservar a exclusão desta ficha neste navegador.");return;}
    const localId=typeof n.id==="string"&&n.id.trim()?n.id:crypto.randomUUID();
    const origem=typeof n.id==="string"&&n.id.trim()?await repositorioLocal.obterOrigemNativa(n.id):null;
    if(fichasEmExclusao.has(localId))return;
    fichasEmExclusao.add(localId);
    try {
      await serializarPorFicha(localId, async () => {
        if(origem?.origin==="preset"||idsPresetCatalogo.has(n.id)){
          const restantes=nativas.filter(item=>item!==n);
          try{await repositorioLocal.salvarNativas(restantes);}catch(error){alert("A ficha permaneceu no bestiário. " + error.message);return;}
          nativas=restantes;void renderizarLista();atualizarSelectsBatalha();return;
        }
        try{await repositorioLocal.registrarExclusaoLocal({operationId:crypto.randomUUID(),localId,snapshot:JSON.parse(JSON.stringify(n))});}
        catch(error){alert(`Não foi possível registrar a exclusão local. A ficha permaneceu no bestiário. ${error.message}`);return;}
        const restantes=nativas.filter(item=>item!==n);
        try{
          if(typeof n.id==="string"&&n.id.trim())await repositorioLocal.excluirNativa(n.id);
          else await repositorioLocal.salvarNativas(restantes);
        }catch(error){alert(`O tombstone foi preservado, mas não foi possível atualizar o bestiário. A ficha continua disponível localmente. ${error.message}`);return;}
        nativas=restantes;void renderizarLista();atualizarSelectsBatalha();
      });
    } finally { fichasEmExclusao.delete(localId); }
    return;
  }

  const photoRemoveIndex=e.target.dataset.removePhotoIndex;
  if(photoRemoveIndex!==undefined){const n=nativaNoIndice(photoRemoveIndex);if(!n||!await podeEditarFicha(n))return;const anterior=JSON.parse(JSON.stringify(n));const photoId=n.photoId,storagePath=n.photoStoragePath;n.photoId=null;n.photoStoragePath=null;const resultado=await salvarEdicaoNativa(n,anterior);if(resultado.persisted){if(photoId)await removerFoto(photoId);if(storagePath)await removerRetratoNativa(storagePath);}return;}
  const attributeIndex=e.target.dataset.index;
  const attribute=e.target.dataset.profileAttribute;
  if(attribute&&attributeIndex!==undefined){const n=nativaNoIndice(attributeIndex);if(!n||!await podeEditarFicha(n))return;const lock=n.id||`indice:${attributeIndex}`;if(progressaoEmCurso.has(lock))return;progressaoEmCurso.add(lock);const anterior=JSON.parse(JSON.stringify(n));try{aumentarAtributo(n,attribute);const salvo=await salvarEdicaoNativa(n,anterior);if(salvo.persisted)await renderizarLista();}catch(err){restaurarFicha(n,anterior);alert(err.message);}finally{progressaoEmCurso.delete(lock);}return;}
  const raiseIndex=e.target.dataset.raiseIndex;
  if(raiseIndex!==undefined){const n=nativaNoIndice(raiseIndex);if(!n||!await podeEditarFicha(n))return;const escolha=prompt("Qual atributo deseja melhorar? ATQ, POT, DEF, RES, AGI, HP ou MP");if(!escolha)return;const lock=n.id||`indice:${raiseIndex}`;if(progressaoEmCurso.has(lock))return;progressaoEmCurso.add(lock);const anterior=JSON.parse(JSON.stringify(n));try{aumentarAtributo(n,escolha.trim().toUpperCase());await salvarEdicaoNativa(n,anterior);}catch(err){restaurarFicha(n,anterior);alert(err.message);}finally{progressaoEmCurso.delete(lock);}return;}
  const essenceIndex=e.target.dataset.essenceIndex;
  if(essenceIndex!==undefined){const n=nativaNoIndice(essenceIndex);if(n)await iniciarAbsorcaoEssencia(n);}
});
$("#cards").addEventListener("change",async e=>{
  const index=e.target.dataset.photoIndex;if(index===undefined||!e.target.files?.[0])return;
  const n=nativaNoIndice(index);if(!n||!await podeEditarFicha(n))return;
  const file=e.target.files[0];if(!["image/jpeg","image/png","image/webp"].includes(file.type.toLowerCase())){alert("Use uma imagem JPG, PNG ou WebP.");return;}if(file.size>8*1024*1024){alert("A imagem deve ter no máximo 8 MB.");return;}
  const anterior=JSON.parse(JSON.stringify(n));
  try{const photoId=`photo-${crypto.randomUUID()}`;await guardarFoto(photoId,file);n.photoId=photoId;n.photoStoragePath=null;const resultado=await salvarEdicaoNativa(n,anterior);if(!resultado.persisted)await removerFoto(photoId);else{if(anterior.photoId)await removerFoto(anterior.photoId);if(anterior.photoStoragePath)await removerRetratoNativa(anterior.photoStoragePath);}}catch(error){restaurarFicha(n,anterior);alert(`Não foi possível guardar a foto: ${error.message}`);}
});
let nativaInventarioEssencias=null;
async function atualizarSeletorResetProgressao(){const select=$("#progress-reset-native");if(!select)return;const options=[];for(const n of nativas){const origin=await repositorioLocal.obterOrigemNativa(n.id).catch(()=>null);if(origin?.origin==="preset"||idsPresetCatalogo.has(n.id))continue;const permission=await repositorioLocal.podeEditarNativa(n.id).catch(()=>({allowed:false}));if(permission.allowed)options.push(new Option(`${n.name} · Nv. ${n.nivel||1}`,n.id));}select.replaceChildren(new Option("Selecione uma ficha editável",""),...options);$("#progress-reset-confirm").disabled=true;}
$("#progress-reset-native")?.addEventListener("change",event=>{$("#progress-reset-confirm").disabled=!event.target.value;$("#progress-reset-status").textContent="";});
$("#progress-reset-confirm")?.addEventListener("click",async()=>{const n=nativas.find(item=>item.id===$("#progress-reset-native").value);if(!n||!await podeEditarFicha(n))return;if(!confirm(`Resetar a progressão de ${n.name}? Nível, XP, XPA, Essências e melhorias registradas serão reiniciados somente nesta ficha.`))return;const previous=JSON.parse(JSON.stringify(n));try{n.nivel=1;n.xp=0;n.xpTotal=0;n.xpa=0;n.estagio=1;n.progressResetVersion=1;n.atributosIniciais||=structuredClone(n.attrs);n.attrs=structuredClone(n.atributosIniciais);if(!Array.isArray(n.golpesIniciais))n.golpesIniciais=normalizarGolpesIniciais(n,n.techniques);n.techniques=[...n.golpesIniciais].slice(0,4);n.essencias=[];n.afinidadesEssencia=[];n.essenciasDisponiveis=[];n.historicoProgressao=[];const result=await salvarEdicaoNativa(n,previous);$("#progress-reset-status").textContent=result.persisted?`${n.name} voltou ao nível 1. Seus companheiros nas mesas não foram alterados.`:"Não foi possível salvar o reset.";if(result.persisted){await atualizarSeletorResetProgressao();$("#progress-reset-native").value=n.id;}}catch(error){restaurarFicha(n,previous);$("#progress-reset-status").textContent=`Falha: ${error.message}`;}});
async function iniciarAbsorcaoEssencia(n){if(!await podeEditarFicha(n))return;nativaInventarioEssencias=n;const dialog=$("#essence-inventory-dialog"),list=$("#essence-inventory-list");if(!dialog||!list)return;const pendentes=(n.essenciasDisponiveis||[]).filter(essence=>essence?.origem==="combate");if(!pendentes.length){list.innerHTML='<p class="muted">Nenhuma esfera ainda. Vitórias têm 5% de chance de conceder uma Essência.</p>';dialog.showModal();return;}const tipo=(n.essencias||[]).includes("primeira")?"segunda":"primeira";for(const essence of pendentes)essence.id||=crypto.randomUUID();list.innerHTML=await Promise.all(pendentes.map(async(essence)=>{let photoUrl=defaultPortrait({id:essence.oponenteId});if(essence.oponentePhotoId){try{const blob=await obterRetratoNativa({photoId:essence.oponentePhotoId,photoStoragePath:essence.oponentePhotoPath});if(blob)photoUrl=URL.createObjectURL(blob);}catch{}}const affinity=String(essence.oponenteAfinidade||"terra").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();const check=verificarEssencia(n,tipo);const sourceMoves=(essence.oponenteTecnicas||[]).map(id=>obterTecnicaPorId(id,{incluirArquivo:false})).filter(t=>t&&podeAprenderTecnica(t));const required=tipo==="primeira"?["linhagem","afinidade"]:["afinidade"];const complete=required.every(origin=>sourceMoves.some(move=>move.origem===origin));const learned=tipo==="primeira"?[sourceMoves.find(move=>move.origem==="linhagem"),sourceMoves.find(move=>move.origem==="afinidade")]:[sourceMoves.find(move=>move.origem==="afinidade"&&move.grupo===essence.oponenteAfinidade)];const duplicate=learned.some(move=>move&&(n.techniques||[]).includes(move.id));const sameAffinity=tipo==="segunda"&&[n.affinity,...(n.afinidadesEssencia||[])].includes(essence.oponenteAfinidade);const disabled=!check.permitido||!complete||duplicate||sameAffinity||learned.some(move=>!move);const detail=!check.permitido?check.motivo:sameAffinity?"Esta Nativa já possui a afinidade da origem.":duplicate?"Um dos golpes desta Essência já está na ficha.":!complete?"A ficha de origem não contém os golpes exigidos para esta Essência.":tipo==="primeira"?"Concede os golpes de linhagem e afinidade desta Nativa.":`Concede afinidade ${essence.oponenteAfinidade||"da origem"} e um golpe dela.`;return `<article class="essence-orb-card" data-affinity="${escapar(affinity)}"><div class="essence-orb"><span class="orb-glow"></span>${photoUrl?`<img src="${escapar(photoUrl)}" alt="${escapar(essence.oponenteNome||"Nativa de origem")}">`:`<span class="orb-creature-fallback">✦</span>`}</div><div class="essence-orb-info"><span class="eyebrow">ESSÊNCIA · ${tipo==="primeira"?"I":"II"}</span><h3>${escapar(essence.oponenteNome||"Nativa selvagem")}</h3><p>${escapar(essence.oponenteLinhagem||"Linhagem desconhecida")} · ${escapar(essence.oponenteAfinidade||"Afinidade desconhecida")}</p><div class="essence-effects"><strong>${tipo==="primeira"?"Aprende dois golpes · defesas preservadas":`Nova afinidade: ${escapar(essence.oponenteAfinidade||"não informada")} · combina fraquezas e resistências`}</strong><ul>${learned.map(move=>`<li>${move?`<b>${escapar(move.nome)}</b> · ${escapar(move.origem)}<br><small>MP ${move.mp??"—"} · Dano ${move.dano??"—"} · Recarga ${move.recarga??"—"}</small><p>${escapar(move.efeito||"")}</p>`:"Golpe exigido não disponível na origem."}</li>`).join("")}</ul></div><small class="essence-lock">${escapar(detail)}</small><button type="button" data-absorb-essence="${escapar(essence.id)}" ${disabled?"disabled":""}>${disabled?"Indisponível":"Absorver"}</button></div></article>`;})).then(cards=>cards.join(""));dialog.showModal();}
$("#essence-inventory-close")?.addEventListener("click",()=>$("#essence-inventory-dialog")?.close());
$("#essence-inventory-list")?.addEventListener("click",async event=>{const button=event.target.closest("[data-absorb-essence]");const n=nativaInventarioEssencias;if(!button||!n)return;const essence=(n.essenciasDisponiveis||[]).find((item,index)=>(item.id||String(index))===button.dataset.absorbEssence);if(!essence)return;const tipo=(n.essencias||[]).includes("primeira")?"segunda":"primeira";const anterior=JSON.parse(JSON.stringify(n));try{const sourceMoves=(essence.oponenteTecnicas||[]).map(id=>obterTecnicaPorId(id,{incluirArquivo:false})).filter(t=>t&&podeAprenderTecnica(t));let moves;if(tipo==="primeira"){moves=[sourceMoves.find(t=>t.origem==="linhagem"),sourceMoves.find(t=>t.origem==="afinidade")];}else{const affinity=essence.oponenteAfinidade;if(!affinity||affinity===n.affinity||(n.afinidadesEssencia||[]).includes(affinity))throw new Error("A afinidade da Nativa de origem já está presente nesta ficha.");moves=[sourceMoves.find(t=>t.origem==="afinidade"&&t.grupo===affinity)];}if(moves.some(t=>!t))throw new Error("A Nativa de origem não possui um golpe válido de cada grupo exigido.");if(moves.some(t=>(n.techniques||[]).includes(t.id)))throw new Error("Um dos golpes desta Essência já está na ficha.");const affinity=tipo==="segunda"?essence.oponenteAfinidade:null;absorverEssencia(n,tipo,affinity,essence.id||null);n.techniques=[...new Set([...(n.techniques||[]),...moves.map(t=>t.id)])];const history=n.historicoProgressao?.at(-1);if(history?.tipo==="essencia")history.golpesAdquiridos=moves.map(t=>t.id);const saved=await salvarEdicaoNativa(n,anterior);if(saved.persisted){$("#essence-inventory-dialog")?.close();alert(`${ESSENCIAS[tipo].nome} absorvida: ${moves.map(t=>t.nome).join(" · ")}.`);}}catch(error){restaurarFicha(n,anterior);alert(error.message);}});

// ---------------------------- ARENA DE BATALHA ----------------------------

function atualizarSelectsBatalha(){
  ["#fighter-a","#fighter-b"].forEach(sel=>{
    const el=$(sel);
    if(!el)return;
    const atual=el.value;
    const opcaoAleatoria=sel==="#fighter-b"?'<option value="random">🎲 Enfrentar Nativa aleatória · CPU</option>':"";
    el.innerHTML='<option value="">Selecione uma Nativa</option>'+
      opcaoAleatoria+
      nativas.map(n=>`<option value="${escapar(n.id)}">${escapar(n.name)} — Nv. ${n.nivel||1}</option>`).join("");
    if(atual==="random"||nativas.some(n=>n.id===atual))el.value=atual;
  });
  atualizarRotulosModoBatalha();
  updateVisualPicker($("#fighter-a"),nativas);updateVisualPicker($("#fighter-b"),nativas);
  updateVisualPicker($("#battle-time"),[],"time");updateVisualPicker($("#battle-biome"),[],"biome");
}

function substituirFotoCombatente(combatente, blob){
  const estaNaArena=batalha?.fighters.includes(combatente)||false;
  return urlsFotosArena.substituir(combatente.fotoUrl,blob,novaUrl=>{
    combatente.fotoUrl=novaUrl;
    // renderizarArena remove o src antigo do DOM antes de liberar sua URL.
    if(estaNaArena)renderizarArena();
  });
}

function liberarFotosBatalha({manterBatalha=false}={}){
  if(!manterBatalha)document.dispatchEvent(new CustomEvent("nativa:combat-close"));
  urlsFotosArena.liberarTodasDepoisDe(()=>{
    batalha?.fighters.forEach(combatente=>{combatente.fotoUrl=null;});
    if(!manterBatalha)batalha=null;
    // O DOM deixa de apontar para as URLs antes de URL.revokeObjectURL ser chamado.
    renderizarArena();
  });
}

async function iniciarBatalha(){
  if(onlineArena?.isActive()){alert("Finalize o duelo online antes de iniciar uma simulação local.");return;}
  const a=nativas.find(n=>n.id===$("#fighter-a").value);
  const selecaoAdversario=$("#fighter-b").value;
  const adversarioAleatorio=selecaoAdversario==="random";
  const candidatos=nativas.filter(n=>n.id!==a?.id);
  const b=adversarioAleatorio
    ?candidatos[Math.floor(Math.random()*candidatos.length)]
    :nativas.find(n=>n.id===selecaoAdversario);
  const modo=MODOS_BATALHA.CPU;

  if(!a||!b){
    alert(adversarioAleatorio?"Escolha sua Nativa e tenha outra ficha disponível para o sorteio.":"Escolha duas Nativas.");
    return;
  }

  if(a.id===b.id){
    alert("Escolha duas Nativas diferentes.");
    return;
  }

  // Remove qualquer batalha anterior da interface antes de liberar suas fotos.
  liberarFotosBatalha();

  const combatentes=[criarCombatente(a),criarCombatente(b)];

  // Recupera as imagens armazenadas no bestiário.
  try{
    for(const c of combatentes){
      const foto=await obterRetratoNativa(c.nativa);
      substituirFotoCombatente(c,foto);
      if(!foto)c.fotoUrl=arenaPortrait(c.nativa)||defaultPortrait(c.nativa);
      c.arenaCutout=!foto&&Boolean(arenaPortrait(c.nativa));
    }
  }catch(error){
    // Essas URLs ainda não foram inseridas na arena; limpa também carregamentos parciais.
    urlsFotosArena.liberarTodasDepoisDe(()=>combatentes.forEach(combatente=>{combatente.fotoUrl=null;}));
    throw error;
  }

  const periodos=PERIODOS_BATALHA;
  const horarioEscolhido=$("#battle-time").value||"Aleatório";
  const biomaEscolhido=$("#battle-biome").value||"Aleatório";
  const horario=horarioEscolhido==="Aleatório"?periodos[Math.floor(Math.random()*periodos.length)]:horarioEscolhido;
  const bioma=biomaEscolhido==="Aleatório"?BIOMAS[Math.floor(Math.random()*BIOMAS.length)]?.nome:biomaEscolhido;
  const configEssencia=carregarConfigEssenciaMesa();
  batalha={
    modo,
    fighters:combatentes,
    turno:1,
    ordem:[],
    escolhas:{},
    horario, bioma,
    recompensaEssencia:{...configEssencia},
    log:[`Combate iniciado: ${a.name} contra ${b.name}${modo===MODOS_BATALHA.CPU?" (CPU)":""}. Arena: ${bioma} · ${horario}.`],
    recompensaAplicada:false,
    encerrada:false,
    processando:false
  };

  prepararTurno(true);
  document.dispatchEvent(new CustomEvent("nativa:combat-start"));
}

function prepararTurno(inicial=false){
  if(!batalha||batalha.encerrada)return;

  if(!inicial){
    batalha.turno++;

    batalha.fighters=avancarCombatentesDeTurno(batalha.fighters);
  }

  batalha.escolhas={};
  batalha.ordem=[];
  batalha.rolls=null;
  batalha.precisionRoll=null;
  batalha.damageTurn=null;
  batalha.fighters.forEach(combatente=>{combatente.damageThisTurn=0;});

  // Libera as escolhas para o novo turno.
  batalha.processando=false;
  batalha.aguardandoProximoTurno=false;

  if(inicial)batalha.fighters=batalha.fighters.map(c=>({...c,animacao:""}));
  batalha.tecnicaDetalhesAberta=null;

  renderizarArena();
}


// Registra a ação escolhida pelo jogador.

function selecionarAcao(indice,tipo,tecnicaId=null){
  if(apresentador.busy())return;
  if(
    !batalha||
    batalha.encerrada||
    batalha.processando||
    batalha.aguardandoProximoTurno
  )return;
  if(batalha.modo==="online"&&(batalha.onlineSubmitted||indice!==batalha.onlineSelfIndex))return;
  if(batalha.modo==="room"&&(batalha.roomSubmitted||indice!==batalha.roomSelfIndex))return;

  const c=batalha.fighters[indice];

  if(c.hp<=0)return;

  if(tipo==="attack"){
    const tecnica=tecnicasCombatente(c).find(t=>t.id===tecnicaId);

    if(!tecnica)return;

    if(c.cooldowns[tecnica.id]>0){
      alert(`${tecnica.nome} está em recarga.`);
      return;
    }

    if(c.mp<tecnica.mp){
      alert("MP insuficiente para usar essa técnica.");
      return;
    }

    batalha.escolhas[indice]={
      tipo:"attack",
      tecnicaId
    };
  }

  if(tipo==="defend"){
    batalha.escolhas[indice]={tipo:"defend"};
  }

  if(tipo==="recover"){
    batalha.escolhas[indice]={tipo:"recover"};
  }

  renderizarArena();
}


function apresentarEventosCombate(eventos){
  for(const evento of eventos){
    if(evento.type==="initiative"){
      const [a,b]=evento.rolls;
      const [nomeA,nomeB]=evento.names;
      batalha.log.push(`🎲 Iniciativa: ${nomeA} ${a.roll}+${a.agi}${a.bonus?`+${a.bonus} bônus`:""}=${a.initiative}; ${nomeB} ${b.roll}+${b.agi}${b.bonus?`+${b.bonus} bônus`:""}=${b.initiative}. Ordem: ${evento.order.map(i=>evento.names[i]).join(" → ")}.`);
    }
    if(evento.type==="support")batalha.log.push(`✨ ${evento.attacker} usa ${evento.technique}. Efeito: ${evento.description} (efeito registrado para aplicação na mesa).`);
    if(evento.type==="miss")batalha.log.push(`💨 ${evento.attacker} tenta usar ${evento.technique}, mas erra! D10: ${evento.roll}. Precisava superar ${evento.threshold}.${evento.sinergias?.length?` ${evento.sinergias.map(s=>s.descricao).join(" ")}`:""}`);
    if(evento.type==="hit"||evento.type==="v21-hit"){
      const precisao=evento.roll===null||evento.roll===undefined?"":` D10: ${evento.roll}.`;
      batalha.log.push(`⚔️ ${evento.attacker} usa ${evento.technique}!${precisao} Dano: ${evento.offensive??"—"} + ${evento.techniqueDamage??"—"} − ${evento.defense??"—"} = ${evento.baseDamage??evento.damage}${evento.affinityModifier?` (${evento.affinityModifier>0?"+":""}${evento.affinityModifier} afinidade)`:""}${evento.bonusDano?` (+${evento.bonusDano} por sinergia)`:""}. ${evento.target} recebe ${evento.damage} de dano.${evento.sinergias?.length?` ${evento.sinergias.map(s=>s.descricao).join(" ")}`:""}`);
    }
    if(evento.type==="combat-effect")batalha.log.push(`✨ ${evento.message}`);
    if(evento.type==="defend")batalha.log.push(`🛡️ ${evento.fighter} assume uma postura defensiva e passa seu turno.`);
    if(evento.type==="recover"){
      batalha.log.push(evento.recovered>0
        ?`🔷 ${evento.fighter} concentra suas energias e recupera 1 MP. MP atual: ${evento.mp}/${evento.maxMP}.`
        :`🔷 ${evento.fighter} tentou recuperar MP, mas já estava com a energia máxima (${evento.maxMP} MP).`);
    }
    if(evento.type==="defeat"){
      batalha.log.push(`🏆 ${evento.defeated} foi derrotada!`);
      batalha.log.push(`Vitória de ${evento.winner}.`);
    }
  }
}

// Executa escolhas e apresenta o resultado produzido pelo domínio.
async function concederRecompensasVitoria(batalhaAtual){
  if(batalhaAtual.recompensaAplicada)return;
  batalhaAtual.recompensaAplicada=true;
  const vencedora=batalhaAtual.fighters.find(c=>c.hp>0);
  const derrotada=batalhaAtual.fighters.find(c=>c.hp<=0);
  if(!vencedora||!derrotada)return;
  const nativa=nativas.find(item=>item.id===vencedora.nativa.id);
  if(!nativa){batalhaAtual.log.push("Recompensas de vitória não registradas: ficha vencedora não encontrada no bestiário.");return;}
  const permissao=await repositorioLocal.podeEditarNativa(nativa.id);
  if(!permissao.allowed){batalhaAtual.log.push("Recompensas de vitória não registradas: a ficha vencedora está somente leitura para esta conta.");return;}
  const quantidade=xpPorVitoria(nativa.nivel||1,derrotada.nativa.nivel||1);
  const anterior=JSON.parse(JSON.stringify(nativa));
  try{
    const progresso=adicionarXP(nativa,quantidade);
    let essênciaPendente=null;
    const config=batalhaAtual.recompensaEssencia||CONFIG_ESSENCIA_PADRAO;
    if(config.modo===MODOS_RECOMPENSA_ESSENCIA.DROP&&rolarDropEssencia(config.chanceDrop)){
      essênciaPendente=criarEssenciaPendente({id:crypto.randomUUID(),oponente:derrotada.nativa,modo:config.modo});
      if(essênciaPendente){nativa.essenciasDisponiveis||=[];nativa.essenciasDisponiveis.push(essênciaPendente);}
    }
    const salvo=await salvarEdicaoNativa(nativa,anterior);
    if(!salvo.persisted){batalhaAtual.log.push(`Vitória de ${nativa.name}: não foi possível salvar as recompensas.`);return;}
    const niveis=progresso.niveisConquistados.map(item=>`nível ${item.nivelNovo} (+${item.xpaRecebido} XPA)`).join(", ");
    batalhaAtual.log.push(`${nativa.name} recebe ${quantidade} XP pela vitória${niveis?`. Progressão: ${niveis}`:""}.`);
    if(essênciaPendente)batalhaAtual.log.push(`${nativa.name} encontrou uma Essência de ${derrotada.nativa.name}. Guardadas: ${nativa.essenciasDisponiveis.length}.`);
    else if(config.modo===MODOS_RECOMPENSA_ESSENCIA.DROP)batalhaAtual.log.push(`A Essência não apareceu nesta vitória (chance configurada: ${config.chanceDrop}%).`);
  }catch(error){
    restaurarFicha(nativa,anterior);
    batalhaAtual.log.push(`XP de vitória não registrado: ${error.message}`);
  }
}

async function executarTurno(){
  if(!batalha||batalha.encerrada||batalha.processando||batalha.aguardandoProximoTurno)return;
  const fighters=batalha.fighters;
  const quantidadeEscolhas=batalha.modo===MODOS_BATALHA.CPU?1:2;
  for(let i=0;i<quantidadeEscolhas;i++){
    if(!batalha.escolhas[i]){
      alert(`Escolha uma ação para ${fighters[i].nativa.name}.`);
      return;
    }
  }

  if(batalha.modo===MODOS_BATALHA.CPU){
    // A ação fica apenas no estado da batalha até o resolvedor produzir seu resultado.
    batalha.escolhas[1]=escolherAcaoCpu(fighters[1],Math.random,fighters[0]);
  }

  batalha.processando=true;
  batalha.aguardandoProximoTurno=false;
  try{
    const pvAntes=fighters.map(combatente=>combatente.hp);
    const resultado=resolverTurnoCombate({fighters,choices:batalha.escolhas,random:Math.random,biomaArena:batalha.bioma});
    batalha.fighters=resultado.fighters;
    batalha.fighters.forEach((combatente,index)=>{combatente.damageThisTurn=Math.max(0,pvAntes[index]-combatente.hp);});
    batalha.damageTurn=batalha.turno;
    batalha.ordem=resultado.order;
    batalha.rolls=resultado.rolls;
    apresentarEventosCombate(resultado.events);
    batalha.fighters.forEach(f=>{f.animacao=null;});
    if(resultado.error)throw resultado.error;

    const current=batalha;
    await apresentador.enqueue(combatActions(resultado.events||[],batalha.fighters),`${identidadeEfeitos(current)}:${current.turno}`,fighters);
    if(batalha!==current)return;

    if(resultado.ended){
      if(batalha.modo!==MODOS_BATALHA.CPU||batalha.fighters[0].hp>0){
        await concederRecompensasVitoria(batalha);
      }else{
        batalha.recompensaAplicada=true;
      }
      batalha.encerrada=true;
      batalha.processando=false;
      batalha.aguardandoProximoTurno=false;
      // O resultado mantém a arena, mas usa o fallback visual após liberar as fotos.
      liberarFotosBatalha({manterBatalha:true});
      return;
    }

    batalha.processando=false;
    batalha.aguardandoProximoTurno=true;
    renderizarArena();
    setTimeout(()=>{
      if(batalha&&!batalha.encerrada)prepararTurno(false);
    },1300);
  }catch(err){
    batalha.processando=false;
    batalha.aguardandoProximoTurno=false;
    alert(err.message);
    renderizarArena();
  }
}

async function executarTurnoSala(){
  const current=batalha;
  if(!current||current.modo!=="room"||current.encerrada||current.roomSubmitted||current.processando)return;
  const choice=current.escolhas[current.roomSelfIndex];if(!choice)return;
  current.processando=true;renderizarArena();
  try{await current.roomSubmit(choice,current.turno);}
  catch(error){if(batalha===current){current.processando=false;current.log.push(error.message);renderizarArena();}}
}

async function desistirDaLuta(){
  const current=batalha;
  if(!current||current.encerrada||current.processando)return;
  const promptText=current.modo==="room"?"Desistir deste encontro? A caçada terminará sem recompensas; no PvP, seu oponente vencerá.":current.modo==="online"?"Desistir deste duelo? O outro jogador será declarado vencedor.":current.modo===MODOS_BATALHA.CPU?"Desistir da luta? A CPU vencerá e você não receberá recompensas.":"Encerrar esta partida local?";
  if(!window.confirm(promptText))return;
  current.processando=true;
  renderizarArena();
  try{
    if(current.modo==="room"){
      if(!current.roomForfeitAction)throw new Error("A desistência da sala não está disponível.");
      await current.roomForfeitAction();
      return;
    }
    if(current.modo==="online"){
      await onlineArena.forfeit();
      return;
    }
    current.encerrada=true;
    current.processando=false;
    if(current.modo===MODOS_BATALHA.CPU){
      current.localForfeit=true;
      current.localWinnerIndex=1;
      current.log.push(`${current.fighters[0].nativa.name} desistiu. Vitória de ${current.fighters[1].nativa.name}.`);
    }else{
      current.localCancelled=true;
      current.log.push("Partida local encerrada pelos jogadores. Sem vencedor e sem recompensas.");
    }
    liberarFotosBatalha({manterBatalha:true});
    renderizarArena();
  }catch(error){
    if(batalha===current){current.processando=false;current.log.push(error.message);renderizarArena();}
  }
}

function identidadeEfeitos(current){
  if(!current)return null;
  return current.onlineMatchId||current.roomEncounterId||(current.fxId||=crypto.randomUUID());
}

function slugVisualTecnica(value){
  return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}

function iconeOrigemTecnica(tecnica){
  const grupo=slugVisualTecnica(tecnica.grupo);
  if(tecnica.origem==="afinidade")return ({fogo:"✹",agua:"≈",terra:"◆",vento:"〰",energia:"ϟ"})[grupo]||"✦";
  if(tecnica.origem==="bioma")return ({"floresta-e-mata":"♣","rios-lagos-e-pantanal":"〰","caatinga-e-cerrado":"☀","costa-restinga-e-manguezal":"❋"})[grupo]||"❋";
  if(tecnica.origem==="arquetipo")return "✧";
  if(["siluriformes","characiformes","peixes-eletricos","peixes-cartilaginosos"].includes(grupo))return "≋";
  if(["aves-de-rapina","aves-corredoras-e-campestres","aves-aquaticas-e-pernaltas","psitacideos"].includes(grupo))return "⌁";
  if(["serpentes","lagartos","quelonios","crocodilianos","anuros"].includes(grupo))return "◈";
  if(["insetos-sociais","insetos-predadores","aracnideos","crustaceos"].includes(grupo))return "✣";
  if(grupo==="felinos")return "🐾";
  return "❧";
}

function cartoesTecnicas(c,indice){
  const lista=tecnicasCombatente(c);

  if(!lista.length){
    return '<p class="muted">Nenhuma técnica cadastrada.</p>';
  }

  return lista.map(t=>{
    const cd=c.cooldowns[t.id]||0;
    const pendenteCombate=!podeUsarTecnicaEmCombate(t);
    const semMP=t.mp!==null&&t.mp!==undefined&&c.mp<t.mp;
    const bloqueada=pendenteCombate||cd>0||semMP;

    const selecionada=
      batalha.escolhas[indice]?.tipo==="attack"&&
      batalha.escolhas[indice]?.tecnicaId===t.id;

    let motivo="Disponível";

    if(pendenteCombate)motivo="Em revisão · indisponível em combate";
    else if(cd>0)motivo=`Recarga: ${cd} turno(s)`;
    else if(semMP)motivo="MP insuficiente";

    const afinidade=t.origem==="afinidade"?t.grupo:(t.afinidade||"");
    const categoria=t.categoria||"Suporte";
    const categoriaIcone=categoria==="Físico"?"⚔":categoria==="Especial"?"✦":"✿";
    const origemNome=({linhagem:"Linhagem",bioma:"Bioma",arquetipo:"Arquétipo",afinidade:"Afinidade"})[t.origem]||"Técnica";
    const detalhesAbertos=batalha.tecnicaDetalhesAberta===t.id;
    return `
      <article class="battle-technique-card ${selecionada?"selected":""} ${bloqueada?"unavailable":""} ${detalhesAbertos?"details-open":""}" data-source="${escapar(slugVisualTecnica(t.origem))}" data-group="${escapar(slugVisualTecnica(t.grupo))}" data-family="${escapar(t.origem==="linhagem"?slugVisualTecnica(t.grupo):"")}" data-biome="${escapar(t.origem==="bioma"?slugVisualTecnica(t.grupo):"")}" data-element="${escapar(t.origem==="afinidade"?slugVisualTecnica(t.grupo):"")}" data-category="${escapar(slugVisualTecnica(categoria))}">
        <button type="button" class="battle-technique" data-battle-technique="${escapar(t.id)}" data-fighter="${indice}" aria-expanded="${detalhesAbertos}" ${bloqueada?'aria-disabled="true"':""} aria-label="${escapar(`${t.nome}. ${afinidade?`Afinidade ${afinidade}. `:""}${categoria}. Custo ${t.mp??"não definido"} MP. Dano ${t.dano??"não definido"}. Efeito: ${t.efeito||"sem efeito descrito"}`)}">
          <span class="technique-card-top"><span class="technique-card-name">${escapar(t.nome)}</span><span class="technique-cost">${t.mp??"—"} MP</span></span>
          <span class="technique-card-badges">
            <span class="technique-badge source-badge" data-source="${escapar(slugVisualTecnica(t.origem))}"><i aria-hidden="true">${iconeOrigemTecnica(t)}</i><span class="source-label">${escapar(origemNome)} · ${escapar(t.grupo||"geral")}</span></span>
            ${afinidade&&afinidade!=="Neutro"&&t.origem!=="afinidade"?`<span class="technique-badge affinity-badge">Afinidade · ${escapar(afinidade)}</span>`:""}
            <span class="technique-badge category-badge" data-category="${escapar(categoria)}">${categoriaIcone} ${escapar(categoria)}</span>
          </span>
          <span class="technique-card-stats"><span>Dano <b>${t.dano??"—"}</b></span></span>
          <span class="technique-hover-effect"><strong>Efeito do golpe</strong>${escapar(t.efeito||"Sem efeito descrito.")}${bloqueada?`<small>${escapar(motivo)}</small>`:""}${detalhesAbertos?'<small class="touch-effect-hint">Toque outra vez no golpe para fechar</small>':""}</span>
        </button>
      </article>
    `;
  }).join("");
}

function renderizarCombatente(c,indice){
  const n=c.nativa;
  const foto=c.fotoUrl
    ?`<img class="combatant-photo" src="${c.fotoUrl}" alt="${escapar(n.name)}">`
    :`<div class="combatant-photo-placeholder" role="img" aria-label="${escapar(n.name)}, sem imagem cadastrada"><span></span></div>`;
  const dano="";

  return `
    <div class="arena-creature ${c.arenaCutout?"has-cutout":""} ${indice===0?"contestant-left":"contestant-right"} ${c.animacao?`anim-${c.animacao}`:""}" role="group" aria-label="${escapar(n.name)}">
      <div class="combatant-art">${foto}</div>
      ${dano}
    </div>
  `;
}

function renderizarHudCombatente(c,indice){
  const n=c.nativa;
  const visual=apresentador.vitals(indice)||c;
  const rotuloJogador=batalha.modo===MODOS_BATALHA.CPU&&indice===1
    ?"CPU"
    :n.player||`Jogador ${indice+1}`;
  return `
    <article class="combatant battle-hud ${indice===0?"hud-player":"hud-opponent"}">
      <div class="combatant-heading"><div class="combatant-info">
        <h3>${escapar(n.name)}</h3>
        <div class="identity">${escapar(n.lineageName||n.lineage)} · ${escapar(n.affinity)} · Nv. ${n.nivel||1}</div>
        <span class="combatant-player">${escapar(rotuloJogador)}</span>
      </div></div>
      <div class="combatant-vitals" aria-label="Condição de ${escapar(n.name)}">
        <div class="vital-line"><div class="bar-label"><span>HP</span><b>${visual.hp}/${c.maxHP}</b></div><div class="bar hp"><span style="width:${Math.max(0,visual.hp/c.maxHP*100)}%"></span></div></div>
        <div class="vital-line"><div class="bar-label"><span>MP</span><b>${visual.mp}/${c.maxMP}</b></div><div class="bar mp"><span style="width:${Math.max(0,visual.mp/c.maxMP*100)}%"></span></div></div>
        <span class="condition-state">${visual.hp<=0?"Fora de combate":"Sem condições"}</span>
      </div>
    </article>
  `;
}

// Classifica as mensagens para dar identidade visual ao histórico.
function classeDoLog(texto){
  if(texto.includes("recupera")||texto.includes("energias"))return "log-recover";
  if(texto.includes("defensiva"))return "log-defend";
  if(texto.includes("erra")||texto.includes("falha"))return "log-miss";
  if(texto.includes("derrotada")||texto.includes("Vitória"))return "log-result";
  if(texto.includes("recebe")&&texto.includes("dano"))return "log-damage";
  if(texto.includes("iniciativa"))return "log-system";
  return "log-action";
}

function renderizarHistorico(){
  return `
    <section class="battle-log">
      <div class="battle-log-heading">
        <div>
          <span class="eyebrow">REGISTRO DA ARENA</span>
          <h3>Histórico da batalha</h3>
        </div>
        <span class="battle-log-count">${batalha.log.length} eventos</span>
      </div>

      <div class="battle-log-list" id="battle-log-list">
        ${batalha.log.map((mensagem,i)=>`
          <div class="battle-log-entry ${classeDoLog(mensagem)}">
            <span class="battle-log-index">${String(i+1).padStart(2,"0")}</span>
            <p>${escapar(mensagem)}</p>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

// Painel de escolhas de cada combatente.
function renderizarPainelAcao(c,indice){
  const escolha=batalha.escolhas[indice];

  return `
    <section class="action-panel">
      <div class="action-panel-heading">
        <div>
          <span class="eyebrow">${batalha.modo==="room"?`CAMPANHA · ${escapar(c.nativa.player||"SUA NATIVA")}`:`JOGADOR ${indice+1}`}</span>
          <h3>${escapar(c.nativa.name)}</h3>
        </div>
        <span class="action-selected">
          ${(batalha.modo==="online"&&batalha.onlineSubmitted)||(batalha.modo==="room"&&batalha.roomSubmitted)?"Ação confirmada · aguardando rodada":escolha
            ?escolha.tipo==="attack"?escapar(obterTecnicaPorId(escolha.tecnicaId)?.nome||"Ataque escolhido")
              :escolha.tipo==="defend"?"Defender escolhido"
              :"Recuperação escolhida"
            :"Escolha uma ação"}
        </span>
      </div>

      <section class="battle-moves" aria-label="Golpes de ${escapar(c.nativa.name)}">
        <header class="battle-moves-heading"><span class="moves-emblem" aria-hidden="true">✦</span><span><strong>Golpes</strong><small>${tecnicasCombatente(c).filter(t=>podeUsarTecnicaEmCombate(t)).length} disponíveis · escolha sua ação</small></span><span class="moves-count">${tecnicasCombatente(c).length}</span></header>
        <div class="battle-technique-grid">
          ${cartoesTecnicas(c,indice)}
        </div>
      </section>
      <div class="special-actions">
        <button
          type="button"
          class="special-action defend-action ${escolha?.tipo==="defend"?"selected":""}"
          data-special-action="defend"
          data-fighter="${indice}"
        >
          <span class="special-action-icon">🛡️</span>
          <span>
            <strong>Defender</strong>
            <small>Passa o turno sem atacar.</small>
          </span>
        </button>

        <button
          type="button"
          class="special-action recover-action ${escolha?.tipo==="recover"?"selected":""}"
          data-special-action="recover"
          data-fighter="${indice}"
        >
          <span class="special-action-icon">🔷</span>
          <span>
            <strong>Recuperar MP</strong>
            <small>Passa o turno e recupera 1 MP.</small>
          </span>
        </button>
      </div>


    </section>
  `;
}



function renderizarArena(){
  if(!batalha){
    $("#battle-arena").className="battle-arena empty";
    $("#battle-arena").innerHTML="<p>Configure os combatentes para abrir a arena.</p>";
    return;
  }

  const f=batalha.fighters;
  const encerradaVisual=batalha.encerrada&&!apresentador.busy();

  const order=batalha.ordem.length
    ?batalha.ordem.map(i=>f[i].nativa.name).join(" → ")
    :"Aguardando as escolhas dos jogadores";

  const botaoExecutar=encerradaVisual
    ?""
    :`
      <button
        id="execute-turn"
        class="execute-battle-button"
        type="button"
        ${Object.keys(batalha.escolhas).length<(batalha.modo===MODOS_BATALHA.CPU||batalha.modo==="online"||batalha.modo==="room"?1:2)||batalha.processando||batalha.aguardandoProximoTurno||batalha.onlineSubmitted||batalha.roomSubmitted||apresentador.busy()?"disabled":""}
      >
        ${batalha.modo==="online"?(batalha.onlineSubmitted?"AÇÃO CONFIRMADA · AGUARDANDO":"CONFIRMAR AÇÃO ONLINE"):batalha.modo==="room"?(batalha.roomSubmitted?"AÇÃO CONFIRMADA · AGUARDANDO":"CONFIRMAR AÇÃO DA CAMPANHA"):batalha.aguardandoProximoTurno?"Aguarde o próximo turno...":"REALIZAR AÇÃO"}
      </button>
    `;
  const botaoDesistir=!encerradaVisual
    ?`<button id="forfeit-battle" class="forfeit-battle-button" type="button" ${batalha.processando||apresentador.busy()?"disabled":""}>${batalha.modo==="room"?"Desistir do encontro":batalha.modo==="online"?"Desistir do duelo":"Desistir da luta"}</button>`:"";

  const resultado=encerradaVisual
    ?`
      <div class="battle-result">
        <span>🏆</span>
        <div>
          <strong>${batalha.onlineCancelled?"Duelo cancelado":batalha.onlineForfeit?"Duelo encerrado por desistência":batalha.roomForfeit?(batalha.roomKind==="pvp"?"Duelo encerrado por desistência":"Caçada abandonada"):batalha.roomCancelled?"Encontro encerrado pelo mestre":batalha.localForfeit?"Combate perdido por desistência":batalha.localCancelled?"Partida local encerrada":"Combate encerrado"}</strong>
          <p>${batalha.onlineCancelled||batalha.localCancelled?"Sem vencedor · fichas preservadas":batalha.roomForfeit&&batalha.roomKind==="hunt"?"Caçada encerrada · sem recompensas":batalha.roomCancelled?"Progresso da campanha preservado":`Vitória: ${escapar(batalha.modo==="online"?(f[batalha.onlineWinnerIndex]?.nativa.name||"Sem vencedor"):batalha.modo==="room"?(f[batalha.roomWinnerIndex]?.nativa.name||"Sem vencedor"):batalha.localForfeit?f[batalha.localWinnerIndex]?.nativa.name:f.find(c=>c.hp>0)?.nativa.name||"Sem vencedor")}`}</p>
        </div>
      </div>

      <button id="new-battle" class="secondary" type="button" ${batalha.modo==="room"?"hidden":""}>
        ${batalha.modo==="online"?"Voltar ao lobby PvP":"Novo combate"}
      </button>
    `
    :"";

  $("#battle-arena").className="battle-arena battle-arena-active";

  $("#battle-arena").innerHTML=`
    <section class="battlefield battle-layout" data-mode="${escapar(batalha.modo)}" data-biome="${escapar(batalha.bioma||"")}" aria-label="Arena: ${escapar(batalha.bioma||"Bioma não definido")}">
      <header class="battlefield-topline"><span class="arena-location">${escapar(batalha.bioma||"Arena")} · ${escapar(batalha.horario||"")}</span><span class="battle-state">${encerradaVisual?"Combate encerrado":`Turno ${batalha.turno} · ${batalha.processando?"Resolvendo ações":"Combate em andamento"}`}</span></header>
      <div class="arena-stage" aria-label="Campo de batalha">
        <div class="scene-backdrop" aria-hidden="true"><span class="scene-canopy"></span><span class="scene-ridge"></span><span class="scene-water"></span><span class="scene-ground"></span><span class="scene-rocks"></span><span class="scene-plants"></span><span class="scene-light"></span></div>
        <div class="arena-hud-row">
          ${renderizarHudCombatente(f[0],0)}
          <div class="turn-order ${batalha.ordem.length?"initiative-revealed":""}">
            <strong>${batalha.ordem.length?"Iniciativa":"Estado do turno"}</strong>
            <span>${escapar(order)}</span>
            <small>${batalha.ordem.length?"1D10 + AGI":"Aguardando as escolhas"}</small>
          </div>
          ${renderizarHudCombatente(f[1],1)}
        </div>
        <div class="arena-fighter arena-fighter-one">${renderizarCombatente(f[0],0)}</div>
        <div class="arena-stage-mark" aria-hidden="true"><span></span><b>VS</b><span></span></div>
        <div class="arena-fighter arena-fighter-two">${renderizarCombatente(f[1],1)}</div>
        <div class="arena-action-trigger">${botaoExecutar}</div>

      </div>
      <div class="battle-commands">
        <div class="battle-commands-grid">
          ${!encerradaVisual&&((batalha.modo!=="online"&&batalha.modo!=="room")||(batalha.modo==="online"&&batalha.onlineSelfIndex===0)||(batalha.modo==="room"&&batalha.roomSelfIndex===0))?renderizarPainelAcao(f[0],0):""}
          ${!encerradaVisual&&batalha.modo===MODOS_BATALHA.LOCAL?renderizarPainelAcao(f[1],1):""}
          ${!encerradaVisual&&batalha.modo==="online"&&batalha.onlineSelfIndex===1?renderizarPainelAcao(f[1],1):""}
          ${!encerradaVisual&&batalha.modo==="room"&&batalha.roomSelfIndex===1?renderizarPainelAcao(f[1],1):""}
        </div>
        ${resultado}
      </div>
      <footer class="battle-footer">
        <details class="battle-history"><summary>Histórico da batalha</summary>${renderizarHistorico()}</details>
        ${botaoDesistir}
      </footer>
    </section>
  `;


  batalha.fighters.forEach(fighter=>{fighter.animacao=null;});
  $("#execute-turn")?.addEventListener("click",()=>{
    if(apresentador.busy())return;
    if(batalha?.modo==="room"){void executarTurnoSala();return;}
    if(batalha?.modo!=="online"){void executarTurno();return;}
    const current=batalha;
    const choice=current.escolhas[current.onlineSelfIndex];if(!choice)return;
    current.processando=true;renderizarArena();
    void onlineArena.submit(choice,current.turno).catch(error=>{current.log.push(error.message);}).finally(()=>{if(batalha===current){current.processando=false;renderizarArena();}});
  });

  $("#new-battle")?.addEventListener("click",()=>{
    if(batalha?.modo==="online"){void onlineArena.returnToLobby();return;}
    liberarFotosBatalha();
  });
  $("#forfeit-battle")?.addEventListener("click",()=>{void desistirDaLuta();});

  $("#battle-arena").querySelectorAll("[data-battle-technique]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const modoToque=window.matchMedia("(hover: none), (pointer: coarse)").matches;
      const bloqueada=btn.closest(".battle-technique-card")?.classList.contains("unavailable");
      if(modoToque){
        batalha.tecnicaDetalhesAberta=batalha.tecnicaDetalhesAberta===btn.dataset.battleTechnique?null:btn.dataset.battleTechnique;
      }else batalha.tecnicaDetalhesAberta=null;
      const acaoTravada=bloqueada||batalha.encerrada||batalha.processando||batalha.aguardandoProximoTurno
        ||(batalha.modo==="online"&&(batalha.onlineSubmitted||Number(btn.dataset.fighter)!==batalha.onlineSelfIndex))
        ||(batalha.modo==="room"&&(batalha.roomSubmitted||Number(btn.dataset.fighter)!==batalha.roomSelfIndex));
      if(acaoTravada){if(modoToque)renderizarArena();return;}
      selecionarAcao(
        Number(btn.dataset.fighter),
        "attack",
        btn.dataset.battleTechnique
      );
    });
  });

  $("#battle-arena").querySelectorAll("[data-special-action]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      selecionarAcao(
        Number(btn.dataset.fighter),
        btn.dataset.specialAction
      );
    });
  });

  const historico=$("#battle-log-list");
  if(historico){
    historico.scrollTop=historico.scrollHeight;
  }
}



$("#fighter-b")?.addEventListener("change",()=>{
  atualizarRotulosModoBatalha();
});
$("#start-battle").addEventListener("click",iniciarBatalha);

atualizarRotulosModoBatalha();configurarFormularios();renderizarAtributos();renderizarSeletorTecnicas();
async function inicializarAplicacao(){
  try {
    nativas = await carregarNativas();
    nativasCarregadas = true;
    await origensPresetsProntas;
    for(const n of nativas.filter(item=>item.photoId&&!item.photoStoragePath)){
      if(!(await repositorioLocal.podeEditarNativa(n.id)).allowed)continue;
      const result=await salvarDados(n);
      if(!result.persisted)$("#bestiary-status").textContent="Há retratos antigos aguardando envio ao servidor. Reconecte e recarregue para tentar novamente; seus arquivos locais foram preservados.";
    }
    await renderizarLista();
    atualizarSelectsBatalha();
  } catch (error) {
    nativasCarregadas = true;
    const status = $("#bestiary-status");
    if (status) status.textContent = `Não foi possível carregar o armazenamento local: ${error.message}`;
  }
}
void inicializarAplicacao();
void repositorioLocal.consultarEstadoPersistencia().catch(error => {
  const status = $("#bestiary-status");
  if (status) status.textContent = `O armazenamento local está indisponível: ${error.message}`;
});

void atualizarPainelSincronizacao();
void obterClienteSupabase().then(client => {
  client.auth.onAuthStateChange(() => {
    void renderizarLista();
    void atualizarPainelSincronizacao();
    if($("#art-studio")?.classList.contains("active")){void carregarAlvosArte();void renderizarAcervoArte();}
  });
}).catch(() => {
  // A autenticação é opcional: a interface local permanece disponível offline.
});
void inicializarSalas();

initializeArenaFullscreen();
onlineArena=initializeOnlineArena({
  onLocal(){if(batalha?.modo==="online")liberarFotosBatalha();},
  onMatch(match){
    const previous=batalha?.modo==="online"&&batalha.onlineMatchId===match.id?batalha:null;
    if(batalha&&batalha.modo!=="online")liberarFotosBatalha();
    const sameTurn=previous?.turno===match.turn;
    const fighters=match.state.fighters.map((fighter,index)=>({
      ...fighter,nativa:{...fighter.nativa,player:index===0?match.hostName:match.guestName},
      fotoUrl:arenaPortrait(fighter.nativa),arenaCutout:Boolean(arenaPortrait(fighter.nativa)),
      damageThisTurn:previous?Math.max(0,(previous.fighters[index]?.hp||0)-fighter.hp):0
    }));
    const history=match.state.history||[];
    const newEvents=previous?history.slice(previous.log.length):[];

    batalha={modo:"online",onlineMatchId:match.id,onlineSelfIndex:match.selfIndex,onlineSubmitted:match.ownConfirmed,
      onlineWinnerIndex:match.winnerIndex,onlineCancelled:match.status==="cancelled",onlineForfeit:match.reason==="forfeit",fighters,turno:match.turn,damageTurn:newEvents.length?match.turn:null,
      horario:"Duelo online",bioma:match.biome,ordem:match.state.order||[],log:[...history],
      escolhas:match.ownChoice?{[match.selfIndex]:match.ownChoice}:sameTurn?previous.escolhas:{},
      tecnicaDetalhesAberta:sameTurn?previous?.tecnicaDetalhesAberta:null,
      paineisGolpesAbertos:previous?.paineisGolpesAbertos||[],encerrada:match.status!=="active",processando:false,aguardandoProximoTurno:false};
    renderizarArena();
    void apresentador.enqueue(historyActions(newEvents,fighters,tecnicasCombatente),`online:${match.id}:${history.length}`,previous?.fighters);
  }
});

function atualizarArenaDaSala(detail){
  const {encounter,roomId,userId,roomSubmit,roomForfeit}=detail||{};
  if(!encounter?.state?.fighters?.length)return;
  const participants=[...(encounter.participants||[])].sort((a,b)=>String(a.player_id).localeCompare(String(b.player_id)));
  const selfIndex=participants.findIndex(p=>p.player_id===userId);
  if(selfIndex<0)return;
  const same=batalha?.modo==="room"&&batalha.roomEncounterId===encounter.id?batalha:null;
  if(batalha&&!same)urlsFotosArena.liberarTodasDepoisDe(()=>{});
  const fighters=encounter.state.fighters.map((fighter,index)=>{
    const wild=encounter.kind==="hunt"&&index===1;
    const nativa={...fighter.nativa,player:wild?"Selvagem":participants[index]?.display_name||"Jogador"};
    const portrait=arenaPortrait(nativa)||defaultPortrait(nativa);
    return {...fighter,nativa,fotoUrl:portrait,arenaCutout:Boolean(arenaPortrait(nativa)),damageThisTurn:same?Math.max(0,(same.fighters[index]?.hp||0)-fighter.hp):0};
  });
  const history=encounter.state.history||[];
  const newEvents=same?history.slice(same.log.length):[];

  const winnerIndex=encounter.winner_id?participants.findIndex(p=>p.player_id===encounter.winner_id):-1;
  const sameTurn=same?.turno===encounter.turn;
  batalha={modo:"room",roomId,roomEncounterId:encounter.id,roomSelfIndex:selfIndex,
    roomSubmitted:Boolean(encounter.own_choice)&&encounter.status==="active",
    roomCancelled:encounter.status==="cancelled"&&!encounter.result?.forfeit,roomForfeit:Boolean(encounter.result?.forfeit),roomKind:encounter.kind,roomWinnerIndex:winnerIndex,
    roomSubmit,roomForfeitAction:roomForfeit,fighters,turno:encounter.turn,damageTurn:newEvents.length?encounter.turn:null,horario:"Encontro da campanha",
    bioma:fighters[0]?.nativa?.bioma||"Habitat da campanha",ordem:encounter.state.order||[],
    log:[...history],escolhas:encounter.own_choice?{[selfIndex]:encounter.own_choice}:sameTurn?same.escolhas:{},
    tecnicaDetalhesAberta:sameTurn?same?.tecnicaDetalhesAberta:null,
    encerrada:encounter.status!=="active",processando:false,aguardandoProximoTurno:false};
  renderizarArena();
  void apresentador.enqueue(historyActions(newEvents,fighters,tecnicasCombatente),`room:${encounter.id}:${history.length}`,same?.fighters);
}

document.addEventListener("nativa:room-arena-open",event=>{
  mostrarTela("battle");
  atualizarArenaDaSala(event.detail);
});
document.addEventListener("nativa:room-arena-update",event=>{
  if(batalha?.modo==="room"&&batalha.roomEncounterId===event.detail?.encounter?.id)atualizarArenaDaSala(event.detail);
});

