import { ImageResponse } from "next/og";
import { mapsOverview } from "../../../../../lib/mappage.js";

export const dynamic = "force-dynamic";

// GET: a map's share picture: its splash behind, its name, how often it is played and its top agents.
export async function GET(_req, { params }) {
  const key = String((await params).name || "").toLowerCase().replace(/[^a-z]/g, "");
  const m = mapsOverview().find((x) => x.key === key);
  if (!m) return new Response("Not found", { status: 404 });
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", width: "100%", height: "100%", background: "#0c0e13", padding: 60, fontFamily: "sans-serif", position: "relative" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={m.splash} width={1200} height={675} style={{ position: "absolute", left: 0, top: -20 }} alt="" />
        <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: "100%", height: "100%", background: "linear-gradient(0deg, rgba(12,14,19,0.95) 15%, rgba(12,14,19,0.2) 70%)" }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {m.icon ? <img src={m.icon} width={260} height={260} style={{ position: "absolute", right: 50, top: 40 }} alt="" /> : null}
        <div style={{ display: "flex", fontSize: 140, fontWeight: 800, color: "#ffffff" }}>{m.name.toUpperCase()}</div>
        <div style={{ display: "flex", fontSize: 36, color: "#c9f03c", marginTop: 6 }}>{m.played ? `${m.played} CARTES JOUÉES` : "PAS ENCORE JOUÉE"}{m.agents.length ? ` · ${m.agents.map((a) => a.name.toUpperCase()).join(" · ")}` : ""}</div>
        <div style={{ display: "flex", position: "absolute", right: 60, bottom: 40, fontSize: 28, fontWeight: 800, color: "#c9f03c" }}>VCT EMEA</div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=600, s-maxage=600" } },
  );
}
