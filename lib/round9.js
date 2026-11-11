// Round 9: the MVP of each event to predict, the fans' avatar and colour, the teams with no logo, many scores at once,
// the qualified teams to announce, and what an event page shows in its header.
import crypto from "node:crypto";
import { EVENTS } from "./bracket.js";
import { EVENT_NAMES } from "./paths.js";
import { parseRoster } from "./tournament.js";

const fail = (status, error) => ({ ok: false, status, error });
const hashOf = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
const validToken = (t) => /^[A-Za-z0-9_-]{20,80}$/.test(String(t || ""));

export function fillRound9(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS mvp_picks (hash TEXT NOT NULL, event TEXT NOT NULL, player TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY (hash, event));
    CREATE TABLE IF NOT EXISTS voter_style (hash TEXT PRIMARY KEY, emoji TEXT NOT NULL DEFAULT '', color TEXT NOT NULL DEFAULT '');`);
}

// ---- A2. the MVP of an event

/** The events whose MVP can be predicted: the qualifiers with teams, open until their first match. [{ event, name, open, players, mvp }]. */
export function mvpEvents(state, recaps, now = Date.now()) {
  const out = [];
  for (const event of EVENTS) {
    const q = state.qualifiers && state.qualifiers[event];
    if (!q || !q.slots.some(Boolean)) continue;
    const times = Object.values((state.times && state.times[event]) || {}).sort();
    const started = Object.keys(q.scores || {}).length > 0 || (times[0] && new Date(times[0]).getTime() <= now);
    const r = recaps[event];
    const players = [...new Set(q.slots.filter(Boolean).flatMap((t) => parseRoster(t.roster).map((p) => p.name)))].sort((a, b) => a.localeCompare(b)).slice(0, 2000);
    out.push({ event, name: EVENT_NAMES[event] || event, open: !started, players, mvp: r && r.done && r.top && r.top[0] ? r.top[0].name : "" });
  }
  return out;
}

export function saveMvpPick(db, events, { token, event, player }, now = Date.now()) {
  if (!validToken(token)) return fail(400, "Reload the page and try again.");
  const hash = hashOf(token);
  if (!db.prepare("SELECT 1 FROM voters WHERE hash = ?").get(hash)) return fail(409, "Make a first prediction to get your name first.");
  const e = events.find((x) => x.event === event);
  if (!e || !e.open) return fail(409, "The MVP of this event can no longer be predicted.");
  const p = String(player || "").trim();
  if (!e.players.includes(p)) return fail(400, "Pick a player of the event.");
  db.prepare("INSERT INTO mvp_picks (hash, event, player, at) VALUES (?, ?, ?, ?) ON CONFLICT (hash, event) DO UPDATE SET player = excluded.player, at = excluded.at").run(hash, event, p, new Date(now).toISOString());
  return { ok: true, message: "MVP pick saved." };
}

export const myMvpPicks = (db, token) => (validToken(token) ? Object.fromEntries(db.prepare("SELECT event, player FROM mvp_picks WHERE hash = ?").all(hashOf(token)).map((r) => [r.event, r.player])) : {});

/** Right MVP picks per voter: Map(hash → count), from the events finished. */
export function mvpGood(db, events) {
  const mvp = new Map(events.filter((e) => e.mvp).map((e) => [e.event, e.mvp.toLowerCase()]));
  const out = new Map();
  for (const r of db.prepare("SELECT hash, event, player FROM mvp_picks").all()) if (mvp.get(r.event) === r.player.toLowerCase()) out.set(r.hash, (out.get(r.hash) || 0) + 1);
  return out;
}

// ---- A5. a fan's avatar and colour

export const EMOJIS = ["🎯", "🔥", "⚡", "👑", "🐍", "🦊", "🐺", "🦅", "💎", "🎮", "🧠", "🛡️", "⚔️", "🌙", "☀️", "🍀"];
export const COLORS = ["#ff4655", "#c8f03c", "#5aa9ff", "#a78bfa", "#f2a63b", "#3ecf8e", "#ec4899", "#e8e8e6"];

export function saveStyle(db, { token, emoji, color }) {
  if (!validToken(token)) return fail(400, "Reload the page and try again.");
  const hash = hashOf(token);
  if (!db.prepare("SELECT 1 FROM voters WHERE hash = ?").get(hash)) return fail(409, "Make a first prediction to get your name first.");
  const e = EMOJIS.includes(emoji) ? emoji : "";
  const c = COLORS.includes(color) ? color : "";
  db.prepare("INSERT INTO voter_style (hash, emoji, color) VALUES (?, ?, ?) ON CONFLICT (hash) DO UPDATE SET emoji = excluded.emoji, color = excluded.color").run(hash, e, c);
  return { ok: true, message: "Profile saved." };
}

export const myStyle = (db, token) => (validToken(token) ? db.prepare("SELECT emoji, color FROM voter_style WHERE hash = ?").get(hashOf(token)) || { emoji: "", color: "" } : { emoji: "", color: "" });

/** Every fan's style by name: { name: { emoji, color } }. */
export const stylesByName = (db) => Object.fromEntries(db.prepare("SELECT v.name, s.emoji, s.color FROM voter_style s JOIN voters v ON v.hash = s.hash").all().map((r) => [r.name, { emoji: r.emoji, color: r.color }]));

export { missingLogos, openMatches, qualifiedTeams, eventNumbers } from "./r9pure.js";
