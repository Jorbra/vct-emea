import { cookies } from "next/headers";
import { FantasyPage } from "../../components/Round7Pages";
import { getDb } from "../../lib/db.js";
import { fantasyData } from "../../lib/gamedata.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";
import { BUDGET, fantasyRanking } from "../../lib/round7.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fantasy · VCT EMEA", description: "Compose ton équipe de 5 joueurs avec 100 crédits : ils marquent des points selon leurs vrais matchs." };

export default async function Page() {
  const db = getDb();
  const { pool, points } = await fantasyData();
  return <FantasyPage pool={pool} budget={BUDGET} season={fantasyRanking(db, points, { by: "season", limit: 20 })} week={fantasyRanking(db, points, { by: "week", limit: 20 })} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
