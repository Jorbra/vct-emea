// Refreshes lib/valorant-teams.json: the Valorant teams suggested in the editor's team name fields, with their short tag and logo.
// Source: Liquipedia (CC-BY-SA 3.0): every page of https://liquipedia.net/valorant/Category:Teams, read through its TeamShort template.
// Their API terms allow one parse request every 30 s, so a run takes about 5 minutes. Run: npm run teams
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

const API = "https://liquipedia.net/valorant/api.php";
const UA = "vct-kickoff-site/1.0 (personal tournament site; team name suggestions)";
const OUT = new URL("../lib/valorant-teams.json", import.meta.url);
const BATCH = 100; // teams per parse request
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));

/** The page's image paths are %-encoded ("Be%C5%9Fikta%C5%9F"); the list keeps the real file name. */
const fileName = (f) => { try { return decodeURIComponent(f); } catch { return f; } };

/** Where MediaWiki keeps a file: "<h>/<hh>/<name>", h being the md5 of the name. */
const commonsPath = (name) => {
  const h = createHash("md5").update(name).digest("hex");
  return `${h[0]}/${h.slice(0, 2)}/${name}`;
};

async function get(params) {
  const res = await fetch(API + "?" + new URLSearchParams({ format: "json", ...params }), { headers: { "User-Agent": UA, "Accept-Encoding": "gzip" } });
  return res.json();
}

/** Every page title in Category:Teams (a query request every 2 s). */
async function teamPages() {
  const titles = [];
  let cont = {};
  do {
    const j = await get({ action: "query", list: "categorymembers", cmtitle: "Category:Teams", cmnamespace: "0", cmlimit: "500", ...cont });
    titles.push(...j.query.categorymembers.map((m) => m.title));
    cont = j.continue || null;
    if (cont) await wait(2000);
  } while (cont);
  return titles;
}

/**
 * [name, tag, logo] for each rendered TeamShort. logo is the image's path under liquipedia.net/commons/images/ (e.g. "a/a9/Team_Heretics_2024_allmode.png"):
 * the logo made for every background first, else the one for dark backgrounds (the site's default), else the light one.
 */
function parseShorts(html) {
  const out = [];
  for (const m of html.matchAll(/<span class="team-template-team-short" data-highlighting-class="([^"]*)">(.*?)<span class="team-template-text">(?:<a [^>]*>)?([^<]*)/g)) {
    const icons = [...m[2].matchAll(/<span class="team-template-image-icon([^"]*)">.*?src="\/commons\/images\/(?:thumb\/)?([0-9a-f]\/[0-9a-f]{2}\/[^/"]+)/g)].map((x) => ({ mode: x[1], file: x[2] }));
    const pick = icons.find((i) => /allmode/i.test(i.file)) || icons.find((i) => /darkmode/.test(i.mode)) || icons[0];
    const name = decode(m[1]).trim();
    const tag = decode(m[3]).trim();
    if (name && tag && tag !== "TBD") out.push([name, tag, pick ? fileName(decode(pick.file)) : ""]);
  }
  return out;
}

async function main() {
  const titles = await teamPages();
  console.log(`${titles.length} team pages`);
  const teams = new Map();
  for (let i = 0; i < titles.length; i += BATCH) {
    await wait(i ? 31000 : 2000);
    const text = titles.slice(i, i + BATCH).map((t) => `{{TeamShort|${t}}}`).join("\n");
    const j = await get({ action: "parse", contentmodel: "wikitext", prop: "text", text });
    if (!j.parse) throw new Error(JSON.stringify(j).slice(0, 200));
    const found = parseShorts(j.parse.text["*"]);
    for (const t of found) if (!teams.has(t[0].toLowerCase())) teams.set(t[0].toLowerCase(), t);
    console.log(`${Math.min(i + BATCH, titles.length)}/${titles.length} read, ${teams.size} teams`);
  }
  // Some teams only show their light-background logo, hard to see on the site's dark theme: use the dark one when it exists.
  for (const t of teams.values()) {
    if (!/lightmode/i.test(t[2])) continue;
    const dark = commonsPath(t[2].split("/")[2].replace(/lightmode/i, "darkmode"));
    await wait(1000);
    const res = await fetch(`https://liquipedia.net/commons/images/${dark.split("/").slice(0, 2).join("/")}/${encodeURIComponent(dark.split("/")[2])}`, { method: "HEAD", headers: { "User-Agent": UA } });
    if (res.ok) t[2] = dark;
  }
  const list = [...teams.values()].sort((a, b) => a[0].localeCompare(b[0]));
  writeFileSync(OUT, JSON.stringify(list) + "\n");
  console.log(`${list.length} teams written to lib/valorant-teams.json`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
