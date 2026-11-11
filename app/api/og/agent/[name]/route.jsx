import { ImageResponse } from "next/og";
import { agentPage } from "../../../../../lib/agentpage.js";

export const dynamic = "force-dynamic";

// GET: an agent's share picture: its portrait, its name in its colour, its numbers on the site's events.
export async function GET(_req, { params }) {
  const a = agentPage(decodeURIComponent((await params).name || ""));
  if (!a) return new Response("Not found", { status: 404 });
  const c = a.color || "#c9f03c";
  const stat = (v, l) => (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", fontSize: 72, fontWeight: 800, color: "#c9f03c" }}>{v}</div>
      <div style={{ display: "flex", fontSize: 24, color: "#8b8f99" }}>{l}</div>
    </div>
  );
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#0c0e13", padding: 60, fontFamily: "sans-serif", position: "relative" }}>
        <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: "100%", height: "100%", background: `linear-gradient(120deg, #0c0e13 40%, ${c}55 100%)` }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {a.portrait ? <img src={a.portrait} width={760} height={760} style={{ position: "absolute", right: -100, top: -40, objectFit: "contain" }} alt="" /> : null}
        <div style={{ display: "flex", fontSize: 30, color: "#8b8f99" }}>{(a.role || "AGENT").toUpperCase()}</div>
        <div style={{ display: "flex", fontSize: 140, fontWeight: 800, color: c, marginTop: 6 }}>{a.name.toUpperCase()}</div>
        <div style={{ display: "flex", gap: 60, marginTop: 30 }}>
          {stat(String(a.picks), "CARTES")}{stat(`${a.share}%`, "DES ÉQUIPES")}{stat(`${a.pct}%`, "GAGNÉES")}
        </div>
        <div style={{ display: "flex", position: "absolute", left: 60, bottom: 40, fontSize: 28, fontWeight: 800, color: "#c9f03c" }}>VCT EMEA</div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=600, s-maxage=600" } },
  );
}
