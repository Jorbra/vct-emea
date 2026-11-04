// Extra editor accounts, next to the main one (ADMIN_PASSWORD). Passwords are only kept as salted scrypt hashes.
import crypto from "node:crypto";

export function fillEditors(db) {
  db.exec("CREATE TABLE IF NOT EXISTS editors (name TEXT PRIMARY KEY COLLATE NOCASE, salt TEXT NOT NULL, hash TEXT NOT NULL, created TEXT NOT NULL)");
}

const hashOf = (password, salt) => crypto.scryptSync(password, salt, 32).toString("hex");

export const listEditors = (db) => db.prepare("SELECT name, created FROM editors ORDER BY name").all();
export const editorExists = (db, name) => !!db.prepare("SELECT 1 FROM editors WHERE name = ?").get(name);

/** Same contract as the other actions. */
export function addEditor(db, { name, password }) {
  const n = String(name ?? "").trim();
  const p = String(password ?? "");
  if (!/^[\p{L}\p{N} ._-]{2,30}$/u.test(n)) return { ok: false, status: 400, error: "A name has 2 to 30 letters or numbers." };
  if (p.length < 4) return { ok: false, status: 400, error: "A password has at least 4 characters." };
  if (editorExists(db, n)) return { ok: false, status: 409, error: "This name is already taken." };
  const salt = crypto.randomBytes(16).toString("hex");
  db.prepare("INSERT INTO editors (name, salt, hash, created) VALUES (?, ?, ?, ?)").run(n, salt, hashOf(p, salt), new Date().toISOString());
  return { ok: true, message: "Account created." };
}

export function removeEditor(db, { name }) {
  const r = db.prepare("DELETE FROM editors WHERE name = ?").run(String(name ?? ""));
  return r.changes ? { ok: true, message: "Account removed." } : { ok: false, status: 404, error: "Unknown account." };
}

/** The account's exact name if the password is right, else "". */
export function checkEditor(db, name, password) {
  const row = db.prepare("SELECT name, salt, hash FROM editors WHERE name = ?").get(String(name ?? "").trim());
  // the same work whether or not the name exists, so that a name cannot be guessed from the time taken
  const given = hashOf(String(password ?? ""), row ? row.salt : "no-such-account");
  if (!row) return "";
  const a = Buffer.from(given);
  const b = Buffer.from(row.hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? row.name : "";
}
