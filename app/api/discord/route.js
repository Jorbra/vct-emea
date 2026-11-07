import { NextResponse } from "next/server";
import { getDb, getState } from "../../../lib/db.js";
import { answerCommand, verifyDiscord } from "../../../lib/discordbot.js";
import { seasonRanking } from "../../../lib/fans.js";

export const dynamic = "force-dynamic";

// Discord's calls for the bot's slash commands (its "Interactions Endpoint URL"). Needs DISCORD_PUBLIC_KEY.
export async function POST(req) {
  const body = await req.text();
  if (!verifyDiscord(process.env.DISCORD_PUBLIC_KEY, req.headers.get("x-signature-ed25519"), req.headers.get("x-signature-timestamp"), body)) {
    return new NextResponse("Bad signature", { status: 401 });
  }
  let i;
  try { i = JSON.parse(body); } catch { return new NextResponse("Bad request", { status: 400 }); }
  if (i.type === 1) return NextResponse.json({ type: 1 }); // Discord checking the address
  if (i.type !== 2 || !i.data) return NextResponse.json({ type: 4, data: { content: "?" } });
  const db = getDb();
  const state = getState(db);
  const name = i.data.name;
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const content = answerCommand(name, i.data.options, state, { ranking: name === "classement" ? seasonRanking(db, state, { limit: 10 }) : [], site: host ? `https://${host}` : "" });
  return NextResponse.json({ type: 4, data: { content, allowed_mentions: { parse: [] } } });
}
