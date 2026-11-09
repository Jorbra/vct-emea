import { ImageResponse } from "next/og";
import { getDb, getState } from "../../../../lib/db.js";
import { powerRanking } from "../../../../lib/round6.js";
import { weekRecap } from "../../../../lib/round7.js";
import { readDetails } from "../../../../lib/tstats.js";

export const dynamic = "force-dynamic";

// GET: the last 7 days as a picture (Discord, every Monday): matches played, player of the week, biggest win, power top 5.
export async function GET() {
  const db = getDb();
  const state = getState(db);
  const now = Date.now();
  const w = weekRecap(state, readDetails(db, ""), powerRanking(state, now), now);
  const box = (title, children) => (
    <div style={{ display: "flex", flexDirection: "column", background: "#1e1e1e", borderRadius: 24, padding: "24px 30px", flex: 1 }}>
      <div style={{ display: "flex", fontSize: 24, color: "#a0a09c" }}>{title}</div>
      {children}
    </div>
  );
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#121212", padding: 50, fontFamily: "sans-serif", color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", color: "#c8f03c", fontSize: 34, fontWeight: 700 }}>
          <span>VCT EMEA · La semaine</span>
          <span style={{ color: "#a0a09c" }}>{w.matches} matchs</span>
        </div>
        <div style={{ display: "flex", gap: 22, marginTop: 30 }}>
          {box("Joueur de la semaine", w.best ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 56, fontWeight: 800, marginTop: 6 }}>{w.best.name}</div>
              <div style={{ display: "flex", fontSize: 28, color: "#c8f03c" }}>{`Rating ${w.best.r.toFixed(2)} · ${w.best.acs} ACS · ${w.best.n} matchs`}</div>
            </div>
          ) : <div style={{ display: "flex", fontSize: 32, marginTop: 10 }}>Pas assez de cartes</div>)}
          {box("Plus large victoire", w.biggest ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 40, fontWeight: 800, marginTop: 6 }}>{`${w.biggest.a} ${w.biggest.sa}–${w.biggest.sb} ${w.biggest.b}`.slice(0, 40)}</div>
              <div style={{ display: "flex", fontSize: 26, color: "#a0a09c" }}>{w.biggest.event}</div>
            </div>
          ) : <div style={{ display: "flex", fontSize: 32, marginTop: 10 }}>Aucun match</div>)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", background: "#1e1e1e", borderRadius: 24, padding: "22px 30px", marginTop: 22 }}>
          <div style={{ display: "flex", fontSize: 24, color: "#a0a09c" }}>Classement de puissance</div>
          <div style={{ display: "flex", gap: 26, marginTop: 10, flexWrap: "wrap" }}>
            {w.top.map((t, i) => <div key={t.slug} style={{ display: "flex", fontSize: 30, fontWeight: 700 }}><span style={{ color: i < 3 ? "#c8f03c" : "#fff", marginRight: 10 }}>{i + 1}.</span>{t.name.slice(0, 18)}</div>)}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=600, s-maxage=600" } },
  );
}
