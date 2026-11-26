// The big update ("maj-40"): the behind-the-scenes fixes and the new things, each checked here when it can be without a browser.
import test from "node:test";
import assert from "node:assert/strict";
import { decodeEntities, roundKey } from "../lib/vlrmatch.js";

test("vlr.gg: every HTML entity is read as the page shows it", () => {
  assert.equal(decodeEntities("Be&#351;ikta&#x15F; &amp; Co &ndash; &quot;A&quot; &#039;B&apos; &hellip;"), "Beşiktaş & Co – \"A\" 'B' …");
  assert.equal(decodeEntities("&unknown; &#0; &#xFFFFFFF;"), "&unknown; &#0; &#xFFFFFFF;");
  assert.equal(roundKey("Swiss Stage&ndash;Round 2 (1-0)"), "s2");
});
