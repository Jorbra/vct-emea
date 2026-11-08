// News written in the editor, and visitors' predictions. Same contract as the other actions: { ok, message } or { ok: false, status, error }.
import crypto from "node:crypto";
import { allMatches } from "./matchlist.js";

export function fillCommunity(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS news (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, body TEXT NOT NULL, at TEXT NOT NULL, who TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS voters (hash TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, created TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS predictions (hash TEXT NOT NULL, event TEXT NOT NULL, id TEXT NOT NULL, pick TEXT NOT NULL, PRIMARY KEY (hash, event, id));
  `);
}

// --- news
export const listNews = (db, limit = 50) => db.prepare("SELECT id, title, body, at, who FROM news ORDER BY id DESC LIMIT ?").all(limit);
export const getNews = (db, id) => db.prepare("SELECT id, title, body, at, who FROM news WHERE id = ?").get(Number(id)) || null;

export function saveNews(db, { id, title, body, who = "" }) {
  const t = String(title ?? "").trim();
  const b = String(body ?? "").trim();
  if (!t || t.length > 120) return { ok: false, status: 400, error: "A title has 1 to 120 characters." };
  if (!b || b.length > 10000) return { ok: false, status: 400, error: "A text has 1 to 10000 characters." };
  if (id) {
    const r = db.prepare("UPDATE news SET title = ?, body = ? WHERE id = ?").run(t, b, Number(id));
    return r.changes ? { ok: true, message: "News saved." } : { ok: false, status: 404, error: "Unknown news." };
  }
  db.prepare("INSERT INTO news (title, body, at, who) VALUES (?, ?, ?, ?)").run(t, b, new Date().toISOString(), who);
  return { ok: true, message: "News published." };
}

export function removeNews(db, { id }) {
  const r = db.prepare("DELETE FROM news WHERE id = ?").run(Number(id));
  return r.changes ? { ok: true, message: "News removed." } : { ok: false, status: 404, error: "Unknown news." };
}

// --- predictions. A visitor is a secret token kept in the browser (only its hash is stored) and a public name.
const hashOf = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
const validToken = (t) => /^[A-Za-z0-9_-]{20,80}$/.test(String(t || ""));

/** Can this match still be predicted? Both teams known, no result, not live, its time not passed. */
export function openForPrediction(m, now = Date.now()) {
  return !!(m.a && m.b && m.a.name && m.b.name && m.sa == null && !m.live && (!m.at || new Date(m.at).getTime() > now));
}

/** Saves a visitor's pick (a team's name); the name is claimed the first time. */
export function savePrediction(db, state, { token, ...rest }, now = Date.now()) {
  if (!validToken(token)) return { ok: false, status: 400, error: "Reload the page and try again." };
  return savePredictionFor(db, state, { hash: hashOf(token), ...rest }, now);
}

/** The same, for a voter known by its hash (a Discord user playing from the bot). */
export function savePredictionFor(db, state, { hash, name, event, id, pick, score = "" }, now = Date.now()) {
  const known = db.prepare("SELECT name FROM voters WHERE hash = ?").get(hash);
  const n = String(name ?? "").trim();
  if (!known) {
    if (!/^[\p{L}\p{N} ._-]{2,20}$/u.test(n)) return { ok: false, status: 400, error: "A name has 2 to 20 letters or numbers." };
    if (db.prepare("SELECT 1 FROM voters WHERE name = ?").get(n)) return { ok: false, status: 409, error: "This name is already taken." };
  }
  const m = allMatches(state).find((x) => x.event === event && x.id === id);
  if (!m) return { ok: false, status: 404, error: "Unknown match." };
  if (!openForPrediction(m, now)) return { ok: false, status: 409, error: "Predictions for this match are closed." };
  if (pick !== m.a.name && pick !== m.b.name) return { ok: false, status: 400, error: "Pick one of the two teams." };
  // the score, the winner's maps first: "2-1"; only for a match of more than one map
  const sc = String(score || "");
  const need = Math.ceil((m.bo || 1) / 2);
  if (sc && !((m.bo || 1) > 1 && new RegExp(`^${need}-[0-${need - 1}]$`).test(sc))) return { ok: false, status: 400, error: "Unknown score." };
  db.transaction(() => {
    if (!known) db.prepare("INSERT INTO voters (hash, name, created) VALUES (?, ?, ?)").run(hash, n, new Date(now).toISOString());
    db.prepare("INSERT INTO predictions (hash, event, id, pick, score) VALUES (?, ?, ?, ?, ?) ON CONFLICT(hash, event, id) DO UPDATE SET pick = excluded.pick, score = excluded.score").run(hash, event, id, pick, sc);
  })();
  return { ok: true, message: "Prediction saved." };
}

/** What this visitor has picked: { name, picks: { "event:id": team } }. */
export function myPredictions(db, token) {
  if (!validToken(token)) return { name: "", picks: {} };
  const hash = hashOf(token);
  const voter = db.prepare("SELECT name FROM voters WHERE hash = ?").get(hash);
  const picks = {};
  const scores = {};
  for (const r of db.prepare("SELECT event, id, pick, score FROM predictions WHERE hash = ?").all(hash)) { picks[`${r.event}:${r.id}`] = r.pick; if (r.score) scores[`${r.event}:${r.id}`] = r.score; }
  return { name: voter ? voter.name : "", picks, scores };
}

/** The ranking: [{ name, good, total }], most good picks first, only over the matches that have a result. */
export function predictionRanking(db, state, limit = 50) {
  const winners = new Map();
  for (const m of allMatches(state)) {
    if (m.win) winners.set(`${m.event}:${m.id}`, (m.win === "a" ? m.a : m.b).name);
  }
  const rows = new Map(db.prepare("SELECT hash, name FROM voters").all().map((v) => [v.hash, { name: v.name, good: 0, total: 0 }]));
  for (const p of db.prepare("SELECT hash, event, id, pick FROM predictions").all()) {
    const w = winners.get(`${p.event}:${p.id}`);
    const r = rows.get(p.hash);
    if (!w || !r) continue;
    r.total += 1;
    if (w === p.pick) r.good += 1;
  }
  return [...rows.values()].filter((r) => r.total).sort((a, b) => b.good - a.good || a.total - b.total || a.name.localeCompare(b.name)).slice(0, limit);
}

export const listVoters = (db) => db.prepare("SELECT name, created FROM voters ORDER BY name").all();

/** Moderation: removes a visitor's name and picks. */
export function removeVoter(db, { name }) {
  const v = db.prepare("SELECT hash FROM voters WHERE name = ?").get(String(name ?? ""));
  if (!v) return { ok: false, status: 404, error: "Unknown account." };
  db.transaction(() => {
    db.prepare("DELETE FROM predictions WHERE hash = ?").run(v.hash);
    db.prepare("DELETE FROM voters WHERE hash = ?").run(v.hash);
  })();
  return { ok: true, message: "Participant removed." };
}
