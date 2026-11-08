import { ImageResponse } from "next/og";
import { scoreLabel } from "../../../../../lib/scoretext.js";
import { getDb, getState } from "../../../../../lib/db.js";
import { eventData, matchesOf } from "../../../../../lib/matchlist.js";
import { EVENT_NAMES } from "../../../../../lib/paths.js";
import { TIME_EVENTS } from "../../../../../lib/schedule.js";

export const dynamic = "force-dynamic";

/** A team's logo, as the image needs it: only PNG and JPEG, straight from the database. */
function logoOf(db, team) {
  const m = /^\/api\/logos\/(.+\.(png|jpe?g))$/i.exec((team && team.logo) || "");
  if (!m) return "";
  const row = db.prepare("SELECT data FROM lp_logos WHERE file = ?").get(decodeURIComponent(m[1]));
  if (!row) return "";
  return `data:image/${m[2].toLowerCase() === "png" ? "png" : "jpeg"};base64,${Buffer.from(row.data).toString("base64")}`;
}

function Side({ team, logo }) {
  const name = (team && team.name) || "TBD";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 420 }}>
      {logo
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={logo} width={190} height={190} style={{ objectFit: "contain" }} alt="" />
        : <div style={{ display: "flex", width: 190, height: 190, alignItems: "center", justifyContent: "center", borderRadius: 28, background: "#2a2a2a", color: "#e8e8e6", fontSize: 72, fontWeight: 700 }}>{(team && team.tag ? team.tag : name).slice(0, 3).toUpperCase()}</div>}
      <div style={{ display: "flex", marginTop: 28, fontSize: name.length > 18 ? 38 : 48, fontWeight: 700, color: "#ffffff", textAlign: "center", justifyContent: "center" }}>{name}</div>
    </div>
  );
}

// GET: the picture shown when a match's link is shared on Discord or X.
export async function GET(_req, { params }) {
  const { event, id } = await params;
  if (!TIME_EVENTS.includes(event)) return new Response("Not found", { status: 404 });
  const db = getDb();
  const state = getState(db);
  const m = matchesOf(event, eventData(state, event)).find((x) => x.id === id);
  if (!m) return new Response("Not found", { status: 404 });
  const done = m.sa != null && m.sb != null;
  const live = !done && state.live && state.live[event] && state.live[event][id];
  const middle = done ? scoreLabel(m, (x) => (x === "Forfeit" ? "FORFAIT" : x === "Win" ? "VICTOIRE" : x), ":") : live ? `${live.a ?? 0} : ${live.b ?? 0}` : "VS";
  const ex = (state.extra && state.extra[event] && state.extra[event][id]) || {};
  const maps = (live && live.maps ? live.maps : ex.maps || []).filter((x) => x.a != null && x.b != null).slice(0, 5);
  const round = m.round.map(([k, v]) => String(k).replace(/\{(\w+)\}/g, (_, x) => (v && v[x] != null ? v[x] : ""))).join(" · ");
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#0c0e13", padding: 56, fontFamily: "sans-serif", borderTop: `10px solid ${live ? "#ff4655" : "#c9f03c"}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", color: "#c8f03c", fontSize: 34, fontWeight: 700 }}>
          <span>VCT EMEA</span>
          <span style={{ color: live ? "#ff5a5f" : "#a0a09c" }}>{live ? "LIVE" : done ? "FINAL" : m.bo ? `Bo${m.bo}` : ""}</span>
        </div>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "space-between" }}>
          <Side team={m.a} logo={logoOf(db, m.a)} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "flex", fontSize: 104, fontWeight: 800, color: done || live ? "#c9f03c" : "#6f6f6b" }}>{middle}</div>
            {maps.length > 0 && <div style={{ display: "flex", gap: 10, marginTop: 10 }}>{maps.map((x, i) => <div key={i} style={{ display: "flex", fontSize: 24, color: "#e9e9e6", background: "#1d212c", borderRadius: 999, padding: "4px 14px" }}>{`${x.map || ""} ${x.a}–${x.b}`.trim()}</div>)}</div>}
          </div>
          <Side team={m.b} logo={logoOf(db, m.b)} />
        </div>
        <div style={{ display: "flex", justifyContent: "center", color: "#a0a09c", fontSize: 30 }}>{[EVENT_NAMES[event], round].filter(Boolean).join(" · ")}</div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=120, s-maxage=120" } },
  );
}
