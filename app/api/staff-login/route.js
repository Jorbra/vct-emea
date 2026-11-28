// The link /editeur gives on Discord (lib/staffaccess.js). Opening it shows one button: link checkers and previews that
// open links by themselves do not use the code, only the person's click does (POST). The code works once, 10 minutes.
import { NextResponse } from "next/server";
import { COOKIE, SESSION_MS, makeToken, recordFailure, tooManyAttempts } from "../../../lib/auth.js";
import { getDb } from "../../../lib/db.js";
import { DISCORD_WHO } from "../../../lib/session.js";
import { useStaffCode } from "../../../lib/staffaccess.js";

export const dynamic = "force-dynamic";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const page = (body) => new NextResponse(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="referrer" content="no-referrer"><title>Éditeur · VCT EMEA</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#121212;color:#f2f2f2;font:16px system-ui,sans-serif}main{max-width:380px;padding:28px;text-align:center}h1{font-size:22px;margin:0 0 10px}p{color:#b5b5b5;line-height:1.5}button,a.b{display:inline-block;margin-top:14px;padding:12px 22px;border:0;border-radius:8px;background:#c9f03c;color:#121212;font:700 16px system-ui,sans-serif;cursor:pointer;text-decoration:none}</style></head><body><main>${body}</main></body></html>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-frame-options": "DENY" } });

export async function GET(req) {
  const code = new URL(req.url).searchParams.get("code") || "";
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(code)) return page(`<h1>Lien incomplet</h1><p>Retape <b>/editeur</b> sur Discord pour en avoir un nouveau.</p>`);
  return page(`<h1>Ouvrir l'éditeur</h1><p>Ce lien vient de la commande <b>/editeur</b> sur Discord. Il ne marche qu'une fois, pendant 10 minutes : ne le partage pas.</p>
<form method="post" action="/api/staff-login"><input type="hidden" name="code" value="${esc(code)}"><button type="submit">Ouvrir l'éditeur</button></form>`);
}

export async function POST(req) {
  const secret = process.env.SESSION_SECRET;
  const ip = (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  if (!secret) return page(`<h1>Indisponible</h1><p>Le site n'est pas prêt pour les connexions (SESSION_SECRET manque).</p>`);
  if (tooManyAttempts(ip)) return page(`<h1>Trop d'essais</h1><p>Réessaie dans quelques minutes.</p>`);
  let code = "";
  try { code = String((await req.formData()).get("code") || ""); } catch { code = ""; }
  const staff = useStaffCode(getDb(), code);
  if (!staff) {
    recordFailure(ip);
    return page(`<h1>Lien expiré</h1><p>Ce lien a déjà servi ou a plus de 10 minutes. Retape <b>/editeur</b> sur Discord pour en avoir un nouveau.</p>`);
  }
  const url = new URL(staff.level === "moderator" ? "/admin/bot" : "/admin", req.url);
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (host) { url.host = host; url.protocol = `${proto}:`; }
  const res = NextResponse.redirect(url, 303);
  res.cookies.set(COOKIE, makeToken(secret, Date.now(), `${DISCORD_WHO}${staff.id}`), { httpOnly: true, sameSite: "lax", secure: proto === "https", path: "/", maxAge: SESSION_MS / 1000 });
  return res;
}
