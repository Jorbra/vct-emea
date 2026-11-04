// "Undo the last change" and the change history. SQLite triggers write, for every change to the tournament tables, the SQL that
// would reverse it; each editor action closes a step. Automatic writes between two actions (a qualifier's winner filling the next
// event) join the step undone with the action before them, and they come back by themselves when they still apply.

const TABLES = ["teams", "matches", "qslots", "qscores", "kteams", "kmatches", "kv", "mtimes", "mextra", "mlive", "einfo", "rteams", "rmatches", "news"];
const KEEP_STEPS = 50;
const KEEP_HISTORY = 500;

/** Creates the log and (again, as columns may have changed) the triggers. Called last when a database opens. */
export function installUndo(db) {
  db.pragma("recursive_triggers = ON"); // so that INSERT OR REPLACE reports the row it replaces
  db.exec(`
    CREATE TABLE IF NOT EXISTS undostate (id INTEGER PRIMARY KEY CHECK (id = 1), step INTEGER NOT NULL, off INTEGER NOT NULL DEFAULT 0);
    INSERT OR IGNORE INTO undostate (id, step, off) VALUES (1, 1, 0);
    CREATE TABLE IF NOT EXISTS undolog (seq INTEGER PRIMARY KEY AUTOINCREMENT, step INTEGER NOT NULL, sql TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS undosteps (step INTEGER PRIMARY KEY, label TEXT NOT NULL, who TEXT NOT NULL DEFAULT '', at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, who TEXT NOT NULL DEFAULT '', message TEXT NOT NULL);
  `);
  const q = (name) => `"${name.replace(/"/g, '""')}"`;
  const lit = (s) => `'${s.replace(/'/g, "''")}'`;
  for (const t of TABLES) {
    const cols = db.prepare(`PRAGMA table_info(${q(t)})`).all();
    for (const kind of ["ins", "upd", "del"]) db.exec(`DROP TRIGGER IF EXISTS ${q(`undo_${t}_${kind}`)}`);
    const pk = cols.filter((c) => c.pk > 0).map((c) => c.name);
    if (!cols.length || !pk.length) continue; // the table does not exist yet, or cannot be addressed
    const where = (row) => pk.map((c) => `${lit(`${q(c)} = `)} || quote(${row}.${q(c)})`).join(` || ' AND ' || `);
    const names = cols.map((c) => q(c.name)).join(", ");
    const values = cols.map((c) => `quote(OLD.${q(c.name)})`).join(` || ', ' || `);
    const sets = cols.map((c) => `${lit(`${q(c.name)} = `)} || quote(OLD.${q(c.name)})`).join(` || ', ' || `);
    const changed = cols.map((c) => `OLD.${q(c.name)} IS NOT NEW.${q(c.name)}`).join(" OR ");
    const on = "(SELECT off FROM undostate) = 0";
    const log = (sql) => `INSERT INTO undolog (step, sql) SELECT step, ${sql} FROM undostate;`;
    db.exec(`
      CREATE TRIGGER ${q(`undo_${t}_ins`)} AFTER INSERT ON ${q(t)} WHEN ${on} BEGIN
        ${log(`${lit(`DELETE FROM ${q(t)} WHERE `)} || ${where("NEW")}`)}
      END;
      CREATE TRIGGER ${q(`undo_${t}_upd`)} AFTER UPDATE ON ${q(t)} WHEN ${on} AND (${changed}) BEGIN
        ${log(`${lit(`UPDATE ${q(t)} SET `)} || ${sets} || ' WHERE ' || ${where("NEW")}`)}
      END;
      CREATE TRIGGER ${q(`undo_${t}_del`)} AFTER DELETE ON ${q(t)} WHEN ${on} BEGIN
        ${log(`${lit(`INSERT INTO ${q(t)} (${names}) VALUES (`)} || ${values} || ')'`)}
      END;
    `);
  }
}

/** Ends an editor action: what it changed becomes one undoable step, and it enters the history. */
export function recordAction(db, label, who = "", now = new Date()) {
  const at = now.toISOString();
  db.transaction(() => {
    db.prepare("INSERT INTO history (at, who, message) VALUES (?, ?, ?)").run(at, who, label);
    db.prepare("DELETE FROM history WHERE id <= (SELECT MAX(id) FROM history) - ?").run(KEEP_HISTORY);
    const { step } = db.prepare("SELECT step FROM undostate").get();
    if (!db.prepare("SELECT 1 FROM undolog WHERE step = ? LIMIT 1").get(step)) return; // nothing changed: nothing to undo
    db.prepare("INSERT INTO undosteps (step, label, who, at) VALUES (?, ?, ?, ?)").run(step, label, who, at);
    db.prepare("UPDATE undostate SET step = step + 1").run();
    const oldest = db.prepare("SELECT step FROM undosteps ORDER BY step DESC LIMIT 1 OFFSET ?").get(KEEP_STEPS);
    if (oldest) {
      db.prepare("DELETE FROM undolog WHERE step <= ?").run(oldest.step);
      db.prepare("DELETE FROM undosteps WHERE step <= ?").run(oldest.step);
    }
  })();
}

/** What "Undo" would reverse: { label, who, at }, or null. */
export function lastAction(db) {
  return db.prepare("SELECT label, who, at FROM undosteps ORDER BY step DESC LIMIT 1").get() || null;
}

/** Reverses the last action, and the automatic writes made since. Same contract as the other actions. */
export function undoLast(db, who = "", now = new Date()) {
  const last = db.prepare("SELECT step, label FROM undosteps ORDER BY step DESC LIMIT 1").get();
  if (!last) return { ok: false, status: 409, error: "Nothing to undo." };
  db.transaction(() => {
    db.prepare("UPDATE undostate SET off = 1").run();
    for (const { sql } of db.prepare("SELECT sql FROM undolog WHERE step >= ? ORDER BY seq DESC").all(last.step)) db.prepare(sql).run();
    db.prepare("DELETE FROM undolog WHERE step >= ?").run(last.step);
    db.prepare("DELETE FROM undosteps WHERE step = ?").run(last.step);
    db.prepare("UPDATE undostate SET off = 0").run();
    db.prepare("INSERT INTO history (at, who, message) VALUES (?, ?, ?)").run(now.toISOString(), who, `Undone: ${last.label}`);
  })();
  return { ok: true, message: "Last change undone." };
}

/** The latest changes, newest first. */
export const listHistory = (db, limit = 30) => db.prepare("SELECT at, who, message FROM history ORDER BY id DESC LIMIT ?").all(limit);
