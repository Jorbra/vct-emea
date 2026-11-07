// Posts to a Discord channel when a match goes live and when its result is in. Set DISCORD_WEBHOOK_URL to turn it on.
// The server compares the matches with what it already announced, so it works whichever way a match changed.
import { EVENT_NAMES } from "./paths.js";
import { allMatches } from "./matchlist.js";
import { teamSlug } from "./paths.js";
import { makeT } from "./i18n.js";
import { scoreLabel } from "./scoretext.js";

const name = (t) => (t && t.name) || "TBD";

const START_WINDOW = 2 * 3600 * 1000; // a time set long after the fact announces nothing

/**
 * What can be announced now: { key, text }. A result needs both teams, and live needs no result yet.
 * With `now`, a match whose planned time has just come has its own announcement, unless it is live already; a new time can announce again.
 */
export function announcements(state, now) {
  const out = [];
  for (const m of allMatches(state)) {
    if (!m.a || !m.b || !m.a.name || !m.b.name) continue;
    const teams = [teamSlug(m.a.name), teamSlug(m.b.name)];
    const base = { teams, url: `/match/${m.event}/${m.id}`, event: m.event, a: m.a.name, b: m.b.name, bo: m.bo };
    const since = now && m.at ? now - new Date(m.at).getTime() : -1;
    let a = null;
    if (m.sa != null && m.sb != null) {
      // the score is in the key: a corrected result is announced again
      a = { ...base, kind: "result", sa: m.sa, sb: m.sb, note: m.note || null, key: `${m.event}:${m.id}:r:${m.sa}-${m.sb}` };
    } else if (m.live) {
      a = { ...base, kind: "live", key: `${m.event}:${m.id}:l` };
    } else if (since >= 0 && since < START_WINDOW) {
      a = { ...base, kind: "time", key: `${m.event}:${m.id}:t:${m.at}` };
    }
    if (a) out.push({ ...a, text: alertText(a, "fr") });
  }
  return out;
}

const LIVE_WORD = { fr: "EN DIRECT", en: "LIVE", tr: "CANLI", ar: "مباشر" };
const TIME_WORD = { fr: "C'est l'heure", en: "It's time", tr: "Başlıyor", ar: "حان الوقت" };

/** An announcement in a language; the teams and the score in bold, for Discord (an alert takes the stars off). */
export function alertText(a, lang = "fr") {
  const where = makeT(lang)(EVENT_NAMES[a.event] || "");
  if (a.kind === "result") {
    if (a.note && a.note.kind !== "raw") return `✅ **${a.a} – ${a.b}** : ${makeT(lang)(a.note.kind === "ff" ? "Forfeit" : "Win")} ${a.sa > a.sb ? a.a : a.b} · ${where}`;
    return `✅ **${a.a} ${scoreLabel(a, makeT(lang))} ${a.b}** · ${where}`;
  }
  const emoji = a.kind === "live" ? "🔴" : "🔔";
  const word = (a.kind === "live" ? LIVE_WORD : TIME_WORD)[lang] || (a.kind === "live" ? LIVE_WORD.en : TIME_WORD.en);
  return `${emoji} **${word} : ${a.a} vs ${a.b}** · ${where} (Bo${a.bo})`;
}

/**
 * Lets a match announce again: all of it when it is cleared, only its live announcement when it stops being live.
 * Nothing about it is known any more, so it rings like a new one.
 */
export function forgetAnnouncements(db, event, id, onlyLive = false) {
  const like = `${event}:${id}:${onlyLive ? "l" : "%"}`;
  for (const table of ["announced", "pushed"]) {
    fillAnnounced(db, table);
    db.prepare(`DELETE FROM ${table} WHERE "key" LIKE ?`).run(like);
  }
}

export function fillAnnounced(db, table = "announced") {
  db.exec(`CREATE TABLE IF NOT EXISTS ${table} ("key" TEXT PRIMARY KEY)`);
}

/** The ones not announced yet, all marked as announced. The first time, nothing is posted: only what happens from now on. */
export function nextAnnouncements(db, state, { table = "announced", now } = {}) {
  fillAnnounced(db, table);
  const known = new Set(db.prepare(`SELECT "key" AS k FROM ${table}`).all().map((r) => r.k)); // one trip, however many matches
  const first = known.size === 0;
  const fresh = announcements(state, now).filter((a) => !known.has(a.key));
  if (!first && !fresh.length) return [];
  const mark = db.prepare(`INSERT OR IGNORE INTO ${table} ("key") VALUES (?)`);
  db.transaction(() => {
    if (first) mark.run("started");
    fresh.forEach((a) => mark.run(a.key));
  })();
  return first ? [] : fresh;
}

export const isWebhook = (url) => /^https:\/\/(?:\w+\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(url || "");

/** Lines into as few messages as Discord's 2000 characters allow: 128 matches at once must not mean 128 messages. */
export function groupMessages(lines, limit = 1900) {
  const out = [];
  for (const line of lines) {
    const last = out[out.length - 1];
    if (last !== undefined && last.length + 1 + line.length <= limit) out[out.length - 1] = `${last}\n${line}`;
    else out.push(line);
  }
  return out;
}

/** Posts what is new, grouped: called by the regular round on GitHub (scripts/worker.mjs). */
export async function announceOnce(getState, getDb, url = process.env.DISCORD_WEBHOOK_URL) {
  if (!url) return;
  if (!isWebhook(url)) {
    console.log("[discord] DISCORD_WEBHOOK_URL is not a Discord webhook address");
    return;
  }
  try {
    const lang = process.env.DISCORD_LANG || "fr";
    const fresh = nextAnnouncements(getDb(), getState());
    const messages = groupMessages(fresh.map((a) => alertText(a, lang)));
    for (let i = 0; i < messages.length; i++) {
      const post = () => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: messages[i], allowed_mentions: { parse: [] } }) });
      if (i) await new Promise((r) => setTimeout(r, 1200));
      const res = await post();
      if (res.status === 429) {
        const wait = Number(res.headers.get("retry-after")) || 2;
        await new Promise((r) => setTimeout(r, Math.min(wait, 10) * 1000));
        await post();
      }
    }
    // the results' pictures, when a few results come at once (not for a round of 128 matches)
    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    const results = fresh.filter((a) => a.kind === "result");
    if (host && results.length && results.length <= 10) {
      const site = `https://${host}`;
      const embeds = results.map((a) => ({ title: `${a.a} ${a.sa}–${a.sb} ${a.b}`, url: site + a.url, color: 0xff4655, image: { url: `${site}/api/og${a.url.replace(/^\/match/, "")}?v=${a.sa}-${a.sb}` } }));
      await new Promise((r) => setTimeout(r, 1200));
      await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ embeds, allowed_mentions: { parse: [] } }) });
    }
  } catch (e) {
    console.log(`[discord] ${e.message}`);
  }
}
