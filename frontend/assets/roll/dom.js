export const $ = (id) => document.getElementById(id);

export function getRollDom() {
  return {
    diceGrid: $("diceGrid"),
    selectionTag: $("selectionTag"),
    resetSelectionBtn: $("resetSelectionBtn"),
    rollBtn: $("rollBtn"),
    feed: $("feed"),
  };
}
