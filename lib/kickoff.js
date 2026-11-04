// VCT EMEA Kickoff: 12 teams, triple-elimination bracket (Upper, Mid and Lower brackets). Pure rules, no I/O.
import { calc } from "./tournament.js";

export const KICK_SLOTS = 12;

/** The 12 default participants: 8 invited partner teams and 4 places that come from qualifiers. */
export const KICK_DEFAULTS = [
  { name: "Team Vitality", entry: "invited" },
  { name: "Karmine Corp", entry: "invited" },
  { name: "FUT Esports", entry: "invited" },
  { name: "Team Liquid", entry: "invited" },
  { name: "BBL Esports", entry: "invited" },
  { name: "Fnatic", entry: "invited" },
  { name: "Team Heretics", entry: "invited" },
  { name: "Gentle Mates", entry: "invited" },
  { name: "", entry: "qualified", source: "EU Qualifier", pos: 1 },
  { name: "", entry: "qualified", source: "EU Qualifier", pos: 2 },
  { name: "", entry: "qualified", source: "MENA Qualifier", pos: 1 },
  { name: "", entry: "qualified", source: "TR Qualifier", pos: 1 },
];

/** Columns of each bracket: [match id prefix, title, number of matches]. */
export const KICK_SECTIONS = [
  { key: "ub", name: "Upper Bracket", rounds: [["u1", "Upper Bracket Round 1", 4], ["u2", "UB Quarterfinals", 4], ["u3", "Upper Bracket Semifinals", 2], ["u4", "Upper Bracket Final", 1]] },
  { key: "mb", name: "Mid Bracket", rounds: [["m1", "Mid Bracket Round 1", 4], ["m2", "Mid Bracket Round 2", 2], ["m3", "Mid Bracket Quarterfinals", 2], ["m4", "Mid Bracket Semifinals", 1], ["m5", "Mid Bracket Final", 1]] },
  { key: "lb", name: "Lower Bracket", rounds: [["l1", "Lower Bracket Round 1", 2], ["l2", "Lower Bracket Round 2", 2], ["l3", "Lower Bracket Round 3", 2], ["l4", "LB Quarterfinals", 1], ["l5", "Lower Bracket Semifinals", 1], ["l6", "Lower Bracket Final", 1]] },
];

const mid = (p, i, n) => (n === 1 ? p : `${p}-${i + 1}`);
export const KICK_IDS = KICK_SECTIONS.flatMap((s) => s.rounds.flatMap(([p, , n]) => Array.from({ length: n }, (_, i) => mid(p, i, n))));
export const isKickId = (id) => KICK_IDS.includes(id);

/**
 * The teams already placed by hand in the other matches: every team enters the Kickoff once, in Upper Bracket Round 1
 * or as a UB Quarterfinal seed (losers then drop by themselves). manual: { [id]: { a, b } }; except: the match being edited.
 */
export function kickPlacedElsewhere(manual, except) {
  const used = new Set();
  for (const id of KICK_IDS) {
    if (id === except || !manual[id]) continue;
    const f = feedOf(id);
    for (const k of ["a", "b"]) if (!f[k] && manual[id][k]) used.add(manual[id][k]);
  }
  return used;
}

/** True when a side of a match is chosen by hand (no earlier match feeds it). */
export const isHandSide = (id, k) => isKickId(id) && !feedOf(id)[k];

/**
 * Where each side (a/b) of a match comes from: [match id, "winner" | "loser"]. A side with no feed is set by hand:
 * only the 8 teams of Upper Bracket Round 1 and the 4 seeds of the UB Quarterfinals (side a).
 * Losers drop by themselves, as at the VCT EMEA Kickoff: Upper -> Mid -> Lower bracket.
 */
export function feedOf(id) {
  const [p, n] = id.split("-");
  const i = Number(n);
  const W = (x) => [x, "winner"];
  const L = (x) => [x, "loser"];
  switch (p) {
    // Upper: seeds (by hand) meet the Round 1 winners
    case "u2": return { b: W(`u1-${i}`) };
    case "u3": return i === 1 ? { a: W("u2-1"), b: W("u2-2") } : { a: W("u2-3"), b: W("u2-4") };
    case "u4": return { a: W("u3-1"), b: W("u3-2") };
    // Mid: UB Quarterfinal losers (in reverse order) against UB Round 1 losers, then the later UB losers drop in
    case "m1": return { a: L(`u2-${5 - i}`), b: L(`u1-${i}`) };
    case "m2": return i === 1 ? { a: W("m1-1"), b: W("m1-2") } : { a: W("m1-3"), b: W("m1-4") };
    case "m3": return { a: L(`u3-${i}`), b: W(`m2-${i}`) };
    case "m4": return { a: W("m3-1"), b: W("m3-2") };
    case "m5": return { a: L("u4"), b: W("m4") };
    // Lower: Mid Round 1 losers, then Mid Round 2 losers (crossed), Mid Quarterfinal, Semifinal and Final losers drop in
    case "l1": return i === 1 ? { a: L("m1-1"), b: L("m1-2") } : { a: L("m1-3"), b: L("m1-4") };
    case "l2": return { a: L(`m2-${3 - i}`), b: W(`l1-${i}`) };
    case "l3": return { a: L(`m3-${i}`), b: W(`l2-${i}`) };
    case "l4": return { a: W("l3-1"), b: W("l3-2") };
    case "l5": return { a: L("m4"), b: W("l4") };
    case "l6": return { a: L("m5"), b: W("l5") };
    default: return {};
  }
}

/** Finals of each bracket are Bo5, everything else Bo3. */
export const kickBo = (id) => (["u4", "m5", "l6"].includes(id) ? 5 : 3);

/**
 * manual: { [id]: { a, b } } team numbers 1-12 set by hand. scores: { [id]: { a, b, sa, sb } } (a/b = the teams the score was entered for).
 * Returns every match with its two teams (numbers or null), score and winner; a score whose teams changed is ignored.
 */
export function buildKickoff(manual = {}, scores = {}) {
  const byId = {};
  const sections = KICK_SECTIONS.map((s) => ({
    key: s.key,
    name: s.name,
    rounds: s.rounds.map(([p, title, n]) => ({
      key: p,
      name: title,
      matches: Array.from({ length: n }, (_, i) => {
        const id = mid(p, i, n);
        const f = feedOf(id);
        const hand = manual[id] || {};
        const side = (k) => (f[k] ? (byId[f[k][0]] && byId[f[k][0]][f[k][1]]) || null : hand[k] || null);
        const m = { id, round: p, idx: i, a: side("a"), b: side("b"), feed: f, bo: kickBo(id), sa: null, sb: null, winner: null, loser: null };
        const sc = scores[id];
        if (sc && m.a && m.b && sc.a === m.a && sc.b === m.b && sc.sa != null && sc.sb != null) {
          const res = calc(m.bo, sc.sa, sc.sb, m.a, m.b);
          if (res) Object.assign(m, { sa: sc.sa, sb: sc.sb, winner: res.winner, loser: res.loser });
        }
        byId[id] = m;
        return m;
      }),
    })),
  }));
  return { sections, byId };
}

/**
 * Places 1-12 (team numbers or null). The three bracket winners (Upper, Mid, Lower) are 1st to 3rd and qualify for
 * Masters Seoul; every other team goes out once, in the Lower Bracket, so the round it lost there gives its place:
 * 4 Lower Final, 5 Lower Semifinal, 6 LB Quarterfinal, 7-8 Lower Round 3, 9-10 Lower Round 2, 11-12 Lower Round 1.
 */
export function kickPlaces(b) {
  const m = b.byId;
  return [
    m.u4.winner, m.m5.winner, m.l6.winner,
    m.l6.loser, m.l5.loser, m.l4.loser,
    m["l3-1"].loser, m["l3-2"].loser, m["l2-1"].loser, m["l2-2"].loser, m["l1-1"].loser, m["l1-2"].loser,
  ].map((x) => x || null);
}
