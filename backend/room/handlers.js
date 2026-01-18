import {
  newRoomCodes,
  normalizeRoomCode,
  normalizeMasterCode,
  normalizeNickname,
  randCode,
} from "./codes.js";

import { clampSelection, selectionToLabel, rollFromSelection } from "./dice.js";

import {
  rooms,
  socketToRoom,
  roomToPlayersList,
  pushHistory,
  historyForViewer,
  scheduleClose,
  cancelClose,
  canRoll,
} from "./store.js";

function emitError(socket, message) {
  socket.emit("error_message", { message: message || "Errore" });
}

function getRoomOrError(socket, roomCode) {
  const room = rooms.get(roomCode);
  if (!room) {
    emitError(socket, "Room non trovata.");
    return null;
  }
  return room;
}

function requireGmOrError(socket, room, masterCode) {
  if (room.masterCode !== masterCode) {
    emitError(socket, "Master code errato.");
    return null;
  }
  const me = room.players.get(socket.id);
  if (!me || !me.isGM) {
    emitError(socket, "Permessi insufficienti (solo GM).");
    return null;
  }
  return me;
}

function joinRoomSocket(socket, roomCode) {
  // una room per socket: se già in un’altra, esci
  const prev = socketToRoom.get(socket.id);
  if (prev && prev !== roomCode) socket.leave(prev);

  socket.join(roomCode);
  socketToRoom.set(socket.id, roomCode);
}

function removePlayerFromRoom(io, roomCode, room, socketId) {
  const p = room.players.get(socketId);
  if (!p) return false;

  room.players.delete(socketId);
  room.nicknames.delete(p.nickname);
  socketToRoom.delete(socketId);

  const s = io.sockets.sockets.get(socketId);
  if (s) s.leave(roomCode);

  return true;
}

export function registerHandlers(io, socket) {
  socket.on("ping_check", ({ t0 }) => socket.emit("pong_check", { t0 }));

  // --- CREATE ---
  socket.on("room_create", ({ nickname }) => {
    nickname = normalizeNickname(nickname);
    if (!nickname) return emitError(socket, "Nickname obbligatorio.");

    const { roomCode, masterCode } = newRoomCodes();

    const room = {
      roomCode,
      masterCode,
      locked: false,

      ownerSocketId: socket.id,
      ownerNickname: nickname,
      ownerDisconnectedAt: null,
      closeTimer: null,

      players: new Map(),
      nicknames: new Set(),

      history: [],
      secretRequests: new Map(),
    };

    room.players.set(socket.id, {
      socketId: socket.id,
      nickname,
      isGM: true,
      lastRollAt: 0,
    });
    room.nicknames.add(nickname);
    rooms.set(roomCode, room);

    joinRoomSocket(socket, roomCode);

    socket.emit("room_created", {
      roomCode,
      masterCode,
      me: { socketId: socket.id, nickname, isGM: true },
      players: roomToPlayersList(room),
      history: historyForViewer(room, socket.id),
      roomLocked: room.locked,
    });

    io.to(roomCode).emit("players_update", { players: roomToPlayersList(room) });
    io.to(roomCode).emit("room_state", { locked: room.locked });
    io.to(roomCode).emit("gm_status", { status: "online" });
  });

  // --- JOIN (PLAYER) ---
  socket.on("room_join", ({ roomCode, nickname }) => {
    roomCode = normalizeRoomCode(roomCode);
    nickname = normalizeNickname(nickname);

    const room = getRoomOrError(socket, roomCode);
    if (!room) return;

    if (!nickname) return socket.emit("join_denied", { message: "Nickname obbligatorio." });
    if (room.locked) return socket.emit("join_denied", { message: "Room bloccata (ingressi chiusi)." });
    if (room.nicknames.has(nickname)) return socket.emit("join_denied", { message: "Nickname già in uso nella room." });

    room.players.set(socket.id, {
      socketId: socket.id,
      nickname,
      isGM: false,
      lastRollAt: 0,
    });
    room.nicknames.add(nickname);

    joinRoomSocket(socket, roomCode);

    socket.emit("room_joined", {
      roomCode,
      me: { socketId: socket.id, nickname, isGM: false },
      players: roomToPlayersList(room),
      history: historyForViewer(room, socket.id),
      roomLocked: room.locked,
    });

    io.to(roomCode).emit("players_update", { players: roomToPlayersList(room) });
    io.to(roomCode).emit("room_state", { locked: room.locked });
  });

  // --- REJOIN GM ---
  socket.on("room_rejoin_master", ({ roomCode, masterCode, nickname }) => {
    roomCode = normalizeRoomCode(roomCode);
    masterCode = normalizeMasterCode(masterCode);
    nickname = normalizeNickname(nickname);

    const room = getRoomOrError(socket, roomCode);
    if (!room) return;

    if (room.masterCode !== masterCode) return socket.emit("join_denied", { message: "Master code errato." });
    if (!nickname) return socket.emit("join_denied", { message: "Nickname obbligatorio." });

    if (room.nicknames.has(nickname) && nickname !== room.ownerNickname) {
      return socket.emit("join_denied", { message: "Nickname già in uso nella room." });
    }

    room.ownerSocketId = socket.id;
    room.ownerNickname = nickname;

    room.players.set(socket.id, {
      socketId: socket.id,
      nickname,
      isGM: true,
      lastRollAt: 0,
    });
    room.nicknames.add(nickname);

    joinRoomSocket(socket, roomCode);

    cancelClose(io, roomCode);

    socket.emit("room_joined", {
      roomCode,
      me: { socketId: socket.id, nickname, isGM: true },
      players: roomToPlayersList(room),
      history: historyForViewer(room, socket.id),
      masterCode: room.masterCode,
      roomLocked: room.locked,
    });

    io.to(roomCode).emit("players_update", { players: roomToPlayersList(room) });
    io.to(roomCode).emit("room_state", { locked: room.locked });
    io.to(roomCode).emit("gm_status", { status: "online" });
  });

  // --- LOCK / UNLOCK ROOM ---
  socket.on("room_lock_set", ({ roomCode, masterCode, locked }) => {
    roomCode = normalizeRoomCode(roomCode);
    masterCode = normalizeMasterCode(masterCode);

    const room = getRoomOrError(socket, roomCode);
    if (!room) return;

    const gm = requireGmOrError(socket, room, masterCode);
    if (!gm) return;

    room.locked = !!locked;

    io.to(roomCode).emit("room_state", { locked: room.locked });
  });

  // --- KICK PLAYER ---
  socket.on("room_kick_player", ({ roomCode, masterCode, targetSocketId }) => {
    roomCode = normalizeRoomCode(roomCode);
    masterCode = normalizeMasterCode(masterCode);
    targetSocketId = String(targetSocketId || "");

    const room = getRoomOrError(socket, roomCode);
    if (!room) return;

    const gm = requireGmOrError(socket, room, masterCode);
    if (!gm) return;

    const target = room.players.get(targetSocketId);
    if (!target) return emitError(socket, "Target non valido (player non trovato).");
    if (target.isGM) return emitError(socket, "Non puoi espellere il GM.");

    // rimuovi dal modello
    const removed = removePlayerFromRoom(io, roomCode, room, targetSocketId);
    if (!removed) return emitError(socket, "Impossibile rimuovere il player.");

    // notifica e forziamo uscita reale (evita casi “resta in UI”)
    io.to(targetSocketId).emit("room_closed", { reason: "Sei stato espulso dal GM." });

    const s = io.sockets.sockets.get(targetSocketId);
    if (s) {
      // chiude la connessione: il client non resta appeso e non continua a vedere la room
      s.disconnect(true);
    }

    io.to(roomCode).emit("players_update", { players: roomToPlayersList(room) });
  });

  // --- ROLL PUBLIC ---
  socket.on("roll_public", ({ roomCode, selection }) => {
    roomCode = normalizeRoomCode(roomCode);
    const room = rooms.get(roomCode);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    if (!canRoll(player)) return emitError(socket, "Troppi tiri ravvicinati: rallenta un attimo.");

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

  // --- ROLL GM-ONLY ---
  socket.on("roll_gm", ({ roomCode, masterCode, selection }) => {
    roomCode = normalizeRoomCode(roomCode);
    masterCode = normalizeMasterCode(masterCode);

    const room = rooms.get(roomCode);
    if (!room) return;
    if (room.masterCode !== masterCode) return;

    const player = room.players.get(socket.id);
    if (!player || !player.isGM) return;

    if (!canRoll(player)) return emitError(socket, "Troppi tiri ravvicinati: rallenta un attimo.");

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

  // --- SECRET REQUEST ---
  socket.on("secret_roll_request", ({ roomCode, masterCode, targetSocketId, note }) => {
    roomCode = normalizeRoomCode(roomCode);
    masterCode = normalizeMasterCode(masterCode);
    targetSocketId = String(targetSocketId || "");

    const room = rooms.get(roomCode);
    if (!room) return;
    if (room.masterCode !== masterCode) return;

    const gm = room.players.get(socket.id);
    if (!gm || !gm.isGM) return;

    const target = room.players.get(targetSocketId);
    if (!target || target.isGM) return emitError(socket, "Target non valido.");

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
  });

  // --- SECRET RESULT ---
  socket.on("secret_roll_result", ({ roomCode, requestId, selection }) => {
    roomCode = normalizeRoomCode(roomCode);
    requestId = normalizeMasterCode(requestId);

    const room = rooms.get(roomCode);
    if (!room) return;

    const req = room.secretRequests.get(requestId);
    if (!req) return;
    if (req.targetSocketId !== socket.id) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    if (!canRoll(player)) return emitError(socket, "Troppi tiri ravvicinati: rallenta un attimo.");

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

  // --- DISCONNECT ---
  socket.on("disconnect", () => {
    const roomCode = socketToRoom.get(socket.id);

    // se non sappiamo la room, fallback al vecchio scan
    if (!roomCode) {
      for (const [rc, room] of rooms) {
        const p = room.players.get(socket.id);
        if (!p) continue;

        room.players.delete(socket.id);
        room.nicknames.delete(p.nickname);
        socketToRoom.delete(socket.id);

        io.to(rc).emit("players_update", { players: roomToPlayersList(room) });

        if (socket.id === room.ownerSocketId) {
          room.ownerDisconnectedAt = Date.now();
          scheduleClose(io, rc);
        }
      }
      return;
    }

    const room = rooms.get(roomCode);
    socketToRoom.delete(socket.id);
    if (!room) return;

    const p = room.players.get(socket.id);
    if (!p) return;

    room.players.delete(socket.id);
    room.nicknames.delete(p.nickname);

    io.to(roomCode).emit("players_update", { players: roomToPlayersList(room) });

    if (socket.id === room.ownerSocketId) {
      room.ownerDisconnectedAt = Date.now();
      scheduleClose(io, roomCode);
    }
  });
}
