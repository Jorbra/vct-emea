import { ImageResponse } from "next/og";
import { getDb, getState } from "../../../../../../lib/db.js";
import { allMatches } from "../../../../../../lib/matchlist.js";
import { EVENT_NAMES } from "../../../../../../lib/paths.js";
import { logoData, nameColor } from "../../../../../../lib/ogimg.js";

export const dynamic = "force-dynamic";

// GET: a match as a 9:16 picture (1080 × 1920), for an Instagram or TikTok story.
export async function GET(_req, { params }) {
  const { event, id } = await params;
  const db = getDb();
  const state = getState(db);
  const m = allMatches(state).find((x) => x.event === event && x.id === id);
  if (!m || !m.a || !m.b) return new Response("Not found", { status: 404 });
  const ex = (state.extra[event] || {})[id] || {};
  const done = m.sa != null && m.sb != null;
  const live = (state.live[event] || {})[id];
  const score = done ? `${m.sa} – ${m.sb}` : live ? `${live.a ?? 0} – ${live.b ?? 0}` : "VS";
  const side = (t, won) => {
    const logo = logoData(db, t) || (/^https:\/\//.test(t.logo || "") ? t.logo : "");
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, opacity: done && !won ? 0.55 : 1 }}>
        {logo ? <img src={logo} width={260} height={260} style={{ objectFit: "contain" }} alt="" /> : <div style={{ display: "flex", width: 260, height: 260, borderRadius: 40, background: nameColor(t.name) }} />}
        <div style={{ display: "flex", fontSize: t.name.length > 14 ? 64 : 84, fontWeight: 800, textAlign: "center" }}>{t.name}</div>
      </div>
    );
  };
  const maps = (ex.maps || []).filter((x) => x.a != null);
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", width: "100%", height: "100%", background: "#0d0f14", padding: "120px 60px", fontFamily: "sans-serif", color: "#fff" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", fontSize: 44, color: "#c8f03c", fontWeight: 700, letterSpacing: 4 }}>{done ? "RÉSULTAT" : live ? "EN DIRECT" : "À VENIR"}</div>
          <div style={{ display: "flex", fontSize: 40, color: "#a0a09c" }}>{EVENT_NAMES[event] || event}</div>
        </div>
        {side(m.a, m.win === "a")}
        <div style={{ display: "flex", fontSize: 200, fontWeight: 800, color: "#c8f03c" }}>{score}</div>
        {side(m.b, m.win === "b")}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 18, fontSize: 38, color: "#d0d0cc" }}>
          {maps.slice(0, 5).map((x, i) => <span key={i} style={{ display: "flex", background: "#1c1f27", borderRadius: 18, padding: "10px 24px" }}>{`${x.map || "?"} ${x.a}–${x.b}`}</span>)}
        </div>
        <div style={{ display: "flex", fontSize: 36, color: "#7d7d7a" }}>vct-emea.vercel.app</div>
      </div>
    ),
    { width: 1080, height: 1920, headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } },
  );
}
