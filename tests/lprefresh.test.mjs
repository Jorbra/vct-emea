// The editor's "update everything from Liquipedia" button.
import test from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../lib/db.js";
import { updateTeam } from "../lib/actions.js";
import { queueRefresh, refreshList } from "../lib/lprefresh.js";

test("update everything: the main events' teams first, then their players, each asked once", () => {
  const db = openDb(":memory:");
  updateTeam(db, "t01", { name: "GIANTX", tag: "GX", status: "invited", roster: "Cloud|ru, Flickless|fi, ara|sub", staff: "" });
  updateTeam(db, "t02", { name: "MIR", tag: "", status: "invited", roster: "", staff: "" });
  const list = refreshList(db);
  assert.ok(list.some((t) => t.name === "GIANTX" && t.players.length === 3));
  db.prepare("DELETE FROM lp_requests").run();
  const r = queueRefresh(db);
  assert.ok(r.teams >= 2);
  assert.ok(r.players >= 3);
  const first = db.prepare("SELECT id FROM lp_requests ORDER BY first DESC, at ASC LIMIT 1").get().id;
  assert.match(first, /^lp:team:/);
  const again = queueRefresh(db);
  assert.equal(again.waiting, r.waiting);
});
