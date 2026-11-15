import test from "node:test";
import assert from "node:assert/strict";
import { similarPlayers, teamPercentiles, teamRadarFor, teamRows } from "../lib/radar25.js";

const P = (name, team, r, acs, maps = 8) => ({ slug: name.toLowerCase(), name, team, r, acs, kd: r, kast: 70, adr: acs / 2, fk: maps, maps, agents: [{ name: "Jett", n: 3 }] });
const stats = {
  players: [P("A1", "Alpha", 1.3, 260), P("A2", "Alpha", 1.2, 240), P("B1", "Beta", 1.0, 210), P("C1", "Gamma", 0.9, 190), P("D1", "Delta", 1.1, 230), P("Twin", "Delta", 1.29, 259)],
  teams: {
    alpha: { name: "Alpha", maps: 8, mapsWon: 7, roundsW: 100, roundsL: 60 },
    beta: { name: "Beta", maps: 8, mapsWon: 4, roundsW: 80, roundsL: 80 },
    gamma: { name: "Gamma", maps: 8, mapsWon: 1, roundsW: 60, roundsL: 100 },
    delta: { name: "Delta", maps: 2, mapsWon: 1, roundsW: 20, roundsL: 20 },
  },
};

test("team rows and percentiles: 3 maps at least", () => {
  assert.equal(teamRows(stats).length, 3);
  const a = teamPercentiles(stats, "Alpha");
  assert.equal(a.find((x) => x.key === "win").pct, 100);
  assert.equal(a.find((x) => x.key === "win").value, "88%");
  assert.equal(teamPercentiles(stats, "Gamma").find((x) => x.key === "win").pct, 0);
  assert.deepEqual(teamPercentiles(stats, "Delta"), []);
  assert.equal(teamRadarFor(stats, "alp").name, "Alpha");
});

test("similar players: the closest profile first", () => {
  const s = similarPlayers(stats.players, stats.players[0]);
  assert.equal(s[0].name, "Twin");
  assert.ok(s[0].match > s[s.length - 1].match);
  assert.ok(!s.some((p) => p.slug === "a1"));
});

test("the bot's /radarequipe and /similaires", async () => {
  const { getState, openDb } = await import("../lib/db.js");
  const { COMMANDS, answerCommand } = await import("../lib/discordbot.js");
  const { botCtx, cmd } = await import("./botctx.mjs");
  assert.ok(["radarequipe", "similaires"].every((n) => COMMANDS.some((c) => c.name === n)));
  const ctx = botCtx(getState(openDb(":memory:")), {
    teamRadar: (q) => teamRadarFor(stats, q),
    similar: () => ({ name: "A1", slug: "a1", list: similarPlayers(stats.players, stats.players[0]) }),
  });
  assert.match(answerCommand("radarequipe", cmd("radarequipe", { equipe: "Alpha" }), ctx).embeds[0].description, /\*\*Maps %\*\* ▰+ 88% · meilleure que 100 %/);
  assert.match(answerCommand("radarequipe", cmd("radarequipe", { equipe: "zzz" }), ctx).content, /introuvable/);
  assert.match(answerCommand("similaires", cmd("similaires", { joueur: "A1" }), ctx).embeds[0].description, /\*\*Twin\*\* \(Delta\) · \d+ % de ressemblance/);
});
