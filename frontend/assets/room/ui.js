export function installBeforeUnloadGuard(getSessionRoomCode) {
  window.onbeforeunload = (e) => {
    if (!getSessionRoomCode()) return;
    e.preventDefault();
    e.returnValue = "";
    return "";
  };
}

export function installShortcuts({ isInRoom, isGM, doRollPublic, doRollGm, doReset }) {
  window.addEventListener("keydown", (e) => {
    const tag = (document.activeElement?.tagName || "").toLowerCase();
    const typing = tag === "input" || tag === "textarea" || tag === "select";
    if (typing) return;

    if (!isInRoom()) return;

    if (e.key === "Escape") {
      doReset();
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey && isGM()) return doRollGm();
      return doRollPublic();
    }
  });
}

export function buildInviteLink(roomCode) {
  const url = new URL(window.location.href);
  url.searchParams.set("room", roomCode);
  return url.toString();
}
