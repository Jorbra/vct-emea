// A qualifier built from vlr.gg's list (no Toornament): places, byes over several rounds, results; and the default logo.
import test from "node:test";
import assert from "node:assert/strict";
import { openDb, getState, anyLogo } from "../lib/db.js";
import { buildBracket } from "../lib/bracket.js";
import { bracketFromVlr } from "../lib/vlrmatch.js";
import { vlrRows } from "../lib/vlrbracket.js";
import { allMatches } from "../lib/matchlist.js";

const M = (round, a, b, sa = null, sb = null) => ({ round, stage: "Qualifier #1", a, b, sa, sb, done: sa != null, live: false });

// 8 places: A-B and C-D played, E alone (bye), F goes straight to the semifinal (no match before)
const LIST = [
  M("qf", "A", "B", 2, 0), M("qf", "C", "D", 1, 2), M("qf", "E", "TBD"),
  M("sf", "A", "D"), M("sf", "F", "TBD"),
  M("gf", "TBD", "TBD"),
];
LIST[2] = M("qf", "E", "G", 2, 1);
const list = [M("r8", "A", "B", 2, 0), M("r8", "C", "D", 1, 2), M("r8", "E", "G", 2, 1), M("qf", "A", "D"), M("qf", "F", "TBD"), M("sf", "TBD", "TBD"), M("sf", "TBD", "TBD"), { ...M("", "TBD", "TBD"), stage: "Seed Decider Qualifier #1" }];

test("vlr.gg rows: places from the rounds, a team with no earlier match goes on alone", () => {
  // 16 places: round of 8 is not a round name; use a 16-team list instead
  const l16 = [
    M("r16", "A", "B", 2, 0), M("r16", "C", "D", 1, 2), M("r16", "E", "G", 2, 1),
    M("qf", "A", "D"), M("qf", "F", "TBD"), M("qf", "E", "TBD"),
    M("sf", "TBD", "TBD"), M("sf", "TBD", "TBD"), { ...M("", "TBD", "TBD"), stage: "Seed Decider Qualifier #1" },
  ];
  const rows = vlrRows(l16);
  assert.equal(rows.filter((r) => r.round === 1).length, 8);
  // A-D meet in a quarterfinal: A's and D's first matches sit side by side
  const r1 = rows.filter((r) => r.round === 1);
  const ab = r1.findIndex((r) => r.a.name === "A");
  const cd = r1.findIndex((r) => r.b.name === "D");
  assert.equal(Math.floor(ab / 2), Math.floor(cd / 2));
  // F had no first match: alone in its first-round place, and the place beside it is empty
  const f = r1.findIndex((r) => r.a.name === "F" && !r.b.name);
  assert.ok(f >= 0);
  assert.ok(!r1[f ^ 1].a.name && !r1[f ^ 1].b.name);
  assert.ok(LIST.length && list.length);
});

test("a team whose whole other side is empty goes on alone over several rounds", () => {
  const slots = Array(8).fill(null);
  slots[0] = { name: "Solo" };
  slots[4] = { name: "X" }; slots[5] = { name: "Y" }; slots[6] = { name: "Z" }; slots[7] = { name: "W" };
  const b = buildBracket(slots, {}, {});
  // Solo: alone in the first round and in the quarterfinal-like round (nobody on the other side)
  const sf1 = b.byId["sf-1"];
  assert.equal(sf1.winner, 1);
  assert.ok(sf1.bye);
  // the other half is played normally
  assert.equal(b.byId["sf-2"].winner, null);
});

test("the bracket from vlr.gg on the site: teams, results in Bo3, nothing more on the next read", async () => {
  const db = openDb(":memory:");
  const l = [
    M("r16", "A", "B", 2, 0), M("r16", "C", "D", 1, 2), M("r16", "E", "G", 2, 1), M("r16", "H", "I", 0, 2),
    M("r16", "J", "K", 2, 1), M("r16", "L", "N", 2, 0), M("r16", "O", "P", 1, 2), M("r16", "Q", "R", 2, 0),
    M("qf", "A", "D"), M("qf", "E", "I"), M("qf", "J", "L"), M("qf", "P", "Q"),
  ];
  assert.ok(await bracketFromVlr(db, "trq1", l) > 0);
  const q = getState(db).qualifiers.trq1;
  assert.equal(q.slots.length, 16);
  assert.equal(q.slots.filter(Boolean).length, 16);
  const ms = allMatches(getState(db)).filter((m) => m.event === "trq1");
  assert.equal(ms.filter((m) => m.id.startsWith("r16") && m.sa != null).length, 8);
  assert.equal(ms.find((m) => m.id.startsWith("r16") && m.a.name === "A").bo, 3);
  assert.equal(ms.filter((m) => m.id.startsWith("qf") && m.a && m.b && m.a.name && m.b.name).length, 4);
  assert.equal(await bracketFromVlr(db, "trq1", l), 0);
});

test("logos: a team's Toornament logo follows it everywhere", () => {
  const db = openDb(":memory:");
  db.prepare("INSERT INTO lp_items (kind, key, json, at) VALUES ('tsync_logos', 'q1', ?, '')").run(JSON.stringify({ "Some Team": "1234567" }));
  globalThis.__tlogos = { at: 0, map: {} };
  assert.equal(anyLogo(db, "Some Team", ""), "https://play.toornament.com/media/file/1234567/logo_medium");
  assert.equal(anyLogo(db, "Nobody Known", ""), "");
});
