export const dynamic = "force-dynamic";

// GET ?id=<digits>: a team logo kept on Toornament, served from the site so that the browser can read its colors (team theme).
// Only Toornament's media files, by their number: nothing else can be fetched through here.
export async function GET(req) {
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^\d{5,25}$/.test(id)) return new Response("Not found", { status: 404 });
  try {
    const res = await fetch(`https://play.toornament.com/media/file/${id}/logo_medium`, { signal: AbortSignal.timeout(8000) });
    const type = res.headers.get("content-type") || "";
    if (!res.ok || !/^image\/(png|jpe?g|webp|gif)$/.test(type)) return new Response("Not found", { status: 404 });
    return new Response(await res.arrayBuffer(), { headers: { "Content-Type": type, "Cache-Control": "public, max-age=604800", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
