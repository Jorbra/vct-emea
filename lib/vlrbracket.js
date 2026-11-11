// A qualifier followed on vlr.gg only (no Toornament, like the Türkiye qualifiers): vlr.gg's list of matches, round by round, turned
// into the rows Toornament would give, so that the same round (planSync / applySync) builds the bracket, its results and live matches.
// Pure.
import { roundsFor } from "./bracket.js";

const known = (name) => !!name && !/^tbd$/i.test(String(name).trim());

/** vlr.gg's round of a match: "Round of 128" … "Round of 4", then the seed decider (the final between the two semifinal winners). */
export const vlrRound = (v) => v.round || (/seed decider|grand final|final/i.test(v.stage || "") ? "gf" : "");

/**
 * The rows of a bracket from vlr.gg's list (matches of one qualifier, in vlr.gg's order): [{ round, n, status, a, b, … }].
 * The places are worked out from the last round down: a team's earlier match sits under its place; a team with no earlier match
 * goes on alone (a bye, possibly over several rounds); unknown places take the round's other matches in vlr.gg's order.
 */
export function vlrRows(list) {
  const firstN = Math.max(0, ...list.map((v) => Number((/^r(\d+)$/.exec(vlrRound(v)) || [])[1]) || 0));
  if (!firstN || firstN & (firstN - 1)) return [];
  const rounds = roundsFor(firstN).map((r) => r.key);
  const by = Object.fromEntries(rounds.map((k) => [k, list.filter((v) => vlrRound(v) === k)]));
  const L = rounds.length;
  // positions[k][p]: { match } | { team } (goes on alone) | null (nobody) | PENDING (not known yet: takes one of the round's matches)
  const PENDING = {};
  const positions = [];
  positions[L - 1] = [by[rounds[L - 1]][0] ? { match: by[rounds[L - 1]][0] } : PENDING];
  for (let k = L - 1; k >= 1; k--) {
    const lower = by[rounds[k - 1]];
    const used = new Set();
    const next = [];
    for (const e of positions[k]) {
      if (e === PENDING) { next.push(PENDING, PENDING); continue; }
      if (!e) { next.push(null, null); continue; }
      if (e.team) { next.push({ team: e.team }, null); continue; }
      for (const side of ["a", "b"]) {
        const name = e.match[side];
        if (!known(name)) { next.push(PENDING); continue; }
        const m = lower.find((x) => !used.has(x) && (x.a === name || x.b === name));
        if (m) { used.add(m); next.push({ match: m }); } else next.push({ team: name });
      }
    }
    const rest = lower.filter((x) => !used.has(x));
    positions[k - 1] = next.map((e) => (e === PENDING ? (rest.length ? { match: rest.shift() } : k - 1 === 0 ? null : PENDING) : e));
  }
  const rows = [];
  const side = (name, score, won, lost) => ({ pid: known(name) ? name : "", name: known(name) ? name : "", score, result: won ? "win" : lost ? "loss" : "", forfeit: false });
  positions.forEach((list2, k) => list2.forEach((e0, p) => {
    const e = e0 === PENDING ? null : e0;
    const m = e && e.match;
    const t = e && e.team;
    const done = !!(m && m.done && m.sa != null && m.sb != null && m.sa !== m.sb);
    const aWin = done && m.sa > m.sb;
    rows.push({
      round: k + 1, n: p + 1, at: "", status: m ? (done ? "completed" : m.live ? "running" : "pending") : "pending", type: "single_elimination",
      a: m ? side(m.a, done ? m.sa : null, aWin, done && !aWin) : side(k === 0 ? t || "" : "", null, false, false),
      b: m ? side(m.b, done ? m.sb : null, done && !aWin, aWin) : side("", null, false, false),
    });
  }));
  return rows;
}
