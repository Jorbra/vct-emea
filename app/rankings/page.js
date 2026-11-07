import { redirect } from "next/navigation";

// the rankings became the Stats page, with vlr.gg's numbers
export default function Page() {
  redirect("/stats");
}
