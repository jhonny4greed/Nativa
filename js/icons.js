// Ícones SVG (lucide) no lugar de glifos Unicode, que viram caixas em fontes sem o caractere.
import {
  createElement, Plus, Minus, Sparkles, Mail, Users, Home, PawPrint, BookOpen, Palette, Swords, ScrollText,
  LogIn, LogOut, RefreshCw, Trash2, Save, Shield, Flame, Droplets, Mountain, Wind, Zap, Menu, X, Check, ChevronRight, ChevronDown, Globe
} from "lucide";

export const ICONS = {
  plus: Plus, minus: Minus, sparkles: Sparkles, mail: Mail, users: Users, home: Home, paw: PawPrint, book: BookOpen,
  palette: Palette, swords: Swords, scroll: ScrollText, login: LogIn, logout: LogOut, refresh: RefreshCw, trash: Trash2,
  save: Save, shield: Shield, fogo: Flame, agua: Droplets, terra: Mountain, vento: Wind, energia: Zap, menu: Menu, close: X,
  check: Check, chevron: ChevronRight, "chevron-down": ChevronDown, globe: Globe
};

export function iconElement(name, attrs = {}) {
  const node = ICONS[name];
  if (!node) return null;
  return createElement(node, { "aria-hidden": "true", focusable: "false", width: 20, height: 20, "stroke-width": 1.75, ...attrs });
}

export function mountIcon(el) {
  if (el.dataset.iconMounted) return;
  const svg = iconElement(el.dataset.icon, el.dataset.iconSize ? { width: el.dataset.iconSize, height: el.dataset.iconSize } : {});
  if (!svg) return;
  el.replaceChildren(svg);
  el.dataset.iconMounted = "true";
}

export function mountIcons(root = document) {
  root.querySelectorAll?.("[data-icon]").forEach(mountIcon);
}

export function observeIcons(root = document.body) {
  mountIcons(root);
  const observer = new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) {
      if (node.nodeType !== 1) continue;
      if (node.dataset?.icon) mountIcon(node);
      mountIcons(node);
    }
  });
  observer.observe(root, { childList: true, subtree: true });
  return observer;
}
