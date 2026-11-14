import { dayOf } from "../../../../lib/games.js";
import { gameData } from "../../../../lib/gamedata.js";

export const dynamic = "force-dynamic";

// GET: today's mystery map's layout, served from here so that its address does not give the map away. Blurred by the page.
export async function GET() {
  const p = gameData(dayOf()).puzzles.map;
  if (!p) return new Response("Not found", { status: 404 });
  try {
    const res = await fetch(p.answer.icon, { signal: AbortSignal.timeout(8000) });
    if (!res.ok || !/^image\/(png|webp|jpe?g)/.test(res.headers.get("content-type") || "")) return new Response("Not found", { status: 404 });
    return new Response(await res.arrayBuffer(), { headers: { "Content-Type": res.headers.get("content-type"), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
