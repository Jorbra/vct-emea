import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { NewsArticle } from "../../../components/CommunityPages";
import { getNews } from "../../../lib/community.js";
import { getDb } from "../../../lib/db.js";
import { LANG_COOKIE, normLang } from "../../../lib/i18n.js";
import { sharedPreview } from "../../../lib/preview.js";

export const dynamic = "force-dynamic";

export default async function Page({ params }) {
  const { id } = await params;
  const item = getNews(getDb(), id);
  if (!item) notFound();
  return <NewsArticle item={item} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const item = getNews(getDb(), id);
  if (!item) return { title: "VCT EMEA" };
  return sharedPreview({ title: `${item.title} · VCT EMEA`, description: item.body.slice(0, 160), image: "/brand/emea-kickoff.png" });
}
