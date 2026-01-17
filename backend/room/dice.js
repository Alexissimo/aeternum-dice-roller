import { MAX_PER_DIE } from "./config.js";

const ICONS = {
  F: { icon: "⚡", label: "Fallimento", success: 0, isFailure: true },
  DF: { icon: "⚡⚡", label: "Doppio Fallimento", success: 0, isFailure: true }, // vale 2 fallimenti
  S: { icon: "🗡️", label: "Successo", success: 1, isFailure: false },
  DS: { icon: "🗡️🗡️", label: "Doppio Successo", success: 2, isFailure: false },
  TS: { icon: "🗡️🗡️🗡️", label: "Triplo Successo", success: 3, isFailure: false },
};

// Tabella preset
export const TABLE = {
  4: ["F", "F", "S", "S"],
  6: ["DF", "F", "F", "S", "S", "DS"],
  8: ["DF", "F", "F", "F", "S", "S", "DS", "DS"],
  10: ["DF", "F", "F", "F", "F", "S", "S", "DS", "DS", "DS"],
  12: ["DF", "DF", "F", "F", "F", "F", "S", "S", "DS", "DS", "DS", "DS"],
  14: ["DF", "DF", "F", "F", "F", "F", "F", "S", "S", "DS", "DS", "DS", "DS", "TS"],
  16: ["DF", "DF", "F", "F", "F", "F", "F", "F", "S", "S", "DS", "DS", "DS", "DS", "TS", "TS"],
  18: ["DF", "DF", "F", "F", "F", "F", "F", "F", "F", "S", "S", "DS", "DS", "DS", "DS", "TS", "TS", "TS"],
  20: ["DF", "DF", "F", "F", "F", "F", "F", "F", "F", "F", "S", "S", "DS", "DS", "DS", "DS", "TS", "TS", "TS", "TS"],
};

export function selectionToLabel(sel) {
  const keys = Object.keys(sel).map(Number).sort((a, b) => a - b);
  return keys.map((s) => `d${s}×${sel[String(s)]}`).join(" • ");
}

export function clampSelection(selection) {
  const out = {};
  const src = selection && typeof selection === "object" ? selection : {};
  for (const [k, v] of Object.entries(src)) {
    const sides = Number(k);
    const n = Number(v);
    if (!Number.isFinite(sides) || !TABLE[sides]) continue;
    if (!Number.isFinite(n) || n <= 0) continue;
    out[String(sides)] = Math.min(Math.floor(n), MAX_PER_DIE);
  }
  return out;
}

export function rollOne(sides) {
  const faceCodes = TABLE[sides];
  const idx = Math.floor(Math.random() * faceCodes.length);
  const code = faceCodes[idx];
  const meta = ICONS[code] || ICONS.F;

  const failures = code === "DF" ? 2 : meta.isFailure ? 1 : 0;

  return { code, icon: meta.icon, success: meta.success, failures };
}

export function rollFromSelection(sel) {
  const perDie = {};
  const successByDie = {};
  let failures = 0;

  for (const [k, n] of Object.entries(sel)) {
    const sides = Number(k);
    perDie[k] = [];
    successByDie[k] = 0;

    for (let i = 0; i < n; i++) {
      const r = rollOne(sides);
      perDie[k].push(r.icon);
      successByDie[k] += r.success;
      failures += r.failures;
    }
  }

  return { results: { perDie }, summary: { successByDie, failures } };
}
