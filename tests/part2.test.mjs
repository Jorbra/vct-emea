// "Who qualifies?", following players and their LFT news, vlr.gg's stages.
import test from "node:test";
import assert from "node:assert/strict";
import { openDb, getState } from "../lib/db.js";
import { setQualifierTeams, saveQualifierScore } from "../lib/qactions.js";
import { setMatchTime } from "../lib/db.js";
import { myPickem, pickemBoards, pickemEvents, pickemPoints, savePickem } from "../lib/pickem.js";
import { freeAgents, lftChanges, parseTransfers } from "../lib/lft.js";
import { cleanPrefs } from "../lib/accounts.js";
import { parseEventMatches } from "../lib/vlrmatch.js";
import { sendPlayerPushes, savePushSub } from "../lib/push.js";

const T = "t".repeat(40);
const names = Array.from({ length: 8 }, (_, i) => `Team ${i + 1}`);

test("who qualifies: open before the first match, checked, then closed and scored", () => {
  const db = openDb(":memory:");
  assert.equal(setQualifierTeams(db, "meq1", names.join("\n")).ok, true);
  const later = new Date(Date.now() + 86400000).toISOString();
  assert.equal(setMatchTime(db, { event: "meq1", id: "r64-1", at: later }).ok, true);
  let ev = pickemEvents(getState(db)).find((e) => e.event === "meq1");
  assert.deepEqual([ev.n, ev.open, ev.done], [1, true, false]);
  const pick = (picks, name = "Fan") => savePickem(db, getState(db), { token: T, name, event: "meq1", picks });
  assert.equal(pick(["Team 1", "Team 2"]).ok, false);
  assert.equal(pick(["Nobody"]).ok, false);
  assert.equal(pick(["Team 1"], "x").ok, false); // a name has 2 characters at least
  assert.equal(pick(["Team 1"]).ok, true);
  assert.deepEqual(myPickem(db, T), { meq1: { picks: ["Team 1"], champion: "Team 1" } });
  // started: closed
  assert.equal(saveQualifierScore(db, { event: "meq1", id: "r64-1", sa: 1, sb: 0 }).ok, true);
  assert.equal(pick(["Team 2"]).status, 409);
  ev = pickemEvents(getState(db)).find((e) => e.event === "meq1");
  assert.equal(pickemPoints({ picks: ["Team 1"], champion: "Team 1" }, { ...ev, done: true, qualified: ["Team 1"], champion: "Team 1" }), 3);
  assert.equal(pickemPoints({ picks: ["A", "B", "C", "D"], champion: "A" }, { n: 4, done: true, qualified: ["A", "B", "X", "Y"], champion: "A" }), 4);
  assert.equal(pickemBoards(db, [ev]).meq1.count, 1);
});

test("following players: kept in the account, and their news reach only those who follow them", async () => {
  assert.deepEqual(cleanPrefs({ players: ["derke", "BAD", "derke", 3] }), { players: ["derke"] });
  const prev = { a: { name: "A", from: "Fnatic", date: "2026-11-01" }, b: { name: "B", from: "BBL", date: "2026-10-01" } };
  const now = { a: prev.a, c: { name: "C", from: "FUT", date: "2026-11-05" } };
  const moves = parseTransfers("{{Transfer Row|date=2026-11-04|name=B|team2=Team Heretics}}");
  assert.deepEqual(lftChanges(prev, now, moves).map((e) => [e.kind, e.slug, e.team]), [["free", "c", "FUT"], ["signed", "b", "Team Heretics"]]);
  const db = openDb(":memory:");
  const sub = (endpoint, players) => savePushSub(db, { endpoint, keys: { p256dh: "k", auth: "a" }, teams: [], players, lang: "fr" });
  assert.equal(sub("https://fcm.googleapis.com/fcm/send/1", ["c"]).ok, true);
  assert.equal(sub("https://fcm.googleapis.com/fcm/send/2", ["z"]).ok, true);
  const sent = [];
  await sendPlayerPushes(db, lftChanges(prev, now, moves), async (s, payload) => sent.push([s.endpoint, JSON.parse(payload).body]));
  assert.deepEqual(sent, [["https://fcm.googleapis.com/fcm/send/1", "C est libre (a quitté FUT)"]]);
});

test("LFT leaves out who is neither a player nor staff; vlr.gg's stage is read", () => {
  const free = freeAgents(parseTransfers("{{Transfer Row|date=2026-11-02|name=Host|flag=fr|team1=Fnatic|role1=Content Creator}}\n{{Transfer Row|date=2026-11-02|name=Try|flag=fr|team1=Fnatic|role1=Trial}}"));
  assert.deepEqual(free.map((p) => p.name), ["Try"]);
  const html = `<a href="/9/x-vs-y" class="wf-module-item match-item"><div class="match-item-vs-team-name"> <div class="text-of"> X </div> </div><div class="match-item-vs-team-name"> <div class="text-of"> Y </div> </div><div class="match-item-event text-of"> <div class="match-item-event-series text-of"> Round of 64 </div> Qualifier #2 </div></a>`;
  const [m] = parseEventMatches(html);
  assert.equal(m.round, "r64");
  assert.match(m.stage, /Qualifier #2/);
});
