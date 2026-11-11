// "Who qualifies?": before a qualifier starts, a visitor picks the teams that go through and the winner. Same names as the predictions.
import crypto from "node:crypto";
import { EVENTS, buildBracket, qualifiedOf } from "./bracket.js";

export const QUALIFY = { q1: 4, q2: 4, trq1: 2, trq2: 2, meq1: 1, meq2: 1, naq1: 1, naq2: 1 };
const fail = (status, error) => ({ ok: false, status, error });
const hashOf = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
const validToken = (t) => /^[A-Za-z0-9_-]{20,80}$/.test(String(t || ""));

export function fillPickem(db) {
  db.exec("CREATE TABLE IF NOT EXISTS pickem (hash TEXT NOT NULL, event TEXT NOT NULL, picks TEXT NOT NULL, champion TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY (hash, event))");
}

/** Where each qualifier stands: [{ event, n, teams, open, firstAt, done, qualified, champion }], those with teams only. */
export function pickemEvents(state, now = Date.now()) {
  const out = [];
  for (const event of EVENTS) {
    const q = state.qualifiers && state.qualifiers[event];
    const n = QUALIFY[event];
    if (!q || !n) continue;
    const teams = q.slots.filter(Boolean).map((t) => t.name);
    if (teams.length <= n) continue;
    const times = Object.values((state.times && state.times[event]) || {}).sort();
    const firstAt = times[0] || "";
    const started = Object.keys(q.scores || {}).length > 0 || (firstAt && new Date(firstAt).getTime() <= now);
    const top = qualifiedOf(buildBracket(q.slots, q.scores, q.bo), n).map((s) => (s && q.slots[s - 1] ? q.slots[s - 1].name : ""));
    const done = top.every(Boolean);
    out.push({ event, n, teams, open: !started, firstAt, done, qualified: done ? top : [], champion: done ? top[0] : "" });
  }
  return out;
}

/** Saves a visitor's picks while the event has not started. The name is claimed the first time, as for the predictions. */
export function savePickem(db, state, { token, name, event, picks, champion }, now = Date.now()) {
  if (!validToken(token)) return fail(400, "Reload the page and try again.");
  const ev = pickemEvents(state, now).find((e) => e.event === event);
  if (!ev) return fail(404, "Unknown event.");
  if (!ev.open) return fail(409, "Picks for this event are closed.");
  const list = [...new Set((Array.isArray(picks) ? picks : []).map((x) => String(x)))];
  if (list.length !== ev.n || !list.every((t) => ev.teams.includes(t))) return fail(400, ev.n === 1 ? "Pick one team." : `Pick ${ev.n} different teams.`);
  const champ = ev.n === 1 ? list[0] : String(champion || "");
  if (!list.includes(champ)) return fail(400, "The winner must be one of your teams.");
  const hash = hashOf(token);
  const known = db.prepare("SELECT name FROM voters WHERE hash = ?").get(hash);
  const n = String(name ?? "").trim();
  if (!known) {
    if (!/^[\p{L}\p{N} ._-]{2,20}$/u.test(n)) return fail(400, "A name has 2 to 20 letters or numbers.");
    if (db.prepare("SELECT 1 FROM voters WHERE name = ?").get(n)) return fail(409, "This name is already taken.");
  }
  db.transaction(() => {
    if (!known) db.prepare("INSERT INTO voters (hash, name, created) VALUES (?, ?, ?)").run(hash, n, new Date(now).toISOString());
    db.prepare("INSERT INTO pickem (hash, event, picks, champion, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (hash, event) DO UPDATE SET picks = excluded.picks, champion = excluded.champion, at = excluded.at")
      .run(hash, event, JSON.stringify(list), champ, new Date(now).toISOString());
  })();
  return { ok: true, message: "Picks saved." };
}

/** A visitor's picks: { event: { picks, champion } }. */
export function myPickem(db, token) {
  if (!validToken(token)) return {};
  const out = {};
  for (const r of db.prepare("SELECT event, picks, champion FROM pickem WHERE hash = ?").all(hashOf(token))) out[r.event] = { picks: JSON.parse(r.picks), champion: r.champion };
  return out;
}

/** Points: one per team that went through, two more for the winner (three when a single team goes through). */
export function pickemPoints(entry, ev) {
  if (!ev.done) return null;
  const right = entry.picks.filter((t) => ev.qualified.includes(t)).length;
  if (ev.n === 1) return right * 3;
  return right + (entry.champion === ev.champion ? 2 : 0);
}

/** For each event: how many took part, and once it is over, the ranking. { event: { count, ranking: [{ name, points }] } } */
export function pickemBoards(db, events) {
  const out = {};
  for (const ev of events) {
    const rows = db.prepare("SELECT v.name, p.picks, p.champion FROM pickem p JOIN voters v ON v.hash = p.hash WHERE p.event = ?").all(ev.event);
    out[ev.event] = {
      count: rows.length,
      ranking: ev.done ? rows.map((r) => ({ name: r.name, points: pickemPoints({ picks: JSON.parse(r.picks), champion: r.champion }, ev) })).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name)).slice(0, 50) : [],
    };
  }
  return out;
}
