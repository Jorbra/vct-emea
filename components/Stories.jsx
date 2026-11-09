"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "./lang.jsx";
import { Crest } from "./Crest.jsx";
import { EVENT_NAMES } from "../lib/paths.js";

const SEEN = "vct-stories-seen";
const readSeen = () => { try { return new Set(JSON.parse(localStorage.getItem(SEEN) || "[]")); } catch { return new Set(); } };

/**
 * The results of the last 24 hours as stories: a ring per result (red until seen), a tap opens it full screen,
 * tapping the right side goes on, the left side back. Nothing while there is no result; hidden in no-spoiler mode.
 */
export default function Stories({ events }) {
  const tr = useT();
  const [now, setNow] = useState(0);
  const [seen, setSeen] = useState(new Set());
  const [open, setOpen] = useState(-1);
  useEffect(() => { setNow(Date.now()); setSeen(readSeen()); }, []);
  const list = useMemo(() => (now ? events.flatMap((e) => e.items.filter((m) => m.a && m.b && m.sa != null && m.sb != null && e.times[m.id] && now - new Date(e.times[m.id]).getTime() < 24 * 3600e3)
    .map((m) => ({ key: `${e.event}:${m.id}`, event: e.event, href: `/match/${e.event}/${m.id}`, m, at: e.times[m.id], maps: ((e.extra[m.id] || {}).maps || []).filter((x) => x.a != null) })))
    .sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20) : []), [events, now]);
  useEffect(() => {
    if (open < 0) return undefined;
    const s = list[open];
    if (s && !seen.has(s.key)) {
      const next = new Set([...seen, s.key]);
      setSeen(next);
      try { localStorage.setItem(SEEN, JSON.stringify([...next].slice(-200))); } catch { /* not kept */ }
    }
    const onKey = (ev) => { if (ev.key === "Escape") setOpen(-1); if (ev.key === "ArrowRight") setOpen((i) => (i + 1 < list.length ? i + 1 : -1)); if (ev.key === "ArrowLeft") setOpen((i) => Math.max(0, i - 1)); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!list.length) return null;
  const s = open >= 0 ? list[open] : null;
  const winner = (m) => (m.win === "a" ? m.a : m.win === "b" ? m.b : m.sa > m.sb ? m.a : m.b);
  return (
    <>
      <div className="stories" role="list" aria-label={tr("Results of the last 24 hours")}>
        {list.map((x, i) => (
          <button key={x.key} type="button" role="listitem" className={"story" + (seen.has(x.key) ? " seen" : "")} onClick={() => setOpen(i)} aria-label={`${x.m.a.name} vs ${x.m.b.name}`}>
            <span className="storyring"><Crest team={winner(x.m)} /></span>
            <small>{winner(x.m).tag || winner(x.m).name.slice(0, 8)}</small>
          </button>
        ))}
      </div>
      {s && (
        <div className="storyview" role="dialog" aria-modal="true" aria-label={`${s.m.a.name} vs ${s.m.b.name}`}>
          <div className="storybars">{list.map((x, i) => <i key={x.key} className={i < open ? "done" : i === open ? "now" : ""} />)}</div>
          <button type="button" className="storyclose" aria-label={tr("Close")} onClick={() => setOpen(-1)}>×</button>
          <button type="button" className="storyprev" aria-label={tr("Previous")} onClick={() => setOpen(Math.max(0, open - 1))} />
          <button type="button" className="storynext" aria-label={tr("Next")} onClick={() => setOpen(open + 1 < list.length ? open + 1 : -1)} />
          <div className="storybody">
            <small>{tr(EVENT_NAMES[s.event] || s.event)}</small>
            <div className="storyteams">
              <div className={s.m.win === "a" ? "w" : ""}><Crest team={s.m.a} /><b>{s.m.a.name}</b></div>
              <div className="storyscore">{s.m.sa} – {s.m.sb}</div>
              <div className={s.m.win === "b" ? "w" : ""}><Crest team={s.m.b} /><b>{s.m.b.name}</b></div>
            </div>
            {s.maps.length > 0 && <div className="storymaps">{s.maps.map((x, i) => <span key={i}><b>{x.map}</b> {x.a}–{x.b}</span>)}</div>}
            <a className="btn pri" href={s.href}>{tr("Match page")} ›</a>
          </div>
        </div>
      )}
    </>
  );
}
