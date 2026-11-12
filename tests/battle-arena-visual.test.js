import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BIOMAS } from "../js/data.js";

const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../app.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/style.css", import.meta.url), "utf8");
const fourHabitats = [
  "Floresta e Mata",
  "Rios, Lagos e Pantanal",
  "Caatinga e Cerrado",
  "Costa, Restinga e Manguezal"
];

test("cenário visual deriva do bioma da batalha e não do habitat das Nativas", () => {
  const start = app.indexOf("function renderizarArena(){");
  const end = app.indexOf('\n  $("#execute-turn")', start);
  const arena = start >= 0 && end > start ? app.slice(start, end) : "";
  assert.ok(arena, "Renderizador da arena não encontrado.");
  assert.match(arena, /data-biome="\$\{escapar\(batalha\.bioma/);
  assert.doesNotMatch(arena, /nativa\.bioma|\.bioma\s*\|\|\s*[^}]*nativa/);
});

test("catálogo BIOMAS mantém os habitats oficiais e a quinta entrada experimental", () => {
  for (const habitat of fourHabitats) assert.ok(BIOMAS.some(item => item.nome === habitat), habitat);
  assert.ok(BIOMAS.some(item => item.nome === "Campos Sulinos e Pampa"));
  for (const habitat of [...fourHabitats, "Campos Sulinos e Pampa"]) {
    assert.ok(css.includes(`data-biome="${habitat}"`), `Variação visual ausente para ${habitat}`);
  }
});

test("HUD conserva imagens reais, fallback, barras e controles das ações", () => {
  assert.match(app, /c\.fotoUrl[\s\S]*?class="combatant-photo"/);
  assert.match(app, /combatant-photo-placeholder/);
  assert.match(app, /visual\.hp\/c\.maxHP/);
  assert.match(app, /visual\.mp\/c\.maxMP/);
  assert.match(app, /data-battle-technique=/);
  assert.match(app, /data-special-action=/);
  assert.match(app, /id="execute-turn"/);
  assert.match(app, /renderizarHistorico\(\)/);
});

test("arena oferece apenas PvP online e CPU e sorteia uma adversária diferente da ficha escolhida", () => {
  assert.match(html, /data-arena-lane="local"[^>]*>Contra CPU/);
  assert.match(html, /data-arena-lane="online"[^>]*>.*?PvP online/);
  assert.doesNotMatch(html, /Multiplayer local/);
  assert.match(app, /value="random">🎲 Enfrentar Nativa aleatória · CPU/);
  assert.match(app, /const candidatos=nativas\.filter\(n=>n\.id!==a\?\.id\)/);
  assert.match(app, /const modo=MODOS_BATALHA\.CPU/);
});

test("arena organiza HUDs compactos, combatentes no campo e comandos antes do histórico", () => {
  assert.match(app, /class="battlefield battle-layout"/);
  assert.match(app, /arena-hud-row[\s\S]*?renderizarHudCombatente\(f\[0\],0\)[\s\S]*?renderizarHudCombatente\(f\[1\],1\)/);
  assert.match(app, /arena-stage[\s\S]*?renderizarCombatente\(f\[0\],0\)[\s\S]*?renderizarCombatente\(f\[1\],1\)/);
  assert.match(app, /battle-commands-grid[\s\S]*?renderizarPainelAcao\(f\[0\],0\)[\s\S]*?renderizarPainelAcao\(f\[1\],1\)/);
  assert.match(app, /arena-stage[\s\S]*?<div class="arena-action-trigger">\$\{botaoExecutar\}<\/div>[\s\S]*?<div class="battle-commands">[\s\S]*?renderizarHistorico\(\)[\s\S]*?\$\{botaoDesistir\}/);
  assert.match(css, /grid-template-areas:"top" "hud" "stage" "action" "forfeit" "commands"/);
  assert.match(css, /body:has\(#battle\.active\) main \{ max-width:none;/);
  assert.match(css, /\.arena-stage \{[\s\S]*?height:clamp\(190px,29vh,330px\)/);
});

test("campo mantém camadas visíveis e fotos reais com fallback legível", () => {
  const start = app.indexOf("function renderizarCombatente(c,indice){");
  const end = app.indexOf("function renderizarHudCombatente", start);
  const renderer = start >= 0 && end > start ? app.slice(start, end) : "";
  assert.match(renderer, /c\.fotoUrl[\s\S]*?<img class="combatant-photo" src="\$\{c\.fotoUrl\}"/);
  assert.match(renderer, /combatant-photo-placeholder/);
  assert.match(css, /\.arena-stage \.scene-backdrop \{ z-index:0;[^}]*opacity:1;/);
  assert.match(css, /\.arena-fighter \{ position:relative; z-index:1;/);
  assert.match(css, /\.arena-creature \.combatant-photo-placeholder \{ display:grid; place-items:end center;/);
  assert.match(css, /\.arena-creature \.combatant-photo \{[\s\S]*?object-fit:contain;/);
});

test("cartões mostram identidade de grupo, dados de combate e efeito por hover, foco e toque", () => {
  assert.match(app, /iconeOrigemTecnica\(t\)/);
  assert.match(app, /data-source="\$\{escapar\(slugVisualTecnica\(t\.origem\)\)\}"/);
  assert.match(app, /data-category="\$\{escapar\(slugVisualTecnica\(categoria\)\)\}"/);
  assert.match(app, /data-battle-technique=/);
  assert.match(app, /technique-hover-effect/);
  assert.match(app, /data-battle-technique=[\s\S]*?aria-expanded=/);
  assert.match(css, /\.battle-technique-card:hover[\s\S]*?\.technique-hover-effect/);
  assert.match(css, /\.battle-technique-card:focus-within[\s\S]*?\.technique-hover-effect/);
  assert.match(css, /\.battle-technique-card\.details-open[\s\S]*?\.technique-hover-effect/);
});

test("acabamento translúcido usa apenas identidade visual do bioma e respeita preferências", () => {
  for (const habitat of [...fourHabitats, "Campos Sulinos e Pampa"]) {
    assert.ok(css.includes(`.battlefield[data-biome="${habitat}"]`), `Reflexo visual ausente para ${habitat}`);
  }
  assert.match(css, /\.battlefield \.battle-hud[\s\S]*?backdrop-filter:blur/);
  assert.match(css, /@supports not \(\(backdrop-filter:blur/);
  assert.match(css, /@media\(prefers-reduced-transparency:reduce\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(app, /MODIFICADORES_TECNICA_ARENA\s*\[[^\]]+\]\s*=|aplicarModificadorBioma\(/);
});

test("modo real da batalha controla os menus sem expor o menu da CPU", () => {
  assert.match(app, /modo,\s*fighters:combatentes/);
  assert.match(app, /data-mode="\$\{escapar\(batalha\.modo\)\}"/);
  assert.match(app, /batalha\.modo===MODOS_BATALHA\.LOCAL\?renderizarPainelAcao\(f\[1\],1\):""/);
  assert.match(app, /batalha\.modo===MODOS_BATALHA\.CPU\?1:2/);
  assert.match(app, /if\(batalha\.modo===MODOS_BATALHA\.CPU\)\{[\s\S]*?escolherAcaoCpu\(fighters\[1\],Math\.random,fighters\[0\]\)/);
  assert.match(app, /resolverTurnoCombate\(\{fighters,choices:batalha\.escolhas/);
  assert.match(app, /renderizarHudCombatente\(f\[1\],1\)/);
  assert.match(css, /\.battlefield\[data-mode="cpu"\] \.battle-commands-grid/);
});
