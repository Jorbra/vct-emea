// For trying things on your computer: copies the online data to data/kickoff.db, which npm run dev uses. It only reads Turso, and what you
// do afterwards stays on your computer. It replaces the local copy: stop npm run dev first. Also creates .env.local, with test values, if missing.
// Run: npm run local-copy
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { loadTursoEnv } from "./env-turso.mjs";

const dataDir = path.join(process.cwd(), "data");
const target = path.join(dataDir, "kickoff.db");
fs.mkdirSync(dataDir, { recursive: true });
for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(target + suffix, { force: true });

loadTursoEnv();
const { getDb } = await import("../lib/db.js");
const db = getDb();
db.sync();
db.exec(`VACUUM INTO '${target.replace(/\\/g, "/").replace(/'/g, "''")}'`);
const size = Math.round(fs.statSync(target).size / 1024);
console.log(`Online data copied to data/kickoff.db (${size} KB).`);

if (!fs.existsSync(".env.local")) {
  const password = crypto.randomBytes(9).toString("base64url");
  const secret = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(".env.local", `# Only for trying the site on this computer. Never sent online.\nADMIN_PASSWORD=${password}\nSESSION_SECRET=${secret}\n`);
  console.log("Created .env.local: the test password is written in that file.");
}
console.log("Now run: npm run dev");
process.exit(0);
