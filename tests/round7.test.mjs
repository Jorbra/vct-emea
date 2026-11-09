// Round 7: fantasy, countries, achievements, claims, news drafts, CSV, the week's recap, the reminders to predict.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { getState, openDb, setMatchTime } from "../lib/db.js";
import { saveQualifierScore, setQualifierTeams } from "../lib/qactions.js";
import { allMatches } from "../lib/matchlist.js";
import { readDetails } from "../lib/tstats.js";
import { achievements, claimMatch, countryStats, fantasyPool, fantasyRanking, listClaims, myFantasy, newsDrafts, playerPoints, priceOf, pronoReminders, rankingCsv, resultsCsv, roleOf, saveFantasy, teamPoints, weekRecap } from "../lib/round7.js";
import { COMMANDS } from "../lib/discordbot.js";
import { BOT_COMMANDS } from "../lib/botstore.js";

const T = "h".repeat(40);
const sha = (t) => crypto.createHash("sha256").update(t).digest("hex");
const DAY = 86400000;
const AG = ["jett", "sova", "omen", "killjoy", "raze", "fade", "viper", "cypher"];
const players = Array.from({ length: 16 }, (_, i) => ({ slug: `p${i}`, name: `P${i}`, team: `Team ${i % 8}`, cc: i % 3 ? "fr" : "tr", maps: 6, r: 0.9 + (i % 5) * 0.05, acs: 180 + (i % 5) * 10, agents: [{ name: AG[i % 8], n: 4 }] }));

/** Two matches played yesterday, with vlr.gg-like tables. */
function played(now) {
  const db = openDb(":memory:");
  setQualifierTeams(db, "meq1", Array.from({ length: 8 }, (_, i) => `Team ${i}`).join("\n"));
  db.prepare("INSERT INTO kv (key, value) VALUES ('qbo:meq1:r64', '3')").run();
  const first = allMatches(getState(db)).filter((m) => m.event === "meq1" && m.a && m.b && m.a.name && m.b.name).slice(0, 2);
  first.forEach((m, k) => {
    setMatchTime(db, { event: "meq1", id: m.id, at: new Date(now - DAY + k * 3600000).toISOString() });
    saveQualifierScore(db, { event: "meq1", id: m.id, sa: 2, sb: 0 });
    const all = [{ name: `P${k * 2}`, side: "a", k: 40, d: 20, a: 10, acs: 300, r: 1.4 }, { name: `P${k * 2 + 1}`, side: "b", k: 20, d: 40, a: 6, acs: 150, r: 0.7 }];
    db.prepare("INSERT INTO mextra (event, id, details) VALUES ('meq1', ?, ?) ON CONFLICT (event, id) DO UPDATE SET details = excluded.details").run(m.id, JSON.stringify({ all, maps: [] }));
  });
  return { db, first };
}

test("fantasy: roles, prices, the rules of a team", () => {
  const db = openDb(":memory:");
  const pool = fantasyPool(players);
  assert.equal(roleOf(players[0]), "duelist");
  assert.equal(roleOf({ agents: [{ name: "KAY/O" }] }), "initiator");
  assert.ok(pool.every((p) => p.price >= 5 && p.price <= 30));
  assert.ok(priceOf({ r: 1.4, acs: 300 }) > priceOf({ r: 0.8, acs: 150 }));
  const slots = { duelist: "p0", initiator: "p1", controller: "p2", sentinel: "p3", joker: "p4" };
  assert.equal(saveFantasy(db, pool, { token: T, slots }).ok, false); // no name yet
  db.prepare("INSERT INTO voters (hash, name, created) VALUES (?, 'Boss', ?)").run(sha(T), new Date().toISOString());
  assert.equal(saveFantasy(db, pool, { token: T, slots: { ...slots, duelist: "p1" } }).ok, false); // wrong role
  const same = pool.map((p) => (p.slug === "p1" || p.slug === "p8" ? { ...p, team: "Team 0" } : p));
  assert.equal(saveFantasy(db, same, { token: T, slots: { ...slots, joker: "p8" } }).error, "2 players of the same team at most.");
  assert.equal(saveFantasy(db, pool, { token: T, slots: { ...slots, joker: "p0" } }).ok, false); // twice
  assert.equal(saveFantasy(db, pool, { token: T, slots: { ...slots, joker: "p12" } }).ok, true);
});

test("fantasy: points only from the matches after the pick, kept for players let go", () => {
  const now = Date.now();
  const { db } = played(now);
  const state = getState(db);
  const points = playerPoints(state, readDetails(db, ""));
  // P0: 40 − 10 + 5 + 3 (won) + 5 (best ACS) = 43 ; P1: 20 − 20 + 3 = 3
  assert.equal(points.get("p0")[0].pts, 43);
  assert.equal(points.get("p1")[0].pts, 3);
  const early = { slots: { duelist: { slug: "p0", from: new Date(now - 2 * DAY).toISOString() } }, past: [] };
  const late = { slots: { duelist: { slug: "p0", from: new Date(now).toISOString() } }, past: [] };
  assert.equal(teamPoints(early, points), 43);
  assert.equal(teamPoints(late, points), 0);
  assert.equal(teamPoints({ slots: {}, past: [{ slug: "p0", from: new Date(now - 2 * DAY).toISOString(), to: new Date(now).toISOString() }] }, points), 43);
  const pool = fantasyPool(players);
  db.prepare("INSERT INTO voters (hash, name, created) VALUES (?, 'Boss', ?)").run(sha(T), new Date().toISOString());
  saveFantasy(db, pool, { token: T, slots: { duelist: "p0", initiator: "p1", controller: "p2", sentinel: "p3", joker: "p12" } }, now - 2 * DAY);
  assert.equal(myFantasy(db, pool, points, T, now).season, 92); // P0 43 + P1 3 + P2 43 + P3 3
  assert.deepEqual(fantasyRanking(db, points, { now }).map((r) => [r.name, r.season]), [["Boss", 92]]);
});

test("countries: grouped, best player first", () => {
  const c = countryStats(players);
  const fr = c.find((x) => x.cc === "fr");
  assert.equal(fr.name, "France");
  assert.equal(fr.players.length, players.filter((p) => p.cc === "fr").length);
  assert.equal(fr.best.r, Math.max(...fr.players.map((p) => p.r)));
  assert.equal(c[0].cc, "fr");
});

test("achievements, claims, drafts, CSV", () => {
  const now = Date.now();
  const { db } = played(now);
  const state = getState(db);
  const a = achievements(db, state, sha(T));
  assert.equal(a.length, 11);
  assert.ok(a.every((x) => !x.got));
  db.prepare("INSERT INTO quiz_answers (hash, week, answers, good, at) VALUES (?, '2026-11-09', '{}', 5, ?)").run(sha(T), new Date().toISOString());
  assert.equal(achievements(db, state, sha(T))[0].key, "quiz5");
  assert.equal(claimMatch(db, { event: "meq1", id: "r64-1", who: "ana", on: true }).ok, true);
  assert.equal(claimMatch(db, { event: "meq1", id: "r64-1", who: "bob", on: true }).ok, false);
  assert.deepEqual(listClaims(db), { "meq1:r64-1": "ana" });
  claimMatch(db, { event: "meq1", id: "r64-1", on: false });
  assert.deepEqual(listClaims(db), {});
  const recap = { done: true, played: 7, overtime: 1, qualified: [{ team: { name: "Team 0" } }], top: [{ name: "P0", team: "Team 0", r: 1.4 }], bigGames: [{ name: "P0", acs: 300, k: 40, d: 20 }], maps: [{ map: "Bind" }] };
  const d = newsDrafts({ meq1: recap, meq2: { done: false } }, []);
  assert.equal(d.length, 1);
  assert.match(d[0].body, /Qualifiés : Team 0\./);
  assert.equal(newsDrafts({ meq1: recap }, [{ title: d[0].title }]).length, 0);
  const csv = resultsCsv(state);
  assert.ok(csv.startsWith("﻿Tournoi;Match"));
  assert.match(csv, /Team 0;Team 1;2;0;Team 0;3/);
  assert.match(rankingCsv([{ name: 'A "b"; c', points: 3, good: 3, total: 4 }]), /1;"A ""b""; c";3;3;4/);
});

test("the week's recap and the reminders to predict", () => {
  const now = Date.now();
  const { db, first } = played(now);
  const state = getState(db);
  const w = weekRecap(state, readDetails(db, ""), [{ slug: "x", name: "X" }], now);
  assert.equal(w.matches, 2);
  assert.equal(w.biggest.sa, 2);
  assert.equal(w.best, null); // one map each: not enough
  // a match in 2 hours, open: the user who did not pick it is reminded
  const soon = allMatches(state).find((m) => m.event === "meq1" && m.a && m.b && m.a.name && m.b.name && m.sa == null);
  setMatchTime(db, { event: "meq1", id: soon.id, at: new Date(now + 2 * 3600000).toISOString() });
  const s2 = getState(db);
  const r = pronoReminders(db, s2, ["u1"], () => true, () => "nobody", now);
  assert.equal(r.length, 1);
  assert.equal(r[0].matches[0].id, soon.id);
  db.prepare("INSERT INTO predictions (hash, event, id, pick) VALUES ('h1', 'meq1', ?, 'x')").run(soon.id);
  assert.equal(pronoReminders(db, s2, ["u1"], () => true, () => "h1", now).length, 0);
  assert.ok(first.length);
});

test("bot: the new commands are known and turned on", () => {
  for (const c of ["profil", "fantasy", "rappelprono", "jeux"]) {
    assert.ok(COMMANDS.some((x) => x.name === c), c);
    assert.ok(BOT_COMMANDS.includes(c), c);
  }
});
