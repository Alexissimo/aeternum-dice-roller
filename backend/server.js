import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS || "http://127.0.0.1:5500,http://localhost:5500"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const GRACE_MS = 5 * 60 * 1000; // 5 minuti
const MAX_PER_DIE = 15; // limite dadi per tipo
const HISTORY_LIMIT = 300;

const app = express();
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));

app.get("/health", (_, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS, credentials: true },
});

// ------------------- AETERNUM PRESETS (SERVER-SIDE) -------------------
const ICONS = {
  F: {
    icon: "⚡",
    label: "Fallimento",
    success: 0,
    isFailure: true,
  },
  DF: {
    icon: "⚡⚡",
    label: "Doppio Fallimento",
    success: 0,
    isFailure: true,
  },
  S: {
    icon: "🗡️",
    label: "Successo",
    success: 1,
    isFailure: false,
  },
  DS: {
    icon: "🗡️🗡️",
    label: "Doppio Successo",
    success: 2,
    isFailure: false,
  },
  TS: {
    icon: "🗡️🗡️🗡️",
    label: "Triplo Successo",
    success: 3,
    isFailure: false,
  },
};

// ATTENZIONE: questa tabella deve essere identica a quella che usi nel frontend (assets/presets.js)
const TABLE = {
  4: ["F", "F", "S", "S"],
  6: ["DF", "F", "F", "S", "S", "DS"],
  8: ["DF", "F", "F", "F", "S", "S", "DS", "DS"],
  10: ["DF", "F", "F", "F", "F", "S", "S", "DS", "DS", "DS"],
  12: ["DF", "DF", "F", "F", "F", "F", "S", "S", "DS", "DS", "DS", "DS"],
  14: [
    "DF",
    "DF",
    "F",
    "F",
    "F",
    "F",
    "F",
    "S",
    "S",
    "DS",
    "DS",
    "DS",
    "DS",
    "TS",
  ],
  16: [
    "DF",
    "DF",
    "F",
    "F",
    "F",
    "F",
    "F",
    "F",
    "S",
    "S",
    "DS",
    "DS",
    "DS",
    "DS",
    "TS",
    "TS",
  ],
  18: [
    "DF",
    "DF",
    "DF",
    "F",
    "F",
    "F",
    "F",
    "F",
    "F",
    "S",
    "S",
    "DS",
    "DS",
    "DS",
    "DS",
    "TS",
    "TS",
    "TS",
  ],
  20: [
    "DF",
    "DF",
    "DF",
    "F",
    "F",
    "F",
    "F",
    "F",
    "F",
    "F",
    "S",
    "S",
    "DS",
    "DS",
    "DS",
    "DS",
    "TS",
    "TS",
    "TS",
    "TS",
  ],
};

const VALID_SIDES = new Set(Object.keys(TABLE).map(Number));

function rollOne(sides) {
  const dist = TABLE[sides];
  if (!dist) throw new Error(`Preset mancante per d${sides}`);
  const idx = Math.floor(Math.random() * dist.length);
  const code = dist[idx];
  return ICONS[code];
}

function clampSelection(selection) {
  const out = {};
  if (!selection || typeof selection !== "object") return out;

  for (const [k, v] of Object.entries(selection)) {
    const n = Number(v);
    if (!Number.isFinite(n)) continue;

    const nn = Math.max(0, Math.min(MAX_PER_DIE, Math.floor(n)));
    if (nn <= 0) continue;

    const sidesStr = String(k).replace(/^d/i, "");
    const sidesNum = Number(sidesStr);
    if (!Number.isFinite(sidesNum)) continue;
    if (!VALID_SIDES.has(sidesNum)) continue;

    out[String(sidesNum)] = nn;
  }
  return out;
}

function selectionToLabel(sel) {
  const sides = Object.keys(sel)
    .map(Number)
    .sort((a, b) => a - b);
  if (!sides.length) return "—";
  return sides.map((s) => `d${s}×${sel[String(s)]}`).join(" • ");
}

function rollFromSelection(sel) {
  const perDie = {};        // { "6": ["⚡","🗡️",...], ... }
  const successByDie = {};  // { "6": 4, ... }
  let failures = 0;         // totale fallimenti (⚡ + ⚡⚡)

  const sides = Object.keys(sel).map(Number).sort((a,b)=>a-b);
  for (const s of sides) {
    const count = sel[String(s)];
    const icons = [];
    let succSum = 0;

    for (let i = 0; i < count; i++) {
      const out = rollOne(s);
      icons.push(out.icon);
      succSum += out.success;

      // ⚡ = +1, ⚡⚡ = +2
      if (out.icon === "⚡") {
        failures += 1;
      } else if (out.icon === "⚡⚡") {
        failures += 2;
      }
    }

    perDie[String(s)] = icons;
    successByDie[String(s)] = succSum;
  }

  return {
    results: { perDie },
    summary: {
      successByDie,
      failures
    }
  };
}

// ------------------- In-memory rooms -------------------
const rooms = new Map();

function randCode(len) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function newRoomCodes() {
  let roomCode;
  do {
    roomCode = randCode(6);
  } while (rooms.has(roomCode));
  const masterCode = randCode(8);
  return { roomCode, masterCode };
}

function roomToPlayersList(room) {
  return Array.from(room.players.values()).map((p) => ({
    socketId: p.socketId,
    nickname: p.nickname,
    isGM: p.isGM,
  }));
}

function closeRoom(roomCode, reason = "GM non rientrato") {
  const room = rooms.get(roomCode);
  if (!room) return;

  io.to(roomCode).emit("room_closed", { reason });
  for (const p of room.players.values()) {
    const s = io.sockets.sockets.get(p.socketId);
    if (s) s.leave(roomCode);
  }
  if (room.closeTimer) clearTimeout(room.closeTimer);
  rooms.delete(roomCode);
}

function scheduleClose(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  if (room.closeTimer) clearTimeout(room.closeTimer);

  room.closeTimer = setTimeout(() => {
    closeRoom(roomCode, "GM disconnesso da oltre 5 minuti");
  }, GRACE_MS);

  io.to(roomCode).emit("gm_status", {
    status: "disconnected",
    graceSeconds: Math.floor(GRACE_MS / 1000),
  });
}

function cancelClose(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  if (room.closeTimer) clearTimeout(room.closeTimer);
  room.closeTimer = null;
  room.ownerDisconnectedAt = null;

  io.to(roomCode).emit("gm_status", { status: "online" });
}

function pushHistory(room, entry) {
  room.history.unshift(entry);
  room.history = room.history.slice(0, HISTORY_LIMIT);
}

// ------------------- Socket.IO -------------------
io.on("connection", (socket) => {
  socket.on("room_create", ({ nickname }) => {
    nickname = String(nickname || "").trim();
    if (!nickname) {
      socket.emit("error_message", { message: "Nickname obbligatorio." });
      return;
    }

    const { roomCode, masterCode } = newRoomCodes();
    const room = {
      roomCode,
      masterCode,
      ownerSocketId: socket.id,
      ownerNickname: nickname,
      ownerDisconnectedAt: null,
      closeTimer: null,
      players: new Map(),
      nicknames: new Set(),
      history: [],
      secretRequests: new Map(), // requestId -> {targetSocketId, fromGM, note, createdAt}
    };

    room.players.set(socket.id, { socketId: socket.id, nickname, isGM: true });
    room.nicknames.add(nickname);
    rooms.set(roomCode, room);

    socket.join(roomCode);

    socket.emit("room_created", {
      roomCode,
      masterCode,
      me: { socketId: socket.id, nickname, isGM: true },
      players: roomToPlayersList(room),
      history: historyForViewer(room, socket.id),
    });

    io.to(roomCode).emit("players_update", {
      players: roomToPlayersList(room),
    });
  });

  socket.on("room_join", ({ roomCode, nickname }) => {
    roomCode = String(roomCode || "")
      .trim()
      .toUpperCase();
    nickname = String(nickname || "").trim();

    const room = rooms.get(roomCode);
    if (!room)
      return socket.emit("join_denied", { message: "Room non trovata." });
    if (!nickname)
      return socket.emit("join_denied", { message: "Nickname obbligatorio." });
    if (room.nicknames.has(nickname))
      return socket.emit("join_denied", {
        message: "Nickname già in uso nella room.",
      });

    room.players.set(socket.id, { socketId: socket.id, nickname, isGM: false });
    room.nicknames.add(nickname);
    socket.join(roomCode);

    socket.emit("room_joined", {
      roomCode,
      me: { socketId: socket.id, nickname, isGM: false },
      players: roomToPlayersList(room),
      history: historyForViewer(room, socket.id),
    });

    io.to(roomCode).emit("players_update", {
      players: roomToPlayersList(room),
    });

    if (room.ownerDisconnectedAt) {
      const remaining = Math.max(
        0,
        GRACE_MS - (Date.now() - room.ownerDisconnectedAt)
      );
      socket.emit("gm_status", {
        status: "disconnected",
        graceSeconds: Math.floor(remaining / 1000),
      });
    } else {
      socket.emit("gm_status", { status: "online" });
    }
  });

  socket.on("room_rejoin_master", ({ roomCode, masterCode, nickname }) => {
    roomCode = String(roomCode || "")
      .trim()
      .toUpperCase();
    masterCode = String(masterCode || "")
      .trim()
      .toUpperCase();
    nickname = String(nickname || "").trim();

    const room = rooms.get(roomCode);
    if (!room)
      return socket.emit("join_denied", { message: "Room non trovata." });
    if (room.masterCode !== masterCode)
      return socket.emit("join_denied", { message: "Master code errato." });
    if (!nickname)
      return socket.emit("join_denied", { message: "Nickname obbligatorio." });
    if (room.nicknames.has(nickname))
      return socket.emit("join_denied", {
        message: "Nickname già in uso nella room.",
      });

    room.ownerSocketId = socket.id;
    room.ownerNickname = nickname;

    room.players.set(socket.id, { socketId: socket.id, nickname, isGM: true });
    room.nicknames.add(nickname);

    socket.join(roomCode);
    cancelClose(roomCode);

    socket.emit("room_joined", {
      roomCode,
      me: { socketId: socket.id, nickname, isGM: true },
      players: roomToPlayersList(room),
      history: historyForViewer(room, socket.id),
      masterCode: room.masterCode,
    });

    io.to(roomCode).emit("players_update", {
      players: roomToPlayersList(room),
    });
  });

  // -------- PUBLIC ROLL (server generates results) --------
  socket.on("roll_public", ({ roomCode, selection }) => {
    roomCode = String(roomCode || "")
      .trim()
      .toUpperCase();
    const room = rooms.get(roomCode);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    const sel = clampSelection(selection);
    if (!Object.keys(sel).length) return;

    const { results, summary } = rollFromSelection(sel);

    const entry = {
      type: "public",
      author: player.nickname,
      selection: sel,
      selectionLabel: selectionToLabel(sel),
      results,
      summary,
      ts: Date.now(),
    };

    pushHistory(room, entry);
    io.to(roomCode).emit("roll_feed", entry);
  });

  // -------- GM-only ROLL (server generates results, only GM receives) --------
  socket.on("roll_gm", ({ roomCode, masterCode, selection }) => {
    roomCode = String(roomCode || "")
      .trim()
      .toUpperCase();
    masterCode = String(masterCode || "")
      .trim()
      .toUpperCase();

    const room = rooms.get(roomCode);
    if (!room) return;
    if (room.masterCode !== masterCode) return;

    const player = room.players.get(socket.id);
    if (!player || !player.isGM) return;

    const sel = clampSelection(selection);
    if (!Object.keys(sel).length) return;

    const { results, summary } = rollFromSelection(sel);

    const entry = {
      type: "gm",
      author: player.nickname,
      selection: sel,
      selectionLabel: selectionToLabel(sel),
      results,
      summary,
      ts: Date.now(),
    };

    pushHistory(room, entry);
    socket.emit("gm_roll_feed", entry);
  });

  // -------- SECRET REQUEST (GM asks one player) --------
  socket.on(
    "secret_roll_request",
    ({ roomCode, masterCode, targetSocketId, note }) => {
      roomCode = String(roomCode || "")
        .trim()
        .toUpperCase();
      masterCode = String(masterCode || "")
        .trim()
        .toUpperCase();

      const room = rooms.get(roomCode);
      if (!room) return;
      if (room.masterCode !== masterCode) return;

      const gm = room.players.get(socket.id);
      if (!gm || !gm.isGM) return;

      const target = room.players.get(String(targetSocketId));
      if (!target || target.isGM) {
        socket.emit("error_message", { message: "Target non valido." });
        return;
      }

      const requestId = randCode(10);
      room.secretRequests.set(requestId, {
        requestId,
        fromGM: gm.nickname,
        targetSocketId: target.socketId,
        note: String(note || "").slice(0, 120),
        createdAt: Date.now(),
      });

      io.to(target.socketId).emit("secret_roll_request", {
        requestId,
        roomCode,
        fromGM: gm.nickname,
        note: String(note || ""),
      });
    }
  );

  // -------- SECRET RESULT (player sends selection; server rolls; only GM+player see) --------
  socket.on("secret_roll_result", ({ roomCode, requestId, selection }) => {
    roomCode = String(roomCode || "")
      .trim()
      .toUpperCase();
    requestId = String(requestId || "")
      .trim()
      .toUpperCase();

    const room = rooms.get(roomCode);
    if (!room) return;

    const req = room.secretRequests.get(requestId);
    if (!req) return;

    if (req.targetSocketId !== socket.id) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    const sel = clampSelection(selection);
    if (!Object.keys(sel).length) return;

    const { results, summary } = rollFromSelection(sel);

    const entry = {
      type: "secret",
      requestId,
      author: player.nickname,
      gm: req.fromGM,
      selection: sel,
      selectionLabel: selectionToLabel(sel),
      results,
      summary,
      ts: Date.now(),
    };

    pushHistory(room, entry);

    io.to(req.targetSocketId).emit("secret_roll_feed", entry);
    io.to(room.ownerSocketId).emit("secret_roll_feed", entry);

    room.secretRequests.delete(requestId);
  });

  socket.on("disconnect", () => {
    for (const [roomCode, room] of rooms) {
      const p = room.players.get(socket.id);
      if (!p) continue;

      room.players.delete(socket.id);
      room.nicknames.delete(p.nickname);

      io.to(roomCode).emit("players_update", {
        players: roomToPlayersList(room),
      });

      if (socket.id === room.ownerSocketId) {
        room.ownerDisconnectedAt = Date.now();
        scheduleClose(roomCode);
      }
    }
  });
});

function historyForViewer(room, viewerSocketId) {
  const viewer = room.players.get(viewerSocketId);
  if (!viewer) return [];

  const isGM = !!viewer.isGM;
  const nickname = viewer.nickname;

  return room.history.filter((e) => {
    if (e.type === "public") return true;

    if (e.type === "gm") {
      return isGM; // solo GM vede i gm-only
    }

    if (e.type === "secret") {
      // visibile solo a GM e al player autore
      return isGM || e.author === nickname;
    }

    return false;
  });
}

server.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
  console.log("Allowed origins:", ALLOWED_ORIGINS);
});
