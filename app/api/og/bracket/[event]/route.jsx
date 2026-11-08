import { ImageResponse } from "next/og";
import { EVENTS } from "../../../../../lib/bracket.js";
import { getDb, getState } from "../../../../../lib/db.js";
import { eventData, matchesOf } from "../../../../../lib/matchlist.js";
import { EVENT_NAMES } from "../../../../../lib/paths.js";

export const dynamic = "force-dynamic";

const COLS = [["r16", "Huitièmes"], ["qf", "Quarts"], ["sf", "Demies"], ["gf", "Finale"]];

function Box({ m, small }) {
  const side = (t, s, won) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: small ? "2px 10px" : "4px 10px", color: won ? "#ffffff" : "#a0a09c", fontWeight: won ? 700 : 400, fontSize: small ? 15 : 18 }}>
      <span style={{ display: "flex", maxWidth: 190, overflow: "hidden" }}>{(t && t.name ? t.name : "TBD").slice(0, 18)}</span>
      <span style={{ display: "flex" }}>{s ?? ""}</span>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", width: 250, background: "#1e1e1e", borderRadius: 10, border: "1px solid #333" }}>
      {side(m.a, m.sa, m.win === "a")}
      <div style={{ display: "flex", height: 1, background: "#333" }} />
      {side(m.b, m.sb, m.win === "b")}
    </div>
  );
}

// GET: the last rounds of a qualifier's bracket as a picture, for the bot's /bracket and for sharing.
export async function GET(_req, { params }) {
  const { event } = await params;
  if (!EVENTS.includes(event)) return new Response("Not found", { status: 404 });
  const items = matchesOf(event, eventData(getState(getDb()), event));
  const cols = COLS.map(([k, label]) => [label, items.filter((m) => m.id.startsWith(`${k}-`))]).filter(([, l]) => l.length);
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#121212", padding: 36, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", color: "#c8f03c", fontSize: 30, fontWeight: 700, marginBottom: 18 }}>
          <span>VCT EMEA</span><span style={{ color: "#ffffff" }}>{EVENT_NAMES[event]}</span>
        </div>
        <div style={{ display: "flex", flex: 1, justifyContent: "space-between" }}>
          {cols.map(([label, list]) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ display: "flex", color: "#a0a09c", fontSize: 18, marginBottom: 8 }}>{label}</div>
              <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-around" }}>{list.map((m) => <Box key={m.id} m={m} small={list.length > 4} />)}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 675, headers: { "Cache-Control": "public, max-age=120, s-maxage=120" } },
  );
}
