import { NextResponse } from "next/server";
import { COOKIE } from "../../../lib/auth.js";
import { ACCOUNT_COOKIE } from "../../../lib/accounts.js";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  // an editor signed in through a visitor's account leaves through the same door
  res.cookies.set(ACCOUNT_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
