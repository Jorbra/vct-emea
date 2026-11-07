import { ImageResponse } from "next/og";
import { getDb, getState } from "../../../../lib/db.js";
import { voterCard } from "../../../../lib/fans.js";
import { EVENT_NAMES } from "../../../../lib/paths.js";

export const dynamic = "force-dynamic";

const BADGE = { streak: (b) => `🔥 ${b.n} d'affilée`, champion: (b) => `👑 Vainqueur ${EVENT_NAMES[b.event] || ""}`, perfect: (b) => `🎯 Sans faute ${EVENT_NAMES[b.event] || ""}`, many: (b) => `📈 ${b.n} pronostics` };

// GET: a visitor's season as a picture, for Discord or X.
export async function GET(_req, { params }) {
  const name = decodeURIComponent((await params).name || "").slice(0, 20);
  const db = getDb();
  const c = voterCard(db, getState(db), name);
  if (!c) return new Response("Not found", { status: 404 });
  const rate = c.total ? Math.round((c.good / c.total) * 100) : 0;
  const box = (value, label) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "#1e1e1e", borderRadius: 24, padding: "26px 34px", minWidth: 230 }}>
      <div style={{ display: "flex", fontSize: 64, fontWeight: 800, color: "#ffffff" }}>{value}</div>
      <div style={{ display: "flex", fontSize: 26, color: "#a0a09c", marginTop: 6 }}>{label}</div>
    </div>
  );
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#121212", padding: 56, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", color: "#c8f03c", fontSize: 34, fontWeight: 700 }}>
          <span>VCT EMEA · Pronostics</span>
          <span style={{ color: "#a0a09c" }}>Saison 2027</span>
        </div>
        <div style={{ display: "flex", fontSize: c.name.length > 14 ? 78 : 96, fontWeight: 800, color: "#ffffff", marginTop: 40 }}>{c.name}</div>
        <div style={{ display: "flex", gap: 24, marginTop: 40 }}>
          {box(c.rank ? `#${c.rank}` : "–", c.rank ? `sur ${c.of}` : "pas encore classé")}
          {box(c.points, "points")}
          {box(`${c.good}/${c.total}`, `bons pronostics · ${rate}%`)}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 34, fontSize: 30, color: "#e8e8e6" }}>
          {c.badges.slice(0, 4).map((b, i) => <span key={i} style={{ display: "flex", background: "#2a2a2a", borderRadius: 999, padding: "8px 20px" }}>{BADGE[b.kind](b)}</span>)}
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } },
  );
}
