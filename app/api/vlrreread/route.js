import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db.js";
import { rereadVlr } from "../../../lib/round14.js";
import { badRequest, currentEditor, readBody, unauthorised } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

// POST { event, id }: an editor asks for a match's vlr.gg page to be read again at the next round. Its table stays until then.
export async function POST(req) {
  const me = await currentEditor();
  if (!me) return unauthorised();
  const b = await readBody(req);
  if (!b) return badRequest();
  const r = rereadVlr(getDb(), String(b.event || ""), String(b.id || ""));
  return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.error }, { status: r.status });
}
