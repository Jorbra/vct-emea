export const dynamic = "force-dynamic";

// GET ?f=<file>: a team logo kept on vlr.gg's image server (owcdn.net/img/<file>), served from the site so that the browser can
// read its colours (logo contrast, team theme). Only that server's image files, by their name: nothing else can be fetched here.
export async function GET(req) {
  const f = new URL(req.url).searchParams.get("f") || "";
  if (!/^[\w-]{4,40}\.(png|jpe?g|webp)$/i.test(f)) return new Response("Not found", { status: 404 });
  try {
    const res = await fetch(`https://owcdn.net/img/${f}`, { signal: AbortSignal.timeout(8000) });
    const type = res.headers.get("content-type") || "";
    if (!res.ok || !/^image\/(png|jpe?g|webp)$/.test(type)) return new Response("Not found", { status: 404 });
    return new Response(await res.arrayBuffer(), { headers: { "Content-Type": type, "Cache-Control": "public, max-age=604800", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
