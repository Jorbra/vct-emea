// Visitors' accounts: a name and a password, to find one's favorite teams, predictions and settings on every device.
// Passwords are only kept as salted scrypt hashes. No e-mail: the main editor account can give a new password. Same contract as the other actions.
import crypto from "node:crypto";

export const ACCOUNT_COOKIE = "vct_account";
export const ACCOUNT_MS = 180 * 24 * 3600 * 1000;
const MAX_ACCOUNTS = 20000;
const MAX_FAILS = 8;
const LOCK_MS = 15 * 60 * 1000;
const MAX_FAVORITES = 200;

const fail = (status, error) => ({ ok: false, status, error });
const hashOf = (password, salt) => crypto.scryptSync(String(password), salt, 32).toString("hex");
const sameText = (a, b) => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const voterHash = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
const validToken = (t) => /^[A-Za-z0-9_-]{20,80}$/.test(String(t || ""));

export function fillAccounts(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS accounts (
    name TEXT PRIMARY KEY COLLATE NOCASE, salt TEXT NOT NULL, hash TEXT NOT NULL, ver INTEGER NOT NULL DEFAULT 1,
    token TEXT NOT NULL, favorites TEXT NOT NULL DEFAULT '[]', prefs TEXT NOT NULL DEFAULT '{}',
    fails INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0, created TEXT NOT NULL)`);
  if (!db.prepare("PRAGMA table_info(accounts)").all().some((c) => c.name === "role")) db.exec("ALTER TABLE accounts ADD COLUMN role TEXT NOT NULL DEFAULT ''");
}

export function cleanFavorites(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((x) => typeof x === "string" && /^[a-z0-9-]{1,80}$/.test(x)))].slice(0, MAX_FAVORITES);
}

export function cleanPrefs(p) {
  const out = {};
  if (!p || typeof p !== "object") return out;
  if (p.theme === "light" || p.theme === "dark") out.theme = p.theme;
  if (["fr", "en", "tr", "ar"].includes(p.lang)) out.lang = p.lang;
  if (typeof p.countdown === "boolean") out.countdown = p.countdown;
  return out;
}

const parse = (text, fallback) => { try { return JSON.parse(text); } catch { return fallback; } };
const view = (r) => ({ name: r.name, token: r.token, favorites: parse(r.favorites, []), prefs: parse(r.prefs, {}), role: r.role || "" });
const row = (db, name) => db.prepare("SELECT * FROM accounts WHERE name = ?").get(String(name ?? "").trim());

/** A device's predictions join the account's: a pick the account already has stays. The device's token is what proves they are its own. */
function joinPredictions(db, deviceToken, accountToken) {
  if (!validToken(deviceToken) || deviceToken === accountToken) return;
  const from = voterHash(deviceToken);
  const to = voterHash(accountToken);
  const voter = db.prepare("SELECT name, created FROM voters WHERE hash = ?").get(from);
  if (!voter) return;
  db.transaction(() => {
    db.prepare("INSERT OR IGNORE INTO predictions (hash, event, id, pick) SELECT ?, event, id, pick FROM predictions WHERE hash = ?").run(to, from);
    db.prepare("DELETE FROM predictions WHERE hash = ?").run(from);
    db.prepare("DELETE FROM voters WHERE hash = ?").run(from);
    db.prepare("INSERT OR IGNORE INTO voters (hash, name, created) VALUES (?, ?, ?)").run(to, voter.name, voter.created);
  })();
}

export function signUp(db, { name, password, token, favorites, prefs }, now = Date.now()) {
  const n = String(name ?? "").trim();
  const p = String(password ?? "");
  if (!/^[\p{L}\p{N} ._-]{3,20}$/u.test(n)) return fail(400, "A name has 3 to 20 letters or numbers.");
  if (p.length < 8 || p.length > 200) return fail(400, "A password has at least 8 characters.");
  if (row(db, n)) return fail(409, "This name is already taken.");
  if (db.prepare("SELECT COUNT(*) AS n FROM accounts").get().n >= MAX_ACCOUNTS) return fail(503, "No new account for now.");
  const salt = crypto.randomBytes(16).toString("hex");
  const own = validToken(token) ? token : crypto.randomBytes(24).toString("hex");
  db.prepare("INSERT INTO accounts (name, salt, hash, token, favorites, prefs, created) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(n, salt, hashOf(p, salt), own, JSON.stringify(cleanFavorites(favorites)), JSON.stringify(cleanPrefs(prefs)), new Date(now).toISOString());
  return { ok: true, message: "Account created.", account: view(row(db, n)), ver: 1 };
}

/** The favorites of the device join the account's; a name that does not exist costs the same time and answers the same. */
export function logIn(db, { name, password, token, favorites }, now = Date.now()) {
  const r = row(db, name);
  const given = hashOf(String(password ?? "").slice(0, 200), r ? r.salt : "no-such-account");
  if (r && r.locked_until > now) return fail(429, "Too many attempts. Try again in a few minutes.");
  if (!r || !sameText(given, r.hash)) {
    if (r) {
      const fails = r.fails + 1;
      db.prepare("UPDATE accounts SET fails = ?, locked_until = ? WHERE name = ?").run(fails >= MAX_FAILS ? 0 : fails, fails >= MAX_FAILS ? now + LOCK_MS : 0, r.name);
    }
    return fail(401, "Wrong name or password.");
  }
  joinPredictions(db, token, r.token);
  const all = cleanFavorites([...parse(r.favorites, []), ...cleanFavorites(favorites)]);
  db.prepare("UPDATE accounts SET fails = 0, locked_until = 0, favorites = ? WHERE name = ?").run(JSON.stringify(all), r.name);
  return { ok: true, message: "Signed in.", account: view(row(db, r.name)), ver: r.ver };
}

export const readAccount = (db, name) => { const r = row(db, name); return r ? view(r) : null; };

export function saveAccount(db, name, { favorites, prefs }) {
  const r = row(db, name);
  if (!r) return fail(404, "Unknown account.");
  const fav = favorites === undefined ? r.favorites : JSON.stringify(cleanFavorites(favorites));
  const merged = prefs === undefined ? r.prefs : JSON.stringify({ ...parse(r.prefs, {}), ...cleanPrefs(prefs) });
  db.prepare("UPDATE accounts SET favorites = ?, prefs = ? WHERE name = ?").run(fav, merged, r.name);
  return { ok: true, message: "Saved." };
}

/** A new password signs out every other device. */
export function changePassword(db, name, { password, next }) {
  const r = row(db, name);
  if (!r) return fail(404, "Unknown account.");
  if (!sameText(hashOf(String(password ?? "").slice(0, 200), r.salt), r.hash)) return fail(401, "Wrong password.");
  const p = String(next ?? "");
  if (p.length < 8 || p.length > 200) return fail(400, "A password has at least 8 characters.");
  const salt = crypto.randomBytes(16).toString("hex");
  db.prepare("UPDATE accounts SET salt = ?, hash = ?, ver = ver + 1 WHERE name = ?").run(salt, hashOf(p, salt), r.name);
  return { ok: true, message: "Password changed.", ver: r.ver + 1 };
}

/** Removes the account, and its predictions if `withPredictions`. */
export function deleteAccount(db, name, { password, withPredictions = true }) {
  const r = row(db, name);
  if (!r) return fail(404, "Unknown account.");
  if (!sameText(hashOf(String(password ?? "").slice(0, 200), r.salt), r.hash)) return fail(401, "Wrong password.");
  db.transaction(() => {
    if (withPredictions) {
      const h = voterHash(r.token);
      db.prepare("DELETE FROM predictions WHERE hash = ?").run(h);
      db.prepare("DELETE FROM voters WHERE hash = ?").run(h);
    }
    db.prepare("DELETE FROM accounts WHERE name = ?").run(r.name);
  })();
  return { ok: true, message: "Account deleted." };
}

// --- for the main editor account: there is no e-mail to send a forgotten password to
export const countAccounts = (db) => db.prepare("SELECT COUNT(*) AS n FROM accounts").get().n;

export function resetPassword(db, name) {
  const r = row(db, name);
  if (!r) return fail(404, "Unknown account.");
  const password = crypto.randomBytes(9).toString("base64url");
  const salt = crypto.randomBytes(16).toString("hex");
  db.prepare("UPDATE accounts SET salt = ?, hash = ?, ver = ver + 1, fails = 0, locked_until = 0 WHERE name = ?").run(salt, hashOf(password, salt), r.name);
  return { ok: true, message: "New password made.", name: r.name, password };
}

export function removeAccount(db, name) {
  const r = row(db, name);
  if (!r) return fail(404, "Unknown account.");
  db.prepare("DELETE FROM accounts WHERE name = ?").run(r.name);
  return { ok: true, message: "Account deleted." };
}

// --- editor access. "owner" has what the main account has; "editor" what an editor's account has. Read at each request: taking it away is immediate.
export const ROLES = ["", "editor", "owner"];

/** The accounts with an access: [{ name, role }]. */
export const listRoles = (db) => db.prepare("SELECT name, role FROM accounts WHERE role <> '' ORDER BY role DESC, name").all().map((r) => ({ name: r.name, role: r.role }));

/** Gives or takes an access. `by`: the account doing it, which cannot take its own away by accident. */
export function setRole(db, { name, role, by = "" }) {
  if (!ROLES.includes(role)) return fail(400, "Unknown access.");
  const r = row(db, name);
  if (!r) return fail(404, "Unknown account.");
  if (by && by.toLowerCase() === r.name.toLowerCase() && role !== "owner") return fail(409, "You cannot take away your own access.");
  db.prepare("UPDATE accounts SET role = ? WHERE name = ?").run(role, r.name);
  return { ok: true, name: r.name, role, message: role ? `Access given to ${r.name}.` : `Access taken from ${r.name}.` };
}

/** Who a cookie makes an editor: the same shape as an editor's session, with the account's name; null otherwise. */
export function accountEditor(db, token, secret, now = Date.now()) {
  const name = readAccountToken(db, token, secret, now);
  if (!name) return null;
  const r = row(db, name);
  if (r.role === "owner") return { who: "", account: r.name };
  return r.role === "editor" ? { who: r.name, account: r.name } : null;
}

// --- the signed cookie: it cannot be used as an editor's, and a new password ends it
const signed = (payload, secret) => crypto.createHmac("sha256", secret).update(`account:${payload}`).digest("hex");

export function makeAccountToken(secret, name, ver, now = Date.now()) {
  const payload = `${now + ACCOUNT_MS}.${Buffer.from(name).toString("base64url")}.${ver}`;
  return `${payload}.${signed(payload, secret)}`;
}

/** The account a cookie names, when valid and still current: its name, or "". */
export function readAccountToken(db, token, secret, now = Date.now()) {
  if (!token || !secret) return "";
  const parts = String(token).split(".");
  if (parts.length !== 4 || !(Number(parts[0]) > now)) return "";
  if (!sameText(parts[3], signed(parts.slice(0, 3).join("."), secret))) return "";
  const r = row(db, Buffer.from(parts[1], "base64url").toString());
  return r && r.ver === Number(parts[2]) ? r.name : "";
}
