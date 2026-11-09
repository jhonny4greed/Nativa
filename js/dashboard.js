import { animate, stagger } from "animejs";
import { isAdmin, authHref, safeDestination } from "./access.js";
import { repositorioLocal } from "./repository.js";
import { defaultPortrait } from "./creature-art.js";

const LABELS = { home: "Refúgio", list: "Bestiário", create: "Criar Nativa", battle: "Arena", "art-studio": "Ateliê de imagens", gallery: "Acervo e retratos", multiplayer: "Mesas multiplayer", rules: "Guia de jogo", account: "Minha conta", admin: "Administração" };
const DESTINATIONS = { conta: "account", criar: "create", bestiario: "list", arena: "battle", atelie: "art-studio", regras: "rules" };
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const urls = new Set();
let renderVersion = 0;
function releasePortraits() { for (const url of urls) URL.revokeObjectURL(url); urls.clear(); }

async function renderCompanions() {
  const version = ++renderVersion;
  const container = document.querySelector("#dashboard-companions");
  if (!container) return;
  try {
    const fichas = await repositorioLocal.listarNativas();
    const selected = [...fichas.filter(n => !n.id?.startsWith("preset-")), ...fichas.filter(n => n.id?.startsWith("preset-"))].slice(0, 3);
    const localUrls = [];
    const cards = await Promise.all(selected.map(async n => {
      const card = document.createElement("article"); card.className = "companion-card";
      const imageBox = document.createElement("div"); imageBox.className = "companion-image";
      let src = defaultPortrait(n);
      if (n.photoId) {
        const blob = await repositorioLocal.obterFoto(n.photoId);
        if (blob) { src = URL.createObjectURL(blob); localUrls.push(src); }
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
    document.querySelector("[data-task-create]").textContent = fichas.some(n => !n.id?.startsWith("preset-")) ? "Primeiro vínculo criado ✓" : "Crie sua primeira Nativa";
  } catch { container.textContent = "Não foi possível abrir os companheiros deste dispositivo."; }
}

export async function initializeDashboard(client, user, applicationRole = "player") {
  const admin = isAdmin(applicationRole);
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
    if (!reduced()) animate(".welcome-line,.expedition-hero,.journey-stat,.refuge-grid", { opacity: [0,1], translateY: [16,0], delay: stagger(65), duration: 650, ease: "outCubic" });
  }, { once: true });
  window.addEventListener("hashchange", () => { const hash = location.hash.slice(1); navigate(DESTINATIONS[hash] || hash); });
  document.addEventListener("nativa:updated", () => { void renderCompanions(); });
  window.addEventListener("pagehide", releasePortraits);
  document.querySelectorAll("[data-signout]").forEach(button => button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      const { error } = await client.auth.signOut();
      if (error) throw error;
      location.replace("./login.html");
    } catch { button.disabled = false; button.title = "Não foi possível sair. Tente novamente."; }
  }));
  client.auth.onAuthStateChange((event, next) => {
    if (event === "SIGNED_OUT" || !next) location.replace(authHref("login", safeDestination(location.href, location.href)));
    if (next && ["TOKEN_REFRESHED", "USER_UPDATED"].includes(event)) {
      setTimeout(() => { void client.rpc("get_application_role").then(({ data, error }) => { if (!error && isAdmin(data) !== admin) location.reload(); }).catch(() => {}); }, 0);
    }
  });
  if (!reduced()) {
    const field = document.querySelector(".hero-sparks");
    for (let i = 0; i < 14; i++) {
      const spark = document.createElement("i"); spark.style.left = `${35 + Math.random()*63}%`; spark.style.top = `${Math.random()*100}%`; field.append(spark);
    }
    const animation = animate(".hero-sparks i", { translateY: [-5,-38], opacity: [.1,.7,.1], delay: stagger(270), duration: 3800, alternate: true, loop: true, ease: "inOutSine" });
    document.addEventListener("visibilitychange", () => document.hidden ? animation.pause() : animation.play());
    new IntersectionObserver(([entry]) => entry.isIntersecting && !document.hidden ? animation.play() : animation.pause()).observe(field);
  }
}
