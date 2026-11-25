import { cookies } from "next/headers";
import { LeaguePage } from "../../../components/League";
import { getDb, getState } from "../../../lib/db.js";
import { groupInfo, seasonRanking } from "../../../lib/fans.js";
import { LANG_COOKIE, normLang } from "../../../lib/i18n.js";
import { stylesByName } from "../../../lib/round9.js";
import { fantasyData } from "../../../lib/gamedata.js";
import { fantasyRanking } from "../../../lib/round7.js";

export const dynamic = "force-dynamic";

/** A private league of predictions (/ligue/<code>): its ranking, and a button to join it, for the friends who get the link. */
export default async function Page({ params }) {
  const { code } = await params;
  const db = getDb();
  const g = groupInfo(db, String(code || "").toLowerCase());
  const lang = normLang((await cookies()).get(LANG_COOKIE)?.value);
  if (!g) return <LeaguePage league={null} lang={lang} />;
  const styles = stylesByName(db);
  const ranking = seasonRanking(db, getState(db), { only: g.hashes, limit: 200 }).map((r) => ({ ...r, style: styles[r.name] || null }));
  // the members' fantasy teams, ranked among themselves
  const { points } = await fantasyData();
  const fantasy = fantasyRanking(db, points, { only: g.hashes, limit: 200 });
  return <LeaguePage league={{ code: g.code, name: g.name, count: g.hashes.length, ranking, fantasy }} lang={lang} />;
}

export async function generateMetadata({ params }) {
  const { code } = await params;
  const g = groupInfo(getDb(), String(code || "").toLowerCase());
  const title = g ? `${g.name} · Ligue privée · VCT EMEA` : "Ligue privée · VCT EMEA";
  return { title, description: g ? `Rejoins la ligue « ${g.name} » et pronostique les matchs du VCT EMEA avec tes amis.` : "Une ligue de pronostics entre amis.", robots: { index: false } };
}
