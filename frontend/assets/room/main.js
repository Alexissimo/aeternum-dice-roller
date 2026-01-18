import { BACKEND_URL } from "./config.js";
import { getDom } from "./dom.js";
import { toast, copyText } from "./toast.js";
import { loadNick, saveNick, loadUi, saveUi } from "./storage.js";
import {
  buildDiceGrid,
  refreshSelectionUI,
  selectionToPayload,
  clearSelection,
} from "./dice.js";
import { setFeedEmpty, addFeedEntry } from "./feed.js";
import { connectSocket } from "./socket.js";
import {
  installBeforeUnloadGuard,
  installShortcuts,
  buildInviteLink,
} from "./ui.js";

console.log("[room/main.js] loaded");

(function () {
  const d = getDom();
  const autoResetEl = document.getElementById("autoResetToggle");

  const diceList = (window.AETERNUM_PRESET_DICE || []).slice();
  const selectedCounts = {};
  const ui = loadUi();

  if (autoResetEl) {
    autoResetEl.checked = !!ui.autoReset;
    autoResetEl.addEventListener("change", () => {
      ui.autoReset = !!autoResetEl.checked;
      saveUi(ui);
      toast(ui.autoReset ? "Auto-reset ON" : "Auto-reset OFF");
    });
  }

  let socket = null;

  const session = {
    roomCode: null,
    masterCode: null,
    me: null,
    players: [],
    roomLocked: false,
  };

  let pendingSecret = null;

  function setConnUI(state, msg = "") {
    if (!d.connCard) return;
    if (state === "hidden") {
      d.connCard.style.display = "none";
      return;
    }
    d.connCard.style.display = "";

    if (state === "connecting") {
      d.connTitle.textContent = "🟡 Connessione…";
      d.connMsg.textContent =
        msg || "Sto contattando il server (può richiedere qualche secondo).";
      d.connRetryBtn.style.display = "none";
    }
    if (state === "online") {
      d.connTitle.textContent = "🟢 Online";
      d.connMsg.textContent = msg || "Connesso al server.";
      d.connRetryBtn.style.display = "none";
    }
    if (state === "offline") {
      d.connTitle.textContent = "🔴 Offline";
      d.connMsg.textContent = msg || "Server non raggiungibile.";
      d.connRetryBtn.style.display = "";
    }
  }

  function updateLatency(ms) {
    if (!d.connMsg) return;
    const base = d.connMsg.textContent.split("•")[0].trim();
    d.connMsg.textContent = `${base} • latency ~${ms}ms`;
  }

  function selectionLabelText() {
    // quick label (reuse refreshSelectionUI)
    refreshSelectionUI(
      { diceGrid: d.diceGrid, selectionTag: d.selectionTag },
      selectedCounts,
    );
  }

  function showRoomUI() {
    d.lobby.style.display = "none";
    d.room.style.display = "";
    d.feedCard.style.display = "";
    setFeedEmpty(d.feed);

    const base = `Room ${session.roomCode}`;
    d.roomMeta.textContent = session.me?.isGM
      ? `${base} • Sei GM`
      : `${base} • Sei player`;

    d.rollGmBtn.style.display = session.me?.isGM ? "" : "none";
    d.gmTools.style.display = session.me?.isGM ? "" : "none";

    installBeforeUnloadGuard(() => session.roomCode);
  }

  function showCodesBox() {
    if (!d.codesBox) return;
    d.codesBox.style.display = "";

    const isGM = !!session.me?.isGM;
    d.joinCodeOut.value = session.roomCode || "";
    d.masterCodeOut.value = isGM ? session.masterCode || "" : "—";
    d.masterCodeOut.type = "password";
    const wrap = d.masterCodeOut.closest("div");
    if (wrap) wrap.style.display = isGM ? "" : "none";

    d.copyMasterBtn.disabled = !isGM;
    d.toggleMasterBtn.textContent = "Mostra";
  }

  function updatePlayersUI(players) {
    session.players = players || [];

    d.playersList.textContent = session.players
      .map((p) => (p.isGM ? `${p.nickname} (GM)` : p.nickname))
      .join(" • ");

    if (!session.me?.isGM) return;

    // ---- target segreto ----
    const targets = session.players.filter((p) => !p.isGM);

    if (d.targetPlayer) {
      d.targetPlayer.innerHTML = "";

      if (!targets.length) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "— nessun player —";
        d.targetPlayer.appendChild(opt);
      } else {
        for (const t of targets) {
          const opt = document.createElement("option");
          opt.value = t.socketId;
          opt.textContent = t.nickname;
          d.targetPlayer.appendChild(opt);
        }
      }
    }

    // ---- kick player ----
    if (d.kickPlayer) {
      d.kickPlayer.innerHTML = "";

      if (!targets.length) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "— nessun player —";
        d.kickPlayer.appendChild(opt);
        if (d.kickBtn) d.kickBtn.disabled = true;
      } else {
        for (const t of targets) {
          const opt = document.createElement("option");
          opt.value = t.socketId;
          opt.textContent = t.nickname;
          d.kickPlayer.appendChild(opt);
        }
        if (d.kickBtn) d.kickBtn.disabled = false;
      }
    }
  }

  async function ensureConnected() {
    if (socket) return true;
    try {
      socket = await connectSocket({
        socketioScriptEl: d.socketioScript,
        setConnUI,
        onLatency: updateLatency,
      });

      // wire events
      socket.on("error_message", ({ message }) =>
        toast(message || "Errore", 2000),
      );

      socket.on("room_created", (data) => {
        session.roomCode = data.roomCode;
        session.masterCode = data.masterCode;
        session.me = data.me;
        session.roomLocked = !!data.roomLocked;

        if (d.lockStatus)
          d.lockStatus.textContent = session.roomLocked ? "Bloccata" : "Aperta";
        if (d.lockRoomBtn)
          d.lockRoomBtn.textContent = session.roomLocked
            ? "Sblocca ingressi"
            : "Blocca ingressi";

        updatePlayersUI(data.players || []);
        showRoomUI();
        showCodesBox();

        addFeedEntry(
          d.feed,
          { type: "system", title: "Room creata", ts: Date.now() },
          ui,
          `Room creata • Join: ${data.roomCode} • Master: ${data.masterCode}`,
        );
      });

      socket.on("room_joined", (data) => {
        session.roomCode = data.roomCode;
        session.masterCode = data.masterCode || null;
        session.me = data.me;
        session.roomLocked = !!data.roomLocked;

        if (d.lockStatus)
          d.lockStatus.textContent = session.roomLocked ? "Bloccata" : "Aperta";
        if (d.lockRoomBtn)
          d.lockRoomBtn.textContent = session.roomLocked
            ? "Sblocca ingressi"
            : "Blocca ingressi";

        updatePlayersUI(data.players || []);
        showRoomUI();
        showCodesBox();

        const history = (data.history || []).slice().reverse();
        for (const e of history) addFeedEntry(d.feed, e, ui);

        addFeedEntry(
          d.feed,
          { type: "system", title: "Entrato in room", ts: Date.now() },
          ui,
          `Entrato in room come ${session.me.nickname}`,
        );
      });

      socket.on("join_denied", ({ message }) =>
        toast(message || "Join rifiutato", 2500),
      );
      socket.on("players_update", ({ players }) =>
        updatePlayersUI(players || []),
      );
      socket.on("room_state", ({ locked }) => {
        session.roomLocked = !!locked;

        if (d.lockStatus)
          d.lockStatus.textContent = session.roomLocked ? "Bloccata" : "Aperta";
        if (d.lockRoomBtn)
          d.lockRoomBtn.textContent = session.roomLocked
            ? "Sblocca ingressi"
            : "Blocca ingressi";
      });

      socket.on("gm_status", ({ status, graceSeconds }) => {
        const msg =
          status === "disconnected"
            ? `GM disconnesso • grace ${graceSeconds}s`
            : `GM online`;
        addFeedEntry(
          d.feed,
          { type: "system", title: msg, ts: Date.now() },
          ui,
          msg,
        );
      });

      socket.on("room_closed", ({ reason }) => {
        toast(`Room chiusa: ${reason || "—"}`, 2500);
        setTimeout(() => location.reload(), 400);
      });

      socket.on("roll_feed", (entry) => addFeedEntry(d.feed, entry, ui));
      socket.on("gm_roll_feed", (entry) => addFeedEntry(d.feed, entry, ui));
      socket.on("secret_roll_feed", (entry) => addFeedEntry(d.feed, entry, ui));

      socket.on(
        "secret_roll_request",
        ({ requestId, roomCode, fromGM, note }) => {
          pendingSecret = { requestId, roomCode, fromGM, note: note || "" };
          d.sendSecretBtn.style.display = "";
          d.rollPublicBtn.disabled = true;
          alert(
            `Tiro segreto richiesto da ${fromGM}${note ? `\nNota: ${note}` : ""}\n\n` +
              `Seleziona i dadi e premi "Invia tiro segreto 🔒".`,
          );
        },
      );

      return true;
    } catch (e) {
      console.error(e);
      toast(e?.message || "Connessione fallita", 2500);
      return false;
    }
  }

  function requireSelection() {
    const sel = selectionToPayload(selectedCounts);
    if (!Object.keys(sel).length) {
      toast("Seleziona almeno un dado (max 15 per tipo).", 2000);
      return null;
    }
    return sel;
  }

  function maybeAutoReset() {
    const enabled = autoResetEl ? !!autoResetEl.checked : !!ui.autoReset;
    if (enabled) {
      clearSelection(selectedCounts, {
        diceGrid: d.diceGrid,
        selectionTag: d.selectionTag,
      });
    }
  }

  // --- init UI & dice ---
  if (d.nickEl && !d.nickEl.value) d.nickEl.value = loadNick();
  setFeedEmpty(d.feed);

  buildDiceGrid(
    { diceGrid: d.diceGrid, selectionTag: d.selectionTag },
    diceList,
    selectedCounts,
    selectionLabelText,
  );

  // --- query autofill room ---
  {
    const url = new URL(window.location.href);
    const roomParam = (url.searchParams.get("room") || "").trim().toUpperCase();
    if (roomParam && d.joinCodeEl) d.joinCodeEl.value = roomParam;
  }

  // --- shortcuts ---
  installShortcuts({
    isInRoom: () => !!session.roomCode,
    isGM: () => !!session.me?.isGM,
    doRollPublic: () => d.rollPublicBtn.click(),
    doRollGm: () => d.rollGmBtn.click(),
    doReset: () => d.resetSelectionBtn.click(),
  });

  // --- buttons ---
  d.connRetryBtn?.addEventListener("click", async () => {
    toast("Riprovo…");
    socket = null;
    await ensureConnected();
  });

  d.createRoomBtn?.addEventListener("click", async () => {
    const nickname = String(d.nickEl.value || "").trim();
    if (!nickname) return toast("Inserisci un nickname.", 1800);
    saveNick(nickname);

    if (!(await ensureConnected())) return;
    socket.emit("room_create", { nickname });
  });

  d.joinRoomBtn?.addEventListener("click", async () => {
    const nickname = String(d.nickEl.value || "").trim();
    const roomCode = String(d.joinCodeEl.value || "")
      .trim()
      .toUpperCase();
    if (!nickname) return toast("Inserisci un nickname.", 1800);
    if (!roomCode) return toast("Inserisci il join code.", 1800);
    saveNick(nickname);

    if (!(await ensureConnected())) return;
    socket.emit("room_join", { roomCode, nickname });
  });

  d.rejoinMasterBtn?.addEventListener("click", async () => {
    const nickname = String(d.nickEl.value || "").trim();
    const roomCode = String(d.joinCodeEl.value || "")
      .trim()
      .toUpperCase();
    const masterCode = String(d.masterCodeEl.value || "")
      .trim()
      .toUpperCase();
    if (!nickname) return toast("Inserisci un nickname.", 1800);
    if (!roomCode) return toast("Inserisci il join code.", 1800);
    if (!masterCode) return toast("Inserisci il master code.", 1800);
    saveNick(nickname);

    if (!(await ensureConnected())) return;
    socket.emit("room_rejoin_master", { roomCode, masterCode, nickname });
  });

  d.rollPublicBtn?.addEventListener("click", () => {
    if (!socket || !session.roomCode)
      return toast("Non sei in una room.", 1800);
    if (pendingSecret) return toast("Hai un tiro segreto in corso.", 1800);

    const selection = requireSelection();
    if (!selection) return;

    socket.emit("roll_public", { roomCode: session.roomCode, selection });
    maybeAutoReset();
  });

  d.rollGmBtn?.addEventListener("click", () => {
    if (!socket || !session.roomCode)
      return toast("Non sei in una room.", 1800);
    if (!session.me?.isGM) return;

    const selection = requireSelection();
    if (!selection) return;

    socket.emit("roll_gm", {
      roomCode: session.roomCode,
      masterCode: session.masterCode,
      selection,
    });
    maybeAutoReset();
  });

  d.requestSecretBtn?.addEventListener("click", () => {
    if (!socket || !session.roomCode) return;
    if (!session.me?.isGM) return;

    const targetSocketId = d.targetPlayer.value;
    if (!targetSocketId)
      return toast("Nessun player target disponibile.", 2000);

    socket.emit("secret_roll_request", {
      roomCode: session.roomCode,
      masterCode: session.masterCode,
      targetSocketId,
      note: String(d.secretNote.value || "").slice(0, 120),
    });

    toast("Richiesta inviata 🔒");
  });

  d.sendSecretBtn?.addEventListener("click", () => {
    if (!socket || !session.roomCode) return;
    if (!pendingSecret) return;

    const selection = requireSelection();
    if (!selection) return;

    socket.emit("secret_roll_result", {
      roomCode: pendingSecret.roomCode,
      requestId: pendingSecret.requestId,
      selection,
    });

    pendingSecret = null;
    d.sendSecretBtn.style.display = "none";
    d.rollPublicBtn.disabled = false;
    maybeAutoReset();
  });

  d.resetSelectionBtn?.addEventListener("click", () => {
    clearSelection(selectedCounts, {
      diceGrid: d.diceGrid,
      selectionTag: d.selectionTag,
    });
    toast("Selezione azzerata");
  });

  d.copyJoinBtn?.addEventListener("click", () => copyText(d.joinCodeOut.value));
  d.copyMasterBtn?.addEventListener("click", () =>
    copyText(d.masterCodeOut.value),
  );
  d.copyInviteBtn?.addEventListener("click", () =>
    copyText(buildInviteLink(session.roomCode || "")),
  );

  d.toggleMasterBtn?.addEventListener("click", () => {
    const isHidden = d.masterCodeOut.type === "password";
    d.masterCodeOut.type = isHidden ? "text" : "password";
    d.toggleMasterBtn.textContent = isHidden ? "Nascondi" : "Mostra";
  });

d.kickBtn?.addEventListener("click", () => {
  if (!socket || !session.roomCode) return toast("Non sei in una room.", 1800);
  if (!session.me?.isGM) return;

  const targetSocketId = d.kickPlayer?.value;
  if (!targetSocketId) return toast("Nessun player da rimuovere.", 1800);

  socket.emit(
    "room_kick_player",
    { roomCode: session.roomCode, masterCode: session.masterCode, targetSocketId },
    (resp) => {
      if (!resp?.ok) return toast(resp?.message || "Kick fallito", 2200);
      toast("Player rimosso ✅", 1800);
    }
  );
});

d.lockRoomBtn?.addEventListener("click", () => {
  if (!socket || !session.roomCode) return toast("Non sei in una room.", 1800);
  if (!session.me?.isGM) return;

  const next = !session.roomLocked;

  socket.emit(
    "room_lock_set",
    { roomCode: session.roomCode, masterCode: session.masterCode, locked: next },
    (resp) => {
      if (!resp?.ok) return toast(resp?.message || "Lock fallito", 2200);

      session.roomLocked = !!resp.locked;
      if (d.lockStatus) d.lockStatus.textContent = session.roomLocked ? "Bloccata" : "Aperta";
      if (d.lockRoomBtn) d.lockRoomBtn.textContent = session.roomLocked ? "Sblocca ingressi" : "Blocca ingressi";
      toast(session.roomLocked ? "Ingressi bloccati 🔒" : "Ingressi aperti 🔓");
    }
  );
});


  // UI toggle “in-code” (no HTML changes): click feedCard title area to toggle collapsed
  d.feedCard?.addEventListener("dblclick", () => {
    ui.feedCollapsed = !ui.feedCollapsed;
    saveUi(ui);
    toast(ui.feedCollapsed ? "Feed compatto" : "Feed completo");
  });

  // UI toggle auto-reset via Alt+R
  window.addEventListener("keydown", (e) => {
    if (e.altKey && (e.key === "r" || e.key === "R")) {
      ui.autoReset = !ui.autoReset;
      saveUi(ui);
      if (autoResetEl) autoResetEl.checked = ui.autoReset;
      toast(ui.autoReset ? "Auto-reset ON" : "Auto-reset OFF");
    }
  });

  // initial conn UI hidden until needed
  setConnUI("hidden");
})();
