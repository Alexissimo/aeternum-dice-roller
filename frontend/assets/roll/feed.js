export function setFeedEmpty(feedEl) {
  if (!feedEl) return;
  feedEl.innerHTML = `<div class="hitem"><div class="hmeta">Nessun tiro ancora.</div></div>`;
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

export function addLocalEntry(feedEl, entry, ui) {
  if (!feedEl) return;

  const item = document.createElement("div");
  item.className = "hitem";

  const time = new Date(entry.ts || Date.now()).toLocaleTimeString();

  const details = formatPerDie(entry.results?.perDie || {});
  const summary = formatSummary(entry.summary || {});

  const collapsed = !!ui.feedCollapsed;
  const detailsHtml = collapsed ? "" : `<div class="hmeta" style="margin-top:8px">${details}</div>`;

  item.innerHTML = `
    <div class="hline" style="align-items:flex-start; gap:10px;">
      <div class="hleft" style="display:flex; gap:10px; align-items:flex-start;">
        <div style="min-width:44px;text-align:center;font-weight:800;opacity:.85;">LOC</div>
        <div>
          <div class="htitle">Tiro locale</div>
          <div class="hmeta">${time}</div>
        </div>
      </div>
      <div class="hright">${entry.selectionLabel || ""}</div>
    </div>
    ${detailsHtml}
    <div class="hmeta" style="margin-top:6px">${summary}</div>
  `;

  // toggle dettagli su click
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

  const empty = feedEl.firstChild?.querySelector?.(".hmeta")?.textContent === "Nessun tiro ancora.";
  if (empty) feedEl.innerHTML = "";

  feedEl.prepend(item);
}
