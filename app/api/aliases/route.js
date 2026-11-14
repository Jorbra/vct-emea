import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db.js";
import { saveTeamAlias } from "../../../lib/editor17.js";
import { badRequest, currentEditor, readBody, unauthorised } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

// POST { from, name, tag }: the site writes the team "from" (as Toornament gives it) as "name". An empty name removes it.
export async function POST(req) {
  const me = await currentEditor();
  if (!me) return unauthorised();
  const b = await readBody(req);
  if (!b) return badRequest();
  const r = saveTeamAlias(getDb(), { from: b.from, name: b.name, tag: b.tag });
  return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.error }, { status: r.status });
}
