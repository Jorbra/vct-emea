import { ImageResponse } from "next/og";
import { getDb, getState } from "../../../../../lib/db.js";
import { allMatches } from "../../../../../lib/matchlist.js";
import { EVENT_NAMES, teamSlug } from "../../../../../lib/paths.js";
import { siteTeams } from "../../../../../lib/teams.js";
import { logoData, nameColor } from "../../../../../lib/ogimg.js";

export const dynamic = "force-dynamic";

// GET: a team as a collector's card (the bot's /equipe, shared links).
export async function GET(_req, { params }) {
  const { slug } = await params;
  const db = getDb();
  const state = getState(db);
  const t = siteTeams(state).find((x) => teamSlug(x.name) === slug);
  if (!t) return new Response("Not found", { status: 404 });
  const mine = allMatches(state).filter((m) => m.a && m.b && [teamSlug(m.a.name), teamSlug(m.b.name)].includes(slug));
  const side = (m) => (teamSlug(m.a.name) === slug ? "a" : "b");
  const done = mine.filter((m) => m.win).sort((x, y) => (y.at || "").localeCompare(x.at || ""));
  const w = done.filter((m) => m.win === side(m)).length;
  const form = done.slice(0, 5).reverse().map((m) => m.win === side(m));
  const events = [...new Set(mine.map((m) => EVENT_NAMES[m.event]))].slice(0, 2).join(" · ");
  const logo = logoData(db, t);
  const color = nameColor(t.name);
  const box = (v, l) => (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", fontSize: 64, fontWeight: 800, color: "#c9f03c" }}>{v}</div>
      <div style={{ display: "flex", fontSize: 24, color: "#8b8f99" }}>{l}</div>
    </div>
  );
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#0c0e13", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", height: 170, background: color }} />
        <div style={{ display: "flex", padding: "0 60px", marginTop: -90, alignItems: "flex-end", gap: 36 }}>
          <div style={{ display: "flex", width: 180, height: 180, borderRadius: 28, background: "#151821", border: "6px solid #0c0e13", alignItems: "center", justifyContent: "center", fontSize: 64, fontWeight: 800, color: "#e9e9e6" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo ? <img src={logo} width={150} height={150} style={{ objectFit: "contain" }} alt="" /> : (t.tag || t.name).slice(0, 3).toUpperCase()}
          </div>
          <div style={{ display: "flex", flexDirection: "column", paddingBottom: 10 }}>
            <div style={{ display: "flex", fontSize: t.name.length > 18 ? 56 : 72, fontWeight: 800, color: "#ffffff" }}>{t.name}</div>
            <div style={{ display: "flex", fontSize: 26, color: "#8b8f99" }}>{events || "VCT EMEA"}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 70, padding: "40px 60px 0" }}>
          {box(`${w}–${done.length - w}`, "VICTOIRES")}
          {form.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                {form.map((ok, i) => <div key={i} style={{ display: "flex", width: 48, height: 48, borderRadius: 10, background: ok ? "#3da05a" : "#c44a4a", color: "#fff", fontSize: 28, fontWeight: 800, alignItems: "center", justifyContent: "center" }}>{ok ? "V" : "D"}</div>)}
              </div>
              <div style={{ display: "flex", fontSize: 24, color: "#8b8f99", marginTop: 8 }}>FORME</div>
            </div>
          )}
        </div>
        <div style={{ display: "flex", position: "absolute", right: 50, bottom: 36, fontSize: 28, fontWeight: 800, color: "#c9f03c" }}>VCT EMEA</div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } },
  );
}
