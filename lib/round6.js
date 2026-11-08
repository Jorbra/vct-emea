// Round 6: the teams' power ranking, the quiz of the week, the editor's scheduled banner, the visitors' activity per day,
// the bot's "Oracle of the week" and the map results posted in a match's thread.
import crypto from "node:crypto";
import { allMatches } from "./matchlist.js";
import { teamSlug } from "./paths.js";

const fail = (status, error) => ({ ok: false, status, error });
const hashOf = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
const validToken = (t) => /^[A-Za-z0-9_-]{20,80}$/.test(String(t || ""));
const kvGet = (db, key, fallback) => { const r = db.prepare("SELECT value FROM kv WHERE key = ?").get(key); try { return r ? JSON.parse(r.value) : fallback; } catch { return fallback; } };
const kvSet = (db, key, value) => db.prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(key, JSON.stringify(value));

export function fillRound6(db) {
  db.exec("CREATE TABLE IF NOT EXISTS quiz_answers (hash TEXT NOT NULL, week TEXT NOT NULL, answers TEXT NOT NULL, good INTEGER NOT NULL, at TEXT NOT NULL, PRIMARY KEY (hash, week));");
}

// ---- 1. the power ranking

const START = 1500;
const K = 32;
const finished = (m) => m.a && m.b && m.a.name && m.b.name && m.win && m.at && !(m.note && m.note.kind === "ff");

function elo(list) {
  const teams = new Map();
  const get = (t) => {
    const slug = teamSlug(t.name);
    if (!teams.has(slug)) teams.set(slug, { slug, name: t.name, logo: t.logo || "", tag: t.tag || "", rating: START, w: 0, l: 0, form: [] });
    const x = teams.get(slug);
    if (!x.logo && t.logo) x.logo = t.logo;
    return x;
  };
  for (const m of list) {
    const a = get(m.a);
    const b = get(m.b);
    const expA = 1 / (1 + 10 ** ((b.rating - a.rating) / 400));
    const won = m.win === "a" ? 1 : 0;
    const gap = Math.abs((m.sa || 0) - (m.sb || 0));
    const k = K * (1 + 0.25 * Math.max(0, gap - 1));
    a.rating += k * (won - expA);
    b.rating -= k * (won - expA);
    a[won ? "w" : "l"] += 1;
    b[won ? "l" : "w"] += 1;
    a.form.push(won ? "w" : "l");
    b.form.push(won ? "l" : "w");
  }
  return teams;
}

/**
 * The teams by strength, from every finished series in date order (Elo, a bigger win moves it more):
 * [{ rank, slug, name, logo, tag, rating, move, w, l, form }], 3 series at least. move: places won (+) or lost (–) in 7 days.
 */
export function powerRanking(state, now = Date.now(), { min = 3 } = {}) {
  const list = allMatches(state).filter(finished).filter((m) => new Date(m.at).getTime() <= now).sort((x, y) => x.at.localeCompare(y.at));
  const before = now - 7 * 86400000;
  const order = (teams) => [...teams.values()].filter((t) => t.w + t.l >= min).sort((x, y) => y.rating - x.rating || x.name.localeCompare(y.name));
  const then = new Map(order(elo(list.filter((m) => new Date(m.at).getTime() <= before))).map((t, i) => [t.slug, i + 1]));
  return order(elo(list)).map((t, i) => ({
    rank: i + 1, slug: t.slug, name: t.name, logo: t.logo, tag: t.tag, rating: Math.round(t.rating), w: t.w, l: t.l,
    form: t.form.slice(-5), move: then.has(t.slug) ? then.get(t.slug) - (i + 1) : null,
  }));
}

// ---- 6. the quiz of the week

/** The week a moment belongs to: the date of its Monday in Paris, "2026-11-09". */
export function weekOf(now = Date.now()) {
  const d = new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(now))}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

const MAP_POOL = ["Abyss", "Ascent", "Bind", "Breeze", "Corrode", "Fracture", "Haven", "Icebox", "Lotus", "Pearl", "Split", "Sunset"];

function seeded(seed) {
  let h = 0;
  for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; };
}
const shuffle = (list, rnd) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/**
 * The week's 5 questions, about the series finished in the 7 days before its Monday (the 4 weeks before, when fewer than 5). The same for everyone that week.
 * [{ id, text, vars, options, answer }]: text is the English key the page translates. Pure.
 */
export function weeklyQuiz(state, week = weekOf()) {
  const end = new Date(`${week}T00:00:00Z`).getTime();
  const within = (days) => allMatches(state).filter(finished).filter((m) => { const t = new Date(m.at).getTime(); return t < end && t >= end - days * 86400000; })
    .sort((x, y) => `${x.event}:${x.id}`.localeCompare(`${y.event}:${y.id}`));
  // a quiet week: the last 4 weeks instead
  const last = within(7);
  const pool = last.length >= 5 ? last : within(28);
  const rnd = seeded(week);
  const out = [];
  for (const m of shuffle(pool, rnd)) {
    if (out.length >= 5) break;
    const vars = { a: m.a.name, b: m.b.name };
    const winner = m.win === "a" ? m.a.name : m.b.name;
    const maps = ((state.extra[m.event] || {})[m.id] || {}).maps || [];
    const kinds = ["winner"];
    if ((m.bo || 1) >= 3 && m.sa != null) kinds.push("score");
    if (maps[0] && MAP_POOL.includes(maps[0].map)) kinds.push("map");
    const kind = kinds[Math.floor(rnd() * kinds.length)];
    const id = `${m.event}:${m.id}`;
    if (kind === "winner") out.push({ id, text: "Who won {a} vs {b}?", vars, options: [m.a.name, m.b.name], answer: winner });
    else if (kind === "score") {
      const need = Math.ceil(m.bo / 2);
      // every final score, the first team's maps first: the options do not give the winner away
      const options = [...Array.from({ length: need }, (_, k) => `${need}–${k}`), ...Array.from({ length: need }, (_, k) => `${need - 1 - k}–${need}`)];
      out.push({ id, text: "What was the score of {a} vs {b}?", vars, options, answer: `${m.sa}–${m.sb}` });
    } else {
      const others = shuffle(MAP_POOL.filter((x) => x !== maps[0].map), rnd).slice(0, 3);
      out.push({ id, text: "Which map did {a} vs {b} start on?", vars, options: shuffle([maps[0].map, ...others], rnd), answer: maps[0].map });
    }
  }
  return out;
}

/** What the page may show before answering: the questions without their answers. */
export const quizQuestions = (quiz) => quiz.map(({ answer, ...q }) => q); // eslint-disable-line no-unused-vars

/** One go per visitor and week. Answers: { [question id]: option }. */
export function answerQuiz(db, state, { token, answers }, now = Date.now()) {
  if (!validToken(token)) return fail(400, "Reload the page and try again.");
  const week = weekOf(now);
  const quiz = weeklyQuiz(state, week);
  if (!quiz.length) return fail(409, "No quiz this week.");
  const hash = hashOf(token);
  if (db.prepare("SELECT 1 FROM quiz_answers WHERE hash = ? AND week = ?").get(hash, week)) return fail(409, "You already played this week's quiz.");
  const given = answers && typeof answers === "object" ? answers : {};
  const result = quiz.map((q) => ({ id: q.id, given: String(given[q.id] ?? ""), answer: q.answer, ok: String(given[q.id] ?? "") === q.answer }));
  const good = result.filter((r) => r.ok).length;
  db.prepare("INSERT INTO quiz_answers (hash, week, answers, good, at) VALUES (?, ?, ?, ?, ?)").run(hash, week, JSON.stringify(given), good, new Date(now).toISOString());
  return { ok: true, good, total: quiz.length, result };
}

/** What a visitor did this week: null before playing, else { good, total, result }. */
export function myQuiz(db, state, token, now = Date.now()) {
  if (!validToken(token)) return null;
  const week = weekOf(now);
  const row = db.prepare("SELECT answers, good FROM quiz_answers WHERE hash = ? AND week = ?").get(hashOf(token), week);
  if (!row) return null;
  const given = JSON.parse(row.answers);
  const quiz = weeklyQuiz(state, week);
  return { good: row.good, total: quiz.length, result: quiz.map((q) => ({ id: q.id, given: String(given[q.id] ?? ""), answer: q.answer, ok: String(given[q.id] ?? "") === q.answer })) };
}

/** The week's best, among the visitors with a name: [{ name, good }], quickest first when tied. */
export const quizRanking = (db, week = weekOf(), limit = 20) =>
  db.prepare("SELECT v.name, q.good FROM quiz_answers q JOIN voters v ON v.hash = q.hash WHERE q.week = ? ORDER BY q.good DESC, q.at ASC LIMIT ?").all(week, limit);

export const quizPlayers = (db, week = weekOf()) => db.prepare("SELECT COUNT(*) AS n FROM quiz_answers WHERE week = ?").get(week).n;

// ---- 8. the editor's banner, shown at the top of every page between two dates

const TONES = ["info", "live", "warn"];

/** Saves (or clears, with no text) the banner. from / to: ISO dates, empty for "now" / "until cleared". */
export function saveBanner(db, raw) {
  const text = String(raw.text || "").trim().slice(0, 200);
  if (!text) {
    kvSet(db, "site_banner", null);
    return { ok: true, message: "Banner removed." };
  }
  const url = String(raw.url || "").trim();
  if (url && !/^(https:\/\/|\/)[^\s]*$/.test(url)) return fail(400, "The link starts with https:// or /.");
  const date = (v) => { if (!v) return ""; const t = new Date(v); return Number.isNaN(t.getTime()) ? null : t.toISOString(); };
  const from = date(raw.from);
  const to = date(raw.to);
  if (from === null || to === null) return fail(400, "Unknown date.");
  if (from && to && to <= from) return fail(400, "The end comes after the start.");
  kvSet(db, "site_banner", { text, url: url.slice(0, 300), from, to, tone: TONES.includes(raw.tone) ? raw.tone : "info" });
  return { ok: true, message: from ? "Banner scheduled." : "Banner saved." };
}

export const readBanner = (db) => kvGet(db, "site_banner", null);

/** The banner to show now, or null. */
export function activeBanner(db, now = Date.now()) {
  const b = readBanner(db);
  if (!b || !b.text) return null;
  if (b.from && new Date(b.from).getTime() > now) return null;
  if (b.to && new Date(b.to).getTime() <= now) return null;
  return { text: b.text, url: b.url, tone: b.tone, key: crypto.createHash("sha1").update(`${b.text}|${b.from}`).digest("hex").slice(0, 10) };
}

// ---- 9. the visitors' activity per day, next to the visits

/** The last 14 days, oldest first: [{ day, votes, maps, comments, quiz }]. */
export function activityReport(db, now = Date.now()) {
  const day = (d) => new Date(now - d * 86400000).toISOString().slice(0, 10);
  const since = `${day(13)}T00:00:00.000Z`;
  const per = (sql) => Object.fromEntries(db.prepare(sql).all(since).map((r) => [r.day, r.n]));
  const votes = per("SELECT substr(at, 1, 10) AS day, COUNT(*) AS n FROM motm WHERE at >= ? GROUP BY day");
  const maps = per("SELECT substr(at, 1, 10) AS day, COUNT(*) AS n FROM map_picks WHERE at >= ? GROUP BY day");
  const comments = per("SELECT substr(at, 1, 10) AS day, COUNT(*) AS n FROM comments WHERE at >= ? GROUP BY day");
  const quiz = per("SELECT substr(at, 1, 10) AS day, COUNT(*) AS n FROM quiz_answers WHERE at >= ? GROUP BY day");
  return Array.from({ length: 14 }, (_, i) => { const d = day(13 - i); return { day: d, votes: votes[d] || 0, maps: maps[d] || 0, comments: comments[d] || 0, quiz: quiz[d] || 0 }; });
}

// ---- 13. the Oracle of the week: the server's best prediction maker over the last 7 days

/**
 * Right picks over the series finished in the last 7 days, per voter: [{ hash, good, total }], best first (2 right picks at least).
 */
export function weekPredictions(db, state, now = Date.now()) {
  const since = now - 7 * 86400000;
  const winners = new Map(allMatches(state).filter(finished).filter((m) => { const t = new Date(m.at).getTime(); return t >= since && t <= now; })
    .map((m) => [`${m.event}:${m.id}`, m.win === "a" ? m.a.name : m.b.name]));
  const rows = new Map();
  for (const p of db.prepare("SELECT hash, event, id, pick FROM predictions").all()) {
    const w = winners.get(`${p.event}:${p.id}`);
    if (!w) continue;
    const r = rows.get(p.hash) || { hash: p.hash, good: 0, total: 0 };
    r.total += 1;
    if (w === p.pick) r.good += 1;
    rows.set(p.hash, r);
  }
  return [...rows.values()].filter((r) => r.good >= 2).sort((a, b) => b.good - a.good || a.total - b.total);
}

/** The server's Oracle: the member (Discord id) with the most right picks this week, among those who used the bot there. Pure. */
export function oracleOf(week, members) {
  const byHash = new Map(members.map((m) => [m.hash, m.user]));
  const best = week.find((r) => byHash.has(r.hash));
  return best ? { user: byHash.get(best.hash), good: best.good, total: best.total } : null;
}

// ---- 12. a match's thread: each map's result, then the series'

/** What to post in a thread now that more maps are over: the lines to add and the new count. Pure. */
export function threadLines(m, live, posted, lang) {
  const L = (fr, en) => (lang === "en" ? en : fr);
  const maps = ((live && live.maps) || []).filter((x) => x.a != null && x.b != null);
  const done = m.sa != null && m.sb != null;
  const over = maps.filter((x, i) => x.done || i < maps.length - 1 || (done && i === maps.length - 1));
  const lines = [];
  for (let i = posted.maps; i < over.length; i++) {
    const x = over[i];
    const w = x.a > x.b ? m.a.name : m.b.name;
    lines.push(`🗺️ ${L(`Carte ${i + 1}`, `Map ${i + 1}`)} · **${x.map || "?"}** : ${m.a.name} ${x.a}–${x.b} ${m.b.name} · ${L(`pour **${w}**`, `to **${w}**`)}`);
  }
  if (done && !posted.done) lines.push(`🏁 ${L("Fin du match", "Match over")} : **${m.win === "a" ? m.a.name : m.b.name}** ${Math.max(m.sa, m.sb)}–${Math.min(m.sa, m.sb)}`);
  return { lines, maps: Math.max(posted.maps, over.length), done: done || posted.done };
}

export { kvGet, kvSet };
