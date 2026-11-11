// Round 9: event numbers, qualified teams, teams with no logo, open matches, MVP picks, fans' styles, the stream widget.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { getState, openDb } from "../lib/db.js";
import { saveQualifierScore, setQualifierTeams } from "../lib/qactions.js";
import { allMatches } from "../lib/matchlist.js";
import { eventNumbers, missingLogos, mvpGood, myMvpPicks, myStyle, openMatches, qualifiedTeams, saveMvpPick, saveStyle, stylesByName } from "../lib/round9.js";
import { matchCard, page } from "../lib/embed.js";
import { COMMANDS } from "../lib/discordbot.js";
import { BOT_COMMANDS } from "../lib/botstore.js";

const T = "n".repeat(40);
const sha = (t) => crypto.createHash("sha256").update(t).digest("hex");

function played() {
  const db = openDb(":memory:");
  setQualifierTeams(db, "meq1", Array.from({ length: 64 }, (_, i) => `T${i}`).join("\n"));
  for (let k = 0; k < 10; k++) {
    const open = allMatches(getState(db)).filter((m) => m.event === "meq1" && m.a && m.b && m.a.name && m.b.name && m.sa == null);
    for (const m of open) for (const w of [1, 2, 3]) if (saveQualifierScore(db, { event: "meq1", id: m.id, sa: w, sb: 0 }).ok) break;
  }
  return db;
}

test("event numbers, qualified teams, teams with no logo, open matches", () => {
  const db = played();
  const s = getState(db);
  const n = eventNumbers(s, "meq1");
  assert.equal(n.played, n.total);
  assert.equal(n.places, 1);
  const q = qualifiedTeams(s);
  assert.equal(q.length, 1);
  assert.equal(q[0].event, "meq1");
  assert.equal(q[0].to, "MENA Qualifier Playoffs");
  assert.ok(missingLogos(s).some((e) => e.event === "meq1" && e.teams.length === 64));
  assert.equal(openMatches(s).filter((m) => m.event === "meq1").length, 0);
});

test("MVP picks: open before the first match, counted once the event is over", () => {
  const db = openDb(":memory:");
  const events = [{ event: "meq1", name: "ME Qualifier 1", open: true, players: ["Ace", "Bolt"], mvp: "" }];
  assert.equal(saveMvpPick(db, events, { token: T, event: "meq1", player: "Ace" }).ok, false); // no name yet
  db.prepare("INSERT INTO voters (hash, name, created) VALUES (?, 'Fan', ?)").run(sha(T), new Date().toISOString());
  assert.equal(saveMvpPick(db, events, { token: T, event: "meq1", player: "Nobody" }).ok, false);
  assert.equal(saveMvpPick(db, events, { token: T, event: "meq1", player: "Ace" }).ok, true);
  assert.deepEqual(myMvpPicks(db, T), { meq1: "Ace" });
  assert.equal(saveMvpPick(db, [{ ...events[0], open: false }], { token: T, event: "meq1", player: "Bolt" }).ok, false);
  assert.equal(mvpGood(db, [{ ...events[0], open: false, mvp: "ace" }]).get(sha(T)), 1);
});

test("fans' avatar and colour: only from the lists", () => {
  const db = openDb(":memory:");
  db.prepare("INSERT INTO voters (hash, name, created) VALUES (?, 'Fan', ?)").run(sha(T), new Date().toISOString());
  assert.equal(saveStyle(db, { token: T, emoji: "🔥", color: "#ff4655" }).ok, true);
  assert.deepEqual(myStyle(db, T), { emoji: "🔥", color: "#ff4655" });
  saveStyle(db, { token: T, emoji: "<script>", color: "red" });
  assert.deepEqual(stylesByName(db), { Fan: { emoji: "", color: "" } });
});

test("stream widget: escaped names, live score, a full page", () => {
  const m = { a: { name: "A<b>" }, b: { name: "B" }, sa: null, sb: null };
  const html = matchCard(m, { a: 1, b: 0, maps: [{ map: "Bind", a: 13, b: 7 }] });
  assert.match(html, /A&lt;b&gt;/);
  assert.match(html, /1 – 0/);
  assert.match(html, /Bind 13–7/);
  assert.match(page(html), /http-equiv="refresh"/);
});

test("bot: /quiz and /palmares are known and turned on", () => {
  for (const c of ["quiz", "palmares"]) { assert.ok(COMMANDS.some((x) => x.name === c), c); assert.ok(BOT_COMMANDS.includes(c), c); }
});
