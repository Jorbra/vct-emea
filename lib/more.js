// Round 5: predicting the next map of a live match, the check before an event, going back to before a given change,
// and the bot's reminders.
import crypto from "node:crypto";
import { allMatches } from "./matchlist.js";
import { parseRoster } from "./tournament.js";
import { EVENT_NAMES } from "./paths.js";

const fail = (status, error) => ({ ok: false, status, error });
const hashOf = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
const validToken = (t) => /^[A-Za-z0-9_-]{20,80}$/.test(String(t || ""));

export function fillMore(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS map_picks (hash TEXT NOT NULL, event TEXT NOT NULL, id TEXT NOT NULL, map INTEGER NOT NULL, pick TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY (hash, event, id, map));
    CREATE TABLE IF NOT EXISTS bot_reminders (user TEXT NOT NULL, event TEXT NOT NULL, id TEXT NOT NULL, label TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY (user, event, id));`);
}

// ---- 3. the next map of a live match

/** The map that can be predicted now: the one after those already won (1, 2, …), while the series is not decided. null otherwise. */
export function openMap(m, live) {
  if (!m || !m.live || !live || (m.bo || 1) < 2) return null;
  const need = Math.ceil(m.bo / 2);
  const a = live.a || 0;
  const b = live.b || 0;
  if (a >= need || b >= need) return null;
  return a + b + 1;
}

export function saveMapPick(db, state, { token, event, id, map, pick }, now = Date.now()) {
  if (!validToken(token)) return fail(400, "Reload the page and try again.");
  const hash = hashOf(token);
  if (!db.prepare("SELECT 1 FROM voters WHERE hash = ?").get(hash)) return fail(409, "Make a first prediction to get your name first.");
  const m = allMatches(state).find((x) => x.event === event && x.id === id);
  const open = openMap(m, m && (state.live[event] || {})[id]);
  if (!open || Number(map) !== open) return fail(409, "This map can no longer be predicted.");
  if (pick !== m.a.name && pick !== m.b.name) return fail(400, "Pick one of the two teams.");
  db.prepare("INSERT INTO map_picks (hash, event, id, map, pick, at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (hash, event, id, map) DO UPDATE SET pick = excluded.pick, at = excluded.at")
    .run(hash, event, id, open, pick, new Date(now).toISOString());
  return { ok: true, message: "Prediction saved." };
}

export const myMapPick = (db, token, event, id, map) => (validToken(token) ? (db.prepare("SELECT pick FROM map_picks WHERE hash = ? AND event = ? AND id = ? AND map = ?").get(hashOf(token), event, id, Number(map)) || {}).pick || "" : "");

/** Right map predictions per voter, from the maps saved for the finished matches: Map(hash → count). */
export function mapPickGood(db, state) {
  const winners = new Map();
  for (const m of allMatches(state)) {
    if (m.sa == null || !m.a || !m.b) continue;
    const maps = ((state.extra[m.event] || {})[m.id] || {}).maps || [];
    maps.forEach((x, i) => { if (x.a != null && x.b != null && x.a !== x.b) winners.set(`${m.event}:${m.id}:${i + 1}`, x.a > x.b ? m.a.name : m.b.name); });
  }
  const out = new Map();
  for (const p of db.prepare("SELECT hash, event, id, map, pick FROM map_picks").all()) {
    if (winners.get(`${p.event}:${p.id}:${p.map}`) === p.pick) out.set(p.hash, (out.get(p.hash) || 0) + 1);
  }
  return out;
}

// ---- 7. what is missing before an event

/** For each event starting within 7 days or under way: [{ event, name, issues: [{ kind, text, count }] }]. Pure. */
export function eventChecklist(state, now = Date.now()) {
  const out = [];
  for (const [event, name] of Object.entries(EVENT_NAMES)) {
    const info = (state.info && state.info[event]) || {};
    const ms = allMatches(state).filter((m) => m.event === event);
    const times = ms.map((m) => m.at).filter(Boolean).sort();
    const start = times[0] ? new Date(times[0]).getTime() : info.start ? new Date(`${info.start}T00:00:00`).getTime() : 0;
    if (!start || start - now > 7 * 86400000) continue;
    if (ms.length && ms.every((m) => m.sa != null)) continue;
    const teams = new Map();
    for (const m of ms) for (const t of [m.a, m.b]) if (t && t.name) teams.set(t.name, t);
    const list = [...teams.values()];
    const ready = ms.filter((m) => m.a && m.b && m.sa == null);
    const issues = [
      { kind: "logo", text: "Teams without a logo", count: list.filter((t) => !t.logo).length, items: list.filter((t) => !t.logo).map((t) => t.name).slice(0, 12) },
      { kind: "roster", text: "Teams without a roster", count: list.filter((t) => !parseRoster(t.roster).length).length, items: list.filter((t) => !parseRoster(t.roster).length).map((t) => t.name).slice(0, 12) },
      { kind: "time", text: "Matches without a time", count: ready.filter((m) => !m.at).length, items: [] },
      { kind: "stream", text: "No stream link for the event", count: info.stream ? 0 : 1, items: [] },
      { kind: "teams", text: "No team yet", count: list.length ? 0 : 1, items: [] },
    ].filter((x) => x.count > 0);
    out.push({ event, name, start: new Date(start).toISOString(), issues });
  }
  return out;
}

// ---- 6. going back to before a given change (and every change made after it)

export const listSteps = (db, limit = 40) => db.prepare("SELECT step, label, who, at FROM undosteps ORDER BY step DESC LIMIT ?").all(limit);

export function undoTo(db, step, who = "", now = new Date()) {
  const target = db.prepare("SELECT step, label FROM undosteps WHERE step = ?").get(Number(step));
  if (!target) return fail(404, "This change can no longer be undone.");
  const n = db.prepare("SELECT COUNT(*) AS n FROM undosteps WHERE step >= ?").get(target.step).n;
  db.transaction(() => {
    db.prepare("UPDATE undostate SET off = 1").run();
    for (const { sql } of db.prepare("SELECT sql FROM undolog WHERE step >= ? ORDER BY seq DESC").all(target.step)) db.prepare(sql).run();
    db.prepare("DELETE FROM undolog WHERE step >= ?").run(target.step);
    db.prepare("DELETE FROM undosteps WHERE step >= ?").run(target.step);
    db.prepare("UPDATE undostate SET off = 0").run();
    db.prepare("INSERT INTO history (at, who, message) VALUES (?, ?, ?)").run(now.toISOString(), who, `Undone back to before: ${target.label} (${n})`);
  })();
  return { ok: true, message: `${n} change(s) undone.`, count: n };
}

// ---- 8. the bot's reminders

export function addReminder(db, user, m, now = Date.now()) {
  if (!m || !m.at || new Date(m.at).getTime() <= now + 60000) return fail(409, "This match has no time to come.");
  if (db.prepare("SELECT COUNT(*) AS n FROM bot_reminders WHERE user = ?").get(user).n >= 20) return fail(409, "20 reminders at most.");
  db.prepare("INSERT INTO bot_reminders (user, event, id, label, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (user, event, id) DO UPDATE SET at = excluded.at, label = excluded.label")
    .run(user, m.event, m.id, `${m.a.name} vs ${m.b.name}`, m.at);
  return { ok: true };
}

/** The reminders due now (the match starts within 15 minutes), taken off the list. */
export function takeDueReminders(db, now = Date.now()) {
  const due = db.prepare("SELECT user, event, id, label, at FROM bot_reminders WHERE at <= ?").all(new Date(now + 15 * 60000).toISOString());
  for (const r of due) db.prepare("DELETE FROM bot_reminders WHERE user = ? AND event = ? AND id = ?").run(r.user, r.event, r.id);
  return due.filter((r) => new Date(r.at).getTime() > now - 30 * 60000);
}
