console.log("[room.js] loaded");

(function () {
  const $ = (id) => document.getElementById(id);

  // Backend ufficiale (non modificabile dall'utente)
  const BACKEND_URL = "https://aeternum-dice-roller.onrender.com";

  const nickEl = $("nick");
  const joinCodeEl = $("joinCode");
  const masterCodeEl = $("masterCode");

  const createRoomBtn = $("createRoomBtn");
  const joinRoomBtn = $("joinRoomBtn");
  const rejoinMasterBtn = $("rejoinMasterBtn");

  const connCard = $("connCard");
  const connTitle = $("connTitle");
  const connMsg = $("connMsg");
  const connRetryBtn = $("connRetryBtn");

  const lobby = $("lobby");
  const room = $("room");
  const feedCard = $("feedCard");

  const roomMeta = $("roomMeta");
  const playersList = $("playersList");
  const feed = $("feed");

  const diceGrid = $("diceGrid");
  const selectionTag = $("selectionTag");
  const rollPublicBtn = $("rollPublicBtn");
  const sendSecretBtn = $("sendSecretBtn");
  const rollGmBtn = $("rollGmBtn");
  const resetSelectionBtn = $("resetSelectionBtn");

  const codesBox = $("codesBox");
  const joinCodeOut = $("joinCodeOut");
  const masterCodeOut = $("masterCodeOut");
  const inviteLinkOut = $("inviteLinkOut");
  const copyJoinBtn = $("copyJoinBtn");
  const copyMasterBtn = $("copyMasterBtn");
  const copyInviteBtn = $("copyInviteBtn");
  const toggleMasterBtn = $("toggleMasterBtn");

  const gmTools = $("gmTools");
  const targetPlayer = $("targetPlayer");
  const requestSecretBtn = $("requestSecretBtn");
  const secretNote = $("secretNote");

  const diceList = (window.AETERNUM_PRESET_DICE || []).slice();
  const selectedCounts = {}; // { "4": n, "6": n, ... } max 15

  let socket = null;

  let session = {
    roomCode: null,
    masterCode: null,
    me: null,
    players: [],
  };

  let pendingSecret = null; // { requestId, roomCode, fromGM, note }

  // ---------------- utils ----------------
  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function setConnUI(state, msg = "") {
    // state: "hidden" | "connecting" | "online" | "offline"
    if (!connCard) return;

    if (state === "hidden") {
      connCard.style.display = "none";
      return;
    }

    connCard.style.display = "";

    if (state === "connecting") {
      connTitle.textContent = "🟡 Connessione…";
      connMsg.textContent =
        msg || "Sto contattando il server (può richiedere qualche secondo).";
      connRetryBtn.style.display = "none";
    }

    if (state === "online") {
      connTitle.textContent = "🟢 Online";
      connMsg.textContent = msg || "Connesso al server.";
      connRetryBtn.style.display = "none";
    }

    if (state === "offline") {
      connTitle.textContent = "🔴 Offline";
      connMsg.textContent =
        msg || "Server non raggiungibile. Riprova tra poco.";
      connRetryBtn.style.display = "";
    }
  }

  function clearSelection() {
    for (const k of Object.keys(selectedCounts)) delete selectedCounts[k];
    refreshSelectionUI();
  }

  const toastEl = $("toast");
  let toastTimer = null;

  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastEl.style.display = "none"), 1400);
  }

  async function copyText(text) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast("Copiato ✅");
    } catch {
      prompt("Copia manualmente:", text);
    }
  }

  function buildInviteLink(roomCode) {
    const url = new URL(window.location.href);
    url.searchParams.set("room", roomCode);
    return url.toString();
  }

  function showCodesBox() {
    if (!codesBox) return;

    const roomCode = session.roomCode || "";
    const isGM = !!session.me?.isGM;

    codesBox.style.display = "";
    joinCodeOut.value = roomCode;
    inviteLinkOut.textContent = buildInviteLink(roomCode);

    // master code: solo GM
    masterCodeOut.value = isGM ? session.masterCode || "" : "—";
    masterCodeOut.type = "password";
    if (toggleMasterBtn) toggleMasterBtn.textContent = "Mostra";
    copyMasterBtn.disabled = !isGM;

    // se non GM, nascondiamo del tutto la colonna master (più pulito)
    const masterCol = masterCodeOut.closest("div");
    if (masterCol) masterCol.style.display = isGM ? "" : "none";
  }

  function selectionToPayload() {
    const out = {};
    for (const [k, v] of Object.entries(selectedCounts)) {
      if (v > 0) out[k] = v;
    }
    return out;
  }

  function selectionLabel() {
    const keys = Object.keys(selectedCounts)
      .map(Number)
      .sort((a, b) => a - b);

    const parts = [];
    let tot = 0;

    for (const s of keys) {
      const n = selectedCounts[String(s)] || 0;
      if (n > 0) {
        parts.push(`d${s}×${n}`);
        tot += n;
      }
    }

    return { text: parts.length ? parts.join(" • ") : "—", tot };
  }

  function refreshSelectionUI() {
    const info = selectionLabel();
    selectionTag.textContent = info.text;

    for (const btn of diceGrid.querySelectorAll("button[data-sides]")) {
      const sides = btn.dataset.sides;
      const n = selectedCounts[sides] || 0;
      btn.classList.toggle("selected", n > 0);

      const badge = btn.querySelector(".badge");
      if (badge) {
        badge.textContent = String(n);
        badge.style.display = n > 0 ? "flex" : "none";
      }
    }
  }

  function buildDiceButtons() {
    diceGrid.innerHTML = "";
    const ordered = diceList.slice().sort((a, b) => a.sides - b.sides);

    for (const d of ordered) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn dice-btn";
      btn.dataset.sides = String(d.sides);
      btn.textContent = `d${d.sides}`;

      const badge = document.createElement("div");
      badge.className = "badge";
      badge.style.display = "none";
      badge.textContent = "0";
      btn.appendChild(badge);

      btn.addEventListener("click", () => {
        const s = String(d.sides);
        const cur = selectedCounts[s] || 0;
        selectedCounts[s] = clamp(cur + 1, 0, 15);
        refreshSelectionUI();
      });

      // decrement (tasto destro)
      btn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const s = String(d.sides);
        const cur = selectedCounts[s] || 0;
        const next = clamp(cur - 1, 0, 15);
        if (next === 0) delete selectedCounts[s];
        else selectedCounts[s] = next;
        refreshSelectionUI();
      });

      diceGrid.appendChild(btn);
    }

    refreshSelectionUI();
  }

  function setFeedEmpty() {
    feed.innerHTML = `<div class="hitem"><div class="hmeta">Nessun evento ancora.</div></div>`;
  }

  function formatPerDieResults(perDie) {
    const sides = Object.keys(perDie)
      .map(Number)
      .sort((a, b) => a - b);

    return sides
      .map((s) => `d${s}: ${perDie[String(s)].join(" ")}`)
      .join(" | ");
  }

  function formatSummary(summary) {
    const successByDie = summary?.successByDie || {};
    const sides = Object.keys(successByDie)
      .map(Number)
      .sort((a, b) => a - b);

    const parts = sides.map((s) => `d${s} successi=${successByDie[String(s)]}`);

    parts.push(`fallimenti=${summary?.failures ?? 0}`);
    return parts.join(" • ");
  }

  function addFeedEntry(entry, labelOverride = null) {
    const item = document.createElement("div");
    item.className = "hitem";

    const time = new Date(entry.ts).toLocaleTimeString();
    const titleLeft = labelOverride
      ? labelOverride
      : entry.type === "public"
        ? `${entry.author} ha tirato`
        : entry.type === "gm"
          ? `GM-only: ${entry.author}`
          : `SEGRETO: ${entry.author} ↔ GM ${entry.gm}`;

    const shortRight = entry.selectionLabel || "";

    const perDie = entry.results?.perDie || {};
    const hasDice =
      perDie &&
      typeof perDie === "object" &&
      Object.keys(perDie).some(
        (k) => Array.isArray(perDie[k]) && perDie[k].length > 0
      );

    const summaryObj = entry.summary || {};
    const hasSummary =
      summaryObj &&
      (Object.keys(summaryObj.successByDie || {}).length > 0 ||
        (summaryObj.failures ?? 0) > 0);

    // Render dettagli solo se è un tiro vero
    const detailsHtml = hasDice
      ? `<div class="hmeta" style="margin-top:8px">${formatPerDieResults(perDie)}</div>`
      : "";
    const summaryHtml =
      hasDice || hasSummary
        ? `<div class="hmeta" style="margin-top:6px">${formatSummary(summaryObj)}</div>`
        : "";

    item.innerHTML = `
    <div class="hline">
      <div class="hleft">
        <div class="htitle">${titleLeft}</div>
        <div class="hmeta">${time}</div>
      </div>
      <div class="hright">${shortRight}</div>
    </div>
    ${detailsHtml}
    ${summaryHtml}
  `;

    if (
      feed.firstChild &&
      feed.firstChild.querySelector &&
      feed.firstChild.querySelector(".hmeta")?.textContent ===
        "Nessun evento ancora."
    ) {
      feed.innerHTML = "";
    }

    feed.prepend(item);
  }

  function updatePlayersUI(players) {
    session.players = players;
    playersList.textContent = players
      .map((p) => (p.isGM ? `${p.nickname} (GM)` : p.nickname))
      .join(" • ");

if (session.me?.isGM && kickPlayer) {
  const targets = players.filter((p) => !p.isGM);
  kickPlayer.innerHTML = "";
  for (const t of targets) {
    const opt = document.createElement("option");
    opt.value = t.socketId;
    opt.textContent = t.nickname;
    kickPlayer.appendChild(opt);
  }
}

  }

  function showRoomUI() {
    lobby.style.display = "none";
    room.style.display = "";
    feedCard.style.display = "";
    setFeedEmpty();

    const base = `Room ${session.roomCode}`;
    roomMeta.textContent = session.me?.isGM
      ? `${base} • Sei GM`
      : `${base} • Sei player`;

    rollGmBtn.style.display = session.me?.isGM ? "" : "none";
    gmTools.style.display = session.me?.isGM ? "" : "none";
  }

  // ---------------- socket loader + connect ----------------
  function loadSocketIoScript(backendUrl) {
    return new Promise((resolve, reject) => {
      if (window.io) return resolve();

      const script = document.getElementById("socketioScript");
      if (!script)
        return reject(
          new Error("Tag <script id='socketioScript'> mancante in room.html")
        );

      script.src = `${backendUrl.replace(/\/$/, "")}/socket.io/socket.io.js`;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Impossibile caricare socket.io.js dal backend"));
    });
  }

  async function connect() {
    setConnUI("connecting");
    await loadSocketIoScript(BACKEND_URL);
    socket = io(BACKEND_URL, { transports: ["websocket"] });

    // Se Render è in sleep, la prima connessione può metterci un po'
    let connectSoftTimer = setTimeout(() => {
      setConnUI(
        "connecting",
        "Sto ancora tentando… (il server potrebbe stare “svegliandosi”)."
      );
    }, 2500);

    socket.on("connect", () => {
      clearTimeout(connectSoftTimer);
      setConnUI("online");
      console.log("[socket] connected:", socket.id);
    });

    socket.on("disconnect", (reason) => {
      setConnUI("offline", `Connessione persa (${reason}).`);
      console.warn("[socket] disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
      // Non spammare alert: mostriamo UI e basta
      clearTimeout(connectSoftTimer);
      setConnUI(
        "offline",
        err?.message ? `Errore: ${err.message}` : "Errore di connessione."
      );
      console.error("[socket] connect_error:", err);
    });

    socket.on("error_message", ({ message }) => alert(message || "Errore"));

    socket.on("room_created", (data) => {
      session.roomCode = data.roomCode;
      session.masterCode = data.masterCode;
      session.me = data.me;

      updatePlayersUI(data.players || []);
      showRoomUI();
      showCodesBox();

      addFeedEntry(
        {
          type: "public",
          author: "Sistema",
          selectionLabel: "",
          results: { perDie: {} },
          summary: { successByDie: {}, failures: 0 },
          ts: Date.now(),
        },
        `Room creata • Join: ${data.roomCode} • Master: ${data.masterCode}`
      );
    });

    socket.on("room_joined", (data) => {
      session.roomCode = data.roomCode;
      session.masterCode = data.masterCode || null;
      session.me = data.me;

      updatePlayersUI(data.players || []);
      showRoomUI();
      showCodesBox();

      // history (già filtrata dal server)
      const history = (data.history || []).slice().reverse();
      for (const e of history) addFeedEntry(e);

      addFeedEntry(
        {
          type: "public",
          author: "Sistema",
          selectionLabel: "",
          results: { perDie: {} },
          summary: { successByDie: {}, failures: 0, doubleFailures: 0 },
          ts: Date.now(),
        },
        `Entrato in room come ${session.me.nickname}`
      );
    });

    socket.on("join_denied", ({ message }) =>
      alert(message || "Join rifiutato")
    );

    socket.on("players_update", ({ players }) =>
      updatePlayersUI(players || [])
    );

    socket.on("gm_status", ({ status, graceSeconds }) => {
      const msg =
        status === "disconnected"
          ? `GM disconnesso • grace ${graceSeconds}s`
          : `GM online`;

      addFeedEntry(
        {
          type: "public",
          author: "Sistema",
          selectionLabel: "",
          results: { perDie: {} },
          summary: { successByDie: {}, failures: 0, doubleFailures: 0 },
          ts: Date.now(),
        },
        msg
      );
    });

    socket.on("room_closed", ({ reason }) => {
      alert(`Room chiusa: ${reason || "—"}`);
      location.reload();
    });

    socket.on("roll_feed", (entry) => addFeedEntry(entry));
    socket.on("gm_roll_feed", (entry) => addFeedEntry(entry));

    socket.on(
      "secret_roll_request",
      ({ requestId, roomCode, fromGM, note }) => {
        pendingSecret = { requestId, roomCode, fromGM, note: note || "" };
        sendSecretBtn.style.display = "";
        rollPublicBtn.disabled = true;

        alert(
          `Tiro segreto richiesto da ${fromGM}${note ? `\nNota: ${note}` : ""}\n` +
            `Seleziona i dadi e premi "Invia tiro segreto 🔒".`
        );
      }
    );

    socket.on("secret_roll_feed", (entry) => addFeedEntry(entry));
  }

  // ---------------- UI actions ----------------
  createRoomBtn?.addEventListener("click", async () => {
    const nickname = nickEl.value.trim();
    if (!nickname) return alert("Inserisci un nickname.");

    try {
      if (!socket) await connect();
      socket.emit("room_create", { nickname });
    } catch (e) {
      console.error(e);
      alert("Errore durante la creazione room: " + (e?.message || e));
    }
  });

  joinRoomBtn?.addEventListener("click", async () => {
    const nickname = nickEl.value.trim();
    const roomCode = joinCodeEl.value.trim().toUpperCase();

    if (!nickname) return alert("Inserisci un nickname.");
    if (!roomCode) return alert("Inserisci il join code.");

    if (!socket) await connect();
    socket.emit("room_join", { roomCode, nickname });
  });

  rejoinMasterBtn?.addEventListener("click", async () => {
    const nickname = nickEl.value.trim();
    const roomCode = joinCodeEl.value.trim().toUpperCase();
    const masterCode = masterCodeEl.value.trim().toUpperCase();

    if (!nickname) return alert("Inserisci un nickname.");
    if (!roomCode) return alert("Inserisci il join code.");
    if (!masterCode) return alert("Inserisci il master code.");

    if (!socket) await connect();
    socket.emit("room_rejoin_master", { roomCode, masterCode, nickname });
  });

  rollPublicBtn?.addEventListener("click", () => {
    if (!socket || !session.roomCode) return alert("Non sei in una room.");

    const selection = selectionToPayload();
    if (!Object.keys(selection).length) {
      return alert("Seleziona almeno un dado (max 15 per tipo).");
    }

    socket.emit("roll_public", { roomCode: session.roomCode, selection });
    maybeAutoReset()
  });

  rollGmBtn?.addEventListener("click", () => {
    if (!socket || !session.roomCode) return alert("Non sei in una room.");
    if (!session.me?.isGM) return;

    const selection = selectionToPayload();
    if (!Object.keys(selection).length) {
      return alert("Seleziona almeno un dado (max 15 per tipo).");
    }

    socket.emit("roll_gm", {
      roomCode: session.roomCode,
      masterCode: session.masterCode,
      selection,
    });
    maybeAutoReset()
  });

  requestSecretBtn?.addEventListener("click", () => {
    if (!socket || !session.roomCode) return;
    if (!session.me?.isGM) return;

    const targetSocketId = targetPlayer.value;
    if (!targetSocketId) return alert("Nessun player target disponibile.");

    socket.emit("secret_roll_request", {
      roomCode: session.roomCode,
      masterCode: session.masterCode,
      targetSocketId,
      note: secretNote.value || "",
    });
  });

  sendSecretBtn?.addEventListener("click", () => {
    if (!socket || !session.roomCode) return;
    if (!pendingSecret) return;

    const selection = selectionToPayload();
    if (!Object.keys(selection).length) {
      return alert("Seleziona almeno un dado (max 15 per tipo).");
    }

    socket.emit("secret_roll_result", {
      roomCode: pendingSecret.roomCode,
      requestId: pendingSecret.requestId,
      selection,
    });
    maybeAutoReset()

    pendingSecret = null;
    sendSecretBtn.style.display = "none";
    rollPublicBtn.disabled = false;
  });

  resetSelectionBtn?.addEventListener("click", clearSelection);

  copyJoinBtn?.addEventListener("click", () => copyText(joinCodeOut.value));
  copyMasterBtn?.addEventListener("click", () => copyText(masterCodeOut.value));
  copyInviteBtn?.addEventListener("click", () =>
    copyText(buildInviteLink(session.roomCode || ""))
  );

  toggleMasterBtn?.addEventListener("click", () => {
    const isHidden = masterCodeOut.type === "password";
    masterCodeOut.type = isHidden ? "text" : "password";
    toggleMasterBtn.textContent = isHidden ? "Nascondi" : "Mostra";
  });

  const autoResetToggle = $("autoResetToggle");
  const LS_AUTO_RESET = "aeternum_auto_reset";
  if (autoResetToggle) {
    autoResetToggle.checked = localStorage.getItem(LS_AUTO_RESET) === "1";
    autoResetToggle.addEventListener("change", () => {
      localStorage.setItem(LS_AUTO_RESET, autoResetToggle.checked ? "1" : "0");
    });
  }
  function maybeAutoReset() {
    if (autoResetToggle?.checked) clearSelection();
  }

  connRetryBtn?.addEventListener("click", async () => {
    try {
      // se esiste un socket vecchio, chiudiamolo
      if (socket) {
        socket.disconnect();
        socket = null;
      }
      await connect();
    } catch (e) {
      console.error(e);
      setConnUI("offline", e?.message || "Errore durante il retry.");
    }
  });

  document.addEventListener("keydown", (e) => {
  if (!session.roomCode) return;

  if (e.key === "Escape") clearSelection();

  if (e.key === "Enter" && !e.repeat) {
    if (e.shiftKey && session.me?.isGM && rollGmBtn && rollGmBtn.style.display !== "none") {
      rollGmBtn.click();
      e.preventDefault();
      return;
    }
    rollPublicBtn?.click();
    e.preventDefault();
  }
});

let roomLocked = false;

lockRoomBtn?.addEventListener("click", () => {
  if (!socket || !session.roomCode || !session.me?.isGM) return;
  socket.emit("room_lock_set", {
    roomCode: session.roomCode,
    masterCode: session.masterCode,
    locked: !roomLocked,
  });
});


kickBtn?.addEventListener("click", () => {
  if (!socket || !session.roomCode || !session.me?.isGM) return;
  const targetSocketId = kickPlayer?.value;
  if (!targetSocketId) return toast("Nessun player da rimuovere.");
  socket.emit("room_kick_player", {
    roomCode: session.roomCode,
    masterCode: session.masterCode,
    targetSocketId,
  });
});

socket.on("room_lock_status", ({ locked }) => {
  roomLocked = !!locked;
  if (lockStatus) lockStatus.textContent = roomLocked ? "Bloccata" : "Aperta";
  if (lockRoomBtn) lockRoomBtn.textContent = roomLocked ? "Sblocca ingressi" : "Blocca ingressi";
});


window.addEventListener("beforeunload", (e) => {
  if (!session.roomCode) return;
  e.preventDefault();
  e.returnValue = "";
});

window.addEventListener("beforeunload", (e) => {
  if (!session.roomCode) return;
  e.preventDefault();
  e.returnValue = "";
});

const lockRoomBtn = $("lockRoomBtn");
const lockStatus = $("lockStatus");
const kickPlayer = $("kickPlayer");
const kickBtn = $("kickBtn");


  // Autofill join code da ?room=XXXX
  (function autofillRoomFromQuery() {
    const url = new URL(window.location.href);
    const roomParam = (url.searchParams.get("room") || "").trim().toUpperCase();
    if (roomParam) {
      joinCodeEl.value = roomParam;
      nickEl.focus();
    }
  })();

  // init
  buildDiceButtons();
  setFeedEmpty();
  setConnUI("hidden"); // o "connecting" se vuoi connetterti subito
})();
