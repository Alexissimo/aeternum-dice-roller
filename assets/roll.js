// assets/roll.js
(function () {
  const LS_HISTORY_KEY = "aeternum_roll_history_v2";

  const $ = (id) => document.getElementById(id);

  const diceGrid = $("diceGrid");
  const rollSelectionBtn = $("rollSelectionBtn");
  const resetSelectionBtn = $("resetSelectionBtn");
  const copyBtn = $("copyBtn");
  const clearHistoryBtn = $("clearHistoryBtn");

  const selectionTag = $("selectionTag");
  const selectedTag = $("selectedTag");
  const resultOut = $("resultOut");
  const historyEl = $("history");

  const diceList = (window.AETERNUM_PRESET_DICE || []).slice();
  let lastResultText = "";

  // counts per dieId (what user selected to roll)
  const selectedCounts = {}; // { "aeternum-d6": 3, ... }

  // --- Helpers ---
  function nowTime() {
    const d = new Date();
    return d.toLocaleString(undefined, {
      day:"2-digit", month:"2-digit",
      hour:"2-digit", minute:"2-digit", second:"2-digit"
    });
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(LS_HISTORY_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function saveHistory(items) {
    localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(items, null, 2));
  }

  function renderHistory(items) {
    historyEl.innerHTML = "";
    if (!items.length) {
      historyEl.innerHTML = `<div class="hitem"><div class="hmeta">Nessun lancio ancora.</div></div>`;
      return;
    }

    for (const it of items) {
      const item = document.createElement("div");
      item.className = "hitem";

      // Title row
      const line = document.createElement("div");
      line.className = "hline";

      const left = document.createElement("div");
      left.className = "hleft";

      const title = document.createElement("div");
      title.className = "htitle";
      title.textContent = it.title;

      const meta = document.createElement("div");
      meta.className = "hmeta";
      meta.textContent = it.time;

      left.appendChild(title);
      left.appendChild(meta);

      const right = document.createElement("div");
      right.className = "hright";
      right.textContent = it.short;

      line.appendChild(left);
      line.appendChild(right);
      item.appendChild(line);

      // Body lines
      if (it.details) {
        const d1 = document.createElement("div");
        d1.className = "hmeta";
        d1.style.marginTop = "8px";
        d1.textContent = it.details;
        item.appendChild(d1);
      }

      if (it.summary) {
        const d2 = document.createElement("div");
        d2.className = "hmeta";
        d2.style.marginTop = "6px";
        d2.textContent = it.summary;
        item.appendChild(d2);
      }

      historyEl.appendChild(item);
    }
  }

  function rollOne(dice) {
    const idx = Math.floor(Math.random() * dice.sides);
    return dice.faces[idx];
  }

  // Success mapping (requested):
  // 🗡️ -> 1 success
  // 🗡️🗡️ -> 2 successes
  // 🗡️🗡️🗡️ -> 3 successes
  // ⚡ / ⚡⚡ -> failures (counted as failures, DF tracked separately)
  function outcomeToNumbers(icon) {
    const s3 = "🗡️🗡️🗡️";
    const s2 = "🗡️🗡️";
    const s1 = "🗡️";
    const df = "⚡⚡";
    const f  = "⚡";

    if (icon === s3) return { success: 3, failure: 0, doubleFailure: 0 };
    if (icon === s2) return { success: 2, failure: 0, doubleFailure: 0 };
    if (icon === s1) return { success: 1, failure: 0, doubleFailure: 0 };
    if (icon === df) return { success: 0, failure: 1, doubleFailure: 1 };
    if (icon === f)  return { success: 0, failure: 1, doubleFailure: 0 };

    // fallback: unknown icon => 0/0
    return { success: 0, failure: 0, doubleFailure: 0 };
  }

  function computeSelectionLabel() {
    const parts = [];
    let totalDice = 0;

    for (const d of diceList) {
      const n = selectedCounts[d.id] || 0;
      if (n > 0) {
        parts.push(`d${d.sides}×${n}`);
        totalDice += n;
      }
    }
    return {
      text: parts.length ? parts.join("  •  ") : "—",
      totalDice
    };
  }

  function refreshSelectionUI() {
    // update badges + selected class
    for (const d of diceList) {
      const n = selectedCounts[d.id] || 0;
      const btn = document.querySelector(`[data-die-id="${d.id}"]`);
      const badge = btn?.querySelector(".badge");
      if (btn) {
        btn.classList.toggle("selected", n > 0);
      }
      if (badge) {
        badge.textContent = String(n);
        badge.style.display = n > 0 ? "flex" : "none";
      }
    }

    const info = computeSelectionLabel();
    selectionTag.textContent = info.text;
    selectedTag.textContent = info.totalDice > 0 ? `Selezione: ${info.text}` : "—";
  }

  function renderResultBlock(perDieLines, summaryLine) {
    // perDieLines is array of strings
    resultOut.innerHTML = "";

    if (!perDieLines.length) {
      resultOut.innerHTML = `<span class="muted">Nessun dado selezionato.</span>`;
      return;
    }

    // main: results
    const main = document.createElement("span");
    main.textContent = perDieLines.join("   ");
    resultOut.appendChild(main);

    // summary
    const small = document.createElement("small");
    small.textContent = summaryLine;
    resultOut.appendChild(small);
  }

  function pushHistory(entry) {
    const items = loadHistory();
    items.unshift(entry);
    const trimmed = items.slice(0, 250);
    saveHistory(trimmed);
    renderHistory(trimmed);
  }

  function resetSelection() {
    for (const k of Object.keys(selectedCounts)) delete selectedCounts[k];
    refreshSelectionUI();
  }

  function doRollSelection() {
    const selection = computeSelectionLabel();
    if (selection.totalDice <= 0) {
      alert("Seleziona almeno un dado cliccando sui pulsanti.");
      return;
    }

    // Track results
    const perDieResults = {}; // sides -> array of icons
    const successByDie = {};  // sides -> success sum
    let totalFailures = 0;
    let totalDoubleFailures = 0;

    // Roll each die type
    for (const d of diceList) {
      const n = selectedCounts[d.id] || 0;
      if (n <= 0) continue;

      const icons = [];
      let succSum = 0;

      for (let i = 0; i < n; i++) {
        const face = rollOne(d);
        const icon = face.icon || String(face.value);
        icons.push(icon);

        const nums = outcomeToNumbers(icon);
        succSum += nums.success;
        totalFailures += nums.failure;
        totalDoubleFailures += nums.doubleFailure;
      }

      perDieResults[d.sides] = icons;
      successByDie[d.sides] = succSum;
    }

    // Build display lines (single results, grouped by die type)
    const perDieLines = Object.keys(perDieResults)
      .map(Number)
      .sort((a,b) => a - b)
      .map(sides => `d${sides}: ${perDieResults[sides].join(" ")}`);

    // Summary: successes per die type + failures
    const successParts = Object.keys(successByDie)
      .map(Number)
      .sort((a,b) => a - b)
      .map(sides => `d${sides} successi=${successByDie[sides]}`);

    const summaryLine =
      `${successParts.join("  •  ")}  •  fallimenti=${totalFailures}  •  ⚡⚡=${totalDoubleFailures}`;

    renderResultBlock(perDieLines, summaryLine);

    // Text for copy
    lastResultText =
      `🎲 ${selection.text} | ` +
      perDieLines.join(" | ") +
      ` || ${summaryLine}`;

    // Short line in history (compact)
    const short = `🎲 ${selection.text}`;
    const details = perDieLines.join(" | ");
    const title = `Lancio: ${selection.text}`;

    pushHistory({
      title,
      time: nowTime(),
      short,
      details,
      summary: summaryLine
    });
  }

  async function copyLast() {
    if (!lastResultText) {
      alert("Nessun risultato da copiare.");
      return;
    }
    try {
      await navigator.clipboard.writeText(lastResultText);
      alert("Copiato ✅");
    } catch {
      prompt("Copia manualmente:", lastResultText);
    }
  }

  function clearHistory() {
    const ok = confirm("Vuoi pulire la cronologia?");
    if (!ok) return;
    saveHistory([]);
    renderHistory([]);
    lastResultText = "";
    resultOut.innerHTML = `<span class="muted">Cronologia pulita.</span>`;
  }

  function buildDiceButtons() {
    diceGrid.innerHTML = "";

    // order by sides
    const ordered = diceList.slice().sort((a,b) => a.sides - b.sides);

    for (const d of ordered) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn dice-btn";
      btn.dataset.dieId = d.id;

      btn.textContent = `d${d.sides}`;

      const badge = document.createElement("div");
      badge.className = "badge";
      badge.style.display = "none";
      badge.textContent = "0";

      btn.appendChild(badge);

      // click => increment count
      btn.addEventListener("click", () => {
        selectedCounts[d.id] = (selectedCounts[d.id] || 0) + 1;
        refreshSelectionUI();
      });

      // right click => decrement
      btn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const cur = selectedCounts[d.id] || 0;
        if (cur > 1) selectedCounts[d.id] = cur - 1;
        else delete selectedCounts[d.id];
        refreshSelectionUI();
      });

      diceGrid.appendChild(btn);
    }

    refreshSelectionUI();
  }

  function init() {
    if (!diceList.length) {
      alert("Nessun preset trovato. Controlla assets/presets.js");
      return;
    }

    buildDiceButtons();

    rollSelectionBtn.addEventListener("click", doRollSelection);
    resetSelectionBtn.addEventListener("click", resetSelection);
    copyBtn.addEventListener("click", copyLast);
    clearHistoryBtn.addEventListener("click", clearHistory);

    // Enter => roll selection
    document.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        doRollSelection();
      }
    });

    // Initial history
    renderHistory(loadHistory());
  }

  init();
})();
