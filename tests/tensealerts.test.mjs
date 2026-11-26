// Alerts for the tense moments of a match: its deciding map, a map in overtime (lib/discord.js, for the push alerts only).
import test from "node:test";
import assert from "node:assert/strict";
import { alertText } from "../lib/discord.js";
import { tension } from "../lib/livemore.js";

test("tense moments: 1-1 in a Bo3 is the deciding map, 12-12 and more is overtime", () => {
  const t = tension({ a: 1, b: 1, maps: [{ map: "Abyss", a: 13, b: 8, done: true }, { map: "Lotus", a: 10, b: 13, done: true }, { map: "Haven", a: 12, b: 12, done: false }] }, 3);
  assert.equal(t.decider, true);
  assert.equal(t.ot, "Haven");
  assert.equal(tension({ a: 1, b: 0, maps: [{ map: "Abyss", a: 13, b: 8, done: true }, { map: "Lotus", a: 5, b: 7, done: false }] }, 3).decider, false);
});

test("tense moments: their alert texts", () => {
  assert.equal(alertText({ kind: "decider", a: "MIR", b: "La masia", event: "playoffs" }, "fr").startsWith("🔥 **Carte décisive : MIR vs La masia**"), true);
  assert.equal(alertText({ kind: "ot", map: "Haven", sa: 12, sb: 12, a: "MIR", b: "La masia", event: "playoffs" }, "fr").startsWith("⏱️ **Prolongation · Haven : MIR 12–12 La masia**"), true);
});
