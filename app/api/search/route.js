import { NextResponse } from "next/server";
import { getDb, getState } from "../../../lib/db.js";
import { readTeamInfo } from "../../../lib/teamfetch.js";
import { MIN_QUERY, searchAll, searchIndex } from "../../../lib/search.js";
import VALORANT_PLAYERS from "../../../lib/valorant-players.json";
import VALORANT_TEAMS from "../../../lib/valorant-teams.json";

export const dynamic = "force-dynamic";

// GET ?q=<text>: what the site's search bar shows. Public: only what the site's pages and Liquipedia show anyway.
export async function GET(req) {
  const q = (new URL(req.url).searchParams.get("q") || "").slice(0, 60);
  if (q.trim().length < MIN_QUERY) return NextResponse.json({ events: [], teams: [], players: [], matches: [], maps: [] });
  const items = searchIndex(getState(getDb()), readTeamInfo(), { teams: VALORANT_TEAMS, players: VALORANT_PLAYERS });
  return NextResponse.json(searchAll(items, q));
}
