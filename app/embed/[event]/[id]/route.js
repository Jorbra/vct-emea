import { getDb, getState } from "../../../../lib/db.js";
import { allMatches } from "../../../../lib/matchlist.js";
import { matchCard, page } from "../../../../lib/embed.js";

export const dynamic = "force-dynamic";

// GET /embed/q2/r512-1?light=1: one match's score for a stream overlay (OBS: browser source), transparent, refreshed every 20 s.
export async function GET(req, { params }) {
  const { event, id } = await params;
  const state = getState(getDb());
  const m = allMatches(state).find((x) => x.event === event && x.id === id);
  const light = new URL(req.url).searchParams.get("light") === "1";
  const body = m ? matchCard(m, (state.live[event] || {})[id]) : `<div class="empty">Match inconnu</div>`;
  return new Response(page(body, { light }), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
