import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db.js";
import { APERCU, publicApercu, setApercu } from "../../../lib/apercu.js";
import { badRequest, currentEditor, readBody, reply, unauthorised } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

// GET: the new things in preview and whether each is open to everyone (editors only).
export async function GET() {
  if (!(await currentEditor())) return unauthorised();
  const open = publicApercu(getDb());
  return NextResponse.json({ list: Object.entries(APERCU).map(([name, x]) => ({ name, ...x, public: open[name] })) });
}

// POST { name, public }: opens a new thing to everyone, or puts it back in preview. The main account only.
export async function POST(req) {
  const me = await currentEditor();
  if (!me || me.who) return unauthorised();
  const b = await readBody(req);
  if (!b) return badRequest();
  return reply(setApercu(getDb(), String(b.name || ""), !!b.public));
}
