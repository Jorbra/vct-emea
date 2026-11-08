import { ImageResponse } from "next/og";
import { getDb, getState } from "../../../../../lib/db.js";
import { siteTeams } from "../../../../../lib/teams.js";
import { teamSlug } from "../../../../../lib/paths.js";
import { readDetails, tournamentStats } from "../../../../../lib/tstats.js";
import { logoData } from "../../../../../lib/ogimg.js";

export const dynamic = "force-dynamic";

// GET: a player as a collector's card, this season's numbers on the site (the bot's /joueur, shared links).
export async function GET(_req, { params }) {
  const { slug } = await params;
  const db = getDb();
  const state = getState(db);
  const p = tournamentStats(state, readDetails(db)).players.find((x) => x.slug === slug);
  if (!p) return new Response("Not found", { status: 404 });
  const team = siteTeams(state).find((t) => teamSlug(t.name) === teamSlug(p.team));
  const logo = logoData(db, team);
  const agent = p.agents && p.agents[0] ? p.agents[0].name.toUpperCase() : "";
  const fix = (v, d) => (v == null ? "–" : Number(v).toFixed(d));
  const stat = (v, l) => (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", fontSize: 76, fontWeight: 800, color: "#c9f03c" }}>{v}</div>
      <div style={{ display: "flex", fontSize: 24, color: "#8b8f99" }}>{l}</div>
    </div>
  );
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#0c0e13", padding: 60, fontFamily: "sans-serif", position: "relative" }}>
        <div style={{ display: "flex", position: "absolute", right: -20, bottom: -60, fontSize: 300, fontWeight: 800, color: "#161a24" }}>{agent}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo ? <img src={logo} width={72} height={72} style={{ objectFit: "contain" }} alt="" /> : null}
          <div style={{ display: "flex", fontSize: 30, color: "#8b8f99" }}>{p.team}{agent ? ` · ${agent.charAt(0)}${agent.slice(1).toLowerCase()}` : ""}</div>
        </div>
        <div style={{ display: "flex", fontSize: 120, fontWeight: 800, color: "#ffffff", marginTop: 10 }}>{p.name}</div>
        <div style={{ display: "flex", gap: 60, marginTop: 30 }}>
          {stat(fix(p.r, 2), "RATING")}{stat(fix(p.acs, 0), "ACS")}{stat(fix(p.kd, 2), "K/D")}{stat(String(p.maps), "CARTES")}
        </div>
        <div style={{ display: "flex", position: "absolute", left: 60, bottom: 40, fontSize: 28, fontWeight: 800, color: "#c9f03c" }}>VCT EMEA</div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } },
  );
}
