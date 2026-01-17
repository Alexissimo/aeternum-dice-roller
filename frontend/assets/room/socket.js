import { BACKEND_URL } from "./config.js";

export function loadSocketIoScript(socketioScriptEl) {
  return new Promise((resolve, reject) => {
    if (window.io) return resolve();
    if (!socketioScriptEl) return reject(new Error("Tag <script id='socketioScript'> mancante in room.html"));

    socketioScriptEl.src = `${BACKEND_URL.replace(/\/$/, "")}/socket.io/socket.io.js`;
    socketioScriptEl.onload = () => resolve();
    socketioScriptEl.onerror = () => reject(new Error("Impossibile caricare socket.io.js dal backend"));
  });
}

export function connectSocket({ socketioScriptEl, setConnUI, onLatency }) {
  return (async () => {
    setConnUI("connecting");
    await loadSocketIoScript(socketioScriptEl);

    const socket = io(BACKEND_URL, { transports: ["websocket"] });

    let softTimer = setTimeout(() => {
      setConnUI("connecting", "Sto ancora tentando… (il server potrebbe stare “svegliandosi”).");
    }, 2500);

    socket.on("connect", () => {
      clearTimeout(softTimer);
      setConnUI("online");
    });

    socket.on("disconnect", (reason) => {
      setConnUI("offline", `Connessione persa (${reason}).`);
    });

    socket.on("connect_error", (err) => {
      clearTimeout(softTimer);
      setConnUI("offline", err?.message ? `Errore: ${err.message}` : "Errore di connessione.");
    });

    // latency ping loop
    setInterval(() => {
      if (!socket.connected) return;
      const t0 = Date.now();
      socket.emit("ping_check", { t0 });
    }, 7000);

    socket.on("pong_check", ({ t0 }) => {
      if (!t0) return;
      onLatency?.(Date.now() - t0);
    });

    return socket;
  })();
}
