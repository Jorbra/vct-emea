// Team logos from vlr.gg's match pages, for the teams Liquipedia and Toornament have none for (lib/vlrmatch.js, lib/db.js).
import test from "node:test";
import assert from "node:assert/strict";
import { openDb, vlrLogo } from "../lib/db.js";
import { parseLogos, saveVlrLogos } from "../lib/vlrmatch.js";

const page = `<a class="match-header-link wf-link-hover mod-1" href="/team/11232/joblife"><div><img src="//owcdn.net/img/63a944e6cbe49.png" alt="Joblife team logo"></div></a>
<a class="match-header-link wf-link-hover mod-2" href="/team/1/x"><div><img src="/img/vlr/tmp/vlr.png" alt="Nobody team logo"></div></a>
<a class="match-header-link wf-link-hover mod-2" href="/team/19391/wip-esports"><div><img src="//owcdn.net/img/695c9c861fe80.png" alt="WIP Esports team logo"></div></a>`;

test("vlr.gg logos: the two teams' logos at the top of a match page, its placeholder left out", () => {
  assert.deepEqual(parseLogos(page), [
    { name: "Joblife", url: "https://owcdn.net/img/63a944e6cbe49.png" },
    { name: "WIP Esports", url: "https://owcdn.net/img/695c9c861fe80.png" },
  ]);
});

test("vlr.gg logos: saved by team name and found again whatever the capitals and spaces", () => {
  const db = openDb(":memory:");
  globalThis.__vlogos = undefined;
  saveVlrLogos(db, parseLogos(page));
  globalThis.__vlogos = undefined;
  assert.equal(vlrLogo(db, "WIP esports"), "https://owcdn.net/img/695c9c861fe80.png");
  assert.equal(vlrLogo(db, "Somebody"), "");
});
