import { ImageResponse } from "next/og";
import { welcomeSig } from "../../../lib/botmod3.js";

export const dynamic = "force-dynamic";

// GET ?name=&avatar=&n=&g=&sig=: the Discord bot's welcome picture for a new member (lib/botserver.js): their avatar, their
// name, "you are the 1 234th member", in the site's colours. Signed by the bot (SESSION_SECRET): nobody else can make the
// site draw their own text, and the avatar can only come from Discord.
export async function GET(req) {
  const q = new URL(req.url).searchParams;
  if (q.get("sig") !== welcomeSig(q, process.env.SESSION_SECRET || "")) return new Response("Bad signature", { status: 403 });
  const name = String(q.get("name") || "").slice(0, 40);
  const n = Number(q.get("n")) || 0;
  const guild = String(q.get("g") || "").slice(0, 60);
  const avatar = /^https:\/\/cdn\.discordapp\.com\/avatars\/\d+\/\w+\.png\?size=\d+$/.test(q.get("avatar") || "") ? q.get("avatar") : "https://cdn.discordapp.com/embed/avatars/0.png";
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#0c0e13", color: "#fff", fontFamily: "sans-serif", alignItems: "center", padding: "0 64px", position: "relative" }}>
        <div style={{ display: "flex", position: "absolute", left: 0, top: 0, bottom: 0, width: 14, background: "#ff4655" }} />
        <div style={{ display: "flex", position: "absolute", right: -120, top: -160, width: 520, height: 520, borderRadius: 260, background: "rgba(201, 240, 60, 0.10)" }} />
        <img src={avatar} width={220} height={220} style={{ borderRadius: 110, border: "8px solid #c9f03c" }} alt="" />
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 56, flex: 1 }}>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 800, color: "#c9f03c", letterSpacing: 4 }}>BIENVENUE</div>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 800, lineHeight: 1.05, marginTop: 6 }}>{name || "Nouveau membre"}</div>
          {n > 0 && <div style={{ display: "flex", fontSize: 34, color: "#d8d8d6", marginTop: 14 }}>{`Tu es le ${n.toLocaleString("fr-FR")}${n === 1 ? "er" : "e"} membre`}</div>}
          {guild && <div style={{ display: "flex", fontSize: 26, color: "#8b8f99", marginTop: 10 }}>{guild}</div>}
        </div>
      </div>
    ),
    { width: 1100, height: 420, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
