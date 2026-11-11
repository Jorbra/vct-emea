import { getDb, getState } from "../../../lib/db.js";
import { allMatches } from "../../../lib/matchlist.js";
import { matchCard, page } from "../../../lib/embed.js";

export const dynamic = "force-dynamic";

// GET /embed/live?team=fnatic&light=1: every live match (or one team's), for a stream overlay.
export async function GET(req) {
  const u = new URL(req.url);
  const team = (u.searchParams.get("team") || "").toLowerCase();
  const state = getState(getDb());
  const slug = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const live = allMatches(state).filter((m) => m.live && m.a && m.b && (!team || slug(m.a.name) === team || slug(m.b.name) === team)).slice(0, 8);
  const body = live.length ? live.map((m) => matchCard(m, (state.live[m.event] || {})[m.id])).join("") : `<div class="empty">Aucun match en direct</div>`;
  return new Response(page(body, { light: u.searchParams.get("light") === "1" }), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
