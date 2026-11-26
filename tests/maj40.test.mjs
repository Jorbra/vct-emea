// The big update ("maj-40"): the behind-the-scenes fixes and the new things, each checked here when it can be without a browser.
import test from "node:test";
import assert from "node:assert/strict";
import { decodeEntities, roundKey } from "../lib/vlrmatch.js";

test("vlr.gg: every HTML entity is read as the page shows it", () => {
  assert.equal(decodeEntities("Be&#351;ikta&#x15F; &amp; Co &ndash; &quot;A&quot; &#039;B&apos; &hellip;"), "Beşiktaş & Co – \"A\" 'B' …");
  assert.equal(decodeEntities("&unknown; &#0; &#xFFFFFFF;"), "&unknown; &#0; &#xFFFFFFF;");
  assert.equal(roundKey("Swiss Stage&ndash;Round 2 (1-0)"), "s2");
});

test("a live mark left behind (12 h after its time, no news from vlr.gg) is no longer shown live, and is listed for the editors", async () => {
  const { dropForgottenLive } = await import("../lib/matchlist.js");
  const now = Date.parse("2026-11-26T12:00:00Z");
  const state = {
    times: { q1: { old: "2026-11-25T10:00:00Z", fresh: "2026-11-26T09:00:00Z", read: "2026-11-25T10:00:00Z" } },
    live: { q1: { old: { a: 0, b: 0 }, fresh: { a: 0, b: 0 }, read: { a: 1, b: 0, readAt: "2026-11-26T11:58:00Z" }, notime: { a: 0, b: 0 } } },
  };
  assert.deepEqual(dropForgottenLive(state, now), [{ event: "q1", id: "old", at: "2026-11-25T10:00:00Z" }]);
  assert.deepEqual(Object.keys(state.live.q1).sort(), ["fresh", "notime", "read"]);
});
