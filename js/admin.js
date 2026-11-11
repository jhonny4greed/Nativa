import { obterClienteSupabase } from "./auth.js";
import { estudioImagens } from "./art-studio.js";
import { obterCatalogoGlobalNativas, validarCatalogoGlobalNativas, aplicarCatalogoGlobalNativas } from "./traits.js";

const escapar = texto => String(texto ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function formatarData(iso) {
  if (!iso) return "—";
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? "—" : data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export async function inicializarPainelAdmin({ clientProvider = obterClienteSupabase } = {}) {
  const navButton = document.querySelector('[data-view="admin"]');
  const status = document.querySelector("#admin-status");
  const userList = document.querySelector("#admin-user-list");
  const refresh = document.querySelector("#admin-refresh-users");
  const catalogStatus = document.querySelector("#admin-catalog-status");
  const catalogSave = document.querySelector("#admin-catalog-save");
  const catalogReload = document.querySelector("#admin-catalog-reload");
  const catalogInputs = {
    tracos: document.querySelector("#admin-catalog-traits"),
    tracosQuimericos: document.querySelector("#admin-catalog-chimeric"),
    habitos: document.querySelector("#admin-catalog-habits"),
    tracosPorLinhagem: document.querySelector("#admin-catalog-lineages")
  };
  if (!navButton || !status || !userList || !refresh) return;

  let client = null;
  let isAdmin = false;
  let users = [];
  let allowlist = [];
  let currentUserId = null;
  let catalogRevision = 1;

  async function invoke(action, extra = {}) {
    const { data, error } = await client.functions.invoke("admin-panel", { body: { action, ...extra } });
    if (error) throw new Error(error.message || "A ação administrativa falhou.");
    return data;
  }

  function render() {
    if (!isAdmin) return;
    const allowSet = new Set(allowlist.map(entry => entry.user_id));
    if (!users.length) {
      userList.innerHTML = '<p class="muted">Nenhum usuário encontrado.</p>';
      return;
    }
    userList.innerHTML = users.map(user => {
      const isSelf = user.id === currentUserId;
      const podeGerar = allowSet.has(user.id);
      return `<article class="admin-user" data-user-id="${escapar(user.id)}">
        <div class="admin-user-info">
          <strong>${escapar(user.displayName || user.email || user.id)}</strong>
          <span class="muted">${escapar(user.email || "sem e-mail")} · ${escapar(user.id)}</span>
          <span class="muted">${user.confirmed ? "confirmado" : "pendente"} · criado em ${formatarData(user.createdAt)}${user.providers.length ? ` · ${escapar(user.providers.join(", "))}` : ""}</span>
        </div>
        <div class="admin-user-actions">
          <button type="button" class="small secondary" data-admin-action="toggle-allowlist">${podeGerar ? "Bloquear imagens" : "Liberar imagens"}</button>
          <button type="button" class="small secondary" data-admin-action="toggle-role" ${isSelf ? "disabled" : ""}>${user.role === "admin" ? "Rebaixar para jogador" : "Tornar admin"}</button>
        </div>
      </article>`;
    }).join("");
  }

  async function carregarPainel() {
    status.textContent = "Carregando usuários…";
    const [usuarios, lista] = await Promise.all([invoke("users"), invoke("allowlist-list")]);
    users = usuarios?.users || [];
    allowlist = lista?.allowlist || [];
    const { data: perfis } = await client.from("profiles").select("id,role").in("id", users.map(u => u.id));
    const roleMap = new Map((perfis || []).map(entry => [entry.id, entry.role]));
    users = users.map(user => ({ ...user, role: roleMap.get(user.id) || "player" }));
    status.textContent = `${users.length} conta(s) registradas · ${allowlist.length} na allowlist de imagens.`;
    render();
  }

  userList.addEventListener("click", async event => {
    const button = event.target.closest("[data-admin-action]");
    if (!button) return;
    const userId = button.closest(".admin-user")?.dataset.userId;
    const target = users.find(u => u.id === userId);
    if (!target) return;
    button.disabled = true;
    status.textContent = "Aplicando alteração…";
    try {
      if (button.dataset.adminAction === "toggle-allowlist") {
        const allowed = allowlist.some(entry => entry.user_id === userId);
        await invoke(allowed ? "allowlist-remove" : "allowlist-add", { userId });
        allowlist = allowed ? allowlist.filter(entry => entry.user_id !== userId)
          : [...allowlist, { user_id: userId, created_at: new Date().toISOString() }];
      } else if (button.dataset.adminAction === "toggle-role") {
        const novo = target.role === "admin" ? "player" : "admin";
        await invoke("set-role", { userId, role: novo });
        target.role = novo;
      }
      status.textContent = "Alteração aplicada.";
      render();
    } catch (error) {
      status.textContent = error.message || "Não foi possível aplicar a alteração.";
    } finally {
      button.disabled = false;
    }
  });

  refresh.addEventListener("click", () => { void carregarPainel().catch(() => { status.textContent = "Não foi possível atualizar a lista."; }); });

  function preencherEditorCatalogo(catalogo) {
    for (const [key, input] of Object.entries(catalogInputs)) {
      if (input) input.value = JSON.stringify(catalogo[key], null, 2);
    }
  }

  async function carregarCatalogoAdmin() {
    if (!isAdmin || !catalogStatus) return;
    catalogStatus.textContent = "Carregando catálogo compartilhado…";
    const { data, error } = await client.from("nativa_global_catalog").select("catalog,revision,updated_at").eq("id", "main").maybeSingle();
    if (error) throw error;
    catalogRevision = Number(data?.revision || 1);
    const catalogo = data?.catalog && Object.keys(data.catalog).length ? data.catalog : obterCatalogoGlobalNativas();
    preencherEditorCatalogo(catalogo);
    catalogStatus.textContent = data?.updated_at
      ? `Revisão ${catalogRevision} · atualizada em ${formatarData(data.updated_at)}.`
      : "Exibindo os padrões do projeto. Publique para iniciar o catálogo global.";
  }

  catalogReload?.addEventListener("click", () => {
    void carregarCatalogoAdmin().catch(error => { catalogStatus.textContent = error.message || "Não foi possível carregar o catálogo."; });
  });
  catalogSave?.addEventListener("click", async () => {
    if (!isAdmin || !client) return;
    catalogSave.disabled = true;
    catalogStatus.textContent = "Validando e publicando o catálogo…";
    try {
      const catalogo = validarCatalogoGlobalNativas(Object.fromEntries(
        Object.entries(catalogInputs).map(([key, input]) => [key, JSON.parse(input?.value || "null")])
      ));
      const { data, error } = await client.rpc("save_nativa_global_catalog", {
        p_catalog: catalogo,
        p_expected_revision: catalogRevision
      });
      if (error) throw error;
      aplicarCatalogoGlobalNativas(data.catalog);
      catalogRevision = Number(data.revision);
      preencherEditorCatalogo(data.catalog);
      catalogStatus.textContent = `Catálogo publicado para todas as contas · revisão ${catalogRevision}.`;
    } catch (error) {
      catalogStatus.textContent = error.message || "Não foi possível publicar o catálogo.";
    } finally {
      catalogSave.disabled = false;
    }
  });

  // Assistente administrativo: conversa com a function admin-assistant e
  // executa ações sugeridas somente após clique explícito.
  const assistantLog = document.querySelector("#admin-assistant-log");
  const assistantForm = document.querySelector("#admin-assistant-form");
  const assistantInput = document.querySelector("#admin-assistant-input");
  const assistantStatus = document.querySelector("#admin-assistant-status");
  const conversa = [];

  function adicionarMensagem(texto, papel) {
    const item = document.createElement("p");
    item.className = `assistant-msg assistant-${papel}`;
    item.textContent = texto;
    assistantLog?.append(item);
    assistantLog?.scrollTo({ top: assistantLog.scrollHeight });
  }

  function rotuloAcao(acao) {
    if (acao.type === "generate-image") return `Gerar imagem: ${acao.title || "sem título"}`;
    if (acao.type === "allowlist-add") return "Liberar geração de imagens";
    if (acao.type === "allowlist-remove") return "Bloquear geração de imagens";
    if (acao.type === "set-role") return `Definir papel ${acao.role || "?"}`;
    return acao.type;
  }

  async function executarAcao(acao, botao) {
    botao.disabled = true;
    try {
      if (acao.type === "generate-image") {
        assistantStatus.textContent = "Gerando imagem… isso pode levar alguns segundos.";
        const { blob } = await estudioImagens.gerar({ kind: acao.kind, title: acao.title, prompt: acao.prompt });
        const url = URL.createObjectURL(blob);
        const preview = document.createElement("a");
        preview.href = url;
        preview.download = `${acao.title || "nativa-art"}.png`;
        preview.target = "_blank";
        const img = document.createElement("img");
        img.src = url;
        img.alt = acao.title || "Arte gerada";
        img.className = "assistant-art";
        preview.append(img);
        assistantLog?.append(preview);
        assistantStatus.textContent = "Imagem gerada. Clique para baixar.";
      } else if (acao.type === "allowlist-add" || acao.type === "allowlist-remove" || acao.type === "set-role") {
        const action = acao.type === "set-role" ? "set-role" : acao.type;
        await invoke(action, { userId: acao.userId, ...(acao.role ? { role: acao.role } : {}) });
        assistantStatus.textContent = "Ação administrativa aplicada. Atualizando o painel…";
        await carregarPainel();
      } else {
        assistantStatus.textContent = "Tipo de ação não suportado pelo painel.";
        botao.disabled = false;
        return;
      }
      botao.textContent = "Feito ✓";
    } catch (error) {
      assistantStatus.textContent = error.message || "A ação falhou.";
      botao.disabled = false;
    }
  }

  assistantForm?.addEventListener("submit", async event => {
    event.preventDefault();
    const texto = assistantInput.value.trim();
    if (!texto || !isAdmin) return;
    assistantInput.value = "";
    adicionarMensagem(texto, "user");
    conversa.push({ role: "user", content: texto });
    if (conversa.length > 20) conversa.splice(0, conversa.length - 20);
    const enviar = assistantForm.querySelector("button[type=submit]");
    enviar.disabled = true;
    assistantStatus.textContent = "O assistente está pensando…";
    try {
      const { data, error } = await client.functions.invoke("admin-assistant", { body: { messages: conversa } });
      if (error) throw error;
      const resposta = data?.reply || "(sem resposta)";
      adicionarMensagem(resposta, "bot");
      conversa.push({ role: "assistant", content: resposta });
      for (const acao of data?.actions || []) {
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "small secondary assistant-action";
        botao.textContent = rotuloAcao(acao);
        botao.addEventListener("click", () => { void executarAcao(acao, botao); });
        assistantLog?.append(botao);
      }
      assistantStatus.textContent = "";
      assistantLog?.scrollTo({ top: assistantLog.scrollHeight });
    } catch {
      adicionarMensagem("Não consegui falar com o assistente agora.", "bot");
      assistantStatus.textContent = "Verifique a conexão e tente novamente.";
    } finally {
      enviar.disabled = false;
    }
  });

  async function verificarPermissao(user) {
    if (!client || !user) {
      isAdmin = false;
      navButton.hidden = true;
      return;
    }
    try {
      const { data } = await client.from("profiles").select("role").eq("id", user.id).maybeSingle();
      isAdmin = data?.role === "admin";
    } catch {
      isAdmin = false;
    }
    navButton.hidden = !isAdmin;
    if (isAdmin) {
      if (users.length === 0) void carregarPainel().catch(() => { status.textContent = "Não foi possível carregar o painel."; });
      void carregarCatalogoAdmin().catch(error => { if (catalogStatus) catalogStatus.textContent = error.message || "Não foi possível carregar o catálogo."; });
    }
  }

  try {
    client = await clientProvider();
  } catch {
    status.textContent = "A autenticação não está disponível neste ambiente.";
    return;
  }

  const { data: { session } } = await client.auth.getSession();
  currentUserId = session?.user?.id || null;
  await verificarPermissao(session?.user || null);
  client.auth.onAuthStateChange((_event, novaSessao) => {
    currentUserId = novaSessao?.user?.id || null;
    users = [];
    allowlist = [];
    setTimeout(() => { void verificarPermissao(novaSessao?.user || null); }, 0);
  });
}
