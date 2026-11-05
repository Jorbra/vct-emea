// The log that fills itself: no network here.
import test from "node:test";
import assert from "node:assert/strict";
import { commitEntries, mergeLog, newCommits, parisDay, parisTime, readCommitLog } from "../lib/changelog.js";

test("a commit gives its Journal lines, or else its first line", () => {
  const at = "2026-11-05T01:00:00Z";
  const msg = "Add things\n\nJournal: Ajout | Site | Une page\nJournal: Correction | Éditeur | Un bouton\nJournal: Bidon | Ailleurs | Un texte\n\nCo-Authored-By: Someone <a@b.c>";
  assert.deepEqual(commitEntries(at, msg), [
    { at, kind: "Ajout", area: "Site", text: "Une page" },
    { at, kind: "Correction", area: "Éditeur", text: "Un bouton" },
    { at, kind: "Modification", area: "Coulisses", text: "Un texte" },
  ]);
  assert.deepEqual(commitEntries(at, "Fix a thing\n\nCo-Authored-By: Someone <a@b.c>"), [{ at, kind: "Modification", area: "Coulisses", text: "Fix a thing" }]);
  assert.deepEqual(commitEntries(at, "Merge branch x"), []);
});

test("only the commits after the written log, keeping no author", () => {
  const c = (sha, date, message) => ({ sha, commit: { committer: { date, email: "x@y.z" }, message, author: { name: "n" } } });
  const out = newCommits([c("ccc", "2026-11-06T10:00:00Z", "new"), c("3859ad2aaa", "2026-11-05T00:50:00Z", "old"), c("aaa", "2026-11-04T00:00:00Z", "older")], "3859ad2");
  assert.deepEqual(out, [{ at: "2026-11-06T10:00:00Z", message: "new" }]);
});

test("days and hours are those of Paris; a same day is merged, newest first", () => {
  assert.equal(parisDay("2026-11-05T23:30:00Z"), "6 novembre 2026");
  assert.equal(parisTime("2026-11-05T23:30:00Z"), "00:30");
  const log = mergeLog([
    { at: "2026-11-05T10:00:00Z", kind: "Ajout", area: "Site", text: "matin" },
    { at: "2026-11-05T16:00:00Z", kind: "Ajout", area: "Site", text: "soir" },
    { at: "2026-11-06T10:00:00Z", kind: "Correction", area: "Site", text: "lendemain" },
  ], [{ date: "5 novembre 2026", items: [["01:00", "Ajout", "Site", "écrit"]] }, { date: "4 novembre 2026", items: [["11:30", "Ajout", "Site", "début"]] }]);
  assert.deepEqual(log.map((d) => d.date), ["6 novembre 2026", "5 novembre 2026", "4 novembre 2026"]);
  assert.deepEqual(log[1].items.map((i) => i[3]), ["soir", "matin", "écrit"]);
});

test("when GitHub does not answer, the last lines kept are shown", async () => {
  const real = globalThis.fetch;
  const store = {};
  const io = { readItems: () => store, saveItem: (_, k, v) => { store[k] = v; } };
  try {
    globalThis.fetch = async () => ({ ok: true, json: async () => [{ sha: "new", commit: { committer: { date: "2026-11-06T10:00:00Z" }, message: "A\n\nJournal: Ajout | Site | Une page" } }, { sha: "cut", commit: { committer: { date: "2026-11-05T10:00:00Z" }, message: "B" } }] });
    assert.equal((await readCommitLog("cut", io)).entries[0].text, "Une page");
    globalThis.fetch = async () => ({ ok: false, status: 403 });
    const r = await readCommitLog("cut", io);
    assert.equal(r.stale, true);
    assert.equal(r.entries[0].text, "Une page");
  } finally {
    globalThis.fetch = real;
  }
});
