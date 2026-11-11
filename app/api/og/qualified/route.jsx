import { ImageResponse } from "next/og";
import { getDb, getState } from "../../../../lib/db.js";
import { qualifiedTeams } from "../../../../lib/round9.js";
import { logoData } from "../../../../lib/ogimg.js";

export const dynamic = "force-dynamic";

// GET ?event=q1&team=fnatic: "qualified" as a picture, for Discord and the site.
export async function GET(req) {
  const u = new URL(req.url);
  const db = getDb();
  const q = qualifiedTeams(getState(db)).find((x) => x.event === u.searchParams.get("event") && x.slug === u.searchParams.get("team"));
  if (!q) return new Response("Not found", { status: 404 });
  const logo = logoData(db, { logo: q.logo }) || (/^https:\/\//.test(q.logo) ? q.logo : "");
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", background: "#0f1a12", fontFamily: "sans-serif", color: "#fff" }}>
        <div style={{ display: "flex", fontSize: 30, letterSpacing: 4, color: "#c8f03c", fontWeight: 700 }}>QUALIFIÉ</div>
        {logo ? <img src={logo} width={170} height={170} style={{ objectFit: "contain", margin: "26px 0" }} alt="" /> : <div style={{ display: "flex", height: 40 }} />}
        <div style={{ display: "flex", fontSize: q.team.length > 18 ? 64 : 84, fontWeight: 800 }}>{q.team}</div>
        <div style={{ display: "flex", fontSize: 30, color: "#a0a09c", marginTop: 16 }}>{`${q.name} → ${q.to}`}</div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" } },
  );
}
