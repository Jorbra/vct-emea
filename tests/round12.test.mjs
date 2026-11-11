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
