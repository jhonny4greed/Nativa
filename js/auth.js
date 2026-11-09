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
  const area = document.querySelector("#online-auth-area");
  const signinForm = document.querySelector("#online-auth-signin-form");
  const signupForm = document.querySelector("#online-auth-signup-form");
  const googleButton = document.querySelector("#online-auth-google");
  const turnstileContainer = document.querySelector("#online-auth-turnstile");
  const status = document.querySelector("#online-auth-status");
  const account = document.querySelector("#online-account-details");
  const accountName = document.querySelector("#online-account-name");
  const accountEmail = document.querySelector("#online-account-email");
  const accountStatus = document.querySelector("#online-account-status");
  const signout = document.querySelector("#online-auth-signout");
  const tabs = [...document.querySelectorAll("[data-auth-tab]")];
  if (!area || !signinForm || !signupForm || !googleButton || !status || !account
    || !accountName || !accountEmail || !accountStatus || !signout || !tabs.length) return;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    status.textContent = "A autenticação ainda não está configurada para este ambiente.";
    signinForm.querySelector("button[type=submit]").disabled = true;
    signupForm.querySelector("button[type=submit]").disabled = true;
    googleButton.disabled = true;
    return;
  }

  let client;
  try {
    client = await obterClienteSupabase();
  } catch (error) {
    status.textContent = `${error.message} O restante do jogo continua disponível localmente.`;
    signinForm.querySelector("button[type=submit]").disabled = true;
    signupForm.querySelector("button[type=submit]").disabled = true;
    googleButton.disabled = true;
    return;
  }

  const turnstile = criarProtecaoTurnstile(turnstileContainer);
  if (turnstile.enabled) {
    turnstile.init().catch(() => {
      status.textContent = "A verificação anti-robô não carregou. Recarregue a página para tentar novamente.";
    });
  }

  function mostrarSessao(user, nome = "") {
    const conectado = Boolean(user);
    area.hidden = conectado;
    account.hidden = !conectado;
    accountStatus.textContent = "";
    if (!conectado) {
      status.textContent = "Entre ou crie sua conta para sincronizar fichas e salas. O jogo local continua disponível sem login.";
      return;
    }
    accountName.textContent = `Conectado como ${nome || user.email || "jogador"}`;
    accountEmail.textContent = user.email || "";
  }

  async function garantirPerfil(user) {
    const { data: perfil, error: leituraErro } = await client
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();

    if (leituraErro) throw leituraErro;
    if (perfil) {
      mostrarSessao(user, perfil.display_name);
      return;
    }

    const metadataName = user.user_metadata?.display_name?.trim();
    const emailName = user.email?.split("@")[0]?.trim();
    const displayName = metadataName || emailName || "Jogador";
    const { error: escritaErro } = await client.from("profiles").insert(
      { id: user.id, display_name: displayName }
    );
    if (escritaErro?.code === "23505") {
      // Duas abas podem criar o mesmo perfil após ambas constatarem que ele
      // ainda não existe. Releia a linha, sem exigir UPDATE sobre o id.
      const { data: perfilCriado, error: releituraErro } = await client
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      if (releituraErro) throw releituraErro;
      if (perfilCriado) {
        mostrarSessao(user, perfilCriado.display_name);
        return;
      }
    }
    if (escritaErro) throw escritaErro;
    mostrarSessao(user, displayName);
  }

  async function atualizarConta(user) {
    if (!user) {
      mostrarSessao(null);
      return;
    }
    mostrarSessao(user, user.user_metadata?.display_name || "");
    try {
      await garantirPerfil(user);
    } catch {
      accountStatus.textContent = "Sua sessão está ativa, mas não foi possível carregar o perfil agora. Tente atualizar a página.";
    }
  }

  const { data: { session }, error: sessaoErro } = await client.auth.getSession();
  if (sessaoErro) status.textContent = "Não foi possível recuperar sua sessão.";
  await atualizarConta(session?.user || null);

  client.auth.onAuthStateChange((_event, novaSessao) => {
    // Deixa o callback interno do SDK liberar sua trava antes de consultar a tabela profiles.
    setTimeout(() => { void atualizarConta(novaSessao?.user || null); }, 0);
  });

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const pane = tab.dataset.authTab;
      tabs.forEach(t => {
        const ativo = t === tab;
        t.classList.toggle("active", ativo);
        t.setAttribute("aria-selected", String(ativo));
      });
      signinForm.hidden = pane !== "signin";
      signupForm.hidden = pane !== "signup";
      status.textContent = pane === "signin"
        ? "Entre com e-mail e senha. Novo por aqui? Toque em \"Criar conta\"."
        : "Crie sua conta com nome de jogador, e-mail e senha.";
    });
  });

  function bloquear(bloqueado) {
    signinForm.querySelector("button[type=submit]").disabled = bloqueado;
    signupForm.querySelector("button[type=submit]").disabled = bloqueado;
    googleButton.disabled = bloqueado;
  }

  signinForm.addEventListener("submit", async event => {
    event.preventDefault();
    const formData = new FormData(signinForm);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    if (!email || !password) return;
    const verificacao = turnstile.verificar();
    if (!verificacao.ok) {
      status.textContent = verificacao.mensagem;
      return;
    }
    bloquear(true);
    status.textContent = "Verificando suas credenciais…";
    try {
      const { error } = await client.auth.signInWithPassword({
        email,
        password,
        ...(verificacao.captchaToken ? { options: { captchaToken: verificacao.captchaToken } } : {})
      });
      if (error) throw error;
    } catch (error) {
      status.textContent = traduzirErroAuth(error) || "Não foi possível entrar. Confira e-mail e senha.";
      turnstile.reset();
    } finally {
      bloquear(false);
    }
  });

  signupForm.addEventListener("submit", async event => {
    event.preventDefault();
    const formData = new FormData(signupForm);
    const displayName = String(formData.get("displayName") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");
    if (!displayName || !email || !password) return;
    if (password !== confirmPassword) {
      status.textContent = "As senhas não coincidem. Confira e tente novamente.";
      return;
    }
    const verificacao = turnstile.verificar();
    if (!verificacao.ok) {
      status.textContent = verificacao.mensagem;
      return;
    }
    bloquear(true);
    status.textContent = "Criando sua conta…";
    try {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
          ...(verificacao.captchaToken ? { captchaToken: verificacao.captchaToken } : {})
        }
      });
      if (error) throw error;
      status.textContent = data?.session
        ? "Conta criada! Entrando…"
        : "Conta criada. Confira seu e-mail para confirmar o cadastro e depois entre com sua senha.";
    } catch (error) {
      status.textContent = traduzirErroAuth(error) || "Não foi possível criar a conta agora.";
      turnstile.reset();
    } finally {
      bloquear(false);
    }
  });

  googleButton.addEventListener("click", async () => {
    bloquear(true);
    status.textContent = "Abrindo o acesso pelo Google…";
    try {
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${window.location.pathname}`,
          queryParams: { access_type: "offline", prompt: "consent" }
        }
      });
      if (error) throw error;
    } catch (error) {
      status.textContent = traduzirErroAuth(error) || "O acesso pelo Google não está disponível agora.";
      bloquear(false);
    }
    // Em caso de redirecionamento bem-sucedido a página navega para fora.
  });

  signout.addEventListener("click", async () => {
    signout.disabled = true;
    try {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    } catch {
      accountStatus.textContent = "Não foi possível concluir a saída. Verifique a conexão e tente novamente.";
    } finally {
      signout.disabled = false;
    }
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
