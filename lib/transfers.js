// Comings and goings, from what was read about each team: who joined, who left and for where. Pure.
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The latest moves: { date, kind: "in" | "out", id, team, teamKey, to, toName }, the most recent first. Staff are left out, and so is going inactive. */
export function transfers(teamInfo, limit = 100) {
  const out = [];
  for (const [teamKey, e] of Object.entries(teamInfo || {})) {
    if (!e.page) continue;
    for (const p of e.roster || []) if (DAY.test(p.join || "")) out.push({ date: p.join, kind: "in", id: p.id, cc: p.cc || "", team: e.name, teamKey });
    for (const p of e.formerPlayers || []) {
      if (!DAY.test(p.leave || "")) continue;
      if (/\(Inactive\)|^Inactive$/.test(p.newTeam || "")) continue; // not a departure yet
      out.push({ date: p.leave, kind: "out", id: p.id, cc: p.cc || "", team: e.name, teamKey, to: p.newTeam || "", toName: p.newTeamName || "" });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.team.localeCompare(b.team)).slice(0, limit);
}
