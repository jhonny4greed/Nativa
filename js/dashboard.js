import { animate, stagger } from "animejs";
import { isAdmin, authHref, safeDestination } from "./access.js";
import { repositorioLocal } from "./repository.js";
import { defaultPortrait } from "./creature-art.js";
import { featuredSummary } from "./featured-creature.js";
import { obterRetratoNativa } from "./native-portraits.js";

const LABELS = { home: "Refúgio", list: "Bestiário", create: "Criar Nativa", battle: "Arena", "art-studio": "Ateliê de imagens", gallery: "Acervo e retratos", multiplayer: "Mesas multiplayer", rules: "Guia de jogo", settings: "Configurações", account: "Minha conta", admin: "Administração" };
const DESTINATIONS = { conta: "account", criar: "create", bestiario: "list", arena: "battle", atelie: "art-studio", regras: "rules" };
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const urls = new Set();
let renderVersion = 0;
let selectedId = null;
let featuredUrl = null;
let collection = [];
let imageVersion = 0;
let selectorVersion = 0;
const selectorUrls = new Set();

async function selectCreature(nativa, moving = false) {
  if (!nativa) return;
  selectedId = nativa.id;
  const version = ++imageVersion;
  const summary = featuredSummary(nativa);
  const write = (id, value) => { document.getElementById(id).textContent = value; };
  write("featured-name", nativa.name);
  write("spotlight-word", nativa.name);
  write("featured-species", nativa.species || "Criatura brasileira");
  write("featured-level", summary.nivel);
  write("featured-biome", nativa.bioma);
  write("featured-archetype", nativa.archetype);
  write("featured-lineage", nativa.lineageName || nativa.lineage);
  write("featured-xp", summary.xpAtual);
  write("featured-stage", `Estágio ${summary.estagio}`);
  write("featured-xp-next", `${summary.xpAtual} de ${summary.xpNecessario} XP para o nível ${summary.nivel + 1}`);
  write("featured-xpa", `${summary.xpaDisponivel} XPA disponível`);
  write("featured-step", `${String(collection.indexOf(nativa) + 1).padStart(2, "0")} / ${String(collection.length).padStart(2, "0")}`);
  write("selector-name", nativa.name);
  write("featured-caption", `${nativa.species || nativa.lineage} · ${nativa.affinity} · ${nativa.archetype}`);
  document.getElementById("featured-xp-ring").style.setProperty("--progress", `${summary.xpPercent}%`);
  const tag = document.createElement("span"); tag.className = "tag"; tag.textContent = nativa.affinity;
  document.getElementById("featured-tags").replaceChildren(tag);
  document.getElementById("featured-attributes").replaceChildren(...summary.attributes.map(({ name, value, percent }) => {
    const row = document.createElement("div"); row.className = "dossier-attribute";
    const label = document.createElement("span"); label.textContent = name;
    const track = document.createElement("div"); track.className = "attribute-track";
    const fill = document.createElement("i"); fill.style.width = `${percent}%`; track.append(fill);
    const number = document.createElement("b"); number.textContent = value;
    row.append(label, track, number); return row;
  }));
  document.querySelectorAll("[data-creature-choice]").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.creatureChoice === selectedId));
  });
  let src = defaultPortrait(nativa), owned = false;
  if (nativa.photoId || nativa.photoStoragePath) {
    try { const blob = await obterRetratoNativa(nativa); if (blob) { src = URL.createObjectURL(blob); owned = true; } } catch { /* use the default portrait */ }
  }
  if (version !== imageVersion) { if (owned) URL.revokeObjectURL(src); return; }
  const image = document.getElementById("featured-portrait");
  image.hidden = !src;
  document.getElementById("featured-no-art").hidden = Boolean(src);
  if (src) { image.src = src; image.alt = `${nativa.name}, ${nativa.species || nativa.lineage}, afinidade ${nativa.affinity}`; }
  else image.removeAttribute("src");
  if (featuredUrl) URL.revokeObjectURL(featuredUrl);
  featuredUrl = owned ? src : null;
  if (moving && !reduced()) animate(".spotlight-frame,.dossier-heading,.dossier-attribute", { opacity: [0, 1], translateY: [12, 0], delay: stagger(25), duration: 480, ease: "outCubic" });
}

function renderSelector() {
  const container = document.getElementById("companion-selector");
  const version = ++selectorVersion;
  const previousUrls=[...selectorUrls];selectorUrls.clear();
  const index = Math.max(0, collection.findIndex(n => n.id === selectedId));
  const start = Math.floor(index / 5) * 5;
  container.replaceChildren(...collection.slice(start, start + 5).map((n, i) => {
    const button = document.createElement("button"); button.className = "orbit-choice secondary"; button.dataset.creatureChoice = n.id;
    button.setAttribute("aria-label", `Selecionar ${n.name}`); button.setAttribute("aria-pressed", String(n.id === selectedId));
    const angle = (-90 + i * 72) * Math.PI / 180;
    button.style.setProperty("--orbit-x", `${Math.cos(angle) * 79}px`); button.style.setProperty("--orbit-y", `${Math.sin(angle) * 79}px`);
    const src = defaultPortrait(n);
    if (src) { const image = document.createElement("img"); image.src = src; image.alt = ""; button.append(image); }
    else { const initial = document.createElement("b"); initial.textContent = n.name?.slice(0, 1) || "N"; button.append(initial); }
    if(n.photoId||n.photoStoragePath){
      void obterRetratoNativa(n).then(blob=>{
        if(!blob||version!==selectorVersion||!button.isConnected)return;
        const url=URL.createObjectURL(blob);selectorUrls.add(url);
        const image=document.createElement("img");image.src=url;image.alt="";
        const previous=button.querySelector("img,b");if(previous)previous.replaceWith(image);else button.prepend(image);
      }).catch(()=>{/* Keep the default portrait or initial when the remote photo is unavailable. */});
    }
    const name = document.createElement("span"); name.textContent = n.name; button.append(name);
    button.addEventListener("click", () => { void selectCreature(n, true); });
    return button;
  }));
  previousUrls.forEach(url=>URL.revokeObjectURL(url));
}
function releasePortraits() { for (const url of urls) URL.revokeObjectURL(url); urls.clear(); }

async function renderCompanions() {
  const version = ++renderVersion;
  const container = document.querySelector("#dashboard-companions");
  if (!container) return;
  try {
    const fichas = await repositorioLocal.listarNativas();
    collection = [...fichas.filter(n => !defaultPortrait(n)), ...fichas.filter(n => defaultPortrait(n))];
    const selected = collection.slice(0, 4);
    const localUrls = [];
    const cards = await Promise.all(selected.map(async n => {
      const card = document.createElement("article"); card.className = "companion-card";
      const imageBox = document.createElement("div"); imageBox.className = "companion-image";
      let src = defaultPortrait(n);
      if (n.photoId || n.photoStoragePath) {
        try{const blob = await obterRetratoNativa(n);
        if (blob) { src = URL.createObjectURL(blob); localUrls.push(src); }}catch{/* One unavailable portrait must not hide the whole home collection. */}
      }
      if (src) { const image = document.createElement("img"); image.src = src; image.alt = `Retrato de ${n.name}`; image.loading = "lazy"; imageBox.append(image); }
      else { imageBox.textContent = "Seu próximo retrato começa no ateliê"; }
      const affinity = document.createElement("span"); affinity.className = "affinity-badge"; affinity.textContent = n.affinity;
      imageBox.append(affinity);
      const body = document.createElement("div"); body.className = "companion-body";
      const name = document.createElement("h4"); name.textContent = n.name;
      const species = document.createElement("small"); species.textContent = `${n.species || n.lineage} · ${n.archetype}`;
      const meta = document.createElement("div"); meta.className = "companion-meta";
      const level = document.createElement("span"); level.textContent = `Nível ${n.nivel || 1}`;
      const type = document.createElement("span"); type.textContent = n.id?.startsWith("preset-") ? "Companheiro inicial" : "Sua Nativa";
      meta.append(level, type); body.append(name, species, meta); card.append(imageBox, body); return card;
    }));
    if (version !== renderVersion) { localUrls.forEach(url => URL.revokeObjectURL(url)); return; }
    container.replaceChildren(...cards); releasePortraits(); localUrls.forEach(url => urls.add(url));
    if (!cards.length) { const p = document.createElement("p"); p.textContent = "Seu refúgio está pronto para receber a primeira Nativa."; container.append(p); }
    if (collection.length) {
      document.querySelector(".command-stage").hidden = false;
      await selectCreature(collection.find(n => n.id === selectedId) || collection[0]);
      renderSelector();
    } else {
      document.querySelector(".command-stage").hidden = true;
    }
  } catch { container.textContent = "Não foi possível abrir os companheiros deste dispositivo."; }
}

export async function initializeDashboard(client, user, applicationRole = "player") {
  const admin = isAdmin(applicationRole);
  document.documentElement.dataset.userId = user.id;
  document.documentElement.dataset.applicationRole = applicationRole;
  for (const [id, direction] of [["featured-prev", -1], ["featured-next", 1]]) {
    document.getElementById(id).addEventListener("click", () => {
      if (!collection.length) return;
      const current = Math.max(0, collection.findIndex(n => n.id === selectedId));
      void selectCreature(collection[(current + direction + collection.length) % collection.length], true).then(renderSelector);
    });
  }
  document.querySelectorAll("[data-admin-only]").forEach(el => { el.hidden = !admin; });
  const name = user.user_metadata?.display_name || user.email?.split("@")[0] || "Explorador";
  document.querySelectorAll("[data-player-name]").forEach(el => { el.textContent = name; });
  document.querySelector("[data-player-initial]").textContent = name.charAt(0).toUpperCase();
  document.querySelector("[data-player-email]").textContent = user.email || "";
  document.querySelector("[data-player-role]").textContent = admin ? "Administrador · NATIVA" : "Jogador · NATIVA";
  async function overview() {
    if (!admin) return;
    const status = document.querySelector("#admin-overview-status"); status.textContent = "Consultando o observatório…";
    try {
      const { data, error } = await client.rpc("get_admin_overview");
      if (error) throw error;
      const fragment = document.createDocumentFragment();
      for (const [key, label] of [["players", "Jogadores"], ["nativas", "Nativas sincronizadas"], ["rooms", "Mesas abertas"]]) {
        const item = document.createElement("article"), count = document.createElement("strong"), caption = document.createElement("span");
        count.textContent = String(data[key]); caption.textContent = label; item.append(count, caption); fragment.append(item);
      }
      document.querySelector("#admin-overview").replaceChildren(fragment); status.textContent = "Visão geral atualizada.";
    } catch { status.textContent = "Não foi possível carregar o observatório. Verifique a permissão da conta e a disponibilidade do serviço administrativo."; }
  }
  document.querySelector("#admin-refresh").addEventListener("click", overview);
  const nav = document.querySelector(".main-nav"), more = document.querySelector(".more-button");
  more.addEventListener("click", () => { more.setAttribute("aria-expanded", String(nav.classList.toggle("is-expanded"))); });
  function navigate(target) {
    const id = LABELS[target] ? target : "home";
    if (id === "admin" && !admin) { location.hash = "home"; return; }
    document.querySelector(`[data-view="${id}"]`)?.click();
  }
  function afterNavigation(id) {
    document.querySelector("[data-current-view]").textContent = LABELS[id] || "Refúgio";
    document.querySelectorAll("[data-view]").forEach(button => {
      if (button.dataset.view === id) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
    });
    history.replaceState(null, "", `${location.pathname}${location.search}#${id}`);
    nav.classList.remove("is-expanded"); more.setAttribute("aria-expanded", "false");
    const title = document.querySelector(`#${id} h2`);
    if (title) { title.tabIndex = -1; title.focus({ preventScroll: true }); }
    window.scrollTo({ top: 0, behavior: "instant" });
    if (id === "admin") void overview();
    const heading = document.querySelector(`#${id} > .section-heading`);
    if (!reduced() && heading) animate(heading, { opacity: [0, 1], translateY: [8, 0], duration: 350, ease: "outQuad" });
  }
  document.addEventListener("click", event => {
    const action = event.target.closest("[data-view],[data-go]");
    if (!action) return;
    const id = action.dataset.view || action.dataset.go;
    if (id === "admin" && !admin) { event.preventDefault(); event.stopImmediatePropagation(); return; }

  }, true);
  document.addEventListener("nativa:view", event => afterNavigation(event.detail.id));
  document.addEventListener("nativa:ready", () => {
    const hash = location.hash.slice(1); navigate(DESTINATIONS[hash] || hash || "home");
    void renderCompanions();
    if (!reduced()) animate(".welcome-line,.game-panel,.creature-spotlight,.creature-selector,.quick-paths,.refuge-grid", { opacity: [0,1], translateY: [16,0], delay: stagger(55), duration: 600, ease: "outCubic" });
  }, { once: true });
  window.addEventListener("hashchange", () => { const hash = location.hash.slice(1); navigate(DESTINATIONS[hash] || hash); });
  document.addEventListener("nativa:updated", () => { void renderCompanions(); });
  window.addEventListener("pagehide", () => { selectorVersion++;selectorUrls.forEach(url=>URL.revokeObjectURL(url));selectorUrls.clear();releasePortraits(); if (featuredUrl) URL.revokeObjectURL(featuredUrl); });
  document.querySelectorAll("[data-signout]").forEach(button => button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      const { error } = await client.auth.signOut();
      if (error) throw error;
      location.replace("./login.html");
    } catch { button.disabled = false; button.title = "Não foi possível sair. Tente novamente."; }
  }));
  client.auth.onAuthStateChange((event, next) => {
    if (event === "SIGNED_OUT" || !next) {
      document.documentElement.removeAttribute("data-authenticated");
      location.replace(authHref("login", safeDestination(location.href, location.href)));
    }
    if (next && ["TOKEN_REFRESHED", "USER_UPDATED"].includes(event)) {
      setTimeout(() => { void client.rpc("get_application_role").then(({ data, error }) => { if (!error && isAdmin(data) !== admin) location.reload(); }).catch(() => {}); }, 0);
    }
  });
}
