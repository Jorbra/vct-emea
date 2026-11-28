import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import BotFull from "../../../components/BotFull.jsx";
import { LANG_COOKIE, normLang } from "../../../lib/i18n.js";
import { currentStaff } from "../../../lib/session.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bot Discord · Éditeur · VCT EMEA", robots: { index: false } };

/** For the editors and the moderators (lib/staffaccess.js) only: the Discord bot's dashboard on its own page. */
export default async function Page() {
  const me = await currentStaff();
  if (!me) redirect("/admin");
  const lang = normLang((await cookies()).get(LANG_COOKIE)?.value);
  return <BotFull lang={lang} moderator={me.level === "moderator"} />;
}
