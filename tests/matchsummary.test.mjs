// A finished match in three short sentences (lib/matchsummary.js).
import test from "node:test";
import assert from "node:assert/strict";
import { matchSummary } from "../lib/matchsummary.js";

test("summary: winner and score, the closest map (overtime noted), the best player", () => {
  const s = matchSummary({ a: "MIR", b: "La masia", sa: 2, sb: 1 }, [{ map: "Abyss", a: 13, b: 8 }, { map: "Lotus", a: 13, b: 15 }, { map: "Haven", a: 13, b: 10 }], { name: "Sevire", acs: 297.4, r: 1.52 });
  assert.deepEqual(s, ["MIR bat La masia 2–1 au bout de la dernière carte", "Carte la plus serrée : Lotus (13–15), en prolongation", "Meilleur joueur : Sevire (297 ACS, note 1.52)"]);
});

test("summary: a clean sweep, and nothing for a match not over", () => {
  assert.equal(matchSummary({ a: "Joblife", b: "WIP", sa: 2, sb: 0 }, [], null)[0], "Joblife s'impose 2–0 face à WIP, sans perdre de carte");
  assert.deepEqual(matchSummary({ a: "A", b: "B", sa: null, sb: null }), []);
  assert.equal(matchSummary({ a: "A", b: "B", sa: 2, sb: 1, bo: 5 })[0], "A bat B 2–1");
  assert.equal(matchSummary({ a: "A", b: "B", sa: 3, sb: 2, bo: 5 })[0], "A bat B 3–2 au bout de la dernière carte");
  assert.equal(matchSummary({ a: "A", b: "B", sa: 0, sb: 2 }, [], null, "en")[0], "B won 2–0 against A without dropping a map");
});
