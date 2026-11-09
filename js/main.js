import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "../css/tokens.css";
import "../css/arena-biomes.css";
import { detectDevice, applyDevice } from "./device.js";
import { observeIcons } from "./icons.js";

const device = await detectDevice();
await applyDevice(device);
observeIcons();
await import("./app.js");
const { inicializarPainelAdmin } = await import("./admin.js");
void inicializarPainelAdmin();
abrirDestinoDoHash();

const DESTINOS = {
  conta: { view: "home", alvo: "#online-account-title" },
  multiplayer: { view: "home", alvo: "#online-rooms-title" },
  regras: { view: "rules" },
  criar: { view: "create" },
  bestiario: { view: "list" },
  atelie: { view: "art-studio" },
  arena: { view: "battle" }
};

function abrirDestinoDoHash() {
  const destino = DESTINOS[location.hash.replace(/^#/, "")];
  if (!destino) return;
  document.querySelector(`.main-nav button[data-view="${destino.view}"]`)?.click();
  if (destino.alvo) {
    requestAnimationFrame(() => document.querySelector(destino.alvo)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
}
