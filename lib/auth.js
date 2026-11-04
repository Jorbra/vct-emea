// Admin session: a signed expiring cookie, which names the editor ("" for the main account). Node crypto only.
import crypto from "node:crypto";

export const COOKIE = "kickoff_admin";
export const SESSION_MS = 7 * 24 * 3600 * 1000;

function sign(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function makeToken(secret, now = Date.now(), who = "") {
  const exp = String(now + SESSION_MS);
  const payload = who ? `${exp}.${Buffer.from(who).toString("base64url")}` : exp;
  return `${payload}.${sign(payload, secret)}`;
}

/** The editor a token names: { who } ("" for the main account), or null when it is not valid. */
export function readToken(token, secret, now = Date.now()) {
  if (!token || !secret) return null;
  const parts = String(token).split(".");
  if (parts.length < 2 || parts.length > 3) return null;
  const sig = parts[parts.length - 1];
  const payload = parts.slice(0, -1).join(".");
  if (!sig || !(Number(parts[0]) > now)) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(payload, secret));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return { who: parts.length === 3 ? Buffer.from(parts[1], "base64url").toString() : "" };
}

export const verifyToken = (token, secret, now = Date.now()) => !!readToken(token, secret, now);

export function checkPassword(input, expected) {
  if (!expected || typeof input !== "string") return false;
  const h = (s) => crypto.createHash("sha256").update(s).digest();
  return crypto.timingSafeEqual(h(input), h(expected));
}

// Slows down password guessing: 8 failures per 10 minutes per address, kept in memory.
const fails = new Map();
const WINDOW = 10 * 60 * 1000;
export function tooManyAttempts(key, now = Date.now()) {
  const list = (fails.get(key) || []).filter((t) => now - t < WINDOW);
  fails.set(key, list);
  return list.length >= 8;
}
export function recordFailure(key, now = Date.now()) {
  fails.set(key, [...(fails.get(key) || []), now]);
}
