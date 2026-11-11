// The score widgets streamers put in OBS: plain HTML, transparent, refreshed by themselves. Pure.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** One match: teams, score (maps won, or the live score), the maps. */
export function matchCard(m, live) {
  const done = m.sa != null && m.sb != null;
  const sa = done ? m.sa : live ? live.a ?? 0 : null;
  const sb = done ? m.sb : live ? live.b ?? 0 : null;
  const logo = (t) => (t && t.logo ? `<img src="${esc(t.logo)}" alt="">` : "");
  const maps = ((live && live.maps) || []).filter((x) => x.a != null).map((x) => `<span>${esc(x.map)} ${x.a}–${x.b}</span>`).join("");
  return `<div class="card${live && !done ? " live" : ""}"><div class="t">${logo(m.a)}<b>${esc((m.a && m.a.name) || "TBD")}</b></div><div class="s">${sa == null ? "vs" : `${sa} – ${sb}`}</div><div class="t r"><b>${esc((m.b && m.b.name) || "TBD")}</b>${logo(m.b)}</div>${maps ? `<div class="m">${maps}</div>` : ""}</div>`;
}

export function page(body, { light = false, refresh = 20 } = {}) {
  const fg = light ? "#111" : "#fff";
  const bg = light ? "rgba(255,255,255,.92)" : "rgba(12,13,16,.88)";
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="${refresh}"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VCT EMEA</title>
<style>html,body{margin:0;background:transparent;font-family:Barlow,system-ui,sans-serif;color:${fg}}.wrap{display:grid;gap:8px;padding:6px}
.card{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;background:${bg};border-radius:10px;padding:10px 14px}
.card.live{box-shadow:inset 3px 0 0 #ff4655}.t{display:flex;align-items:center;gap:8px;font-size:20px;min-width:0}.t b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.t.r{justify-content:flex-end}.t img{width:30px;height:30px;object-fit:contain}.s{font-size:30px;font-weight:800;letter-spacing:.04em}
.m{grid-column:1/-1;display:flex;gap:10px;justify-content:center;font-size:13px;opacity:.8}.empty{font-size:16px;opacity:.7;padding:10px}</style></head>
<body><div class="wrap">${body}</div></body></html>`;
}
