// Round 17: tense matches, the round by round story.
import test from "node:test";
import assert from "node:assert/strict";
import { nextRounds, tension } from "../lib/livemore.js";
import { liveUpdate } from "../lib/vlive.js";

test("tense moments: overtime on the map being played, the deciding map of the series", () => {
  assert.deepEqual(tension({ a: 1, b: 0, maps: [{ map: "Bind", a: 13, b: 5, done: true }, { map: "Haven", a: 12, b: 12, done: false }] }, 3), { ot: "Haven", decider: false, map: "Haven", a: 12, b: 12 });
  assert.equal(tension({ a: 1, b: 1, maps: [{ map: "Bind", a: 13, b: 5, done: true }, { map: "Haven", a: 9, b: 13, done: true }, { map: "Lotus", a: 2, b: 1 }] }, 3).decider, true);
  assert.equal(tension({ a: 1, b: 1, maps: [] }, 1).decider, false); // a Bo1 has no deciding map
  assert.equal(tension({ a: 0, b: 0, maps: [{ map: "TBD", a: 12, b: 12 }] }, 3).ot, ""); // a map vlr.gg has not named
  assert.deepEqual(tension(null, 3), { ot: "", decider: false, map: "", a: null, b: null });
});

test("round by round: a score kept each time it changes, 80 at most", () => {
  let r = nextRounds([], [{ map: "Bind", a: 0, b: 0 }], "t0");
  r = nextRounds(r, [{ map: "Bind", a: 0, b: 0 }], "t1");
  r = nextRounds(r, [{ map: "Bind", a: 1, b: 0 }], "t2");
  assert.deepEqual(r.map((x) => [x.at, x.a, x.b]), [["t0", 0, 0], ["t2", 1, 0]]);
  for (let i = 0; i < 100; i++) r = nextRounds(r, [{ map: "Bind", a: i, b: 1 }], `x${i}`);
  assert.equal(r.length, 80);
  // the live match keeps it from one read to the next
  const p1 = liveUpdate(null, { maps: [{ map: "Bind", a: 3, b: 1 }] }, false, Date.parse("2026-11-14T18:00:00Z"));
  const p2 = liveUpdate(p1, { maps: [{ map: "Bind", a: 4, b: 1 }] }, false, Date.parse("2026-11-14T18:03:00Z"));
  assert.deepEqual(p2.rounds.map((x) => [x.a, x.b]), [[3, 1], [4, 1]]);
});

test("the fans' MVP over the season: votes and matches won", async () => {
  const { openDb } = await import("../lib/db.js");
  const { motmSeason } = await import("../lib/fans.js");
  const db = openDb(":memory:");
  const add = (hash, event, id, player) => db.prepare("INSERT INTO motm (hash, event, id, player, at) VALUES (?, ?, ?, ?, ?)").run(hash, event, id, player, "2026-11-14");
  add("h1", "q2", "m1", "Pa1ze"); add("h2", "q2", "m1", "Pa1ze"); add("h3", "q2", "m1", "trexx");
  add("h1", "q2", "m2", "trexx");
  assert.deepEqual(motmSeason(db), [{ player: "Pa1ze", n: 2, matches: 1 }, { player: "trexx", n: 2, matches: 1 }]);
});

test("editor: teams' names, the syncs' log, news to publish later", async () => {
  const { openDb } = await import("../lib/db.js");
  const { cancelScheduledNews, logSync, planLines, readScheduledNews, readSyncLog, readTeamAliases, saveTeamAlias, scheduleNews, takeDueNews } = await import("../lib/editor17.js");
  const db = openDb(":memory:");
  // names
  assert.equal(saveTeamAlias(db, { from: "FNC", name: "Fnatic", tag: "FNC" }).ok, true);
  assert.deepEqual(readTeamAliases(db), { FNC: { name: "Fnatic", tag: "FNC" } });
  saveTeamAlias(db, { from: "FNC", name: "" });
  assert.deepEqual(readTeamAliases(db), {});
  assert.equal(saveTeamAlias(db, { from: "", name: "x" }).ok, false);
  // the log, latest first
  logSync(db, planLines("q2", { slots: [{ slot: 3, name: "Barça eSports" }], scores: [{ id: "r16-1", sa: 2, sb: 0 }] }), Date.parse("2026-11-14T10:00:00Z"));
  logSync(db, [{ source: "vlr.gg", event: "q2", text: "Score r16-2: 2-1" }], Date.parse("2026-11-14T11:00:00Z"));
  const log = readSyncLog(db);
  assert.deepEqual(log.map((x) => x.text), ["Score r16-2: 2-1", "Score r16-1: 2-0", "Slot 3: Barça eSports"]);
  // news for later
  const now = Date.parse("2026-11-14T12:00:00Z");
  assert.equal(scheduleNews(db, { title: "T", body: "B", at: "2026-11-14T11:00:00Z" }, now).ok, false); // in the past
  const r = scheduleNews(db, { title: "Demain", body: "Le programme", at: "2026-11-15T09:00:00Z" }, now);
  assert.equal(r.ok, true);
  assert.equal(takeDueNews(db, now).length, 0);
  assert.equal(takeDueNews(db, Date.parse("2026-11-15T09:01:00Z"))[0].title, "Demain");
  assert.equal(readScheduledNews(db).length, 0);
  const r2 = scheduleNews(db, { title: "X", body: "Y", at: "2026-11-16T09:00:00Z" }, now);
  assert.equal(cancelScheduledNews(db, r2.id).ok, true);
  assert.equal(readScheduledNews(db).length, 0);
});

test("Toornament: the editors' names rename the teams", async () => {
  const { planSync } = await import("../lib/toornament.js");
  const row = (n, a, b) => ({ round: 1, n, at: "", status: "pending", type: "single_elimination", a: { pid: a, name: a, score: null, result: "", forfeit: false }, b: { pid: b, name: b, score: null, result: "", forfeit: false } });
  const rows = [row(1, "FNC", "TH"), row(2, "KC", "VIT"), { round: 2, n: 1, at: "", status: "pending", type: "single_elimination", a: { pid: "", name: "" }, b: { pid: "", name: "" } }, { round: 2, n: 2, at: "", status: "pending", type: "single_elimination", a: { pid: "", name: "" }, b: { pid: "", name: "" } }];
  const plan = planSync({ event: "meq1", rows, teams: null, site: { slots: [], scores: {}, bo: {}, times: {}, live: {} }, last: {}, aliases: { FNC: { name: "Fnatic", tag: "FNC" } } });
  assert.ok(plan.slots.some((s) => s.name === "Fnatic" && s.tag === "FNC"));
});

test("the season as a timeline: every lane and event, the qualified teams", async () => {
  const { getState, openDb } = await import("../lib/db.js");
  const { seasonTimeline, LANES } = await import("../lib/season17.js");
  const t = seasonTimeline(getState(openDb(":memory:")));
  assert.deepEqual(t.map((l) => l.lane), LANES.map(([l]) => l));
  assert.deepEqual(t[0].events.map((e) => e.event), ["q1", "q2", "playoffs"]);
  assert.ok(t.every((l) => l.events.every((e) => ["done", "live", "upcoming"].includes(e.state) && Array.isArray(e.qualified))));
});

test("mystery map: a layout to name in 4 guesses, clearer each time", async () => {
  const { dailyPuzzles, playMove, readGame } = await import("../lib/games.js");
  const { openDb } = await import("../lib/db.js");
  const maps = ["Ascent", "Bind", "Haven", "Lotus", "Split"].map((n) => ({ key: n.toLowerCase(), name: n, icon: "https://x/m.png" }));
  const pz = dailyPuzzles({ players: [], logos: [], maps }, "2026-11-15");
  assert.ok(pz.map && pz.map.answer.name && [90, 180, 270].includes(pz.map.turn));
  const db = openDb(":memory:");
  const token = "m".repeat(30);
  const names = maps.map((m) => m.name);
  let g = readGame(db, pz, { token, game: "map" });
  assert.equal(g.blur, 14);
  const wrong = names.filter((n) => n !== pz.map.answer.name);
  g = playMove(db, pz, { maps: names }, { token, game: "map", move: wrong[0] });
  assert.equal(g.blur, 9);
  assert.equal(playMove(db, pz, { maps: names }, { token, game: "map", move: "Nowhere" }).status, 400);
  g = playMove(db, pz, { maps: names }, { token, game: "map", move: pz.map.answer.name });
  assert.ok(g.done && g.won && g.turn === 0 && g.reveal.name === pz.map.answer.name);
});

test("editor: a stream link alone, today's results as text; bot /mvp", async () => {
  const { getState, openDb } = await import("../lib/db.js");
  const { setQualifierTeams, saveQualifierScore } = await import("../lib/qactions.js");
  const { allMatches } = await import("../lib/matchlist.js");
  const { setMatchStream, resultsText } = await import("../lib/editor17.js");
  const db = openDb(":memory:");
  setQualifierTeams(db, "meq1", Array.from({ length: 8 }, (_, i) => `T${i}`).join("\n"));
  const m = allMatches(getState(db)).find((x) => x.event === "meq1" && x.a && x.b && x.a.name);
  db.prepare("INSERT INTO mextra (event, id, stream, vod, highlights, mvp, pstats, maps) VALUES (?, ?, '', 'https://youtu.be/abcdefgh', '', 'T0', '[]', '[]')").run("meq1", m.id);
  assert.equal((await setMatchStream(db, { event: "meq1", id: m.id, stream: "https://twitch.tv/valorant_emea" })).ok, true);
  const row = db.prepare("SELECT stream, vod, mvp FROM mextra WHERE event = ? AND id = ?").get("meq1", m.id);
  assert.deepEqual(row, { stream: "https://twitch.tv/valorant_emea", vod: "https://youtu.be/abcdefgh", mvp: "T0" });
  const text = resultsText([{ event: "q2", a: { name: "A" }, b: { name: "B" }, sa: 2, sb: 0, win: "a", at: "2026-11-15T19:00:00Z" }, { event: "q2", a: { name: "C" }, b: { name: "D" }, sa: 0, sb: 2, win: "b", at: "2026-11-14T19:00:00Z" }], { q2: "EU Qualifier 2" }, "2026-11-15");
  assert.match(text, /✅ A 2–0 B/);
  assert.doesNotMatch(text, /C 0–2 D/);
  assert.equal(resultsText([], {}, "2026-11-15"), "");
  const { COMMANDS, answerCommand } = await import("../lib/discordbot.js");
  const { botCtx, cmd } = await import("./botctx.mjs");
  assert.ok(COMMANDS.some((c) => c.name === "mvp"));
  const r = answerCommand("mvp", cmd("mvp"), botCtx(getState(db), { motm: () => [{ player: "Pa1ze", n: 12, matches: 3 }] }));
  assert.match(r.embeds[0].description, /\*\*Pa1ze\*\* · 12 votes · MVP de 3/);
});

test("best players by role and the bot's /role", async () => {
  const { getState, openDb } = await import("../lib/db.js");
  const { roleLeaders } = await import("../lib/agentpage.js");
  assert.deepEqual(roleLeaders(openDb(":memory:")), {});
  const { COMMANDS, answerCommand } = await import("../lib/discordbot.js");
  const { botCtx, cmd } = await import("./botctx.mjs");
  assert.ok(COMMANDS.some((c) => c.name === "role"));
  const ctx = botCtx(getState(openDb(":memory:")), { roles: () => ({ Duelist: [{ slug: "a", name: "Alpha", team: "T1", r: 1.31, acs: 260, maps: 8, agent: "Jett" }] }) });
  assert.match(answerCommand("role", cmd("role", { role: "Duelist" }), ctx).embeds[0].description, /\*\*Alpha\*\* \(T1\) · 1\.31 · 260 ACS · Jett/);
  assert.match(answerCommand("role", cmd("role", { role: "Sentinel" }), ctx).content, /Pas encore/);
});
