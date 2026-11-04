// Regional Qualifier Playoffs. Each region has its own format:
//  - Türkiye ("gsl8"): 8 teams, two GSL groups of four, then a four-team double-elimination bracket;
//  - MENA ("se4"): 4 teams, a single-elimination bracket (North Africa #1 v #2, Middle East #1 v #2, Grand Final);
//  - Game Changers EMEA ("de8"): 8 teams, a double-elimination bracket.
// Pure rules, no I/O.
import { calc } from "./tournament.js";

/** The default participants of each region: invited partner teams, then the places that come from that region's qualifiers. */
export const REG_DEFAULTS = {
  tr: [
    { name: "Eternal Fire", tag: "EF", entry: "invited" },
    { name: "PCIFIC Esports", tag: "PCF", entry: "invited" },
    { name: "Fire Flux Esports", tag: "FF", entry: "invited" },
    { name: "Beşiktaş Esports", tag: "BJK", entry: "invited" },
    { name: "", entry: "qualified", source: "Qualifier 1", pos: 1 },
    { name: "", entry: "qualified", source: "Qualifier 1", pos: 2 },
    { name: "", entry: "qualified", source: "Qualifier 2", pos: 1 },
    { name: "", entry: "qualified", source: "Qualifier 2", pos: 2 },
  ],
  gc: Array.from({ length: 8 }, () => ({ name: "", entry: "invited" })), // filled from the Game Changers team list on first start
  mena: [
    { name: "", entry: "qualified", source: "ME Qualifier 1", pos: 1 },
    { name: "", entry: "qualified", source: "ME Qualifier 2", pos: 1 },
    { name: "", entry: "qualified", source: "NA Qualifier 1", pos: 1 },
    { name: "", entry: "qualified", source: "NA Qualifier 2", pos: 1 },
  ],
};
export const REGIONS = Object.keys(REG_DEFAULTS);

/** Each region's open qualifiers (bracket events of bracket.js) and how many of their best teams reach the Qualifier Playoffs. */
export const REG_QUALIFIERS = {
  tr: { "Qualifier 1": "trq1", "Qualifier 2": "trq2" },
  mena: { "ME Qualifier 1": "meq1", "ME Qualifier 2": "meq2", "NA Qualifier 1": "naq1", "NA Qualifier 2": "naq2" }, // their winners only (pos 1)
};
export const REG_QUALIFY = 2;

const groupStage = (g) => ({
  key: `g${g}`,
  name: `Group ${g.toUpperCase()}`,
  rounds: [
    ["o", "Opening Matches", [`g${g}-o1`, `g${g}-o2`]],
    ["w", "Winners' Match", [`g${g}-w`]],
    ["e", "Elimination Match", [`g${g}-e`]],
    ["d", "Decider Match", [`g${g}-d`]],
  ],
});

/**
 * A format: its number of teams, its stages (rounds of match ids, in play order), where each side of a match comes from
 * (feed: [match id, "winner" | "loser"], [group, place] for a group's finisher, ["slot", n] for a fixed participant;
 * no feed = chosen by hand), the best-of of each match and the final places.
 */
const FORMATS = {
  // GSL group: two opening matches (teams by hand), winners' match, elimination match, decider.
  // Group places: 1st = Winners' Match winner, 2nd = Decider winner, 3rd = Decider loser, 4th = Elimination Match loser.
  // Playoffs: upper semifinals (A1 v B2, B1 v A2), upper final, lower semifinal, lower final, grand final.
  gsl8: {
    slots: 8,
    stages: [
      groupStage("a"),
      groupStage("b"),
      {
        key: "po",
        name: "Playoffs",
        rounds: [
          ["ubs", "Upper Bracket Semifinals", ["ub1", "ub2"]],
          ["ubf", "Upper Bracket Final", ["ubf"]],
          ["lbs", "Lower Bracket Semifinals", ["lbs"]],
          ["lbf", "Lower Bracket Final", ["lbf"]],
          ["gf", "Grand Final", ["gf"]],
        ],
      },
    ],
    feed(id) {
      const g = id.slice(0, 2);
      switch (id.slice(3)) {
        case "w": return { a: [`${g}-o1`, "winner"], b: [`${g}-o2`, "winner"] };
        case "e": return { a: [`${g}-o1`, "loser"], b: [`${g}-o2`, "loser"] };
        case "d": return { a: [`${g}-w`, "loser"], b: [`${g}-e`, "winner"] };
        default: break;
      }
      switch (id) {
        case "ub1": return { a: ["ga", 1], b: ["gb", 2] };
        case "ub2": return { a: ["gb", 1], b: ["ga", 2] };
        case "ubf": return { a: ["ub1", "winner"], b: ["ub2", "winner"] };
        case "lbs": return { a: ["ub1", "loser"], b: ["ub2", "loser"] };
        case "lbf": return { a: ["ubf", "loser"], b: ["lbs", "winner"] };
        case "gf": return { a: ["ubf", "winner"], b: ["lbf", "winner"] };
        default: return {}; // the opening matches
      }
    },
    bo: (id) => (id === "gf" ? 5 : 3), // the Grand Final is Bo5, everything else Bo3
    places: (m, groups) => [m.gf.winner, m.gf.loser, m.lbf.loser, m.lbs.loser, groups.ga[2], groups.gb[2], groups.ga[3], groups.gb[3]],
  },
  // Participants: 1 ME Qualifier 1, 2 ME Qualifier 2, 3 NA Qualifier 1, 4 NA Qualifier 2 (each one's winner).
  // The two semifinals are drawn by hand (usually North Africa #1 v #2 and Middle East #1 v #2).
  se4: {
    slots: 4,
    stages: [{ key: "po", name: "Playoffs", rounds: [["sf", "Semifinals", ["sf1", "sf2"]], ["gf", "Grand Final", ["gf"]]] }],
    feed(id) {
      switch (id) {
        case "gf": return { a: ["sf1", "winner"], b: ["sf2", "winner"] };
        default: return {}; // the semifinals
      }
    },
    bo: () => 5, // every match is Bo5
    places: (m) => [m.gf.winner, m.gf.loser, m.sf1.loser, m.sf2.loser], // 3-4 shared by the semifinal losers
  },
  // Eight-team double elimination: upper quarterfinals drawn by hand; losers drop to the lower bracket (crossed in its
  // quarterfinals so two teams do not meet again straight away); the Grand Final is Bo5, everything else Bo3.
  de8: {
    slots: 8,
    stages: [
      {
        key: "ub",
        name: "Upper Bracket",
        rounds: [
          ["ubq", "Upper Bracket Quarterfinals", ["ubq1", "ubq2", "ubq3", "ubq4"]],
          ["ubs", "Upper Bracket Semifinals", ["ubs1", "ubs2"]],
          ["ubf", "Upper Bracket Final", ["ubf"]],
        ],
      },
      {
        key: "lb",
        name: "Lower Bracket",
        rounds: [
          ["lb1", "Lower Bracket Round 1", ["lb1", "lb2"]],
          ["lbq", "Lower Bracket Quarterfinals", ["lbq1", "lbq2"]],
          ["lbs", "Lower Bracket Semifinal", ["lbs"]],
          ["lbf", "Lower Bracket Final", ["lbf"]],
        ],
      },
      { key: "po", name: "Grand Final", rounds: [["gf", "Grand Final", ["gf"]]] },
    ],
    feed(id) {
      const W = (m) => [m, "winner"];
      const L = (m) => [m, "loser"];
      switch (id) {
        case "ubs1": return { a: W("ubq1"), b: W("ubq2") };
        case "ubs2": return { a: W("ubq3"), b: W("ubq4") };
        case "ubf": return { a: W("ubs1"), b: W("ubs2") };
        case "lb1": return { a: L("ubq1"), b: L("ubq2") };
        case "lb2": return { a: L("ubq3"), b: L("ubq4") };
        case "lbq1": return { a: W("lb1"), b: L("ubs2") };
        case "lbq2": return { a: W("lb2"), b: L("ubs1") };
        case "lbs": return { a: W("lbq1"), b: W("lbq2") };
        case "lbf": return { a: W("lbs"), b: L("ubf") };
        case "gf": return { a: W("ubf"), b: W("lbf") };
        default: return {}; // the upper quarterfinals
      }
    },
    bo: (id) => (id === "gf" ? 5 : 3),
    // 1-4 one by one, 5-6 the lower quarterfinal losers, 7-8 the lower round 1 losers
    places: (m) => [m.gf.winner, m.gf.loser, m.lbf.loser, m.lbs.loser, m.lbq1.loser, m.lbq2.loser, m.lb1.loser, m.lb2.loser],
  },
};
export const REG_FORMAT = { tr: "gsl8", mena: "se4", gc: "de8" };
const fmt = (event) => FORMATS[REG_FORMAT[event] || "gsl8"];

export const regSlots = (event) => fmt(event).slots;
export const regStages = (event) => fmt(event).stages;
export const regIds = (event) => fmt(event).stages.flatMap((s) => s.rounds.flatMap(([, , ids]) => ids));
export const isRegId = (id, event) => regIds(event).includes(id);
/** The matches whose teams are chosen by hand (GSL opening matches, MENA semifinals); every other match is fed. */
export const isOpening = (id, event) => isRegId(id, event) && !fmt(event).feed(id).a;

/**
 * The teams already placed by hand in the event's other matches: a team is drawn into one match only.
 * manual: { [id]: { a, b } }; except: the match being edited (its own teams are free to move between its two sides).
 */
export function placedElsewhere(manual, event, except) {
  const used = new Set();
  for (const id of regIds(event)) {
    if (id === except || !isOpening(id, event) || !manual[id]) continue;
    for (const t of [manual[id].a, manual[id].b]) if (t) used.add(t);
  }
  return used;
}
export const regBo = (id, event) => fmt(event).bo(id);

/** A group's places 1-4 (team numbers or null) from its matches. */
function groupPlaces(byId, g) {
  const m = (k) => byId[`${g}-${k}`] || {};
  return [m("w").winner, m("d").winner, m("d").loser, m("e").loser].map((x) => x || null);
}

/**
 * manual: { [id]: { a, b } } team numbers set by hand (opening matches only). scores: { [id]: { a, b, sa, sb } }.
 * Returns every match with its teams, score and winner (a score whose teams changed is ignored), each group's places
 * and the event's final places (team numbers or null; 1st qualifies for the Kickoff).
 */
export function buildRegional(manual = {}, scores = {}, event = "tr") {
  const f = fmt(event);
  const byId = {};
  const groups = {};
  const stages = f.stages.map((s) => {
    const rounds = s.rounds.map(([key, name, ids]) => ({
      key,
      name,
      matches: ids.map((id) => {
        const feed = f.feed(id);
        const hand = manual[id] || {};
        const side = (k) => {
          if (!feed[k]) return hand[k] || null;
          const [from, what] = feed[k];
          if (from === "slot") return what;
          if (typeof what === "number") return (groups[from] || [])[what - 1] || null;
          return (byId[from] && byId[from][what]) || null;
        };
        const m = { id, round: key, a: side("a"), b: side("b"), feed, bo: f.bo(id), sa: null, sb: null, winner: null, loser: null };
        const sc = scores[id];
        if (sc && m.a && m.b && sc.a === m.a && sc.b === m.b && sc.sa != null && sc.sb != null) {
          const res = calc(m.bo, sc.sa, sc.sb, m.a, m.b);
          if (res) Object.assign(m, { sa: sc.sa, sb: sc.sb, winner: res.winner, loser: res.loser });
        }
        byId[id] = m;
        return m;
      }),
    }));
    if (s.key !== "po") groups[s.key] = groupPlaces(byId, s.key);
    return { key: s.key, name: s.name, rounds };
  });
  const places = f.places(byId, groups).map((x) => x || null);
  return { stages, byId, groups, places, format: REG_FORMAT[event] || "gsl8" };
}

/** The final places (team numbers or null), as buildRegional found them. */
export const regPlaces = (b) => b.places;

/** Per team in a group: matches won / lost and maps won / lost, from that group's played matches. */
export function groupStats(b, g) {
  const st = {};
  const add = (t) => (st[t] = st[t] || { w: 0, l: 0, mw: 0, ml: 0 });
  for (const r of b.stages.find((s) => s.key === g).rounds) {
    for (const m of r.matches) {
      if (m.a) add(m.a);
      if (m.b) add(m.b);
      if (m.winner == null) continue;
      st[m.a].mw += m.sa; st[m.a].ml += m.sb;
      st[m.b].mw += m.sb; st[m.b].ml += m.sa;
      st[m.winner].w++; st[m.loser].l++;
    }
  }
  return st;
}
