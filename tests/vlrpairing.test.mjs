// Tying vlr.gg's matches to the site's: the Europe playoffs' Swiss rounds, and two candidates for one name (lib/vlrmatch.js).
import test from "node:test";
import assert from "node:assert/strict";
import { findSiteMatch, roundKey } from "../lib/vlrmatch.js";

test("vlr pairing: the Swiss round as a match's series writes it", () => {
  assert.equal(roundKey("Round 1 (0-0)"), "s1");
  assert.equal(roundKey("Round 3 (1-1)"), "s3");
  assert.equal(roundKey("Round of 64"), "r64");
});

test("vlr pairing: two candidates for one short name, the one where both names fit wins", () => {
  const items = [
    { id: "r512-124", a: { name: "Dynasty" }, b: { name: "Oxyron E-Sports" } },
    { id: "r512-152", a: { name: "Ashborn" }, b: { name: "Dynasty Hydra" } },
  ];
  assert.deepEqual(findSiteMatch(items, "Ashborn", "Dynasty", "r512"), { id: "r512-152", swap: false });
  // a short name alone with nothing else to tell them apart: no guess
  const twins = [{ id: "r512-1", a: { name: "Dynasty" }, b: { name: "X One" } }, { id: "r512-2", a: { name: "Dynasty" }, b: { name: "Y Two" } }];
  assert.equal(findSiteMatch(twins, "Dynasty", "Zed", "r512"), null);
});

test("vlr pairing: a longer name on vlr.gg with the same other team", () => {
  const items = [{ id: "s1-m01", a: { name: "UCAM Esports" }, b: { name: "CGN ESPORTS" } }, { id: "s1-m02", a: { name: "Mandatory" }, b: { name: "Barça eSports" } }];
  assert.deepEqual(findSiteMatch(items, "UCAM Esports Club", "CGN Esports", roundKey("Round 1 (0-0)")), { id: "s1-m01", swap: false });
});
