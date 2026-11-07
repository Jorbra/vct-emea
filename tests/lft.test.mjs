// Free agents from Liquipedia's transfer pages: no network.
import test from "node:test";
import assert from "node:assert/strict";
import { freeAgents, parseTransfers, readFreeAgents, wantedTitles } from "../lib/lft.js";

const page = `<!-- {{Transfer Row|date=2026-11-|name=|team1=}} -->
{{Transfer Row|date=2026-11-07|name=MerSa|name2=oroni|team1=Beşiktaş Esports|ref={{TRef|url=https://x.com/a/1|title=Bye}}}}
{{Transfer Row|date=2026-11-07|name=BadreX|flag=tr|team2=Eternal Fire|ref={{TRef|url=https://x.com/b|title=Hi}}}}
{{Transfer Row|date=2026-11-05|name=crashies|flag=us|team1=Fnatic|ref={{TRef|url=https://x.com/c}}}}
{{Transfer Row|date=2026-11-04|name=Alfajer|flag=tr|team1=Fnatic}}
{{Transfer Row|date=2026-11-06|name=Alfajer|flag=tr|team2=[[Team Heretics|TH]]}}
{{Transfer Row|date=2026-11-03|name=Desmo|flag=fr|team1=Fnatic|role1=Assistant Coach}}
{{Transfer Row|date=2026-11-03|name=nekky|flag=fi|team1=Eternal Fire|team2=Eternal Fire|role2=Inactive}}
{{Transfer Row|date=2026-11-02|name=Benched|flag=de|team1=Fnatic|role1=Inactive}}
{{Transfer Row|date=2026-11-01|name=Saud|flag=sa|team1=Stallions}}`;

test("the transfer rows are read, comments and nested templates kept apart", () => {
  const moves = parseTransfers(page);
  assert.equal(moves.length, 9);
  assert.deepEqual(moves[0], { date: "2026-11-07", people: [{ name: "MerSa", cc: "" }, { name: "oroni", cc: "" }], from: "Beşiktaş Esports", fromRole: "", to: "", toRole: "", url: "https://x.com/a/1" });
  assert.equal(moves[4].to, "TH");
});

test("free: the last move is a departure to no team, in the region; benched is not free", () => {
  const free = freeAgents(parseTransfers(page), (team) => team === "Beşiktaş Esports");
  assert.deepEqual(free.map((p) => [p.name, p.staff]), [["MerSa", false], ["oroni", false], ["Desmo", true], ["Benched", false], ["Saud", false]]);
  assert.equal(free.find((p) => p.name === "MerSa").url, "https://x.com/a/1");
  // crashies (us) is not of the region; Alfajer has joined a team since; nekky was only benched
});

test("the months read: the last six, with their second pages", () => {
  const all = ["Player Transfers/2026/November", "Player Transfers/2026/November/2", "Player Transfers/2026/May", "Player Transfers/2026/April", "Player Transfers/2025/November"];
  assert.deepEqual(wantedTitles(all, new Date("2026-11-07T00:00:00Z")), ["Player Transfers/2026/November", "Player Transfers/2026/November/2"]); // June to November: May is too old
  assert.deepEqual(readFreeAgents({}, () => true).list, []);
  const r = readFreeAgents({ index: { titles: ["Player Transfers/2026/November"] }, "Player Transfers/2026/November": { at: "2026-11-07T10:00:00Z", moves: parseTransfers(page) } }, () => true, new Date("2026-11-07T12:00:00Z"));
  assert.equal(r.pages, 1);
  assert.ok(r.list.some((p) => p.name === "MerSa"));
});
