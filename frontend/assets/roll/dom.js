export const $ = (id) => document.getElementById(id);

export function getRollDom() {
  return {
    diceGrid: $("diceGrid"),
    selectionTag: $("selectionTag"),
    selectedTag: $("selectedTag"),
    resultOut: $("resultOut"),
    history: $("history"),

    rollSelectionBtn: $("rollSelectionBtn"),
    resetSelectionBtn: $("resetSelectionBtn"),
    copyBtn: $("copyBtn"),
    clearHistoryBtn: $("clearHistoryBtn"),
  };
}
