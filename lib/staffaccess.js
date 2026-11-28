// The editor opened from Discord: the members with a role chosen in the bot's dashboard type /editeur, the bot answers them
// alone with a link that signs them in (one use, 10 minutes). Their access follows their roles: checked again every
// 10 minutes, and taken away as soon as the role is gone. Two levels: "editor" (the site and the bot, as an editor's
// account) and "moderator" (only the bot's dashboard: members, sanctions, tickets, journal).
import crypto from "node:crypto";

export const LEVELS = ["editor", "moderator"];
const ACCESS_KEY = "bot_access";
const CODE_MS = 10 * 60000;
export const RECHECK_MS = 10 * 60000;
// when Discord cannot be asked (no token, Discord down), a level checked less than an hour ago still holds
const GRACE_MS = 60 * 60000;

function ensure(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS bot_staff (id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '', level TEXT NOT NULL, checked TEXT NOT NULL, last TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS bot_staff_codes (code TEXT PRIMARY KEY, id TEXT NOT NULL, at TEXT NOT NULL);`);
}

const ids = (list) => [...new Set((Array.isArray(list) ? list : []).map((x) => String(x || "").replace(/\D/g, "")).filter((x) => /^\d{5,25}$/.test(x)))].slice(0, 20);

/** The roles that open the editor: { editor: [role ids], moderator: [role ids] }. */
export function readAccess(db) {
  let raw = null;
  try { const r = db.prepare("SELECT value FROM kv WHERE key = ?").get(ACCESS_KEY); raw = r ? JSON.parse(r.value) : null; } catch { raw = null; }
  return { editor: ids(raw && raw.editor), moderator: ids(raw && raw.moderator) };
}

/** Saves the roles (the main account only: the route checks it). The guild's own id (@everyone) is refused. */
export function saveAccess(db, raw, guild = "") {
  const clean = (list) => ids(list).filter((x) => x !== guild);
  const access = { editor: clean(raw && raw.editor), moderator: clean(raw && raw.moderator) };
  access.moderator = access.moderator.filter((x) => !access.editor.includes(x));
  db.prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(ACCESS_KEY, JSON.stringify(access));
  return access;
}

/** The level a member's roles give: "editor", "moderator" or "". */
export function levelFor(access, roles) {
  const has = (list) => (roles || []).some((r) => list.includes(String(r)));
  return has(access.editor) ? "editor" : has(access.moderator) ? "moderator" : "";
}

/** /editeur: keeps the member's level and gives a code for the link, used once in the next 10 minutes. */
export function makeStaffCode(db, { id, name, level }, now = Date.now()) {
  ensure(db);
  if (!LEVELS.includes(level) || !/^\d{5,25}$/.test(String(id))) return "";
  db.prepare("DELETE FROM bot_staff_codes WHERE at < ? OR id = ?").run(new Date(now - CODE_MS).toISOString(), String(id));
  const code = crypto.randomBytes(24).toString("base64url");
  db.prepare("INSERT INTO bot_staff_codes (code, id, at) VALUES (?, ?, ?)").run(code, String(id), new Date(now).toISOString());
  db.prepare("INSERT INTO bot_staff (id, name, level, checked) VALUES (?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET name = excluded.name, level = excluded.level, checked = excluded.checked")
    .run(String(id), String(name || "").slice(0, 60), level, new Date(now).toISOString());
  return code;
}

/** The link's code: the member it was made for ({ id, name, level }), or null when unknown, used or too old. */
export function useStaffCode(db, code, now = Date.now()) {
  ensure(db);
  const c = String(code || "");
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(c)) return null;
  const row = db.prepare("SELECT id, at FROM bot_staff_codes WHERE code = ?").get(c);
  db.prepare("DELETE FROM bot_staff_codes WHERE code = ? OR at < ?").run(c, new Date(now - CODE_MS).toISOString());
  if (!row || now - Date.parse(row.at) > CODE_MS) return null;
  const staff = staffOf(db, row.id);
  if (staff) db.prepare("UPDATE bot_staff SET last = ? WHERE id = ?").run(new Date(now).toISOString(), row.id);
  return staff;
}

export function staffOf(db, id) {
  ensure(db);
  return db.prepare("SELECT id, name, level, checked, last FROM bot_staff WHERE id = ?").get(String(id)) || null;
}

/** Everyone who signed in from Discord, for the dashboard. */
export function listStaff(db) {
  ensure(db);
  return db.prepare("SELECT id, name, level, checked, last FROM bot_staff ORDER BY level, name").all();
}

/** Takes the access away at once (the role removed, or the main account's choice): the session ends on its next page. */
export function dropStaff(db, id) {
  ensure(db);
  db.prepare("DELETE FROM bot_staff_codes WHERE id = ?").run(String(id));
  return db.prepare("DELETE FROM bot_staff WHERE id = ?").run(String(id)).changes > 0;
}

/**
 * A signed-in member's level, asked again of Discord when the last check is more than 10 minutes old: { id, name, level }
 * or null when the role is gone (the row is then removed). getMember(id) returns the member ({ roles, nick, user }),
 * null when they left the server, or throws when Discord cannot be asked.
 */
export async function checkStaff(db, id, getMember, now = Date.now()) {
  const row = staffOf(db, id);
  if (!row) return null;
  if (now - Date.parse(row.checked) < RECHECK_MS) return row;
  let member;
  try {
    if (!getMember) throw new Error("no bot");
    member = await getMember(row.id);
  } catch {
    return now - Date.parse(row.checked) < GRACE_MS ? row : null;
  }
  const level = member ? levelFor(readAccess(db), member.roles) : "";
  if (!level) { dropStaff(db, row.id); return null; }
  const name = (member.nick || (member.user && (member.user.global_name || member.user.username)) || row.name).slice(0, 60);
  db.prepare("UPDATE bot_staff SET level = ?, name = ?, checked = ? WHERE id = ?").run(level, name, new Date(now).toISOString(), row.id);
  return { ...row, level, name, checked: new Date(now).toISOString() };
}
