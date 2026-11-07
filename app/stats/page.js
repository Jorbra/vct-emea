import { cookies } from "next/headers";
import StatsPage from "../../components/StatsPage";
import { getDb, getState } from "../../lib/db.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";
import { workSoon } from "../../lib/readsoon.js";
import { eventsWithDetails, extraStats, readDetails, tournamentStats } from "../../lib/tstats.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stats · VCT EMEA", description: "Classement des joueurs, des équipes et des cartes des tournois du VCT EMEA, d'après vlr.gg." };

export default async function Page({ searchParams }) {
  workSoon();
  const db = getDb();
  const events = eventsWithDetails(db);
  const asked = String((await searchParams).e || "");
  const event = events.includes(asked) ? asked : events[0] || "";
  let stats = null;
  if (event) {
    const s = tournamentStats(getState(db), readDetails(db, event));
    const x = extraStats(getState(db), readDetails(db, event));
    // the page gets the tables it shows, not the per-match lists
    // only what the tables show: the page stays light with hundreds of players
    const players = s.players.map(({ fk, fd, ...p }) => ({ ...p, fk, fd, agents: p.agents.slice(0, 3) }));
    const teams = Object.fromEntries(Object.entries(s.teams).map(([k, t]) => [k, { name: t.name, maps: t.maps, mapsWon: t.mapsWon, roundsW: t.roundsW, roundsL: t.roundsL, byMap: t.byMap, best: t.best.slice(0, 1).map((p) => ({ name: p.name })) }]));
    stats = { players, teams, maps: s.maps, agents: x.agents, records: x.records };
  }
  return <StatsPage stats={stats} event={event} events={events} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
