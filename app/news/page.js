import { cookies } from "next/headers";
import { NewsList } from "../../components/CommunityPages";
import { listNews } from "../../lib/community.js";
import { getDb } from "../../lib/db.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";

export const dynamic = "force-dynamic";

export const metadata = { title: "Actualités · VCT EMEA", description: "Les actualités du VCT EMEA." };

export default async function Page() {
  return <NewsList news={listNews(getDb())} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
