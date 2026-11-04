// Where a roster typed on the site and the one Liquipedia gives differ. Pure.
import { teamSlug } from "./paths.js";
import { parseRoster, rosterEntry } from "./tournament.js";
import { siteTeams } from "./teams.js";

/** One entry per team that differs: { name, key, onlySite: [names], onlyLp: [names], roster (what to save to follow Liquipedia) }. Substitutes on the site don't count. */
export function rosterDiffs(state, teamInfo) {
  const out = [];
  for (const t of siteTeams(state)) {
    const key = teamSlug(t.name);
    const lp = teamInfo[key];
    if (!lp || !lp.page || !(lp.roster || []).length) continue;
    const mine = parseRoster(t.roster);
    const starters = mine.filter((p) => !p.sub);
    const theirs = new Set(lp.roster.map((p) => teamSlug(p.id)));
    const ours = new Set(starters.map((p) => teamSlug(p.name)));
    const onlySite = starters.filter((p) => !theirs.has(teamSlug(p.name))).map((p) => p.name);
    const onlyLp = lp.roster.filter((p) => !ours.has(teamSlug(p.id))).map((p) => p.id);
    if (!onlySite.length && !onlyLp.length) continue;
    const subs = mine.filter((p) => p.sub && !theirs.has(teamSlug(p.name)));
    const roster = [...lp.roster.map((p) => rosterEntry(p.id, { cc: p.cc })), ...subs.map((p) => rosterEntry(p.name, p))].join(", ");
    out.push({ name: t.name, key, onlySite, onlyLp, roster });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Writes a team's roster everywhere the team plays. */
export function saveRosterEverywhere(db, name, roster) {
  let changed = 0;
  db.transaction(() => {
    for (const table of ["teams", "kteams", "rteams", "qslots"]) changed += db.prepare(`UPDATE ${table} SET roster = ? WHERE name = ?`).run(roster, name).changes;
  })();
  return changed;
}
