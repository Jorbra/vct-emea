import { dayOf } from "../../../../lib/games.js";
import { gameData } from "../../../../lib/gamedata.js";

export const dynamic = "force-dynamic";

const IMAGE = /^image\/(png|jpe?g|webp|gif|svg\+xml)$/;
const notFound = () => new Response("Not found", { status: 404 });

// GET: today's mystery logo, served from here so that its address does not give the team away. Blurred by the page.
export async function GET(req) {
  const p = gameData(dayOf()).puzzles.logo;
  if (!p) return notFound();
  const logo = p.answer.logo;
  const headers = (type) => ({ "Content-Type": type, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" });
  try {
    const data = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(logo);
    if (data) return IMAGE.test(data[1]) ? new Response(Buffer.from(data[2], "base64"), { headers: headers(data[1]) }) : notFound();
    const url = logo.startsWith("/") ? new URL(logo, req.url).toString() : logo;
    if (!/^https?:\/\//.test(url)) return notFound();
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const type = (res.headers.get("content-type") || "").split(";")[0];
    if (!res.ok || !IMAGE.test(type)) return notFound();
    return new Response(await res.arrayBuffer(), { headers: headers(type) });
  } catch {
    return notFound();
  }
}
