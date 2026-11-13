import { nativeSounds } from "./native-sounds.js";

export function createSoundPicker(root, prefix = "native-sound") {
  root.innerHTML = `<div class="sound-picker-grid">
    <label>Descreva a vocalização<input id="${prefix}-query" data-sound-query maxlength="240" placeholder="Ex.: canto curto e grave de uma coruja"></label>
    <button type="button" class="secondary" data-sound-search>Buscar sons</button>
    <label class="sound-picker-wide">Som do catálogo<select data-sound-choice><option value="">Usar sons básicos da Nativa</option></select></label>
    <label class="sound-picker-wide">Ou envie seu áudio<input type="file" data-sound-file accept="audio/mpeg,audio/wav,audio/x-wav,audio/ogg,audio/mp4,audio/webm"></label>
    <button type="button" class="secondary" data-sound-listen>Ouvir trecho curto</button>
    <audio data-sound-preview controls preload="none" hidden></audio>
    <p class="muted sound-picker-wide">Grito de entrada: 1,8 s. Golpe: 1,5 s. Os trechos recebem entrada e saída suaves e ficam salvos no servidor ao confirmar. O catálogo contabiliza o download ao salvar; áudio próprio dispensa o catálogo.</p>
    <p data-sound-status class="sound-picker-wide" role="status"></p></div>`;
  const $ = selector => root.querySelector(selector);
  const choice = $("[data-sound-choice]"),
    player = $("audio"),
    file = $("[data-sound-file]"),
    status = $("[data-sound-status]");
  let selection = null,
    url,
    revision = 0,
    currentEffect;
  function clearPreview() {
    revision++;
    player.pause();
    player.removeAttribute("src");
    player.hidden = true;
    if (url) URL.revokeObjectURL(url);
    url = null;
  }
  function reset(effect) {
    currentEffect = effect;
    clearPreview();
    file.value = "";
    selection = effect?.cryPath ? { existing: effect } : effect?.id ? { id: effect.id, title: effect.title } : null;
    choice.replaceChildren(new Option("Usar sons básicos da Nativa", ""));
    if (selection) {
      const value = effect.cryPath ? "current" : effect.id;
      choice.add(new Option(effect.title || "Vocalização atual", value));
      choice.value = value;
    }
    status.textContent = effect?.cryPath
      ? "Esta Nativa já possui sons salvos no servidor. Escolha outro áudio para substituir."
      : effect?.id
        ? "O efeito antigo ainda não foi salvo como áudio. Confirme para guardar os trechos no servidor."
        : "Sem seleção personalizada: a arena usa os sons básicos.";
  }
  $("[data-sound-search]").addEventListener("click", async event => {
    const term = $("[data-sound-query]").value.trim();
    if (term.length < 3) {
      status.textContent = "Descreva o som em pelo menos 3 caracteres.";
      return;
    }
    const button = event.currentTarget;
    button.disabled = true;
    status.textContent = "Buscando vocalizações…";
    const current = ++revision;
    try {
      const items = await nativeSounds.search(term);
      if (current !== revision) return;
      choice.replaceChildren(new Option("Usar sons básicos da Nativa", ""));
      selection = null;
      file.value = "";
      clearPreview();
      for (const item of items) {
        const id = item.id || item.soundEffectId;
        if (id) choice.add(new Option(item.title || "Efeito sonoro", id));
      }
      status.textContent = items.length
        ? "Escolha um som e ouça o trecho antes de salvar."
        : "Nenhuma sugestão. Tente outra descrição ou envie seu áudio.";
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
  choice.addEventListener("change", () => {
    clearPreview();
    file.value = "";
    selection =
      choice.value === "current"
        ? { existing: currentEffect }
        : choice.value
          ? { id: choice.value, title: choice.selectedOptions[0].textContent }
          : null;
    status.textContent = selection ? "Ouça o trecho ou confirme para salvar." : "A arena usará os sons básicos.";
  });
  file.addEventListener("change", () => {
    clearPreview();
    choice.value = "";
    const picked = file.files[0];
    selection = picked ? { file: picked, title: picked.name } : null;
    status.textContent = picked
      ? "Áudio selecionado. Ouça o trecho antes de salvar."
      : "A arena usará os sons básicos.";
  });
  $("[data-sound-listen]").addEventListener("click", async event => {
    if (!selection) {
      status.textContent = "Escolha um som do catálogo ou envie um áudio.";
      return;
    }
    clearPreview();
    const current = revision,
      button = event.currentTarget;
    button.disabled = true;
    status.textContent = "Preparando trecho de 1,8 segundo…";
    try {
      const blob = selection.existing
        ? await nativeSounds.load({ soundEffect: selection.existing }, "cry")
        : await nativeSounds.preview(selection);
      if (!blob) throw new Error("Não foi possível carregar o som salvo.");
      if (current !== revision) return;
      url = URL.createObjectURL(blob);
      player.src = url;
      player.hidden = false;
      status.textContent = "Prévia curta pronta. Ao salvar, os arquivos serão guardados no servidor.";
      await player.play().catch(() => {
        status.textContent = "Prévia pronta. Toque em reproduzir no controle de áudio.";
      });
    } catch (error) {
      if (current === revision) status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
  reset();
  return {
    getSelection: () => selection,
    reset,
    stop: clearPreview,
    status: message => {
      status.textContent = message;
    }
  };
}
