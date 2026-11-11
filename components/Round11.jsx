"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "./lang.jsx";
import { Crest } from "./Crest.jsx";
import { fanToken } from "./Fans.jsx";
import { useFavorites } from "./favorites.js";
import { EVENT_NAMES, teamSlug } from "../lib/paths.js";
import { allMatches } from "../lib/matchlist.js";
import { AgentIcon, AgentList, agentInfo } from "./Assets.jsx";

const safe = (f, d) => { try { return f(); } catch { return d; } };
const post = (url, body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

// ---- R19. one section header everywhere: icon, title, "see all"

export function SectionHead({ icon, title, href, more }) {
  const tr = useT();
  return <div className="sechead"><h2>{icon && <span className="secicon" aria-hidden="true">{icon}</span>}{title}</h2>{href && <a href={href}>{more || tr("See all")} ›</a>}</div>;
}

// ---- V8. an empty state with a drawing

export function EmptyState({ text, kind = "match" }) {
  return (
    <div className="empty">
      <svg viewBox="0 0 120 80" width="120" height="80" aria-hidden="true">
        {kind === "match" ? (
          <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><rect x="10" y="18" width="100" height="48" rx="8" /><path d="M60 18v48M35 42h.01M85 42h.01" /><circle cx="60" cy="42" r="10" /></g>
        ) : (
          <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><circle cx="52" cy="38" r="20" /><path d="M67 53l20 20" /></g>
        )}
      </svg>
      <p>{text}</p>
    </div>
  );
}

// ---- R20. the home page as a magazine: tiles

export function HomeBento({ initial }) {
  const tr = useT();
  const [now, setNow] = useState(0);
  useEffect(() => setNow(Date.now()), []);
  const all = useMemo(() => allMatches(initial), [initial]);
  const results = all.filter((m) => m.win && m.at && m.a && m.b).sort((x, y) => y.at.localeCompare(x.at)).slice(0, 4);
  const next = now ? all.filter((m) => m.a && m.b && m.a.name && m.b.name && m.sa == null && m.at && new Date(m.at).getTime() > now).sort((x, y) => x.at.localeCompare(y.at)).slice(0, 4) : [];
  const news = (initial.news || []).slice(0, 2);
  const time = (iso) => new Date(iso).toLocaleString(tr.lang === "en" ? "en-GB" : tr.lang, { weekday: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <div className="bento">
      <section className="bt bt-res">
        <SectionHead icon="✅" title={tr("Results")} href="/calendar" />
        {results.map((m) => <a key={m.event + m.id} href={`/match/${m.event}/${m.id}`} className="btrow"><Crest team={m.a} /><span>{m.a.name}</span><b className="spoil">{m.sa}–{m.sb}</b><span>{m.b.name}</span><Crest team={m.b} /></a>)}
        {!results.length && <EmptyState text={tr("No result yet.")} />}
      </section>
      <section className="bt bt-next">
        <SectionHead icon="⏰" title={tr("Coming up")} href="/calendar" />
        {next.map((m) => <a key={m.event + m.id} href={`/match/${m.event}/${m.id}`} className="btrow"><small>{time(m.at)}</small><span>{m.a.name}</span><b>vs</b><span>{m.b.name}</span></a>)}
        {!next.length && <EmptyState text={tr("No match planned.")} />}
      </section>
      <a className="bt bt-games" href="/jeux"><span className="btbig">🎮</span><b>{tr("Games of the day")}</b><small>{tr("Mystery player, higher or lower, mystery logo")}</small></a>
      <a className="bt bt-power" href="/puissance"><span className="btbig">⚡</span><b>{tr("Power ranking")}</b><small>{tr("The teams by strength")}</small></a>
      <a className="bt bt-fantasy" href="/fantasy"><span className="btbig">⭐</span><b>Fantasy</b><small>{tr("5 players, 100 credits")}</small></a>
      <section className="bt bt-news">
        <SectionHead icon="📰" title={tr("News")} href="/news" />
        {news.map((n) => <a key={n.id} href={`/news/${n.id}`} className="btnews"><b>{n.title}</b><small>{String(n.body || "").slice(0, 110)}{String(n.body || "").length > 110 ? "…" : ""}</small></a>)}
        {!news.length && <EmptyState kind="search" text={tr("No news yet.")} />}
      </section>
    </div>
  );
}

// ---- R21. the menu: folded to icons, your teams pinned

export const NAV_KEY = "vct-nav-mini";
export const NAV_SCRIPT = `try{if(localStorage.getItem("${NAV_KEY}")==="1")document.documentElement.dataset.nav="mini"}catch(e){}`;

export function NavFold() {
  const tr = useT();
  const [mini, setMini] = useState(false);
  useEffect(() => setMini(document.documentElement.dataset.nav === "mini"), []);
  const toggle = () => {
    const next = !mini;
    setMini(next);
    if (next) document.documentElement.dataset.nav = "mini"; else delete document.documentElement.dataset.nav;
    safe(() => (next ? localStorage.setItem(NAV_KEY, "1") : localStorage.removeItem(NAV_KEY)), null);
  };
  return <button type="button" className="navfold" onClick={toggle} aria-pressed={mini} title={mini ? tr("Unfold the menu") : tr("Fold the menu")}>{mini ? "»" : "«"}</button>;
}

export function PinnedTeams() {
  const tr = useT();
  const fav = useFavorites();
  const [live, setLive] = useState([]);
  useEffect(() => {
    if (!fav.list.length) return undefined;
    let on = true;
    const load = () => fetch("/api/livescores").then((r) => r.json()).then((j) => on && setLive(j.live || [])).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => { on = false; clearInterval(t); };
  }, [fav.list.length]);
  if (!fav.list.length) return null;
  return (
    <div className="pinned">
      <span className="navgroup">{tr("My teams")}</span>
      {fav.list.slice(0, 6).map((s) => {
        const l = live.find((x) => x.slugs.includes(s));
        return <a key={s} href={`/team/${s}`} className="pin"><span className="pindot">{l ? "●" : "★"}</span><span>{s.replace(/-/g, " ")}</span>{l && <b className="spoil">{l.sa}–{l.sb}</b>}</a>;
      })}
    </div>
  );
}

// ---- V7. a banner on every page while one of your teams plays

export function LiveTeamBanner() {
  const tr = useT();
  const fav = useFavorites();
  const [live, setLive] = useState([]);
  const [closed, setClosed] = useState("");
  useEffect(() => {
    if (!fav.list.length) return undefined;
    let on = true;
    const load = () => fetch("/api/livescores").then((r) => r.json()).then((j) => on && setLive((j.live || []).filter((m) => m.slugs.some((s) => fav.list.includes(s))))).catch(() => {});
    load();
    const t = setInterval(load, 45000);
    return () => { on = false; clearInterval(t); };
  }, [fav.list.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = live.find((x) => `${x.event}:${x.id}` !== closed);
  if (!m) return null;
  return (
    <div className="liveteam" role="status">
      <i className="livedot" aria-hidden="true" />
      <a href={`/match/${m.event}/${m.id}`}><b>{m.a} <span className="spoil">{m.sa}–{m.sb}</span> {m.b}</b>{m.map ? <small className="spoil"> · {m.map.map} {m.map.a}–{m.map.b}</small> : null} · {tr("Watch")} ›</a>
      <button type="button" aria-label={tr("Close")} onClick={() => setClosed(`${m.event}:${m.id}`)}>×</button>
    </div>
  );
}

// ---- R27. the first visit: teams, language, alerts

const WELCOME = "vct-welcomed";

export function Welcome({ teams }) {
  const tr = useT();
  const fav = useFavorites();
  const [step, setStep] = useState(-1);
  useEffect(() => {
    const seen = safe(() => localStorage.getItem(WELCOME), "1");
    const path = window.location.pathname;
    if (!seen && !path.startsWith("/admin") && !path.startsWith("/embed") && !path.startsWith("/overlay")) setStep(0);
  }, []);
  if (step < 0) return null;
  const done = () => { safe(() => localStorage.setItem(WELCOME, "1"), null); setStep(-1); };
  const setLang = (l) => { document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`; window.location.reload(); };
  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-label={tr("Welcome")}>
      <div className="wbox">
        <div className="wsteps">{[0, 1, 2].map((i) => <i key={i} className={i <= step ? "on" : ""} />)}</div>
        {step === 0 && (
          <>
            <h2>{tr("Welcome to VCT EMEA")}</h2>
            <p>{tr("Results, brackets and games around the VCT EMEA. Two quick steps to make it yours.")}</p>
            <div className="wlangs">{[["fr", "Français"], ["en", "English"], ["tr", "Türkçe"], ["ar", "العربية"]].map(([k, l]) => <button key={k} type="button" className={"btn" + (tr.lang === k ? " pri" : "")} onClick={() => (tr.lang === k ? setStep(1) : setLang(k))}>{l}</button>)}</div>
            <p className="row"><button type="button" className="btn pri" onClick={() => setStep(1)}>{tr("Next")} ›</button> <button type="button" className="btn" onClick={done}>{tr("Skip")}</button></p>
          </>
        )}
        {step === 1 && (
          <>
            <h2>{tr("Your teams")}</h2>
            <p>{tr("Pick the teams you follow: their matches come first, with a banner while they play.")}</p>
            <div className="wteams">{teams.map((t) => { const s = teamSlug(t.name); const on = fav.has(s); return <button key={s} type="button" className={"wteam" + (on ? " on" : "")} aria-pressed={on} onClick={() => fav.toggle(s)}><Crest team={t} /><span>{t.name}</span></button>; })}</div>
            <p className="row"><button type="button" className="btn pri" onClick={() => setStep(2)}>{tr("Next")} ›</button></p>
          </>
        )}
        {step === 2 && (
          <>
            <h2>{tr("Stay in the loop")}</h2>
            <p>{tr("Turn on the alerts on your teams' pages (🔔), play the games of the day and predict the matches. Have fun!")}</p>
            <p className="row"><a className="btn" href="/jeux" onClick={done}>🎮 {tr("Games of the day")}</a> <a className="btn" href="/predictions" onClick={done}>🔮 {tr("Predictions")}</a> <button type="button" className="btn pri" onClick={done}>{tr("Let's go")}</button></p>
          </>
        )}
      </div>
    </div>
  );
}

// ---- R22. an event, day by day

export function EventFeed({ feed, event }) {
  const tr = useT();
  const [all, setAll] = useState(false);
  if (!feed.length) return null;
  const days = all ? feed : feed.slice(0, 3);
  const fmt = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString(tr.lang === "en" ? "en-GB" : tr.lang, { weekday: "long", day: "numeric", month: "long" });
  return (
    <section className="evfeed">
      <SectionHead icon="🗞️" title={tr("Day by day")} />
      {days.map((d) => (
        <div key={d.day} className="efday">
          <h3 className="sub">{fmt(d.day)} <small>({d.items.length})</small></h3>
          <div className="efitems">{d.items.slice(0, 16).map((x) => <a key={x.id} href={`/match/${event}/${x.id}`} className="efitem"><span className={x.winner === x.a ? "w" : ""}>{x.a}</span><b className="spoil">{x.sa}–{x.sb}</b><span className={x.winner === x.b ? "w" : ""}>{x.b}</span>{x.upset && <em>{tr("upset")}</em>}</a>)}{d.items.length > 16 && <small className="hint">+{d.items.length - 16}</small>}</div>
        </div>
      ))}
      {feed.length > 3 && <p><button type="button" className="btn" onClick={() => setAll(!all)}>{all ? tr("Show less") : tr("All the days ({n})", { n: feed.length })}</button></p>}
    </section>
  );
}

// ---- R23. the player's header: colours, tiles, agents, last matches, close profiles

export function PlayerHero({ p }) {
  const tr = useT();
  const t = p.tour;
  if (!t) return null;
  const agents = (t.agents || []).slice(0, 4);
  const total = agents.reduce((s, a) => s + a.n, 0) || 1;
  const COLORS = ["#ff4655", "#c8f03c", "#5aa9ff", "#f2a63b"];
  let acc = 0;
  const arcs = agents.map((a, i) => { const start = acc; acc += a.n / total; return { a, i, start, end: acc }; });
  const r2 = (v) => Math.round(v * 100) / 100;
  const arc = (s, e) => { const p0 = [r2(50 + 40 * Math.sin(2 * Math.PI * s)), r2(50 - 40 * Math.cos(2 * Math.PI * s))]; const p1 = [r2(50 + 40 * Math.sin(2 * Math.PI * e)), r2(50 - 40 * Math.cos(2 * Math.PI * e))]; return `M ${p0[0]} ${p0[1]} A 40 40 0 ${e - s > 0.5 ? 1 : 0} 1 ${p1[0]} ${p1[1]}`; };
  const recent = (t.matches || []).slice(0, 5);
  return (
    <div className="phero">
      <div className="phtiles">
        {[["Rating", t.r != null ? t.r.toFixed(2) : "–"], ["ACS", t.acs ?? "–"], ["K/D", t.kd != null ? Number(t.kd).toFixed(2) : "–"], ["KAST", t.kast != null ? `${t.kast}%` : "–"], ["ADR", t.adr ?? "–"], [tr("Maps"), t.maps]].map(([k, v]) => <div key={k}><b>{v}</b><span>{k}</span></div>)}
      </div>
      <div className="phrow">
        {agents.length > 0 && (
          <figure className="phdonut">
            <svg viewBox="0 0 100 100" width="120" height="120" role="img" aria-label={tr("Agents played")}>
              {arcs.length === 1 ? <circle cx="50" cy="50" r="40" fill="none" stroke={COLORS[0]} strokeWidth="14" /> : arcs.map(({ i, start, end }) => <path key={i} d={arc(start, end - 0.004)} fill="none" stroke={COLORS[i]} strokeWidth="14" />)}
            </svg>
            <figcaption>{agents.map((a, i) => <span key={a.name}><i style={{ background: COLORS[i] }} /><AgentIcon name={a.name} size={22} /> {a.name.charAt(0).toUpperCase() + a.name.slice(1)} · {a.n}</span>)}</figcaption>
          </figure>
        )}
        {recent.length > 0 && (
          <div className="phrecent">
            <h3 className="sub">{tr("Last matches")}</h3>
            {recent.map((g) => <a key={g.event + g.id} href={`/match/${g.event}/${g.id}`} className={"phm " + (g.won ? "w" : "l")}><span>{g.won ? tr("W") : tr("L")}</span><span>vs {g.opponent}</span><b>{g.r != null ? g.r.toFixed(2) : "–"}</b><small>{g.acs ?? "–"} ACS</small>{g.agents && g.agents[0] ? <AgentList list={g.agents.slice(0, 1)} size={18} /> : null}</a>)}
          </div>
        )}
      </div>
      {(p.similar || []).length > 0 && (
        <div className="phsim">
          <h3 className="sub">{tr("Close profiles")}</h3>
          <div className="phsimrow">{p.similar.map((s) => <a key={s.slug} href={`/player/${s.slug}`}><b>{s.name}</b><small>{s.team}</small><span>{s.score}%</span></a>)}</div>
        </div>
      )}
    </div>
  );
}

// ---- R24. the roster as player cards

export function RosterCards({ list }) {
  const tr = useT();
  if (!list || !list.length) return null;
  return (
    <section>
      <SectionHead icon="👥" title={tr("The players")} />
      <div className="rcards">{list.sort((a, b) => (b.r || 0) - (a.r || 0)).map((p) => (
        <a key={p.slug} href={`/player/${p.slug}`} className={"rcard" + (agentInfo(p.agent) ? " withagent" : "")} style={agentInfo(p.agent) ? { "--agc": agentInfo(p.agent).color, "--agimg": `url(${agentInfo(p.agent).portrait})` } : undefined}>
          <span className="rcav" aria-hidden="true">{p.name.charAt(0).toUpperCase()}</span>
          <b>{p.name}</b>
          {p.agent ? <span className="rcagent">{agentInfo(p.agent) ? agentInfo(p.agent).name : p.agent}</span> : null}
          <div className="rcnums"><span><b>{p.r != null ? p.r.toFixed(2) : "–"}</b>R</span><span><b>{p.acs ?? "–"}</b>ACS</span><span><b>{p.kd != null ? Number(p.kd).toFixed(2) : "–"}</b>K/D</span></div>
        </a>
      ))}</div>
    </section>
  );
}

// ---- A13. before a match

export function MatchPreview({ event, id, a, b }) {
  const tr = useT();
  const [d, setD] = useState(null);
  useEffect(() => { fetch(`/api/preview?event=${event}&id=${encodeURIComponent(id)}`).then((r) => (r.ok ? r.json() : null)).then(setD).catch(() => {}); }, [event, id]);
  if (!d) return null;
  const pct = d.picks.total ? Math.round((d.picks.a / d.picks.total) * 100) : null;
  const form = (f) => <span className="pvform">{f.form.map((x, i) => <i key={i} className={x}>{x === "w" ? tr("W") : tr("L")}</i>)}</span>;
  return (
    <section className="preview">
      <SectionHead icon="🔍" title={tr("Before the match")} />
      <div className="pvgrid">
        <div><small>{tr("Form")}</small><b>{a}</b>{form(d.a)}<span className="hint">{d.a.w}V – {d.a.l}D</span></div>
        <div><small>{tr("Form")}</small><b>{b}</b>{form(d.b)}<span className="hint">{d.b.w}V – {d.b.l}D</span></div>
        <div><small>{tr("Head to head")}</small><b>{d.h2h.a} – {d.h2h.b}</b>{d.h2h.last && <a className="hint" href={`/match/${d.h2h.last.event}/${d.h2h.last.id}`}>{tr("last")} : <span className="spoil">{d.h2h.last.a} {d.h2h.last.sa}–{d.h2h.last.sb} {d.h2h.last.b}</span></a>}</div>
        <div><small>{tr("Predictions")}</small>{pct == null ? <b>–</b> : <><b>{pct}% {a}</b><span className="pvsplit"><i style={{ width: `${pct}%` }} /></span><span className="hint">{d.picks.total} {tr("votes")}</span></>}</div>
      </div>
      {(d.keys.a.length > 0 || d.keys.b.length > 0) && (
        <p className="pvkeys">⭐ {tr("Key players")} : {[...d.keys.a, ...d.keys.b].map((k, i) => <a key={k.slug} href={`/player/${k.slug}`}>{i ? " · " : ""}{k.name} ({k.r.toFixed(2)})</a>)}</p>
      )}
    </section>
  );
}

// ---- A11. "My space": all that concerns the visitor

export function MySpace({ upcoming, open }) {
  const tr = useT();
  const fav = useFavorites();
  const [me, setMe] = useState(null);
  const [games, setGames] = useState(null);
  const [fantasy, setFantasy] = useState(null);
  useEffect(() => {
    const token = safe(() => localStorage.getItem("vct-predictions") || "", "");
    if (!token) { setMe({ picks: {} }); return; }
    post("/api/predictions/me", { token }).then((j) => setMe(j || { picks: {} }));
    post("/api/jeux", { token, mine: true }).then(setGames);
    post("/api/fantasy", { token }).then((j) => setFantasy(j && j.team));
  }, []);
  const mine = upcoming.filter((m) => fav.has(teamSlug(m.a.name)) || fav.has(teamSlug(m.b.name))).slice(0, 5);
  const pending = me ? open.filter((m) => !me.picks[`${m.event}:${m.id}`]) : [];
  const played = games ? Object.values(games.today || {}).filter((x) => x.done).length : 0;
  const time = (iso) => new Date(iso).toLocaleString(tr.lang === "en" ? "en-GB" : tr.lang, { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  return (
    <div className="myspace">
      <section className="msbox">
        <SectionHead icon="⭐" title={tr("Your teams' next matches")} href="/calendar" />
        {mine.length ? mine.map((m) => <a key={m.event + m.id} href={`/match/${m.event}/${m.id}`} className="btrow"><small>{time(m.at)}</small><span>{m.a.name}</span><b>vs</b><span>{m.b.name}</span></a>) : <p className="hint">{fav.list.length ? tr("No match planned.") : tr("Follow teams (★) to see their matches here.")}</p>}
      </section>
      <a className="msbox mstile" href="/predictions"><span className="btbig">🔮</span><b>{me ? pending.length : "…"}</b><small>{tr("predictions waiting for you")}</small></a>
      <a className="msbox mstile" href="/jeux"><span className="btbig">🎮</span><b>{games ? `${played}/3` : "…"}</b><small>{tr("games of the day played")}{games && games.streak ? ` · 🔥 ${games.streak}` : ""}</small></a>
      <a className="msbox mstile" href="/fantasy"><span className="btbig">⭐</span><b>{fantasy ? `${fantasy.week} pts` : "–"}</b><small>{fantasy ? tr("fantasy this week") : tr("no fantasy team yet")}</small></a>
    </div>
  );
}

// ---- E5, E6, E7. the editor: key numbers, a search box, the live activity

export function EditorKpis({ initial }) {
  const tr = useT();
  const a = initial.admin || {};
  const board = a.dayBoard || [];
  const v = a.visits || { today: 0 };
  const act = a.activity || [];
  const today = act.length ? act[act.length - 1] : { votes: 0, maps: 0, quiz: 0, comments: 0 };
  const tiles = [
    ["📅", board.length, tr("matches today")],
    ["⚠️", board.filter((m) => m.missing.length).length, tr("to complete")],
    ["🔴", allMatches(initial).filter((m) => m.live).length, tr("live now")],
    ["👀", v.today, tr("page views today")],
    ["🗳️", today.votes + today.maps + today.quiz, tr("votes and games today")],
  ];
  return <div className="kpis">{tiles.map(([i, n, l]) => <div key={l} className={"kpi" + (l === tr("to complete") && n ? " warn" : "")}><span>{i}</span><b>{n}</b><small>{l}</small></div>)}</div>;
}

export function EditorSearch({ initial, onOpen }) {
  const tr = useT();
  const [q, setQ] = useState("");
  const items = useMemo(() => {
    const out = [];
    const seen = new Set();
    for (const m of allMatches(initial)) {
      for (const t of [m.a, m.b]) if (t && t.name && !seen.has(`${m.event}|${t.name}`)) { seen.add(`${m.event}|${t.name}`); out.push({ kind: "team", label: t.name, event: m.event }); }
      if (m.a && m.b && m.a.name && m.b.name) out.push({ kind: "match", label: `${m.a.name} vs ${m.b.name}`, event: m.event });
    }
    return out;
  }, [initial]);
  const k = q.trim().toLowerCase();
  const hits = k.length >= 2 ? items.filter((x) => x.label.toLowerCase().includes(k)).slice(0, 12) : [];
  return (
    <div className="edsearch">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Find a team or a match to edit… (/)")} aria-label={tr("Search")} />
      {hits.length > 0 && <ul>{hits.map((h, i) => <li key={i}><button type="button" onClick={() => { onOpen(h.event, true); setQ(""); }}><span>{h.kind === "team" ? "👥" : "⚔️"} {h.label}</span><small>{tr(EVENT_NAMES[h.event] || h.event)}</small></button></li>)}</ul>}
    </div>
  );
}

export function ActivityFeed() {
  const tr = useT();
  const [items, setItems] = useState([]);
  useEffect(() => {
    let on = true;
    const load = () => fetch("/api/activity").then((r) => (r.ok ? r.json() : { items: [] })).then((j) => on && setItems(j.items || [])).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => { on = false; clearInterval(t); };
  }, []);
  if (!items.length) return null;
  const ago = (iso) => { const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 1 ? tr("now") : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} j`; };
  return (
    <section>
      <details className="einfo" open>
        <summary><b>🛰️ {tr("Live activity")}</b> <small>{tr("refreshed every 30 s")}</small></summary>
        <ul className="activity">{items.slice(0, 15).map((h, i) => <li key={i}><time>{ago(h.at)}</time><b>{h.who || tr("Main account")}</b><span>{h.message}</span></li>)}</ul>
      </details>
    </section>
  );
}
