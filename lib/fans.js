// What visitors do together: the player of the match vote, friends' groups for the predictions, and the season ranking with its badges.
import crypto from "node:crypto";
import { allMatches } from "./matchlist.js";
import { parseRoster } from "./tournament.js";
import { pickemBoards, pickemEvents, pickemPoints } from "./pickem.js";
import { mapPickGood } from "./more.js";

const fail = (status, error) => ({ ok: false, status, error });
const hashOf = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
const validToken = (t) => /^[A-Za-z0-9_-]{20,80}$/.test(String(t || ""));
const VOTE_DAYS = 7;

export function fillFans(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS motm (hash TEXT NOT NULL, event TEXT NOT NULL, id TEXT NOT NULL, player TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY (hash, event, id));
    CREATE TABLE IF NOT EXISTS pgroups (code TEXT PRIMARY KEY, name TEXT NOT NULL, owner TEXT NOT NULL, created TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS pgroup_members (code TEXT NOT NULL, hash TEXT NOT NULL, PRIMARY KEY (code, hash));`);
}

// ---- player of the match

/** Who can be voted for: the players of vlr.gg's table, else the two rosters. */
export function motmCandidates(m, details) {
  const fromTable = ((details && details.all) || []).filter((r) => r.name).map((r) => r.name);
  if (fromTable.length) return [...new Set(fromTable)];
  return [...new Set([...parseRoster(m.a && m.a.roster), ...parseRoster(m.b && m.b.roster)].map((p) => p.name))];
}

/** The votes: { total, counts: [{ player, n }] }, most first. */
export function motmResults(db, event, id) {
  const counts = db.prepare("SELECT player, COUNT(*) AS n FROM motm WHERE event = ? AND id = ? GROUP BY player ORDER BY n DESC, player").all(event, id);
  return { total: counts.reduce((s, c) => s + c.n, 0), counts };
}

/** One vote per visitor and match, which they can change, during the week after the match. */
export function voteMotm(db, state, { token, event, id, player }, details, now = Date.now()) {
  if (!validToken(token)) return fail(400, "Reload the page and try again.");
  const m = allMatches(state).find((x) => x.event === event && x.id === id);
  if (!m || m.sa == null || m.sb == null) return fail(409, "The vote opens once the match is over.");
  const at = m.at ? new Date(m.at).getTime() : 0;
  if (at && now - at > VOTE_DAYS * 86400000) return fail(409, "The vote for this match is closed.");
  const p = String(player || "");
  if (!motmCandidates(m, details).includes(p)) return fail(400, "Unknown player.");
  db.prepare("INSERT INTO motm (hash, event, id, player, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (hash, event, id) DO UPDATE SET player = excluded.player, at = excluded.at")
    .run(hashOf(token), event, id, p, new Date(now).toISOString());
  return { ok: true, message: "Vote saved." };
}

export const myMotm = (db, token, event, id) => (validToken(token) ? (db.prepare("SELECT player FROM motm WHERE hash = ? AND event = ? AND id = ?").get(hashOf(token), event, id) || {}).player || "" : "");

// ---- friends' groups

const CODE_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";
const newCode = () => Array.from(crypto.randomBytes(8), (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
const validCode = (c) => /^[a-z0-9]{8}$/.test(String(c || ""));

/** A group needs a name in the predictions: its members are shown by it. */
export function createGroup(db, { token, name }, now = Date.now()) {
  if (!validToken(token)) return fail(400, "Reload the page and try again.");
  const hash = hashOf(token);
  if (!db.prepare("SELECT 1 FROM voters WHERE hash = ?").get(hash)) return fail(409, "Make a first prediction to get your name, then create the group.");
  const n = String(name ?? "").trim();
  if (!/^[\p{L}\p{N} ._'!-]{2,30}$/u.test(n)) return fail(400, "A group name has 2 to 30 letters or numbers.");
  if (db.prepare("SELECT COUNT(*) AS n FROM pgroups WHERE owner = ?").get(hash).n >= 10) return fail(409, "You have made 10 groups already.");
  const code = newCode();
  db.transaction(() => {
    db.prepare("INSERT INTO pgroups (code, name, owner, created) VALUES (?, ?, ?, ?)").run(code, n, hash, new Date(now).toISOString());
    db.prepare("INSERT INTO pgroup_members (code, hash) VALUES (?, ?)").run(code, hash);
  })();
  return { ok: true, message: "Group created.", code };
}

export function joinGroup(db, { token, code }) {
  if (!validToken(token)) return fail(400, "Reload the page and try again.");
  if (!validCode(code) || !db.prepare("SELECT 1 FROM pgroups WHERE code = ?").get(code)) return fail(404, "This group does not exist.");
  const hash = hashOf(token);
  if (!db.prepare("SELECT 1 FROM voters WHERE hash = ?").get(hash)) return fail(409, "Make a first prediction to get your name, then join the group.");
  if (db.prepare("SELECT COUNT(*) AS n FROM pgroup_members WHERE code = ?").get(code).n >= 200) return fail(409, "This group is full.");
  db.prepare("INSERT OR IGNORE INTO pgroup_members (code, hash) VALUES (?, ?)").run(code, hash);
  return { ok: true, message: "You joined the group." };
}

/** Leaving: the last one out removes the group. */
export function leaveGroup(db, { token, code }) {
  if (!validToken(token) || !validCode(code)) return fail(400, "Unknown group.");
  db.transaction(() => {
    db.prepare("DELETE FROM pgroup_members WHERE code = ? AND hash = ?").run(code, hashOf(token));
    if (!db.prepare("SELECT 1 FROM pgroup_members WHERE code = ?").get(code)) db.prepare("DELETE FROM pgroups WHERE code = ?").run(code);
  })();
  return { ok: true, message: "You left the group." };
}

export const myGroups = (db, token) => (validToken(token)
  ? db.prepare("SELECT g.code, g.name, (SELECT COUNT(*) FROM pgroup_members x WHERE x.code = g.code) AS count FROM pgroups g JOIN pgroup_members m ON m.code = g.code WHERE m.hash = ? ORDER BY g.name").all(hashOf(token))
  : []);

export function groupInfo(db, code) {
  if (!validCode(code)) return null;
  const g = db.prepare("SELECT code, name FROM pgroups WHERE code = ?").get(code);
  if (!g) return null;
  return { ...g, hashes: db.prepare("SELECT hash FROM pgroup_members WHERE code = ?").all(code).map((r) => r.hash) };
}

// ---- the season ranking

/**
 * Everyone's season: [{ name, good, total, pickem, points, streak, badges }], most points first. Points: a right prediction is worth 1,
 * "Who qualifies?" its own points. only: the voters to keep (a group), by hash.
 */
export function seasonRanking(db, state, { limit = 50, only = null, now = Date.now(), withHash = false } = {}) {
  const matches = new Map();
  for (const m of allMatches(state)) {
    if (!m.win) continue;
    const exact = !m.note && m.sa != null && m.sb != null ? `${Math.max(m.sa, m.sb)}-${Math.min(m.sa, m.sb)}` : "";
    matches.set(`${m.event}:${m.id}`, { winner: (m.win === "a" ? m.a : m.b).name, at: m.at || "", exact });
  }
  const keep = only ? new Set(only) : null;
  const rows = new Map();
  for (const v of db.prepare("SELECT hash, name FROM voters").all()) {
    if (keep && !keep.has(v.hash)) continue;
    rows.set(v.hash, { hash: v.hash, name: v.name, good: 0, total: 0, exact: 0, pickem: 0, streak: 0, picks: [], badges: [] });
  }
  for (const p of db.prepare("SELECT hash, event, id, pick, score FROM predictions").all()) {
    const m = matches.get(`${p.event}:${p.id}`);
    const r = rows.get(p.hash);
    if (!m || !r) continue;
    r.total += 1;
    if (m.winner === p.pick) r.good += 1;
    if (m.winner === p.pick && p.score && p.score === m.exact) r.exact += 1;
    r.picks.push({ at: m.at, ok: m.winner === p.pick });
  }
  const events = pickemEvents(state, now).filter((e) => e.done);
  for (const ev of events) {
    for (const x of db.prepare("SELECT hash, picks, champion FROM pickem WHERE event = ?").all(ev.event)) {
      const r = rows.get(x.hash);
      if (!r) continue;
      const entry = { picks: JSON.parse(x.picks), champion: x.champion };
      r.pickem += pickemPoints(entry, ev) || 0;
      if (entry.champion === ev.champion) r.badges.push({ kind: "champion", event: ev.event });
      if (ev.n > 1 && entry.picks.every((t) => ev.qualified.includes(t))) r.badges.push({ kind: "perfect", event: ev.event });
    }
  }
  const maps = mapPickGood(db, state);
  const out = [];
  for (const [h, r] of rows) {
    r.maps = maps.get(h) || 0;
    if (!r.total && !r.pickem && !r.maps) continue;
    let run = 0;
    for (const p of r.picks.sort((a, b) => (a.at || "").localeCompare(b.at || ""))) { run = p.ok ? run + 1 : 0; r.streak = Math.max(r.streak, run); }
    if (r.streak >= 10) r.badges.unshift({ kind: "streak", n: 10 });
    else if (r.streak >= 5) r.badges.unshift({ kind: "streak", n: 5 });
    if (r.total >= 50) r.badges.push({ kind: "many", n: 50 });
    const { picks, hash, ...shown } = r; // eslint-disable-line no-unused-vars
    out.push({ ...shown, ...(withHash ? { hash } : {}), points: r.good + r.exact + r.pickem + r.maps });
  }
  return out.sort((a, b) => b.points - a.points || b.good - a.good || a.total - b.total || a.name.localeCompare(b.name)).slice(0, limit);
}

export { pickemBoards };

/** One visitor's season, for the card they share: { name, rank, of, points, good, total, pickem, streak, badges } or null. */
export function voterCard(db, state, name, now = Date.now()) {
  const all = seasonRanking(db, state, { limit: 100000, now });
  const i = all.findIndex((r) => r.name.toLowerCase() === String(name || "").toLowerCase());
  if (i < 0) {
    const v = db.prepare("SELECT name FROM voters WHERE name = ?").get(String(name || ""));
    return v ? { name: v.name, rank: 0, of: all.length, points: 0, good: 0, total: 0, pickem: 0, streak: 0, badges: [] } : null;
  }
  return { ...all[i], rank: i + 1, of: all.length };
}

/** The groups between them: [{ code, name, members, points (average per member) }], 2 members at least, best first. */
export function groupRanking(db, state, now = Date.now()) {
  const byHash = new Map(seasonRanking(db, state, { limit: 100000, now, withHash: true }).map((r) => [r.hash, r.points]));
  const out = [];
  for (const g of db.prepare("SELECT code, name FROM pgroups").all()) {
    const hashes = db.prepare("SELECT hash FROM pgroup_members WHERE code = ?").all(g.code).map((r) => r.hash);
    if (hashes.length < 2) continue;
    const total = hashes.reduce((s, h) => s + (byHash.get(h) || 0), 0);
    out.push({ code: g.code, name: g.name, members: hashes.length, points: Math.round((total / hashes.length) * 10) / 10 });
  }
  return out.sort((a, b) => b.points - a.points || b.members - a.members).slice(0, 20);
}
