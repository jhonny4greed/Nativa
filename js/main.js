import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "../css/tokens.css";
import "../css/arena-biomes.css";
import { detectDevice, applyDevice } from "./device.js";
import { observeIcons } from "./icons.js";
import { obterClienteSupabase } from "./auth.js";
import { authHref, safeDestination, getApplicationRole } from "./access.js";
import { requireAuthenticatedUser } from "./session-gate.js";

const destination = safeDestination(location.href, location.href);
let client, user;
try {
  client = await obterClienteSupabase();
  user = await requireAuthenticatedUser(client);
} catch {
  document.body.replaceChildren();
  location.replace(authHref("login", destination));
}
if (user) {
  await applyDevice(await detectDevice());
  await import("../css/dashboard.css");
  await import("../css/game-hub.css");
  await import("../css/arena-game.css");
  await import("../css/arena-online.css");
  await import("../css/arena-layout.css");
  await import("../css/arena-cinematic.css");
  observeIcons();
  const { initializeDashboard } = await import("./dashboard.js");
  // Preserve the existing profile bootstrap for new e-mail and OAuth accounts.
  {
    try {
      const { data: profile, error } = await client.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
      if (error) throw error;
      if (!profile) {
        const { error: insertError } = await client.from("profiles").insert({ id: user.id, display_name: (user.user_metadata?.display_name || user.email?.split("@")[0] || "Jogador").slice(0, 40) });
        if (insertError && insertError.code !== "23505") throw insertError;
      } else user.user_metadata = { ...user.user_metadata, display_name: profile.display_name };
    } catch {
      document.querySelector("[data-player-role]").title = "Não foi possível atualizar o perfil. Tente recarregar.";
    }
  }
  const role = await getApplicationRole(client);
  const { carregarCatalogoGlobalNativas } = await import("./traits.js");
  try {
    await carregarCatalogoGlobalNativas(client);
  } catch (error) {
    console.warn("Não foi possível carregar o catálogo biológico global; usando o catálogo local.", error);
  }
  await initializeDashboard(client, user, role);
  const { initializeArenaPreferences } = await import("./arena-preferences.js");
  await initializeArenaPreferences(client,user);
  await import("./app.js");
  if (role === "admin") {
    const { inicializarPainelAdmin } = await import("./admin.js");
    void inicializarPainelAdmin();
  }
  document.dispatchEvent(new CustomEvent("nativa:ready"));
  const { initializeTutorials } = await import("./tutorial.js");
  void initializeTutorials(client,user).catch(error=>console.warn("Guia indisponível:",error));
  document.documentElement.dataset.authenticated = "true";
  window.addEventListener("pageshow", event => {
    if (event.persisted) location.reload();
  });
  let checkingSession = false;
  async function revalidate() {
    if (checkingSession || document.hidden) return;
    checkingSession = true;
    try { await requireAuthenticatedUser(client); }
    catch {
      document.documentElement.removeAttribute("data-authenticated");
      location.replace(authHref("login", safeDestination(location.href, location.href)));
    } finally { checkingSession = false; }
  }
  window.addEventListener("focus", revalidate);
  document.addEventListener("visibilitychange", revalidate);
}
