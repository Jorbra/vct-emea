// What the daily games are made of, read from the site's data: kept for the state it was made from (the editors' changes make a new one).
import { getDb, getState } from "./db.js";
import { dailyPuzzles, logoPool, mainTeamNames, playerPool } from "./games.js";
import { siteTeams } from "./teams.js";
import { readDetails, tournamentStats } from "./tstats.js";

let memo = { state: null, day: "", out: null };

/** { puzzles, players, teams (names), names (players' names) } for today. */
export function gameData(day) {
  const db = getDb();
  const state = getState(db);
  if (memo.state === state && memo.day === day) return memo.out;
  const players = playerPool(tournamentStats(state, readDetails(db, "")));
  const teams = siteTeams(state);
  const logos = logoPool(teams, mainTeamNames(state));
  const out = { puzzles: dailyPuzzles({ players, logos }, day), players, teams: teams.map((t) => t.name).sort((a, b) => a.localeCompare(b)) };
  memo = { state, day, out };
  return out;
}

let fmemo = { state: null, out: null };

/** The fantasy's players and every match's points, kept for the state they come from. */
export async function fantasyData() {
  const { fantasyPool, playerPoints } = await import("./round7.js");
  const db = getDb();
  const state = getState(db);
  if (fmemo.state === state) return fmemo.out;
  const stats = tournamentStats(state, readDetails(db, ""));
  const out = { state, pool: fantasyPool(playerPool(stats)), points: playerPoints(state, readDetails(db, "")), players: stats.players };
  fmemo = { state, out };
  return out;
}
