import { getDb } from "../../../../lib/db.js";

// Serves the logos saved in the database, so a logo added in the editor shows up at once.
const TYPES = { png: "image/png", svg: "image/svg+xml", webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg" };

export const dynamic = "force-dynamic";

export async function GET(_req, { params }) {
  const { file } = await params;
  // Letters with accents and spaces too (KRÜ.png, "BJK FE.png" put in the folder by hand); never a slash, so never outside public/logos.
  const m = /^[\p{L}\p{N}][\p{L}\p{N}\p{M} _.[\]()'&+-]{0,99}\.(png|svg|webp|jpe?g)$/iu.exec(file || "");
  if (!m) return new Response("Not found", { status: 404 });
  const row = getDb().prepare("SELECT data FROM lp_logos WHERE file = ?").get(file);
  if (!row) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(row.data), {
    headers: {
      "Content-Type": TYPES[m[1].toLowerCase()],
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
