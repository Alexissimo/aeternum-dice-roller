import { getRollDom } from "./dom.js";
import { toast } from "./toast.js";
import { loadUi, saveUi } from "./storage.js";
import { buildDiceGrid, refreshSelectionUI, selectionToPayload, clearSelection } from "./dice.js";
import { setFeedEmpty, addLocalEntry } from "./feed.js";
import { rollLocal } from "./localRoller.js";

console.log("[roll/main.js] loaded");

(function () {
  const d = getRollDom();
  const diceList = (window.AETERNUM_PRESET_DICE || []).slice();
  const selectedCounts = {};
  const ui = loadUi();

  setFeedEmpty(d.feed);

  buildDiceGrid(
    { diceGrid: d.diceGrid, selectionTag: d.selectionTag },
    diceList,
    selectedCounts,
    () => refreshSelectionUI({ diceGrid: d.diceGrid, selectionTag: d.selectionTag }, selectedCounts)
  );

  function requireSelection() {
    const sel = selectionToPayload(selectedCounts);
    if (!Object.keys(sel).length) {
      toast("Seleziona almeno un dado (max 15 per tipo).", 2000);
      return null;
    }
    return sel;
  }

  function doRoll() {
    const selection = requireSelection();
    if (!selection) return;

    const { results, summary } = rollLocal(selection);

    const label = Object.keys(selection)
      .map(Number)
      .sort((a, b) => a - b)
      .map((s) => `d${s}×${selection[String(s)]}`)
      .join(" • ");

    addLocalEntry(d.feed, { ts: Date.now(), selectionLabel: label, results, summary }, ui);

    if (ui.autoReset) clearSelection(selectedCounts, { diceGrid: d.diceGrid, selectionTag: d.selectionTag });
  }

  d.rollBtn?.addEventListener("click", doRoll);

  d.resetSelectionBtn?.addEventListener("click", () => {
    clearSelection(selectedCounts, { diceGrid: d.diceGrid, selectionTag: d.selectionTag });
    toast("Selezione azzerata");
  });

  // Shortcut: Enter = roll, Esc = reset
  window.addEventListener("keydown", (e) => {
    const tag = (document.activeElement?.tagName || "").toLowerCase();
    const typing = tag === "input" || tag === "textarea" || tag === "select";
    if (typing) return;

    if (e.key === "Escape") {
      d.resetSelectionBtn?.click();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      d.rollBtn?.click();
    }
  });

  // UI toggles rapidi senza HTML: doppio click su feed per compatto
  d.feed?.addEventListener("dblclick", () => {
    ui.feedCollapsed = !ui.feedCollapsed;
    saveUi(ui);
    toast(ui.feedCollapsed ? "Feed compatto" : "Feed completo");
  });

  // Alt+R toggle auto-reset
  window.addEventListener("keydown", (e) => {
    if (e.altKey && (e.key === "r" || e.key === "R")) {
      ui.autoReset = !ui.autoReset;
      saveUi(ui);
      toast(ui.autoReset ? "Auto-reset ON" : "Auto-reset OFF");
    }
  });
})();
