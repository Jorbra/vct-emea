"use client";

// Round 17, during the matches: the map being played round by round, its tense moments, the site-wide alert when a match
// gets tense, and the second screen.
import { useEffect, useState } from "react";
import { useT } from "./lang.jsx";

/** The map being played, round by round: who leads and by how much, from vlr.gg's reads. */
export function RoundChart({ rounds, a = "A", b = "B" }) {
  const tr = useT();
  const list = (rounds || []);
  const map = list.length ? list[list.length - 1].map : "";
  const pts = list.filter((x) => x.map === map);
  if (pts.length < 2) return null;
  const diffs = [0, ...pts.map((p) => p.a - p.b)];
  const max = Math.max(3, ...diffs.map((d) => Math.abs(d)));
  const W = 300;
  const H = 80;
  const x = (i) => Math.round((i / (diffs.length - 1)) * W * 100) / 100;
  const y = (d) => Math.round((H / 2 - (d / max) * (H / 2 - 6)) * 100) / 100;
  const path = diffs.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <figure className="roundchart" aria-label={tr("{map} round by round", { map })}>
      <figcaption><b>{map}</b> {last.a} – {last.b} <small>{tr("round by round")}</small></figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img">
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="rcmid" />
        <path d={path} className="rcline" />
        <text x="4" y="12" className="rclab">{a} +</text>
        <text x="4" y={H - 4} className="rclab">{b} +</text>
      </svg>
    </figure>
  );
}

/** Overtime, a deciding map: the badges of a tense match. */
export function TensionBadges({ t }) {
  const tr = useT();
  if (!t || (!t.ot && !t.decider)) return null;
  return (
    <div className="tension">
      {t.ot && <span className="tbadge ot">🔥 {tr("Overtime on {map}", { map: t.ot })}</span>}
      {t.decider && <span className="tbadge dec">⚔️ {tr("Deciding map")}</span>}
    </div>
  );
}

/** Anywhere on the site: a short alert when a live match goes to overtime or to its deciding map (once each). */
export function CloseAlerts() {
  const tr = useT();
  const [shown, setShown] = useState([]);
  useEffect(() => {
    let on = true;
    const seen = () => { try { return new Set(JSON.parse(sessionStorage.getItem("vct-close-seen") || "[]")); } catch { return new Set(); } };
    const load = () => {
      if (document.hidden || /^\/(admin|overlay|embed)/.test(window.location.pathname)) return;
      fetch("/api/livescores").then((r) => (r.ok ? r.json() : null)).then((j) => {
        if (!on || !j) return;
        const done = seen();
        const fresh = [];
        for (const m of j.live || []) {
          if (m.ot && !done.has(`ot:${m.event}:${m.id}:${m.ot}`)) { done.add(`ot:${m.event}:${m.id}:${m.ot}`); fresh.push({ key: `ot${m.id}`, kind: "ot", m }); }
          if (m.decider && !done.has(`dec:${m.event}:${m.id}`)) { done.add(`dec:${m.event}:${m.id}`); fresh.push({ key: `dec${m.id}`, kind: "dec", m }); }
        }
        try { sessionStorage.setItem("vct-close-seen", JSON.stringify([...done].slice(-100))); } catch { /* not remembered */ }
        if (!fresh.length) return;
        setShown((s) => [...s, ...fresh].slice(-3));
        setTimeout(() => setShown((s) => s.filter((x) => !fresh.includes(x))), 9000);
      }).catch(() => { /* offline */ });
    };
    const first = setTimeout(load, 4000);
    const t = setInterval(() => { if (!document.hidden) load(); }, 90000);
    return () => { on = false; clearTimeout(first); clearInterval(t); };
  }, []);
  if (!shown.length) return null;
  return (
    <div className="closealerts" role="status" aria-live="polite">
      {shown.map(({ key, kind, m }) => (
        <a key={key} className={"closealert " + kind} href={`/match/${m.event}/${m.id}`}>
          <span>{kind === "ot" ? `🔥 ${tr("Overtime on {map}", { map: m.ot })}` : `⚔️ ${tr("Deciding map")}`}</span>
          <b>{m.a} {kind === "ot" && m.map ? `${m.map.a}–${m.map.b}` : `${m.sa}–${m.sb}`} {m.b}</b>
        </a>
      ))}
    </div>
  );
}

/** Every live match's latest moments in one list, newest first: a map starting, a map won, the score of the map being played. */
export function GlobalFeed({ live }) {
  const tr = useT();
  const items = [];
  for (const m of live || []) {
    const s = m.score;
    if (!s) continue;
    const name = (side) => ((side === "a" ? m.a : m.b) || {}).name || "?";
    for (const f of s.feed || []) {
      items.push({ at: f.at, key: `${m.id}${f.at}${f.kind}`, m, text: f.kind === "start" ? tr("{map} starts", { map: f.map }) : tr("{team} wins {map} {a}–{b}", { team: name(f.a > f.b ? "a" : "b"), map: f.map, a: Math.max(f.a, f.b), b: Math.min(f.a, f.b) }), kind: f.kind });
    }
    const r = (s.rounds || [])[0];
    if (r && !/^tbd$/i.test(r.map)) items.push({ at: r.at, key: `${m.id}r${r.at}`, m, text: `${r.map} : ${r.a}–${r.b}`, kind: "round" });
  }
  if (!items.length) return null;
  items.sort((x, y) => String(y.at).localeCompare(String(x.at)));
  const time = (iso) => new Date(iso).toLocaleTimeString(tr.lang === "fr" ? "fr-FR" : undefined, { hour: "2-digit", minute: "2-digit" });
  return (
    <section className="globalfeed">
      <h2><i className="ssdot inline" /> {tr("Live feed")}</h2>
      <ol>{items.slice(0, 14).map((x) => (
        <li key={x.key} className={x.kind}>
          <small>{time(x.at)}</small>
          <a href={`/match/${x.m.event}/${x.m.id}`}><b>{(x.m.a && (x.m.a.tag || x.m.a.name)) || "?"} vs {(x.m.b && (x.m.b.tag || x.m.b.name)) || "?"}</b></a>
          <span>{x.text}</span>
        </li>
      ))}</ol>
    </section>
  );
}
