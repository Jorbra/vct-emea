import test from "node:test";
import assert from "node:assert/strict";
import { percentiles, podiumBy, radarFor, topBadges } from "../lib/radar24.js";

const P = (name, r, acs, maps = 8) => ({ slug: name.toLowerCase(), name, team: "T", r, acs, kd: r, kast: 70, adr: acs / 2, fk: maps, maps, agents: [{ name: "Jett", n: 3 }] });
const players = [P("Alpha", 1.4, 280), P("Beta", 1.2, 240), P("Gamma", 1.0, 200), P("Delta", 0.9, 190), P("Few", 2.0, 400, 1)];

test("percentiles: the share of the others below, among players with 3 maps", () => {
  const a = percentiles(players, players[0]);
  assert.equal(a.find((x) => x.key === "r").pct, 100);
  assert.equal(a.find((x) => x.key === "acs").pct, 100);
  assert.equal(percentiles(players, players[3]).find((x) => x.key === "r").pct, 0);
  assert.deepEqual(percentiles(players, players[4]), []); // one map: not ranked
  assert.ok(percentiles(players, players[1]).every((x) => x.pct >= 0 && x.pct <= 100));
});

test("top badges, the radar by name, the podium by stat", () => {
  const b = topBadges(percentiles(players, players[0]));
  assert.ok(b.length >= 1 && b.length <= 3);
  assert.equal(b[0].top, 1);
  assert.equal(radarFor(players, "alp").name, "Alpha");
  assert.equal(radarFor(players, "zzz"), null);
  assert.deepEqual(podiumBy(players, "acs", 6).map((p) => p.name), ["Alpha", "Beta", "Gamma"]);
  assert.equal(podiumBy(players, "acs", 6)[0].value, 280);
});

test("the bot's /radar and /podium with a stat", async () => {
  const { getState, openDb } = await import("../lib/db.js");
  const { COMMANDS, answerCommand } = await import("../lib/discordbot.js");
  const { botCtx, cmd } = await import("./botctx.mjs");
  assert.ok(COMMANDS.some((c) => c.name === "radar"));
  const st = getState(openDb(":memory:"));
  const ctx = botCtx(st, { radar: (q) => radarFor(players, q), podium: (s) => podiumBy(players, s, 6) });
  const r = answerCommand("radar", cmd("radar", { joueur: "Alpha" }), ctx);
  assert.match(r.embeds[0].description, /\*\*Rating\*\* ▰+ 1\.40 · meilleur que 100 %/);
  assert.match(answerCommand("radar", cmd("radar", { joueur: "nobody" }), ctx).content, /introuvable/);
  const p = answerCommand("podium", cmd("podium", { stat: "acs" }), ctx);
  assert.match(p.embeds[0].title, /ACS/);
  assert.match(p.embeds[0].description, /🥇 \*\*Alpha\*\* \(T\) · \*\*280\*\*/);
});
