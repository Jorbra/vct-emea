import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCOUNT_COOKIE, ACCOUNT_MS, changePassword, deleteAccount, logIn, makeAccountToken, readAccount, readAccountToken, saveAccount, signUp } from "../../../lib/accounts.js";
import { recordFailure, tooManyAttempts } from "../../../lib/auth.js";
import { getDb } from "../../../lib/db.js";
import { badRequest, readBody } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

const secret = () => process.env.SESSION_SECRET;
const noStore = { "Cache-Control": "no-store" };

async function me() {
  const c = (await cookies()).get(ACCOUNT_COOKIE);
  return readAccountToken(getDb(), c && c.value, secret());
}

function withCookie(req, res, value, maxAge) {
  const proto = req.headers.get("x-forwarded-proto") || new URL(req.url).protocol.replace(":", "");
  res.cookies.set(ACCOUNT_COOKIE, value, { httpOnly: true, sameSite: "lax", secure: proto === "https", path: "/", maxAge });
  return res;
}

const failed = (r) => NextResponse.json({ error: r.error }, { status: r.status, headers: noStore });

/** The signed-in visitor's account, for this device to follow. */
export async function GET() {
  const name = await me();
  if (!name) return NextResponse.json({ account: null }, { headers: noStore });
  return NextResponse.json({ account: readAccount(getDb(), name) }, { headers: noStore });
}

export async function POST(req) {
  const b = await readBody(req);
  if (!b) return badRequest();
  if (!secret()) return NextResponse.json({ error: "Accounts are not available." }, { status: 503 });
  const db = getDb();
  const ip = (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();

  if (b.action === "signup" || b.action === "login") {
    const key = `account:${ip}`;
    if (tooManyAttempts(key)) return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
    const r = b.action === "signup"
      ? signUp(db, { name: b.name, password: b.password, token: b.token, favorites: b.favorites, prefs: b.prefs })
      : logIn(db, { name: b.name, password: b.password, token: b.token, favorites: b.favorites });
    // creating accounts counts too, so that a script cannot fill the table
    if (!r.ok || b.action === "signup") recordFailure(key);
    if (!r.ok) return failed(r);
    const res = NextResponse.json({ ok: true, message: r.message, account: r.account }, { headers: noStore });
    return withCookie(req, res, makeAccountToken(secret(), r.account.name, r.ver), ACCOUNT_MS / 1000);
  }
  if (b.action === "logout") return withCookie(req, NextResponse.json({ ok: true }, { headers: noStore }), "", 0);

  const name = await me();
  if (!name) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  const key = `account:${ip}`;
  if (tooManyAttempts(key)) return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  if (b.action === "password") {
    const r = changePassword(db, name, { password: b.password, next: b.next });
    if (!r.ok) { recordFailure(key); return failed(r); }
    return withCookie(req, NextResponse.json({ ok: true, message: r.message }, { headers: noStore }), makeAccountToken(secret(), name, r.ver), ACCOUNT_MS / 1000);
  }
  if (b.action === "delete") {
    const r = deleteAccount(db, name, { password: b.password });
    if (!r.ok) { recordFailure(key); return failed(r); }
    return withCookie(req, NextResponse.json({ ok: true, message: r.message }, { headers: noStore }), "", 0);
  }
  return badRequest();
}

/** What changed on this device: favorites, settings. */
export async function PATCH(req) {
  const b = await readBody(req);
  if (!b) return badRequest();
  const name = await me();
  if (!name) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  const r = saveAccount(getDb(), name, { favorites: b.favorites, prefs: b.prefs });
  return r.ok ? NextResponse.json({ ok: true }, { headers: noStore }) : failed(r);
}
