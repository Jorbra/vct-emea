import ASSETS from "../../../../lib/valorant-assets.json";

export const dynamic = "force-dynamic";

// GET: an agent's Mastery I pose (from the official VALORANT wiki), served from here and kept in the cache a week.
export async function GET(_req, { params }) {
  const k = String((await params).agent || "").toLowerCase().replace(/[^a-z]/g, "");
  const a = ASSETS.agents[k];
  if (!a || !a.pose || !/^https:\/\/wiki\.playvalorant\.com\//.test(a.pose)) return new Response("Not found", { status: 404 });
  try {
    const res = await fetch(a.pose, { headers: { "User-Agent": "vct-emea-site/1.0" }, signal: AbortSignal.timeout(10000) });
    const type = (res.headers.get("content-type") || "").split(";")[0];
    if (!res.ok || !/^image\/(png|webp|jpe?g)$/.test(type)) return new Response("Not found", { status: 404 });
    return new Response(await res.arrayBuffer(), { headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response("Not found", { status: 502 });
  }
}
