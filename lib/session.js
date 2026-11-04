// Server-only helpers that need Next.js request context.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE, readToken } from "./auth.js";
import { getDb } from "./db.js";
import { editorExists } from "./editors.js";
import { syncNow } from "./lpstore.js";
import { recordAction } from "./undo.js";

/** Who is signed in: { who } ("" for the main account), or null. A removed account is signed out at once. */
export async function currentEditor() {
  const jar = await cookies();
  const c = jar.get(COOKIE);
  const t = readToken(c && c.value, process.env.SESSION_SECRET);
  if (!t) return null;
  // An action and the page shown after it can run on two servers, each with its own copy of the database: an editor always reads the latest.
  const db = getDb();
  try {
    syncNow(db);
  } catch (e) {
    console.log(`[db] sync failed: ${e.message}`); // what this copy has is better than no page
  }
  return !t.who || editorExists(db, t.who) ? t : null;
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
  }
  return NextResponse.json({ ok: true, message: r.message });
}

export const unauthorised = () => NextResponse.json({ error: "Not authorised." }, { status: 401 });
export const badRequest = () => NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
