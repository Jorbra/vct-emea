import { ImageResponse } from "next/og";
import { getDb, getState } from "../../../../lib/db.js";
import { allMatches } from "../../../../lib/matchlist.js";
import { detailsOf } from "../../../../lib/tstats.js";

export const dynamic = "force-dynamic";

const parisDay = (t) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(t));

// GET ?d=2026-11-14: a day's results as a picture (the bot's evening summary): up to 10 results and the player of the day.
export async function GET(req) {
  const asked = new URL(req.url).searchParams.get("d") || "";
  const day = /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : parisDay(Date.now());
  const db = getDb();
  const done = allMatches(getState(db)).filter((m) => m.a && m.b && m.sa != null && m.at && parisDay(m.at) === day);
  // the player of the day: the best rating of the day's tables (2 maps at least)
  let star = null;
  for (const m of done) {
    const d = detailsOf(db, m.event, m.id);
    for (const r of (d && d.all) || []) if (r.r != null && (!star || r.r > star.r)) star = { name: r.name, r: r.r, acs: r.acs, vs: `${m.a.name} vs ${m.b.name}` };
  }
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
        <div style={{ display: "flex", marginTop: 16, fontSize: 24, color: "#c9f03c", fontWeight: 800 }}>VCT EMEA · vct-emea.vercel.app</div>
      </div>
    ),
    { width: 1200, height: 900, headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } },
  );
}
