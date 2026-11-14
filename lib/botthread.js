// The last message of a match's Discord thread: the veto, each map's comps and the match's best player, from vlr.gg's table.
import { detailsOf } from "./tstats.js";

const cap = (s) => String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1);

export function threadFinal(db, m, lang = "fr") {
  const d = detailsOf(db, m.event, m.id);
  if (!d) return "";
  const L = (fr, en) => (lang === "en" ? en : fr);
  const out = [];
  if ((d.veto || []).length) out.push(`**${L("Veto", "Veto")}** · ${d.veto.map((v) => `${v.act === "ban" ? "❌" : v.act === "pick" ? "✅" : "➖"} ${v.map}`).join("  ")}`);
  const side = (mp, s) => [...new Set((mp.rows || []).filter((r) => r.side === s).flatMap((r) => r.agents || []))].map(cap).join(", ");
  for (const mp of (d.maps || []).slice(0, 5)) {
    if (!(mp.rows || []).some((r) => (r.agents || []).length)) continue;
    out.push(`**${mp.map} ${mp.a}–${mp.b}** · ${m.a.name} : ${side(mp, "a") || "–"} · ${m.b.name} : ${side(mp, "b") || "–"}`);
  }
  const best = ((d.all || []).filter((r) => r.acs != null).sort((x, y) => y.acs - x.acs || (y.r || 0) - (x.r || 0)))[0];
  if (best) out.push(`⭐ **MVP** ${best.name} · ${best.acs} ACS${best.r != null ? ` · ${Number(best.r).toFixed(2)} R` : ""}`);
  return out.join("\n").slice(0, 1900);
}
