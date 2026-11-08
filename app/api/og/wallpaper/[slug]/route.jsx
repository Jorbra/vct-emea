import { ImageResponse } from "next/og";
import { getDb, getState } from "../../../../../lib/db.js";
import { teamSlug } from "../../../../../lib/paths.js";
import { siteTeams } from "../../../../../lib/teams.js";
import { logoData, nameColor } from "../../../../../lib/ogimg.js";

export const dynamic = "force-dynamic";

const hex = (s) => (/^[0-9a-f]{6}$/i.test(s || "") ? `#${s}` : "");

// GET ?c1=<hex>&c2=<hex>: a phone wallpaper in a team's colors (the page sends the colors it read from the logo).
export async function GET(req, { params }) {
  const { slug } = await params;
  const u = new URL(req.url);
  const db = getDb();
  const t = siteTeams(getState(db)).find((x) => teamSlug(x.name) === slug);
  if (!t) return new Response("Not found", { status: 404 });
  const c1 = hex(u.searchParams.get("c1")) || nameColor(t.name);
  const c2 = hex(u.searchParams.get("c2")) || "#0c0e13";
  const logo = logoData(db, t);
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#0c0e13", fontFamily: "sans-serif", alignItems: "center" }}>
        <div style={{ display: "flex", width: "100%", height: 1100, background: c1, flexShrink: 0 }} />
        <div style={{ display: "flex", width: "100%", height: 70, background: c2, flexShrink: 0 }} />
        <div style={{ display: "flex", marginTop: -400, width: 460, height: 460, borderRadius: 80, background: "#0c0e13", border: "10px solid #0c0e13", alignItems: "center", justifyContent: "center", fontSize: 150, fontWeight: 800, color: "#ffffff" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo ? <img src={logo} width={380} height={380} style={{ objectFit: "contain" }} alt="" /> : (t.tag || t.name).slice(0, 3).toUpperCase()}
        </div>
        <div style={{ display: "flex", marginTop: 120, fontSize: t.name.length > 14 ? 90 : 120, fontWeight: 800, color: "#ffffff", textAlign: "center" }}>{t.name.toUpperCase()}</div>
        <div style={{ display: "flex", marginTop: 30, fontSize: 44, color: "#8b8f99", letterSpacing: 8 }}>VCT EMEA</div>
      </div>
    ),
    { width: 1080, height: 2340, headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400", "Content-Disposition": `inline; filename="${slug}-wallpaper.png"` } },
  );
}
