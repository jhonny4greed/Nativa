// Visual QA only: served by the Vite dev middleware, excluded from production.
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "../css/tokens.css";
import "../css/arena-biomes.css";
import { detectDevice, applyDevice } from "../js/device.js";
import { observeIcons } from "../js/icons.js";
import { initializeDashboard } from "../js/dashboard.js";

if (!import.meta.env.DEV) throw new Error("Preview is development-only");
const client = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null })
  },
  rpc: async () => ({ data: null, error: new Error("Prévia local sem banco") })
};
globalThis.supabase = { createClient: () => client };
await applyDevice(await detectDevice());
await import("../css/dashboard.css");
observeIcons();
await initializeDashboard(client, { id: "visual-preview", email: "previa@local.test", user_metadata: { display_name: "Explorador" }, app_metadata: {} });
await import("../js/app.js");
document.dispatchEvent(new CustomEvent("nativa:ready"));
document.querySelector("[data-player-role]").textContent = "Prévia local · sem sessão";
