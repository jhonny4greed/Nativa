import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "../css/tokens.css";
import "../css/arena-biomes.css";
import { detectDevice, applyDevice } from "./device.js";
import { observeIcons } from "./icons.js";
import { obterClienteSupabase } from "./auth.js";
import { authHref, safeDestination } from "./access.js";

const destination = safeDestination(location.href, location.href);
let client, session;
try {
  client = await obterClienteSupabase();
  const result = await client.auth.getSession();
  if (result.error) throw result.error;
  session = result.data.session;
  if (!session) location.replace(authHref("login", destination));
} catch {
  document.documentElement.dataset.deviceReady = "true";
  document.body.replaceChildren();
  const message = document.createElement("section"); message.style.cssText = "margin:15vh auto;max-width:480px;padding:30px";
  const heading = document.createElement("h1"); heading.textContent = "Seu refúgio está guardado.";
  const text = document.createElement("p"); text.textContent = "Não foi possível verificar sua conta. Confira a conexão para continuar.";
  const link = document.createElement("a"); link.href = authHref("login", destination); link.textContent = "Voltar ao login";
  message.append(heading, text, link); document.body.append(message);
}
if (session) {
  await applyDevice(await detectDevice());
  await import("../css/dashboard.css");
  observeIcons();
  const { initializeDashboard } = await import("./dashboard.js");
  const { data } = await client.auth.getUser().catch(() => ({ data: null }));
  const user = data?.user || { id: session.user.id, email: session.user.email };
  // Preserve the existing profile bootstrap for new e-mail and OAuth accounts.
  if (data?.user) {
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
  const { data: role } = await client.rpc("get_application_role").catch(() => ({ data: "player" }));
  await initializeDashboard(client, user, role);
  await import("./app.js");
  if (role === "admin") {
    const { inicializarPainelAdmin } = await import("./admin.js");
    void inicializarPainelAdmin();
  }
  document.dispatchEvent(new CustomEvent("nativa:ready"));
}
