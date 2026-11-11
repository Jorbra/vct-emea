// Round 10: agents by map, players in form, accuracy by week, editors' notes, the prediction of the day.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { getState, openDb, setMatchTime } from "../lib/db.js";
import { saveQualifierScore, setQualifierTeams } from "../lib/qactions.js";
import { allMatches } from "../lib/matchlist.js";
import { accuracyByWeek, agentMapTable, listNotes, matchOfTheDay, pickSplit, playersInForm, saveNote } from "../lib/round10.js";
import { COMMANDS } from "../lib/discordbot.js";
import { BOT_COMMANDS } from "../lib/botstore.js";

const T = "p".repeat(40);
const sha = (t) => crypto.createHash("sha256").update(t).digest("hex");
const row = (name, side, agents, r = 1) => ({ name, side, agents, r });

test("agents by map: the share of teams per map", () => {
  const entries = [
    { event: "q1", id: "a", details: { maps: [{ map: "Bind", rows: [row("A", "a", ["jett"]), row("B", "a", ["omen"]), row("C", "b", ["jett"]), row("D", "b", ["sova"])] }] } },
    { event: "q1", id: "b", details: { maps: [{ map: "Bind", rows: [row("A", "a", ["omen"]), row("C", "b", ["sova"])] }, { map: "Lotus", rows: [row("A", "a", ["jett"])] }] } },
  ];
  const t = agentMapTable(entries);
  assert.deepEqual(t.maps.map((m) => [m.map, m.games]), [["Bind", 4], ["Lotus", 1]]);
  assert.equal(t.cells["Bind|jett"], 50);
  assert.equal(t.cells["Bind|omen"], 50);
  assert.equal(t.cells["Lotus|jett"], 100);
  assert.ok(t.agents.includes("Jett"));
});

test("players in form: recent matches above their average", () => {
  const now = Date.now();
  const db = openDb(":memory:");
  setQualifierTeams(db, "meq1", Array.from({ length: 16 }, (_, i) => `T${i}`).join("\n"));
  const ms = allMatches(getState(db)).filter((m) => m.event === "meq1" && m.a && m.b && m.a.name && m.b.name);
  ms.forEach((m, k) => setMatchTime(db, { event: "meq1", id: m.id, at: new Date(now - (k < 2 ? 2 : 40) * 86400000).toISOString() }));
  const state = getState(db);
  const games = ms.map((m, k) => ({ event: "meq1", id: m.id, r: k < 2 ? 1.6 : 0.9 }));
  const more = [...games, ...games.slice(2).map((g) => ({ ...g }))];
  const stats = { players: [{ slug: "hot", name: "Hot", team: "T0" }, { slug: "few", name: "Few", team: "T1" }], byPlayer: { hot: more, few: games.slice(0, 2) } };
  const f = playersInForm(state, stats, now);
  assert.equal(f.length, 1);
  assert.equal(f[0].name, "Hot");
  assert.ok(f[0].delta > 0.5);
});

test("accuracy by week, editors' notes, the prediction of the day", () => {
  const now = Date.now();
  const db = openDb(":memory:");
  setQualifierTeams(db, "meq1", Array.from({ length: 8 }, (_, i) => `T${i}`).join("\n"));
  const ms = allMatches(getState(db)).filter((m) => m.event === "meq1" && m.a && m.b && m.a.name && m.b.name);
  setMatchTime(db, { event: "meq1", id: ms[0].id, at: new Date(now - 3 * 86400000).toISOString() });
  saveQualifierScore(db, { event: "meq1", id: ms[0].id, sa: 1, sb: 0 });
  db.prepare("INSERT INTO predictions (hash, event, id, pick) VALUES (?, 'meq1', ?, ?)").run(sha(T), ms[0].id, ms[0].a.name);
  const w = accuracyByWeek(db, getState(db), T);
  assert.equal(w.length, 1);
  assert.deepEqual([w[0].good, w[0].total], [1, 1]);
  assert.equal(saveNote(db, { event: "meq1", id: ms[1].id, body: "Stream late", who: "ana" }).ok, true);
  assert.equal(listNotes(db)[`meq1:${ms[1].id}`].body, "Stream late");
  saveNote(db, { event: "meq1", id: ms[1].id, body: "" });
  assert.deepEqual(listNotes(db), {});
  // later today (Paris): the match of the day, and how the picks split
  const later = new Date(now + 60000);
  const sameDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(later) === new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(now));
  setMatchTime(db, { event: "meq1", id: ms[1].id, at: later.toISOString() });
  const m = matchOfTheDay(getState(db), () => true, now);
  if (sameDay) assert.equal(m.id, ms[1].id);
  db.prepare("INSERT INTO predictions (hash, event, id, pick) VALUES ('x', 'meq1', ?, ?)").run(ms[1].id, ms[1].a.name);
  assert.deepEqual(pickSplit(db, ms[1]), { a: 1, b: 0, total: 1 });
});

test("bot: /forme is known and turned on", () => {
  assert.ok(COMMANDS.some((c) => c.name === "forme"));
  assert.ok(BOT_COMMANDS.includes("forme"));
});
