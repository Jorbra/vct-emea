// Server-only helpers that need Next.js request context.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE, readToken } from "./auth.js";
import { ACCOUNT_COOKIE, accountEditor, readAccountToken } from "./accounts.js";
import { dropStateCache, getDb } from "./db.js";
import { editorExists } from "./editors.js";
import { after } from "next/server";
import { announceNow } from "./notify.js";
import { recordAction } from "./undo.js";

/**
 * Who is signed in, whatever their level: { who ("" for the main account), level: "owner" | "editor" | "moderator" },
 * or null. A removed account is signed out at once; a member signed in from Discord (lib/staffaccess.js) keeps the
 * access while they keep the role.
 */
export async function currentStaff() {
  const jar = await cookies();
  const c = jar.get(COOKIE);
  const t = readToken(c && c.value, process.env.SESSION_SECRET);
  // a visitor's account with an access opens the editor too: no second password
  if (!t) {
    const acc = jar.get(ACCOUNT_COOKIE);
    if (!acc) return null;
    const viaAccount = accountEditor(getDb(), acc.value, process.env.SESSION_SECRET);
    let found = viaAccount ? { ...viaAccount, level: viaAccount.level || (viaAccount.who ? "editor" : "owner") } : null;
    // an account tied to Discord (lib/accountdiscord.js): its roles there may give more
    if (!found || found.level === "moderator") found = (await accountViaDiscord(acc.value)) || found;
    if (found) dropStateCache();
    return found;
  }
  if (t.who.startsWith(DISCORD_WHO)) {
    const s = await discordStaff(t.who.slice(DISCORD_WHO.length));
    if (s) dropStateCache();
    return s;
  }
  dropStateCache(); // an editor always reads the latest
  return !t.who || editorExists(getDb(), t.who) ? { ...t, level: t.who ? "editor" : "owner" } : null;
}

/** An editor or the main account: the moderators (who only have the bot's dashboard) are not. */
export async function currentEditor() {
  const s = await currentStaff();
  return s && s.level !== "moderator" ? s : null;
}

export const isAdmin = async () => !!(await currentEditor());

// the session of a member signed in from Discord names them "discord:<id>"
export const DISCORD_WHO = "discord:";
// a member of the bot's server as Discord gives it, null when they are not on it (throws when Discord cannot be asked)
async function memberGetter(db) {
  const { botReady, discord } = await import("./botapi.js");
  const { botSettings } = await import("./botstore.js");
  const guild = botSettings(db).guild;
  return botReady() && guild ? async (uid) => {
    try { return await discord("GET", `/guilds/${guild}/members/${uid}`); } catch (e) { if (e.status === 404 || e.code === 10007 || e.code === 10013) return null; throw e; }
  } : null;
}
async function accountViaDiscord(token) {
  const db = getDb();
  const name = readAccountToken(db, token, process.env.SESSION_SECRET);
  if (!name) return null;
  const { accountDiscord, discordLevel } = await import("./accountdiscord.js");
  const d = accountDiscord(db, name);
  if (!d) return null;
  const level = await discordLevel(db, d.id, await memberGetter(db));
  return level === "editor" || level === "moderator" ? { who: name, account: name, level, discord: d.id } : null;
}
async function discordStaff(id) {
  const db = getDb();
  const { checkStaff } = await import("./staffaccess.js");
  const s = await checkStaff(db, id, await memberGetter(db));
  return s ? { who: `${s.name || id} (Discord)`, level: s.level, discord: s.id } : null;
}

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
