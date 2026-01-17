import { HISTORY_LIMIT, GRACE_MS, ROLL_COOLDOWN_MS } from "./config.js";

export const rooms = new Map();

export function roomToPlayersList(room) {
  return Array.from(room.players.values()).map((p) => ({
    socketId: p.socketId,
    nickname: p.nickname,
    isGM: !!p.isGM,
  }));
}

export function pushHistory(room, entry) {
  room.history.unshift(entry);
  room.history = room.history.slice(0, HISTORY_LIMIT);
}

export function historyForViewer(room, viewerSocketId) {
  const viewer = room.players.get(viewerSocketId);
  if (!viewer) return [];
  const isGM = !!viewer.isGM;
  const nickname = viewer.nickname;

  return room.history.filter((e) => {
    if (e.type === "public") return true;
    if (e.type === "gm") return isGM;
    if (e.type === "secret") return isGM || e.author === nickname;
    return false;
  });
}

export function closeRoom(io, roomCode, reason) {
  const room = rooms.get(roomCode);
  if (!room) return;

  io.to(roomCode).emit("room_closed", { reason: reason || "Room chiusa" });

  for (const sid of room.players.keys()) {
    const s = io.sockets.sockets.get(sid);
    if (s) s.leave(roomCode);
  }

  rooms.delete(roomCode);
}

export function scheduleClose(io, roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  if (room.closeTimer) clearTimeout(room.closeTimer);

  room.closeTimer = setTimeout(() => {
    closeRoom(io, roomCode, "GM disconnesso da oltre 5 minuti");
  }, GRACE_MS);

  io.to(roomCode).emit("gm_status", {
    status: "disconnected",
    graceSeconds: Math.floor(GRACE_MS / 1000),
  });
}

export function cancelClose(io, roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  if (room.closeTimer) clearTimeout(room.closeTimer);
  room.closeTimer = null;
  room.ownerDisconnectedAt = null;
  io.to(roomCode).emit("gm_status", { status: "online" });
}

export function canRoll(player) {
  const now = Date.now();
  const last = player.lastRollAt || 0;
  if (now - last < ROLL_COOLDOWN_MS) return false;
  player.lastRollAt = now;
  return true;
}
