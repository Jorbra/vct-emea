// The site's version: the build that is running (Next.js writes a new .next/BUILD_ID at each build), and when it was built.
// The editors' update notice (components/UpdateNotice.jsx) compares it with the one they saw last.
import fs from "node:fs";
import path from "node:path";

let cached = null;

/** { id, at } of the running build; { id: "dev", at: start time } when there is none (next dev). */
export function siteVersion() {
  if (cached) return cached;
  try {
    const file = path.join(process.cwd(), ".next", "BUILD_ID");
    cached = { id: fs.readFileSync(file, "utf8").trim(), at: fs.statSync(file).mtime.toISOString() };
  } catch {
    cached = { id: "dev", at: new Date().toISOString() };
  }
  return cached;
}

/** The log's lines of the updates put online after `since` (ISO), newest first, 12 at most. */
export function entriesSince(entries, since) {
  const t = Date.parse(since || "");
  if (!Number.isFinite(t)) return [];
  return (entries || []).filter((e) => Date.parse(e.at) > t).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
}
