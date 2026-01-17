const ICONS = {
  F: { icon: "⚡", success: 0, failures: 1 },
  DF: { icon: "⚡⚡", success: 0, failures: 2 },
  S: { icon: "🗡️", success: 1, failures: 0 },
  DS: { icon: "🗡️🗡️", success: 2, failures: 0 },
  TS: { icon: "🗡️🗡️🗡️", success: 3, failures: 0 },
};

// Tabella deve combaciare col server
const TABLE = {
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

function rollOne(sides) {
  const faces = TABLE[sides];
  const code = faces[Math.floor(Math.random() * faces.length)];
  return ICONS[code] || ICONS.F;
}

export function rollLocal(selection) {
  const perDie = {};
  const successByDie = {};
  let failures = 0;

  const sidesList = Object.keys(selection).map(Number).sort((a, b) => a - b);

  for (const s of sidesList) {
    const n = Number(selection[String(s)] || 0);
    if (!TABLE[s] || !n) continue;

    perDie[String(s)] = [];
    successByDie[String(s)] = 0;

    for (let i = 0; i < n; i++) {
      const r = rollOne(s);
      perDie[String(s)].push(r.icon);
      successByDie[String(s)] += r.success;
      failures += r.failures;
    }
  }

  return { results: { perDie }, summary: { successByDie, failures } };
}
