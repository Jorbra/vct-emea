// A qualified team's pseudos typed by an editor stay: the place no longer copies the earlier stage's roster over them.
import test from "node:test";
import assert from "node:assert/strict";
import { getState, openDb } from "../lib/db.js";
import { saveQualifierScore, setQualifierSlot, setQualifierTeams } from "../lib/qactions.js";
import { updateTeam } from "../lib/actions.js";
import { setRegionalTeam } from "../lib/ractions.js";
import { allMatches } from "../lib/matchlist.js";

function playUntil(db, event, stop) {
  for (let k = 0; k < 12; k++) {
    const open = allMatches(getState(db)).filter((m) => m.event === event && m.a && m.b && m.a.name && m.b.name && m.sa == null && !stop.some((s) => m.id.startsWith(`${s}-`)));
    if (!open.length) return;
    for (const m of open) for (const w of [1, 2, 3]) if (saveQualifierScore(db, { event, id: m.id, sa: w, sb: 0 }).ok) break;
  }
}

test("EU Qualifier Playoffs: pseudos typed on a qualified team stay; untouched places still follow the qualifier", () => {
  const db = openDb(":memory:");
  setQualifierTeams(db, "q1", Array.from({ length: 256 }, (_, i) => `Team ${i}`).join("\n"));
  playUntil(db, "q1", ["sf", "gf", "third"]);
  const places = () => getState(db).teams.filter((t) => t.source === "Qualifier 1");
  const [t1, t2] = places();
  assert.ok(t1.name && t2.name);
  assert.equal(updateTeam(db, t1.id, { name: t1.name, tag: t1.tag, status: "qualified", roster: "Nuk|fr, Boo|de" }).ok, true);
  assert.equal(places().find((x) => x.id === t1.id).roster, "Nuk|fr, Boo|de");
  assert.equal(getState(db).teams.find((x) => x.id === t1.id).roster, "Nuk|fr, Boo|de", "still there on the next read");
  // the qualifier's team changes its roster: the edited place keeps the editor's, the other place follows
  const q = getState(db).qualifiers.q1;
  const s2 = q.slots.findIndex((s) => s.name === t2.name) + 1;
  assert.equal(setQualifierSlot(db, { event: "q1", slot: s2, name: t2.name, roster: "New|es" }).ok, true);
  assert.equal(places().find((x) => x.id === t2.id).roster, "New|es");
  assert.equal(places().find((x) => x.id === t1.id).roster, "Nuk|fr, Boo|de");
});

test("Türkiye: pseudos typed on a qualified team of the Qualifier Playoffs stay", () => {
  const db = openDb(":memory:");
  setQualifierTeams(db, "trq1", Array.from({ length: 64 }, (_, i) => `TR ${i}`).join("\n"));
  playUntil(db, "trq1", ["gf", "third"]);
  const place = () => getState(db).regional.tr.teams.find((t) => t.source === "Qualifier 1" && t.pos === 1);
  const p = place();
  assert.ok(p.name);
  const r = setRegionalTeam(db, { event: "tr", slot: p.slot, name: p.name, tag: p.tag, roster: "Ali|tr, Can|tr" });
  assert.equal(r.ok, true, r.error);
  assert.equal(place().roster, "Ali|tr, Can|tr");
  assert.equal(place().auto, true, "the place still follows the qualifier for the team itself");
});
