// The events' sources set by the editors with links.
import test from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../lib/db.js";
import { mergeToornament, mergeVlr, parseToornament, parseVlr, readSources, saveSource } from "../lib/sources.js";
import { TOORNAMENT, toornamentIds } from "../lib/toornament.js";
import { VLR_BRACKETS, VLR_EVENTS, vlrSources } from "../lib/vlrmatch.js";

test("links: Toornament and vlr.gg numbers from the pages people paste", () => {
  assert.equal(parseToornament("https://play.toornament.com/en_GB/tournaments/2585088541901830143/stages/2609739073737267199"), "2585088541901830143");
  assert.equal(parseToornament("https://play.toornament.com/tournaments/2585088541901830143/"), "2585088541901830143");
  assert.equal(parseToornament("2585088541901830143"), "2585088541901830143");
  assert.equal(parseToornament("https://example.com/x"), "");
  assert.equal(parseVlr("https://www.vlr.gg/event/3177/vct-2027-emea-kickoff-t-rkiye-qualifier"), "3177");
  assert.equal(parseVlr("https://www.vlr.gg/event/matches/3175/?series_id=all"), "3175");
  assert.equal(parseVlr("vlr.gg/team/123"), "");
});

test("sources: what the editors set replaces the code's, and can be taken back", () => {
  const db = openDb(":memory:");
  assert.deepEqual(toornamentIds(db), TOORNAMENT);
  assert.equal(saveSource(db, { event: "trq2", toornament: "https://play.toornament.com/fr/tournaments/1234567890123456789/" }).ok, true);
  assert.equal(toornamentIds(db).trq2, "1234567890123456789");
  assert.equal(saveSource(db, { event: "q1", toornament: "off" }).ok, true);
  assert.equal(toornamentIds(db).q1, undefined);
  // vlr.gg: an event with its stage, and its bracket
  assert.equal(saveSource(db, { event: "q2", vlr: "https://www.vlr.gg/event/9999/x", stage: "Qualifier #2", bracket: true }).ok, true);
  const v = vlrSources(db);
  const q2 = v.events.find((x) => x.event === "q2");
  assert.equal(q2.vlr, "9999");
  assert.ok(q2.stage.test("Round of 16 Qualifier #2") && !q2.stage.test("Round of 16 Qualifier #1"));
  assert.ok(v.brackets.includes("q2"));
  // refused: bad links, a Toornament bracket for an event that is not an open qualifier, an unknown event
  assert.equal(saveSource(db, { event: "q2", toornament: "https://example.com" }).ok, false);
  assert.equal(saveSource(db, { event: "kickoff", toornament: "1234567890123456789" }).ok, false);
  assert.equal(saveSource(db, { event: "nope", vlr: "3175" }).ok, false);
  // empty: back to the code's
  saveSource(db, { event: "q2" });
  assert.equal(readSources(db).q2, undefined);
  assert.equal(vlrSources(db).events.find((x) => x.event === "q2").vlr, VLR_EVENTS.find((x) => x.event === "q2").vlr);
});

test("merging: the code's lists stay as they are when nobody set anything", () => {
  assert.deepEqual(mergeToornament({ a: "1" }, {}), { a: "1" });
  const m = mergeVlr(VLR_EVENTS, VLR_BRACKETS, {});
  assert.equal(m.events.length, VLR_EVENTS.length);
  assert.deepEqual(m.brackets, VLR_BRACKETS);
  assert.equal(mergeVlr(VLR_EVENTS, VLR_BRACKETS, { trq1: { vlr: "off" } }).events.some((x) => x.event === "trq1"), false);
});
