// Tries the real thing against Turso, on a scratch table, and times it: is a copy kept in step usable from a site? Prints no secret.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "libsql";
import { harden } from "../lib/db.js";

const env = Object.fromEntries(fs.readFileSync(".env.turso", "utf8").split(/\r?\n/).map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
  console.log("Fill in .env.turso first.");
  process.exit(1);
}
const options = { syncUrl: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "turso-check-"));
const time = (label, fn) => { const t = Date.now(); const out = fn(); console.log(label.padEnd(44), `${Date.now() - t} ms`); return out; };
const open = (name) => harden(new Database(path.join(dir, name), options));
const a = time("open a copy", () => open("a.db"));
time("first sync", () => a.sync());
time("create scratch table", () => a.exec("CREATE TABLE IF NOT EXISTS zz_check (id INTEGER PRIMARY KEY, v TEXT)"));
time("write one row", () => a.prepare("INSERT INTO zz_check (v) VALUES (?)").run("one"));
console.log("read own write at once".padEnd(44), a.prepare("SELECT count(*) c FROM zz_check").get().c >= 1);
time("transaction with a nested one", () => a.transaction(() => {
  a.prepare("INSERT INTO zz_check (v) VALUES (?)").run("two");
  a.transaction(() => a.prepare("INSERT INTO zz_check (v) VALUES (?)").run("three"))();
})());
try {
  a.transaction(() => {
    a.prepare("INSERT INTO zz_check (v) VALUES (?)").run("never");
    throw new Error("stop");
  })();
} catch { /* wanted */ }
console.log("a failed transaction leaves nothing".padEnd(44), a.prepare("SELECT count(*) c FROM zz_check WHERE v = 'never'").get().c === 0);
time("trigger (as the undo uses)", () => {
  a.exec("CREATE TABLE IF NOT EXISTS zz_log (s TEXT); CREATE TRIGGER IF NOT EXISTS zz_t AFTER INSERT ON zz_check BEGIN INSERT INTO zz_log VALUES (NEW.v); END;");
  a.prepare("INSERT INTO zz_check (v) VALUES (?)").run("logged");
});
console.log("trigger ran".padEnd(44), a.prepare("SELECT count(*) c FROM zz_log WHERE s = 'logged'").get().c === 1);
time("1000 local reads", () => { for (let i = 0; i < 1000; i += 1) a.prepare("SELECT count(*) c FROM zz_check").get(); });
const b = time("second copy, as a new server", () => open("b.db"));
time("its first sync", () => b.sync());
console.log("sees the rows".padEnd(44), b.prepare("SELECT count(*) c FROM zz_check").get().c >= 3);
a.prepare("INSERT INTO zz_check (v) VALUES (?)").run("later");
time("sync with little new", () => b.sync());
console.log("sees the new row".padEnd(44), b.prepare("SELECT count(*) c FROM zz_check WHERE v = 'later'").get().c >= 1);
try {
  const out = path.join(dir, "export.db");
  time("export a copy", () => b.exec(`VACUUM INTO '${out.replace(/\\/g, "/")}'`));
  console.log("export size".padEnd(44), fs.statSync(out).size);
} catch (e) {
  console.log("export failed:", e.message);
}
a.exec("DROP TRIGGER IF EXISTS zz_t; DROP TABLE IF EXISTS zz_log; DROP TABLE IF EXISTS zz_check");
a.close();
b.close();
fs.rmSync(dir, { recursive: true, force: true });
console.log("Scratch tables removed.");
