export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function buildDiceGrid({ diceGrid, selectionTag }, diceList, selectedCounts, onChange) {
  if (!diceGrid) return;

  diceGrid.innerHTML = "";
  const ordered = diceList.slice().sort((a, b) => a.sides - b.sides);

  for (const d of ordered) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn dice-btn";
    btn.dataset.sides = String(d.sides);
    btn.textContent = `d${d.sides}`;

    const badge = document.createElement("div");
    badge.className = "badge";
    badge.style.display = "none";
    badge.textContent = "0";
    btn.appendChild(badge);

    btn.addEventListener("click", () => {
      const s = String(d.sides);
      const cur = selectedCounts[s] || 0;
      selectedCounts[s] = clamp(cur + 1, 0, 15);
      onChange();
    });

    btn.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const s = String(d.sides);
      const cur = selectedCounts[s] || 0;
      const next = clamp(cur - 1, 0, 15);
      if (next === 0) delete selectedCounts[s];
      else selectedCounts[s] = next;
      onChange();
    });

    // long-press mobile = decrement
    let pressT = null;
    btn.addEventListener("touchstart", () => {
      pressT = setTimeout(() => {
        const s = String(d.sides);
        const cur = selectedCounts[s] || 0;
        const next = clamp(cur - 1, 0, 15);
        if (next === 0) delete selectedCounts[s];
        else selectedCounts[s] = next;
        onChange();
      }, 450);
    });
    btn.addEventListener("touchend", () => clearTimeout(pressT));
    btn.addEventListener("touchcancel", () => clearTimeout(pressT));

    diceGrid.appendChild(btn);
  }

  refreshSelectionUI({ diceGrid, selectionTag }, selectedCounts);
}

export function selectionToPayload(selectedCounts) {
  const out = {};
  for (const [k, v] of Object.entries(selectedCounts)) if (v > 0) out[k] = v;
  return out;
}

export function selectionLabel(selectedCounts) {
  const keys = Object.keys(selectedCounts).map(Number).sort((a, b) => a - b);
  const parts = [];
  let tot = 0;
  for (const s of keys) {
    const n = selectedCounts[String(s)] || 0;
    if (n > 0) {
      parts.push(`d${s}×${n}`);
      tot += n;
    }
  }
  return { text: parts.length ? parts.join(" • ") : "—", tot };
}

export function refreshSelectionUI({ diceGrid, selectionTag }, selectedCounts) {
  if (selectionTag) selectionTag.textContent = selectionLabel(selectedCounts).text;
  if (!diceGrid) return;

  for (const btn of diceGrid.querySelectorAll("button[data-sides]")) {
    const sides = btn.dataset.sides;
    const n = selectedCounts[sides] || 0;
    btn.classList.toggle("selected", n > 0);

    const badge = btn.querySelector(".badge");
    if (badge) {
      badge.textContent = String(n);
      badge.style.display = n > 0 ? "flex" : "none";
    }
  }
}

export function clearSelection(selectedCounts, uiCtx) {
  for (const k of Object.keys(selectedCounts)) delete selectedCounts[k];
  refreshSelectionUI(uiCtx, selectedCounts);
}
