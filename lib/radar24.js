// Round 24: where a player stands among the others, stat by stat (percentiles), for the radar, the badges and the bot.

/** The stats the radar shows: [key, label, read(player)]. First kills are per map. */
export const RADAR_STATS = [
  ["r", "Rating", (p) => p.r],
  ["acs", "ACS", (p) => p.acs],
  ["kd", "K/D", (p) => p.kd],
  ["kast", "KAST", (p) => p.kast],
  ["adr", "ADR", (p) => p.adr],
  ["fk", "FK/map", (p) => (p.maps && p.fk != null ? Math.round((p.fk / p.maps) * 100) / 100 : null)],
];

/**
 * A player's percentile in each stat among the players with `min` maps at least:
 * [{ key, label, value, pct }] (pct 0–100: the share of the others below them), [] when they have too few maps.
 */
export function percentiles(players, me, min = 3) {
  if (!me || (me.maps || 0) < min) return [];
  const pool = (players || []).filter((p) => (p.maps || 0) >= min);
  return RADAR_STATS.map(([key, label, read]) => {
    const value = read(me);
    if (value == null) return null;
    const vals = pool.map(read).filter((v) => v != null);
    const others = vals.length - 1;
    if (others < 1) return null;
    const below = vals.filter((v) => v < value).length;
    return { key, label, value, pct: Math.round((below / others) * 100) };
  }).filter(Boolean);
}

/** The badges a player earns: "Top 5% ACS" for each stat where they are in the best 10%, best first, 3 at most. */
export function topBadges(list) {
  return (list || []).filter((x) => x.pct >= 90).sort((a, b) => b.pct - a.pct).slice(0, 3)
    .map((x) => ({ key: x.key, label: x.label, top: Math.max(1, 100 - x.pct) }));
}

const plain = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

/** A player found by name (exact first, then the start of the name) with their percentiles, or null. */
export function radarFor(players, query, min = 3) {
  const q = plain(query);
  if (!q) return null;
  const list = players || [];
  const p = list.find((x) => plain(x.name) === q || x.slug === q) || list.filter((x) => plain(x.name).startsWith(q)).sort((a, b) => (b.maps || 0) - (a.maps || 0))[0];
  if (!p) return null;
  return { slug: p.slug, name: p.name, team: p.team || "", maps: p.maps || 0, list: percentiles(list, p, min) };
}

/** The season's best for one stat (6 maps at least): the top 3, with each one's value. */
export function podiumBy(players, key = "r", min = 6) {
  const read = (RADAR_STATS.find(([k]) => k === key) || RADAR_STATS[0])[2];
  return (players || []).filter((p) => (p.maps || 0) >= min && read(p) != null)
    .sort((a, b) => read(b) - read(a) || (b.r || 0) - (a.r || 0)).slice(0, 3)
    .map((p) => ({ ...p, value: read(p) }));
}
