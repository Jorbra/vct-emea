// Posts to a Discord channel when a match goes live and when its result is in. Set DISCORD_WEBHOOK_URL to turn it on.
// The server compares the matches with what it already announced, so it works whichever way a match changed.
import { EVENT_NAMES } from "./paths.js";
import { allMatches } from "./matchlist.js";
import { teamSlug } from "./paths.js";

const name = (t) => (t && t.name) || "TBD";

/** What can be announced now: { key, text }. A result needs both teams, and live needs no result yet. */
export function announcements(state) {
  const out = [];
  for (const m of allMatches(state)) {
    if (!m.a || !m.b || !m.a.name || !m.b.name) continue;
    const where = `${EVENT_NAMES[m.event]}`;
    const teams = [teamSlug(m.a.name), teamSlug(m.b.name)];
    if (m.sa != null && m.sb != null) {
      // the score is in the key: a corrected result is announced again
      out.push({ teams, key: `${m.event}:${m.id}:r:${m.sa}-${m.sb}`, text: `✅ **${name(m.a)} ${m.sa} – ${m.sb} ${name(m.b)}** · ${where}` });
    } else if (m.live) {
      out.push({ teams, key: `${m.event}:${m.id}:l`, text: `🔴 **EN DIRECT : ${name(m.a)} vs ${name(m.b)}** · ${where} (Bo${m.bo})` });
    }
  }
  return out;
}

export function fillAnnounced(db) {
  db.exec("CREATE TABLE IF NOT EXISTS announced (key TEXT PRIMARY KEY)");
}

/** The ones not announced yet, all marked as announced. The first time, nothing is posted: only what happens from now on. */
export function nextAnnouncements(db, state) {
  fillAnnounced(db);
  const first = !db.prepare("SELECT 1 FROM announced LIMIT 1").get();
  const has = db.prepare("SELECT 1 FROM announced WHERE key = ?");
  const fresh = announcements(state).filter((a) => !has.get(a.key));
  const mark = db.prepare("INSERT OR IGNORE INTO announced (key) VALUES (?)");
  db.transaction(() => {
    if (first) mark.run("started");
    fresh.forEach((a) => mark.run(a.key));
  })();
  return first ? [] : fresh;
}

export const isWebhook = (url) => /^https:\/\/(?:\w+\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(url || "");

/** Posts what is new, one message per announcement: called by the regular round on GitHub (scripts/worker.mjs). */
export async function announceOnce(getState, getDb, url = process.env.DISCORD_WEBHOOK_URL) {
  if (!url) return;
  if (!isWebhook(url)) {
    console.log("[discord] DISCORD_WEBHOOK_URL is not a Discord webhook address");
    return;
  }
  try {
    for (const a of nextAnnouncements(getDb(), getState())) {
      await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: a.text, allowed_mentions: { parse: [] } }) });
    }
  } catch (e) {
    console.log(`[discord] ${e.message}`);
  }
}
