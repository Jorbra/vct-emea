// What keeps the site's information fresh, run by GitHub Actions a few times an hour: for a few minutes, one Liquipedia page and one vlr.gg
// page every 30 seconds (what a visitor asked for first), and the Discord announcements. Run by hand: npm run worker
import { loadTursoEnv } from "./env-turso.mjs";

loadTursoEnv();
const { getDb, getState } = await import("../lib/db.js");
const { sitePlayers } = await import("../lib/playerstats.js");
const { PARSE_GAP, lpTick, readPlayerInfo, readTeamInfo, siteTeamNames } = await import("../lib/teamfetch.js");
const { nextVlr, readVlrInfo, vlrTick } = await import("../lib/vlrfetch.js");
const { announceNow } = await import("../lib/notify.js");

const RUN_FOR = Number(process.env.WORKER_SECONDS || 270) * 1000;
const started = Date.now();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const people = () => sitePlayers(getState(getDb()), readTeamInfo());
const failed = { teams: {}, people: {}, vlr: {} };

await announceNow();
while (Date.now() - started < RUN_FOR) {
  const round = Date.now();
  await Promise.all([
    lpTick(() => siteTeamNames(getDb()), people, failed),
    vlrTick((seen) => nextVlr(people().map((p) => p.name), siteTeamNames(getDb()), readPlayerInfo(), readTeamInfo(), readVlrInfo(), seen), failed.vlr),
  ]);
  await announceNow();
  await wait(Math.max(0, PARSE_GAP - (Date.now() - round)));
}
console.log("Done for this round.");
process.exit(0);
