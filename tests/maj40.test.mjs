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

test("live: map point, match point, the first half and a run of rounds", async () => {
  const { mapPoint, seriesPoint, halfTime, roundStreak } = await import("../lib/livemore.js");
  assert.deepEqual([mapPoint({ a: 12, b: 7 }), mapPoint({ a: 11, b: 12 }), mapPoint({ a: 12, b: 12 }), mapPoint({ a: 14, b: 13 }), mapPoint({ a: 13, b: 7, done: true }), mapPoint({ a: 10, b: 3 })], ["a", "b", "", "a", "", ""]);
  const maps = [{ map: "Bind", a: 13, b: 9, done: true }, { map: "Lotus", a: 7, b: 12, done: false }];
  assert.deepEqual(seriesPoint(maps, 3), { side: "b", match: false });
  assert.deepEqual(seriesPoint([{ map: "Bind", a: 13, b: 9, done: true }, { map: "Lotus", a: 12, b: 7, done: false }], 3), { side: "a", match: true });
  assert.equal(seriesPoint([{ map: "Bind", a: 3, b: 2 }], 3), null);
  const rnd = [..."aaaabbbbbbbb"].map((s) => `${s}te`).concat(["ate", "ace", "acd"]);
  assert.deepEqual(halfTime(rnd), { a: 4, b: 8 });
  assert.equal(halfTime(rnd.slice(0, 11)), null);
  assert.deepEqual(roundStreak(rnd), { side: "a", n: 3 });
  assert.equal(roundStreak(["ate", "bte"]), null);
});

test("match page: the time left before a match, and the result as text to paste", async () => {
  const { timeLeft, resultText } = await import("../lib/maj40.js");
  const now = Date.parse("2026-11-26T12:00:00Z");
  assert.deepEqual(timeLeft("2026-11-26T14:15:30Z", now), { d: 0, h: 2, m: 15 });
  assert.equal(timeLeft("2026-11-26T11:00:00Z", now), null);
  assert.equal(resultText({ a: "UCAM", b: "La masia", sa: 2, sb: 0, event: "EU", maps: [{ map: "Bind", a: 13, b: 9 }], url: "https://x/m" }), "UCAM 2–0 La masia · EU · Bind 13–9 · https://x/m");
});

test("404: the words of an address not found, to suggest pages that look like it", async () => {
  const { wordsOfPath } = await import("../lib/maj40.js");
  assert.equal(wordsOfPath("/team/team-vitalty/"), "team vitalty");
  assert.equal(wordsOfPath("/player/Kipper%20man"), "Kipper man");
  assert.equal(wordsOfPath("/fnatic"), "fnatic");
  assert.equal(wordsOfPath("/"), "");
});

test("news feed (RSS) and breadcrumb for search engines", async () => {
  const { rssFeed, breadcrumbLd } = await import("../lib/maj40.js");
  const feed = rssFeed([{ id: 3, title: "Playoffs <ce soir> & demain", body: "Texte", at: "2026-11-26T10:00:00Z" }], "https://site");
  assert.match(feed, /^<\?xml/);
  assert.match(feed, /<title>Playoffs &lt;ce soir&gt; &amp; demain<\/title>/);
  assert.match(feed, /<link>https:\/\/site\/news\/3<\/link>/);
  assert.match(feed, /<pubDate>Thu, 26 Nov 2026 10:00:00 GMT<\/pubDate>/);
  const ld = breadcrumbLd([["Accueil", "/"], ["Kickoff", "/kickoff"]], "https://site");
  assert.equal(ld.itemListElement[1].item, "https://site/kickoff");
  assert.equal(ld.itemListElement[1].position, 2);
});

test("robots.txt and the sitemap: the production address when set, else the address asked for", async () => {
  const { siteBase } = await import("../lib/maj40.js");
  assert.equal(siteBase("vct.example", "other.host", "https"), "https://vct.example");
  assert.equal(siteBase("", "vct.sslip.io", "https"), "https://vct.sslip.io");
  assert.equal(siteBase(undefined, "localhost:3210", null), "http://localhost:3210");
  assert.equal(siteBase("", "", ""), "https://vct-emea.vercel.app");
});

test("every text of the new parts of the site has its French", async () => {
  const fs = await import("node:fs");
  const { makeT } = await import("../lib/i18n.js");
  const fr = makeT("fr");
  // texts that read the same in French
  const same = new Set(["Discord", "Ctrl+S", "Rounds"]);
  const files = ["components/EditorFollow.jsx", "components/Maj40Bits.jsx", "components/LiveDetail.jsx", "components/KeyHelp.jsx", "components/NotFoundView.jsx"];
  const missing = [];
  for (const f of files) {
    const src = fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
    for (const m of src.matchAll(/\btr\("([^"]+)"/g)) {
      const key = m[1];
      if (!same.has(key) && fr(key) === key) missing.push(`${f}: ${key}`);
    }
  }
  assert.deepEqual(missing, []);
});
