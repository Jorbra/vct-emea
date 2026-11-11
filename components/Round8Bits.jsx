"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "./lang.jsx";
import { fanToken } from "./Fans.jsx";
import { readFavorites } from "./favorites.js";
import { Crest } from "./Crest.jsx";

const safe = (f, d) => { try { return f(); } catch { return d; } };
const getJson = (k, d) => safe(() => JSON.parse(localStorage.getItem(k) || "null") ?? d, d);
const setJson = (k, v) => safe(() => localStorage.setItem(k, JSON.stringify(v)), null);
const slug = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ---- 6. the site's poll, on the home page

export function HomePoll() {
  const tr = useT();
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    fetch("/api/poll", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: fanToken() }) }).then((r) => r.json()).then(setD).catch(() => {});
  }, []);
  if (!d || !d.poll) return null;
  const p = d.poll;
  const vote = async (i) => {
    setErr("");
    const r = await fetch("/api/poll", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: fanToken(), id: p.id, choice: i }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setErr(tr.server(j.error || "")); else setD(j);
  };
  const voted = d.mine != null;
  return (
    <section className="homepoll">
      <h2>📊 {p.question}</h2>
      <div className="pollopts">
        {p.options.map((o, i) => {
          const pct = p.total ? Math.round((p.counts[i] / p.total) * 100) : 0;
          return (
            <button key={i} type="button" className={"pollopt" + (d.mine === i ? " on" : "")} onClick={() => vote(i)} aria-pressed={d.mine === i}>
              {voted && <i style={{ width: `${pct}%` }} aria-hidden="true" />}
              <span>{o}</span>{voted && <b>{pct}%</b>}
            </button>
          );
        })}
      </div>
      <p className="hint">{voted ? tr("{n} votes · you can change your vote while the poll is open.", { n: p.total }) : tr("Vote to see the results.")}</p>
      {err && <p className="err" role="alert">{err}</p>}
    </section>
  );
}

// ---- 4. the notifications: your teams' matches, your predictions' results, the games of the day

const SEEN = "vct-notif-seen";
const OPENED = "vct-notif-opened";

export function NotificationBell() {
  const tr = useT();
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(0);
  const box = useRef(null);
  useEffect(() => {
    let on = true;
    const load = async () => {
      const favs = readFavorites();
      const [now, me] = await Promise.all([
        fetch("/api/now").then((r) => (r.ok ? r.json() : { items: [] })).catch(() => ({ items: [] })),
        fetch("/api/predictions/me", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: safe(() => localStorage.getItem("vct-predictions") || "", "") }) }).then((r) => (r.ok ? r.json() : { picks: {} })).catch(() => ({ picks: {} })),
      ]);
      if (!on) return;
      const seen = getJson(SEEN, null);
      const first = seen == null;
      const stamps = seen || {};
      const t = Date.now();
      const out = [];
      for (const a of now.items || []) {
        const key = a.url.replace("/match/", "").replace("/", ":");
        const pick = (me.picks || {})[key];
        const mine = (a.teams || []).some((s) => favs.includes(s));
        if (a.kind === "result" && pick) {
          const winner = a.sa > a.sb ? a.a : a.b;
          out.push({ key: `p:${a.key}`, icon: pick === winner ? "✅" : "❌", text: pick === winner ? tr("Your pick {team} was right (+1)", { team: pick }) : tr("Your pick {team} was wrong", { team: pick }), url: a.url });
        } else if (mine && a.kind === "live") out.push({ key: a.key, icon: "🔴", text: tr("{a} vs {b} is live", { a: a.a, b: a.b }), url: a.url });
        else if (mine && a.kind === "result") out.push({ key: a.key, icon: "🏁", text: `${a.a} ${a.sa}–${a.sb} ${a.b}`, url: a.url, spoil: true });
      }
      const day = new Date().toISOString().slice(0, 10);
      out.push({ key: `games:${day}`, icon: "🎮", text: tr("Today's games are up"), url: "/jeux" });
      for (const x of out) if (!stamps[x.key]) stamps[x.key] = first ? 1 : t;
      // only what was seen in the last 30 days stays
      for (const k of Object.keys(stamps)) if (stamps[k] > 1 && t - stamps[k] > 30 * 86400000) delete stamps[k];
      setJson(SEEN, stamps);
      setList(out.map((x) => ({ ...x, at: stamps[x.key] })).sort((a, b) => b.at - a.at).slice(0, 25));
    };
    setOpened(Number(safe(() => localStorage.getItem(OPENED), 0)) || 0);
    load();
    const id = setInterval(load, 120000);
    return () => { on = false; clearInterval(id); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);
  const unread = list.filter((x) => x.at > opened).length;
  const toggle = () => {
    setOpen(!open);
    if (!open) { const t = Date.now(); setOpened(t); safe(() => localStorage.setItem(OPENED, String(t)), null); }
  };
  const ago = (at) => { if (at <= 1) return ""; const m = Math.round((Date.now() - at) / 60000); return m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} j`; };
  return (
    <div className="navbell" ref={box}>
      <button type="button" className="navspoil" onClick={toggle} aria-expanded={open} aria-label={tr("Notifications")}>
        <svg className="navicon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0" /></svg>
        <span>{tr("Notifications")}</span>
        {unread > 0 && <b className="navlive">{unread > 9 ? "9+" : unread}</b>}
      </button>
      {open && (
        <div className="bellpanel" role="dialog" aria-label={tr("Notifications")}>
          {list.length === 0 ? <p className="hint">{tr("Follow teams (★) and make predictions to get news here.")}</p> : (
            <ul>{list.map((x) => <li key={x.key} className={x.at > opened ? "new" : ""}><a href={x.url}><span>{x.icon}</span><span className={x.spoil ? "spoil" : ""}>{x.text}</span><small>{ago(x.at)}</small></a></li>)}</ul>
          )}
        </div>
      )}
    </div>
  );
}

// ---- R5. the command bar: Ctrl+K (or "/") to go anywhere

const PAGES = [
  ["/", "Home"], ["/live", "Live"], ["/soiree", "Match night"], ["/calendar", "Calendar"], ["/predictions", "Predictions"], ["/jeux", "Games of the day"],
  ["/quiz", "Quiz of the week"], ["/fantasy", "Fantasy"], ["/tierlist", "Tier list"], ["/simulateur", "Qualification simulator"], ["/puissance", "Power ranking"],
  ["/stats", "Stats"], ["/rivalites", "Rivalries"], ["/palmares", "Hall of fame"], ["/pays", "Countries"], ["/compare", "Compare"], ["/transfers", "Transfers"],
  ["/lft", "LFT"], ["/news", "News"], ["/archives", "Archives of past seasons"], ["/moi", "My week"], ["/compte", "My account"],
];

export function CommandPalette() {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [found, setFound] = useState(null);
  const [i, setI] = useState(0);
  const input = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || "") || (e.target && e.target.isContentEditable);
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) { e.preventDefault(); setOpen(true); }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("vct-palette", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("vct-palette", onOpen); };
  }, []);
  useEffect(() => { if (open) { setQ(""); setI(0); setTimeout(() => input.current && input.current.focus(), 10); } }, [open]);
  useEffect(() => {
    if (q.trim().length < 2) { setFound(null); return undefined; }
    const c = new AbortController();
    const t = setTimeout(() => fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: c.signal }).then((r) => r.json()).then(setFound).catch(() => {}), 150);
    return () => { clearTimeout(t); c.abort(); };
  }, [q]);
  const items = useMemo(() => {
    const k = slug(q);
    const pages = PAGES.filter(([href, label]) => !k || slug(tr(label)).includes(k) || href.includes(k)).map(([href, label]) => ({ href, label: tr(label), kind: tr("Page") }));
    const more = found ? [
      ...(found.teams || []).slice(0, 5).map((x) => ({ href: x.href || x.url, label: x.name || x.label, kind: tr("Team") })),
      ...(found.players || []).slice(0, 5).map((x) => ({ href: x.href || x.url, label: x.name || x.label, kind: tr("Player") })),
      ...(found.events || []).slice(0, 4).map((x) => ({ href: x.href || x.url, label: x.name || x.label, kind: tr("Event") })),
    ].filter((x) => x.href && x.label) : [];
    return [...more, ...pages].slice(0, 14);
  }, [q, found, tr]);
  if (!open) return null;
  const go = (x) => { if (x) window.location.href = x.href; };
  return (
    <div className="cmdback" onClick={() => setOpen(false)}>
      <div className="cmdbox" role="dialog" aria-modal="true" aria-label={tr("Go to")} onClick={(e) => e.stopPropagation()}>
        <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setI(0); }} placeholder={tr("Go to… a page, a team, a player")} aria-label={tr("Go to")}
          onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(items.length - 1, x + 1)); } if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(0, x - 1)); } if (e.key === "Enter") go(items[i]); }} />
        <ul>{items.map((x, k) => <li key={x.href + k}><a href={x.href} className={k === i ? "on" : ""} onMouseEnter={() => setI(k)}><span>{x.label}</span><small>{x.kind}</small></a></li>)}</ul>
        <p className="hint">↑↓ · Entrée · Échap · {tr("Ctrl+K or / from any page")}</p>
      </div>
    </div>
  );
}

// ---- R4. the brackets: a team's path lit up, and zoom

export function BracketTools() {
  const tr = useT();
  const [team, setTeam] = useState("");
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const onClick = (e) => {
      const el = e.target instanceof Element ? e.target.closest(".mrow .tn, .bgrid .tn, .qbracket .tn") : null;
      if (!el) return;
      const name = el.textContent.trim();
      if (!name || name === "TBD") return;
      setTeam((cur) => (cur === name ? "" : name));
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  useEffect(() => {
    document.querySelectorAll(".hlpath").forEach((x) => x.classList.remove("hlpath"));
    document.querySelectorAll(".hlteam").forEach((x) => x.classList.remove("hlteam"));
    if (!team) return;
    document.querySelectorAll(".mrow .tn, .bgrid .tn, .qbracket .tn").forEach((tn) => {
      if (tn.textContent.trim() !== team) return;
      tn.classList.add("hlteam");
      const row = tn.closest(".mrow, .bmatch, .qm");
      if (row) row.classList.add("hlpath");
    });
  }, [team]);
  useEffect(() => { document.documentElement.style.setProperty("--bzoom", String(zoom)); }, [zoom]);
  return (
    <div className="btools">
      <span>{team ? <>{tr("Path of")} <b>{team}</b> <button type="button" className="btn small" onClick={() => setTeam("")}>×</button></> : tr("Click a team to light up its path")}</span>
      <span className="bzoom"><button type="button" className="btn small" aria-label={tr("Zoom out")} onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}>−</button><b>{Math.round(zoom * 100)}%</b><button type="button" className="btn small" aria-label={tr("Zoom in")} onClick={() => setZoom((z) => Math.min(1.5, Math.round((z + 0.1) * 10) / 10))}>+</button></span>
    </div>
  );
}

// ---- R1. the home page, arranged by the visitor

export const HOME_BLOCKS = [["today", "Today (phones)"], ["live", "Featured match and next matches"], ["strips", "Today's matches"], ["poll", "Poll"], ["qualified", "Qualified teams"], ["hero", "Road to the Kickoff"], ["myteams", "My teams"], ["news", "News"], ["kickoff", "Kickoff teams"], ["events", "Events"], ["road", "Road to the Kickoff (steps)"], ["gc", "Game Changers"]];
const HOME_KEY = "vct-home-layout";

export function HomeCustomize() {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const [lay, setLay] = useState(null);
  useEffect(() => { const l = getJson(HOME_KEY, null); setLay(l && Array.isArray(l.order) ? l : { order: HOME_BLOCKS.map(([k]) => k), hidden: [] }); }, []);
  const css = useMemo(() => (lay ? lay.order.map((k, i) => `.home [data-block="${k}"]{order:${i + 1}}`).join("") + lay.hidden.map((k) => `.home [data-block="${k}"]{display:none}`).join("") : ""), [lay]);
  if (!lay) return null;
  const save = (l) => { setLay(l); setJson(HOME_KEY, l); };
  const move = (k, d) => { const o = [...lay.order]; const i = o.indexOf(k); const j = i + d; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; save({ ...lay, order: o }); };
  const hide = (k) => save({ ...lay, hidden: lay.hidden.includes(k) ? lay.hidden.filter((x) => x !== k) : [...lay.hidden, k] });
  const label = Object.fromEntries(HOME_BLOCKS);
  return (
    <>
      <style>{css}</style>
      <div className="homecust" data-block="cust">
        <button type="button" className="btn small" onClick={() => setOpen(!open)} aria-expanded={open}>⚙️ {tr("Arrange my home page")}</button>
        {open && (
          <div className="custpanel">
            <ol>{lay.order.map((k, i) => (
              <li key={k} className={lay.hidden.includes(k) ? "off" : ""}>
                <span>{tr(label[k] || k)}</span>
                <button type="button" className="btn small" disabled={i === 0} aria-label={tr("Up")} onClick={() => move(k, -1)}>↑</button>
                <button type="button" className="btn small" disabled={i === lay.order.length - 1} aria-label={tr("Down")} onClick={() => move(k, 1)}>↓</button>
                <button type="button" className="btn small" onClick={() => hide(k)}>{lay.hidden.includes(k) ? tr("Show") : tr("Hide")}</button>
              </li>
            ))}</ol>
            <p className="row"><button type="button" className="btn small" onClick={() => save({ order: HOME_BLOCKS.map(([k]) => k), hidden: [] })}>{tr("Back to the default")}</button></p>
          </div>
        )}
      </div>
    </>
  );
}

// ---- R3. a player's radar

export function PlayerRadar({ stats, ranges }) {
  const tr = useT();
  const axes = [["r", "Rating"], ["acs", "ACS"], ["kd", "K/D"], ["kast", "KAST"], ["adr", "ADR"], ["hs", "HS%"]].filter(([k]) => stats[k] != null && ranges[k]);
  if (axes.length < 3) return null;
  const size = 220;
  const c = size / 2;
  const R = 80;
  const pt = (i, v) => { const a = (Math.PI * 2 * i) / axes.length - Math.PI / 2; return [c + Math.cos(a) * R * v, c + Math.sin(a) * R * v]; };
  const norm = (k) => { const [lo, hi] = ranges[k]; return Math.max(0.05, Math.min(1, (stats[k] - lo) / Math.max(0.0001, hi - lo))); };
  const poly = axes.map(([k], i) => pt(i, norm(k)).join(",")).join(" ");
  return (
    <figure className="radar">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={tr("The player's numbers against the site's best")}>
        {[0.25, 0.5, 0.75, 1].map((s) => <polygon key={s} points={axes.map((_, i) => pt(i, s).join(",")).join(" ")} className="rgrid" />)}
        {axes.map((_, i) => { const [x, y] = pt(i, 1); return <line key={i} x1={c} y1={c} x2={x} y2={y} className="rgrid" />; })}
        <polygon points={poly} className="rshape" />
        {axes.map(([k, label], i) => { const [x, y] = pt(i, 1.22); return <text key={k} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="rlabel">{label}</text>; })}
      </svg>
      <figcaption className="hint">{tr("Against the players of the site's events (4 maps at least)")}</figcaption>
    </figure>
  );
}

// ---- R2. a team's season as a line of results

export function TeamTimeline({ rows, name }) {
  const tr = useT();
  const done = rows.filter((m) => m.win && m.at).sort((a, b) => a.at.localeCompare(b.at));
  if (done.length < 2) return null;
  const t0 = new Date(done[0].at).getTime();
  const t1 = new Date(done[done.length - 1].at).getTime();
  const span = Math.max(1, t1 - t0);
  const mine = (m) => (m.a && m.a.name === name ? "a" : "b");
  return (
    <div className="tline" aria-label={tr("The season, match by match")}>
      <div className="tlbar">
        {done.map((m) => {
          const won = m.win === mine(m);
          const opp = mine(m) === "a" ? m.b : m.a;
          return <a key={m.event + m.id} href={`/match/${m.event}/${m.id}`} className={"tldot spoil " + (won ? "w" : "l")} style={{ left: `${((new Date(m.at).getTime() - t0) / span) * 100}%` }} title={`${won ? tr("W") : tr("L")} · ${opp ? opp.name : "?"} ${m.sa}–${m.sb}`} />;
        })}
      </div>
      <div className="tlends"><small>{new Date(t0).toLocaleDateString(tr.lang === "en" ? "en-GB" : tr.lang, { day: "numeric", month: "short" })}</small><small>{new Date(t1).toLocaleDateString(tr.lang === "en" ? "en-GB" : tr.lang, { day: "numeric", month: "short" })}</small></div>
    </div>
  );
}

// ---- R6. predictions as cards to swipe (phones)

export function SwipePicks({ matches, picks, onPick }) {
  const tr = useT();
  const left = matches.filter((m) => !picks[`${m.event}:${m.id}`]);
  const [dx, setDx] = useState(0);
  const start = useRef(null);
  const m = left[0];
  if (!m) return <p className="note swipedone">✅ {tr("Every open match is predicted.")}</p>;
  const end = () => { if (dx < -80) onPick(m, m.a.name); else if (dx > 80) onPick(m, m.b.name); setDx(0); start.current = null; };
  return (
    <div className="swipe">
      <p className="hint">{tr("Swipe left for {a}, right for {b}", { a: m.a.name, b: m.b.name })} · {tr("{n} left", { n: left.length })}</p>
      <div className="swipecard" style={{ transform: `translateX(${dx}px) rotate(${dx / 20}deg)` }}
        onPointerDown={(e) => { start.current = e.clientX; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (start.current != null) setDx(e.clientX - start.current); }}
        onPointerUp={end} onPointerCancel={() => { setDx(0); start.current = null; }}>
        <span className={"swl" + (dx < -40 ? " on" : "")}>{m.a.name}</span>
        <span className={"swr" + (dx > 40 ? " on" : "")}>{m.b.name}</span>
        <div className="swteams"><div><Crest team={m.a} /><b>{m.a.name}</b></div><span>vs</span><div><Crest team={m.b} /><b>{m.b.name}</b></div></div>
      </div>
      <div className="swbtns"><button type="button" className="btn" onClick={() => onPick(m, m.a.name)}>← {m.a.name}</button><button type="button" className="btn" onClick={() => onPick(m, m.b.name)}>{m.b.name} →</button></div>
    </div>
  );
}
