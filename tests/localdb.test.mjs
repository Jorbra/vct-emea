// The database as a file on the server's disk, shared by the site and the background task.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDb } from "../lib/db.js";
import { dataDir } from "../lib/serverstatus.js";

test("local file: a second writer's transaction waits for the first instead of failing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vct-local-"));
  const file = path.join(dir, "vct.db");
  const a = openDb(file);
  const b = openDb(file);
  a.exec("CREATE TABLE IF NOT EXISTS t (n INTEGER)");
  // a transaction that reads then writes takes the write lock at its start
  b.exec("BEGIN IMMEDIATE");
  a.exec("PRAGMA busy_timeout = 0");
  assert.throws(() => a.transaction(() => a.prepare("INSERT INTO t (n) VALUES (1)").run())(), /locked|busy/i);
  b.exec("ROLLBACK");
  a.exec("PRAGMA busy_timeout = 10000");
  a.transaction(() => {
    a.prepare("SELECT COUNT(*) AS n FROM t").get();
    a.prepare("INSERT INTO t (n) VALUES (2)").run();
  })();
  assert.equal(b.prepare("SELECT COUNT(*) AS n FROM t").get().n, 1);
  a.close();
  b.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows may still hold the file */ }
});

test("server panel: the data folder is the database file's folder without Turso", () => {
  assert.equal(dataDir({ DATABASE_PATH: "/app/data/vct.db" }, () => false), "/app/data");
  assert.equal(dataDir({ TURSO_REPLICA_PATH: "/x/copie.db", DATABASE_PATH: "/app/data/vct.db" }, () => false), "/x");
});
