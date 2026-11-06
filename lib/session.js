// Server-only helpers that need Next.js request context.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE, readToken } from "./auth.js";
import { ACCOUNT_COOKIE, accountEditor } from "./accounts.js";
import { dropStateCache, getDb } from "./db.js";
import { editorExists } from "./editors.js";
import { after } from "next/server";
import { announceNow } from "./notify.js";
import { recordAction } from "./undo.js";

/** Who is signed in: { who } ("" for the main account), or null. A removed account is signed out at once. */
export async function currentEditor() {
  const jar = await cookies();
  const c = jar.get(COOKIE);
  const t = readToken(c && c.value, process.env.SESSION_SECRET);
  // a visitor's account with an access opens the editor too: no second password
  if (!t) {
    const acc = jar.get(ACCOUNT_COOKIE);
    const viaAccount = acc ? accountEditor(getDb(), acc.value, process.env.SESSION_SECRET) : null;
    if (viaAccount) dropStateCache();
    return viaAccount;
  }
  dropStateCache(); // an editor always reads the latest
  return !t.who || editorExists(getDb(), t.who) ? t : null;
}

export const isAdmin = async () => !!(await currentEditor());

/** Parses a JSON body. Requiring the JSON content type blocks plain cross-site form posts. */
export async function readBody(req) {
  if (!(req.headers.get("content-type") || "").includes("application/json")) return null;
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body : null;
  } catch {
    return null;
  }
}

/** The answer to an editor's action. A successful one becomes an undoable step and enters the history. */
export async function reply(r) {
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.message) {
    const me = await currentEditor();
    recordAction(getDb(), r.message, me ? me.who : "");
    dropStateCache();
    after(announceNow); // a match going live or a result: the alerts leave right after the answer
  }
  return NextResponse.json({ ok: true, message: r.message });
}

export const unauthorised = () => NextResponse.json({ error: "Not authorised." }, { status: 401 });
export const badRequest = () => NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
