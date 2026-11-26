// A built file of the site that does not exist (an older or newer version's, asked while a version goes online): a plain 404.
// Without this the site's catch-all page answered with HTML and a 200, which a browser ran as code ("Unexpected token '<'")
// and the installed app kept as the file. The files that exist never get here: Next.js serves them first.
const gone = () => new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export const dynamic = "force-dynamic";
export const GET = gone;
export const HEAD = gone;
