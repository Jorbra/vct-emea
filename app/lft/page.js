import { cookies } from "next/headers";
import { LftPage } from "../../components/LftPage";
import { getDb, getState } from "../../lib/db.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";
import { readFreeAgents } from "../../lib/lft.js";
import { lpData } from "../../lib/lpdata.js";
import { readItems } from "../../lib/lpstore.js";
import { teamSlug } from "../../lib/paths.js";
import { workSoon } from "../../lib/readsoon.js";
import { siteTeams } from "../../lib/teams.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Joueurs LFT · VCT EMEA", description: "Les joueurs et membres du staff de la région EMEA libérés par leur équipe et sans nouvelle équipe annoncée." };

const EMEA_REGION = /europe|emea|turkey|türkiye|middle east|mena|cis|africa/i;

export default async function Page() {
  workSoon();
  const { teamInfo, playerInfo, dir } = lpData();
  const ours = new Set(siteTeams(getState(getDb())).map((t) => teamSlug(t.name)));
  // a move with no flag counts when the team it left is of the region
  const isEmea = (team) => {
    const k = teamSlug(team);
    return ours.has(k) || EMEA_REGION.test((teamInfo[k] && teamInfo[k].region) || "");
  };
  const { list, at, pages } = readFreeAgents(readItems("lft"), isEmea);
  const rows = list.map((p) => {
    const k = teamSlug(p.from);
    const known = playerInfo[teamSlug(p.name)];
    return { ...p, cc: p.cc || (known && known.cc) || "", fromHref: dir.teams[k] || teamInfo[k] ? `/team/${k}` : "" };
  });
  return <LftPage list={rows} at={at} pages={pages || 0} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
