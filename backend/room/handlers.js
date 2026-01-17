import { newRoomCodes, normalizeRoomCode, normalizeMasterCode, normalizeNickname, randCode } from "./codes.js";
import { clampSelection, selectionToLabel, rollFromSelection } from "./dice.js";
import { rooms, roomToPlayersList, pushHistory, historyForViewer, scheduleClose, cancelClose, canRoll } from "./store.js";

export function registerHandlers(io, socket) {
  socket.on("ping_check", ({ t0 }) => socket.emit("pong_check", { t0 }));

  socket.on("room_create", ({ nickname }) => {
    nickname = normalizeNickname(nickname);
    if (!nickname) return socket.emit("error_message", { message: "Nickname obbligatorio." });

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

    room.players.set(socket.id, { socketId: socket.id, nickname, isGM: true, lastRollAt: 0 });
    room.nicknames.add(nickname);
    rooms.set(roomCode, room);

    socket.join(roomCode);

    socket.emit("room_created", {
      roomCode,
      masterCode,
      me: { socketId: socket.id, nickname, isGM: true },
      players: roomToPlayersList(room),
      history: historyForViewer(room, socket.id),
      roomLocked: room.locked,
    });

    io.to(roomCode).emit("players_update", { players: roomToPlayersList(room) });
    io.to(roomCode).emit("gm_status", { status: "online" });
  });

  socket.on("room_join", ({ roomCode, nickname }) => {
    roomCode = normalizeRoomCode(roomCode);
    nickname = normalizeNickname(nickname);

    const room = rooms.get(roomCode);
    if (!room) return socket.emit("join_denied", { message: "Room non trovata." });
    if (!nickname) return socket.emit("join_denied", { message: "Nickname obbligatorio." });
    if (room.locked) return socket.emit("join_denied", { message: "Room bloccata (ingressi chiusi)." });
    if (room.nicknames.has(nickname)) return socket.emit("join_denied", { message: "Nickname già in uso nella room." });

    room.players.set(socket.id, { socketId: socket.id, nickname, isGM: false, lastRollAt: 0 });
    room.nicknames.add(nickname);
    socket.join(roomCode);

    socket.emit("room_joined", {
      roomCode,
      me: { socketId: socket.id, nickname, isGM: false },
      players: roomToPlayersList(room),
      history: historyForViewer(room, socket.id),
      roomLocked: room.locked,
    });

    io.to(roomCode).emit("players_update", { players: roomToPlayersList(room) });
  });

  socket.on("room_rejoin_master", ({ roomCode, masterCode, nickname }) => {
    roomCode = normalizeRoomCode(roomCode);
    masterCode = normalizeMasterCode(masterCode);
    nickname = normalizeNickname(nickname);

    const room = rooms.get(roomCode);
    if (!room) return socket.emit("join_denied", { message: "Room non trovata." });
    if (room.masterCode !== masterCode) return socket.emit("join_denied", { message: "Master code errato." });
    if (!nickname) return socket.emit("join_denied", { message: "Nickname obbligatorio." });

    if (room.nicknames.has(nickname) && nickname !== room.ownerNickname) {
      return socket.emit("join_denied", { message: "Nickname già in uso nella room." });
    }

    room.ownerSocketId = socket.id;
    room.ownerNickname = nickname;

    room.players.set(socket.id, { socketId: socket.id, nickname, isGM: true, lastRollAt: 0 });
    room.nicknames.add(nickname);
    socket.join(roomCode);

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
  });

  socket.on("room_lock_set", ({ roomCode, masterCode, locked }) => {
    roomCode = normalizeRoomCode(roomCode);
    masterCode = normalizeMasterCode(masterCode);

    const room = rooms.get(roomCode);
    if (!room) return;
    if (room.masterCode !== masterCode) return;

    const gm = room.players.get(socket.id);
    if (!gm || !gm.isGM) return;

    room.locked = !!locked;
    io.to(roomCode).emit("room_state", { locked: room.locked });
  });

  socket.on("room_kick_player", ({ roomCode, masterCode, targetSocketId }) => {
    roomCode = normalizeRoomCode(roomCode);
    masterCode = normalizeMasterCode(masterCode);

    const room = rooms.get(roomCode);
    if (!room) return;
    if (room.masterCode !== masterCode) return;

    const gm = room.players.get(socket.id);
    if (!gm || !gm.isGM) return;

    const target = room.players.get(String(targetSocketId));
    if (!target || target.isGM) return;

    room.players.delete(target.socketId);
    room.nicknames.delete(target.nickname);

    io.to(target.socketId).emit("room_closed", { reason: "Sei stato espulso dal GM." });
    const s = io.sockets.sockets.get(target.socketId);
    if (s) s.leave(roomCode);

    io.to(roomCode).emit("players_update", { players: roomToPlayersList(room) });
  });

  socket.on("roll_public", ({ roomCode, selection }) => {
    roomCode = normalizeRoomCode(roomCode);
    const room = rooms.get(roomCode);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    if (!canRoll(player)) return socket.emit("error_message", { message: "Troppi tiri ravvicinati: rallenta un attimo." });

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

  socket.on("roll_gm", ({ roomCode, masterCode, selection }) => {
    roomCode = normalizeRoomCode(roomCode);
    masterCode = normalizeMasterCode(masterCode);

    const room = rooms.get(roomCode);
    if (!room) return;
    if (room.masterCode !== masterCode) return;

    const player = room.players.get(socket.id);
    if (!player || !player.isGM) return;

    if (!canRoll(player)) return socket.emit("error_message", { message: "Troppi tiri ravvicinati: rallenta un attimo." });

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

  socket.on("secret_roll_request", ({ roomCode, masterCode, targetSocketId, note }) => {
    roomCode = normalizeRoomCode(roomCode);
    masterCode = normalizeMasterCode(masterCode);

    const room = rooms.get(roomCode);
    if (!room) return;
    if (room.masterCode !== masterCode) return;

    const gm = room.players.get(socket.id);
    if (!gm || !gm.isGM) return;

    const target = room.players.get(String(targetSocketId));
    if (!target || target.isGM) {
      return socket.emit("error_message", { message: "Target non valido." });
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
  });

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

    if (!canRoll(player)) return socket.emit("error_message", { message: "Troppi tiri ravvicinati: rallenta un attimo." });

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

      io.to(roomCode).emit("players_update", { players: roomToPlayersList(room) });

      if (socket.id === room.ownerSocketId) {
        room.ownerDisconnectedAt = Date.now();
        scheduleClose(io, roomCode);
      }
    }
  });
}
