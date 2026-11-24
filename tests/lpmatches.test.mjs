// The EU Qualifier Playoffs' matches read from Liquipedia's pages, as a second source.
import test from "node:test";
import assert from "node:assert/strict";
import { openDb, getState, dropStateCache } from "../lib/db.js";
import { updateTeam, setSwissMatch, saveScore } from "../lib/actions.js";
import { applyPlayoffs, lpMatchPages, parseLp, parseLpMatches, teamOf } from "../lib/lpmatches.js";
import { readSources, saveSource } from "../lib/sources.js";

// the page as Liquipedia shows it, cut down to what is read: a match list and a bracket match
const listMatch = (a, b, sa, sb, ts, done = true) => `<div class="brkts-matchlist-match brkts-match-has-details brkts-match-popup-wrapper"><div class="brkts-matchlist-cell brkts-matchlist-opponent brkts-opponent-hover" aria-label="${a}"><div class="block-team"><span class="name"><div class="team-name">${a}</div></span></div></div><div class="brkts-matchlist-cell brkts-matchlist-score brkts-opponent-hover" aria-label="${a}"><div class="brkts-matchlist-cell-content">${sa ?? ""}</div></div><div class="brkts-match-info-icon"></div><div class="brkts-matchlist-cell brkts-matchlist-score brkts-matchlist-slot-bold brkts-opponent-hover" aria-label="${b}"><div class="brkts-matchlist-cell-content">${sb ?? ""}</div></div><div class="brkts-matchlist-cell brkts-matchlist-opponent brkts-matchlist-slot-winner brkts-opponent-hover" aria-label="${b}"><div class="block-team"></div></div><div class="brkts-popup"><span class="timer-object" data-timestamp="${ts}"${done ? ' data-finished="finished"' : ""}>x</span></div></div>`;
const list = (title, matches) => `<div class="brkts-matchlist brkts-matchlist-collapsible"><div class="brkts-matchlist-title">${title}<span class="brkts-matchlist-collapse-button">Show</span></div>${matches.join("")}</div>`;
const brMatch = (a, b, sa, sb, ts, done = true) => `<div class="brkts-match brkts-match-popup-wrapper brkts-match-has-details" style="x"><div class="brkts-opponent-entry brkts-opponent-hover" aria-label="${a}" style="height:24px"><div class="brkts-opponent-score-outer"><div class="brkts-opponent-score-inner"><b>${sa ?? ""}</b></div></div></div><div class="brkts-opponent-entry brkts-opponent-entry-last brkts-opponent-hover" aria-label="${b}" style="height:24px"><div class="brkts-opponent-score-outer"><div class="brkts-opponent-score-inner">${sb ?? ""}</div></div></div><div class="brkts-popup"><span data-timestamp="${ts}"${done ? ' data-finished="finished"' : ""}></span></div></div>`;
const bracket = (matches) => `<div class="brkts-bracket-wrapper"><div class="brkts-bracket" style="x">${matches.join("")}</div></div>`;

const NAMES = ["UCAM Esports", "Eintracht Frankfurt", "MIR", "Joblife", "NAVI Junior", "Mandatory", "GIANTX", "Enterprise Esports", "Aurora Gaming", "F9 Eicar", "Pixel Lumina", "xXxMasterProMegaTeamxXx", "Barça eSports", "CGN ESPORTS", "WIP Esports", "La masia"];
// Liquipedia writes some of them otherwise
const LP = { "Barça eSports": "Barca Esports", "CGN ESPORTS": "CGN Esports", "La masia": "la Masia", "F9 Eicar": "F9 EICAR" };
const lpName = (n) => LP[n] || n;

function freshDb() {
  const db = openDb(":memory:");
  const { teams } = getState(db);
  teams.forEach((t, i) => assert.equal(updateTeam(db, t.id, { name: NAMES[i], tag: "", status: i < 8 ? "invited" : "qualified", roster: "" }).ok, true));
  dropStateCache();
  return db;
}
const T0 = 1795600800; // 25 Nov 2026, 15:00 UTC

test("links: a Liquipedia page from what people paste", () => {
  assert.equal(parseLp("https://liquipedia.net/valorant/VCT/2027/EMEA/Kickoff/Europe"), "VCT/2027/EMEA/Kickoff/Europe");
  assert.equal(parseLp("https://liquipedia.net/valorant/VCT/2027/EMEA/Kickoff/Europe/Swiss_Stage"), "VCT/2027/EMEA/Kickoff/Europe");
  assert.equal(parseLp("https://liquipedia.net/valorant/VCT/2027/EMEA/Kickoff/"), "VCT/2027/EMEA/Kickoff");
  assert.equal(parseLp("VCT/2027/EMEA/Kickoff/Europe"), "VCT/2027/EMEA/Kickoff/Europe");
  assert.equal(parseLp("https://example.com/x"), "");
});

test("sources: a Liquipedia link, even pasted in the vlr.gg box, for the EU Qualifier Playoffs only", () => {
  const db = openDb(":memory:");
  assert.deepEqual(lpMatchPages(db).playoffs, ["VCT/2027/EMEA/Kickoff/Europe/Swiss_Stage", "VCT/2027/EMEA/Kickoff/Europe"]);
  const r = saveSource(db, { event: "playoffs", vlr: "https://liquipedia.net/valorant/VCT/2027/EMEA/Kickoff/Europe/Swiss_Stage" });
  assert.equal(r.ok, true, r.error);
  assert.equal(readSources(db).playoffs.lp, "VCT/2027/EMEA/Kickoff/Europe");
  assert.equal(readSources(db).playoffs.vlr, "");
  assert.equal(saveSource(db, { event: "q1", lp: "https://liquipedia.net/valorant/VCT/2027/EMEA/Kickoff/Europe/Qualifier_1" }).ok, false);
  assert.equal(saveSource(db, { event: "playoffs", lp: "off" }).ok, true);
  assert.equal(lpMatchPages(db).playoffs, undefined);
});

test("page: each match's teams, score, time and whether it is over", () => {
  const html = list("Round 1 Matches", [listMatch("UCAM Esports", "Barca Esports", 2, 1, T0), listMatch("TBD", "TBD", null, null, T0 + 3600, false)])
    + bracket([brMatch("GIANTX", "MIR", 2, 0, T0 + 86400)]);
  const found = parseLpMatches(html);
  assert.equal(found.length, 3);
  assert.deepEqual(found[0], { kind: "list", title: "Round 1 Matches", bracket: -1, a: "UCAM Esports", b: "Barca Esports", sa: 2, sb: 1, done: true, at: new Date(T0 * 1000).toISOString() });
  assert.equal(found[1].a, "");
  assert.equal(found[1].done, false);
  assert.equal(found[2].kind, "bracket");
  assert.equal(found[2].bracket, 0);
  assert.deepEqual([found[2].a, found[2].b, found[2].sa, found[2].sb], ["GIANTX", "MIR", 2, 0]);
});

test("names: Liquipedia's spelling finds the site's team", () => {
  const db = freshDb();
  const { teams } = getState(db);
  assert.equal(teamOf(teams, "Barca Esports"), teams[12].id);
  assert.equal(teamOf(teams, "CGN Esports"), teams[13].id);
  assert.equal(teamOf(teams, "la Masia"), teams[15].id);
  assert.equal(teamOf(teams, "Fnatic"), "");
  // well-known short forms, and the names editors tied to a team
  assert.equal(teamOf(teams, "Natus Vincere Junior"), teams[4].id);
  assert.equal(teamOf(teams, "UCAM Esports Club"), teams[0].id);
  assert.equal(teamOf(teams, "MIR Gaming Pro", { "MIR Gaming Pro": { name: "MIR", tag: "" } }), teams[2].id);
});

test("Swiss stage: Liquipedia's pairings and scores fill the empty round; an editor's match stays", async () => {
  const db = freshDb();
  const { teams } = getState(db);
  // an editor already placed the first match of round 1, with other teams than Liquipedia
  assert.equal(setSwissMatch(db, { id: "s1-m01", a: teams[0].id, b: teams[15].id }).ok, true);
  dropStateCache();
  const pairs = [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9], [10, 11], [12, 13], [14, 15]];
  const html = list("Round 1 Matches", pairs.map(([i, j], k) => listMatch(lpName(NAMES[i]), lpName(NAMES[j]), 2, k % 2, T0 + k * 3600)));
  const changes = await applyPlayoffs(db, parseLpMatches(html));
  const st = getState(db);
  const r1 = st.matches.filter((m) => m.stage === "swiss" && Number(m.round) === 1);
  // the editor's match stays; Liquipedia's six that do not use its two teams are placed, scored and timed
  assert.equal(r1.find((m) => m.id === "s1-m01").b, teams[15].id);
  assert.equal(r1.length, 7);
  const m = r1.find((x) => x.a === teams[2].id || x.b === teams[2].id);
  assert.equal(m.a === teams[2].id ? m.sa : m.sb, 2);
  assert.ok(st.times.playoffs[m.id]);
  assert.ok(changes.some((c) => c.startsWith("Round 1:")));
  // read again: nothing more to do
  dropStateCache();
  assert.deepEqual(await applyPlayoffs(db, parseLpMatches(html)), []);
});

test("Swiss stage: a score already on the site is never changed", async () => {
  const db = freshDb();
  const { teams } = getState(db);
  assert.equal(setSwissMatch(db, { id: "s1-m01", a: teams[2].id, b: teams[3].id }).ok, true);
  assert.equal(saveScore(db, { id: "s1-m01", sa: 0, sb: 2 }).ok, true);
  dropStateCache();
  await applyPlayoffs(db, parseLpMatches(list("Round 1 Matches", [listMatch(NAMES[2], NAMES[3], 2, 1, T0)])));
  const m = getState(db).matches.find((x) => x.id === "s1-m01");
  assert.deepEqual([m.sa, m.sb], [0, 2]);
});

test("bracket: Liquipedia's semifinals are placed in their group, then the scores make the final", async () => {
  const { generateSwiss } = await import("../lib/actions.js");
  const { bracketDraw } = await import("../lib/tournament.js");
  const db = freshDb();
  // the Swiss stage played on the site: the better seed wins
  for (let round = 1; round <= 5; round++) {
    dropStateCache();
    const g = generateSwiss(db); assert.equal(g.ok, true, `round ${round}: ${g.error}`);
    dropStateCache();
    const { teams, matches } = getState(db);
    const order = Object.fromEntries(teams.map((t) => [t.id, t.order]));
    for (const m of matches.filter((x) => x.stage === "swiss" && Number(x.round) === round)) {
      assert.equal(saveScore(db, { id: m.id, sa: order[m.a] < order[m.b] ? 2 : 0, sb: order[m.a] < order[m.b] ? 0 : 2 }).ok, true);
    }
  }
  dropStateCache();
  const st = getState(db);
  const adv = bracketDraw(st.teams, st.matches).adv;
  assert.equal(adv.length, 8);
  const name = (id) => lpName(st.teams.find((t) => t.id === id).name);
  const [a1, a2, a3, a4, b1, b2, b3, b4] = adv.map(name);
  const html = bracket([brMatch(a1, a2, 2, 1, T0), brMatch(a3, a4, 0, 2, T0 + 3600), brMatch(a1, a4, 3, 1, T0 + 86400)])
    + bracket([brMatch(b1, b2, null, null, T0 + 7200, false), brMatch(b3, b4, null, null, T0 + 9000, false), brMatch("TBD", "TBD", null, null, T0 + 90000, false)]);
  const changes = await applyPlayoffs(db, parseLpMatches(html));
  dropStateCache();
  const elim = Object.fromEntries(getState(db).matches.filter((m) => m.stage === "elim").map((m) => [m.id, m]));
  assert.deepEqual([elim["eA-s1"].a, elim["eA-s1"].b, elim["eA-s1"].sa, elim["eA-s1"].sb], [adv[0], adv[1], 2, 1]);
  assert.deepEqual([elim["eA-f"].a, elim["eA-f"].b, elim["eA-f"].sa, elim["eA-f"].sb], [adv[0], adv[3], 3, 1]);
  assert.deepEqual([elim["eB-s1"].a, elim["eB-s2"].a, elim["eB-s1"].sa], [adv[4], adv[6], null]);
  assert.ok(changes.some((c) => c.startsWith("Bracket B:")));
});
