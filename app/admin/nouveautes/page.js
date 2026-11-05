import { redirect } from "next/navigation";
import AdminGuide from "../../../components/AdminGuide";
import { readCommitLog } from "../../../lib/changelog.js";
import { getDb } from "../../../lib/db.js";
import { readItems, saveItem } from "../../../lib/lpstore.js";
import { currentEditor } from "../../../lib/session.js";
import { listHistory } from "../../../lib/undo.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nouveautés · Éditeur · VCT EMEA", robots: { index: false } };

// the last commit written by hand in the log: everything after it comes by itself
const WRITTEN_UP_TO = "3859ad2";

/** For the editors only: what is new and how things work. */
export default async function Page() {
  if (!(await currentEditor())) redirect("/admin");
  const { entries, stale } = await readCommitLog(WRITTEN_UP_TO, { readItems, saveItem });
  return <AdminGuide auto={entries} stale={stale} history={listHistory(getDb(), 60)} />;
}
