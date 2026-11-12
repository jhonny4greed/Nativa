import { obterClienteSupabase } from "./auth.js";
import { repositorioLocal } from "./repository.js";
import { TECNICAS, obterTecnicaPorId } from "./techniques.js";
import { AFINIDADES } from "./data.js";
import { ESSENCIAS, verificarEssencia } from "./essences.js";
import { CATALOGO_TRACOS, obterTracosPadraoLinhagem } from "./traits.js";
import { podeAprenderTecnica } from "./technique-learning.js";
import { concederXpCampanha, definirNivelCampanha, concederEssenciaCampanha, concederTracoCampanha, removerTracoCampanha, concederTecnicaCampanha, removerTecnicaCampanha } from "./room-companion-admin.js";

function mensagemErroSala(error) {
  const mensagem = String(error?.message || "");
  if (/failed to fetch|fetch failed|networkerror|network request failed|err_connection|timeout/i.test(mensagem)) return "Não foi possível conectar ao Supabase local. Verifique a conexão e tente novamente. O jogo offline continua disponível.";
  if (/authentication required|jwt|not authenticated/i.test(mensagem)) return "Entre na sua conta para continuar.";
  if (/invalid or unavailable invite/i.test(mensagem)) return "Este convite é inválido, expirou, foi revogado, esgotou os usos ou a sala foi fechada.";
  if (/room delete denied/i.test(mensagem)) return "Somente o mestre que criou esta sala pode apagá-la.";
  if (/room master required/i.test(mensagem)) return "Somente o mestre desta sala pode gerenciar convites.";
  if (/room member required/i.test(mensagem)) return "Você não participa desta sala ou ela não está disponível.";
  if (/room companion access denied|nativa owner required/i.test(mensagem)) return "Você só pode escolher suas próprias Nativas e editar os companheiros permitidos desta sala.";
  if (/room is closed/i.test(mensagem)) return "Esta sala está encerrada e não aceita novas alterações.";
  if (/room player not found|room master cannot be removed/i.test(mensagem)) return "Esse participante não pode ser removido desta sala.";
  if (/room name confirmation mismatch/i.test(mensagem)) return "O nome digitado não corresponde ao nome atual da sala.";
  if (/invalid room name/i.test(mensagem)) return "Informe um nome de sala com até 80 caracteres.";
  if (/active campaign companion required/i.test(mensagem)) return "Escolha um companheiro ativo desta campanha.";
  if (/companion is busy|a companion is busy/i.test(mensagem)) return "Um dos companheiros já está em outro encontro desta sala.";
  if (/only challenged player can respond/i.test(mensagem)) return "Somente o jogador desafiado pode responder a este PvP.";
  if (/room master required/i.test(mensagem)) return "Somente o mestre pode aprovar caçadas extras.";
  if (/request is no longer pending/i.test(mensagem)) return "Este pedido já foi respondido.";
  if (/turn changed/i.test(mensagem)) return "A rodada mudou. Atualize os encontros e escolha novamente.";
  if (/action already confirmed/i.test(mensagem)) return "Sua ação já foi confirmada nesta rodada.";
  return mensagem || "Não foi possível concluir a operação. Tente novamente.";
}

function elemento(tag, texto, classe) {
  const node = document.createElement(tag);
  if (texto !== undefined) node.textContent = texto;
  if (classe) node.className = classe;
  return node;
}

function textoCampo(valor) {
  if (Array.isArray(valor)) return valor.filter(item => item != null && item !== "").map(String).join(" · ");
  return valor == null ? "" : String(valor);
}

function valorNumerico(valor) {
  if (typeof valor === "number") return Number.isFinite(valor);
  return typeof valor === "string" && valor.trim() !== "" && Number.isFinite(Number(valor));
}

function adicionarSelo(container, label, value) {
  const content = textoCampo(value);
  if (!content) return;
  const item = elemento("div", undefined, "room-companion-fact");
  item.append(elemento("span", label), elemento("strong", content));
  container.append(item);
}

function selectOptions(select, records, labelOf, valueOf) {
  select.append(new Option("Selecione…", ""));
  for (const record of records) select.append(new Option(labelOf(record), valueOf(record)));
}

function anexarAtributos(container, data) {
  const attrs = data?.attrs && typeof data.attrs === "object" ? data.attrs : {};
  const definitions = [
    ["ATQ", "Ataque"], ["POT", "Potência"], ["DEF", "Defesa"],
    ["RES", "Resistência"], ["AGI", "Agilidade"], ["HP", "PV · atributo"], ["MP", "MP · atributo"]
  ];
  const values = definitions.filter(([key]) => valorNumerico(attrs[key]))
    .map(([key, label]) => [label, Number(attrs[key])]);
  if (values.length) {
    const grid = elemento("div", undefined, "room-companion-stats");
    for (const [label, value] of values) {
      const stat = elemento("div", undefined, "room-companion-stat");
      stat.append(elemento("span", label), elemento("strong", String(value)));
      grid.append(stat);
    }
    container.append(grid);
  }

  const vitals = [
    { label: "PV", current: ["pvAtual", "currentPV", "hpAtual", "currentHP"], maximum: ["pvMax", "pvMaximo", "maxPV", "hpMax", "maxHP"] },
    { label: "MP", current: ["pmAtual", "currentPM", "mpAtual", "currentMP"], maximum: ["pmMax", "pmMaximo", "maxPM", "mpMax", "maxMP"] }
  ];
  for (const vital of vitals) {
    const currentKey = vital.current.find(key => valorNumerico(data?.[key]));
    const maximumKey = vital.maximum.find(key => valorNumerico(data?.[key]));
    if (!currentKey || !maximumKey) continue;
    const current = Number(data[currentKey]);
    const maximum = Number(data[maximumKey]);
    const row = elemento("div", undefined, "room-companion-vital");
    const label = elemento("div", undefined, "room-companion-vital-label");
    label.append(elemento("span", vital.label), elemento("strong", `${current} / ${maximum}`));
    const bar = elemento("div", undefined, vital.label === "MP" ? "room-companion-bar is-mana" : "room-companion-bar");
    const fill = elemento("span");
    fill.style.width = `${maximum > 0 ? Math.max(0, Math.min(100, current / maximum * 100)) : 0}%`;
    bar.append(fill);
    row.append(label, bar);
    container.append(row);
  }
}

function anexarTecnicas(container, data) {
  if (!Array.isArray(data?.techniques) || !data.techniques.length) return;
  const section = elemento("section", undefined, "room-companion-techniques");
  section.append(elemento("h6", "Técnicas"));
  const list = elemento("ul");
  for (const entry of data.techniques) {
    const id = typeof entry === "string" ? entry : entry?.id;
    const technique = typeof entry === "object" && entry ? entry : obterTecnicaPorId(id);
    const name = technique?.nome || technique?.name || (id ? `Técnica · ${id}` : "Técnica registrada");
    const item = elemento("li", undefined, "room-companion-technique");
    item.append(elemento("strong", String(name)));
    const meta = [
      technique?.categoria || technique?.category,
      technique?.grupo || technique?.group,
      technique?.mp != null ? `MP ${technique.mp}` : null,
      technique?.dano != null ? `Dano ${technique.dano}` : null,
      technique?.precisao != null ? `Precisão ${technique.precisao}` : null,
      technique?.recarga != null ? `Recarga ${technique.recarga}` : null
    ].filter(value => value != null && value !== "").join(" · ");
    if (meta) item.append(elemento("span", meta));
    const effect = technique?.efeito || technique?.effect;
    if (effect) item.append(elemento("p", String(effect)));
    list.append(item);
  }
  section.append(list);
  container.append(section);
}

export async function inicializarSalas() {
  const panel = document.querySelector("#online-rooms-panel");
  const hint = document.querySelector("#online-rooms-auth-hint");
  const content = document.querySelector("#online-rooms-content");
  const status = document.querySelector("#online-rooms-status");
  const createForm = document.querySelector("#online-create-room-form");
  const joinForm = document.querySelector("#online-join-room-form");
  const inviteInput = document.querySelector("#online-room-invite-token");
  const refreshButton = document.querySelector("#online-refresh-rooms");
  const roomList = document.querySelector("#online-room-list");
  const details = document.querySelector("#online-room-details");
  const roomName = document.querySelector("#online-room-name");
  const roomMeta = document.querySelector("#online-room-meta");
  const participants = document.querySelector("#online-room-participants");
  const roomNativasStatus = document.querySelector("#online-room-nativas-status");
  const roomNativasList = document.querySelector("#online-room-nativas-list");
  const refreshRoomNativas = document.querySelector("#online-refresh-room-nativas");
  const chooseCompanionForm = document.querySelector("#online-choose-room-companion-form");
  const companionChoice = document.querySelector("#online-room-companion-choice");
  const roomAdmin = document.querySelector("#online-room-admin");
  const renameRoomForm = document.querySelector("#online-rename-room-form");
  const renameRoomName = document.querySelector("#online-rename-room-name");
  const adminParticipants = document.querySelector("#online-room-admin-participants");
  const closeRoomButton = document.querySelector("#online-close-room");
  const deleteRoomButton = document.querySelector("#online-delete-room");
  const invitePanel = document.querySelector("#online-room-invites");
  const createInviteForm = document.querySelector("#online-create-invite-form");
  const inviteList = document.querySelector("#online-room-invite-list");
  const createdInvite = document.querySelector("#online-created-invite");
  const createdInviteValue = document.querySelector("#online-created-invite-value");
  const createdInviteHelp = document.querySelector("#online-created-invite-help");
  const copyInviteButton = document.querySelector("#online-copy-invite");
  const closeDetailsButton = document.querySelector("#online-close-room-details");
  const gameStatus = document.querySelector("#online-room-game-status");
  const gameCompanion = document.querySelector("#online-room-game-companion");
  const gameTarget = document.querySelector("#online-room-game-target");
  const gameHuntsLeft = document.querySelector("#online-room-hunts-left");
  const gameRequests = document.querySelector("#online-room-game-requests");
  const gameEncounters = document.querySelector("#online-room-game-encounters");
  if (!panel || !hint || !content || !status || !createForm || !joinForm || !inviteInput || !refreshButton || !roomList || !details || !roomName || !roomMeta || !participants || !roomNativasStatus || !roomNativasList || !refreshRoomNativas || !chooseCompanionForm || !companionChoice || !roomAdmin || !renameRoomForm || !renameRoomName || !adminParticipants || !closeRoomButton || !deleteRoomButton || !invitePanel || !createInviteForm || !inviteList || !createdInvite || !createdInviteValue || !createdInviteHelp || !copyInviteButton || !closeDetailsButton || !gameStatus || !gameCompanion || !gameTarget || !gameHuntsLeft || !gameRequests || !gameEncounters) return;

  let client;
  try {
    client = await obterClienteSupabase();
  } catch {
    hint.textContent = "As salas online estão indisponíveis sem conexão com o Supabase. O jogo local continua funcionando.";
    return;
  }

  let usuarioAtual = null;
  let membrosDaSala = new Map();
  let participantesDaSala = [];
  let salaSelecionada = null;
  let roomArenaEncounterId = null;
  let roomGamePoll = null;
  const roomPhotoUrls = new Set();
  let conviteDaUrl = new URL(window.location.href).searchParams.get("convite");
  let autoEntradaEmAndamento = false;
  if (conviteDaUrl) inviteInput.value = conviteDaUrl;

  function setStatus(texto) {
    status.textContent = texto;
  }

  async function chamarJogo(action, payload = {}) {
    const { data, error } = await client.functions.invoke("room-game", { body: { action, payload } });
    if (error) throw new Error(data?.error || error.message || "Ação da mesa indisponível.");
    return data;
  }

  function mostrarEstadoJogo(texto) { gameStatus.textContent = texto; }

  async function carregarJogoDaSala(roomId) {
    if (!salaSelecionada || salaSelecionada.id !== roomId) return;
    try {
      const snapshot = await chamarJogo("context", { roomId });
      gameHuntsLeft.textContent = `· ${snapshot.free_hunts_remaining ?? 0} gratuitas hoje`;
      gameRequests.replaceChildren(); gameEncounters.replaceChildren();
      for (const request of snapshot.requests || []) {
        const card = elemento("article", undefined, "room-game-request");
        card.append(elemento("p", request.kind === "pvp" ? `${request.requester_name} desafiou você para PvP por turnos.` : `${request.requester_name} pediu uma caçada extra.`));
        for (const [action, label] of [["accept", "Aceitar"], ["decline", "Recusar"]]) {
          const button = elemento("button", label, action === "accept" ? "small" : "small secondary"); button.type = "button";
          button.dataset.roomGameAction = action; button.dataset.requestId = request.id; card.append(button);
        }
        gameRequests.append(card);
      }
      if (!gameRequests.childElementCount) gameRequests.append(elemento("p", "Nenhum pedido aguardando resposta.", "muted"));
      for (const encounter of snapshot.encounters || []) {
        const card = elemento("article", undefined, `room-game-encounter${encounter.status === "active" ? " is-active" : ""}`);
        const isHunt = encounter.kind === "hunt";
        card.append(elemento("div", undefined, "room-game-encounter-heading"));
        const heading = card.firstChild;
        heading.append(elemento("strong", isHunt ? "Caçada selvagem" : "Duelo PvP"), elemento("span", encounter.status === "active" ? `Turno ${encounter.turn} · em andamento` : "Encontro concluído"));
        const fighters = encounter.state?.fighters || [];
        const party = [...(encounter.participants || [])].sort((a, b) => String(a.player_id).localeCompare(String(b.player_id)));
        const names = isHunt ? [party[0]?.companion_name || "Seu companheiro", fighters[1]?.nativa?.name || "Nativa selvagem"] : party.map(item => item.companion_name || item.display_name);
        card.append(elemento("p", names.join("  ×  "), "room-game-matchup"));
        const log = encounter.state?.history || [];
        if (log.length) card.append(elemento("p", log[log.length - 1], "room-game-last-event"));
        const playerIndex = party.findIndex(item => item.player_id === usuarioAtual.id);
        if (encounter.status === "active") {
          const hasChoice = Boolean(encounter.own_choice);
          const actionBox = elemento("div", undefined, "room-game-actions");
          if (playerIndex >= 0 && encounter.state) {
            const openArena = elemento("button", hasChoice ? "Ver encontro na Arena · ação confirmada" : "Jogar encontro na Arena", "small room-game-open-arena");
            openArena.type = "button"; openArena.dataset.openRoomArena = encounter.id;
            actionBox.append(openArena);
          } else actionBox.append(elemento("span", "Aguardando o outro jogador aceitar ou agir.", "muted"));
          if (membrosDaSala.get(roomId) === "master") {
            const cancel = elemento("button", "Encerrar encontro", "small secondary"); cancel.type = "button"; cancel.dataset.cancelEncounter = encounter.id; actionBox.append(cancel);
          }
          card.append(actionBox);
        } else {
          if (encounter.result?.xp) card.append(elemento("p", `Recompensa da campanha: ${encounter.result.xp} XP${encounter.result.essence ? " · Essência guardada" : ""}.`, "room-game-reward"));
          if (encounter.state && playerIndex >= 0) {
            const replay = elemento("button", "Rever batalha na Arena", "small secondary room-game-open-arena");
            replay.type = "button"; replay.dataset.openRoomArena = encounter.id; card.append(replay);
          }
        }
        gameEncounters.append(card);
        if (roomArenaEncounterId === encounter.id && encounter.state) {
          document.dispatchEvent(new CustomEvent("nativa:room-arena-update", { detail: {
            encounter, roomId, userId: usuarioAtual.id,
            roomSubmit: async (choice, turn) => {
              await chamarJogo("submit", { roomId, encounterId: encounter.id, turn, choice });
              await carregarNativasDaSala(roomId);
            },
            roomForfeit: async () => {
              await chamarJogo("forfeit", { roomId, encounterId: encounter.id });
              await carregarNativasDaSala(roomId);
            }
          } }));
        }
      }
      if (!gameEncounters.childElementCount) gameEncounters.append(elemento("p", "Nenhum encontro nesta sala ainda.", "muted"));
      mostrarEstadoJogo("");
    } catch (error) { mostrarEstadoJogo(mensagemErroSala(error)); }
  }

  function liberarFotosDaSala() {
    for (const url of roomPhotoUrls) URL.revokeObjectURL(url);
    roomPhotoUrls.clear();
  }

  async function carregarSalas() {
    if (!usuarioAtual) return;
    setStatus("Carregando suas salas…");
    const { data: memberships, error: membershipError } = await client
      .from("room_members")
      .select("room_id,role")
      .eq("user_id", usuarioAtual.id);
    if (membershipError) throw membershipError;

    membrosDaSala = new Map((memberships || []).map(member => [member.room_id, member.role]));
    roomList.replaceChildren();
    salaSelecionada = null;
    details.hidden = true;
    if (!memberships?.length) {
      roomList.append(elemento("p", "Você ainda não participa de nenhuma sala.", "muted"));
      setStatus("");
      return;
    }

    const ids = memberships.map(member => member.room_id);
    const { data: rooms, error: roomsError } = await client
      .from("rooms")
      .select("id,name,status,created_by,created_at")
      .in("id", ids)
      .order("created_at", { ascending: false });
    if (roomsError) throw roomsError;

    for (const room of rooms || []) {
      const card = elemento("article", undefined, "feature-card");
      card.append(elemento("span", membrosDaSala.get(room.id) === "master" ? "MESTRE" : "JOGADOR"));
      card.append(elemento("h4", room.name));
      card.append(elemento("p", room.status === "open" ? "Sala aberta" : "Sala fechada"));
      const open = elemento("button", "Abrir sala", "small secondary");
      open.type = "button";
      open.dataset.openRoom = room.id;
      card.append(open);
      roomList.append(card);
    }
    setStatus("");
  }

  async function carregarConvites(roomId) {
    inviteList.replaceChildren();
    const { data, error } = await client.rpc("list_room_invites", { p_room_id: roomId });
    if (error) throw error;
    if (!data?.length) {
      inviteList.append(elemento("li", "Nenhum convite emitido."));
      return;
    }

    for (const invite of data) {
      const row = elemento("li");
      const kind = invite.kind === "link" ? "Link" : "Código";
      const expiresAt = new Date(invite.expires_at).toLocaleString();
      let inviteState = "Ativo";
      if (invite.revoked_at) inviteState = "Revogado";
      else if (new Date(invite.expires_at).getTime() <= Date.now()) inviteState = "Expirado";
      else if (invite.uses_count >= invite.max_uses) inviteState = "Usos esgotados";
      row.append(elemento("span", `${kind} · ${invite.uses_count}/${invite.max_uses} usos · vence ${expiresAt} · ${inviteState}`));
      if (!invite.revoked_at) {
        const revoke = elemento("button", "Revogar", "small secondary");
        revoke.type = "button";
        revoke.dataset.revokeInvite = invite.id;
        revoke.dataset.roomId = roomId;
        row.append(revoke);
      }
      inviteList.append(row);
    }
  }

  async function carregarNativasDaSala(roomId) {
    roomNativasStatus.textContent = "Carregando companheiros com as permissões da sala…";
    liberarFotosDaSala();
    roomNativasList.replaceChildren();
    const isMaster = membrosDaSala.get(roomId) === "master";
    const salaAberta = salaSelecionada?.status === "open";
    chooseCompanionForm.hidden = !salaAberta;
    companionChoice.replaceChildren();

    const [{ data: rows, error: rowsError }, { data: ownNativas, error: ownError }] = await Promise.all([
      client.rpc("get_room_companions", { p_room_id: roomId }),
      client.from("nativas")
        .select("id,local_id,data,format_version")
        .eq("owner_id", usuarioAtual.id)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
    ]);
    if (rowsError) throw rowsError;
    if (ownError) throw ownError;

    const ownPlaceholder = elemento("option", ownNativas?.length ? "Escolha uma Nativa sua…" : "Você ainda não tem Nativas sincronizadas");
    ownPlaceholder.value = "";
    ownPlaceholder.disabled = true;
    ownPlaceholder.selected = true;
    companionChoice.append(ownPlaceholder);
    for (const nativa of ownNativas || []) {
      const option = elemento("option", String(nativa.data?.name || nativa.data?.nome || nativa.local_id));
      option.value = nativa.id;
      companionChoice.append(option);
    }
    gameCompanion.replaceChildren(new Option("Escolha seu companheiro ativo…", ""));
    for (const row of rows || []) {
      if (row.player_id !== usuarioAtual.id || row.companion_state !== "active" || !row.campaign_data) continue;
      gameCompanion.append(new Option(String(row.campaign_data.name || row.campaign_data.nome || "Nativa"), row.companion_id));
    }
    gameCompanion.disabled = !gameCompanion.options.length || gameCompanion.options.length < 2 || !salaAberta;
    gameTarget.replaceChildren(new Option("Escolha participante…", ""));
    for (const member of participantesDaSala) {
      if (member.user_id === usuarioAtual.id) continue;
      const hasCompanion = (rows || []).some(row => row.player_id === member.user_id && row.companion_state === "active");
      if (hasCompanion) gameTarget.append(new Option(String(member.display_name || "Jogador"), member.user_id));
    }
    gameTarget.disabled = gameTarget.options.length < 2 || !salaAberta;
    companionChoice.disabled = !ownNativas?.length || !salaAberta;
    chooseCompanionForm.querySelector("button[type=submit]").disabled = companionChoice.disabled;

    async function criarFichaVisual({ data, eyebrow, campaign = false, preview = false, row = null }) {
      const card = elemento("article", undefined, `room-companion-card${preview ? " is-preview" : ""}`);
      const hero = elemento("div", undefined, "room-companion-hero");
      const portrait = elemento("div", undefined, "room-companion-portrait");
      portrait.setAttribute("aria-label", "Retrato de " + String(data.name || data.nome || "Nativa"));
      const photo = data.photoId ? await repositorioLocal.obterFoto(data.photoId) : null;
      if (photo instanceof Blob) {
        const url = URL.createObjectURL(photo);
        roomPhotoUrls.add(url);
        const image = elemento("img");
        image.src = url;
        image.alt = "Retrato de " + String(data.name || data.nome || "Nativa");
        portrait.append(image);
      } else {
        portrait.append(elemento("span", "✦", "room-companion-placeholder"));
        portrait.append(elemento("small", data.photoId ? "Imagem não disponível neste dispositivo" : "Sem retrato local"));
      }
      const identity = elemento("div", undefined, "room-companion-identity");
      identity.append(elemento("span", eyebrow, "room-companion-eyebrow"));
      identity.append(elemento("h5", String(data.name || data.nome || row?.source_local_id || "Nativa")));
      const lineage = data.lineageName || data.lineage;
      const identityLine = [data.species].filter(Boolean).map(String).join(" · ");
      if (identityLine) identity.append(elemento("p", identityLine));
      const chips = elemento("div", undefined, "room-companion-chips");
      for (const [label, value] of [["Afinidade", data.affinity ?? data.affinities], ["Arquétipo", data.archetype]]) {
        if (!value) continue;
        chips.append(elemento("span", `${label} · ${textoCampo(value)}`));
      }
      identity.append(chips);
      hero.append(portrait, identity);
      card.append(hero);

      if (campaign && row) {
        const campaignPanel = elemento("div", undefined, "room-companion-campaign");
        campaignPanel.append(elemento("span", "PROGRESSÃO DESTA CAMPANHA", "room-companion-eyebrow"));
        const progress = elemento("div", undefined, "room-companion-campaign-values");
        if (valorNumerico(data.nivel)) adicionarSelo(progress, "Nível", data.nivel);
        if (valorNumerico(data.xp)) adicionarSelo(progress, "XP", data.xp);
        if (progress.childElementCount) campaignPanel.append(progress);
        campaignPanel.append(elemento("small", row.companion_state === "history" ? "Registro anterior desta campanha" : "Progresso independente da ficha original"));
        card.append(campaignPanel);
      }

      const facts = elemento("div", undefined, "room-companion-facts");
      adicionarSelo(facts, "Grupo biológico", data.groupBio);
      adicionarSelo(facts, "Habitat", data.bioma);
      adicionarSelo(facts, "Linhagem", lineage);
      adicionarSelo(facts, "Afinidades", data.affinity ?? data.affinities);
      adicionarSelo(facts, "Arquétipo", data.archetype);
      if (facts.childElementCount) card.append(facts);

      if (preview) {
        card.append(elemento("p", "Prévia pública da mesa. Atributos, técnicas e progressão permanecem privados.", "room-companion-privacy"));
        return card;
      }

      anexarAtributos(card, data);
      anexarTecnicas(card, data);
      if (campaign && row?.companion_state === "active" && salaAberta && isMaster) {
        const panel = elemento("details", undefined, "room-companion-admin-panel");
        panel.append(elemento("summary", "⚙ Administrar Nativa"));
        panel.append(elemento("p", "As alterações afetam somente a instância desta campanha. A ficha original do jogador permanece intacta.", "muted"));
        const save = async (nextData, label, button) => {
          if (membrosDaSala.get(roomId) !== "master" || salaSelecionada?.status !== "open") return;
          button.disabled = true;
          roomNativasStatus.textContent = "Salvando a alteração da campanha…";
          try {
            const { data: result, error } = await client.rpc("save_room_companion", {
              p_companion_id: row.companion_id,
              p_expected_revision: Number(row.revision),
              p_format_version: Number(row.format_version),
              p_campaign_data: nextData
            });
            if (error) throw error;
            if (result?.status === "conflict") {
              roomNativasStatus.textContent = `Conflito de revisão: a versão remota é ${result.revision}. Atualize o cartão antes de tentar novamente.`;
              return;
            }
            if (result?.status !== "saved") throw new Error("Resposta inesperada ao salvar a campanha.");
            roomNativasStatus.textContent = `${label} · revisão ${result.revision}.`;
            await carregarNativasDaSala(roomId);
          } catch (error) {
            roomNativasStatus.textContent = mensagemErroSala(error);
          } finally {
            button.disabled = false;
          }
        };
        const addSection = (title, description = "") => {
          const section = elemento("section", undefined, "room-admin-section");
          section.append(elemento("h6", title));
          if (description) section.append(elemento("small", description));
          panel.append(section);
          return section;
        };
        const submitForm = (section, fields, buttonLabel, handler) => {
          const form = elemento("form", undefined, "room-admin-form room-companion-admin-form");
          for (const field of fields) {
            const label = elemento("label", field.label);
            label.append(field.control);
            form.append(label);
          }
          const button = elemento("button", buttonLabel, "small");
          button.type = "submit";
          form.append(button);
          form.addEventListener("submit", async event => {
            event.preventDefault();
            try {
              const result = handler();
              await save(result.data, result.message, button);
            } catch (error) {
              roomNativasStatus.textContent = error.message || "Não foi possível preparar a alteração.";
            }
          });
          section.append(form);
          return form;
        };

        const xpSection = addSection("Conceder XP", `Atual: ${Number(data.xp || 0)} XP · ${Number(data.xpa || 0)} XPA disponível. XP é convertido pela progressão oficial; não concede XPA diretamente.`);
        const xpInput = document.createElement("input");
        xpInput.type = "number"; xpInput.min = "1"; xpInput.step = "1"; xpInput.required = true; xpInput.setAttribute("aria-label", "Quantidade de XP");
        submitForm(xpSection, [{ label: "Quantidade de XP", control: xpInput }], "Conceder XP", () => {
          const result = concederXpCampanha(data, Number(xpInput.value));
          return { data: result.data, message: `XP atualizado: ${result.antes.xp} → ${result.depois.xp}; nível ${result.antes.nivel} → ${result.depois.nivel}; ${result.depois.xpa} XPA.` };
        });

        const levelSection = addSection("Definir nível", `Atual: nível ${Number(data.nivel || 1)} · ${Number(data.xp || 0)} XP · ${Number(data.xpa || 0)} XPA.`);
        const levelInput = document.createElement("input");
        levelInput.type = "number"; levelInput.min = String(Number(data.nivel || 1)); levelInput.step = "1"; levelInput.required = true; levelInput.value = String(Number(data.nivel || 1));
        submitForm(levelSection, [{ label: "Nível de destino (somente avanço)", control: levelInput }], "Aplicar nível", () => {
          const result = definirNivelCampanha(data, Number(levelInput.value));
          return { data: result.data, message: `Progressão aplicada usando ${result.quantidadeXpConcedida} XP pela regra existente. Nível ${result.depois.nivel}; ${result.depois.xp} XP restante; ${result.depois.xpa} XPA.` };
        });

        const essenceSection = addSection("Conceder essência", `Essências atuais: ${(data.essencias || []).map(type => ESSENCIAS[type]?.nome || type).join(", ") || "nenhuma"}. Drops guardados: ${(data.essenciasDisponiveis || []).length}. A absorção consome um drop e exige as técnicas previstas na regra.`);
        if ((data.essencias || []).length) {
          const removals = elemento("ul", undefined, "room-admin-removal-list");
          for (const type of data.essencias) {
            const item = elemento("li");
            const name = ESSENCIAS[type]?.nome || type;
            const remove = elemento("button", `Remover ${name}`, "small secondary");
            remove.type = "button"; remove.disabled = true;
            remove.title = "A ficha não registra de forma reversível as técnicas concedidas nem a devolução do drop consumido.";
            item.append(elemento("span", name), remove); removals.append(item);
          }
          essenceSection.append(removals, elemento("small", "Remoção indisponível: o histórico não liga cada Essência às técnicas concedidas nem permite devolver com segurança o drop consumido."));
        }
        const availableEssences = Object.entries(ESSENCIAS).filter(([type, rule]) => rule.ativa && verificarEssencia(data, type).permitido && (data.essenciasDisponiveis || []).length > 0);
        if (!availableEssences.length) essenceSection.append(elemento("p", "Nenhuma essência pode ser concedida agora: verifique estágio, pré-requisitos e drops guardados.", "muted"));
        else {
          const typeSelect = document.createElement("select"); typeSelect.required = true;
          selectOptions(typeSelect, availableEssences, ([, rule]) => rule.nome, ([type]) => type);
          const affinitySelect = document.createElement("select"); affinitySelect.required = true;
          const currentAffinities = new Set([data.affinity || data.afinidade, ...(data.afinidadesEssencia || [])]);
          selectOptions(affinitySelect, AFINIDADES.map(item => item.nome).filter(name => !currentAffinities.has(name)), name => name, name => name);
          const firstTech = document.createElement("select"); firstTech.required = true;
          const secondTech = document.createElement("select"); secondTech.required = true;
          const refreshEssenceChoices = () => {
            const type = typeSelect.value || availableEssences[0][0];
            const affinity = affinitySelect.value;
            const affinityTechniques = TECNICAS.filter(item => item.origem === "afinidade" && item.grupo === affinity && podeAprenderTecnica(item));
            const lineage = data.lineageName || data.lineage;
            const lineageTechniques = TECNICAS.filter(item => ((item.origem === "linhagem" && item.grupo === lineage) || (item.origem === "arquetipo" && item.grupo === data.archetype)) && podeAprenderTecnica(item));
            for (const select of [firstTech, secondTech]) select.replaceChildren(new Option("Selecione uma técnica…", ""));
            for (const item of affinityTechniques) firstTech.append(new Option(`${item.nome} · ${item.categoria} · ${item.efeito || "sem efeito descrito"}`, item.id));
            const lineageSelect = type === "primeira";
            secondTech.hidden = !lineageSelect;
            secondTech.required = lineageSelect;
            if (lineageSelect) for (const item of lineageTechniques) secondTech.append(new Option(`${item.nome} · ${item.categoria} · ${item.efeito || "sem efeito descrito"}`, item.id));
          };
          typeSelect.addEventListener("change", refreshEssenceChoices);
          affinitySelect.addEventListener("change", refreshEssenceChoices);
          submitForm(essenceSection, [
            { label: "Essência", control: typeSelect }, { label: "Nova afinidade", control: affinitySelect },
            { label: "Técnica de afinidade", control: firstTech }, { label: "Técnica de linhagem/arquétipo (Primeira Essência)", control: secondTech }
          ], "Conceder essência", () => {
            const type = typeSelect.value;
            const ids = type === "primeira" ? [firstTech.value, secondTech.value] : [firstTech.value];
            const result = concederEssenciaCampanha(data, type, affinitySelect.value, ids);
            return { data: result.data, message: `${ESSENCIAS[type].nome} absorvida pela regra oficial; técnicas selecionadas adicionadas.` };
          });
          refreshEssenceChoices();
          if (availableEssences.length === 1) typeSelect.value = availableEssences[0][0];
          refreshEssenceChoices();
        }

        const traitSection = addSection("Traços", `Traços atuais: ${(data.tracos || []).map(id => CATALOGO_TRACOS.find(item => item.id === id)?.nome || id).join(", ") || "nenhum"}. Traços não concedem bônus automáticos.`);
        const presentTraits = new Set(data.tracos || []);
        const traitSelect = document.createElement("select"); traitSelect.required = true;
        selectOptions(traitSelect, CATALOGO_TRACOS.filter(item => !presentTraits.has(item.id)), item => `${item.nome} · ${item.categoria}`, item => item.id);
        submitForm(traitSection, [{ label: "Traço do catálogo", control: traitSelect }], "Conceder traço", () => {
          const result = concederTracoCampanha(data, traitSelect.value);
          return { data: result.data, message: `Traço concedido: ${result.trait.nome}.` };
        });
        const defaultTraits = new Set(obterTracosPadraoLinhagem(data.lineageName || data.lineage));
        const removableTraits = (data.tracos || []).filter(id => !defaultTraits.has(id));
        if (removableTraits.length) {
          const list = elemento("ul", undefined, "room-admin-removal-list");
          for (const id of removableTraits) {
            const item = elemento("li");
            const trait = CATALOGO_TRACOS.find(entry => entry.id === id);
            const remove = elemento("button", `Remover ${trait?.nome || id}`, "small secondary"); remove.type = "button";
            remove.addEventListener("click", async () => {
              if (!window.confirm(`Remover o traço “${trait?.nome || id}” desta campanha?`)) return;
              try { const result = removerTracoCampanha(data, id); await save(result.data, `Traço removido: ${result.trait.nome}.`, remove); }
              catch (error) { roomNativasStatus.textContent = error.message; }
            });
            item.append(elemento("span", trait?.nome || id), remove); list.append(item);
          }
          traitSection.append(list);
        }
        if (defaultTraits.size) traitSection.append(elemento("small", "Traços derivados da linhagem não podem ser removidos."));

        const techniqueSection = addSection("Técnicas", `Técnicas atuais: ${(data.techniques || []).map(entry => { const id = typeof entry === "string" ? entry : entry?.id; return obterTecnicaPorId(id)?.nome || id; }).join(", ") || "nenhuma"}. Técnicas de catálogo arquivadas não podem ser concedidas.`);
        const currentTechniques = new Set((data.techniques || []).map(entry => typeof entry === "string" ? entry : entry?.id).filter(Boolean));
        const techniqueSelect = document.createElement("select"); techniqueSelect.required = true;
        selectOptions(techniqueSelect, TECNICAS.filter(item => podeAprenderTecnica(item) && !currentTechniques.has(item.id)), item => `${item.nome} · ${item.origem} · ${item.grupo} · ${item.categoria}`, item => item.id);
        submitForm(techniqueSection, [{ label: "Técnica do catálogo oficial", control: techniqueSelect }], "Conceder técnica", () => {
          const result = concederTecnicaCampanha(data, techniqueSelect.value);
          return { data: result.data, message: `Técnica concedida: ${result.technique.nome}.` };
        });
        if (currentTechniques.size) {
          const list = elemento("ul", undefined, "room-admin-removal-list");
          for (const id of currentTechniques) {
            const technique = obterTecnicaPorId(id);
            if (!technique) continue;
            const item = elemento("li");
            const remove = elemento("button", `Remover ${technique.nome}`, "small secondary"); remove.type = "button";
            remove.disabled = (data.essencias || []).length > 0;
            remove.title = remove.disabled ? "A origem das técnicas concedidas por Essência não está registrada." : "";
            remove.addEventListener("click", async () => {
              if (!window.confirm(`Remover a técnica “${technique.nome}” desta campanha?`)) return;
              try { const result = removerTecnicaCampanha(data, id); await save(result.data, `Técnica removida: ${result.technique.nome}.`, remove); }
              catch (error) { roomNativasStatus.textContent = error.message; }
            });
            item.append(elemento("span", technique.nome), remove); list.append(item);
          }
          techniqueSection.append(list);
        }
        if ((data.essencias || []).length) techniqueSection.append(elemento("small", "Remoção bloqueada: a ficha tem Essência e o histórico atual não identifica quais técnicas ela concedeu."));

        const historySection = addSection("Histórico disponível");
        const history = Array.isArray(data.historicoProgressao) ? data.historicoProgressao : [];
        if (!history.length) historySection.append(elemento("p", "Esta ficha de campanha ainda não possui histórico de progressão.", "muted"));
        else {
          const list = elemento("ul", undefined, "room-admin-history");
          for (const entry of [...history].reverse().slice(0, 20)) list.append(elemento("li", JSON.stringify(entry)));
          historySection.append(list);
        }
        historySection.append(elemento("small", "O histórico atual registra progressão, mas não identifica de forma confiável o mestre responsável. Auditoria segura por ator e valores requer mudança incremental no banco; ela não é simulada aqui."));
        card.append(panel);
      }
      return card;
    }

    for (const row of rows || []) {
      const isOwn = row.player_id === usuarioAtual.id;
      const isFull = row.campaign_data && typeof row.campaign_data === "object";
      const stateLabel = row.companion_state === "awaiting"
        ? "Aguardando escolha"
        : row.companion_state === "history"
          ? "Histórico da campanha"
          : isOwn ? "Seu companheiro" : isMaster ? "Companheiro da mesa" : "Prévia do participante";
      if (row.companion_state === "awaiting") {
        const waiting = elemento("article", undefined, "room-companion-card is-awaiting");
        waiting.append(elemento("span", String(row.player_name || "Jogador") + " · " + stateLabel, "room-companion-eyebrow"));
        waiting.append(elemento("p", "Este participante ainda não escolheu um companheiro para esta sala.", "muted"));
        roomNativasList.append(waiting);
      } else if (isFull) {
        roomNativasList.append(await criarFichaVisual({ data: row.campaign_data, eyebrow: String(row.player_name || "Jogador") + " · " + stateLabel, campaign: true, row }));
      } else {
        const safePreview = row.preview && typeof row.preview === "object" ? row.preview : {};
        roomNativasList.append(await criarFichaVisual({ data: safePreview, eyebrow: String(row.player_name || "Jogador") + " · " + stateLabel, preview: true }));
      }
    }

    if (isMaster && participantesDaSala.length) {
      const participantIds = participantesDaSala.map(member => member.user_id);
      const associatedIds = new Set((rows || []).map(row => row.source_nativa_id).filter(Boolean));
      const { data: originals, error: originalsError } = await client.from("nativas")
        .select("id,local_id,owner_id,data,format_version,revision")
        .in("owner_id", participantIds)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (originalsError) throw originalsError;
      const unassociated = (originals || []).filter(original => !associatedIds.has(original.id));
      if (unassociated.length) {
        roomNativasList.append(elemento("h5", "Fichas originais sem companheiro nesta sala · somente mestre"));
        for (const original of unassociated) {
          const ownerName = participantesDaSala.find(member => member.user_id === original.owner_id)?.display_name || "Jogador";
          roomNativasList.append(await criarFichaVisual({
            data: original.data || {},
            eyebrow: ownerName + " · Ficha original · Somente leitura",
            campaign: false
          }));
        }
      }
    }

    roomNativasStatus.textContent = rows?.length
      ? "A lista veio da RPC protegida da sala. Apenas o mestre e o proprietário recebem o JSON completo."
      : "Ainda não há participantes ou companheiros nesta sala.";
    await carregarJogoDaSala(roomId);
  }
  async function abrirSala(roomId) {
    setStatus("Abrindo sala…");
    const { data: room, error: roomError } = await client
      .from("rooms")
      .select("id,name,status,created_by,created_at")
      .eq("id", roomId)
      .maybeSingle();
    if (roomError) throw roomError;
    if (!room) throw new Error("room member required");

    const { data: members, error: membersError } = await client.rpc("get_room_participants", { p_room_id: roomId });
    if (membersError) throw membersError;
    participantesDaSala = members || [];
    salaSelecionada = room;
    roomName.textContent = room.name;
    roomMeta.textContent = `${room.status === "open" ? "Aberta" : "Fechada"} · Criada em ${new Date(room.created_at).toLocaleString()}`;
    participants.replaceChildren();
    adminParticipants.replaceChildren();
    const isMaster = membrosDaSala.get(roomId) === "master";
    document.querySelector("#online-room-start-hunt").disabled = room.status !== "open";
    document.querySelector("#online-room-request-pvp").disabled = room.status !== "open";
    for (const member of members || []) {
      const role = member.role === "master" ? "Mestre" : "Jogador";
      participants.append(elemento("li", `${member.display_name} · ${role}`));
      const adminRow = elemento("li");
      adminRow.append(elemento("span", `${member.display_name} · ${role}`));
      if (isMaster && member.role === "player") {
        const kick = elemento("button", "Expulsar", "small secondary");
        kick.type = "button";
        kick.dataset.kickRoomPlayer = member.user_id;
        adminRow.append(kick);
      }
      adminParticipants.append(adminRow);
    }
    if (!members?.length) participants.append(elemento("li", "Nenhum participante listado."));

    invitePanel.hidden = !isMaster;
    roomAdmin.hidden = !isMaster;
    renameRoomName.value = room.name;
    renameRoomName.disabled = room.status !== "open";
    renameRoomForm.querySelector("button[type=submit]").disabled = room.status !== "open";
    closeRoomButton.disabled = room.status !== "open";
    closeRoomButton.textContent = room.status === "open" ? "Encerrar sala" : "Sala encerrada";
    deleteRoomButton.disabled = false;
    createInviteForm.querySelector("button[type=submit]").disabled = room.status !== "open";
    createdInvite.hidden = true;
    createdInviteValue.value = "";
    inviteList.replaceChildren();
    details.hidden = false;
    setStatus("");
    await carregarNativasDaSala(roomId);
    if (isMaster) await carregarConvites(roomId);
  }

  function limparParametroConvite() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("convite")) return;
    url.searchParams.delete("convite");
    window.history.replaceState(window.history.state, "", url);
  }

  async function entrarComConvite(valor, veioDaUrl = false) {
    let token = String(valor || "").trim();
    if (/^https?:\/\//i.test(token)) {
      try {
        token = new URL(token).searchParams.get("convite") || "";
      } catch {
        token = "";
      }
    }
    if (!token) {
      setStatus("Informe um código válido ou cole o link completo do convite.");
      if (veioDaUrl) limparParametroConvite();
      return;
    }
    setStatus("Validando convite e entrando na sala…");
    joinForm.querySelector("button[type=submit]").disabled = true;
    try {
      const { data: roomId, error } = await client.rpc("join_room_with_invite", { p_token: token });
      if (error) throw error;
      inviteInput.value = "";
      limparParametroConvite();
      conviteDaUrl = null;
      await carregarSalas();
      await abrirSala(roomId);
      setStatus("Entrada confirmada. Você já participa desta sala.");
    } catch (error) {
      if (veioDaUrl) limparParametroConvite();
      setStatus(mensagemErroSala(error));
    } finally {
      joinForm.querySelector("button[type=submit]").disabled = false;
    }
  }

  async function atualizarSessao(user) {
    usuarioAtual = user || null;
    hint.hidden = Boolean(usuarioAtual);
    content.hidden = !usuarioAtual;
    if (!usuarioAtual) {
      if (roomGamePoll) clearInterval(roomGamePoll);
      roomGamePoll = null;
      liberarFotosDaSala();
      setStatus("");
      roomList.replaceChildren();
      details.hidden = true;
      return;
    }
    if (!roomGamePoll) roomGamePoll = setInterval(() => {
      if (salaSelecionada && !details.hidden && document.visibilityState === "visible") void carregarJogoDaSala(salaSelecionada.id);
    }, 5000);
    try {
      await carregarSalas();
      if (conviteDaUrl && !autoEntradaEmAndamento) {
        autoEntradaEmAndamento = true;
        const token = conviteDaUrl;
        await entrarComConvite(token, true);
      }
    } catch (error) {
      setStatus(mensagemErroSala(error));
    }
  }

  createForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!usuarioAtual) return;
    const button = createForm.querySelector("button[type=submit]");
    const name = String(new FormData(createForm).get("roomName") || "").trim();
    if (!name) return;
    button.disabled = true;
    setStatus("Criando sala…");
    try {
      const { data: roomId, error } = await client.rpc("create_room", { p_name: name });
      if (error) throw error;
      createForm.reset();
      await carregarSalas();
      await abrirSala(roomId);
      setStatus("Sala criada. Você é o mestre desta mesa.");
    } catch (error) {
      setStatus(mensagemErroSala(error));
    } finally {
      button.disabled = false;
    }
  });

  joinForm.addEventListener("submit", event => {
    event.preventDefault();
    if (usuarioAtual) void entrarComConvite(inviteInput.value);
  });

  roomList.addEventListener("click", event => {
    const button = event.target.closest("[data-open-room]");
    if (!button) return;
    void abrirSala(button.dataset.openRoom).catch(error => setStatus(mensagemErroSala(error)));
  });

  refreshButton.addEventListener("click", () => {
    void carregarSalas().catch(error => setStatus(mensagemErroSala(error)));
  });

  closeDetailsButton.addEventListener("click", () => {
    liberarFotosDaSala();
    details.hidden = true;
    salaSelecionada = null;
  });

  chooseCompanionForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!salaSelecionada || salaSelecionada.status !== "open" || !usuarioAtual) return;
    const nativaId = companionChoice.value;
    if (!nativaId) return;
    const button = chooseCompanionForm.querySelector("button[type=submit]");
    button.disabled = true;
    setStatus("Salvando a escolha do companheiro…");
    try {
      const { data, error } = await client.rpc("choose_room_companion", {
        p_room_id: salaSelecionada.id,
        p_nativa_id: nativaId
      });
      if (error) throw error;
      await carregarNativasDaSala(salaSelecionada.id);
      setStatus(data?.status === "already_selected" ? "Esta Nativa já era seu companheiro nesta sala." : "Companheiro escolhido. A progressão desta sala está isolada das outras fichas.");
    } catch (error) {
      setStatus(mensagemErroSala(error));
    } finally {
      button.disabled = false;
    }
  });

  refreshRoomNativas.addEventListener("click", async () => {
    if (!salaSelecionada || !usuarioAtual) return;
    refreshRoomNativas.disabled = true;
    try {
      await carregarNativasDaSala(salaSelecionada.id);
    } catch (error) {
      roomNativasStatus.textContent = mensagemErroSala(error);
    } finally {
      refreshRoomNativas.disabled = false;
    }
  });

  document.querySelector("#online-room-game-refresh").addEventListener("click", () => {
    if (salaSelecionada) void carregarJogoDaSala(salaSelecionada.id);
  });

  document.querySelector("#online-room-start-hunt").addEventListener("click", async event => {
    if (!salaSelecionada || !gameCompanion.value) return;
    const button = event.currentTarget; button.disabled = true;
    try {
      const result = await chamarJogo("start_hunt", { roomId: salaSelecionada.id, companionId: gameCompanion.value });
      mostrarEstadoJogo(result?.status === "approval_required" ? "As três caçadas gratuitas de hoje foram usadas. O mestre recebeu seu pedido de caçada extra." : "Caçada iniciada. A criatura selvagem foi gerada pelo bioma e linhagem da campanha.");
      await carregarNativasDaSala(salaSelecionada.id);
    } catch (error) { mostrarEstadoJogo(mensagemErroSala(error)); }
    finally { button.disabled = false; }
  });

  document.querySelector("#online-room-request-pvp").addEventListener("click", async event => {
    if (!salaSelecionada || !gameCompanion.value || !gameTarget.value) { mostrarEstadoJogo("Escolha seu companheiro e um participante com companheiro ativo."); return; }
    const button = event.currentTarget; button.disabled = true;
    try {
      await chamarJogo("request_pvp", { roomId: salaSelecionada.id, companionId: gameCompanion.value, targetId: gameTarget.value });
      mostrarEstadoJogo("Desafio enviado. O PvP começa quando o outro jogador aceitar.");
      await carregarJogoDaSala(salaSelecionada.id);
    } catch (error) { mostrarEstadoJogo(mensagemErroSala(error)); }
    finally { button.disabled = false; }
  });

  gameRequests.addEventListener("click", async event => {
    const button = event.target.closest("[data-room-game-action]"); if (!button || !salaSelecionada) return;
    button.disabled = true;
    try {
      const result = await chamarJogo(button.dataset.roomGameAction, { roomId: salaSelecionada.id, requestId: button.dataset.requestId });
      mostrarEstadoJogo(button.dataset.roomGameAction === "accept" ? "Pedido aceito. O encontro está pronto para jogar." : "Pedido recusado.");
      if (result?.encounter_id) await carregarNativasDaSala(salaSelecionada.id); else await carregarJogoDaSala(salaSelecionada.id);
    } catch (error) { mostrarEstadoJogo(mensagemErroSala(error)); }
    finally { button.disabled = false; }
  });

  gameEncounters.addEventListener("click", async event => {
    const cancel = event.target.closest("[data-cancel-encounter]");
    if (cancel && salaSelecionada) {
      cancel.disabled = true;
      try { await chamarJogo("cancel", { roomId: salaSelecionada.id, encounterId: cancel.dataset.cancelEncounter }); await carregarNativasDaSala(salaSelecionada.id); }
      catch (error) { mostrarEstadoJogo(mensagemErroSala(error)); cancel.disabled = false; }
      return;
    }
    const button = event.target.closest("[data-open-room-arena]"); if (!button || !salaSelecionada) return;
    const encounterId = button.dataset.openRoomArena;
    try {
      const snapshot = await chamarJogo("context", { roomId: salaSelecionada.id });
      const encounter = (snapshot.encounters || []).find(item => item.id === encounterId);
      if (!encounter?.state) throw new Error("Este encontro não está disponível para sua conta.");
      roomArenaEncounterId = encounterId;
      document.dispatchEvent(new CustomEvent("nativa:room-arena-open", { detail: {
        encounter, roomId: salaSelecionada.id, userId: usuarioAtual.id,
        roomSubmit: async (choice, turn) => {
          await chamarJogo("submit", { roomId: salaSelecionada.id, encounterId, turn, choice });
          await carregarNativasDaSala(salaSelecionada.id);
        },
        roomForfeit: async () => {
          await chamarJogo("forfeit", { roomId: salaSelecionada.id, encounterId });
          await carregarNativasDaSala(salaSelecionada.id);
        }
      } }));
    } catch (error) { mostrarEstadoJogo(mensagemErroSala(error)); }
  });

  renameRoomForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!salaSelecionada || membrosDaSala.get(salaSelecionada.id) !== "master") return;
    const name = String(new FormData(renameRoomForm).get("name") || "").trim();
    const button = renameRoomForm.querySelector("button[type=submit]");
    if (!name) return;
    button.disabled = true;
    try {
      const { error } = await client.rpc("update_room_name", { p_room_id: salaSelecionada.id, p_name: name });
      if (error) throw error;
      const roomId = salaSelecionada.id;
      await carregarSalas();
      await abrirSala(roomId);
      setStatus("Nome da sala atualizado.");
    } catch (error) {
      setStatus(mensagemErroSala(error));
    } finally {
      button.disabled = false;
    }
  });

  adminParticipants.addEventListener("click", async event => {
    const button = event.target.closest("[data-kick-room-player]");
    if (!button || !salaSelecionada || membrosDaSala.get(salaSelecionada.id) !== "master") return;
    const playerId = button.dataset.kickRoomPlayer;
    const playerName = button.parentElement.querySelector("span")?.textContent || "este jogador";
    if (!window.confirm("Expulsar " + playerName + " desta sala? O histórico do companheiro será preservado.")) return;
    button.disabled = true;
    try {
      const { error } = await client.rpc("kick_room_player", { p_room_id: salaSelecionada.id, p_player_id: playerId });
      if (error) throw error;
      await abrirSala(salaSelecionada.id);
      setStatus(playerName + " foi removido da sala.");
    } catch (error) {
      setStatus(mensagemErroSala(error));
      button.disabled = false;
    }
  });

  closeRoomButton.addEventListener("click", async () => {
    if (!salaSelecionada || membrosDaSala.get(salaSelecionada.id) !== "master" || salaSelecionada.status !== "open") return;
    if (!window.confirm("Encerrar esta sala? Os participantes perderão a permissão de jogar nela; o histórico será mantido e as fichas originais não serão excluídas.")) return;
    const confirmation = window.prompt("Digite exatamente o nome da sala para confirmar:", salaSelecionada.name);
    if (confirmation === null) return;
    closeRoomButton.disabled = true;
    try {
      const { error } = await client.rpc("close_room", { p_room_id: salaSelecionada.id, p_confirmation: confirmation });
      if (error) throw error;
      const roomId = salaSelecionada.id;
      await carregarSalas();
      await abrirSala(roomId);
      setStatus("Sala encerrada. O histórico e as fichas originais foram preservados.");
    } catch (error) {
      setStatus(mensagemErroSala(error));
      closeRoomButton.disabled = false;
    }
  });
  deleteRoomButton.addEventListener("click", async () => {
    if (!salaSelecionada || membrosDaSala.get(salaSelecionada.id) !== "master" || salaSelecionada.created_by !== usuarioAtual?.id) return;
    const roomId = salaSelecionada.id;
    const roomNameForConfirm = salaSelecionada.name;
    const confirmed = window.confirm(`Apagar permanentemente a sala “${roomNameForConfirm}”?\n\nParticipantes, convites e todo o histórico desta campanha serão removidos. As fichas originais dos jogadores não serão apagadas. Esta operação não pode ser desfeita.`);
    if (!confirmed) return;
    const confirmation = window.prompt("Para confirmar a exclusão permanente, digite exatamente o nome da sala:", roomNameForConfirm);
    if (confirmation === null) return;
    deleteRoomButton.disabled = true;
    setStatus("Apagando a sala e os dados exclusivos da campanha…");
    try {
      const { error } = await client.rpc("delete_room", { p_room_id: roomId, p_confirmation: confirmation });
      if (error) throw error;
      await carregarSalas();
      liberarFotosDaSala();
      details.hidden = true;
      salaSelecionada = null;
      participantesDaSala = [];
      membrosDaSala.delete(roomId);
      setStatus("Sala apagada permanentemente. As fichas originais foram preservadas.");
    } catch (error) {
      setStatus(mensagemErroSala(error));
      deleteRoomButton.disabled = false;
    }
  });
  createInviteForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!salaSelecionada || membrosDaSala.get(salaSelecionada.id) !== "master") return;
    const button = createInviteForm.querySelector("button[type=submit]");
    const formData = new FormData(createInviteForm);
    const hours = Number(formData.get("hours"));
    const maxUses = Number(formData.get("maxUses"));
    if (!Number.isInteger(hours) || hours < 1 || hours > 720 || !Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100) {
      setStatus("A validade deve ser de 1 a 720 horas e o limite de 1 a 100 usos.");
      return;
    }
    button.disabled = true;
    setStatus("Gerando convite…");
    try {
      const kind = String(formData.get("kind"));
      const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      const { data: token, error } = await client.rpc("create_room_invite", {
        p_room_id: salaSelecionada.id,
        p_kind: kind,
        p_expires_at: expiresAt,
        p_max_uses: maxUses
      });
      if (error) throw error;
      const value = kind === "link" ? (() => {
        const link = new URL(window.location.href);
        link.search = "";
        link.hash = "";
        link.searchParams.set("convite", token);
        return link.toString();
      })() : token;
      createdInviteValue.value = value;
      createdInviteHelp.textContent = "Este segredo é mostrado agora e não será salvo no navegador. Compartilhe com os jogadores convidados.";
      createdInvite.hidden = false;
      await carregarConvites(salaSelecionada.id);
      setStatus("Convite criado.");
    } catch (error) {
      setStatus(mensagemErroSala(error));
    } finally {
      button.disabled = false;
    }
  });

  inviteList.addEventListener("click", async event => {
    const button = event.target.closest("[data-revoke-invite]");
    if (!button || !salaSelecionada || membrosDaSala.get(salaSelecionada.id) !== "master") return;
    button.disabled = true;
    try {
      const { error } = await client.rpc("revoke_room_invite", {
        p_room_id: button.dataset.roomId,
        p_invite_id: button.dataset.revokeInvite
      });
      if (error) throw error;
      await carregarConvites(salaSelecionada.id);
      setStatus("Convite revogado.");
    } catch (error) {
      button.disabled = false;
      setStatus(mensagemErroSala(error));
    }
  });

  copyInviteButton.addEventListener("click", async () => {
    const value = createdInviteValue.value;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setStatus("Convite copiado.");
    } catch {
      createdInviteValue.focus();
      createdInviteValue.select();
      const copied = document.execCommand("copy");
      setStatus(copied ? "Convite copiado." : "Selecione e copie o convite exibido.");
    }
  });

  try {
    const { data: { session }, error } = await client.auth.getSession();
    if (error) throw error;
    await atualizarSessao(session?.user || null);
  } catch (error) {
    setStatus(mensagemErroSala(error));
  }

  client.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => { void atualizarSessao(session?.user || null); }, 0);
  });
}
