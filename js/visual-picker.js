import { defaultPortrait } from "./creature-art.js";
import { obterRetratoNativa } from "./native-portraits.js";
import "../css/game-controls.css";
const biomes = {
  "Floresta e Mata": new URL("../assets/generated/biome-floresta-mata.jpg", import.meta.url).href,
  "Rios, Lagos e Pantanal": new URL("../assets/generated/biome-rios-pantanal.jpg", import.meta.url).href,
  "Caatinga e Cerrado": new URL("../assets/generated/biome-caatinga-cerrado.jpg", import.meta.url).href,
  "Costa, Restinga e Manguezal": new URL("../assets/generated/biome-costa-mangue.jpg", import.meta.url).href,
  "Campos Sulinos e Pampa": new URL("../assets/generated/biome-pampa.jpg", import.meta.url).href
};
const times = Object.fromEntries(
  ["Amanhecer", "Dia", "Entardecer", "Noite"].map((name, i) => {
    const sky = ["#c48d88", "#6ab8dd", "#ac664b", "#172341"][i],
      sun = ["#ffe7ad", "#ffdf74", "#ffae61", "#e4e7d5"][i];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80"><rect width="120" height="80" fill="${sky}"/><circle cx="80" cy="${i === 1 ? 24 : 40}" r="15" fill="${sun}"/>${i === 3 ? '<circle cx="86" cy="34" r="14" fill="#172341"/><path d="M20 17h3m-1-1v3m29-6h3m-1-1v3" stroke="#eff5dd"/>' : ""}<path d="M0 53L22 35L52 60L72 49L120 62V80H0" fill="#345649"/><path d="M0 68Q30 53 60 68T120 63V80H0" fill="#16392d"/></svg>`;
    return [name, `data:image/svg+xml,${encodeURIComponent(svg)}`];
  })
);
const controllers = new WeakMap();
export function updateVisualPicker(select, items = [], kind = "nativa") {
  if (!select) return;
  let controller = controllers.get(select);
  if (!controller) {
    controller = createPicker(select);
    controllers.set(select, controller);
  }
  controller.update(items, kind);
}
function createPicker(select) {
  const label =
    [...(select.closest("label")?.childNodes || [])]
      .filter(n => n.nodeType === 3)
      .map(n => n.textContent)
      .join("")
      .trim() || "Escolher opção";
  const root = document.createElement("div");
  root.className = "visual-picker";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "picker-trigger secondary";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  const list = document.createElement("div");
  list.className = "picker-options";
  list.id = `${select.id}-options`;
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", label);
  list.hidden = true;
  trigger.setAttribute("aria-controls", list.id);
  root.append(trigger, list);
  select.after(root);
  select.hidden = true;
  let entries = [],
    kind = "nativa",
    version = 0,
    urls = [];
  function close() {
    list.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  }
  function position() {
    const r = trigger.getBoundingClientRect();
    const height = Math.min(360, innerHeight * 0.55);
    list.style.maxHeight = `${height}px`;
    list.style.width = `${Math.min(Math.max(r.width, 280), innerWidth - 24)}px`;
    list.style.left = `${Math.max(12, Math.min(r.left, innerWidth - list.offsetWidth - 12))}px`;
    list.style.top = `${Math.max(12, r.bottom + height > innerHeight ? r.top - height - 6 : r.bottom + 6)}px`;
  }
  function open() {
    if (select.disabled) return;
    list.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    position();
    (list.querySelector('[aria-selected="true"]') || list.querySelector("button"))?.focus();
  }
  function draw() {
    const focused = list.contains(document.activeElement) ? document.activeElement.dataset.value : null;
    const chosen = entries.find(e => e.value === select.value) || entries[0];
    trigger.replaceChildren();
    if (chosen?.src) {
      const img = document.createElement("img");
      img.src = chosen.src;
      img.alt = "";
      trigger.append(img);
    }
    const text = document.createElement("span");
    text.textContent = chosen?.label || "Escolher";
    const arrow = document.createElement("span");
    arrow.textContent = "⌄";
    arrow.className = "picker-arrow";
    trigger.append(text, arrow);
    trigger.setAttribute("aria-label", `${label}: ${text.textContent}`);
    trigger.disabled = select.disabled;
    list.replaceChildren(
      ...entries
        .filter(e => e.value !== "")
        .map(entry => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "picker-option";
          button.dataset.value = entry.value;
          button.setAttribute("role", "option");
          button.setAttribute("aria-selected", String(select.value === entry.value));
          if (entry.src) {
            const image = document.createElement("img");
            image.src = entry.src;
            image.alt = "";
            button.append(image);
          } else {
            const initial = document.createElement("span");
            initial.className = "picker-placeholder";
            initial.textContent =
              entry.value === "random" || entry.value === "Aleatório" ? "⤨" : entry.label.slice(0, 1);
            button.append(initial);
          }
          const text = document.createElement("span");
          text.textContent = entry.label;
          button.append(text);
          button.disabled = entry.disabled;
          button.onclick = event => {
            event.preventDefault();
            select.value = entry.value;
            select.dispatchEvent(new Event("change", { bubbles: true }));
            close();
            trigger.focus();
          };
          return button;
        })
    );
    if (focused && !list.hidden)
      [...list.querySelectorAll("button")]
        .find(button => button.dataset.value === focused)
        ?.focus({ preventScroll: true });
  }
  trigger.onclick = event => {
    event.preventDefault();
    if (list.hidden) open();
    else close();
  };
  trigger.onkeydown = event => {
    if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      open();
    }
  };
  list.onkeydown = event => {
    const buttons = [...list.querySelectorAll("button:not(:disabled)")],
      index = buttons.indexOf(document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      trigger.focus();
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? buttons.length - 1
            : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    }
  };
  select.addEventListener("change", draw);
  new MutationObserver(() => {
    trigger.disabled = select.disabled;
  }).observe(select, { attributes: true, attributeFilter: ["disabled"] });
  document.addEventListener("click", event => {
    if (!root.contains(event.target)) close();
  });
  window.addEventListener("resize", () => {
    if (!list.hidden) position();
  });
  window.addEventListener(
    "scroll",
    () => {
      if (!list.hidden) position();
    },
    true
  );
  return {
    update(items, type) {
      kind = type;
      const current = ++version;
      close();
      urls.forEach(URL.revokeObjectURL);
      urls = [];
      entries = [...select.options].map(option => {
        const data = items.find(n => String(n.id) === option.value) || null;
        return {
          value: option.value,
          label: option.textContent,
          disabled: option.disabled,
          src:
            kind === "biome"
              ? biomes[option.value]
              : kind === "time"
                ? times[option.value]
                : data
                  ? defaultPortrait(data)
                  : null,
          data
        };
      });
      draw();
      for (const entry of entries) {
        if (kind !== "nativa" || !entry.data || (!entry.data.photoId && !entry.data.photoStoragePath)) continue;
        void obterRetratoNativa(entry.data)
          .then(blob => {
            if (!blob || current !== version) return;
            entry.src = URL.createObjectURL(blob);
            urls.push(entry.src);
            draw();
          })
          .catch(() => {});
      }
    }
  };
}
