"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
// the story of the matches to come: its key, and how far ahead it looks
const NEXT_KEY = "next";
const NEXT_MS = 24 * 3600e3;

const winnerOf = (m) => (m.win === "a" ? m.a : m.win === "b" ? m.b : m.sa > m.sb ? m.a : m.b);
const loserOf = (m) => (winnerOf(m) === m.a ? m.b : m.a);

/** "3 h ago", "12 min ago": how long ago the match ended (from its time). */
function ago(at, now, tr) {
  const min = Math.max(1, Math.round((now - new Date(at).getTime()) / 60000));
  return min < 60 ? tr("{n} min ago", { n: min }) : tr("{n} h ago", { n: Math.round(min / 60) });
}

/** The round's name as the schedules give it ("Swiss · Round 2", "Group A · Final"), translated. */
const roundOf = (m, tr) => (Array.isArray(m.round) ? m.round.map(([k, v]) => tr(k, v)).join(" · ") : "");

/** "Today 18:00" or "Tomorrow 15:00" for a match to come. */
function whenNext(at, now, tr) {
  const d = new Date(at);
  const day = d.toDateString() === new Date(now).toDateString() ? tr("Today") : tr("Tomorrow");
  return `${day} ${d.toLocaleTimeString(tr.lang === "fr" ? "fr-FR" : undefined, { hour: "2-digit", minute: "2-digit" })}`;
}

/** Shares the match's page (the phone's share sheet), else copies its address. */
async function shareMatch(s, tr, onCopied) {
  const url = new URL(s.href, window.location.origin).toString();
  const title = `${s.m.a.name} ${s.m.sa}–${s.m.sb} ${s.m.b.name}`;
  try {
    if (navigator.share) { await navigator.share({ title, url }); return; }
    await navigator.clipboard.writeText(url);
    onCopied();
  } catch { /* closed or refused */ }
}

/** The last story: the matches of the next 24 hours, each with its time and a link. */
function NextBody({ s, now }) {
  const tr = useT();
  return (
    <div className="storybody storynextbody">
      <small className="storyev">{tr("Coming up")}<span className="st2"> · {tr("Next 24 hours")}</span></small>
      <ul className="storyup">
        {s.list.map((x) => (
          <li key={x.key}>
            <a href={x.href}>
              <span className="storyuptime">{whenNext(x.at, now, tr)}</span>
              <span className="storyupteams"><Crest team={x.m.a} /><b>{x.m.a.name}</b><i>vs</i><b>{x.m.b.name}</b><Crest team={x.m.b} /></span>
              <small>{tr(EVENT_NAMES[x.event] || x.event)}{roundOf(x.m, tr) ? ` · ${roundOf(x.m, tr)}` : ""}</small>
            </a>
          </li>
        ))}
      </ul>
      <a className="btn pri" href="/calendar">{tr("Full schedule")} ›</a>
      <small className="st2 storyhint">{tr("Hold to pause · swipe down to close")}</small>
    </div>
  );
}

/**
 * One story full screen. Preview "stories2": behind it, the art of the last map played (or the winner's crest when no map is
 * known), blurred and tinted with the winner's colour; a headline; the maps as cards; the MVP, the replay and a share
 * button when known; the story goes on by itself after 6 s (a press holds it), a swipe goes sideways or closes.
 */
function StoryView({ list, open, setOpen, now }) {
  const tr = useT();
  const s = list[open];
  const isNext = s.key === NEXT_KEY;
  const m = isNext ? null : s.m;
  const win = m ? winnerOf(m) : null;
  const lose = m ? loserOf(m) : null;
  const color = useTeamColor(win && win.logo);
  const last = s.maps && s.maps.length ? s.maps[s.maps.length - 1].map : "";
  const art = last ? mapSplash(last) : "";
  const [held, setHeld] = useState(false);
  const [auto, setAuto] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => setAuto(ftOn("stories2") && !window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  useEffect(() => { setCopied(false); }, [open]);
  // the next story once the bar is full (paused while held or while the tab is hidden); the list of matches to come stays longer
  const ms = isNext ? STORY_MS * 1.5 : STORY_MS;
  useEffect(() => {
    if (!auto || held) return undefined;
    const t = setTimeout(() => { if (!document.hidden) setOpen((i) => (i + 1 < list.length ? i + 1 : -1)); }, ms);
    return () => clearTimeout(t);
  }, [auto, held, open, list.length, setOpen, ms]);
  // swipes: sideways for the next or previous story, down to close
  const start = useRef(null);
  const onDown = (e) => { if (e.target.closest("a, button")) return; start.current = { x: e.clientX, y: e.clientY, t: Date.now() }; setHeld(true); };
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
  // the headline: who beat whom, and how (a clean sweep, or a deciding map)
  const how = m && s.maps.length >= 2 ? (Math.min(m.sa, m.sb) === 0 ? tr("without dropping a map") : m.sa + m.sb === (m.bo || 3) ? tr("after a deciding map") : "") : "";
  const round = m ? roundOf(m, tr) : "";
  return (
    <div className={"storyview" + (auto ? " auto" : "") + (held ? " held" : "") + (isNext ? " isnext" : "")} role="dialog" aria-modal="true" aria-label={m ? `${m.a.name} vs ${m.b.name}` : tr("Coming up")}
      style={color ? { "--stc": color } : undefined} onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => { setHeld(false); start.current = null; }}>
      {art && <div className="storyart" aria-hidden="true" style={{ backgroundImage: `url(${art})` }} />}
      {!art && win && win.logo && <div className="storyart crestart" aria-hidden="true" style={{ backgroundImage: `url(${win.logo})` }} />}
      <div className="storyglow" aria-hidden="true" />
      <div className="storybars">{list.map((x, i) => <i key={x.key} className={i < open ? "done" : i === open ? "now" : ""}>{i === open && <b key={open} style={{ animationDuration: `${i === open && isNext ? ms : STORY_MS}ms` }} />}</i>)}</div>
      <button type="button" className="storyclose" aria-label={tr("Close")} onClick={() => setOpen(-1)}>×</button>
      <button type="button" className="storyprev" aria-label={tr("Previous")} onClick={() => setOpen(Math.max(0, open - 1))} />
      <button type="button" className="storynext" aria-label={tr("Next")} onClick={() => setOpen(open + 1 < list.length ? open + 1 : -1)} />
      {isNext ? <NextBody s={s} now={now} /> : (
        <div className="storybody">
          <small className="storyev">{tr(EVENT_NAMES[s.event] || s.event)}{round && <span className="st2"> · {round}</span>}<span className="st2"> · {ago(s.at, now, tr)}</span></small>
          <h2 className="st2 storyhead">{tr("{w} beats {l}", { w: win.name, l: lose.name })}{how && <span> {how}</span>}</h2>
          <div className="storyteams">
            <div className={m.win === "a" ? "w" : ""}><Crest team={m.a} /><b>{m.a.name}</b>{m.win === "a" && <em className="st2 storywin">{tr("Win")}</em>}</div>
            <div className="storyscore"><span className={m.sa > m.sb ? "sw" : "sl"}>{m.sa}</span> – <span className={m.sb > m.sa ? "sw" : "sl"}>{m.sb}</span></div>
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
          {s.mvp && <p className="st2 storymvp">⭐ {tr("MVP: {name}", { name: s.mvp })}</p>}
          <div className="storyacts">
            <a className="btn pri" href={s.href}>{tr("Match page")} ›</a>
            {s.vod && <a className="btn st2" href={s.vod} target="_blank" rel="noreferrer noopener">▶ {tr("Watch again")}</a>}
            {!s.vod && s.highlights && <a className="btn st2" href={s.highlights} target="_blank" rel="noreferrer noopener">▶ {tr("Highlights")}</a>}
            <button type="button" className="btn st2" onClick={() => shareMatch(s, tr, () => setCopied(true))}>{copied ? `✓ ${tr("Link copied")}` : `↗ ${tr("Share")}`}</button>
          </div>
          <small className="st2 storyhint">{tr("Hold to pause · swipe down to close")}</small>
        </div>
      )}
    </div>
  );
}

/**
 * The results of the last 24 hours as stories: a ring per result (red until seen), a tap opens it full screen,
 * tapping the right side goes on, the left side back. Preview "stories2": a last story lists the matches of the next
 * 24 hours. Nothing while there is no result; hidden in no-spoiler mode.
 */
export default function Stories({ events }) {
  const tr = useT();
  const [now, setNow] = useState(0);
  const [seen, setSeen] = useState(new Set());
  const [open, setOpen] = useState(-1);
  const [more, setMore] = useState(false);
  useEffect(() => { setNow(Date.now()); setSeen(readSeen()); setMore(ftOn("stories2")); }, []);
  const list = useMemo(() => {
    if (!now) return [];
    const done = events.flatMap((e) => e.items.filter((m) => m.a && m.b && m.sa != null && m.sb != null && e.times[m.id] && now - new Date(e.times[m.id]).getTime() < 24 * 3600e3)
      .map((m) => {
        const ex = e.extra[m.id] || {};
        return { key: `${e.event}:${m.id}`, event: e.event, href: `/match/${e.event}/${m.id}`, m, at: e.times[m.id], maps: (ex.maps || []).filter((x) => x.a != null), mvp: ex.mvp || "", vod: ex.vod || "", highlights: ex.highlights || "" };
      }))
      .sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20);
    if (!more || !done.length) return done;
    // the matches to come (both teams known, in the next 24 hours), soonest first
    const next = events.flatMap((e) => e.items.filter((m) => m.a && m.b && m.a.name && m.b.name && m.sa == null && e.times[m.id] && new Date(e.times[m.id]).getTime() > now && new Date(e.times[m.id]).getTime() - now < NEXT_MS)
      .map((m) => ({ key: `${e.event}:${m.id}`, event: e.event, href: `/match/${e.event}/${m.id}`, m, at: e.times[m.id] })))
      .sort((a, b) => a.at.localeCompare(b.at)).slice(0, 5);
    return next.length ? [...done, { key: NEXT_KEY, list: next }] : done;
  }, [events, now, more]);
  useEffect(() => {
    if (open < 0) return undefined;
    const s = list[open];
    if (s && s.key !== NEXT_KEY && !seen.has(s.key)) {
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
        {list.map((x, i) => (x.key === NEXT_KEY ? (
          <button key={x.key} type="button" role="listitem" className="story storyupnext" onClick={() => setOpen(i)} aria-label={`${tr("Coming up")} · ${tr("Next 24 hours")}`}>
            <span className="storyring"><span className="storycal" aria-hidden="true">📅</span></span>
            <small>{tr("Up next")}</small>
          </button>
        ) : (
          <button key={x.key} type="button" role="listitem" className={"story" + (seen.has(x.key) ? " seen" : "")} onClick={() => setOpen(i)} aria-label={`${x.m.a.name} vs ${x.m.b.name}`}>
            <span className="storyring"><Crest team={winnerOf(x.m)} /></span>
            <small>{winnerOf(x.m).tag || winnerOf(x.m).name.slice(0, 8)}</small>
          </button>
        )))}
      </div>
      {/* at the end of the page, above everything (the bottom tabs included) */}
      {open >= 0 && list[open] && createPortal(<StoryView list={list} open={open} setOpen={setOpen} now={now} />, document.body)}
    </>
  );
}
