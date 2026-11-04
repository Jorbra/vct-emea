// Refreshes lib/valorant-players.json: the Valorant players and staff (coaches, managers, analysts...) suggested in the editor's name fields.
// Source: Liquipedia's player portal (CC-BY-SA 3.0, https://liquipedia.net/valorant/Portal:Players).
// Their API terms allow one parse request every 30 s, so a run takes about 4 minutes. Run: npm run players
import { writeFileSync } from "node:fs";

const UA = "vct-kickoff-site/1.0 (personal tournament site; player name suggestions)";
// Liquipedia's player regions, as its portal pages group them. Brazil has no portal page of its own (Americas leaves it out), so it is asked for here.
const REGIONS = [
  "Europe",
  "CIS",
  "Africa, Middle East",
  "North America, South America, Latin America North, Latin America South",
  "Brazil",
  "Asia, East Asia, China, Southeast Asia, South Asia",
  "Oceania",
];
const OUT = new URL("../lib/valorant-players.json", import.meta.url);
// Each country has a players table and a staff table; the staff one has this header.
const STAFF_HEADER = 'title="Coaches, Managers, Analysts and more"';

const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));

/** { players, staff }: [name, countryCode] for every row of one portal page (the country comes from the flag file, e.g. At_hd.png -> "at"). */
function parsePortal(html) {
  const out = { players: [], staff: [] };
  for (const table of html.split("<table").slice(1)) {
    const rows = table.includes(STAFF_HEADER) ? out.staff : out.players;
    for (const m of table.matchAll(/<div class="block-player"[^>]*>(.*?)<\/div>/g)) {
      const name = m[1].match(/<span class="name"[^>]*>(?:<a [^>]*>)?([^<]+)/);
      if (!name) continue;
      const flag = m[1].match(/\/([A-Za-z-]+)_hd\.png\//);
      rows.push([decode(name[1]).trim(), flag ? flag[1].toLowerCase() : ""]);
    }
  }
  return out;
}

async function main() {
  const all = { players: new Map(), staff: new Map() };
  for (const [i, region] of REGIONS.entries()) {
    if (i) await new Promise((r) => setTimeout(r, 31000));
    const q = { action: "parse", contentmodel: "wikitext", prop: "text", format: "json", text: `{{Portal players|region=${region}}}` };
    const url = "https://liquipedia.net/valorant/api.php?" + new URLSearchParams(q);
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Encoding": "gzip" } });
    const j = await res.json();
    if (!j.parse) throw new Error(`${region}: ${JSON.stringify(j).slice(0, 200)}`);
    const found = parsePortal(j.parse.text["*"]);
    for (const k of ["players", "staff"]) {
      for (const [name, cc] of found[k]) if (name && !all[k].has(name.toLowerCase())) all[k].set(name.toLowerCase(), [name, cc]);
    }
    console.log(`${region}: ${found.players.length} players, ${found.staff.length} staff`);
  }
  const sorted = (m) => [...m.values()].sort((a, b) => a[0].localeCompare(b[0]));
  const data = { players: sorted(all.players), staff: sorted(all.staff) };
  writeFileSync(OUT, JSON.stringify(data) + "\n");
  console.log(`${data.players.length} players and ${data.staff.length} staff written to lib/valorant-players.json`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
