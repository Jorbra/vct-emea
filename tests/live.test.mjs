// The live follow-up from vlr.gg: which matches are read first, how they are tied to the site's, and what the match page shows.
import test from "node:test";
import assert from "node:assert/strict";
import { getDb, getMatchLive, getState, liveDetail } from "../lib/db.js";
import { setQualifierTeams } from "../lib/qactions.js";
import { allMatches } from "../lib/matchlist.js";
import { saveItem, readItems } from "../lib/lpstore.js";
import { IDLE_EVERY, LIVE_EVERY, findSiteMatch, inRound, parseRounds, parseVlrMatch, pickLive, roundKey, vlrMatchesIfDue } from "../lib/vlrmatch.js";
import { compactRounds, liveUpdate } from "../lib/vlive.js";

test("vlr.gg's rounds: the Swiss Stage and the regional groups are the site's rounds", () => {
  assert.deepEqual(["Swiss Stage&ndash;Round 1 (0-0)", "Swiss Stage–Round 3 (1-1)", "Playoffs&ndash;Opening (B)", "Winners' Match (A)", "Elimination (C)", "Decider (D)", "Round of 64", "Grand Final"].map(roundKey),
    ["s1", "s3", "gb-o", "ga-w", "gc-e", "gd-d", "r64", "gf"]);
  assert.equal(inRound("s1-m02", "s1"), true);
  assert.equal(inRound("s10-m02", "s1"), false);
  assert.equal(inRound("gb-o2", "gb-o"), true);
  assert.equal(inRound("gb-w", "gb-o"), false);
  assert.equal(inRound("r64-3", "r64"), true);
  assert.equal(inRound("r64-3", "r6"), false);
  // a name written another way on vlr.gg: the other team, alone in the round, decides
  const items = [{ id: "s1-m01", a: { name: "UCAM Esports" }, b: { name: "La masia" } }, { id: "s1-m02", a: { name: "NAVI Junior" }, b: { name: "Aurora Gaming" } }];
  assert.deepEqual(findSiteMatch(items, "Natus Vincere Junior", "Aurora Gaming", "s1"), { id: "s1-m02", swap: false });
  assert.deepEqual(findSiteMatch(items, "La Masia", "UCAM Esports Club", "s1"), { id: "s1-m01", swap: true });
  assert.equal(findSiteMatch(items, "Natus Vincere Junior", "Aurora Gaming", "s2"), null);
});

const sq = (win, side, how) => (win ? `<div class="rnd-sq mod-win mod-${side}"><img src="/img/vlr/game/round/${how}.webp"></div>` : `<div class="rnd-sq "></div>`);
const col = (n, w, side, how) => `<div class="vlr-rounds-row-col " title="x"><div class="rnd-num">${n}</div>${sq(w === 1, side, how)}${sq(w === 2, side, how)}</div>`;
const roundsHtml = (list) => `<div class="vlr-rounds"><div class="vlr-rounds-row"><div class="vlr-rounds-row-col mod-teams"><div class="team">A</div></div>${list.map((r, i) => col(i + 1, ...r)).join("")}<div class="vlr-rounds-row-col "><div class="rnd-num">${list.length + 1}</div>${sq(false)}${sq(false)}</div></div></div>`;
const row = (name, tag, k, d, agent = "jett") => `<div class="ovw-row"><div class="ovw-player-name text-of">${name}</div><div class="ovw-player-tag">${tag}</div><img src="/img/vlr/game/agents/${agent}.png"><div data-col="rating2"><span class="side mod-both">1.10</span></div><div data-col="acs"><span class="side mod-both">250</span></div><span data-col="kills"><span class="side mod-both">${k}</span></span><span data-col="deaths"><span class="side mod-both">${d}</span></span><span data-col="assists"><span class="side mod-both">3</span></span></div>`;

/** A vlr.gg match page: the first map over, the second being played. */
function page(a, b, { first = [13, 9], second = [5, 3], rounds = [[1, "t", "elim"], [2, "ct", "defuse"], [1, "t", "boom"]] } = {}) {
  return `<div class="match-header-link-name mod-1"><div class="wf-title-med ">${a}</div></div><div class="match-header-link-name mod-2"><div class="wf-title-med ">${b}</div></div>`
    + `<div class="match-header-vs-score"> <span>1</span> : <span>0</span> </div><div class="match-header-vs-note"> Bo3</div>`
    + `<a class="vm-stats-gamesnav-item js-map-switch " data-game-id="1">1</a><a class="vm-stats-gamesnav-item js-map-switch mod-active mod-live " data-game-id="2">2</a>`
    + `<div class="vm-stats-game " data-game-id="1"><div class="score mod-win">${first[0]}</div><div class="map"><div class="map-name"> Bind </div></div><div class="score ">${first[1]}</div>${row("p1", "AA", 20, 10)}${row("q1", "BB", 9, 18)}</div>`
    + `<div class="vm-stats-game " data-game-id="all">${row("p1", "AA", 30, 20)}${row("q1", "BB", 19, 28)}</div>`
    + `<div class="vm-stats-game mod-active" data-game-id="2"><div class="score ">${second[0]}</div><div class="map"><div class="map-name"> Lotus </div></div><div class="score ">${second[1]}</div>${roundsHtml(rounds)}${row("p1", "AA", 10, 10, "sova")}${row("q1", "BB", 10, 10)}</div>`
    + `<div class="vm-stats-game " data-game-id="3"><div class="score ">0</div><div class="map"><div class="map-name"> TBD </div></div><div class="score ">0</div></div>`;
}

test("a page being played: the map being played, its rounds and the players, sides as on the site", () => {
  const p = parseVlrMatch(page("Team A", "Team B"));
  assert.equal(p.now, "Lotus");
  assert.deepEqual(p.maps[1].rounds, [{ w: 1, side: "t", how: "elim" }, { w: 2, side: "ct", how: "defuse" }, { w: 1, side: "t", how: "boom" }]);
  assert.deepEqual(parseRounds("nothing"), []);
  assert.deepEqual(compactRounds(p.maps[1].rounds, false), ["ate", "bcd", "atb"]);
  assert.deepEqual(compactRounds(p.maps[1].rounds, true), ["bte", "acd", "btb"]);
  const s = liveUpdate(null, p, true, Date.parse("2026-11-25T17:00:00Z"));
  assert.equal(s.now, "Lotus");
  assert.deepEqual([s.sa, s.sb], [0, 1]); // swapped: the page's first team is the site's second
  assert.deepEqual(s.maps.map((m) => [m.map, m.a, m.b, m.done]), [["Bind", 9, 13, true], ["Lotus", 3, 5, false]]);
  assert.deepEqual(s.maps[1].rnd, ["bte", "acd", "btb"]);
  // the players of the map being played, and of every map
  assert.deepEqual(s.players.map.map((x) => [x.name, x.side, x.agent, x.k, x.d]), [["p1", "b", "sova", 10, 10], ["q1", "a", "jett", 10, 10]]);
  assert.deepEqual(s.players.all.map((x) => [x.name, x.side, x.k]), [["p1", "b", 30], ["q1", "a", 19]]);
});

test("the matches vlr.gg shows being played are read first, then the one read longest ago; a forgotten live waits", () => {
  const now = Date.parse("2026-11-25T17:00:00Z");
  const items = [1, 2, 3, 4].map((i) => ({ id: `qf-${i}`, a: { name: `A${i}` }, b: { name: `B${i}` }, sa: i === 4 ? 2 : null }));
  const v = (i, live) => ({ a: `A${i}`, b: `B${i}`, round: "qf", live, done: false });
  const mine = [v(1, false), v(2, true), v(3, true), v(4, true)];
  const vlive = {
    "q1:qf-2": { at: new Date(now - 2 * LIVE_EVERY).toISOString() },
    "q1:qf-3": { at: new Date(now - 3 * LIVE_EVERY).toISOString() },
    "q1:qf-1": { at: new Date(now - IDLE_EVERY / 2).toISOString() },
  };
  const picks = pickLive([{ event: "q1", items, mine, siteLive: { "qf-1": true } }], vlive, now);
  assert.deepEqual(picks.map((p) => [p.site.id, p.onVlr, p.due]), [["qf-3", true, true], ["qf-2", true, true], ["qf-1", false, false]]); // qf-4 has its result
  // just read: it waits a minute
  vlive["q1:qf-3"].at = new Date(now - 10000).toISOString();
  assert.equal(pickLive([{ event: "q1", items, mine, siteLive: {} }], vlive, now).find((p) => p.site.id === "qf-3").due, false);
});

/** vlr.gg's list of an event, with the matches given. */
const list = (ms) => ms.map((m) => `<a href="/${m.id}/x-vs-y" class="wf-module-item match-item">${m.live ? `<div class="match-item-eta"><div class="ml mod-live"><div class="ml-status">LIVE</div></div></div>` : ""}<div class="match-item-vs-team-name">${m.a}</div></div><div class="match-item-vs-team-score">${m.sa ?? "–"}</div><div class="match-item-vs-team-name">${m.b}</div></div><div class="match-item-vs-team-score">${m.sb ?? "–"}</div><div class="match-item-event text-of"><div class="match-item-event-series">Round of 8</div> Middle East #1</div></a>`).join("");

test("a round of reads: the list, then every match being played, which the site then shows live with its details", async () => {
  const db = getDb();
  setQualifierTeams(db, "meq1", Array.from({ length: 8 }, (_, i) => `Team ${i}`).join("\n"));
  const ms = allMatches(getState(db)).filter((x) => x.event === "meq1" && x.a && x.b && x.a.name && x.b.name).slice(0, 2);
  assert.equal(ms.length, 2);
  const vlr = ms.map((m, i) => ({ id: 1000 + i, a: m.a.name, b: m.b.name, live: true, sa: 1, sb: 0 }));
  const asked = [];
  const fetcher = async (url) => {
    asked.push(String(url).replace("https://www.vlr.gg", ""));
    const m = vlr.find((x) => String(url).includes(`/${x.id}/`));
    const body = m ? page(m.a, m.b) : list(vlr);
    return { ok: true, status: 200, text: async () => body };
  };
  const now = Date.now();
  // the Türkiye brackets (followed on vlr.gg) were read a moment ago
  for (const id of ["3177"]) saveItem("vlr_event", `vlr:${id}`, { at: new Date(now).toISOString(), matches: [] }, db);
  const read = await vlrMatchesIfDue(now, { gap: 0, fetcher });
  assert.equal(read, 3);
  assert.deepEqual(asked, ["/event/matches/3167/?series_id=all", "/1000/x-vs-y", "/1001/x-vs-y"]);
  // no time on the site: vlr.gg says they are being played, so they are shown live, with vlr.gg's maps
  const live = getMatchLive(db).meq1;
  for (const m of ms) assert.ok(live[m.id], m.id);
  const st = getState(db);
  const s = st.live.meq1[ms[0].id];
  assert.deepEqual([s.a, s.b, s.now], [1, 0, "Lotus"]);
  assert.deepEqual(s.maps.map((m) => Object.keys(m).sort().join()), ["a,b,done,map", "a,b,done,map"]); // the state stays light
  const d = liveDetail(db, "meq1", ms[0].id);
  assert.equal(d.now, "Lotus");
  assert.deepEqual(d.maps[1].rnd, ["ate", "bcd", "atb"]);
  assert.equal(d.players.map.length, 2);
  // a minute later: the pages again, not the list (every 3 minutes)
  asked.length = 0;
  assert.equal(await vlrMatchesIfDue(now + 60000, { gap: 0, fetcher }), 2);
  assert.deepEqual(asked, ["/1000/x-vs-y", "/1001/x-vs-y"]);
  // an editor took one off: vlr.gg does not put it back
  const { setMatchLive } = await import("../lib/db.js");
  setMatchLive(db, { event: "meq1", id: ms[1].id, live: false });
  db.prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(`nolive:meq1:${ms[1].id}`, "x");
  await vlrMatchesIfDue(now + 120000, { gap: 0, fetcher });
  assert.equal(getMatchLive(db).meq1[ms[1].id], undefined);
  assert.ok(readItems("vlr_live", db)[`meq1:${ms[0].id}`].players);
  saveItem("vlr_live", "meq1:none", { at: "2020-01-01T00:00:00Z" }, db);
  assert.equal(liveDetail(db, "meq1", "none"), null);
});
