import { NextResponse } from "next/server";
import { getDb, getState } from "../../../lib/db.js";
import { allMatches } from "../../../lib/matchlist.js";
import { teamSlug } from "../../../lib/paths.js";
import { tension } from "../../../lib/livemore.js";

export const dynamic = "force-dynamic";
// a big match: the events after the open qualifiers, or a qualifier's last rounds
const BIG_EVENTS = ["playoffs", "tr", "mena", "kickoff", "gc"];

// GET: the matches being played, with their score, for the banner of the visitor's teams.
export async function GET() {
  const state = getState(getDb());
  const list = allMatches(state).filter((m) => m.live && m.a && m.b && m.a.name && m.b.name).slice(0, 30).map((m) => {
    const s = (state.live[m.event] || {})[m.id] || {};
    const maps = (s.maps || []).filter((x) => x.a != null);
    const t = tension(s, m.bo);
    return { event: m.event, id: m.id, a: m.a.name, b: m.b.name, slugs: [teamSlug(m.a.name), teamSlug(m.b.name)], sa: s.a ?? 0, sb: s.b ?? 0, map: maps.length ? maps[maps.length - 1] : null, ot: t.ot, decider: t.decider, big: BIG_EVENTS.includes(m.event) || /^(sf|gf|third)/.test(m.id) };
  });
  return NextResponse.json({ live: list }, { headers: { "Cache-Control": "public, max-age=20, s-maxage=20" } });
}
