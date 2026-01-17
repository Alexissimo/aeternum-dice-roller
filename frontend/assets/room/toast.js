let toastTimer = null;

function ensureToastEl() {
  let el = document.getElementById("toast");
  if (el) return el;

  el = document.createElement("div");
  el.id = "toast";
  el.style.position = "fixed";
  el.style.left = "50%";
  el.style.bottom = "18px";
  el.style.transform = "translateX(-50%)";
  el.style.padding = "10px 12px";
  el.style.borderRadius = "12px";
  el.style.background = "rgba(0,0,0,0.65)";
  el.style.backdropFilter = "blur(10px)";
  el.style.border = "1px solid rgba(255,255,255,0.10)";
  el.style.color = "white";
  el.style.fontWeight = "700";
  el.style.zIndex = "9999";
  el.style.display = "none";
  el.style.maxWidth = "90vw";
  el.style.textAlign = "center";
  document.body.appendChild(el);
  return el;
}

export function toast(msg, ms = 1500) {
  const el = ensureToastEl();
  el.textContent = String(msg || "");
  el.style.display = "";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.style.display = "none"), ms);
}

export async function copyText(text) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    toast("Copiato ✅");
  } catch {
    prompt("Copia manualmente:", text);
  }
}
