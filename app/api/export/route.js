import { getDb, getState } from "../../../lib/db.js";
import { seasonRanking } from "../../../lib/fans.js";
import { rankingCsv, resultsCsv } from "../../../lib/round7.js";
import { isAdmin } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

// GET ?kind=results | ranking: a CSV file for a spreadsheet (separated by ";", for French Excel). Editors only.
export async function GET(req) {
  if (!(await isAdmin())) return new Response("Not authorised.", { status: 401 });
  const kind = new URL(req.url).searchParams.get("kind");
  const db = getDb();
  const state = getState(db);
  const body = kind === "ranking" ? rankingCsv(seasonRanking(db, state, { limit: 100000 })) : resultsCsv(state);
  const day = new Date().toISOString().slice(0, 10);
  return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="vct-emea-${kind === "ranking" ? "pronostics" : "resultats"}-${day}.csv"`, "Cache-Control": "no-store" } });
}
