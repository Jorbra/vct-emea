// Comments under the matches, the site's own page views, and the editors' devices that get the health alerts.
import crypto from "node:crypto";
import { allMatches } from "./matchlist.js";

const fail = (status, error) => ({ ok: false, status, error });
const hashOf = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
const validToken = (t) => /^[A-Za-z0-9_-]{20,80}$/.test(String(t || ""));
const MAX_LEN = 280;
const GAP_MS = 20000;

export function fillSocial(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT NOT NULL, mid TEXT NOT NULL, hash TEXT NOT NULL, name TEXT NOT NULL, body TEXT NOT NULL, at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS comments_match ON comments (event, mid);
    CREATE TABLE IF NOT EXISTS visits (day TEXT NOT NULL, path TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, path));
    CREATE TABLE IF NOT EXISTS health_subs (endpoint TEXT PRIMARY KEY, p256dh TEXT NOT NULL, auth TEXT NOT NULL, who TEXT NOT NULL DEFAULT '', at TEXT NOT NULL);`);
}

// ---- comments

/** A match's comments, oldest first: [{ id, name, body, at }]. */
export const listComments = (db, event, mid) => db.prepare("SELECT id, name, body, at FROM comments WHERE event = ? AND mid = ? ORDER BY id DESC LIMIT 100").all(event, mid).reverse();

/** The latest comments of the whole site, for the editors. */
export const latestComments = (db, limit = 50) => db.prepare("SELECT id, event, mid, name, body, at FROM comments ORDER BY id DESC LIMIT ?").all(limit);

/** Plain text, one line breaks kept, links' addresses kept as text. Needs the visitor's name from the predictions. */
export function addComment(db, state, { token, event, mid, body }, now = Date.now()) {
  if (!validToken(token)) return fail(400, "Reload the page and try again.");
  const hash = hashOf(token);
  const voter = db.prepare("SELECT name FROM voters WHERE hash = ?").get(hash);
  if (!voter) return fail(409, "Make a first prediction to get your name, then comment.");
  if (!allMatches(state).some((m) => m.event === event && m.id === mid && m.a && m.b)) return fail(404, "Unknown match.");
  const text = String(body ?? "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "").trim();
  if (!text) return fail(400, "Write something first.");
  if (text.length > MAX_LEN) return fail(400, `${MAX_LEN} characters at most.`);
  const last = db.prepare("SELECT at FROM comments WHERE hash = ? ORDER BY id DESC LIMIT 1").get(hash);
  if (last && now - new Date(last.at).getTime() < GAP_MS) return fail(429, "Wait a few seconds before the next comment.");
  db.prepare("INSERT INTO comments (event, mid, hash, name, body, at) VALUES (?, ?, ?, ?, ?, ?)").run(event, mid, hash, voter.name, text, new Date(now).toISOString());
  return { ok: true, message: "Comment posted." };
}

/** The editors' moderation. */
export function removeComment(db, { id }) {
  const r = db.prepare("DELETE FROM comments WHERE id = ?").run(Number(id));
  return r.changes ? { ok: true, message: "Comment removed." } : fail(404, "Unknown comment.");
}

// ---- page views: a counter per day and page, nothing about the visitor

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|monitor|curl|wget|python|node-fetch/i;
const PAGES = /^\/(|calendar|predictions|live|stats|soiree|moi|quiz|puissance|transfers|lft|compare|news(\/\d+)?|archives|compte|about|parcours|vctemea\/[a-z0-9/-]+|gc\/[a-z0-9/-]+|team\/[a-z0-9-]+|player\/[a-z0-9-]+|match\/[a-z0-9]+\/[a-z0-9-]+|recap\/[a-z0-9]+|map\/[a-z0-9-]+|tournament\/[^?#]{1,120})$/i;

/** The page's address as counted: no query, no trailing slash; "" when it is not one of the site's pages. */
export function countedPath(path) {
  const p = String(path || "").split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  if (p.length > 140) return "";
  return PAGES.test(p === "/" ? "/" : p) ? p.toLowerCase() : "";
}

export function countVisit(db, { path, ua }, now = Date.now()) {
  if (BOT.test(String(ua || ""))) return false;
  const p = countedPath(path);
  if (!p) return false;
  const day = new Date(now).toISOString().slice(0, 10);
  db.prepare("INSERT INTO visits (day, path, n) VALUES (?, ?, 1) ON CONFLICT (day, path) DO UPDATE SET n = n + 1").run(day, p);
  return true;
}

/** For the editors: { days: [{ day, n }] (last 14, oldest first), pages: [{ path, n }] (last 7 days), today, week }. */
export function visitReport(db, now = Date.now()) {
  const day = (d) => new Date(now - d * 86400000).toISOString().slice(0, 10);
  const byDay = Object.fromEntries(db.prepare("SELECT day, SUM(n) AS n FROM visits WHERE day >= ? GROUP BY day").all(day(13)).map((r) => [r.day, r.n]));
  const days = Array.from({ length: 14 }, (_, i) => ({ day: day(13 - i), n: byDay[day(13 - i)] || 0 }));
  const pages = db.prepare("SELECT path, SUM(n) AS n FROM visits WHERE day >= ? GROUP BY path ORDER BY n DESC LIMIT 15").all(day(6));
  // older than 90 days: no longer needed
  db.prepare("DELETE FROM visits WHERE day < ?").run(day(90));
  return { days, pages, today: days[13].n, week: days.slice(7).reduce((s, d) => s + d.n, 0) };
}

// ---- the editors' devices for the health alerts

export function saveHealthSub(db, { endpoint, keys, who = "" }, isPushEndpoint) {
  if (!isPushEndpoint(endpoint) || !keys || !keys.p256dh || !keys.auth) return fail(400, "Unknown push service.");
  db.prepare("INSERT INTO health_subs (endpoint, p256dh, auth, who, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, who = excluded.who")
    .run(endpoint, String(keys.p256dh).slice(0, 200), String(keys.auth).slice(0, 200), String(who).slice(0, 40), new Date().toISOString());
  return { ok: true, message: "This device will be told when something stops working." };
}

export function removeHealthSub(db, endpoint) {
  db.prepare("DELETE FROM health_subs WHERE endpoint = ?").run(String(endpoint || ""));
  return { ok: true, message: "This device will no longer be told." };
}

/** What is wrong now: [{ key, text }]. A part late, or a problem in the last hour. */
export function healthProblems(rows, now = Date.now()) {
  const NAMES = { cron: "cron-job.org", toornament: "Toornament", vlr: "vlr.gg", liquipedia: "Liquipedia", alerts: "Alertes", regular: "Visites" };
  const out = [];
  for (const r of rows) {
    if (r.late && r.at && ["cron", "toornament"].includes(r.part)) out.push({ key: `late:${r.part}:${r.at}`, text: `${NAMES[r.part]} : rien depuis ${new Date(r.at).toLocaleString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` });
    if (r.problem && r.problem.at && now - new Date(r.problem.at).getTime() < 3600000) out.push({ key: `err:${r.part}:${r.problem.at}`, text: `${NAMES[r.part]} : ${r.problem.message}`.slice(0, 180) });
  }
  return out;
}

/** Sends each new problem once to the editors' devices. `sent`: the keys already sent; returns the new list of keys. */
export async function sendHealthAlerts(db, problems, sent, send) {
  const fresh = problems.filter((p) => !sent.includes(p.key));
  if (!fresh.length) return sent;
  const subs = db.prepare("SELECT endpoint, p256dh, auth FROM health_subs").all();
  const body = fresh.map((p) => p.text).join(" · ").slice(0, 300);
  for (const s of subs) {
    try {
      await send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title: "VCT EMEA · santé du site", body, tag: "health", url: "/admin" }));
    } catch (e) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) db.prepare("DELETE FROM health_subs WHERE endpoint = ?").run(s.endpoint);
    }
  }
  return [...sent, ...fresh.map((p) => p.key)].slice(-50);
}
