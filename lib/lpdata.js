// The saved Liquipedia and vlr.gg information, for the site's pages (server side).
import { buildDirectory } from "./directory.js";
import { itemsStamp, readItems } from "./lpstore.js";
import VALORANT_PLAYERS from "./valorant-players.json";
import VALORANT_TEAMS from "./valorant-teams.json";

/** { teamInfo, playerInfo, tournamentInfo, vlrInfo, searchFound, dir }, read again only when something was saved. */
export function lpData() {
  const now = itemsStamp();
  const memo = globalThis.__lpData;
  if (memo && memo.now === now) return memo.data;
  const meta = readItems("meta");
  const saved = {
    teamInfo: readItems("team"), playerInfo: readItems("player"), tournamentInfo: readItems("tournament"),
    vlrInfo: { players: readItems("vlr_player"), teams: readItems("vlr_team"), blockedUntil: (meta.vlr && meta.vlr.blockedUntil) || "" },
    searchFound: { people: readItems("found_people"), teams: readItems("found_teams"), tournaments: readItems("found_tournaments") },
  };
  const data = { ...saved, dir: buildDirectory({ ...saved, lists: { teams: VALORANT_TEAMS, players: VALORANT_PLAYERS } }) };
  globalThis.__lpData = { now, data };
  return data;
}
