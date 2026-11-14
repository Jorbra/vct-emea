import { NextResponse } from "next/server";
import { getDb, getState } from "../../../lib/db.js";
import { announceIfDue } from "../../../lib/notify.js";
import { syncIfDue } from "../../../lib/toornament.js";
import { vlrMatchesIfDue } from "../../../lib/vlrmatch.js";
import { lftIfDue } from "../../../lib/lft.js";
import { noteWorked } from "../../../lib/health.js";
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
  await syncIfDue();
  await announceIfDue();
  await vlrMatchesIfDue();
  await lftIfDue();
  await publishDueNews();
  await Promise.all([
    lpTick(() => siteTeamNames(getDb()), people, failed),
    vlrTick((seen) => nextVlr(people().map((p) => p.name), siteTeamNames(getDb()), readPlayerInfo(), readTeamInfo(), readVlrInfo(), seen), failed.vlr),
  ]);
  noteWorked("tick");
  return NextResponse.json({ ok: true });
}

/** The news written for later whose time came: published, and posted on Discord like the others. */
async function publishDueNews() {
  try {
    const db = getDb();
    const { takeDueNews } = await import("../../../lib/editor17.js");
    const due = takeDueNews(db);
    if (!due.length) return;
    const { listNews, saveNews } = await import("../../../lib/community.js");
    const { botNews } = await import("../../../lib/botnotify.js");
    for (const n of due) {
      const r = saveNews(db, { title: n.title, body: n.body, who: n.who || "" });
      if (r.ok) await botNews(db, listNews(db, 1)[0]).catch((e) => console.log(`[bot] news: ${e.message}`));
    }
  } catch (e) { console.log(`[tick] scheduled news: ${e.message}`); }
}
