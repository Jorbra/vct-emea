// Single-elimination bracket for the open Qualifiers: up to 64 teams, a third place match, top 4 qualify.
// Pure functions. A team is identified by its slot number (1 to 64) in the bracket order, so renaming a team
// never breaks a result. Participants of every later match are derived from the scores, never stored.
import { calc, needWins } from "./tournament.js";

export const EVENTS = ["q1", "q2", "trq1", "trq2", "meq1", "meq2", "naq1", "naq2"]; // EU Qualifier 1 / 2, Türkiye Qualifier 1 / 2, MENA: ME / NA Qualifier 1 / 2
export const SLOTS = 64;

export const ROUNDS = [
  { key: "r64", name: "Round of 64", count: 32, bo: 1 },
  { key: "r32", name: "Round of 32", count: 16, bo: 1 },
  { key: "r16", name: "Round of 16", count: 8, bo: 1 },
  { key: "qf", name: "Quarterfinals", count: 4, bo: 3 },
  { key: "sf", name: "Semifinals", count: 2, bo: 3 },
  { key: "gf", name: "Grand Final", count: 1, bo: 5 },
];
export const THIRD = { key: "third", name: "Third Place Match", count: 1, bo: 3 };
export const BO_CHOICES = [1, 3, 5];

export const matchId = (round, idx) => `${round}-${idx + 1}`;

/** Default best-of per round, overridden by `bo` ({ r64: 3, ... }). */
export function boFor(round, bo = {}) {
  const v = Number(bo[round]);
  if (BO_CHOICES.includes(v)) return v;
  return [...ROUNDS, THIRD].find((r) => r.key === round).bo;
}

/**
 * Every match of the bracket with its two participants (slot numbers or null), score and winner.
 * slots: array of 64 (team object or null). scores: { [matchId]: { a, b, sa, sb } } where a/b are the
 * participants the score was entered for; a score whose participants changed is ignored.
 * A first-round match with a single team is a bye: that team goes through, nothing to play.
 */
export function buildBracket(slots, scores = {}, bo = {}) {
  const has = (slot) => (slot != null && slots[slot - 1] ? slot : null);
  const out = [];
  const byId = {};
  let prev = null;
  for (const r of ROUNDS) {
    const row = [];
    for (let i = 0; i < r.count; i++) {
      let a;
      let b;
      if (!prev) {
        a = has(2 * i + 1);
        b = has(2 * i + 2);
      } else {
        a = prev[2 * i].winner;
        b = prev[2 * i + 1].winner;
      }
      row.push(finish({ id: matchId(r.key, i), round: r.key, idx: i, a, b }, scores, bo, !prev));
    }
    out.push(...row);
    prev = row;
  }
  const sf = prev && out.filter((m) => m.round === "sf");
  const third = finish(
    { id: matchId("third", 0), round: "third", idx: 0, a: sf[0].loser, b: sf[1].loser },
    scores,
    bo,
    false
  );
  out.push(third);
  for (const m of out) byId[m.id] = m;
  return { matches: out, byId };
}

function finish(m, scores, bo, first) {
  m.bo = boFor(m.round, bo);
  m.bye = first && ((m.a && !m.b) || (!m.a && m.b));
  m.sa = null;
  m.sb = null;
  m.winner = null;
  m.loser = null;
  if (m.bye) {
    m.winner = m.a || m.b;
    return m;
  }
  const s = scores[m.id];
  if (s && m.a && m.b && s.a === m.a && s.b === m.b && s.sa != null && s.sb != null) {
    const res = calc(m.bo, s.sa, s.sb, m.a, m.b);
    if (res) {
      m.sa = s.sa;
      m.sb = s.sb;
      m.winner = res.winner;
      m.loser = res.loser;
    }
  }
  return m;
}

/** 1st to 4th (slot numbers or null) from the Grand Final and the Third Place Match. */
export function podium(bracket) {
  const gf = bracket.byId[matchId("gf", 0)];
  const th = bracket.byId[matchId("third", 0)];
  return [gf.winner, gf.loser, th.winner, th.loser];
}

/** Checks a score for a match. Returns an error message or "". */
export function checkScore(m, sa, sb) {
  if (!m.a || !m.b) return "Both teams must be known before a score can be entered.";
  if (m.bye) return "This match is a bye.";
  if (!calc(m.bo, sa, sb, m.a, m.b)) return `One team must reach ${needWins(m.bo)} maps, the other fewer.`;
  return "";
}

/**
 * Slots in bracket order from a pasted list, one team per line, blank lines keep an empty slot.
 * A line is "Name" or "Name ; players ; staff", e.g. "Team A ; azury|de, musashi|de ; Chap|fr|coach".
 */
export function slotsFromLines(text) {
  const rows = String(text || "")
    .split(/\r?\n/)
    .map((line) => {
      const [name = "", roster = "", staff = ""] = line.split(";").map((x) => x.trim());
      return { name: name.slice(0, 40), roster: roster.slice(0, 240), staff: staff.slice(0, 200) };
    });
  while (rows.length && !rows[rows.length - 1].name) rows.pop();
  return rows.slice(0, SLOTS);
}
