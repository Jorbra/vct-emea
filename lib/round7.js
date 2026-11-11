// Round 7: the fantasy game, the country pages, the visitors' achievements, the editors' "I'm on it", the news drafts written
// from a finished event, the CSV exports, the week's recap and the Discord reminders to predict.
import crypto from "node:crypto";
import { allMatches } from "./matchlist.js";
import { EVENT_NAMES, teamSlug } from "./paths.js";
import { COUNTRIES } from "./countries.js";

const fail = (status, error) => ({ ok: false, status, error });
const hashOf = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
const validToken = (t) => /^[A-Za-z0-9_-]{20,80}$/.test(String(t || ""));
const DAY = 86400000;

export function fillRound7(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS fantasy (hash TEXT PRIMARY KEY, slots TEXT NOT NULL, past TEXT NOT NULL DEFAULT '[]', updated TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS match_claims (event TEXT NOT NULL, id TEXT NOT NULL, who TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY (event, id));`);
}

// ---- 1. fantasy: 5 players, 100 credits, points from their real matches

export const ROLES = ["duelist", "initiator", "controller", "sentinel", "joker"];
const AGENT_ROLE = {
  jett: "duelist", raze: "duelist", reyna: "duelist", phoenix: "duelist", yoru: "duelist", neon: "duelist", iso: "duelist", waylay: "duelist",
  sova: "initiator", breach: "initiator", skye: "initiator", kayo: "initiator", fade: "initiator", gekko: "initiator", tejo: "initiator",
  brimstone: "controller", omen: "controller", viper: "controller", astra: "controller", harbor: "controller", clove: "controller",
  killjoy: "sentinel", cypher: "sentinel", sage: "sentinel", chamber: "sentinel", deadlock: "sentinel", vyse: "sentinel",
};
export const BUDGET = 100;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** A player's role: their most played agent's. */
export const roleOf = (p) => AGENT_ROLE[String((p.agents && p.agents[0] && p.agents[0].name) || "").toLowerCase().replace(/[^a-z]/g, "")] || "flex";

/** What a player costs: from 5 to 30 credits, by rating and ACS. */
export const priceOf = (p) => clamp(Math.round(10 + ((p.r || 1) - 1) * 50 + ((p.acs || 200) - 200) / 20), 5, 30);

/** Who can be picked: [{ slug, name, team, role, price, r, acs, maps }], dearest first. */
export const fantasyPool = (players) => players.map((p) => ({ slug: p.slug, name: p.name, team: p.team, role: roleOf(p), agent: (p.agents && p.agents[0] && p.agents[0].name) || "", price: priceOf(p), r: p.r, acs: p.acs, maps: p.maps }))
  .sort((a, b) => b.price - a.price || a.name.localeCompare(b.name));

/**
 * The points of each player's matches: Map(slug → [{ at, pts, event, id }]). A kill 1, an assist 0.5, a death −0.5,
 * the series won 3, the best ACS of the match 5. Pure: from the details tables and the matches' times.
 */
export function playerPoints(state, entries) {
  const times = new Map(allMatches(state).map((m) => [`${m.event}:${m.id}`, m]));
  const out = new Map();
  for (const { event, id, details } of entries) {
    const m = times.get(`${event}:${id}`);
    if (!m || !m.at || !m.win) continue;
    const rows = ((details && details.all) || []).filter((r) => r.side && r.name);
    const mvp = rows.filter((r) => r.acs != null).sort((x, y) => y.acs - x.acs)[0];
    for (const r of rows) {
      const pts = Math.round(((r.k || 0) + (r.a || 0) * 0.5 - (r.d || 0) * 0.5 + (m.win === r.side ? 3 : 0) + (mvp && mvp.name === r.name ? 5 : 0)) * 2) / 2;
      const key = teamSlug(r.name);
      (out.get(key) || out.set(key, []).get(key)).push({ at: m.at, pts, event, id });
    }
  }
  return out;
}

const parseTeam = (row) => (row ? { slots: JSON.parse(row.slots), past: JSON.parse(row.past) } : { slots: {}, past: [] });
const readTeam = (db, hash) => parseTeam(db.prepare("SELECT slots, past FROM fantasy WHERE hash = ?").get(hash));

/** A team's points since `since` (a time), from each player's time in it. */
export function teamPoints(team, points, since = 0) {
  const spans = [...Object.values(team.slots).map((s) => ({ slug: s.slug, from: s.from, to: null })), ...team.past];
  let sum = 0;
  for (const s of spans) {
    const from = Math.max(new Date(s.from).getTime(), since);
    const to = s.to ? new Date(s.to).getTime() : Infinity;
    for (const x of points.get(s.slug) || []) { const t = new Date(x.at).getTime(); if (t >= from && t < to) sum += x.pts; }
  }
  return Math.round(sum * 2) / 2;
}

/** Saves the team: slots { role: slug }. Every role filled, 100 credits at most, 2 players of one team at most. */
export function saveFantasy(db, pool, { token, slots }, now = Date.now()) {
  if (!validToken(token)) return fail(400, "Reload the page and try again.");
  const hash = hashOf(token);
  if (!db.prepare("SELECT 1 FROM voters WHERE hash = ?").get(hash)) return fail(409, "Make a first prediction to get your name first.");
  const bySlug = new Map(pool.map((p) => [p.slug, p]));
  const picked = {};
  for (const role of ROLES) {
    const p = bySlug.get(String((slots || {})[role] || ""));
    if (!p) return fail(400, "Fill the 5 places.");
    if (role !== "joker" && p.role !== role) return fail(400, "A player in the wrong role.");
    picked[role] = p;
  }
  const list = Object.values(picked);
  if (new Set(list.map((p) => p.slug)).size !== 5) return fail(400, "The same player twice.");
  if (list.reduce((s, p) => s + p.price, 0) > BUDGET) return fail(400, "Over budget: 100 credits at most.");
  const perTeam = {};
  for (const p of list) if ((perTeam[teamSlug(p.team)] = (perTeam[teamSlug(p.team)] || 0) + 1) > 2) return fail(400, "2 players of the same team at most.");
  const cur = readTeam(db, hash);
  const at = new Date(now).toISOString();
  const next = {};
  const past = [...cur.past];
  for (const role of ROLES) {
    const old = cur.slots[role];
    if (old && old.slug === picked[role].slug) next[role] = old;
    else {
      if (old) past.push({ slug: old.slug, from: old.from, to: at });
      next[role] = { slug: picked[role].slug, from: at };
    }
  }
  db.prepare("INSERT INTO fantasy (hash, slots, past, updated) VALUES (?, ?, ?, ?) ON CONFLICT (hash) DO UPDATE SET slots = excluded.slots, past = excluded.past, updated = excluded.updated")
    .run(hash, JSON.stringify(next), JSON.stringify(past.slice(-200)), at);
  return { ok: true, message: "Team saved: its players count from now on." };
}

/** Monday 00:00 (UTC) of this week, as a time. */
export const weekStart = (now = Date.now()) => { const d = new Date(now); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.getTime(); };

/** Everyone's fantasy: [{ name, season, week }], by season points (or week). */
export function fantasyRanking(db, points, { by = "season", now = Date.now(), limit = 50, withHash = false } = {}) {
  const ws = weekStart(now);
  const rows = db.prepare("SELECT f.hash, f.slots, f.past, v.name FROM fantasy f JOIN voters v ON v.hash = f.hash").all().map((r) => {
    const t = parseTeam(r);
    return { name: r.name, ...(withHash ? { hash: r.hash } : {}), season: teamPoints(t, points), week: teamPoints(t, points, ws) };
  });
  return rows.sort((a, b) => b[by] - a[by] || b.season - a.season || a.name.localeCompare(b.name)).slice(0, limit);
}

/** A visitor's team with its players and points: null when they have none. */
export function myFantasy(db, pool, points, token, now = Date.now()) {
  if (!validToken(token)) return null;
  const team = readTeam(db, hashOf(token));
  if (!Object.keys(team.slots).length) return null;
  const bySlug = new Map(pool.map((p) => [p.slug, p]));
  const players = Object.fromEntries(ROLES.map((role) => {
    const s = team.slots[role];
    const p = s && bySlug.get(s.slug);
    return [role, s ? { ...(p || { slug: s.slug, name: s.slug, team: "", price: 0 }), since: s.from, pts: teamPoints({ slots: { x: s }, past: [] }, points) } : null];
  }));
  return { players, season: teamPoints(team, points), week: teamPoints(team, points, weekStart(now)) };
}

export const fantasyOfHash = (db, hash) => readTeam(db, hash);

// ---- 2. countries

const NAME = Object.fromEntries(COUNTRIES);
export const countryName = (cc) => NAME[cc] || String(cc || "").toUpperCase();

/** Players by country: [{ cc, name, players: [...], teams: [...], best, rating }], most players first. Pure. */
export function countryStats(players) {
  const by = new Map();
  for (const p of players) {
    if (!p.cc) continue;
    const c = by.get(p.cc) || { cc: p.cc, name: countryName(p.cc), players: [], teams: new Set() };
    c.players.push({ slug: p.slug, name: p.name, team: p.team, r: p.r, acs: p.acs, maps: p.maps });
    if (p.team) c.teams.add(p.team);
    by.set(p.cc, c);
  }
  return [...by.values()].map((c) => {
    const list = c.players.sort((a, b) => (b.r || 0) - (a.r || 0));
    const rated = list.filter((p) => p.r != null && p.maps >= 3);
    return { cc: c.cc, name: c.name, players: list, teams: [...c.teams].sort(), best: rated[0] || list[0] || null, rating: rated.length ? Math.round((rated.reduce((s, p) => s + p.r, 0) / rated.length) * 100) / 100 : null };
  }).sort((a, b) => b.players.length - a.players.length || (b.rating || 0) - (a.rating || 0));
}

// ---- 6. achievements

const ACH = [
  ["predict10", "Predictor", "10 predictions on finished matches"],
  ["good25", "Oracle", "25 right predictions"],
  ["games3", "Regular", "Daily games on 3 different days"],
  ["games7", "Addict", "Daily games on 7 different days"],
  ["genius", "Genius", "Mystery player found in 1 guess"],
  ["perfect10", "Unbeatable", "10 out of 10 at higher or lower"],
  ["eagle", "Eagle eye", "Mystery logo found in 1 guess"],
  ["quiz5", "Know-it-all", "5 out of 5 at the quiz of the week"],
  ["manager", "Manager", "A fantasy team"],
  ["fantasy100", "Head coach", "100 fantasy points"],
  ["talker", "Supporter", "5 comments"],
];

/** A visitor's achievements: [{ key, name, text, got }], those got first. */
export function achievements(db, state, hash, points = new Map()) {
  const done = new Set();
  const winners = new Map(allMatches(state).filter((m) => m.win).map((m) => [`${m.event}:${m.id}`, m.win === "a" ? m.a.name : m.b.name]));
  const preds = db.prepare("SELECT event, id, pick FROM predictions WHERE hash = ?").all(hash).filter((p) => winners.has(`${p.event}:${p.id}`));
  if (preds.length >= 10) done.add("predict10");
  if (preds.filter((p) => winners.get(`${p.event}:${p.id}`) === p.pick).length >= 25) done.add("good25");
  const has = (sql, ...a) => { try { return !!db.prepare(sql).get(hash, ...a); } catch { return false; } };
  const count = (sql) => { try { return db.prepare(sql).get(hash).n; } catch { return 0; } };
  const days = count("SELECT COUNT(DISTINCT day) AS n FROM daily_play WHERE hash = ? AND done = 1");
  if (days >= 3) done.add("games3");
  if (days >= 7) done.add("games7");
  if (has("SELECT 1 FROM daily_play WHERE hash = ? AND game = 'joueur' AND won = 1 AND score = 6")) done.add("genius");
  if (has("SELECT 1 FROM daily_play WHERE hash = ? AND game = 'duel' AND score = 10")) done.add("perfect10");
  if (has("SELECT 1 FROM daily_play WHERE hash = ? AND game = 'logo' AND won = 1 AND score = 5")) done.add("eagle");
  if (has("SELECT 1 FROM quiz_answers WHERE hash = ? AND good >= 5")) done.add("quiz5");
  const team = readTeam(db, hash);
  if (Object.keys(team.slots).length) done.add("manager");
  if (teamPoints(team, points) >= 100) done.add("fantasy100");
  if (count("SELECT COUNT(*) AS n FROM comments WHERE hash = ?") >= 5) done.add("talker");
  return ACH.map(([key, name, text]) => ({ key, name, text, got: done.has(key) })).sort((a, b) => Number(b.got) - Number(a.got));
}

// ---- 7. "I'm on it": an editor takes a match

export function claimMatch(db, { event, id, who, on }, now = Date.now()) {
  if (!event || !id) return fail(400, "Unknown match.");
  if (!on) { db.prepare("DELETE FROM match_claims WHERE event = ? AND id = ?").run(event, id); return { ok: true }; }
  const cur = db.prepare("SELECT who FROM match_claims WHERE event = ? AND id = ?").get(event, id);
  if (cur && cur.who !== who) return fail(409, `Already taken by ${cur.who || "the main account"}.`);
  db.prepare("INSERT INTO match_claims (event, id, who, at) VALUES (?, ?, ?, ?) ON CONFLICT (event, id) DO UPDATE SET who = excluded.who, at = excluded.at").run(event, id, who, new Date(now).toISOString());
  return { ok: true };
}

/** { "event:id": who }, the claims of the last 3 days. */
export function listClaims(db, now = Date.now()) {
  db.prepare("DELETE FROM match_claims WHERE at < ?").run(new Date(now - 3 * DAY).toISOString());
  return Object.fromEntries(db.prepare("SELECT event, id, who FROM match_claims").all().map((r) => [`${r.event}:${r.id}`, r.who]));
}

// ---- 8. a news draft from a finished event

/** The finished events' recaps as news drafts, those not published yet: [{ event, title, body }]. Pure but for recapOf given. */
export function newsDrafts(recaps, published) {
  const titles = new Set(published.map((n) => n.title));
  const out = [];
  for (const [event, r] of Object.entries(recaps)) {
    if (!r || !r.done) continue;
    const title = `Récap : ${EVENT_NAMES[event] || event}`;
    if (titles.has(title)) continue;
    const lines = [
      `${EVENT_NAMES[event] || event} est terminé : ${r.played} matchs joués${r.overtime ? `, dont ${r.overtime} cartes en prolongation` : ""}.`,
      "",
      `Qualifiés : ${r.qualified.map((q) => q.team.name).join(", ")}.`,
    ];
    if (r.top && r.top.length) lines.push("", "Meilleurs joueurs :", ...r.top.slice(0, 5).map((p, k) => `${k + 1}. ${p.name} (${p.team}) · rating ${p.r != null ? p.r.toFixed(2) : "–"}`));
    if (r.bigGames && r.bigGames.length) lines.push("", `Plus gros match : ${r.bigGames[0].name}, ${r.bigGames[0].acs} ACS (${r.bigGames[0].k}/${r.bigGames[0].d}).`);
    if (r.maps && r.maps[0]) lines.push("", `Carte la plus jouée : ${r.maps[0].map}.`);
    lines.push("", "Tous les résultats et le tableau sur le site.");
    out.push({ event, title, body: lines.join("\n") });
  }
  return out;
}

// ---- 9. CSV exports

const cell = (v) => { const s = v == null ? "" : String(v); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const toCsv = (rows) => `﻿${rows.map((r) => r.map(cell).join(";")).join("\r\n")}\r\n`;

export function resultsCsv(state) {
  const rows = [["Tournoi", "Match", "Date", "Équipe A", "Équipe B", "Score A", "Score B", "Vainqueur", "Bo"]];
  for (const m of allMatches(state).filter((x) => x.a && x.b && x.a.name && x.b.name).sort((x, y) => (x.at || "").localeCompare(y.at || ""))) {
    rows.push([EVENT_NAMES[m.event] || m.event, m.id, m.at || "", m.a.name, m.b.name, m.sa ?? "", m.sb ?? "", m.win ? (m.win === "a" ? m.a.name : m.b.name) : "", m.bo || ""]);
  }
  return toCsv(rows);
}

export const rankingCsv = (ranking) => toCsv([["Place", "Nom", "Points", "Bons", "Total", "Scores exacts", "Qui se qualifie ?", "Cartes"], ...ranking.map((r, i) => [i + 1, r.name, r.points, r.good, r.total, r.exact || 0, r.pickem || 0, r.maps || 0])]);

// ---- 13. the week's recap

/** The last 7 days: { matches, best (player of the week), top (power top 5), biggest (largest win) }. Pure. */
export function weekRecap(state, entries, power, now = Date.now()) {
  const since = now - 7 * DAY;
  const recent = allMatches(state).filter((m) => m.win && m.at && new Date(m.at).getTime() >= since && new Date(m.at).getTime() <= now);
  const ids = new Set(recent.map((m) => `${m.event}:${m.id}`));
  const per = new Map();
  for (const e of entries) {
    if (!ids.has(`${e.event}:${e.id}`)) continue;
    for (const r of (e.details && e.details.all) || []) {
      if (!r.side || r.r == null) continue;
      const p = per.get(r.name) || { name: r.name, n: 0, sum: 0, acs: 0 };
      p.n += 1; p.sum += r.r; p.acs += r.acs || 0;
      per.set(r.name, p);
    }
  }
  const best = [...per.values()].filter((p) => p.n >= 2).map((p) => ({ name: p.name, r: Math.round((p.sum / p.n) * 100) / 100, acs: Math.round(p.acs / p.n), n: p.n })).sort((a, b) => b.r - a.r)[0] || null;
  const biggest = recent.filter((m) => m.sa != null && !m.note).sort((x, y) => Math.abs(y.sa - y.sb) - Math.abs(x.sa - x.sb) || (y.bo || 1) - (x.bo || 1))[0];
  return { matches: recent.length, best, top: power.slice(0, 5), biggest: biggest ? { a: biggest.a.name, b: biggest.b.name, sa: biggest.sa, sb: biggest.sb, event: EVENT_NAMES[biggest.event] || biggest.event } : null };
}

// ---- 11. who to remind on Discord: the matches starting soon they have not predicted

/** For each Discord user who asked: the open matches starting within 3 hours without their pick. [{ user, matches }]. */
export function pronoReminders(db, state, users, isOpen, hashFor, now = Date.now()) {
  const soon = allMatches(state).filter((m) => m.a && m.b && m.a.name && m.b.name && m.at && isOpen(m) && new Date(m.at).getTime() - now > 0 && new Date(m.at).getTime() - now <= 3 * 3600000);
  if (!soon.length) return [];
  const out = [];
  for (const user of users) {
    const hash = hashFor(user);
    const mine = new Set(db.prepare("SELECT event || ':' || id AS k FROM predictions WHERE hash = ?").all(hash).map((r) => r.k));
    const missing = soon.filter((m) => !mine.has(`${m.event}:${m.id}`));
    if (missing.length) out.push({ user, matches: missing });
  }
  return out;
}
