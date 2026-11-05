import { redirect } from "next/navigation";
import AdminGuide from "../../../components/AdminGuide";
import { currentEditor } from "../../../lib/session.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nouveautés · Éditeur · VCT EMEA", robots: { index: false } };

/** For the editors only: what is new and how things work. */
export default async function Page() {
  if (!(await currentEditor())) redirect("/admin");
  return <AdminGuide />;
}
