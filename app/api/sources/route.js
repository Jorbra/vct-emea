import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db.js";
import { saveSource } from "../../../lib/sources.js";
import { saveItem, readItems } from "../../../lib/lpstore.js";
import { recordAction } from "../../../lib/undo.js";
import { badRequest, currentEditor, readBody, unauthorised } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

// POST { event, toornament, vlr, stage, bracket }: where an event's data comes from, as links. Read at the next round.
export async function POST(req) {
  const me = await currentEditor();
  if (!me) return unauthorised();
  const b = await readBody(req);
  if (!b) return badRequest();
  const db = getDb();
  const event = String(b.event || "");
  const r = saveSource(db, { event, toornament: b.toornament, vlr: b.vlr, stage: b.stage, bracket: !!b.bracket, by: me.who || "" });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  // Toornament's next round reads the new tournament at once
  const meta = readItems("tsync_meta", db)[event];
  if (meta) saveItem("tsync_meta", event, { ...meta, hash: "", at: "" }, db);
  try { recordAction(db, `Sources of ${event}: Toornament ${r.source ? r.source.toornament || "default" : "default"}, vlr.gg ${r.source ? r.source.vlr || "default" : "default"}`, me.who || ""); } catch { /* the history is a convenience */ }
  return NextResponse.json({ ok: true, source: r.source });
}
