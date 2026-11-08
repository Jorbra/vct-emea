// The Toornament round on made-up data: no network, in memory.
import test from "node:test";
import assert from "node:assert/strict";
import { applySync, planSync, readMatch, readParticipant, syncDue } from "../lib/toornament.js";
import { openDb, getQualifier, getMatchTimes, getMatchLive } from "../lib/db.js";
import { buildBracket, roundsFor } from "../lib/bracket.js";
import { groupMessages } from "../lib/discord.js";
import { matchesOf } from "../lib/matchlist.js";
import { scoreLabel } from "../lib/scoretext.js";
import { importFlags, setQualifierSlot, saveQualifierScore } from "../lib/qactions.js";
import { setMatchTime } from "../lib/db.js";

// an 8-team bracket on Toornament: 4 + 2 + (final, third place)
const AT = { 1: "2026-11-09T18:00:00+00:00", 2: "2026-11-09T20:00:00+00:00", 3: "2026-11-10T18:00:00+00:00" };
const row = (round, n, a, b, extra = {}) => ({ round, n, at: AT[round], status: "pending", type: "single_elimination", a: { pid: a || "", name: a ? a.toUpperCase() : "", score: null, result: "", forfeit: false }, b: { pid: b || "", name: b ? b.toUpperCase() : "", score: null, result: "", forfeit: false }, ...extra });
const start = () => [row(1, 1, "a", "b"), row(1, 2, "c", "d"), row(1, 3, "e", "f"), row(1, 4, "g", "h"), row(2, 1), row(2, 2), row(3, 1), row(3, 2)];
const teams = () => Object.fromEntries("abcdefgh".split("").map((p) => [p, { pid: p, name: p.toUpperCase(), logo: "123", players: [`${p}1`, `${p}2`] }]));
const win = (r, sa, sb) => { r.status = "completed"; r.a.score = sa; r.b.score = sb; r.a.result = sa > sb ? "win" : "loss"; r.b.result = sa > sb ? "loss" : "win"; };
const site = (db, event = "meq1") => ({ ...getQualifier(db, event), times: getMatchTimes(db)[event], live: getMatchLive(db)[event] });
const store = {};
const save = (kind, key, entry) => { store[`${kind}:${key}`] = entry; };
const round = (db, rows, t = null, event = "meq1") => {
  const plan = planSync({ event, rows, teams: t, site: site(db, event), last: store[`tsync:${event}`] || {} });
  if (plan && !plan.blocked) applySync(db, event, plan, save);
  return plan;
};
const fresh = () => { for (const k of Object.keys(store)) delete store[k]; return openDb(":memory:"); };

test("an empty qualifier takes Toornament's teams, size and times; no bracket yet changes nothing", () => {
  const db = fresh();
  assert.equal(planSync({ event: "meq1", rows: [], teams: null, site: site(db) }), null);
  // a bracket not drawn yet: its times only, no team
  const timesOnly = planSync({ event: "meq1", rows: [row(1, 1), row(1, 2)], teams: null, site: site(db) });
  assert.deepEqual([timesOnly.slots.length, timesOnly.times.length], [0, 2]);
  assert.equal(planSync({ event: "meq1", rows: [row(1, 1, "", "", { at: "" }), row(1, 2, "", "", { at: "" })], teams: null, site: site(db) }), null);
  round(db, start(), teams());
  const q = getQualifier(db, "meq1");
  assert.equal(q.slots.length, 8);
  assert.equal(q.slots[0].name, "A");
  assert.equal(q.slots[7].roster, "h1, h2");
  assert.equal(buildBracket(q.slots, q.scores, q.bo).matches.length, 8);
  const t = getMatchTimes(db).meq1;
  assert.equal(t["qf-1"], "2026-11-09T18:00:00.000Z");
  assert.equal(t["gf-1"], "2026-11-10T18:00:00.000Z");
  assert.equal(t["third-1"], "2026-11-10T18:00:00.000Z");
});

test("results fill the bracket round by round, final and third place told apart by their teams", () => {
  const db = fresh();
  const rows = start();
  round(db, rows, teams());
  // Bo3 quarters; final numbered second on purpose
  win(rows[0], 2, 0); win(rows[1], 0, 2); win(rows[2], 2, 1); win(rows[3], 1, 2);
  rows[4].a = { ...rows[4].a, pid: "a", name: "A" }; rows[4].b = { ...rows[4].b, pid: "d", name: "D" };
  rows[5].a = { ...rows[5].a, pid: "e", name: "E" }; rows[5].b = { ...rows[5].b, pid: "h", name: "H" };
  win(rows[4], 2, 0); win(rows[5], 2, 1);
  rows[7].a = { ...rows[7].a, pid: "a", name: "A" }; rows[7].b = { ...rows[7].b, pid: "e", name: "E" };
  rows[6].a = { ...rows[6].a, pid: "d", name: "D" }; rows[6].b = { ...rows[6].b, pid: "h", name: "H" };
  win(rows[7], 3, 1); win(rows[6], 2, 0);
  const plan = round(db, rows);
  assert.equal(plan.mismatch, 0);
  assert.equal(plan.guessed, 0);
  const q = getQualifier(db, "meq1");
  const b = buildBracket(q.slots, q.scores, q.bo);
  assert.equal(b.byId["qf-2"].winner, 4);
  assert.equal(b.byId["gf-1"].winner, 1);
  assert.equal(b.byId["third-1"].winner, 4);
});

test("a result on Toornament's side reversed from the site's, a forfeit and a number that fits nothing", () => {
  const db = fresh();
  const rows = start();
  round(db, rows, teams());
  const [x, y] = [rows[0].a, rows[0].b];
  rows[0].a = y; rows[0].b = x; // b listed first
  win(rows[0], 2, 1);
  rows[1].status = "completed"; rows[1].a.result = "win"; rows[1].b.result = "loss"; rows[1].a.forfeit = true;
  win(rows[2], 13, 7);
  const plan = round(db, rows);
  assert.equal(plan.guessed, 0);
  const notes = getQualifier(db, "meq1").notes;
  assert.deepEqual(notes, { "qf-2": "ff", "qf-3": "raw:13-7" });
  const items = matchesOf("meq1", getQualifier(db, "meq1"));
  const tr = (x) => x;
  assert.equal(scoreLabel(items.find((m) => m.id === "qf-1"), tr), "1 – 2");
  assert.equal(scoreLabel(items.find((m) => m.id === "qf-2"), tr), "Forfeit");
  assert.equal(scoreLabel(items.find((m) => m.id === "qf-3"), tr), "13 – 7");
  // a winner with no number at all, and a score corrected by hand drops the note
  rows[3].status = "completed"; rows[3].a.result = "win"; rows[3].b.result = "loss";
  const again = round(db, rows);
  assert.equal(again.guessed, 1);
  assert.equal(getQualifier(db, "meq1").notes["qf-4"], "win");
  assert.equal(saveQualifierScore(db, { event: "meq1", id: "qf-3", sa: 2, sb: 1 }).ok, true);
  assert.equal(getQualifier(db, "meq1").notes["qf-3"], undefined);
  const s = getQualifier(db, "meq1").scores;
  assert.deepEqual([s["qf-1"].sa, s["qf-1"].sb], [1, 2]); // site's a is A, who lost
  assert.deepEqual([s["qf-2"].sa, s["qf-2"].sb], [2, 0]);
  assert.deepEqual([s["qf-3"].sa, s["qf-3"].sb], [2, 1]);
});

test("what an editor changed by hand stays; what Toornament wrote follows it", () => {
  const db = fresh();
  const rows = start();
  round(db, rows, teams());
  // Toornament moves a match, then an editor moves another: only the first follows
  rows[0].at = "2026-11-09T19:00:00+00:00";
  assert.equal(setMatchTime(db, { event: "meq1", id: "qf-2", at: "2026-11-09T22:00:00.000Z" }).ok, true);
  rows[1].at = "2026-11-09T19:30:00+00:00";
  round(db, rows);
  const t = getMatchTimes(db).meq1;
  assert.equal(t["qf-1"], "2026-11-09T19:00:00.000Z");
  assert.equal(t["qf-2"], "2026-11-09T22:00:00.000Z");
  // the editor's score stays against Toornament's, and a team renamed by hand keeps its name
  assert.equal(saveQualifierScore(db, { event: "meq1", id: "qf-3", sa: 2, sb: 0 }).ok, true);
  win(rows[2], 0, 2);
  assert.equal(setQualifierSlot(db, { event: "meq1", slot: 1, name: "Team A Full" }).ok, true);
  round(db, rows);
  const q = getQualifier(db, "meq1");
  assert.equal(q.scores["qf-3"].sa, 2);
  assert.equal(q.slots[0].name, "Team A Full");
  // a result corrected on Toornament replaces its own, and what it led to goes
  win(rows[0], 2, 0);
  round(db, rows);
  rows[4].a = { ...rows[4].a, pid: "a", name: "A" }; rows[4].b = { ...rows[4].b, pid: "c", name: "C" };
  win(rows[1], 2, 0); round(db, rows);
  win(rows[4], 2, 0); round(db, rows);
  assert.ok(getQualifier(db, "meq1").scores["sf-1"]);
  win(rows[0], 0, 2);
  rows[4].status = "pending"; rows[4].a.result = ""; rows[4].b.result = "";
  round(db, rows);
  const after = getQualifier(db, "meq1");
  assert.equal(after.scores["sf-1"], undefined);
  assert.equal(after.scores["qf-1"].sb, 2);
});

test("a team replaced and a line-up changed follow, flags kept; live follows too", () => {
  const db = fresh();
  const rows = start();
  round(db, rows, teams());
  assert.ok(importFlags(db, "a1, fr").ok);
  assert.equal(getQualifier(db, "meq1").slots[0].roster, "a1|fr, a2");
  const t = teams();
  t.a.players = ["a1", "new"];
  t.z = { pid: "z", name: "Z", logo: "", players: ["z1"] };
  rows[1].b = { ...rows[1].b, pid: "z", name: "Z" };
  // an old flag is kept, and Toornament's own record of the roster moves on
  round(db, rows, t);
  const q = getQualifier(db, "meq1");
  assert.equal(q.slots[0].roster, "a1|fr, new");
  assert.equal(q.slots[3].name, "Z");
  assert.equal(q.slots[3].roster, "z1");
  rows[3].status = "running";
  round(db, rows);
  assert.ok(getMatchLive(db).meq1["qf-4"]);
  win(rows[3], 2, 0);
  round(db, rows);
  assert.equal(getMatchLive(db).meq1["qf-4"], undefined);
});

test("nothing it writes lands in the undo steps", () => {
  const db = fresh();
  round(db, start(), teams());
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM undolog").get().n, 0);
  assert.equal(db.prepare("SELECT off FROM undostate").get().off, 0);
  assert.equal(setMatchTime(db, { event: "meq1", id: "qf-1", at: "" }).ok, true);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM undolog").get().n, 1);
});

test("the bracket size refuses a surprise; only single elimination is followed; Q1 stays as it is", () => {
  const db = fresh();
  assert.equal(setQualifierSlot(db, { event: "meq1", slot: 1, name: "Here already" }).ok, true);
  assert.match(planSync({ event: "meq1", rows: start(), teams: teams(), site: site(db) }).blocked, /8 places/);
  assert.equal(planSync({ event: "q2", rows: start().map((r) => ({ ...r, type: "swiss" })), teams: null, site: site(db, "q2") }), null);
  assert.deepEqual(roundsFor(512).map((r) => r.key).slice(0, 2), ["r512", "r256"]);
  assert.deepEqual(roundsFor(64).map((r) => r.key)[0], "r64");
  assert.deepEqual(roundsFor(8).map((r) => r.key), ["qf", "sf", "gf"]);
});

test("readers keep no account detail", () => {
  const p = readParticipant({ id: "1", name: " A  B ", team: { logo: { id: "99" } }, lineup: [{ name: "Krizz#kid", customFieldValues: { riot_id: "x#y" }, playerUser: { id: "7" } }] });
  assert.deepEqual(p, { pid: "1", name: "A B", logo: "99", players: ["Krizz"] });
  const m = readMatch({ round: { number: 1 }, number: 2, scheduledDatetime: "t", status: "running", stage: { type: "single_elimination" }, opponents: [{ participant: { id: "1", name: "A" }, score: 1, result: "win" }, null] });
  assert.equal(m.a.score, 1);
  assert.equal(m.b.pid, "");
});

test("a hot event is read every minute, a cold one every few hours", () => {
  const now = Date.parse("2026-11-09T18:00:00Z");
  const meta = (ago) => ({ at: new Date(now - ago).toISOString(), first: "2026-11-09T18:00:00Z", lastAt: "2026-11-11T18:00:00Z" });
  assert.equal(syncDue(null, now), true);
  assert.equal(syncDue(meta(30000), now), false);
  assert.equal(syncDue(meta(61000), now), true);
  const cold = { at: new Date(now - 3600000).toISOString(), first: "2026-12-01T18:00:00Z", lastAt: "2026-12-03T18:00:00Z" };
  assert.equal(syncDue(cold, now), false);
  // the two days before: every 10 minutes
  const soon = (ago) => ({ at: new Date(now - ago).toISOString(), first: "2026-11-10T12:00:00Z", lastAt: "2026-11-11T18:00:00Z" });
  assert.equal(syncDue(soon(5 * 60000), now), false);
  assert.equal(syncDue(soon(11 * 60000), now), true);
});

test("Discord: 128 lines make a few messages, none too long; a pasted flag list reports what it did not use", () => {
  const lines = Array.from({ length: 128 }, (_, i) => `🔔 **C'est l'heure : Team ${i} vs Team ${i + 1}** · EU Qualifier 1 (Bo3)`);
  const m = groupMessages(lines);
  assert.ok(m.length <= 6);
  assert.ok(m.every((x) => x.length <= 1900));
  assert.equal(m.join("\n").split("\n").length, 128);
  const db = fresh();
  assert.equal(importFlags(db, "").ok, false);
  round(db, start(), teams());
  const r = importFlags(db, "a1, France\nb1; de\nnobody, fr\nc1, nowhere");
  assert.match(r.message, /^2 flags saved\. Not understood or not found: c1, nobody\.$/);
  assert.equal(getQualifier(db, "meq1").slots[0].roster, "a1|fr, a2");
});

test("a match goes live at its time, leaves with its result, and stays off when taken off", async () => {
  const { withAutoLive } = await import("../lib/matchlist.js");
  const { setMatchLive, getState } = await import("../lib/db.js");
  const db = fresh();
  round(db, start(), teams());
  const now = Date.now();
  const iso = (ago) => new Date(now - ago).toISOString();
  const at = (id, ago) => assert.equal(setMatchTime(db, { event: "meq1", id, at: iso(ago) }).ok, true);
  at("qf-1", 60000); // begun
  at("qf-2", -3600000); // still to come
  at("qf-3", 7 * 3600000); // long ago, no result
  at("sf-1", 60000); // its teams are not known
  at("qf-4", 60000);
  let live = getState(db).live.meq1;
  assert.deepEqual(Object.keys(live).sort(), ["qf-1", "qf-4"]);
  assert.deepEqual(live["qf-1"], { a: 0, b: 0 });
  // a result ends it
  assert.equal(saveQualifierScore(db, { event: "meq1", id: "qf-1", sa: 2, sb: 0 }).ok, true);
  assert.equal(getState(db).live.meq1["qf-1"], undefined);
  // taken off by hand: it does not come back, until asked or given a new time
  assert.equal(setMatchLive(db, { event: "meq1", id: "qf-4", live: false }).ok, true);
  assert.equal(getState(db).live.meq1["qf-4"], undefined);
  assert.equal(setMatchLive(db, { event: "meq1", id: "qf-4", live: true }).ok, true);
  assert.ok(getState(db).live.meq1["qf-4"]);
  assert.equal(setMatchLive(db, { event: "meq1", id: "qf-4", live: false }).ok, true);
  at("qf-4", 30000);
  assert.ok(getState(db).live.meq1["qf-4"]);
  // a score in progress is kept
  assert.equal(setMatchLive(db, { event: "meq1", id: "qf-4", live: true, a: 1, b: 0 }).ok, true);
  assert.deepEqual(getState(db).live.meq1["qf-4"], { a: 1, b: 0 });
  // the sum is made in one place
  assert.deepEqual(withAutoLive({ live: {}, times: {} }, {}, now).kickoff, {});
});

test("vlr.gg: its pages are read, its score in maps wins over a score in rounds, never against Toornament's winner", async () => {
  const V = await import("../lib/vlrmatch.js");
  const { vlrScores } = await import("../lib/toornament.js");
  const list = `<a href="/1/a-vs-b" class="wf-module-item match-item"><div class="match-item-vs-team-name"> <div class="text-of"> A </div> </div><div class="match-item-vs-team-name"> <div class="text-of"> B </div> </div><div class="ml mod-completed"></div><div class="match-item-vod"><div class="wf-module-label"> Stats: </div> Overview </div></a>`
    + `<a href="/2/c-vs-d" class="wf-module-item match-item"><div class="match-item-vs-team-name"> <div class="text-of"> C </div> </div><div class="match-item-vs-team-name"> <div class="text-of"> D </div> </div><div class="ml mod-completed"></div><div class="match-item-vod"><div class="wf-module-label"> Stats: </div> Unavailable </div></a>`;
  assert.deepEqual(V.parseEventMatches(list).map((m) => [m.id, m.a, m.b, m.done, m.stats]), [["1", "A", "B", true, true], ["2", "C", "D", true, false]]);
  const page = `<div class="match-header-link-name mod-1"><div class="wf-title-med ">B</div></div><div class="match-header-link-name mod-2"><div class="wf-title-med ">A</div></div>`
    + `<div class="match-header-vs-score"> <span>2</span> : <span>1</span> </div><div class="match-header-vs-note"> Bo3</div>`
    + `<div class="vm-stats-game " data-game-id="10"><div class="score mod-win">13</div><div class="map"><div class="map-name"> Lotus </div></div><div class="score ">7</div></div>`
    + `<div class="vm-stats-game " data-game-id="all"><div class="ovw-row"><div class="ovw-player-name text-of">Pa1ze</div><div data-col="acs"><span class="side mod-both">300</span></div><span data-col="kills"><span class="side mod-both">20</span></span><span data-col="deaths"><span class="side mod-both">10</span></span><span data-col="assists"><span class="side mod-both">5</span></span></div></div>`;
  const p = V.parseVlrMatch(page);
  assert.deepEqual([p.a, p.b, p.sa, p.sb, p.bo], ["B", "A", 2, 1, 3]);
  assert.deepEqual(p.maps, [{ map: "Lotus", a: 13, b: 7, rows: [] }]);
  assert.deepEqual(p.players, [{ name: "Pa1ze", k: 20, d: 10, a: 5, acs: 300 }]);
  const where = V.findSiteMatch([{ id: "qf-1", a: { name: "A" }, b: { name: "B" } }], "B", "A");
  assert.deepEqual(where, { id: "qf-1", swap: true });
  const d = V.detailsFor(p, where.swap, 3);
  assert.deepEqual(d.score, { sa: 1, sb: 2 });
  assert.deepEqual(d.extra.maps, [{ map: "Lotus", a: 7, b: 13, pick: "" }]);
  assert.equal(V.detailsFor({ ...p, bo: 1 }, false, 3).score, null); // another format: not this match
  assert.deepEqual(vlrScores({ "meq1:qf-1": { score: { sa: 2, sb: 1 } }, "meq1:qf-2": { score: null }, "q1:qf-1": { score: { sa: 2, sb: 0 } } }, "meq1"), { "qf-1": { sa: 2, sb: 1 } });

  // in the round: a 13 – 7 from Toornament becomes vlr.gg's 2 – 1; a vlr.gg score naming the other winner is not used
  const db = fresh();
  const rows = start();
  round(db, rows, teams());
  win(rows[0], 13, 7);
  win(rows[1], 13, 9);
  const plan = planSync({ event: "meq1", rows, teams: null, site: { ...site(db), vlr: { "qf-1": { sa: 2, sb: 1 }, "qf-2": { sa: 0, sb: 2 } } }, last: store["tsync:meq1"] });
  applySync(db, "meq1", plan, save);
  const q = getQualifier(db, "meq1");
  assert.deepEqual([q.scores["qf-1"].sa, q.scores["qf-1"].sb, q.notes["qf-1"]], [2, 1, undefined]);
  assert.equal(q.notes["qf-2"], "raw:13-9");
});

test("vlr.gg names written differently: found by the round, where a team plays once", async () => {
  const V = await import("../lib/vlrmatch.js");
  assert.deepEqual(["Round of 256", "Round of 16", "Round of 8", "Round of 4", "Grand Final", "Third Place Match", "?"].map(V.roundKey), ["r256", "r16", "qf", "sf", "gf", "third", ""]);
  const items = [
    { id: "r256-1", a: { name: "FRG Esports" }, b: { name: "Cavalry" } },
    { id: "r256-2", a: { name: "ONYX" }, b: { name: "Oxygen Gaming" } },
    { id: "r256-3", a: { name: "Burger" }, b: { name: "Hivemind" } },
    { id: "r128-1", a: { name: "FRG Esports" }, b: { name: "AMNESIA" } },
  ];
  assert.deepEqual(V.findSiteMatch(items, "FRG", "Cavalry Esports", "r256"), { id: "r256-1", swap: false });
  assert.deepEqual(V.findSiteMatch(items, "Oxygen Gaming", "Team Onyx", "r256"), { id: "r256-2", swap: true });
  assert.deepEqual(V.findSiteMatch(items, "Enisorail", "Hivemind", "r256"), { id: "r256-3", swap: false }); // renamed: the other team decides
  assert.deepEqual(V.findSiteMatch(items, "FRG", "AMNESIA", "r128"), { id: "r128-1", swap: false });
  assert.equal(V.findSiteMatch(items, "FRG", "Cavalry Esports"), null); // without the round, only exact names
  assert.equal(V.findSiteMatch(items, "Nobody", "Else", "r256"), null);
});

test("a bracket that is not full: the teams with a bye wait in round 2, the first round is rebuilt whole", async () => {
  const { fillByes } = await import("../lib/toornament.js");
  const side = (pid, name) => ({ pid, name, score: null, result: "", forfeit: false });
  const none = side("", "");
  const m = (round, n, a, b) => ({ round, n, at: round === 1 ? `2026-11-09T1${n}:00:00Z` : "", status: "pending", type: "single_elimination", a, b });
  const rows = [
    m(1, 1, side("b", "B"), side("c", "C")), m(1, 2, side("e", "E"), side("f", "F")),
    m(2, 1, side("a", "A"), none), m(2, 2, none, side("d", "D")),
    m(3, 1, none, none),
  ];
  const filled = fillByes(rows).filter((r) => r.round === 1);
  assert.deepEqual(filled.map((r) => `${r.n}:${r.a.name || "-"}/${r.b.name || "-"}`), ["1:A/-", "2:B/C", "3:E/F", "4:D/-"]);
  const db = openDb(":memory:");
  const plan = planSync({ event: "meq1", rows, teams: null, site: site(db), last: {} });
  assert.equal(plan.size, 8);
  assert.deepEqual(plan.slots.map((s) => `${s.slot}:${s.name}`).sort(), ["1:A", "3:B", "4:C", "5:E", "6:F", "7:D"].sort());
  // a full first round is left as it is
  assert.equal(fillByes(rows.filter((r) => r.round !== 2)).length, 3);
});
