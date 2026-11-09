import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, TURNSTILE_SITE_KEY } from "./supabase-config.js";

const EMAIL_SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
const TURNSTILE_SDK_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js";
let clienteSupabasePromise;
let turnstileSdkPromise;

function carregarSdkSupabase() {
  if (globalThis.supabase?.createClient) return Promise.resolve(globalThis.supabase);

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = EMAIL_SDK_URL;
    script.async = true;
    script.onload = () => globalThis.supabase?.createClient
      ? resolve(globalThis.supabase)
      : reject(new Error("O SDK do Supabase não inicializou."));
    script.onerror = () => reject(new Error("Não foi possível carregar o SDK do Supabase."));
    document.head.append(script);
  });
}

function carregarSdkTurnstile() {
  if (globalThis.turnstile?.render) return Promise.resolve(globalThis.turnstile);
  if (!turnstileSdkPromise) {
    turnstileSdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = TURNSTILE_SDK_URL;
      script.async = true;
      script.onload = () => globalThis.turnstile?.render
        ? resolve(globalThis.turnstile)
        : reject(new Error("O verificador anti-robô não inicializou."));
      script.onerror = () => reject(new Error("Não foi possível carregar o verificador anti-robô."));
      document.head.append(script);
    }).catch(error => {
      turnstileSdkPromise = null;
      throw error;
    });
  }
  return turnstileSdkPromise;
}

export function obterClienteSupabase() {
  if (!clienteSupabasePromise) {
    clienteSupabasePromise = (async () => {
      const sdk = await carregarSdkSupabase();
      return sdk.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "pkce",
          persistSession: true
        }
      });
    })().catch(error => {
      clienteSupabasePromise = null;
      throw error;
    });
  }
  return clienteSupabasePromise;
}

function criarProtecaoTurnstile(container) {
  const state = { widgetId: null, token: "", sdk: null, ready: false };

  function reset() {
    state.token = "";
    if (state.sdk && state.widgetId !== null) {
      try { state.sdk.reset(state.widgetId); } catch { /* widget pode já ter sido removido */ }
    }
  }

  async function init() {
    if (!TURNSTILE_SITE_KEY || state.ready) return true;
    const sdk = await carregarSdkTurnstile();
    state.sdk = sdk;
    container.hidden = false;
    state.widgetId = sdk.render(container, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: "dark",
      callback: token => { state.token = token; },
      "expired-callback": () => { state.token = ""; },
      "error-callback": () => { state.token = ""; }
    });
    state.ready = true;
    return true;
  }

  function verificar() {
    if (!TURNSTILE_SITE_KEY) return { ok: true };
    if (!state.ready || !state.token) {
      return { ok: false, mensagem: "Confirme a verificação anti-robô para continuar." };
    }
    const token = state.token;
    return { ok: true, captchaToken: token };
  }

  return { init, verificar, reset, get enabled() { return Boolean(TURNSTILE_SITE_KEY); } };
}

export async function inicializarAutenticacao() {
  const { safeDestination, authHref } = await import("./access.js");
  const form = document.querySelector("#auth-form");
  const google = document.querySelector("#online-auth-google");
  const status = document.querySelector("#online-auth-status");
  if (!form || !google || !status) return;
  const signup = document.body.dataset.authMode === "cadastro";
  const next = safeDestination(new URL(location.href).searchParams.get("next"), location.href);
  document.querySelector("[data-auth-switch]").href = authHref(signup ? "login" : "cadastro", next);
  const protection = criarProtecaoTurnstile(document.querySelector("#online-auth-turnstile"));
  const block = value => { form.querySelector("button").disabled = value; google.disabled = value; };
  let client;
  block(true);
  try {
    client = await obterClienteSupabase();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data.session) {
      const verified = await client.auth.getUser();
      if (!verified.error && verified.data?.user?.id === data.session.user.id) { location.replace(next); return; }
      // Clear an invalid cached session instead of looping between login and app.
      await client.auth.signOut({ scope: "local" });
    }
    await protection.init();
    block(false);
  } catch {
    status.textContent = "Não foi possível conectar ao serviço de conta. Confira sua conexão e tente recarregar.";
    return;
  }
  // Callback redirects always return to the login route, which validates next.
  const callback = new URL(authHref("login", next), location.href).href;
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const fields = new FormData(form);
    const email = String(fields.get("email") || "").trim();
    const password = String(fields.get("password") || "");
    if (signup && !String(fields.get("displayName") || "").trim()) {
      status.textContent = "Informe seu nome de jogador."; return;
    }
    if (signup && password !== fields.get("confirmPassword")) {
      status.textContent = "As senhas não coincidem. Confira e tente novamente."; return;
    }
    const verification = protection.verificar();
    if (!verification.ok) { status.textContent = verification.mensagem; return; }
    block(true);
    status.textContent = signup ? "Criando sua conta…" : "Abrindo seu refúgio…";
    try {
      const captcha = verification.captchaToken ? { captchaToken: verification.captchaToken } : {};
      const { data, error } = signup
        ? await client.auth.signUp({ email, password, options: { ...captcha,
          data: { display_name: String(fields.get("displayName") || "").trim() }, emailRedirectTo: callback } })
        : await client.auth.signInWithPassword({ email, password, options: captcha });
      if (error) throw error;
      if (data.session) { location.replace(next); return; }
      status.textContent = "Conta criada. Confira seu e-mail para confirmar o cadastro e entrar no seu refúgio.";
      protection.reset();
    } catch (error) {
      status.textContent = traduzirErroAuth(error);
      protection.reset();
    } finally { block(false); }
  });
  google.addEventListener("click", async () => {
    block(true); status.textContent = "Abrindo o acesso pelo Google…";
    try {
      const { error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback } });
      if (error) throw error;
    } catch (error) { status.textContent = traduzirErroAuth(error); block(false); }
  });
}

const ERROS_AUTH = [
  [/invalid login credentials/i, "E-mail ou senha incorretos."],
  [/email not confirmed/i, "Confirme seu e-mail antes de entrar. Verifique a caixa de entrada."],
  [/already registered|already exists|duplicate/i, "Este e-mail já tem uma conta. Use a aba \"Entrar\"."],
  [/password.*(at least|too short)|minimum/i, "A senha precisa ter pelo menos 6 caracteres."],
  [/rate limit|too many requests/i, "Muitas tentativas. Aguarde um instante e tente de novo."],
  [/captcha/i, "A verificação anti-robô expirou ou foi recusada. Tente novamente."]
];

function traduzirErroAuth(error) {
  const texto = String(error?.message || error || "");
  for (const [regex, mensagem] of ERROS_AUTH) if (regex.test(texto)) return mensagem;
  return texto || "";
}
