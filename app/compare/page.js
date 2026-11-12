import { cookies } from "next/headers";
import { ComparePage } from "../../components/ExtraPages";
import { baseTitle } from "../../lib/directory.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";
import { lpData } from "../../lib/lpdata.js";
import { teamSlug } from "../../lib/paths.js";
import { readSoon } from "../../lib/readsoon.js";
import { requestDue, requestFetch } from "../../lib/teamfetch.js";
import { requestVlr, vlrDue } from "../../lib/vlrfetch.js";
import { vlrId } from "../../lib/vlrinfo.js";
import { getDb, getState } from "../../lib/db.js";
import { playerTournament, readDetails, tournamentStats } from "../../lib/tstats.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Comparer des joueurs · VCT EMEA", description: "Deux joueurs côte à côte : statistiques, rôle, titres et gains." };

/** What the comparison shows of someone; null when no such person is known. Asks for what is missing. */
function person(query, { playerInfo, vlrInfo, dir }) {
  const key = teamSlug(query);
  const known = dir.people[key];
  const lp = playerInfo[key];
  if (!key || (!known && !lp)) return null;
  const name = known ? known.name : lp.page ? baseTitle(lp.page) : lp.name;
  const vlr = vlrInfo.players && vlrInfo.players[key];
  if (requestDue(lp)) requestFetch({ kind: "person", name, cc: (known && known.cc) || "", team: (known && known.team) || "" });
  const id = lp && lp.page ? vlrId(lp.links, "player") : "";
  if (id && vlrDue(vlr)) requestVlr({ kind: "player", key, id });
  const page = lp && lp.page ? lp : null;
  return {
    name, href: `/player/${key}`, team: (page && page.team) || (known && known.team) || "", roles: (page && page.roles) || (known && known.role) || "",
    winnings: (page && page.winnings) || "", totals: (vlr && vlr.totals) || null,
    titles: page ? (page.results || []).filter((r) => /^1st/.test(r.place || "")).length : 0,
    waiting: !lp || (!vlr && !!id),
  };
}

/** Two players side by side (/compare?a=boaster&b=derke). */
export default async function Page({ searchParams }) {
  const sp = await searchParams;
  const qa = String(sp.a || "").slice(0, 40);
  const qb = String(sp.b || "").slice(0, 40);
  const data = lpData();
  const a = qa ? person(qa, data) : null;
  const b = qb ? person(qb, data) : null;
  if (a || b) {
    const db = getDb();
    const stats = tournamentStats(getState(db), readDetails(db));
    for (const p of [a, b]) if (p) { const t = playerTournament(stats, teamSlug(p.name)); p.season = t ? { agent: (t.agents && t.agents[0] && t.agents[0].name) || "", maps: t.maps, r: t.r, acs: t.acs, kd: t.kd, kast: t.kast, adr: t.adr, hs: t.hs, fk: t.fk, fd: t.fd } : null; }
  }
  readSoon();
  return <ComparePage a={a} b={b} qa={qa} qb={qb} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
