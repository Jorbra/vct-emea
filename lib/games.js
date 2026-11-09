// The daily games: the same for everyone each day (Paris date), played once, kept on the server so that a visitor finds their game
// on any device with their account. Mystery player (6 guesses with clues), higher or lower (a streak over 10 duels of numbers),
// mystery logo (5 guesses, the logo clearer after each one).
import crypto from "node:crypto";
import { teamSlug } from "./paths.js";

const fail = (status, error) => ({ ok: false, status, error });
const hashOf = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
const validToken = (t) => /^[A-Za-z0-9_-]{20,80}$/.test(String(t || ""));

export const GAMES = ["joueur", "duel", "logo"];
export const LIMITS = { joueur: 6, duel: 10, logo: 5 };
const KICKOFF_EVENTS = ["kickoff", "playoffs", "tr", "mena", "gc"];

export function fillGames(db) {
  db.exec("CREATE TABLE IF NOT EXISTS daily_play (hash TEXT NOT NULL, day TEXT NOT NULL, game TEXT NOT NULL, state TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, score INTEGER NOT NULL DEFAULT 0, won INTEGER NOT NULL DEFAULT 0, at TEXT NOT NULL, PRIMARY KEY (hash, day, game));");
}

/** Today in Paris, "2026-11-09". */
export const dayOf = (now = Date.now()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(now));

function seeded(seed) {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; };
}
const pick = (list, rnd) => list[Math.floor(rnd() * list.length)];
const cap = (s) => String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1);

// ---- who can come up

/** The players worth guessing: 3 maps at least, a team, numbers. Sorted, so that the day picks the same one everywhere. */
export const playerPool = (stats) => stats.players.filter((p) => p.maps >= 3 && p.team && p.r != null && p.acs != null).sort((a, b) => a.slug.localeCompare(b.slug));

/** The teams with a logo, those of the main events first (better known). */
export function logoPool(teams, mainNames = new Set()) {
  const withLogo = teams.filter((t) => t.name && t.logo && !/^data:image\/svg/.test(t.logo)).sort((a, b) => teamSlug(a.name).localeCompare(teamSlug(b.name)));
  const main = withLogo.filter((t) => mainNames.has(teamSlug(t.name)));
  return main.length >= 8 ? main : withLogo;
}

export const mainTeamNames = (state) => new Set(KICKOFF_EVENTS.flatMap((e) => (e === "playoffs" ? state.teams : e === "kickoff" ? state.kickoff.teams : (state.regional[e] || { teams: [] }).teams) || []).filter((t) => t && t.name).map((t) => teamSlug(t.name)));

// ---- today's puzzles (with their answers: server only)

const STATS = [["r", "Rating", 2], ["acs", "ACS", 0], ["kd", "K/D", 2], ["adr", "ADR", 0], ["kast", "KAST", 0]];

export function dailyPuzzles({ players, logos }, day = dayOf()) {
  const out = {};
  if (players.length >= 4) {
    const rnd = seeded(`joueur:${day}`);
    out.joueur = { answer: pick(players, rnd) };
    const r2 = seeded(`duel:${day}`);
    const pool = players.filter((p) => p.maps >= 4);
    const rounds = [];
    for (let i = 0; i < LIMITS.duel && pool.length >= 2; i++) {
      const [k, label, d] = pick(STATS, r2);
      const a = pick(pool, r2);
      let b = pick(pool, r2);
      for (let t = 0; t < 10 && (b.slug === a.slug || b[k] === a[k] || b[k] == null || a[k] == null); t++) b = pick(pool, r2);
      if (b.slug === a.slug || a[k] == null || b[k] == null || a[k] === b[k]) continue;
      rounds.push({ stat: k, label, digits: d, a: { name: a.name, team: a.team, value: a[k] }, b: { name: b.name, team: b.team, value: b[k] } });
    }
    if (rounds.length >= 5) out.duel = { rounds };
  }
  if (logos.length >= 4) out.logo = { answer: pick(logos, seeded(`logo:${day}`)) };
  return out;
}

// ---- what a guess tells

const mainAgent = (p) => (p.agents && p.agents[0] ? cap(p.agents[0].name) : "");
const near = (x, y, pct) => Math.abs(x - y) <= Math.abs(y) * pct;

/** A guess at the mystery player against the answer: each clue "ok", "near", "up" (the answer is higher), "down" or "no". Pure. */
export function playerClues(g, ans) {
  const num = (k, pct) => (g[k] === ans[k] ? "ok" : near(g[k], ans[k], pct) ? (g[k] < ans[k] ? "nearup" : "neardown") : g[k] < ans[k] ? "up" : "down");
  return {
    name: g.name, team: g.team, cc: g.cc || "", agent: mainAgent(g), r: g.r, acs: g.acs, maps: g.maps,
    clues: {
      team: teamSlug(g.team) === teamSlug(ans.team) ? "ok" : "no",
      cc: g.cc && g.cc === ans.cc ? "ok" : "no",
      agent: mainAgent(g) && mainAgent(g) === mainAgent(ans) ? "ok" : (ans.agents || []).some((a) => cap(a.name) === mainAgent(g)) ? "near" : "no",
      r: num("r", 0.05), acs: num("acs", 0.08), maps: num("maps", 0.25),
    },
  };
}

// ---- playing

/** Today's game of a visitor: { day, game, done, won, score, guesses / answers…, reveal? } (the answer once done). */
function view(game, st, puzzle, done, won) {
  const out = { game, done: !!done, won: !!won, ...st };
  if (game === "duel") out.rounds = puzzle.rounds.map((r, i) => (i < st.answers.length || done ? r : { stat: r.stat, label: r.label, digits: r.digits, a: { name: r.a.name, team: r.a.team }, b: { name: r.b.name, team: r.b.team } }));
  if (done && game === "joueur") out.reveal = { name: puzzle.answer.name, team: puzzle.answer.team, slug: puzzle.answer.slug };
  if (done && game === "logo") out.reveal = { name: puzzle.answer.name, slug: teamSlug(puzzle.answer.name) };
  if (game === "logo") out.blur = done ? 0 : [28, 18, 11, 6, 3][Math.min(4, st.guesses.length)];
  return out;
}

const blank = (game) => (game === "duel" ? { answers: [] } : { guesses: [] });

function load(db, hash, day, game) {
  const row = db.prepare("SELECT state, done, won FROM daily_play WHERE hash = ? AND day = ? AND game = ?").get(hash, day, game);
  return row ? { st: JSON.parse(row.state), done: row.done, won: row.won } : { st: blank(game), done: 0, won: 0 };
}

/** Today's game, as it stands for this visitor (nothing written). */
export function readGame(db, puzzles, { token, game }, now = Date.now()) {
  if (!GAMES.includes(game)) return fail(404, "Unknown game.");
  if (!puzzles[game]) return fail(409, "No game today: not enough data yet.");
  const { st, done, won } = validToken(token) ? load(db, hashOf(token), dayOf(now), game) : { st: blank(game), done: 0, won: 0 };
  return { ok: true, ...view(game, st, puzzles[game], done, won) };
}

/**
 * One move: a player's or a team's name (joueur, logo), "a" or "b" (duel). Wrong names are refused without counting.
 * ctx: { players } for the mystery player's guesses, { teams } (names) for the logo.
 */
export function playMove(db, puzzles, ctx, { token, game, move }, now = Date.now()) {
  if (!validToken(token)) return fail(400, "Reload the page and try again.");
  if (!GAMES.includes(game)) return fail(404, "Unknown game.");
  const puzzle = puzzles[game];
  if (!puzzle) return fail(409, "No game today: not enough data yet.");
  const hash = hashOf(token);
  const day = dayOf(now);
  let { st, done, won } = load(db, hash, day, game);
  if (done) return fail(409, "You already played today: come back tomorrow.");
  let score = 0;
  if (game === "joueur") {
    const g = ctx.players.find((p) => p.slug === teamSlug(move)) || ctx.players.find((p) => p.name.toLowerCase() === String(move || "").toLowerCase());
    if (!g) return fail(400, "Unknown player: pick one from the list.");
    if (st.guesses.some((x) => x.name === g.name)) return fail(400, "Already tried.");
    st.guesses.push(playerClues(g, puzzle.answer));
    won = g.slug === puzzle.answer.slug ? 1 : 0;
    done = won || st.guesses.length >= LIMITS.joueur ? 1 : 0;
    score = won ? LIMITS.joueur + 1 - st.guesses.length : 0;
  } else if (game === "logo") {
    const name = ctx.teams.find((t) => teamSlug(t) === teamSlug(move));
    if (!name) return fail(400, "Unknown team: pick one from the list.");
    if (st.guesses.some((x) => teamSlug(x.name) === teamSlug(name))) return fail(400, "Already tried.");
    const ok = teamSlug(name) === teamSlug(puzzle.answer.name);
    st.guesses.push({ name, ok });
    won = ok ? 1 : 0;
    done = won || st.guesses.length >= LIMITS.logo ? 1 : 0;
    score = won ? LIMITS.logo + 1 - st.guesses.length : 0;
  } else {
    if (move !== "a" && move !== "b") return fail(400, "Pick one of the two.");
    const r = puzzle.rounds[st.answers.length];
    const ok = (move === "a" ? r.a.value > r.b.value : r.b.value > r.a.value);
    st.answers.push({ move, ok });
    done = !ok || st.answers.length >= puzzle.rounds.length ? 1 : 0;
    score = st.answers.filter((x) => x.ok).length;
    won = done && ok ? 1 : 0;
  }
  db.prepare("INSERT INTO daily_play (hash, day, game, state, done, score, won, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (hash, day, game) DO UPDATE SET state = excluded.state, done = excluded.done, score = excluded.score, won = excluded.won, at = excluded.at")
    .run(hash, day, game, JSON.stringify(st), done, score, won, new Date(now).toISOString());
  return { ok: true, ...view(game, st, puzzle, done, won) };
}

/** The day's best for a game, among the visitors with a name: [{ name, score }], quickest first when tied. */
export const dailyRanking = (db, game, day = dayOf(), limit = 10) =>
  db.prepare("SELECT v.name, d.score FROM daily_play d JOIN voters v ON v.hash = d.hash WHERE d.day = ? AND d.game = ? AND d.done = 1 AND d.score > 0 ORDER BY d.score DESC, d.at ASC LIMIT ?").all(day, game, limit);

export const dailyPlayers = (db, day = dayOf()) => Object.fromEntries(GAMES.map((g) => [g, db.prepare("SELECT COUNT(*) AS n FROM daily_play WHERE day = ? AND game = ? AND done = 1").get(day, g).n]));

/** A visitor's days in a row with at least one game finished, up to today (or yesterday, when today is not played yet), and today's games. */
export function myGames(db, token, now = Date.now()) {
  if (!validToken(token)) return { streak: 0, today: {} };
  const hash = hashOf(token);
  const days = new Set(db.prepare("SELECT DISTINCT day FROM daily_play WHERE hash = ? AND done = 1 ORDER BY day DESC LIMIT 400").all(hash).map((r) => r.day));
  let streak = 0;
  let t = now;
  if (!days.has(dayOf(t))) t -= 86400000;
  while (days.has(dayOf(t))) { streak += 1; t -= 86400000; }
  const today = Object.fromEntries(db.prepare("SELECT game, done, won, score FROM daily_play WHERE hash = ? AND day = ?").all(hash, dayOf(now)).map((r) => [r.game, { done: !!r.done, won: !!r.won, score: r.score }]));
  return { streak, today };
}
