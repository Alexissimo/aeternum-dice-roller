import { getRollDom } from "./dom.js";
import { toast } from "./toast.js";
import { buildDiceGrid, refreshSelectionUI, selectionToPayload, clearSelection } from "./dice.js";
import { rollLocal } from "./localRoller.js";
import { loadHistory, saveHistory, clearHistory, renderHistory, renderBigResult, buildResultText } from "./feed.js";

console.log("[roll/main.js] loaded");

(function () {
  const d = getRollDom();

  const diceList = (window.AETERNUM_PRESET_DICE || []).slice();
  const selectedCounts = {};
  let history = loadHistory();
  let lastResultText = "";

  function onSelectionChange() {
    refreshSelectionUI({ diceGrid: d.diceGrid, selectionTag: d.selectionTag }, selectedCounts);
  }

  // init
  buildDiceGrid(
    { diceGrid: d.diceGrid, selectionTag: d.selectionTag },
    diceList,
    selectedCounts,
    onSelectionChange
  );

  renderHistory(d.history, history);

  function requireSelection() {
    const sel = selectionToPayload(selectedCounts);
    if (!Object.keys(sel).length) {
      toast("Seleziona almeno un dado (max 15 per tipo).", 2000);
      return null;
    }
    return sel;
  }

  function computeLabel(selection) {
    return Object.keys(selection)
      .map(Number)
      .sort((a, b) => a - b)
      .map((s) => `d${s}×${selection[String(s)]}`)
      .join(" • ");
  }

  function doRoll() {
    const selection = requireSelection();
    if (!selection) return;

    const { results, summary } = rollLocal(selection);
    const entry = {
      ts: Date.now(),
      selectionLabel: computeLabel(selection),
      results,
      summary,
    };

    // big result box
    renderBigResult(d.resultOut, d.selectedTag, entry);

    // history (persist)
    history.push(entry);
    history = history.slice(-50);
    saveHistory(history);
    renderHistory(d.history, history);

    // text for copy
    lastResultText = buildResultText(entry);
  }

  d.rollSelectionBtn?.addEventListener("click", doRoll);

  d.resetSelectionBtn?.addEventListener("click", () => {
    clearSelection(selectedCounts, { diceGrid: d.diceGrid, selectionTag: d.selectionTag });
    toast("Selezione azzerata");
  });

  d.copyBtn?.addEventListener("click", async () => {
    if (!lastResultText) return toast("Nessun risultato da copiare.", 1800);
    try {
      await navigator.clipboard.writeText(lastResultText);
      toast("Copiato ✅");
    } catch {
      prompt("Copia manualmente:", lastResultText);
    }
  });

  d.clearHistoryBtn?.addEventListener("click", () => {
    clearHistory();
    history = [];
    renderHistory(d.history, history);
    toast("Cronologia pulita");
  });

  // Shortcut: Enter = roll, Esc = reset
  window.addEventListener("keydown", (e) => {
    const tag = (document.activeElement?.tagName || "").toLowerCase();
    const typing = tag === "input" || tag === "textarea" || tag === "select";
    if (typing) return;

    if (e.key === "Enter") {
      e.preventDefault();
      d.rollSelectionBtn?.click();
    }
    if (e.key === "Escape") {
      d.resetSelectionBtn?.click();
    }
  });
})();
