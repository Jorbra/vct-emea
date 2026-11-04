import { getDb, saveTagLogo } from "../../../../lib/db.js";
import { sniffImage as sniff } from "../../../../lib/images.js";
import { badRequest, isAdmin, readBody, unauthorised } from "../../../../lib/session.js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAX_BYTES = 1_500_000;
const EVENTS = ["gc"]; // team lists whose cards have a logo upload (the Qualifiers find theirs from the tag only)

// Saves an uploaded GC EMEA team logo as public/logos/<TAG>.<ext>: the logo is tied to the short tag only.
export async function POST(req) {
  if (!(await isAdmin())) return unauthorised();
  const body = await readBody(req);
  if (!body) return badRequest();
  const slot = Number(body.slot);
  if (!EVENTS.includes(body.event)) return NextResponse.json({ error: "Unknown event." }, { status: 404 });
  if (!Number.isInteger(slot) || slot < 1 || slot > 64) return NextResponse.json({ error: "Unknown slot." }, { status: 400 });
  const team = getDb().prepare("SELECT name, tag FROM qslots WHERE event = ? AND slot = ?").get(body.event, slot);
  if (!team || !team.name || !team.tag) return NextResponse.json({ error: "Give the team a short tag and save it before adding a logo." }, { status: 409 });
  const b64 = String(body.data || "");
  if (b64.length > MAX_BYTES * 1.4) return NextResponse.json({ error: "Logo is too big (1.5 MB maximum)." }, { status: 413 });
  const buf = Buffer.from(b64, "base64");
  if (!buf.length || buf.length > MAX_BYTES) return NextResponse.json({ error: "Logo is empty or too big (1.5 MB maximum)." }, { status: 413 });
  const ext = sniff(buf);
  if (!ext) return NextResponse.json({ error: "Use a PNG, JPG, WebP or SVG image." }, { status: 400 });
  saveTagLogo(team.tag, buf, ext);
  return NextResponse.json({ ok: true, message: `Logo saved for ${team.name}.` });
}
