const LS_ROLL_UI = "aeternum_roll_ui";

export function loadUi() {
  try {
    const raw = localStorage.getItem(LS_ROLL_UI);
    if (!raw) return { autoReset: true, feedCollapsed: false };
    const obj = JSON.parse(raw);
    return {
      autoReset: obj.autoReset ?? true,
      feedCollapsed: obj.feedCollapsed ?? false,
    };
  } catch {
    return { autoReset: true, feedCollapsed: false };
  }
}

export function saveUi(ui) {
  try {
    localStorage.setItem(LS_ROLL_UI, JSON.stringify(ui));
  } catch {}
}
