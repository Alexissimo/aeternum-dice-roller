export function resolveBackendUrl() {
  // 1) override manuale (utile per debug)
  const qp = new URLSearchParams(window.location.search);
  const q = (qp.get("backend") || "").trim();
  if (q) return q.replace(/\/$/, "");

  // 2) se stai in locale → backend locale
  const host = window.location.hostname;
  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".local");

  if (isLocal) return "http://localhost:3000";

  // 3) altrimenti → backend deploy
  return "https://aeternum-dice-roller.onrender.com";
}

export const BACKEND_URL = resolveBackendUrl();


export const LS_NICK = "aeternum_room_nick";
export const LS_UI = "aeternum_room_ui";
