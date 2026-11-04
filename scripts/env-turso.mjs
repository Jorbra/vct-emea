// On your computer, the address and token of the Turso database come from .env.turso (never sent anywhere else). On GitHub they are secrets.
import fs from "node:fs";

export function loadTursoEnv() {
  if (process.env.TURSO_DATABASE_URL) return;
  let text = "";
  try {
    text = fs.readFileSync(".env.turso", "utf8");
  } catch { /* set by the host */ }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(TURSO_[A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && m[2]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  if (!process.env.TURSO_DATABASE_URL) throw new Error("TURSO_DATABASE_URL is missing");
}
