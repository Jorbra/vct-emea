// The stream overlays' data and settings.
import test from "node:test";
import assert from "node:assert/strict";
import { getState, openDb, setMatchTime, setMatchLive } from "../lib/db.js";
import { saveQualifierScore, setQualifierTeams } from "../lib/qactions.js";
import { allMatches } from "../lib/matchlist.js";
import { overlayData, overlayParams } from "../lib/overlay.js";

const DAY = 86400000;

test("overlay: the live match first, else the next one; results and coming matches", () => {
  const db = openDb(":memory:");
  setQualifierTeams(db, "meq1", Array.from({ length: 8 }, (_, i) => `T${i}`).join("\n"));
  const ms = allMatches(getState(db)).filter((m) => m.event === "meq1" && m.a && m.b && m.a.name && m.b.name);
  const now = Date.now();
  setMatchTime(db, { event: "meq1", id: ms[0].id, at: new Date(now - DAY).toISOString() });
  saveQualifierScore(db, { event: "meq1", id: ms[0].id, sa: 1, sb: 0 });
  setMatchTime(db, { event: "meq1", id: ms[1].id, at: new Date(now + 3600000).toISOString() });
  setMatchTime(db, { event: "meq1", id: ms[2].id, at: new Date(now + 7200000).toISOString() });
  let d = overlayData(getState(db), { event: "meq1", now });
  assert.equal(d.match.id, ms[1].id); // nothing live: the next one
  assert.equal(d.results[0].id, ms[0].id);
  assert.equal(d.results[0].sa, 1);
  assert.deepEqual(d.upcoming.map((m) => m.id), [ms[1].id, ms[2].id]);
  setMatchLive(db, { event: "meq1", id: ms[2].id, live: true, a: 1, b: 0 });
  d = overlayData(getState(db), { event: "meq1", now });
  assert.equal(d.match.id, ms[2].id);
  assert.equal(d.match.live, true);
  assert.equal(d.match.sa, 1);
  assert.equal(d.live.length, 1);
  // one match asked for
  assert.equal(overlayData(getState(db), { match: `meq1:${ms[0].id}`, now }).match.id, ms[0].id);
  // nothing in the state: nothing shown, no error
  assert.equal(overlayData(getState(openDb(":memory:")), {}).match, null);
});

test("overlay settings: known values only", () => {
  assert.deepEqual(overlayParams({}), { type: "scoreboard", event: "", match: "", accent: "", theme: "dark", pos: "top", scale: 1, title: "", until: "" });
  const p = overlayParams({ type: "standby", event: "q2", match: "q2:r16-1", accent: "ff4655", theme: "glass", pos: "bottom", scale: "9", title: "Bientôt", until: "20:30" });
  assert.deepEqual(p, { type: "standby", event: "q2", match: "q2:r16-1", accent: "#ff4655", theme: "glass", pos: "bottom", scale: 2, title: "Bientôt", until: "20:30" });
  assert.equal(overlayParams({ type: "<script>", accent: "red", match: "x" }).type, "scoreboard");
  assert.equal(overlayParams({ accent: "red" }).accent, "");
  assert.equal(overlayParams({ match: "../../etc" }).match, "");
});

test("streams the visitors add: Kick too, names and pasted links", async () => {
  const { embedUrl } = await import("../lib/media.js");
  assert.equal(embedUrl("https://kick.com/gaules", "site.test"), "https://player.kick.com/gaules?autoplay=false");
  assert.equal(embedUrl("https://kick.com/", "site.test"), "");
  assert.equal(embedUrl("http://kick.com/x", "site.test"), "");
});
