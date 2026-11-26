// The performance work of the big update: the site stamp, the languages sent to the browser, the logos' addresses.
import test from "node:test";
import assert from "node:assert/strict";

test("site stamp: the same while nothing changes, another one after a new vlr.gg read", async () => {
  const { getDb } = await import("../lib/db.js");
  const { saveItem } = await import("../lib/lpstore.js");
  const { siteStamp } = await import("../lib/stamp.js");
  const db = getDb();
  const a = siteStamp(db);
  assert.match(a, /^[\w-]{16}\.[\w-]{8}$/);
  assert.equal(siteStamp(db), a);
  saveItem("vlr_live", "q1:qf-1", { at: new Date().toISOString(), sa: 1, sb: 0, maps: [] }, db);
  assert.notEqual(siteStamp(db), a);
});

test("languages: the server knows Turkish and Arabic; the browser's module has none without the page's words", async () => {
  const server = await import("#extra-dicts");
  assert.ok(Object.keys(server.TR).length > 100 && Object.keys(server.AR).length > 100);
  assert.deepEqual(server.WITH_PAGE, ["tr", "ar"]);
  const browser = await import("../lib/i18n-extra-browser.js");
  assert.deepEqual([browser.TR, browser.AR], [{}, {}]);
  const { makeT } = await import("../lib/i18n.js");
  assert.equal(makeT("tr")("Calendar"), server.TR.Calendar);
});

test("logos: the site's own files go through the resizer, the others stay as they are", async () => {
  const { crestSrc } = await import("../lib/maj40.js");
  const own = crestSrc("/team-logos/team-vitality.png");
  assert.equal(own.src, "/_next/image?url=%2Fteam-logos%2Fteam-vitality.png&w=128&q=75");
  assert.match(own.srcSet, /w=64&q=75 64w, .*w=256&q=75 256w$/);
  assert.equal(own.sizes, "64px");
  assert.deepEqual(crestSrc("https://play.toornament.com/media/file/1/logo_medium"), { src: "https://play.toornament.com/media/file/1/logo_medium" });
  assert.deepEqual(crestSrc("/team-logos/x.svg"), { src: "/team-logos/x.svg" });
  assert.deepEqual(crestSrc("/team-logos/../secret.png"), { src: "/team-logos/../secret.png" }); // a path with a slash in it is not one of ours
});
