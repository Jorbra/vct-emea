import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db.js";
import { listNotes, saveNote } from "../../../lib/round10.js";
import { badRequest, currentEditor, readBody, unauthorised } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

// POST {}: every note. POST { event, id, body }: writes (or, empty, removes) a match's note. Editors only, never shown on the site.
export async function POST(req) {
  const me = await currentEditor();
  if (!me) return unauthorised();
  const b = await readBody(req);
  if (!b) return badRequest();
  const db = getDb();
  if (b.event && b.id) {
    const r = saveNote(db, { event: String(b.event), id: String(b.id), body: b.body, who: me.who || "" });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  }
  return NextResponse.json({ notes: listNotes(db) }, { headers: { "Cache-Control": "no-store" } });
}
