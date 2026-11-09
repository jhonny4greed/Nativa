import { obterClienteSupabase } from "./auth.js";

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
  if (!navButton || !status || !userList || !refresh) return;

  let client = null;
  let isAdmin = false;
  let users = [];
  let allowlist = [];
  let currentUserId = null;

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
    if (isAdmin && users.length === 0) {
      void carregarPainel().catch(() => { status.textContent = "Não foi possível carregar o painel."; });
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
