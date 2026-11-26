"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "./lang.jsx";
import { Crest } from "./Crest.jsx";
import { EVENT_NAMES } from "../lib/paths.js";
import { mapList, mapSplash } from "./Assets.jsx";
import { useTeamColor } from "./visual.jsx";
import { ftOn } from "./Maj40Bits.jsx";

const SEEN = "vct-stories-seen";
const readSeen = () => { try { return new Set(JSON.parse(localStorage.getItem(SEEN) || "[]")); } catch { return new Set(); } };
// how long a story stays on screen before the next one (preview "stories2")
const STORY_MS = 6000;

const winnerOf = (m) => (m.win === "a" ? m.a : m.win === "b" ? m.b : m.sa > m.sb ? m.a : m.b);

/** "3 h ago", "12 min ago": how long ago the match ended (from its time). */
function ago(at, now, tr) {
  const min = Math.max(1, Math.round((now - new Date(at).getTime()) / 60000));
  return min < 60 ? tr("{n} min ago", { n: min }) : tr("{n} h ago", { n: Math.round(min / 60) });
}

/**
 * One story full screen. Preview "stories2": behind it, the art of the last map played, blurred and tinted with the winner's
 * colour; the maps as cards; the story goes on by itself after 6 s (a press holds it), a swipe goes sideways or closes.
 */
function StoryView({ list, open, setOpen, now }) {
  const tr = useT();
  const s = list[open];
  const m = s.m;
  const win = winnerOf(m);
  const color = useTeamColor(win && win.logo);
  const last = s.maps.length ? s.maps[s.maps.length - 1].map : "";
  const art = last ? mapSplash(last) : "";
  const [held, setHeld] = useState(false);
  const [auto, setAuto] = useState(false);
  useEffect(() => setAuto(ftOn("stories2") && !window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  // the next story once the bar is full (paused while held or while the tab is hidden)
  useEffect(() => {
    if (!auto || held) return undefined;
    const t = setTimeout(() => { if (!document.hidden) setOpen((i) => (i + 1 < list.length ? i + 1 : -1)); }, STORY_MS);
    return () => clearTimeout(t);
  }, [auto, held, open, list.length, setOpen]);
  // swipes: sideways for the next or previous story, down to close
  const start = useRef(null);
  const onDown = (e) => { start.current = { x: e.clientX, y: e.clientY, t: Date.now() }; setHeld(true); };
  const onUp = (e) => {
    setHeld(false);
    const st = start.current;
    start.current = null;
    if (!st) return;
    const dx = e.clientX - st.x;
    const dy = e.clientY - st.y;
    if (dy > 90 && Math.abs(dy) > Math.abs(dx)) { setOpen(-1); return; }
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) setOpen((i) => (dx < 0 ? (i + 1 < list.length ? i + 1 : -1) : Math.max(0, i - 1)));
  };
  return (
    <div className={"storyview" + (auto ? " auto" : "") + (held ? " held" : "")} role="dialog" aria-modal="true" aria-label={`${m.a.name} vs ${m.b.name}`}
      style={color ? { "--stc": color } : undefined} onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => { setHeld(false); start.current = null; }}>
      {art && <div className="storyart" aria-hidden="true" style={{ backgroundImage: `url(${art})` }} />}
      <div className="storyglow" aria-hidden="true" />
      <div className="storybars">{list.map((x, i) => <i key={x.key} className={i < open ? "done" : i === open ? "now" : ""}>{i === open && <b key={open} style={{ animationDuration: `${STORY_MS}ms` }} />}</i>)}</div>
      <button type="button" className="storyclose" aria-label={tr("Close")} onClick={() => setOpen(-1)}>×</button>
      <button type="button" className="storyprev" aria-label={tr("Previous")} onClick={() => setOpen(Math.max(0, open - 1))} />
      <button type="button" className="storynext" aria-label={tr("Next")} onClick={() => setOpen(open + 1 < list.length ? open + 1 : -1)} />
      <div className="storybody">
        <small className="storyev">{tr(EVENT_NAMES[s.event] || s.event)}<span className="st2"> · {ago(s.at, now, tr)}</span></small>
        <div className="storyteams">
          <div className={m.win === "a" ? "w" : ""}><Crest team={m.a} /><b>{m.a.name}</b>{m.win === "a" && <em className="st2 storywin">{tr("Win")}</em>}</div>
          <div className="storyscore">{m.sa} – {m.sb}</div>
          <div className={m.win === "b" ? "w" : ""}><Crest team={m.b} /><b>{m.b.name}</b>{m.win === "b" && <em className="st2 storywin">{tr("Win")}</em>}</div>
        </div>
        {s.maps.length > 0 && (
          <>
            <div className="storymaps st1">{s.maps.map((x, i) => <span key={i}><b>{x.map}</b> {x.a}–{x.b}</span>)}</div>
            <div className="storycards st2">
              {s.maps.map((x, i) => (
                <span key={i} className={(win === m.a ? x.a > x.b : x.b > x.a) ? "won" : "lost"} style={mapList(x.map) ? { backgroundImage: `url(${mapList(x.map)})` } : undefined}>
                  <small>{tr("Map #{n}", { n: i + 1 })}</small><b>{x.map}</b><em>{x.a}–{x.b}</em>
                </span>
              ))}
            </div>
          </>
        )}
        <a className="btn pri" href={s.href}>{tr("Match page")} ›</a>
        <small className="st2 storyhint">{tr("Hold to pause · swipe down to close")}</small>
      </div>
    </div>
  );
}

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
  return (
    <>
      <div className="stories" role="list" aria-label={tr("Results of the last 24 hours")}>
        {list.map((x, i) => (
          <button key={x.key} type="button" role="listitem" className={"story" + (seen.has(x.key) ? " seen" : "")} onClick={() => setOpen(i)} aria-label={`${x.m.a.name} vs ${x.m.b.name}`}>
            <span className="storyring"><Crest team={winnerOf(x.m)} /></span>
            <small>{winnerOf(x.m).tag || winnerOf(x.m).name.slice(0, 8)}</small>
          </button>
        ))}
      </div>
      {open >= 0 && list[open] && <StoryView list={list} open={open} setOpen={setOpen} now={now} />}
    </>
  );
}
