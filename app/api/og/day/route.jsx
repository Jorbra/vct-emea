import { ImageResponse } from "next/og";
import { getDb, getState } from "../../../../lib/db.js";
import { dayMatches, dayRecapOf, parisDay } from "../../../../lib/dayrecap.js";

export const dynamic = "force-dynamic";

// GET ?d=2026-11-14: a day's results as a picture (the bot's evening summary): up to 10 results and the player of the day.
export async function GET(req) {
  const asked = new URL(req.url).searchParams.get("d") || "";
  const day = /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : parisDay(Date.now());
  const db = getDb();
  const state = getState(db);
  const done = dayMatches(state, day);
  // the player of the day (best rating), the fans' MVP and the standout line (most kills on a map), as on /jour
  const { star, fans, best } = await dayRecapOf(db, state, day);
  const row = (m) => (
    <div key={m.event + m.id} style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30 }}>
      <div style={{ display: "flex", flex: 1, justifyContent: "flex-end", color: m.win === "a" ? "#ffffff" : "#8b8f99", fontWeight: m.win === "a" ? 800 : 500 }}>{m.a.name}</div>
      <div style={{ display: "flex", width: 110, justifyContent: "center", color: "#c9f03c", fontWeight: 800 }}>{`${m.sa} – ${m.sb}`}</div>
      <div style={{ display: "flex", flex: 1, color: m.win === "b" ? "#ffffff" : "#8b8f99", fontWeight: m.win === "b" ? 800 : 500 }}>{m.b.name}</div>
    </div>
  );
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#0c0e13", padding: 50, fontFamily: "sans-serif", color: "#fff", borderTop: "10px solid #c9f03c" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ display: "flex", fontSize: 54, fontWeight: 800 }}>RÉSULTATS DU JOUR</div>
          <div style={{ display: "flex", fontSize: 28, color: "#8b8f99" }}>{day.split("-").reverse().join("/")}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 26, flex: 1 }}>
          {done.length ? done.slice(0, 10).map(row) : <div style={{ display: "flex", fontSize: 32, color: "#8b8f99" }}>Aucun match terminé ce jour-là.</div>}
          {done.length > 10 ? <div style={{ display: "flex", fontSize: 24, color: "#8b8f99" }}>{`+ ${done.length - 10} autres`}</div> : null}
        </div>
        {star && (
          <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "18px 24px", borderRadius: 18, background: "#1a1e28" }}>
            <div style={{ display: "flex", fontSize: 26, color: "#c9f03c", fontWeight: 800 }}>⭐ JOUEUR DU JOUR</div>
            <div style={{ display: "flex", fontSize: 34, fontWeight: 800 }}>{star.name}</div>
            <div style={{ display: "flex", fontSize: 26, color: "#8b8f99" }}>{`${Number(star.r).toFixed(2)} rating · ${star.acs ?? "–"} ACS · ${star.vs}`}</div>
          </div>
        )}
        {(fans || best) && (
          <div style={{ display: "flex", gap: 14, marginTop: 12 }}>
            {fans && <div style={{ display: "flex", flex: 1, alignItems: "baseline", gap: 12, padding: "14px 20px", borderRadius: 16, background: "#1a1e28", fontSize: 24 }}><span style={{ display: "flex", color: "#c9f03c", fontWeight: 800 }}>MVP DES FANS</span><span style={{ display: "flex", fontWeight: 800, fontSize: 28 }}>{fans.name}</span><span style={{ display: "flex", color: "#8b8f99" }}>{`${fans.n} votes`}</span></div>}
            {best && <div style={{ display: "flex", flex: 1, alignItems: "baseline", gap: 12, padding: "14px 20px", borderRadius: 16, background: "#1a1e28", fontSize: 24 }}><span style={{ display: "flex", color: "#ff4655", fontWeight: 800 }}>🔥</span><span style={{ display: "flex", fontWeight: 800, fontSize: 28 }}>{best.name}</span><span style={{ display: "flex", color: "#8b8f99" }}>{`${best.k} kills · ${best.map}`}</span></div>}
          </div>
        )}
        <div style={{ display: "flex", marginTop: 16, fontSize: 24, color: "#c9f03c", fontWeight: 800 }}>VCT EMEA · vct-emea.vercel.app</div>
      </div>
    ),
    { width: 1200, height: 900, headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } },
  );
}
