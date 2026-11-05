// The site's log fills itself: each update comes from its commit on GitHub, each change of data from the site's history.
// A commit tells the log what it did in French, one line each: "Journal: Ajout | Site | Le texte".
const REPO = "Jorbra/vct-emea";
const KINDS = ["Ajout", "Modification", "Correction", "Données"];
const AREAS = ["Site", "Éditeur", "Coulisses"];
const TZ = "Europe/Paris";

export const parisDay = (iso) => new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
export const parisTime = (iso) => new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** One commit's lines of the log: [{ at, kind, area, text }]. A commit with none gives its first line, so that nothing is ever missing. */
export function commitEntries(at, message) {
  const lines = String(message || "").split(/\r?\n/);
  const out = [];
  for (const l of lines) {
    const m = /^Journal:\s*([^|]+)\|([^|]+)\|\s*(.+)$/.exec(l.trim());
    if (m) out.push({ at, kind: KINDS.includes(m[1].trim()) ? m[1].trim() : "Modification", area: AREAS.includes(m[2].trim()) ? m[2].trim() : "Coulisses", text: m[3].trim() });
  }
  if (out.length) return out;
  const first = lines[0].trim();
  return first && !/^Merge /.test(first) ? [{ at, kind: "Modification", area: "Coulisses", text: first }] : [];
}

/** The commits after `sinceSha`, newest first. Only their date and message are kept. */
export function newCommits(list, sinceSha) {
  const out = [];
  for (const c of list) {
    if (String(c.sha || "").startsWith(sinceSha)) break;
    if (c.commit && c.commit.committer && c.commit.committer.date) out.push({ at: c.commit.committer.date, message: c.commit.message || "" });
  }
  return out;
}

/** Puts the automatic lines before the written ones, day by day: [{ date, items: [[time, kind, area, text]] }]. */
export function mergeLog(auto, written) {
  const days = [];
  const dayOf = (date) => {
    let d = days.find((x) => x.date === date);
    if (!d) { d = { date, items: [] }; days.push(d); }
    return d;
  };
  for (const e of [...auto].sort((a, b) => b.at.localeCompare(a.at))) dayOf(parisDay(e.at)).items.push([parisTime(e.at), e.kind, e.area, e.text]);
  for (const w of written) dayOf(w.date).items.push(...w.items);
  return days;
}

/** The lines from GitHub; the last ones kept when GitHub does not answer. { entries, stale }. */
export async function readCommitLog(sinceSha, { readItems, saveItem }) {
  try {
    const headers = { "User-Agent": "vct-emea-site/1.0", Accept: "application/vnd.github+json", ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) };
    const res = await fetch(`https://api.github.com/repos/${REPO}/commits?per_page=100`, { headers, next: { revalidate: 300 }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
    const commits = newCommits(await res.json(), sinceSha);
    const entries = commits.flatMap((c) => commitEntries(c.at, c.message));
    const old = readItems("changelog").commits;
    if (!old || JSON.stringify(old) !== JSON.stringify(entries)) saveItem("changelog", "commits", entries);
    return { entries, stale: false };
  } catch (e) {
    console.log(`[changelog] ${e.message}`);
    return { entries: readItems("changelog").commits || [], stale: true };
  }
}
