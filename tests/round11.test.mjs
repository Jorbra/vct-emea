// Round 11: close profiles, a match's preview, an event's and the season's feed, the team of the week, the predictors' tiers.
import test from "node:test";
import assert from "node:assert/strict";
import { getState, openDb, setMatchTime } from "../lib/db.js";
import { saveQualifierScore, setQualifierTeams } from "../lib/qactions.js";
import { allMatches } from "../lib/matchlist.js";
import { eventFeed, matchPreview, seasonFeed, similarPlayers, teamOfWeek, tierOf } from "../lib/round11.js";
import { COMMANDS } from "../lib/discordbot.js";
import { BOT_COMMANDS } from "../lib/botstore.js";

const DAY = 86400000;

function played(now) {
  const db = openDb(":memory:");
  setQualifierTeams(db, "meq1", Array.from({ length: 8 }, (_, i) => `T${i}`).join("\n"));
  const ms = allMatches(getState(db)).filter((m) => m.event === "meq1" && m.a && m.b && m.a.name && m.b.name);
  ms.forEach((m, k) => { setMatchTime(db, { event: "meq1", id: m.id, at: new Date(now - (3 - k * 0.1) * DAY).toISOString() }); saveQualifierScore(db, { event: "meq1", id: m.id, sa: 1, sb: 0 }); });
  return { db, ms };
}

test("close profiles: the nearest numbers first", () => {
  const P = (slug, r, acs) => ({ slug, name: slug, team: "X", maps: 6, r, acs, kd: r, kast: 70, adr: acs / 1.5, hs: 25 });
  const list = [P("me", 1.1, 220), P("twin", 1.11, 222), P("far", 0.7, 140), P("mid", 1.0, 200), P("a", 0.8, 160), P("b", 1.3, 260)];
  const s = similarPlayers(list, "me", 3);
  assert.equal(s[0].slug, "twin");
  assert.ok(s[0].score > s[s.length - 1].score);
  assert.deepEqual(similarPlayers(list, "nobody"), []);
});

test("preview, event feed, season feed", () => {
  const now = Date.now();
  const { db, ms } = played(now);
  const state = getState(db);
  const next = allMatches(state).find((m) => m.event === "meq1" && m.a && m.b && m.a.name && m.b.name && m.sa == null);
  const pv = matchPreview(state, { ...next, at: new Date(now + DAY).toISOString() }, { players: [{ slug: "p", name: "P", team: next.a.name, maps: 3, r: 1.2, acs: 230 }] });
  assert.deepEqual(pv.a.form, ["w"]);
  assert.equal(pv.a.w, 1);
  assert.equal(pv.keys.a[0].name, "P");
  const feed = eventFeed(state, "meq1");
  assert.equal(feed.reduce((s, d) => s + d.items.length, 0), ms.length);
  assert.ok(feed[0].day >= feed[feed.length - 1].day);
  const sf = seasonFeed(state, [{ date: new Date(now - DAY).toISOString().slice(0, 10), kind: "in", id: "Boaster", team: "Fnatic" }], now);
  assert.ok(sf.some((x) => x.kind === "transfer" && x.player === "Boaster"));
});

test("team of the week: the best rating per role", () => {
  const now = Date.now();
  const { db, ms } = played(now);
  const state = getState(db);
  const rowsOf = (k) => [{ name: `D${k}`, r: 1.3, agents: ["jett"] }, { name: `C${k}`, r: 1.1, agents: ["omen"] }, { name: `S${k}`, r: 0.9, agents: ["killjoy"] }];
  const entries = ms.slice(0, 2).map((m, k) => ({ event: "meq1", id: m.id, details: { maps: [{ map: "Bind", rows: rowsOf(0) }, { map: "Lotus", rows: rowsOf(0) }].map((x) => ({ ...x, rows: x.rows })) } }));
  void entries.length;
  const t = teamOfWeek(state, entries, now);
  assert.equal(t.duelist.name, "D0");
  assert.equal(t.controller.name, "C0");
  assert.equal(t.sentinel.name, "S0");
  assert.equal(t.initiator, undefined);
});

test("tiers and the new command", () => {
  assert.equal(tierOf(0), "");
  assert.equal(tierOf(3), "bronze");
  assert.equal(tierOf(12), "silver");
  assert.equal(tierOf(40), "gold");
  assert.ok(COMMANDS.some((c) => c.name === "avantmatch"));
  assert.ok(BOT_COMMANDS.includes("avantmatch"));
});
