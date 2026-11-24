// "Your team starts": an alert to the browsers that follow one of a match's teams, as soon as its time comes, even with the site closed.
// The background task (scripts/tick.mjs) looks every minute. It reads only the match times, and the one event whose match starts:
// the whole site's state takes some 18 seconds to read from Turso there, too slow to be on time.
import webpush from "web-push";
import { EVENTS } from "./bracket.js";
import { alertText } from "./discord.js";
import { REGIONS } from "./regional.js";
import { getKickoff, getQualifier, getRegional, listMatches, listTeams } from "./db.js";
import { matchesOf } from "./matchlist.js";
import { teamSlug } from "./paths.js";
import { readItems, saveItem } from "./lpstore.js";

export const START_SOON = 15 * 60000; // a match whose time passed longer ago than this rings no more: the regular alerts take it

// "" as the logos' folder: no logo is looked for (the alert shows none), which saves a query per team
const NO_LOGOS = "";

/** One event's data, as eventData() gives it from the whole state. */
function eventOf(db, event) {
  if (event === "playoffs") return { teams: listTeams(db, NO_LOGOS), matches: listMatches(db) };
  if (EVENTS.includes(event)) return getQualifier(db, event, NO_LOGOS);
  if (event === "kickoff") return getKickoff(db, NO_LOGOS);
  if (REGIONS.includes(event)) return getRegional(db, event, NO_LOGOS);
  return null;
}

/**
 * The matches whose time has just come, both teams known and no result yet: [{ key, event, id, at, a, b, bo, teams, url, kind }].
 * key is the one the regular alerts give a live match, so whichever looks first rings, and only once.
 */
export function dueStarts(db, now = Date.now()) {
  const due = db.prepare("SELECT event, id, at FROM mtimes").all().filter((r) => {
    const since = now - new Date(r.at).getTime();
    return since >= 0 && since < START_SOON;
  });
  if (!due.length) return [];
  const out = [];
  for (const event of [...new Set(due.map((r) => r.event))]) {
    const byId = Object.fromEntries(matchesOf(event, eventOf(db, event)).map((m) => [m.id, m]));
    for (const r of due.filter((x) => x.event === event)) {
      const m = byId[r.id];
      if (!m || m.sa != null || !(m.a && m.a.name && m.b && m.b.name)) continue;
      out.push({ key: `${event}:${r.id}:l`, kind: "live", event, id: r.id, at: r.at, a: m.a.name, b: m.b.name, bo: m.bo, teams: [teamSlug(m.a.name), teamSlug(m.b.name)], url: `/match/${event}/${r.id}` });
    }
  }
  return out;
}

/**
 * Sends each match that starts to the browsers following one of its teams (every browser that follows no team: it asked for every
 * match). A match is marked as sent before it leaves, so two servers never send it twice. `send` is replaced in the tests.
 */
export async function sendStartPushes(db, now, send) {
  const starts = dueStarts(db, now);
  if (!starts.length) return 0;
  db.exec(`CREATE TABLE IF NOT EXISTS pushed ("key" TEXT PRIMARY KEY)`);
  // the very first look of the regular alerts notes what is known already: not before it
  if (!db.prepare(`SELECT 1 FROM pushed LIMIT 1`).get()) return 0;
  const mark = db.prepare(`INSERT OR IGNORE INTO pushed ("key") VALUES (?)`);
  const fresh = starts.filter((a) => {
    const r = mark.run(a.key);
    mark.run(`${a.event}:${a.id}:t:${a.at}`); // nor "it is time" for the same start
    return r && typeof r.changes === "number" ? r.changes > 0 : true;
  });
  if (!fresh.length) return 0;
  const subs = db.prepare("SELECT endpoint, p256dh, auth, teams, lang FROM push_subs").all();
  const forget = db.prepare("DELETE FROM push_subs WHERE endpoint = ?");
  let sent = 0;
  const problems = [];
  for (const a of fresh) {
    for (const s of subs) {
      let teams = [];
      try { teams = JSON.parse(s.teams); } catch { /* every match */ }
      if (teams.length && !a.teams.some((t) => teams.includes(t))) continue;
      try {
        const body = alertText(a, s.lang || "fr").replace(/\*\*/g, "");
        await send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title: "VCT EMEA", body, tag: a.key, url: a.url }));
        sent++;
      } catch (e) {
        const code = e && e.statusCode;
        if (code === 404 || code === 410) forget.run(s.endpoint);
        else problems.push(`${(() => { try { return new URL(s.endpoint).hostname; } catch { return "?"; } })()}: ${code || (e && e.message)}`.slice(0, 120));
      }
    }
  }
  saveItem("meta", "push_start", { at: new Date(now).toISOString(), keys: fresh.map((a) => a.key).slice(0, 10), subs: subs.length, sent, problems: problems.slice(0, 5) }, db);
  return sent;
}

/** With the site's keys. */
export async function startPushNow(db, now = Date.now()) {
  const { vapidKeys } = await import("./push.js");
  const { publicKey, privateKey } = vapidKeys(db);
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const subject = process.env.PUSH_SUBJECT || (host ? `https://${host}` : "https://vct-emea.vercel.app");
  const options = { vapidDetails: { subject, publicKey, privateKey }, TTL: 1800, urgency: "high" };
  return sendStartPushes(db, now, (sub, payload) => webpush.sendNotification(sub, payload, options));
}

export const lastStartPush = (db) => readItems("meta", db).push_start || null;
