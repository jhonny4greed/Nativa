import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const EMAIL_SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
let clienteSupabasePromise;

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

export async function inicializarAutenticacao() {
  const form = document.querySelector("#online-auth-form");
  const status = document.querySelector("#online-auth-status");
  const submit = document.querySelector("#online-auth-submit");
  const account = document.querySelector("#online-account-details");
  const accountName = document.querySelector("#online-account-name");
  const accountEmail = document.querySelector("#online-account-email");
  const accountStatus = document.querySelector("#online-account-status");
  const signout = document.querySelector("#online-auth-signout");
  if (!form || !status || !submit || !account || !accountName || !accountEmail || !accountStatus || !signout) return;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    status.textContent = "A autenticação ainda não está configurada para este ambiente.";
    submit.disabled = true;
    return;
  }

  let client;
  try {
    client = await obterClienteSupabase();
  } catch (error) {
    status.textContent = `${error.message} O restante do jogo continua disponível localmente.`;
    submit.disabled = true;
    return;
  }

  function mostrarSessao(user, nome = "") {
    const conectado = Boolean(user);
    form.hidden = conectado;
    account.hidden = !conectado;
    accountStatus.textContent = "";
    if (!conectado) {
      status.textContent = "Nesta etapa o login cria sua identidade. As fichas e fotos continuam somente neste navegador.";
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

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const formData = new FormData(form);
    const displayName = String(formData.get("displayName") || "").trim();
    const email = String(formData.get("email") || "").trim();
    if (!displayName || !email) return;

    submit.disabled = true;
    status.textContent = "Enviando o link de acesso…";
    try {
      const { error } = await client.auth.signInWithOtp({
        email,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: (() => {
            const url = new URL(window.location.href);
            const convite = url.searchParams.get("convite");
            url.search = "";
            url.hash = "";
            if (convite) url.searchParams.set("convite", convite);
            return url.toString();
          })(),
          shouldCreateUser: true
        }
      });
      if (error) throw error;
      const destinoLocal = new URL(SUPABASE_URL).hostname === "127.0.0.1"
        || new URL(SUPABASE_URL).hostname === "localhost";
      status.textContent = destinoLocal
        ? "Link enviado. Abra o Mailpit local em http://127.0.0.1:54324 para concluir o login."
        : "Link enviado. Verifique seu e-mail para concluir o login.";
    } catch (error) {
      status.textContent = error.message || "Não foi possível enviar o link de acesso.";
    } finally {
      submit.disabled = false;
    }
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
