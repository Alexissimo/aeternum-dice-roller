function safeText(s, max = 200) {
  return String(s ?? "").slice(0, max);
}

export function setFeedEmpty(feedEl) {
  if (!feedEl) return;
  feedEl.innerHTML = `<div class="hitem"><div class="hmeta">Nessun evento ancora.</div></div>`;
}

function formatPerDieResults(perDie) {
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

function badgeForType(type) {
  if (type === "public") return "PUB";
  if (type === "gm") return "GM";
  if (type === "secret") return "🔒";
  if (type === "system") return "SYS";
  return "";
}

function hasDice(entry) {
  const perDie = entry?.results?.perDie || {};
  return Object.keys(perDie).some((k) => Array.isArray(perDie[k]) && perDie[k].length > 0);
}

function hasSummary(entry) {
  const s = entry?.summary || {};
  return Object.keys(s.successByDie || {}).length > 0 || (s.failures ?? 0) > 0;
}

export function addFeedEntry(feedEl, entry, ui, labelOverride = null) {
  if (!feedEl) return;

  const item = document.createElement("div");
  item.className = "hitem";

  const ts = entry.ts || Date.now();
  const time = new Date(ts).toLocaleTimeString();
  const badge = badgeForType(entry.type);

  const titleLeft = labelOverride
    ? labelOverride
    : entry.type === "public"
      ? `${entry.author} ha tirato`
      : entry.type === "gm"
        ? `GM-only: ${entry.author}`
        : entry.type === "secret"
          ? `SEGRETO: ${entry.author} ↔ GM ${entry.gm}`
          : safeText(entry.title || "Evento");

  const shortRight = entry.selectionLabel || "";
  const dice = hasDice(entry);
  const sum = hasSummary(entry);

  const details = dice ? formatPerDieResults(entry.results.perDie) : "";
  const summary = (dice || sum) ? formatSummary(entry.summary || {}) : "";

  const collapsed = !!ui.feedCollapsed;

  const detailsHtml =
    dice && !collapsed ? `<div class="hmeta" style="margin-top:8px">${details}</div>` : "";
  const summaryHtml =
    (dice || sum) ? `<div class="hmeta" style="margin-top:6px">${summary}</div>` : "";

  item.innerHTML = `
    <div class="hline" style="align-items:flex-start; gap:10px;">
      <div class="hleft" style="display:flex; gap:10px; align-items:flex-start;">
        ${badge ? `<div style="min-width:44px;text-align:center;font-weight:800;opacity:.85;">${badge}</div>` : ""}
        <div>
          <div class="htitle">${safeText(titleLeft, 220)}</div>
          <div class="hmeta">${time}</div>
        </div>
      </div>
      <div class="hright">${safeText(shortRight, 80)}</div>
    </div>
    ${detailsHtml}
    ${summaryHtml}
  `;

  if (dice) {
    item.style.cursor = "pointer";
    item.title = "Click per mostrare/nascondere i dettagli";
    item.addEventListener("click", () => {
      const det = item.querySelector(".hmeta[style*='margin-top:8px']");
      if (det) det.remove();
      else {
        const html = document.createElement("div");
        html.className = "hmeta";
        html.style.marginTop = "8px";
        html.textContent = details;
        const metas = item.querySelectorAll(".hmeta");
        const lastMeta = metas[metas.length - 1];
        if (lastMeta) lastMeta.parentNode.insertBefore(html, lastMeta);
        else item.appendChild(html);
      }
    });
  }

  const empty = feedEl.firstChild?.querySelector?.(".hmeta")?.textContent === "Nessun evento ancora.";
  if (empty) feedEl.innerHTML = "";

  feedEl.prepend(item);
}
