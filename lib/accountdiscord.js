// A site account tied to its Discord account: "Lier avec Discord" on the account page (Discord's sign-in, scope identify
// only: app/api/discord-link), or a code from the account page typed with /lier on Discord. Then the
// predictions made on Discord count for the account, and the Discord roles chosen in the bot's dashboard
// (lib/staffaccess.js) open the editor to the account too, checked again every 10 minutes.
import crypto from "node:crypto";
import { levelFor, readAccess } from "./staffaccess.js";

const CODE_MS = 15 * 60000;
const RECHECK_MS = 10 * 60000;
const GRACE_MS = 60 * 60000;
const PREFIX = "account:";

function ensure(db) {
  const cols = db.prepare("PRAGMA table_info(accounts)").all().map((c) => c.name);
  if (!cols.includes("discord")) db.exec("ALTER TABLE accounts ADD COLUMN discord TEXT NOT NULL DEFAULT ''");
  if (!cols.includes("discord_name")) db.exec("ALTER TABLE accounts ADD COLUMN discord_name TEXT NOT NULL DEFAULT ''");
  db.exec(`CREATE TABLE IF NOT EXISTS bot_codes (code TEXT PRIMARY KEY, hash TEXT NOT NULL, at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS bot_links (user TEXT PRIMARY KEY, hash TEXT NOT NULL, at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS bot_account_roles (id TEXT PRIMARY KEY, level TEXT NOT NULL, checked TEXT NOT NULL);`);
}

/** The code for /lier on the account page: 6 characters, 15 minutes. */
export function makeAccountCode(db, name, now = Date.now()) {
  ensure(db);
  const key = PREFIX + String(name);
  db.prepare("DELETE FROM bot_codes WHERE at < ? OR hash = ?").run(new Date(now - CODE_MS).toISOString(), key);
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = Array.from(crypto.randomBytes(6), (b) => chars[b % chars.length]).join("");
  db.prepare("INSERT INTO bot_codes (code, hash, at) VALUES (?, ?, ?)").run(code, key, new Date(now).toISOString());
  return code;
}

/** The account a /lier code is for, without using it: its name, or "" (a predictions code, unknown or too old). */
export function accountOfCode(db, code, now = Date.now()) {
  ensure(db);
  const r = db.prepare("SELECT hash, at FROM bot_codes WHERE code = ?").get(String(code || "").trim().toUpperCase());
  if (!r || !r.hash.startsWith(PREFIX) || now - Date.parse(r.at) > CODE_MS) return "";
  const a = db.prepare("SELECT name FROM accounts WHERE name = ?").get(r.hash.slice(PREFIX.length));
  return a ? a.name : "";
}

/**
 * Ties the Discord user to the account the code is for (one account per Discord user: a former tie is undone) and makes
 * their Discord predictions count for it. Returns the account's name, or "" when the code is not an account's.
 */
export function linkAccount(db, code, user, now = Date.now()) {
  const name = accountOfCode(db, code, now);
  if (!name || !/^\d{5,25}$/.test(String(user && user.id))) return "";
  db.prepare("DELETE FROM bot_codes WHERE code = ?").run(String(code).trim().toUpperCase());
  return linkAccountTo(db, name, user, now);
}

/** The same tie without a code, for an account already proven (Discord's OAuth2 sign-in). Returns its name, or "". */
export function linkAccountTo(db, name, user, now = Date.now()) {
  ensure(db);
  if (!/^\d{5,25}$/.test(String(user && user.id))) return "";
  const found = db.prepare("SELECT name FROM accounts WHERE name = ?").get(String(name || ""));
  if (!found) return "";
  name = found.name;
  const label = String(user.name || user.id).slice(0, 60);
  db.prepare("UPDATE accounts SET discord = '', discord_name = '' WHERE discord = ? AND name <> ?").run(user.id, name);
  db.prepare("UPDATE accounts SET discord = ?, discord_name = ? WHERE name = ?").run(user.id, label, name);
  const acc = db.prepare("SELECT token FROM accounts WHERE name = ?").get(name);
  const hash = crypto.createHash("sha256").update(String(acc.token)).digest("hex");
  db.prepare("INSERT INTO bot_links (user, hash, at) VALUES (?, ?, ?) ON CONFLICT (user) DO UPDATE SET hash = excluded.hash, at = excluded.at").run(user.id, hash, new Date(now).toISOString());
  db.prepare("DELETE FROM bot_account_roles WHERE id = ?").run(user.id);
  return name;
}

// ---- "Lier avec Discord": the state sent to Discord and back, signed, for this account and this browser, 10 minutes

const STATE_MS = 10 * 60000;
const sign = (secret, text) => crypto.createHmac("sha256", String(secret)).update(`discord-link:${text}`).digest("base64url");

/** A state for Discord's sign-in: { state, nonce }; the nonce goes in a cookie of this browser. */
export function makeLinkState(secret, account, now = Date.now()) {
  const nonce = crypto.randomBytes(16).toString("base64url");
  const body = Buffer.from(JSON.stringify({ a: String(account), t: now, n: nonce })).toString("base64url");
  return { state: `${body}.${sign(secret, body)}`, nonce };
}

/** The account a state was made for, when its signature, its age and this browser's nonce are right; else "". */
export function readLinkState(secret, state, nonce, now = Date.now()) {
  const [body, sig] = String(state || "").split(".");
  if (!secret || !body || !sig || !nonce) return "";
  const want = sign(secret, body);
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return "";
  let p;
  try { p = JSON.parse(Buffer.from(body, "base64url").toString()); } catch { return ""; }
  if (!p || typeof p.a !== "string" || !(now - p.t >= 0 && now - p.t < STATE_MS) || p.n !== String(nonce)) return "";
  return p.a;
}

/** The account's Discord: { id, name } or null. */
export function accountDiscord(db, name) {
  ensure(db);
  const r = db.prepare("SELECT discord, discord_name FROM accounts WHERE name = ?").get(String(name || ""));
  return r && r.discord ? { id: r.discord, name: r.discord_name || r.discord } : null;
}

/** Undoes the tie: the account keeps its predictions; those made on Discord from now on count apart again. */
export function unlinkAccount(db, name) {
  const d = accountDiscord(db, name);
  if (!d) return false;
  db.prepare("UPDATE accounts SET discord = '', discord_name = '' WHERE name = ?").run(String(name));
  db.prepare("DELETE FROM bot_links WHERE user = ?").run(d.id);
  db.prepare("DELETE FROM bot_account_roles WHERE id = ?").run(d.id);
  return true;
}

/**
 * The level the account's Discord roles give ("editor", "moderator" or ""), kept 10 minutes (an answer without access
 * too, so that Discord is not asked at every page). getMember as in lib/staffaccess.js checkStaff.
 */
export async function discordLevel(db, id, getMember, now = Date.now()) {
  ensure(db);
  const access = readAccess(db);
  if (!id || (!access.editor.length && !access.moderator.length)) return "";
  const cached = db.prepare("SELECT level, checked FROM bot_account_roles WHERE id = ?").get(String(id));
  if (cached && now - Date.parse(cached.checked) < RECHECK_MS) return cached.level;
  let member;
  try {
    if (!getMember) throw new Error("no bot");
    member = await getMember(String(id));
  } catch {
    return cached && now - Date.parse(cached.checked) < GRACE_MS ? cached.level : "";
  }
  const level = member ? levelFor(access, member.roles) : "";
  db.prepare("INSERT INTO bot_account_roles (id, level, checked) VALUES (?, ?, ?) ON CONFLICT (id) DO UPDATE SET level = excluded.level, checked = excluded.checked").run(String(id), level, new Date(now).toISOString());
  return level;
}
