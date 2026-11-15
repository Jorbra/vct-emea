// Round 21: the records of a map and of a player, from vlr.gg's tables (one map each), and the players in form for the home page.
import { teamSlug } from "./paths.js";

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z]/g, "");

/** Every map line of every table: [{ event, id, map, a, b, row }]. */
function lines(entries) {
  const out = [];
  for (const { event, id, details } of entries) for (const mp of (details && details.maps) || []) for (const row of mp.rows || []) if (row.name && row.side) out.push({ event, id, map: mp.map, a: mp.a, b: mp.b, row });
  return out;
}

const best = (list, key, n = 3) => list.filter((x) => x.row[key] != null).sort((x, y) => y.row[key] - x.row[key]).slice(0, n)
  .map((x) => ({ value: x.row[key], name: x.row.name, slug: teamSlug(x.row.name), map: x.map, event: x.event, id: x.id, agent: (x.row.agents || [])[0] || "" }));

/** A map's records: { acs, kills, rating, fk } — the 3 best lines each. Pure. */
export function mapRecords(entries, map) {
  const list = lines(entries).filter((x) => norm(x.map) === norm(map));
  if (!list.length) return null;
  return { acs: best(list, "acs"), kills: best(list, "k"), rating: best(list, "r"), fk: best(list, "fk") };
}

/** A player's best maps: { acs, kills, rating } — their 3 best lines each. Pure. */
export function playerRecords(entries, slug) {
  const list = lines(entries).filter((x) => teamSlug(x.row.name) === slug);
  if (list.length < 2) return null;
  return { acs: best(list, "acs"), kills: best(list, "k"), rating: best(list, "r") };
}
