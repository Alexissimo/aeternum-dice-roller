const LS_ROLL_HISTORY = "aeternum_roll_history_v1";

export function loadHistory() {
  try {
    const raw = localStorage.getItem(LS_ROLL_HISTORY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveHistory(list) {
  try {
    localStorage.setItem(LS_ROLL_HISTORY, JSON.stringify(list.slice(0, 50)));
  } catch {}
}

export function clearHistory() {
  try {
    localStorage.removeItem(LS_ROLL_HISTORY);
  } catch {}
}

function formatPerDie(perDie) {
  const sides = Object.keys(perDie || {}).map(Number).sort((a, b) => a - b);
  return sides.map((s) => `d${s}: ${(perDie[String(s)] || []).join(" ")}`).join(" | ");
}

function formatSummary(summary) {
  const successByDie = summary?.successByDie || {};
  const sides = Object.keys(successByDie).map(Number).sort((a, b) => a - b);
  const parts = sides.map((s) => `d${s} successi=${successByDie[String(s)]}`);
  parts.push(`fallimenti=${summary?.failures ?? 0}`);
  return parts.join(" • ");
}

export function renderHistory(historyEl, list) {
  if (!historyEl) return;

  if (!list.length) {
    historyEl.innerHTML = `<div class="hitem"><div class="hmeta">Nessun tiro ancora.</div></div>`;
    return;
  }

  historyEl.innerHTML = "";
  for (const entry of list.slice().reverse()) {
    const item = document.createElement("div");
    item.className = "hitem";

    const time = new Date(entry.ts).toLocaleTimeString();
    const details = formatPerDie(entry.results?.perDie || {});
    const summary = formatSummary(entry.summary || {});

    item.innerHTML = `
      <div class="hline">
        <div class="hleft">
          <div class="htitle">Tiro locale</div>
          <div class="hmeta">${time}</div>
        </div>
        <div class="hright">${entry.selectionLabel || ""}</div>
      </div>
      <div class="hmeta" style="margin-top:8px">${details}</div>
      <div class="hmeta" style="margin-top:6px">${summary}</div>
    `;
    historyEl.appendChild(item);
  }
}

export function buildResultText(entry) {
  const details = formatPerDie(entry.results?.perDie || {});
  const summary = formatSummary(entry.summary || {});
  return `${entry.selectionLabel}\n${details}\n${summary}`;
}

export function renderBigResult(resultOutEl, selectedTagEl, entry) {
  if (selectedTagEl) selectedTagEl.textContent = entry.selectionLabel || "—";
  if (!resultOutEl) return;

  const details = formatPerDie(entry.results?.perDie || {});
  const summary = formatSummary(entry.summary || {});
  resultOutEl.innerHTML = `
    <div>${details}</div>
    <div class="muted" style="margin-top:8px">${summary}</div>
  `;
}
