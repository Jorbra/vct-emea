import { NextResponse } from "next/server";
import { listRoles, removeAccount, resetPassword, setRole } from "../../../lib/accounts.js";
import { getDb } from "../../../lib/db.js";
import { badRequest, currentEditor, readBody, unauthorised } from "../../../lib/session.js";
import { recordAction } from "../../../lib/undo.js";

const noStore = { "Cache-Control": "no-store" };

/** Who has an access: for the main account only. */
export async function GET() {
  const me = await currentEditor();
  if (!me || me.who) return unauthorised();
  return NextResponse.json({ roles: listRoles(getDb()) }, { headers: noStore });
}

// Visitors' accounts, for the main editor account only: no e-mail exists to send a forgotten password to. The new password is shown once, and kept nowhere.
export async function POST(req) {
  const me = await currentEditor();
  if (!me || me.who) return unauthorised();
  const b = await readBody(req);
  if (!b) return badRequest();
  const name = String(b.name || "");
  const db = getDb();
  if (b.action === "reset") {
    const r = resetPassword(db, name);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status, headers: noStore });
    recordAction(db, `Visitor account: new password for ${r.name}.`);
    return NextResponse.json({ ok: true, name: r.name, password: r.password }, { headers: noStore });
  }
  if (b.action === "role") {
    const r = setRole(db, { name, role: String(b.role ?? ""), by: me.account || "" });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status, headers: noStore });
    recordAction(db, r.message, me.account || "");
    return NextResponse.json({ ok: true, message: r.message, roles: listRoles(db) }, { headers: noStore });
  }
  if (b.action === "remove") {
    if (me.account && me.account.toLowerCase() === name.trim().toLowerCase()) return NextResponse.json({ error: "You cannot take away your own access." }, { status: 409, headers: noStore });
    const r = removeAccount(db, name);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status, headers: noStore });
    recordAction(db, `Visitor account removed: ${name}.`);
    return NextResponse.json({ ok: true, message: r.message }, { headers: noStore });
  }
  return badRequest();
}
