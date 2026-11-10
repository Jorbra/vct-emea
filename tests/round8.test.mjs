// Round 8: simulator, tier lists, hall of fame, rivalries, polls, scheduled scores, day board, the bot's new commands.
import test from "node:test";
import assert from "node:assert/strict";
import { getState, openDb, setMatchTime } from "../lib/db.js";
import { saveQualifierScore, setQualifierTeams } from "../lib/qactions.js";
import { allMatches } from "../lib/matchlist.js";
import { closePoll, communityTiers, createPoll, currentPoll, dayBoard, listScheduledScores, rivalries, saveTierlist, scheduleScore, seasonHonours, simEvents, simulate, tiersFromParam, tiersToParam, votePoll } from "../lib/round8.js";
import { applyDueScores } from "../lib/r8apply.js";
import { COMMANDS } from "../lib/discordbot.js";
import { BOT_COMMANDS } from "../lib/botstore.js";

const T = "k".repeat(40);
const U = "m".repeat(40);

function qualifier() {
  const db = openDb(":memory:");
  setQualifierTeams(db, "meq1", Array.from({ length: 8 }, (_, i) => `Team ${i}`).join("\n"));
  return db;
}

test("simulator: chances add up to the places, a forced pick and a known result count", () => {
  const db = qualifier();
  const state = getState(db);
  assert.ok(simEvents(state).includes("meq1"));
  const rating = new Map([["team-0", 1900]]);
  const s = simulate(state, "meq1", rating, {}, { n: 1000 });
  assert.equal(s.need, 1);
  const total = s.teams.reduce((x, t) => x + t.pct, 0);
  assert.ok(Math.abs(total - 100) < 1, String(total));
  assert.equal(s.teams[0].name, "Team 0");
  // Team 0 loses its first match: no chance left
  const first = s.next.find((m) => m.aName === "Team 0" || m.bName === "Team 0");
  const other = first.aName === "Team 0" ? first.b : first.a;
  const forced = simulate(state, "meq1", rating, { [first.id]: other }, { n: 500 });
  assert.equal((forced.teams.find((t) => t.name === "Team 0") || { pct: 0 }).pct, 0);
  saveQualifierScore(db, { event: "meq1", id: first.id, sa: first.aName === "Team 0" ? 0 : 1, sb: first.aName === "Team 0" ? 1 : 0 });
  const after = simulate(getState(db), "meq1", rating, {}, { n: 500 });
  assert.equal(after.teams.find((t) => t.name === "Team 0"), undefined);
});

test("tier lists: cleaned, averaged, as a short text", () => {
  const db = openDb(":memory:");
  const teams = ["fnatic", "th", "kc", "tl"].map((slug) => ({ slug, name: slug }));
  assert.equal(saveTierlist(db, teams, { token: T, tiers: { S: ["fnatic"], A: ["th"] } }).ok, false); // 2 teams only
  assert.equal(saveTierlist(db, teams, { token: T, tiers: { S: ["fnatic", "fnatic", "nobody"], A: ["th", "kc"] } }).ok, true);
  assert.equal(saveTierlist(db, teams, { token: U, tiers: { S: ["fnatic"], B: ["th", "kc"], D: ["tl"] } }).ok, true);
  const c = communityTiers(db, teams);
  assert.equal(c.lists, 2);
  assert.deepEqual(c.tiers.S, ["fnatic"]);
  assert.ok(c.tiers.A.includes("th") || c.tiers.B.includes("th"));
  assert.deepEqual(c.tiers.D, ["tl"]);
  const p = tiersToParam({ S: ["fnatic"], A: ["th", "kc"], B: [] });
  assert.equal(p, "S:fnatic;A:th,kc");
  assert.deepEqual(tiersFromParam(p), { S: ["fnatic"], A: ["th", "kc"] });
});

test("hall of fame and rivalries", () => {
  const db = openDb(":memory:");
  setQualifierTeams(db, "meq1", Array.from({ length: 64 }, (_, i) => `Team ${i}`).join("\n"));
  // play the whole qualifier: side a always wins
  for (let k = 0; k < 10; k++) {
    const open = allMatches(getState(db)).filter((m) => m.event === "meq1" && m.a && m.b && m.a.name && m.b.name && m.sa == null);
    for (const m of open) for (const w of [1, 2, 3]) if (saveQualifierScore(db, { event: "meq1", id: m.id, sa: w, sb: 0 }).ok) break;
  }
  const h = seasonHonours(getState(db), [{ name: "Team 0" }]);
  assert.deepEqual(h.honours.map((x) => [x.event, x.winner]), [["meq1", "Team 0"]]);
  assert.equal(h.strongest, "Team 0");
  assert.deepEqual(rivalries(getState(db)), []); // nobody met twice
});

test("polls: one vote each, changed, closed", () => {
  const db = openDb(":memory:");
  assert.equal(createPoll(db, { question: "Q ?", options: "A\nB" }).ok, false); // too short
  assert.equal(createPoll(db, { question: "Qui gagne ?", options: "Fnatic" }).ok, false);
  assert.equal(createPoll(db, { question: "Qui gagne ?", options: "Fnatic\nHeretics\n\nKC" }).ok, true);
  const p = currentPoll(db);
  assert.deepEqual(p.options, ["Fnatic", "Heretics", "KC"]);
  votePoll(db, { id: p.id, voter: "v1", choice: 0 });
  votePoll(db, { id: p.id, voter: "v1", choice: 2 });
  const r = votePoll(db, { id: p.id, voter: "d:42", choice: 2 });
  assert.deepEqual(r.poll.counts, [0, 0, 2]);
  assert.equal(votePoll(db, { id: p.id, voter: "v2", choice: 9 }).ok, false);
  closePoll(db, { id: p.id });
  assert.equal(votePoll(db, { id: p.id, voter: "v3", choice: 1 }).ok, false);
  assert.equal(currentPoll(db), null);
});

test("scheduled scores: entered when due, refused when wrong", () => {
  const db = qualifier();
  const now = Date.now();
  const m = allMatches(getState(db)).find((x) => x.event === "meq1" && x.a && x.b && x.a.name && x.b.name);
  assert.equal(scheduleScore(db, { event: "meq1", id: m.id, sa: 1, sb: 1, at: new Date(now + 60000).toISOString() }, now).ok, false);
  assert.equal(scheduleScore(db, { event: "meq1", id: m.id, sa: 1, sb: 0, at: new Date(now - 60000).toISOString() }, now).ok, false);
  assert.equal(scheduleScore(db, { event: "meq1", id: m.id, sa: 1, sb: 0, at: new Date(now + 60000).toISOString() }, now).ok, true);
  assert.equal(applyDueScores(db, now), 0);
  assert.equal(applyDueScores(db, now + 120000), 1);
  assert.equal(listScheduledScores(db).length, 0);
  const done = allMatches(getState(db)).find((x) => x.event === "meq1" && x.id === m.id);
  assert.equal(done.sa, 1);
});

test("day board: what is missing today", () => {
  const db = qualifier();
  const now = Date.now();
  const ms = allMatches(getState(db)).filter((x) => x.event === "meq1" && x.a && x.b && x.a.name && x.b.name).slice(0, 2);
  setMatchTime(db, { event: "meq1", id: ms[0].id, at: new Date(now - 3600000).toISOString() });
  setMatchTime(db, { event: "meq1", id: ms[1].id, at: new Date(now + 60000).toISOString() });
  const b = dayBoard(getState(db), { [`meq1:${ms[0].id}`]: "ana" }, now);
  const late = b.find((x) => x.id === ms[0].id);
  // only today's matches (Paris): the one an hour ago may fall on yesterday right after midnight
  if (late) { assert.deepEqual(late.missing, ["score"]); assert.equal(late.who, "ana"); }
  const soon = b.find((x) => x.id === ms[1].id);
  if (soon) assert.deepEqual(soon.missing, []);
});

test("bot: /simule and /tierlist are known and turned on", () => {
  for (const c of ["simule", "tierlist"]) {
    assert.ok(COMMANDS.some((x) => x.name === c), c);
    assert.ok(BOT_COMMANDS.includes(c), c);
  }
});
