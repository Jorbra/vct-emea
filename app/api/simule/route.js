import { NextResponse } from "next/server";
import { ratings } from "../../../lib/r8data.js";
import { simEvents, simulate } from "../../../lib/round8.js";
import { badRequest, readBody } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

// POST { event, forced: { matchId: slot } }: each team's chances to qualify, with the visitor's picks forced.
export async function POST(req) {
  const b = await readBody(req);
  if (!b) return badRequest();
  const { state, rating } = ratings();
  const event = String(b.event || "");
  if (!simEvents(state).includes(event)) return NextResponse.json({ error: "Unknown event." }, { status: 404 });
  const forced = Object.fromEntries(Object.entries(b.forced && typeof b.forced === "object" ? b.forced : {}).slice(0, 64).map(([k, v]) => [String(k).slice(0, 12), Number(v)]));
  return NextResponse.json(simulate(state, event, rating, forced), { headers: { "Cache-Control": "no-store" } });
}
