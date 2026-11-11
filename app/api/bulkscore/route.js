import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db.js";
import { saveAnyScore } from "../../../lib/r8apply.js";
import { recordAction } from "../../../lib/undo.js";
import { badRequest, currentEditor, readBody, unauthorised } from "../../../lib/session.js";
import { dropStateCache } from "../../../lib/db.js";

export const dynamic = "force-dynamic";

// POST { scores: [{ event, id, sa, sb }] }: many results at once, as one change in the history (undone together).
export async function POST(req) {
  const me = await currentEditor();
  if (!me) return unauthorised();
  const b = await readBody(req);
  if (!b || !Array.isArray(b.scores)) return badRequest();
  const db = getDb();
  const done = [];
  const failed = [];
  for (const s of b.scores.slice(0, 60)) {
    const r = saveAnyScore(db, { event: String(s.event || ""), id: String(s.id || ""), sa: Number(s.sa), sb: Number(s.sb) });
    if (r.ok) done.push(`${s.event} ${s.id} ${s.sa}-${s.sb}`); else failed.push({ event: s.event, id: s.id, error: r.error });
  }
  if (done.length) recordAction(db, `Scores entered together (${done.length}): ${done.join(", ")}`.slice(0, 400), me.who || "");
  dropStateCache();
  const { announceNow } = await import("../../../lib/notify.js");
  announceNow().catch(() => {});
  return NextResponse.json({ ok: true, saved: done.length, failed, message: `${done.length} score(s) saved.` });
}
