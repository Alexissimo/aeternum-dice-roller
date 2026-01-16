// assets/presets.js
// Preset ufficiali Aeternum (d4 → d20 step 2)
// Icone: ⚡ / ⚡⚡ e 🗡️ x1/x2/x3

(function () {
  const ICONS = {
    F: { icon: "⚡", label: "Fallimento" },
    DF: { icon: "⚡⚡", label: "Doppio Fallimento" },
    S: { icon: "🗡️", label: "Successo" },
    DS: { icon: "🗡️🗡️", label: "Doppio Successo" },
    TS: { icon: "🗡️🗡️🗡️", label: "Triplo Successo" },
  };

  // Distribuzioni per faccia (array lungo = numero facce)
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

  function makeDie(sides) {
    const dist = TABLE[sides];
    if (!dist || dist.length !== sides) {
      throw new Error("Preset non valido per d" + sides);
    }
    return {
      id: "aeternum-d" + sides,
      name: "Aeternum — d" + sides,
      sides,
      faces: dist.map((code, i) => ({
        value: i + 1,
        icon: ICONS[code].icon,
        label: ICONS[code].label,
      })),
    };
  }

  const SIZES = [4, 6, 8, 10, 12, 14, 16, 18, 20];

  // Export globale (semplice, senza bundler)
  window.AETERNUM_PRESET_DICE = SIZES.map(makeDie);
})();
