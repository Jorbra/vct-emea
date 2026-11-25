// Streaks: the series a team has won (or lost) in a row up to its latest result, and its longest run of wins this season.
// Forfeits are left out. Teams are told apart by their name's slug, as everywhere on the site.
import { allMatches } from "./matchlist.js";
import { teamSlug } from "./paths.js";

/** [{ slug, name, tag, logo, kind: "W" | "L", n, best, last }] from the finished series, the longest running streaks first. Pure. */
export function teamStreaks(matches) {
  const done = matches.filter((m) => m.a && m.b && m.a.name && m.b.name && m.win && m.at && !(m.note && m.note.kind === "ff"))
    .sort((x, y) => String(x.at).localeCompare(String(y.at)));
  const by = new Map();
  for (const m of done) {
    for (const side of ["a", "b"]) {
      const t = m[side];
      const slug = teamSlug(t.name);
      if (!slug) continue;
      const r = by.get(slug) || { slug, name: t.name, tag: t.tag || "", logo: t.logo || "", kind: "", n: 0, best: 0, run: 0, last: "" };
      const won = m.win === side;
      r.kind = won ? "W" : "L";
      r.n = won ? (r.lastWon ? r.n + 1 : 1) : (r.lastWon === false ? r.n + 1 : 1);
      r.lastWon = won;
      r.run = won ? r.run + 1 : 0;
      r.best = Math.max(r.best, r.run);
      r.last = m.at;
      if (t.logo) r.logo = t.logo;
      by.set(slug, r);
    }
  }
  return [...by.values()].map(({ run, lastWon, ...r }) => r) // eslint-disable-line no-unused-vars
    .sort((x, y) => (y.kind === "W") - (x.kind === "W") || y.n - x.n || String(y.last).localeCompare(String(x.last)));
}

/** The site's streaks from its state. */
export const siteStreaks = (state) => teamStreaks(allMatches(state));

/** One team's streak, or null. */
export const streakOf = (state, slug) => siteStreaks(state).find((s) => s.slug === slug) || null;
