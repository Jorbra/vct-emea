import { ImageResponse } from "next/og";
import { getDb, getState } from "../../../../lib/db.js";
import { readDetails, tournamentStats } from "../../../../lib/tstats.js";

export const dynamic = "force-dynamic";

// GET ?a=<slug>&b=<slug>: two players face to face, this season's numbers on the site (the bot's /duel).
export async function GET(req) {
  const u = new URL(req.url);
  const db = getDb();
  const players = tournamentStats(getState(db), readDetails(db)).players;
  const a = players.find((p) => p.slug === u.searchParams.get("a"));
  const b = players.find((p) => p.slug === u.searchParams.get("b"));
  if (!a || !b) return new Response("Not found", { status: 404 });
  const rows = [["RATING", "r", 2], ["ACS", "acs", 0], ["K/D", "kd", 2], ["KAST", "kast", 0, "%"], ["ADR", "adr", 0]];
  const val = (p, k, d, u2 = "") => (p[k] == null ? "–" : `${Number(p[k]).toFixed(d)}${u2}`);
  const cell = (p, o, k, d, u2, align) => {
    const win = p[k] != null && o[k] != null && p[k] > o[k];
    return <div style={{ display: "flex", width: 360, justifyContent: align, fontSize: 46, fontWeight: 800, color: win ? "#c9f03c" : "#e9e9e6" }}>{val(p, k, d, u2)}</div>;
  };
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#0c0e13", padding: "44px 60px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 26 }}>
          <div style={{ display: "flex", flexDirection: "column", width: 440 }}>
            <div style={{ display: "flex", fontSize: a.name.length > 10 ? 62 : 80, fontWeight: 800, color: "#ffffff" }}>{a.name}</div>
            <div style={{ display: "flex", fontSize: 28, color: "#8b8f99" }}>{a.team}</div>
          </div>
          <div style={{ display: "flex", fontSize: 60, fontWeight: 800, color: "#ff4655" }}>VS</div>
          <div style={{ display: "flex", flexDirection: "column", width: 440, alignItems: "flex-end" }}>
            <div style={{ display: "flex", fontSize: b.name.length > 10 ? 62 : 80, fontWeight: 800, color: "#ffffff" }}>{b.name}</div>
            <div style={{ display: "flex", fontSize: 28, color: "#8b8f99" }}>{b.team}</div>
          </div>
        </div>
        {rows.map(([l, k, d, u2]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 72, borderTop: "2px solid #1d212c" }}>
            {cell(a, b, k, d, u2, "flex-start")}
            <div style={{ display: "flex", fontSize: 26, color: "#8b8f99" }}>{l}</div>
            {cell(b, a, k, d, u2, "flex-end")}
          </div>
        ))}
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } },
  );
}
