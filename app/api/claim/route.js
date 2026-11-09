import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db.js";
import { claimMatch } from "../../../lib/round7.js";
import { badRequest, currentEditor, readBody, unauthorised } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

// POST { event, id, on }: this editor takes the match ("I'm on it") or lets it go. Not a change of the site: not in the history.
export async function POST(req) {
  const me = await currentEditor();
  if (!me) return unauthorised();
  const b = await readBody(req);
  if (!b) return badRequest();
  const r = claimMatch(getDb(), { event: String(b.event || ""), id: String(b.id || ""), who: me.who || "", on: !!b.on });
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status });
}
