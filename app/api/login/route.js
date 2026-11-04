import { NextResponse } from "next/server";
import { COOKIE, SESSION_MS, checkPassword, makeToken, recordFailure, tooManyAttempts } from "../../../lib/auth.js";
import { getDb } from "../../../lib/db.js";
import { checkEditor } from "../../../lib/editors.js";
import { readBody } from "../../../lib/session.js";

export async function POST(req) {
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (!password || !secret) {
    return NextResponse.json({ error: "ADMIN_PASSWORD and SESSION_SECRET must be set in .env.local." }, { status: 500 });
  }
  const ip = (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  if (tooManyAttempts(ip)) {
    return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }
  const body = await readBody(req);
  // with a name: an editor's account; without: the main account
  const name = body && String(body.name || "").trim();
  const who = name ? checkEditor(getDb(), name, body.password) : "";
  if (!body || (name ? !who : !checkPassword(body.password, password))) {
    recordFailure(ip);
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }
  const proto = req.headers.get("x-forwarded-proto") || new URL(req.url).protocol.replace(":", "");
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, makeToken(secret, Date.now(), who), {
    httpOnly: true,
    sameSite: "lax",
    secure: proto === "https",
    path: "/",
    maxAge: SESSION_MS / 1000,
  });
  return res;
}
