import { NextResponse } from "next/server";
import { getDb, getState } from "../../../lib/db.js";
import { announceIfDue } from "../../../lib/notify.js";
import { sitePlayers } from "../../../lib/playerstats.js";
import { lpTick, readPlayerInfo, readTeamInfo, siteTeamNames } from "../../../lib/teamfetch.js";
import { nextVlr, readVlrInfo, vlrTick } from "../../../lib/vlrfetch.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET: one small round, for a free scheduler calling this every minute or so: the alerts of matches whose time has come, and one page read from
// each source. Public, and harmless: each thing has its turn in the database, so calling more often does nothing more.
export async function GET() {
  const failed = { teams: {}, people: {}, vlr: {} };
  const people = () => sitePlayers(getState(getDb()), readTeamInfo());
  await announceIfDue();
  await Promise.all([
    lpTick(() => siteTeamNames(getDb()), people, failed),
    vlrTick((seen) => nextVlr(people().map((p) => p.name), siteTeamNames(getDb()), readPlayerInfo(), readTeamInfo(), readVlrInfo(), seen), failed.vlr),
  ]);
  return NextResponse.json({ ok: true });
}
