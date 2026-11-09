// The daily games: same puzzles for a day, clues, one game a day, the streak, the share text.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { openDb } from "../lib/db.js";
import { dailyPuzzles, dailyRanking, dayOf, logoPool, myGames, playMove, playerClues, readGame } from "../lib/games.js";
import { shareText } from "../lib/gameshare.js";

const T = "g".repeat(40);
const players = Array.from({ length: 12 }, (_, i) => ({
  slug: `p${String(i).padStart(2, "0")}`, name: `P${i}`, team: `Team ${i % 4}`, cc: i % 2 ? "fr" : "de", maps: 4 + i,
  r: 0.8 + i * 0.05, acs: 150 + i * 10, kd: 0.8 + i * 0.04, adr: 120 + i * 5, kast: 60 + i, agents: [{ name: i % 3 ? "jett" : "omen", n: 3 }],
}));
const logos = ["Alpha", "Beta", "Gamma", "Delta", "Echo"].map((name) => ({ name, logo: `/logos/${name}.png` }));
const ctx = { players, teams: logos.map((t) => t.name) };
const DAY = Date.parse("2026-11-10T12:00:00Z");

test("same puzzles for everyone on a day, others the next day", () => {
  const a = dailyPuzzles({ players, logos }, "2026-11-10");
  assert.deepEqual(dailyPuzzles({ players, logos }, "2026-11-10"), a);
  assert.ok(a.joueur && a.duel && a.logo);
  assert.ok(a.duel.rounds.length >= 5 && a.duel.rounds.every((r) => r.a.value !== r.b.value));
  const days = new Set(["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"].map((d) => dailyPuzzles({ players, logos }, d).joueur.answer.slug));
  assert.ok(days.size > 1);
  assert.deepEqual(dailyPuzzles({ players: [], logos: [] }, "2026-11-10"), {});
  assert.equal(dayOf(Date.parse("2026-11-09T23:30:00Z")), "2026-11-10");
});

test("clues: same, close with the way to go, different", () => {
  const c = playerClues(players[3], players[4]).clues;
  assert.equal(c.team, "no");
  assert.equal(c.acs, "nearup");
  assert.equal(playerClues(players[4], players[4]).clues.r, "ok");
  assert.equal(playerClues(players[11], players[0]).clues.acs, "down");
  assert.equal(playerClues(players[0], players[4]).clues.team, "ok");
});

test("mystery player: wrong names refused, won in a few, one game a day, streak and ranking", () => {
  const db = openDb(":memory:");
  const puzzles = dailyPuzzles({ players, logos }, dayOf(DAY));
  const ans = puzzles.joueur.answer;
  assert.equal(playMove(db, puzzles, ctx, { token: T, game: "joueur", move: "Nobody" }, DAY).ok, false);
  const other = players.find((p) => p.slug !== ans.slug);
  let r = playMove(db, puzzles, ctx, { token: T, game: "joueur", move: other.name }, DAY);
  assert.equal(r.ok, true);
  assert.equal(r.done, false);
  assert.equal(r.reveal, undefined); // the answer stays hidden while playing
  assert.equal(playMove(db, puzzles, ctx, { token: T, game: "joueur", move: other.name }, DAY).ok, false); // already tried
  r = playMove(db, puzzles, ctx, { token: T, game: "joueur", move: ans.name }, DAY);
  assert.equal(r.won, true);
  assert.equal(r.reveal.name, ans.name);
  assert.equal(playMove(db, puzzles, ctx, { token: T, game: "joueur", move: ans.name }, DAY).ok, false);
  assert.equal(readGame(db, puzzles, { token: T, game: "joueur" }, DAY).guesses.length, 2);
  db.prepare("INSERT INTO voters (hash, name, created) VALUES (?, 'Gamer', ?)").run(crypto.createHash("sha256").update(T).digest("hex"), new Date(DAY).toISOString());
  assert.deepEqual(dailyRanking(db, "joueur", dayOf(DAY)), [{ name: "Gamer", score: 5 }]);
  assert.equal(myGames(db, T, DAY).streak, 1);
  assert.equal(myGames(db, T, DAY + 86400000).streak, 1); // tomorrow, not played yet: the streak holds
  assert.equal(myGames(db, T, DAY + 2 * 86400000).streak, 0);
  assert.match(shareText("joueur", r, dayOf(DAY), "https://x.test"), /2\/6\n.+\n.+\nhttps:\/\/x\.test\/jeux/);
  assert.ok(!shareText("joueur", r, dayOf(DAY), "").includes(ans.name));
});

test("higher or lower: stops at the first mistake, values shown once answered", () => {
  const db = openDb(":memory:");
  const puzzles = dailyPuzzles({ players, logos }, dayOf(DAY));
  let g = readGame(db, puzzles, { token: T, game: "duel" }, DAY);
  assert.equal(g.rounds[0].a.value, undefined);
  const right = (r) => (r.a.value > r.b.value ? "a" : "b");
  let r = playMove(db, puzzles, ctx, { token: T, game: "duel", move: right(puzzles.duel.rounds[0]) }, DAY);
  assert.equal(r.answers[0].ok, true);
  assert.notEqual(r.rounds[0].a.value, undefined);
  r = playMove(db, puzzles, ctx, { token: T, game: "duel", move: right(puzzles.duel.rounds[1]) === "a" ? "b" : "a" }, DAY);
  assert.equal(r.done, true);
  assert.equal(r.won, false);
  assert.equal(playMove(db, puzzles, ctx, { token: T, game: "duel", move: "a" }, DAY).ok, false);
  g = readGame(db, puzzles, { token: T, game: "duel" }, DAY);
  assert.equal(g.answers.filter((x) => x.ok).length, 1);
});

test("mystery logo: clearer after each guess, lost after 5", () => {
  const db = openDb(":memory:");
  const puzzles = dailyPuzzles({ players, logos }, dayOf(DAY));
  const wrong = logos.filter((t) => t.name !== puzzles.logo.answer.name);
  let r = readGame(db, puzzles, { token: T, game: "logo" }, DAY);
  const first = r.blur;
  for (const t of wrong) r = playMove(db, puzzles, ctx, { token: T, game: "logo", move: t.name }, DAY);
  assert.ok(first > 0);
  assert.equal(r.guesses.length, 4);
  assert.ok(r.blur < first && r.blur > 0);
  r = playMove(db, puzzles, ctx, { token: T, game: "logo", move: puzzles.logo.answer.name }, DAY);
  assert.equal(r.won, true);
  assert.equal(r.blur, 0);
  assert.equal(logoPool([{ name: "A", logo: "" }, { name: "B", logo: "/b.png" }]).length, 1);
});
