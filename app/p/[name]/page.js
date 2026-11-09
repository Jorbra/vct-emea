import { notFound } from "next/navigation";
import { getDb, getState } from "../../../lib/db.js";
import { cookies } from "next/headers";
import { voterCard } from "../../../lib/fans.js";
import { AchievementsBlock } from "../../../components/Round7Pages";
import { achievements } from "../../../lib/round7.js";
import { fantasyData } from "../../../lib/gamedata.js";
import { LANG_COOKIE, normLang } from "../../../lib/i18n.js";

export const dynamic = "force-dynamic";

/** A shared prediction card: its picture for Discord and X, and visitors go on to the predictions. */
export async function generateMetadata({ params }) {
  const name = decodeURIComponent((await params).name || "").slice(0, 20);
  const db = getDb();
  const c = voterCard(db, getState(db), name);
  if (!c) return {};
  const text = c.rank ? `${c.name} : #${c.rank} des pronostics VCT EMEA, ${c.points} points` : `${c.name} joue aux pronostics VCT EMEA`;
  const image = `/api/card/${encodeURIComponent(c.name)}`;
  return { title: `${c.name} · Pronostics · VCT EMEA`, description: text, openGraph: { title: text, images: [{ url: image, width: 1200, height: 630 }] }, twitter: { card: "summary_large_image", title: text, images: [image] } };
}

export default async function Page({ params }) {
  const name = decodeURIComponent((await params).name || "").slice(0, 20);
  const db = getDb();
  const c = voterCard(db, getState(db), name);
  if (!c) notFound();
  return (
    <div className="wrap sharecard">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/card/${encodeURIComponent(c.name)}`} alt={`${c.name} : ${c.points} points`} width={1200} height={630} />
      <AchievementsBlock list={achievements(db, getState(db), (db.prepare("SELECT hash FROM voters WHERE name = ?").get(c.name) || {}).hash || "", (await fantasyData()).points)} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />
      <p className="row"><a className="btn pri" href="/predictions">Jouer aux pronostics ›</a> <a className="btn" href="/jeux">Jeux du jour ›</a> <a className="btn" href="/fantasy">Fantasy ›</a></p>
    </div>
  );
}
