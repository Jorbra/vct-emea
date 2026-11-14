// Agents' pages, the fantasy players' agent.
import test from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../lib/db.js";
import { agentPage, agentsOverview } from "../lib/agentpage.js";
import { fantasyPool } from "../lib/round7.js";

test("agents' pages: known agents have a page even unplayed, unknown ones none", () => {
  const db = openDb(":memory:");
  assert.deepEqual(agentsOverview(db), []);
  const j = agentPage("Jett", db);
  assert.equal(j.key, "jett");
  assert.equal(j.name, "Jett");
  assert.equal(j.picks, 0);
  assert.ok(j.portrait.startsWith("https://"));
  assert.ok(/^#/.test(j.color));
  assert.deepEqual(j.maps, []);
  assert.equal(agentPage("kayo", db).name, "KAY/O");
  assert.equal(agentPage("nobody", db), null);
});

test("fantasy: each player carries their main agent", () => {
  const pool = fantasyPool([{ slug: "a", name: "A", team: "T", r: 1.1, acs: 220, kd: 1.1, maps: 4, agents: [{ name: "viper", n: 3 }] }, { slug: "b", name: "B", team: "T", r: 1, acs: 200, kd: 1, maps: 4, agents: [] }]);
  assert.equal(pool.find((p) => p.slug === "a").agent, "viper");
  assert.equal(pool.find((p) => p.slug === "b").agent, "");
});

test("maps' pages: every competitive map, unplayed ones too", async () => {
  const { mapsOverview, topAgents } = await import("../lib/mappage.js");
  const list = mapsOverview(openDb(":memory:"));
  assert.ok(list.some((m) => m.name === "Bind" && m.played === 0 && m.splash && m.icon));
  assert.ok(!list.some((m) => m.name === "Gauntlet"));
  const entries = [{ details: { maps: [{ map: "Bind", rows: [{ side: "a", agents: ["viper", "jett"] }, { side: "b", agents: ["viper"] }] }] } }];
  assert.deepEqual(topAgents(entries, "bind").map((a) => [a.name, a.pct]), [["viper", 100], ["jett", 50]]);
});

test("round 13: tiers, rating by map, veto, duel", async () => {
  const { agentTiers, ratingByMap, parseVeto, agentDuel } = await import("../lib/round13.js");
  const map = (a, b, ra, rb) => ({ map: "Bind", a, b, rows: [...ra.map((x) => ({ name: x[0], side: "a", r: x[1], acs: 200, agents: [x[2]] })), ...rb.map((x) => ({ name: x[0], side: "b", r: x[1], acs: 180, agents: [x[2]] }))] });
  const entries = [
    { details: { maps: [map(13, 7, [["Pa", 1.3, "viper"], ["Pb", 1.0, "jett"]], [["Pc", 0.9, "viper"], ["Pd", 0.8, "sova"]])] } },
    { details: { maps: [map(9, 13, [["Pa", 0.9, "viper"], ["Pb", 1.1, "raze"]], [["Pc", 1.2, "viper"], ["Pd", 1.0, "sova"]])] } },
  ];
  const tiers = agentTiers(entries, "bind");
  assert.equal(tiers[0].tier, "S");
  assert.equal(tiers[0].agents[0].name, "viper");
  assert.equal(tiers[0].agents[0].pick, 100);
  assert.ok(!tiers.flatMap((t) => t.agents).some((a) => a.name === "jett"), "1 game is not enough");
  const rb = ratingByMap(entries, "pa");
  assert.deepEqual(rb, [{ map: "Bind", n: 2, r: 1.1, acs: 200, won: 1 }]);
  assert.deepEqual(parseVeto('<div class="match-header-note">FNC ban Lotus; TH ban Split; FNC pick Haven; TH pick Bind; Ascent remains</div>'), [
    { who: "FNC", act: "ban", map: "Lotus" }, { who: "TH", act: "ban", map: "Split" }, { who: "FNC", act: "pick", map: "Haven" }, { who: "TH", act: "pick", map: "Bind" }, { who: "", act: "left", map: "Ascent" },
  ]);
  assert.deepEqual(parseVeto("<div class=\"match-header-note\">Some note</div>"), []);
  const d = agentDuel({ key: "a", maps: [{ map: "Bind", pct: 50 }] }, { key: "b", maps: [{ map: "Bind", pct: 20 }, { map: "Lotus", pct: 80 }] });
  assert.deepEqual(d.maps, [{ map: "Lotus", a: 0, b: 80 }, { map: "Bind", a: 50, b: 20 }]);
});

test("round 13: mystery agent", async () => {
  const { dailyPuzzles, playMove, readGame, fillGames } = await import("../lib/games.js");
  const agents = ["jett", "raze", "sova", "viper", "omen"].map((k) => ({ key: k, name: k.charAt(0).toUpperCase() + k.slice(1), role: "Duelist", portrait: "https://x/p.png" }));
  const pz = dailyPuzzles({ players: [], logos: [], agents }, "2026-11-11");
  assert.ok(pz.agent && pz.agent.answer.name);
  const db = openDb(":memory:");
  fillGames(db);
  const token = "t".repeat(30);
  const names = agents.map((a) => a.name);
  let g = readGame(db, pz, { token, game: "agent" });
  assert.equal(g.zoom, 5);
  assert.equal(g.reveal, undefined);
  const wrong = names.filter((n) => n !== pz.agent.answer.name);
  g = playMove(db, pz, { agents: names }, { token, game: "agent", move: wrong[0] });
  g = playMove(db, pz, { agents: names }, { token, game: "agent", move: wrong[1] });
  assert.equal(g.role, "Duelist");
  assert.equal(playMove(db, pz, { agents: names }, { token, game: "agent", move: "Nobody" }).status, 400);
  g = playMove(db, pz, { agents: names }, { token, game: "agent", move: pz.agent.answer.name });
  assert.ok(g.done && g.won);
  assert.equal(g.reveal.key, pz.agent.answer.key);
});

test("agents' mastery poses: every agent has one, served from the site", async () => {
  const ASSETS = (await import("../lib/valorant-assets.json", { with: { type: "json" } })).default;
  for (const [k, a] of Object.entries(ASSETS.agents)) assert.match(a.pose || "", /^https:\/\/wiki\.playvalorant\.com\/en-us\/images\/thumb\/Mastery_I_Pose_/, k);
  assert.equal(agentPage("Jett", openDb(":memory:")).pose, "/api/pose/jett");
});
