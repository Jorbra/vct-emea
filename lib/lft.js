// Free agents (LFT): the people a team let go, from Liquipedia's monthly transfer pages, who have not joined a team since.
// Only the EMEA region (Europe, Türkiye, MENA and the CIS). One page read at a time, with the site's Liquipedia turn.
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WINDOW_MONTHS = 6;
const STAFF = /coach|analyst|manager|assistant|director|strateg|performance|owner|ceo/i;
// neither players nor staff: they are not on the market
const OUTSIDE = /content|creator|streamer|caster|influencer|ambassador|host|presenter|talent/i;
const EMEA = new Set(("al ad at be ba bg hr cy cz dk ee fi fr de gr hu is ie it xk lv li lt lu mt md mc me nl mk no pl pt ro sm rs sk si es se ch gb ua by ru am az ge kz kg uz tj tm "
  + "tr sa ae eg ma dz tn jo lb kw qa bh om iq sy ps ye ly il ir").split(" "));

const strip = (s) => String(s || "").replace(/<!--[\s\S]*?-->/g, "");
const clean = (s) => String(s || "").replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2").replace(/'''?/g, "").replace(/\s+/g, " ").trim();

/** A template's parameters, nested templates kept whole: { name: value }. */
function params(body) {
  const out = {};
  let depth = 0;
  let cur = "";
  const parts = [];
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === "{{" || two === "[[") { depth++; cur += two; i++; continue; }
    if ((two === "}}" || two === "]]") && depth > 0) { depth--; cur += two; i++; continue; }
    if (body[i] === "|" && depth === 0) { parts.push(cur); cur = ""; continue; }
    cur += body[i];
  }
  parts.push(cur);
  for (const p of parts) {
    const k = p.indexOf("=");
    if (k > 0) out[p.slice(0, k).trim()] = p.slice(k + 1).trim();
  }
  return out;
}

/** Every move of a transfer page: [{ date, people: [{ name, cc }], from, fromRole, to, toRole, url }]. */
export function parseTransfers(wikitext) {
  const out = [];
  const text = strip(wikitext);
  let at = 0;
  while ((at = text.indexOf("{{Transfer Row", at)) >= 0) {
    let depth = 0;
    let end = at;
    for (; end < text.length; end++) {
      if (text.startsWith("{{", end)) { depth++; end++; continue; }
      if (text.startsWith("}}", end)) { depth--; end++; if (depth === 0) break; }
    }
    const p = params(text.slice(at + 2, end - 1).replace(/^Transfer Row\s*\|?/, ""));
    at = end;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date || "")) continue;
    const people = [];
    for (let i = 1; i <= 10; i++) {
      const name = clean(p[i === 1 ? "name" : `name${i}`]);
      if (name) people.push({ name, cc: String(p[i === 1 ? "flag" : `flag${i}`] || "").toLowerCase().trim() });
    }
    if (!people.length) continue;
    const url = (/\burl=([^|}\s]+)/.exec(p.ref || "") || [])[1] || "";
    out.push({ date: p.date, people, from: clean(p.team1), fromRole: clean(p.role1), to: clean(p.team2 || p.team2_2), toRole: clean(p.role2), url: /^https:\/\//.test(url) ? url : "" });
  }
  return out;
}

/** The transfer pages of the last months, newest first, among those Liquipedia has. */
export function wantedTitles(all, now = new Date()) {
  const want = [];
  for (let i = 0; i < WINDOW_MONTHS; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const base = `Player Transfers/${d.getUTCFullYear()}/${MONTHS[d.getUTCMonth()]}`;
    want.push(...all.filter((t) => t === base || t.startsWith(`${base}/`)));
  }
  return want;
}

/**
 * Who is free now: [{ name, cc, date, from, role, url, staff }], the latest first. A person is free when the last move known for them is
 * a departure to no team (being benched is not one). isEmea(team) says whether a team with no flag to go by is one of the region's.
 */
export function freeAgents(moves, isEmea = () => false) {
  const last = new Map();
  const sorted = [...moves].sort((a, b) => a.date.localeCompare(b.date));
  for (const m of sorted) {
    for (const p of m.people) {
      const key = p.name.toLowerCase();
      const cc = p.cc || (last.get(key) && last.get(key).cc) || "";
      last.set(key, { ...m, name: p.name, cc });
    }
  }
  const out = [];
  for (const m of last.values()) {
    if (m.to || !m.from || /inactive/i.test(m.toRole) || OUTSIDE.test(m.fromRole)) continue;
    const land = m.cc.slice(0, 2);
    if (land ? !EMEA.has(land) : !isEmea(m.from)) continue;
    out.push({ name: m.name, cc: m.cc, date: m.date, from: m.from, role: m.fromRole, url: m.url, staff: STAFF.test(m.fromRole) });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
}

const slugOf = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * What changed for the people on the market since the last look: [{ kind: "free" | "signed", slug, name, team, key }].
 * prev and now: { slug: { name, from, date } }. Someone who left the list and joined a team since has signed; anyone else who left it says nothing.
 */
export function lftChanges(prev, now, moves) {
  const out = [];
  for (const [slug, p] of Object.entries(now)) {
    if (!prev[slug] || prev[slug].date !== p.date) out.push({ kind: "free", slug, name: p.name, team: p.from, key: `lft:${slug}:${p.date}` });
  }
  for (const [slug, p] of Object.entries(prev)) {
    if (now[slug]) continue;
    const joined = moves.filter((m) => m.to && m.people.some((x) => slugOf(x.name) === slug) && m.date >= p.date).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (joined) out.push({ kind: "signed", slug, name: p.name, team: joined.to, key: `lft:${slug}:in:${joined.date}` });
  }
  return out;
}

/** After a page read: the followed players' news. The first look only notes who is on the market. */
async function alertChanges(items, saveItem, now) {
  const titles = wantedTitles(items.index.titles, new Date(now)).filter((t) => items[t]);
  const moves = titles.flatMap((t) => items[t].moves);
  const current = Object.fromEntries(freeAgents(moves, () => true).map((p) => [slugOf(p.name), { name: p.name, from: p.from, date: p.date }]));
  const prev = items.alerts;
  saveItem("lft", "alerts", { at: new Date(now).toISOString(), people: current });
  if (!prev) return;
  const events = lftChanges(prev.people || {}, current, moves);
  if (!events.length) return;
  const { playerPushNow } = await import("./push.js");
  const { getDb } = await import("./db.js");
  await playerPushNow(getDb(), events);
}

/** One Liquipedia request at most, when the site's Liquipedia turn allows it: the list of pages once a day, else the stalest page. */
export async function lftIfDue(now = Date.now()) {
  const { readItems, saveItem, takeTurn } = await import("./lpstore.js");
  const { lpApi } = await import("./teamfetch.js");
  const items = readItems("lft");
  const index = items.index;
  const fresh = (entry, ms) => entry && now - new Date(entry.at).getTime() < ms;
  let job = null;
  if (!fresh(index, 24 * 3600000)) job = { kind: "index" };
  else {
    const titles = wantedTitles(index.titles, new Date(now));
    const current = titles.filter((t) => t.includes(`/${MONTHS[new Date(now).getUTCMonth()]}`));
    const stale = titles.filter((t) => !fresh(items[t], current.includes(t) ? 3 * 3600000 : 24 * 3600000));
    if (stale.length) job = { kind: "page", title: stale.sort((a, b) => ((items[a] && items[a].at) || "").localeCompare((items[b] && items[b].at) || ""))[0] };
  }
  if (!job || !takeTurn("lp", now)) return false;
  try {
    if (job.kind === "index") {
      const year = new Date(now).getUTCFullYear() - 1;
      const r = await lpApi({ action: "query", list: "allpages", apprefix: "Player Transfers/", apfrom: `Player Transfers/${year}`, aplimit: "200" });
      saveItem("lft", "index", { at: new Date(now).toISOString(), titles: ((r.query && r.query.allpages) || []).map((p) => p.title) });
    } else {
      const r = await lpApi({ action: "query", titles: job.title, prop: "revisions", rvprop: "content", rvslots: "main" });
      const page = Object.values((r.query && r.query.pages) || {})[0];
      const text = (page && page.revisions && page.revisions[0] && page.revisions[0].slots.main["*"]) || "";
      saveItem("lft", job.title, { at: new Date(now).toISOString(), moves: parseTransfers(text) });
      await alertChanges({ ...items, [job.title]: { at: new Date(now).toISOString(), moves: parseTransfers(text) } }, saveItem, now);
    }
    return true;
  } catch (e) {
    console.log(`[lft] ${e.message}`);
    const { noteProblem } = await import("./health.js");
    noteProblem("lft", e.message);
    return false;
  }
}

/** The free agents from what was read. */
export function readFreeAgents(items, isEmea, now = new Date()) {
  if (!items.index) return { list: [], at: "" };
  const titles = wantedTitles(items.index.titles, now).filter((t) => items[t]);
  const at = titles.map((t) => items[t].at).sort().pop() || "";
  return { list: freeAgents(titles.flatMap((t) => items[t].moves), isEmea), at, pages: titles.length };
}
