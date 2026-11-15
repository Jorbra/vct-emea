import test from "node:test";
import assert from "node:assert/strict";
import { mapChance, ratingsFor, seriesChance, winChance } from "../lib/proba26.js";

test("win chances: maps, series, both teams", () => {
  assert.equal(mapChance(1500, 1500), 0.5);
  assert.ok(seriesChance(0.6, 3) > 0.6 && seriesChance(0.6, 5) > seriesChance(0.6, 3));
  assert.equal(seriesChance(0.6, 1), 0.6);
  const r = new Map([["alpha", 1600], ["beta", 1500]]);
  const c = winChance(r, "Alpha", "Beta", 3);
  assert.equal(c.a + c.b, 100);
  assert.ok(c.a > 64 && c.a < 75);
  assert.equal(winChance({ alpha: 1500, beta: 1500 }, "Alpha", "Beta").a, 50);
  assert.equal(winChance(r, "Alpha", "Nobody"), null);
  assert.deepEqual(ratingsFor(r, [{ a: { name: "Alpha" }, b: { name: "Gamma" } }]), { alpha: 1600 });
});

test("the bot's /proba", async () => {
  const { getState, openDb } = await import("../lib/db.js");
  const { COMMANDS, answerCommand } = await import("../lib/discordbot.js");
  const { botCtx, cmd } = await import("./botctx.mjs");
  assert.ok(COMMANDS.some((c) => c.name === "proba"));
  const ctx = botCtx(getState(openDb(":memory:")), { proba: (a, b, bo) => ({ ...winChance(new Map([["alpha", 1600], ["beta", 1500]]), "Alpha", "Beta", bo), nameA: "Alpha", nameB: "Beta" }) });
  const r = answerCommand("proba", cmd("proba", { equipe1: "Alpha", equipe2: "Beta", format: 5 }), ctx);
  assert.match(r.embeds[0].description, /\*\*Alpha\*\* \d+ %\n🟩+🟥*\n\*\*Beta\*\* \d+ %/u);
  assert.match(r.embeds[0].description, /\*\*Alpha\*\* part favori/);
  assert.match(r.embeds[0].footer.text, /Bo5/);
  assert.match(answerCommand("proba", cmd("proba", { equipe1: "A", equipe2: "B" }), botCtx(getState(openDb(":memory:")), { proba: () => null })).content, /pas encore/);
});
