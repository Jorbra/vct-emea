import { NextResponse } from "next/server";
import { recordFailure, tooManyAttempts } from "../../../lib/auth.js";
import { getDb } from "../../../lib/db.js";
import { dayOf, myGames, playMove, readGame } from "../../../lib/games.js";
import { gameData } from "../../../lib/gamedata.js";
import { badRequest, readBody } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

// POST { token, mine: true }: the visitor's streak and today's games. POST { token, game }: today's game as it stands.
// POST { token, game, move }: one move (a player's or a team's name, or "a" / "b").
export async function POST(req) {
  const b = await readBody(req);
  if (!b) return badRequest();
  const db = getDb();
  const json = (r) => (r.ok ? NextResponse.json(r, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: r.error }, { status: r.status }));
  if (b.mine) return NextResponse.json(myGames(db, b.token), { headers: { "Cache-Control": "no-store" } });
  const data = gameData(dayOf());
  if (b.move == null) return json(readGame(db, data.puzzles, { token: b.token, game: String(b.game || "") }));
  const ip = "jeux:" + (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  if (tooManyAttempts(ip)) return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  const r = playMove(db, data.puzzles, { players: data.players, teams: data.teams, agents: data.agents }, { token: b.token, game: String(b.game || ""), move: String(b.move).slice(0, 60) });
  if (!r.ok && r.status !== 400) recordFailure(ip);
  return json(r);
}
