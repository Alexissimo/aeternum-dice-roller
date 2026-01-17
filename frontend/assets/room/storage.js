import { LS_NICK, LS_UI } from "./config.js";

export function loadNick() {
  return localStorage.getItem(LS_NICK) || "";
}

export function saveNick(nick) {
  localStorage.setItem(LS_NICK, String(nick || "").trim());
}

export function loadUiDefaults() {
  return { autoReset: true, feedCollapsed: false };
}

export function loadUi() {
  const defaults = loadUiDefaults();
  try {
    const raw = localStorage.getItem(LS_UI);
    if (!raw) return defaults;
    const obj = JSON.parse(raw);
    return {
      autoReset: obj.autoReset ?? defaults.autoReset,
      feedCollapsed: obj.feedCollapsed ?? defaults.feedCollapsed,
    };
  } catch {
    return defaults;
  }
}

export function saveUi(ui) {
  try {
    localStorage.setItem(LS_UI, JSON.stringify(ui));
  } catch {}
}
