// Recap, map pages, head to head, player of the match, groups, season ranking, digest, search, health, vlr.gg's attack and defence.
import test from "node:test";
import assert from "node:assert/strict";
import { getState, openDb, setMatchTime } from "../lib/db.js";
import { saveQualifierScore, setQualifierTeams } from "../lib/qactions.js";
import { savePrediction } from "../lib/community.js";
import { createGroup, groupInfo, joinGroup, leaveGroup, motmCandidates, motmResults, myGroups, seasonRanking, voteMotm } from "../lib/fans.js";
import { recapOf } from "../lib/recap.js";
import { nextStart } from "../lib/nextstart.js";
import { mapCard } from "../lib/tstats.js";
import { compareTeams } from "../lib/playerstats.js";
import { savePushSub, sendDigest } from "../lib/push.js";
import { searchAll, searchIndex } from "../lib/search.js";
import { healthReport, noteProblem } from "../lib/health.js";
import { detailsFor, parseVlrMatch } from "../lib/vlrmatch.js";

const T1 = "a".repeat(40);
const T2 = "b".repeat(40);
const names = Array.from({ length: 8 }, (_, i) => `Team ${i + 1}`);

function event(db) {
  assert.equal(setQualifierTeams(db, "meq1", names.join("\n")).ok, true);
  return getState(db);
}
const row = (name, side, acs, r = 1) => ({ name, cc: "fr", agents: ["jett"], r, acs, k: 20, d: 15, a: 5, kast: 70, adr: 140, hs: 25, fk: 3, fd: 2, side });
const details = (a, b) => ({ all: [row(a, "a", 300, 1.3), row(b, "b", 200, 0.9)], maps: [{ map: "Lotus", a: 13, b: 11, t: [7, 5], ct: [6, 6], rows: [row(a, "a", 300, 1.3), row(b, "b", 200, 0.9)] }, { map: "Lotus", a: 13, b: 9, t: [8, 4], ct: [5, 5], rows: [row(a, "a", 280, 1.2), row(b, "b", 190, 0.8)] }] });

test("recap and the next event, map card, head to head", () => {
  const db = openDb(":memory:");
  let state = event(db);
  const later = new Date(Date.now() + 3 * 86400000).toISOString();
  assert.equal(setMatchTime(db, { event: "meq1", id: "r64-1", at: later }).ok, true);
  state = getState(db);
  const next = nextStart(state);
  assert.equal(next.event, "meq1");
  assert.equal(next.exact, true);
  assert.equal(saveQualifierScore(db, { event: "meq1", id: "r64-1", sa: 1, sb: 0 }).ok, true);
  state = getState(db);
  const m = state.qualifiers.meq1;
  assert.ok(m);
  const entries = [{ event: "meq1", id: "r64-1", details: details("Alpha", "Beta") }];
  const r = recapOf(state, entries, "meq1");
  assert.equal(r.done, false);
  assert.equal(r.played, 1);
  assert.equal(r.closest[0].sa - r.closest[0].sb, 2);
  const card = mapCard(state, entries, "lotus");
  assert.equal(card.played, 2);
  assert.equal(card.attack, Math.round((24 / 46) * 100));
  const items = Object.values(state.qualifiers.meq1.slots).filter(Boolean);
  const h = compareTeams(state, items[0], items[1]);
  assert.equal(h.meetings.length, 1);
  assert.equal(h.meetings[0].won, "a");
});

test("player of the match: once over, among the match's players, one vote each that can change", () => {
  const db = openDb(":memory:");
  event(db);
  const det = details("Alpha", "Beta");
  const vote = (token, player) => voteMotm(db, getState(db), { token, event: "meq1", id: "r64-1", player }, det);
  assert.equal(vote(T1, "Alpha").status, 409);
  saveQualifierScore(db, { event: "meq1", id: "r64-1", sa: 1, sb: 0 });
  assert.equal(vote(T1, "Nobody").ok, false);
  assert.equal(vote(T1, "Alpha").ok, true);
  assert.equal(vote(T2, "Alpha").ok, true);
  assert.equal(vote(T2, "Beta").ok, true);
  assert.deepEqual(motmResults(db, "meq1", "r64-1"), { total: 2, counts: [{ player: "Alpha", n: 1 }, { player: "Beta", n: 1 }] });
  assert.deepEqual(motmCandidates({}, det), ["Alpha", "Beta"]);
});

test("groups and the season ranking with badges", () => {
  const db = openDb(":memory:");
  event(db);
  const s = getState(db);
  const [a, b] = [s.qualifiers.meq1.slots[0].name, s.qualifiers.meq1.slots[1].name];
  assert.equal(createGroup(db, { token: T1, name: "Les amis" }).status, 409); // no name yet
  assert.equal(savePrediction(db, s, { token: T1, name: "Fan", event: "meq1", id: "r64-1", pick: a }).ok, true);
  assert.equal(savePrediction(db, s, { token: T2, name: "Other", event: "meq1", id: "r64-1", pick: b }).ok, true);
  const g = createGroup(db, { token: T1, name: "Les amis" });
  assert.equal(g.ok, true);
  assert.equal(joinGroup(db, { token: T2, code: "zzzzzzzz" }).status, 404);
  assert.equal(joinGroup(db, { token: T2, code: g.code }).ok, true);
  assert.equal(myGroups(db, T2)[0].count, 2);
  saveQualifierScore(db, { event: "meq1", id: "r64-1", sa: 1, sb: 0 });
  const st = getState(db);
  const all = seasonRanking(db, st);
  assert.deepEqual(all.map((r) => [r.name, r.points]), [["Fan", 1], ["Other", 0]]);
  assert.equal(seasonRanking(db, st, { only: groupInfo(db, g.code).hashes }).length, 2);
  leaveGroup(db, { token: T1, code: g.code });
  leaveGroup(db, { token: T2, code: g.code });
  assert.equal(groupInfo(db, g.code), null);
});

test("the evening summary: once a day after 22:00 Paris, to those who chose it, their teams only", async () => {
  const db = openDb(":memory:");
  const s0 = event(db);
  const [a] = [s0.qualifiers.meq1.slots[0].name];
  const evening = new Date("2026-11-07T21:30:00Z").getTime(); // 22:30 in Paris
  setMatchTime(db, { event: "meq1", id: "r64-1", at: "2026-11-07T17:00:00Z" });
  saveQualifierScore(db, { event: "meq1", id: "r64-1", sa: 1, sb: 0 });
  const slug = a.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  savePushSub(db, { endpoint: "https://fcm.googleapis.com/fcm/send/1", keys: { p256dh: "k", auth: "a" }, teams: [slug], lang: "fr", digest: true });
  savePushSub(db, { endpoint: "https://fcm.googleapis.com/fcm/send/2", keys: { p256dh: "k", auth: "a" }, teams: [], lang: "fr", digest: false });
  const sent = [];
  const send = async (sub, payload) => sent.push([sub.endpoint, JSON.parse(payload)]);
  assert.equal(await sendDigest(db, getState(db), new Date("2026-11-07T19:00:00Z").getTime(), send), 0); // 20:00: too early
  assert.equal(await sendDigest(db, getState(db), evening, send), 1);
  assert.equal(await sendDigest(db, getState(db), evening + 60000, send), 0); // once a day
  assert.equal(sent[0][0], "https://fcm.googleapis.com/fcm/send/1");
  assert.match(sent[0][1].title, /^Résultats du jour/);
  assert.match(sent[0][1].body, /1–0/);
});

test("search finds matches by their two teams, and maps; health; vlr.gg's attack and defence", () => {
  const db = openDb(":memory:");
  const s = event(db);
  const items = searchIndex(s);
  const res = searchAll(items, "team 1 team 2");
  assert.equal(res.matches[0].href, "/match/meq1/r64-1");
  assert.equal(searchAll(items, "lotus").maps[0].href, "/map/lotus");
  noteProblem("vlr", "vlr.gg 500", db);
  const h = healthReport(db);
  assert.equal(h.find((r) => r.part === "vlr").problem.message, "vlr.gg 500");
  assert.equal(h.find((r) => r.part === "cron").late, true);
  const html = `<div class="vm-stats-game " data-game-id="1"><div class="vm-stats-game-header"><div class="team"><div class="score mod-win">13 </div><div><div class="team-name">X</div><span class="mod-t">12</span> / <span class="mod-ct">1</span></div></div><div class="map"><div class="map-name">Lotus</div></div><div class="team mod-right"><div><div class="team-name">Y</div><span class="mod-ct">4</span> / <span class="mod-t">2</span></div><div class="score">6</div></div></div></div>`;
  const p = parseVlrMatch(html);
  assert.deepEqual([p.maps[0].t, p.maps[0].ct], [[12, 2], [1, 4]]);
  const d = detailsFor({ ...p, players: [], all: [], stream: "", vod: "" }, true, 3);
  assert.deepEqual([d.details.maps[0].t, d.details.maps[0].ct], [[2, 12], [4, 1]]);
});
