import { getDb, saveTagLogo } from "../../../lib/db.js";
import { sniffImage as sniff } from "../../../lib/images.js";
import { badRequest, isAdmin, readBody, unauthorised } from "../../../lib/session.js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAX_BYTES = 1_500_000;

// Saves an uploaded logo as public/logos/<TAG>.<ext>: the logo is tied to the short tag only.
export async function POST(req) {
  if (!(await isAdmin())) return unauthorised();
  const body = await readBody(req);
  if (!body) return badRequest();
  const id = String(body.team || "");
  const team = getDb().prepare("SELECT id, name, tag FROM teams WHERE id = ?").get(id);
  if (!team) return NextResponse.json({ error: "Unknown team." }, { status: 404 });
  if (!team.name || !team.tag) return NextResponse.json({ error: "Give the team a short tag and save it before adding a logo." }, { status: 409 });
  const b64 = String(body.data || "");
  if (b64.length > MAX_BYTES * 1.4) return NextResponse.json({ error: "Logo is too big (1.5 MB maximum)." }, { status: 413 });
  const buf = Buffer.from(b64, "base64");
  if (!buf.length || buf.length > MAX_BYTES) return NextResponse.json({ error: "Logo is empty or too big (1.5 MB maximum)." }, { status: 413 });
  const ext = sniff(buf);
  if (!ext) return NextResponse.json({ error: "Use a PNG, JPG, WebP or SVG image." }, { status: 400 });
  saveTagLogo(team.tag, buf, ext);
  return NextResponse.json({ ok: true, message: `Logo saved for ${team.name}.` });
}
