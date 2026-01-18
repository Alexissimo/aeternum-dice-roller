import { BACKEND_URL } from "./config.js"; 
export async function connectSocket({ socketioScriptEl, setConnUI, onLatency } = {}) {
  const backend = String(BACKEND_URL || "").replace(/\/$/, "");

  const scriptEl =
    socketioScriptEl || document.getElementById("socketioScript");

  if (!scriptEl) {
    throw new Error("Tag <script id='socketioScript'> mancante in room.html");
  }

  // 2) carica socket.io.js dal backend (solo se non già presente)
  if (!window.io) {
    setConnUI?.("connecting", `Carico Socket.IO client da ${backend}…`);

    await new Promise((resolve, reject) => {
      scriptEl.src = `${backend}/socket.io/socket.io.js`;
      scriptEl.async = true;

      scriptEl.onload = () => resolve();
      scriptEl.onerror = () =>
        reject(new Error("Impossibile caricare socket.io.js dal backend"));
    });
  }

  if (!window.io) {
    throw new Error("Socket.IO client non disponibile (window.io mancante).");
  }

  // 3) connettiti
  setConnUI?.("connecting", `Connessione a ${backend}…`);

  const socket = window.io(backend, {
    transports: ["websocket"], // websocket first
  });

  socket.on("connect", () => {
    setConnUI?.("online", "Connesso al server.");
  });

  socket.on("connect_error", (err) => {
    setConnUI?.("offline", err?.message || "Connessione fallita.");
  });

  socket.on("disconnect", () => {
    setConnUI?.("offline", "Disconnesso dal server.");
  });

  // 4) ping latenza (se il server ha ping_check/pong_check)
  let pingTimer = null;

  function startPing() {
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = setInterval(() => {
      const t0 = Date.now();
      socket.emit("ping_check", { t0 });
    }, 4000);
  }

  socket.on("pong_check", ({ t0 }) => {
    if (!t0) return;
    const ms = Date.now() - Number(t0);
    onLatency?.(ms);
  });

  socket.on("connect", startPing);

  return socket;
}
