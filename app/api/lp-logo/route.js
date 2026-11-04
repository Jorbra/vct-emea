import { NextResponse } from "next/server";
import { findLogo, saveTagLogo } from "../../../lib/db.js";
import { TYPES, lpLogo } from "../../../lib/lplogo.js";
import { badRequest, isAdmin, readBody, unauthorised } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

// GET ?f=<logo path>: a small Liquipedia logo for the editor's team suggestions.
export async function GET(req) {
  if (!(await isAdmin())) return unauthorised();
  const logo = await lpLogo(new URL(req.url).searchParams.get("f"), 60);
  if (!logo) return new Response("Not found", { status: 404 });
  return new Response(logo.buf, {
    headers: { "Content-Type": TYPES[logo.ext], "Cache-Control": "private, max-age=604800", "X-Content-Type-Options": "nosniff" },
  });
}

// POST { tag, f }: a team picked from the suggestions gets its Liquipedia logo as public/logos/<TAG>.png,
// unless that tag already has a logo (one added by hand is never replaced).
export async function POST(req) {
  if (!(await isAdmin())) return unauthorised();
  const b = await readBody(req);
  if (!b) return badRequest();
  const tag = String(b.tag || "").trim().toUpperCase().slice(0, 7);
  if (!tag) return NextResponse.json({ error: "Give the team a short tag first." }, { status: 400 });
  if (findLogo(tag, undefined, tag)) return NextResponse.json({ ok: true, message: "This tag already has a logo." });
  const logo = await lpLogo(b.f, 300);
  if (!logo) return NextResponse.json({ error: "Logo not found." }, { status: 404 });
  saveTagLogo(tag, logo.buf, logo.ext);
  return NextResponse.json({ ok: true, message: "Logo added." });
}
