// "Lier avec Discord" on the account page: Discord's OAuth2 sign-in, scope "identify" only (the id and the name, nothing
// else: no e-mail, no servers, no message). The account page's button (a POST) sends the visitor to Discord with a signed state
// tied to their account and to this browser (a cookie); Discord sends them back here with a code, which gives their id,
// and the account is tied (lib/accountdiscord.js). Needs DISCORD_CLIENT_SECRET on the server and this address
// (https://<site>/api/discord-link) among the app's redirects in Discord's developer portal; /lier stays as the other way.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCOUNT_COOKIE, readAccountToken } from "../../../lib/accounts.js";
import { linkAccountTo, makeLinkState, readLinkState } from "../../../lib/accountdiscord.js";
import { APP_ID } from "../../../lib/botapi.js";
import { getDb } from "../../../lib/db.js";

export const dynamic = "force-dynamic";

const NONCE_COOKIE = "vct_dlink";

/** The site's own address as the visitor sees it (behind Coolify's proxy). */
function origin(req) {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  return { base: `${proto}://${host}`, secure: proto === "https" };
}

/** Back to the account page, saying how it went (?discord=ok, cancelled, expired, error, unavailable, signin, start). */
function back(req, result) {
  const { base } = origin(req);
  const res = NextResponse.redirect(`${base}/compte?discord=${result}`, 303);
  res.cookies.set(NONCE_COOKIE, "", { path: "/api/discord-link", maxAge: 0 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

/** Who asks, and what is needed: { name, secret, client, db } or the answer to send back. */
async function prepare(req) {
  const secret = process.env.SESSION_SECRET;
  const client = process.env.DISCORD_CLIENT_SECRET;
  if (!secret || !client || !APP_ID) return { stop: back(req, "unavailable") };
  const jar = await cookies();
  const acc = jar.get(ACCOUNT_COOKIE);
  const db = getDb();
  const name = readAccountToken(db, acc && acc.value, secret);
  if (!name) return { stop: back(req, "signin") };
  return { name, secret, client, db, jar };
}

// the way to Discord: a form's button on the account page (a POST, so that another site cannot start it: the account's
// cookie is not sent with another site's POST)
export async function POST(req) {
  const p = await prepare(req);
  if (p.stop) return p.stop;
  const { base, secure } = origin(req);
  const { state, nonce } = makeLinkState(p.secret, p.name);
  const to = new URL("https://discord.com/oauth2/authorize");
  to.search = new URLSearchParams({ client_id: APP_ID, response_type: "code", scope: "identify", redirect_uri: `${base}/api/discord-link`, state, prompt: "none" }).toString();
  const res = NextResponse.redirect(to.toString(), 303);
  res.cookies.set(NONCE_COOKIE, nonce, { httpOnly: true, sameSite: "lax", secure, path: "/api/discord-link", maxAge: 600 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

// the way back from Discord
export async function GET(req) {
  const params = new URL(req.url).searchParams;
  if (!params.has("state") && !params.has("code") && !params.has("error")) return back(req, "start");
  const p = await prepare(req);
  if (p.stop) return p.stop;
  const { name, secret, client, db, jar } = p;
  const redirect = `${origin(req).base}/api/discord-link`;
  if (params.get("error")) return back(req, "cancelled");
  const nonce = (jar.get(NONCE_COOKIE) || {}).value || "";
  const forAccount = readLinkState(secret, params.get("state"), nonce);
  if (!forAccount || forAccount !== name) return back(req, "expired");
  const code = params.get("code") || "";
  if (!/^[A-Za-z0-9_-]{10,100}$/.test(code)) return back(req, "error");
  try {
    const tok = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: APP_ID, client_secret: client, grant_type: "authorization_code", code, redirect_uri: redirect }),
      signal: AbortSignal.timeout(8000),
    });
    const t = await tok.json().catch(() => ({}));
    if (!tok.ok || !t.access_token) return back(req, "error");
    const me = await fetch("https://discord.com/api/v10/users/@me", { headers: { Authorization: `Bearer ${t.access_token}` }, signal: AbortSignal.timeout(8000) });
    const u = await me.json().catch(() => ({}));
    if (!me.ok || !u.id) return back(req, "error");
    // the token served once: given back to Discord right away (nothing is kept)
    fetch("https://discord.com/api/v10/oauth2/token/revoke", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: APP_ID, client_secret: client, token: t.access_token }), signal: AbortSignal.timeout(5000),
    }).catch(() => { /* it ends by itself */ });
    return back(req, linkAccountTo(db, name, { id: String(u.id), name: u.global_name || u.username || String(u.id) }) ? "ok" : "error");
  } catch {
    return back(req, "error");
  }
}
