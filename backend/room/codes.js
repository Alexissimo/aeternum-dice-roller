export function randCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function newRoomCodes() {
  return { roomCode: randCode(6), masterCode: randCode(8) };
}

export function normalizeRoomCode(code) {
  return String(code || "").trim().toUpperCase();
}

export function normalizeMasterCode(code) {
  return String(code || "").trim().toUpperCase();
}

export function normalizeNickname(nick) {
  return String(nick || "").trim().slice(0, 30);
}
