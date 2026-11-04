"use client";

import { localeOf } from "../lib/i18n.js";
import { Fragment, createContext, useContext, useEffect, useRef, useState } from "react";
import { Crest } from "./Crest.jsx";
import { useT } from "./lang.jsx";
import { MAP_POOL, formatMatchTime, planRound } from "../lib/schedule.js";
import { useOpenMatch } from "./openMatch.js";
import { useFavorites } from "./favorites.js";
import { teamHref, teamSlug } from "../lib/paths.js";

// The match times and live matches of the event shown, so any match box can show (or, in the editor, set) its own
// without passing props down.
const Ctx = createContext({ event: null, times: {}, live: {}, extra: {}, onSaved: null });

export function MatchTimes({ event, times, live, extra, onSaved, children }) {
  return <Ctx.Provider value={{ event, times: times || {}, live: live || {}, extra: extra || {}, onSaved }}>{children}</Ctx.Provider>;
}

/** The maps won so far by a match being played ({ a, b }), or null (not live, or its result is in). */
export function useLiveScore(id, done = false) {
  const { live } = useContext(Ctx);
  return !done && live[id] ? live[id] : null;
}

/** Props that make a match element open its details (a role=button with Enter / Space); none in the editor. */
export function useMatchClick(event, id) {
  const open = useOpenMatch();
  if (!open || !event) return {};
  const go = () => open(event, id);
  return { role: "button", tabIndex: 0, className: "mclick", onClick: go, onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } } };
}

/** The red "LIVE" badge of a match being played. */
export function LiveBadge() {
  const tr = useT();
  return <span className="livebadge">{tr("LIVE")}</span>;
}

export const useMatchTimes = () => useContext(Ctx);

// Formatted on the client only: the visitor's own time zone, which the server does not know.
function useLocalText(iso, withWeekday) {
  const tr = useT();
  const [text, setText] = useState("");
  useEffect(() => setText(formatMatchTime(iso, tr.lang, withWeekday)), [iso, tr.lang, withWeekday]);
  return text;
}

/**
 * The match's date and time, as a thin row inside its box. While the event has no time at all nothing is shown;
 * once it has some, every box gets the row (empty where unknown) so the boxes keep the same height in a bracket.
 */
export function When({ id, inline = false, done = false }) {
  const { times, live } = useMatchTimes();
  const at = times[id] || "";
  const isLive = !done && !!live[id];
  const text = useLocalText(at, false);
  if (inline) return isLive ? <LiveBadge /> : at ? <span className="mwhen in">{text}</span> : null;
  if (!Object.keys(times).length && !Object.keys(live).length) return null;
  return <div className={"mwhen" + (at || isLive ? "" : " none") + (isLive ? " live" : "")}>{isLive && <LiveBadge />}{text || (isLive ? "" : " ")}</div>;
}

/** The ISO time as a value for <input type="datetime-local"> in this browser's time zone ("2026-11-25T18:00"). */
const toLocalInput = (iso) => {
  if (!iso) return "";
  const t = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}T${p(t.getHours())}:${p(t.getMinutes())}`;
};

/**
 * Editor: date and time of one match, saved as soon as it is changed (empty clears it), typed in the editor's own time zone;
 * and the "live" switch while it is being played (once both teams are known and until its result is in).
 */
export function TimeEdit({ id, call, ready = false, done = false, max = 2 }) {
  const tr = useT();
  const { event, times, live, onSaved } = useMatchTimes();
  const isLive = !done && !!live[id];
  const cur = live[id] || { a: 0, b: 0 };
  // score in progress (maps won so far): saved on each change, never a result
  const setScore = (k, x) => saveScore({ ...cur, [k]: Math.max(0, Math.min(max - 1, Number(x) || 0)) });
  async function saveScore(next) {
    if (next.a === cur.a && next.b === cur.b) return;
    setErr("");
    try {
      const j = await call("/api/mlive", { event, id, live: true, a: next.a, b: next.b });
      onSaved && onSaved(tr.server(j.message));
    } catch (e) {
      setErr(tr.server(e.message));
    }
  }
  async function setLive(next) {
    setErr("");
    try {
      const j = await call("/api/mlive", { event, id, live: next });
      onSaved && onSaved(tr.server(j.message));
    } catch (e) {
      setErr(tr.server(e.message));
    }
  }
  const saved = toLocalInput(times[id] || "");
  const [v, setV] = useState(saved);
  const [err, setErr] = useState("");
  useEffect(() => setV(saved), [saved]);
  async function save(next) {
    if (next === saved) return;
    setErr("");
    try {
      const j = await call("/api/mtime", { event, id, at: next ? new Date(next).toISOString() : "" });
      onSaved && onSaved(tr.server(j.message));
    } catch (e) {
      setErr(tr.server(e.message));
      setV(saved);
    }
  }
  return (
    <span className="mtime">
      <span className="mtl">{tr("Time")}</span>
      <input type="datetime-local" aria-label={tr("Match date and time")} value={v} onChange={(e) => setV(e.target.value)}
        onBlur={() => save(v)} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
      {v && <button type="button" className="mtclear" title={tr("Clear the time")} aria-label={tr("Clear the time")} onClick={() => { setV(""); save(""); }}>×</button>}
      {!done && (
        <button type="button" className={"livebtn" + (isLive ? " on" : "")} disabled={!ready && !isLive} title={ready || isLive ? "" : tr("Teams first")} aria-pressed={isLive} onClick={() => setLive(!isLive)}>
          <span className="dot" aria-hidden="true" />{isLive ? tr("Stop live") : tr("Mark as live")}
        </button>
      )}
      {isLive && (
        <span className="livescore" role="group" aria-label={tr("Score in progress")}>
          <span className="mtl">{tr("Score in progress")}</span>
          <button type="button" className="lsb" aria-label={tr("Team 1: one map more")} disabled={cur.a >= max - 1} onClick={() => setScore("a", cur.a + 1)}>+</button>
          <b>{cur.a}</b><span>–</span><b>{cur.b}</b>
          <button type="button" className="lsb" aria-label={tr("Team 2: one map more")} disabled={cur.b >= max - 1} onClick={() => setScore("b", cur.b + 1)}>+</button>
          {(cur.a > 0 || cur.b > 0) && <button type="button" className="mtclear" title={tr("Back to 0-0")} aria-label={tr("Back to 0-0")} onClick={() => saveScore({ a: 0, b: 0 })}>↺</button>}
        </span>
      )}
      {err && <span className="err">{err}</span>}
    </span>
  );
}

/** Day heading of the schedule: "mer. 25 nov." in the visitor's time zone. */
function DayHead({ iso }) {
  const tr = useT();
  const [text, setText] = useState("");
  useEffect(() => setText(new Intl.DateTimeFormat(localeOf(tr.lang), { weekday: "long", day: "numeric", month: "long" }).format(new Date(iso))), [iso, tr.lang]);
  return <h3 className="schday">{text || " "}</h3>;
}

function Hour({ iso }) {
  const tr = useT();
  const [text, setText] = useState("");
  useEffect(() => setText(new Intl.DateTimeFormat(localeOf(tr.lang), { hour: "2-digit", minute: "2-digit" }).format(new Date(iso))), [iso, tr.lang]);
  return <span className="schh">{text}</span>;
}

/**
 * The event's schedule: every match that has a time, day by day, with its teams and score once played.
 * items: [{ id, round, a, b (teams or null), sa, sb, win: "a" | "b" | null }]. Nothing while no match has a time.
 */
export function Schedule({ items, Crest }) {
  const tr = useT();
  const { event, times, live } = useMatchTimes();
  const open = useOpenMatch();
  const label = (m) => (Array.isArray(m.round) ? m.round.map(([k, v]) => tr(k, v)).join(" · ") : m.round);
  const isLive = (m) => !!live[m.id] && m.sa == null;
  const liveOf = (m) => live[m.id];
  const now = items.filter(isLive);
  const list = items.filter((m) => times[m.id] && !isLive(m)).map((m) => ({ ...m, at: times[m.id] })).sort((x, y) => x.at.localeCompare(y.at));
  // days in the visitor's time zone, so a group is computed on the client
  const [days, setDays] = useState([]);
  const [whole, setWhole] = useState(false);
  useEffect(() => {
    const key = (iso) => { const t = new Date(iso); return `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}`; };
    const out = [];
    for (const m of list) {
      const k = key(m.at);
      if (!out.length || out[out.length - 1].k !== k) out.push({ k, items: [] });
      out[out.length - 1].items.push(m);
    }
    setDays(out);
  }, [JSON.stringify(list.map((m) => [m.id, m.at, m.sa, m.sb, m.a && m.a.name, m.b && m.b.name]))]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!list.length && !now.length) return null;
  const side = (t, won, lost) => (
    <span className={"scht" + (won ? " w" : lost ? " lo" : "")}>
      {Crest && <Crest team={t} />}
      <span className={"tn" + (t && t.name ? "" : " tbdn")}>{(t && t.name) || tr("TBD")}</span>
    </span>
  );
  const row = (m, live) => {
    const done = m.sa != null && m.sb != null;
    return (
      <div key={m.id} className={"schm" + (done ? " done" : "") + (live ? " live" : "") + (open ? " mclick" : "")}
        {...(open ? { role: "button", tabIndex: 0, onClick: () => open(event, m.id), onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(event, m.id); } } } : {})}>
        {live ? <LiveBadge /> : <Hour iso={m.at} />}
        <span className="schr">{label(m)}{m.bo ? <span className="bobadge">Bo{m.bo}</span> : null}</span>
        <span className="schteams">
          {side(m.a, m.win === "a", m.win === "b")}
          <span className={"schs" + (live ? " lv" : "")}>{done ? `${m.sa} – ${m.sb}` : live && liveOf(m) ? `${liveOf(m).a} – ${liveOf(m).b}` : "vs"}</span>
          {side(m.b, m.win === "b", m.win === "a")}
        </span>
      </div>
    );
  };
  // a very long schedule starts folded, so the rest of the page stays within reach
  const long = list.length > 32;
  let left = long && !whole ? 12 : Infinity;
  return (
    <section>
      <h2>{tr("Schedule")}</h2>
      <div className="sched">
        {now.length > 0 && (
          <div className="schd live">
            <h3 className="schday">{tr("Live now")}</h3>
            {now.map((m) => row(m, true))}
          </div>
        )}
        {days.map((d) => {
          const shown = d.items.slice(0, left);
          left -= shown.length;
          return shown.length > 0 && (
            <div key={d.k} className="schd">
              <DayHead iso={d.items[0].at} />
              {shown.map((m) => row(m, false))}
            </div>
          );
        })}
      </div>
      {long && (
        <button type="button" className="more" aria-expanded={whole} onClick={() => setWhole(!whole)}>
          {whole ? tr("Show fewer matches ⌃") : tr("Show all {n} matches ⌄", { n: list.length })}
        </button>
      )}
    </section>
  );
}

const EVENT_SHORT = {
  q1: "EU Qualifier 1", q2: "EU Qualifier 2", playoffs: "EU Qualifier Playoffs",
  trq1: "Türkiye Qualifier 1", trq2: "Türkiye Qualifier 2", tr: "Türkiye Qualifier Playoffs",
  mena: "MENA Qualifier Playoffs", kickoff: "EMEA Kickoff",
};
const COUNTDOWN_KEY = "vct-countdown"; // remembered per visitor

/** "21h 43m 8s" under a day, "1d 21h 43m" (FR "1j 21h 43m") after; "" once the time has passed. */
export function countdownText(ms, lang = "fr") {
  if (ms <= 0) return "";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}${lang === "fr" ? "j" : "d"} ${h}h ${m}m`;
  return `${h}h ${m}m ${s % 60}s`;
}

/**
 * Cards of the matches being played and the next ones (like Liquipedia's "Upcoming Matches"): a LIVE or countdown badge
 * (or the date and time, with the switch off), the round, both teams. Scrolls sideways, with arrows.
 * events: [{ event, items (from matchesOf), times, live, href }]; showEvent adds the event name (home page).
 */
export function MatchStrip({ events, Crest, showEvent = false, max = 12, recent = false, today = false, skipToday = false }) {
  const tr = useT();
  const [now, setNow] = useState(null); // the visitor's clock, known once on the client
  const [countdown, setCountdown] = useState(true);
  const fav = useFavorites();
  const ref = useRef(null);
  const [can, setCan] = useState({ l: false, r: false });
  useEffect(() => {
    try { if (localStorage.getItem(COUNTDOWN_KEY) === "0") setCountdown(false); } catch { /* storage blocked: keep the default */ }
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const label = (m) => m.round.map(([k, v]) => tr(k, v)).join(" · ");
  const open = useOpenMatch();
  const all = events.flatMap((e) => e.items.map((m) => ({ ...m, event: e.event, href: e.href, stream: (e.extra && e.extra[m.id] && e.extra[m.id].stream) || e.stream || "", at: e.times[m.id] || "", live: !!e.live[m.id] && m.sa == null, score: e.live[m.id] || null })));
  const live = all.filter((m) => m.live);
  // still shown for 6 hours after its time while no result is in (late start, or just not marked live)
  const next = now == null ? [] : all.filter((m) => !m.live && m.at && m.sa == null && new Date(m.at).getTime() > now - 6 * 3600e3)
    .sort((x, y) => x.at.localeCompare(y.at));
  // recent: finished matches, the latest first (those without a time after the others)
  const played = all.filter((m) => m.sa != null && m.sb != null)
    .sort((x, y) => (y.at || "").localeCompare(x.at || ""));
  // the visitor's favorite teams first (their matches keep their order among themselves)
  const isFav = (m) => (fav.has(teamSlug(m.a && m.a.name)) || fav.has(teamSlug(m.b && m.b.name)) ? 1 : 0);
  // today: what is on, and what starts on the visitor's day
  const sameDay = (at) => { const d = new Date(at); const n = new Date(now); return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate(); };
  const coming = today ? next.filter((m) => sameDay(m.at)) : skipToday ? next.filter((m) => !sameDay(m.at)) : next;
  const cards = (recent ? played : skipToday ? coming : [...live, ...coming]).sort((x, y) => isFav(y) - isFav(x)).slice(0, max);
  const n = cards.length;
  // arrows only when the strip overflows, each greyed at its end
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const upd = () => setCan({ l: el.scrollLeft > 4, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    upd();
    el.addEventListener("scroll", upd, { passive: true });
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", upd); ro.disconnect(); };
  }, [n]);
  if (!n) return null;
  const toggle = (v) => {
    setCountdown(v);
    try { localStorage.setItem(COUNTDOWN_KEY, v ? "1" : "0"); } catch { /* not remembered */ }
  };
  const go = (dir) => { const el = ref.current; if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" }); };
  const line = (t, score, won = false, lost = false) => (
    <span className={"mcl" + (won ? " w" : lost ? " lo" : "")}>
      <Crest team={t} />
      {t && t.name ? <a className="tn" href={teamHref(t.name)} onClick={(e) => e.stopPropagation()}>{t.name}</a> : <span className="tn tbdn">{tr("TBD")}</span>}
      {score != null && <span className="mcs">{score}</span>}
    </span>
  );
  return (
    <section className="mstrip">
      <h2>{recent ? tr("Recent results") : today ? tr("Today") : tr("Upcoming matches")}</h2>
      {!recent && !today && (
        <div className="toggles">
          <label className="sw"><input type="checkbox" checked={countdown} onChange={(e) => toggle(e.target.checked)} /> {tr("Show countdown")}</label>
        </div>
      )}
      <div className="mswrap">
        {can.l && <button type="button" className="msarrow l" aria-label={tr("Previous matches")} onClick={() => go(-1)}>‹</button>}
        <div className="msrow" ref={ref} tabIndex={0} aria-label={recent ? tr("Recent results") : tr("Upcoming matches")}>
          {cards.map((m) => {
            const left = now == null ? 0 : new Date(m.at).getTime() - now;
            return (
              <div key={m.event + m.id} className={"mcard" + (m.live ? " live" : "")} role="button" tabIndex={0} aria-label={`${(m.a && m.a.name) || tr("TBD")} vs ${(m.b && m.b.name) || tr("TBD")}`}
                onClick={() => (open ? open(m.event, m.id) : window.location.assign(m.href))}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (open) open(m.event, m.id); else window.location.assign(m.href); } }}>
                <span className="mctop">
                  {recent ? <span className="mcbadge done">{m.at ? <WhenText iso={m.at} /> : tr("Finished")}</span> : m.live ? <LiveBadge /> : (
                    <span className="mcbadge">{countdown && left > 0 ? countdownText(left, tr.lang) : <WhenText iso={m.at} />}</span>
                  )}
                  {m.bo ? <span className="bobadge" title={tr("Best of {n} maps", { n: m.bo })}>Bo{m.bo}</span> : null}
                </span>
                {showEvent && <span className="mcev">{EVENT_SHORT[m.event]}</span>}
                <span className="mcr">{label(m)}</span>
                {line(m.a, recent ? m.sa : m.live && m.score ? m.score.a : null, recent && m.win === "a", recent && m.win === "b")}
                {line(m.b, recent ? m.sb : m.live && m.score ? m.score.b : null, recent && m.win === "b", recent && m.win === "a")}
                {m.live && m.stream && <a className="mcstream" href={m.stream} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>▶ {tr("Watch")}</a>}
              </div>
            );
          })}
        </div>
        {can.r && <button type="button" className="msarrow r" aria-label={tr("Next matches")} onClick={() => go(1)}>›</button>}
      </div>
    </section>
  );
}

function WhenText({ iso }) {
  return <span>{useLocalText(iso, true)}</span>;
}

/**
 * Editor: a match's details, opened from its row: stream and VOD links, and its maps (map, score of each team, who picked it).
 * As many map rows as the match can have (Bo1: 1, Bo3: 3, Bo5: 5); empty rows are not saved.
 */
export function ExtraEdit({ id, call, bo = 3, nameA = "", nameB = "", teamA = null, teamB = null, playersA = [], playersB = [] }) {
  const tr = useT();
  const players = [...playersA, ...playersB];
  const { event, extra, onSaved } = useMatchTimes();
  const saved = extra[id] || { stream: "", vod: "", highlights: "", mvp: "", pstats: [], maps: [] };
  const blank = () => ({ map: "", a: "", b: "", pick: "" });
  const init = () => ({
    stream: saved.stream || "", vod: saved.vod || "", highlights: saved.highlights || "", mvp: saved.mvp || "",
    // a line per player of both teams, then any other saved line
    pstats: [...players, ...(saved.pstats || []).map((p) => p.name).filter((n) => !players.includes(n)), "", ""].map((name) => {
      const s = (saved.pstats || []).find((p) => p.name === name);
      return s ? { name, k: s.k, d: s.d, a: s.a, acs: s.acs } : { name, k: "", d: "", a: "", acs: "" };
    }),
    maps: Array.from({ length: Math.max(bo || 3, saved.maps.length) }, (_, i) => {
      const m = saved.maps[i];
      return m ? { map: m.map, a: m.a ?? "", b: m.b ?? "", pick: m.pick || "" } : blank();
    }),
  });
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(init);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const key = JSON.stringify(saved) + players.join();
  useEffect(() => setV(init()), [key, bo]); // eslint-disable-line react-hooks/exhaustive-deps
  const setStat = (i, k, x) => setV((o) => ({ ...o, pstats: o.pstats.map((p, j) => (j === i ? { ...p, [k]: x } : p)) }));
  const setMap = (i, k, x) => setV((o) => ({ ...o, maps: o.maps.map((m, j) => (j === i ? { ...m, [k]: x } : m)) }));
  const count = saved.maps.length;
  async function save(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const j = await call("/api/mextra", { event, id, stream: v.stream, vod: v.vod, highlights: v.highlights, mvp: v.mvp, pstats: v.pstats, maps: v.maps });
      onSaved && onSaved(tr.server(j.message));
    } catch (er) {
      setErr(tr.server(er.message));
    } finally {
      setBusy(false);
    }
  }
  const listId = "maplist";
  return (
    <span className="mxtra">
      <button type="button" className={"mxbtn" + (open ? " on" : "")} aria-expanded={open} onClick={() => setOpen(!open)}>
        {tr("Details")}{count ? ` · ${tr("{n} maps", { n: count })}` : ""}{saved.stream ? " · Stream" : ""}{saved.vod ? " · VOD" : ""} {open ? "▴" : "▾"}
      </button>
      {open && (
        <form className="mxform" onSubmit={save}>
          <datalist id={listId}>{MAP_POOL.map((m) => <option key={m} value={m} />)}</datalist>
          <div className="mxlinks">
            <label className="f">{tr("Stream link")}<input type="url" placeholder="https://twitch.tv/…" value={v.stream} onChange={(e) => setV({ ...v, stream: e.target.value })} /></label>
            <label className="f">{tr("VOD link")}<input type="url" placeholder="https://youtube.com/…" value={v.vod} onChange={(e) => setV({ ...v, vod: e.target.value })} /></label>
            <label className="f">{tr("Highlights link")}<input type="url" placeholder="https://youtube.com/…" value={v.highlights} onChange={(e) => setV({ ...v, highlights: e.target.value })} /></label>
          </div>
          <div className="mxmaps">
            <span className="mxh">{tr("Map")}</span><span className="mxh">{nameA || tr("Team 1")}</span><span className="mxh">{nameB || tr("Team 2")}</span><span className="mxh">{tr("Pick")}</span>
            {v.maps.map((m, i) => (
              <span key={i} className="mxrow">
                <input list={listId} aria-label={tr("Map {n}", { n: i + 1 })} placeholder={tr("Map {n}", { n: i + 1 })} value={m.map} maxLength={20} onChange={(e) => setMap(i, "map", e.target.value)} />
                <input type="number" min="0" max="99" aria-label={tr("{name} rounds", { name: nameA || tr("Team 1") })} value={m.a} onChange={(e) => setMap(i, "a", e.target.value)} />
                <input type="number" min="0" max="99" aria-label={tr("{name} rounds", { name: nameB || tr("Team 2") })} value={m.b} onChange={(e) => setMap(i, "b", e.target.value)} />
                <select aria-label={tr("Pick")} value={m.pick} onChange={(e) => setMap(i, "pick", e.target.value)}>
                  <option value="">–</option>
                  <option value="a">{nameA || tr("Team 1")}</option>
                  <option value="b">{nameB || tr("Team 2")}</option>
                  <option value="d">{tr("Decider")}</option>
                </select>
              </span>
            ))}
          </div>
          <label className="f mxmvp">{tr("Match MVP")}
            <input list={`mvp-${id}`} value={v.mvp} maxLength={30} onChange={(e) => setV({ ...v, mvp: e.target.value })} />
            <datalist id={`mvp-${id}`}>{players.map((n) => <option key={n} value={n} />)}</datalist>
          </label>
          <details className="mxstats">
            <summary>{tr("Players' numbers (K, D, A, ACS)")}{(saved.pstats || []).length ? ` · ${saved.pstats.length}` : ""}</summary>
            <div className="mxgrid">
              <span className="mxh">{tr("Player")}</span><span className="mxh">K</span><span className="mxh">D</span><span className="mxh">A</span><span className="mxh">ACS</span>
              {v.pstats.map((p, i) => {
                // each team's players under its name, then any other line
                const inA = i === 0 && playersA.length > 0;
                const inB = i === playersA.length && playersB.length > 0;
                const heading = inA ? nameA : inB ? nameB : i === players.length && players.length ? tr("Other players") : "";
                const team = inA ? teamA : inB ? teamB : null;
                return (
                  <Fragment key={i}>
                    {heading && <span className="mxteam">{team && <Crest team={team} />}{heading}</span>}
                    <span className="mxrow">
                      <input aria-label={tr("Player")} value={p.name} maxLength={30} onChange={(e) => setStat(i, "name", e.target.value)} />
                      {["k", "d", "a", "acs"].map((k) => <input key={k} type="number" min="0" max="999" aria-label={`${p.name} ${k.toUpperCase()}`} value={p[k]} onChange={(e) => setStat(i, k, e.target.value)} />)}
                    </span>
                  </Fragment>
                );
              })}
            </div>
          </details>
          <div className="row">
            <button className="btn pri" type="submit" disabled={busy}>{tr("Save details")}</button>
            {err && <span className="err">{err}</span>}
          </div>
        </form>
      )}
    </span>
  );
}

/** The event's rounds in order: [{ label, ids }]. An empty first-round line of a qualifier is not a match. */
function groupRounds(items, tr) {
  const rounds = [];
  for (const m of items) {
    if (m.first && !(m.a && m.b)) continue;
    const label = m.round.map(([k, v]) => tr(k, v)).join(" · ");
    const r = rounds.find((x) => x.label === label);
    if (r) r.ids.push(m.id); else rounds.push({ label, ids: [m.id] });
  }
  return rounds;
}

/** One round of RoundTimes: every one of its matches gets this day and time; empty takes their time away. */
function RoundTimeRow({ round, saved, mixed, call }) {
  const tr = useT();
  const { event, onSaved } = useMatchTimes();
  const [v, setV] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function save(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const at = v ? new Date(v).toISOString() : "";
      const j = await call("/api/mtime/bulk", { event, items: round.ids.map((id) => ({ id, at })) });
      onSaved && onSaved(tr.server(j.message));
    } catch (x) {
      setErr(tr.server(x.message));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="roundtime" onSubmit={save}>
      <span className="rtname">{round.label} <small>({round.ids.length})</small></span>
      <input type="datetime-local" aria-label={tr("Day and time of {round}", { round: round.label })} value={v} onChange={(e) => setV(e.target.value)} />
      <button className="btn" type="submit" disabled={busy || (v === saved && !mixed)}>{tr("Save")}</button>
      {mixed && !v && <span className="hint rthint">{tr("Its matches have different times.")}</span>}
      {err && <span className="err">{err}</span>}
    </form>
  );
}

/** Editor: the day and time of each round, all its matches at once. */
export function RoundTimes({ items, call }) {
  const tr = useT();
  const { times } = useMatchTimes();
  const rounds = groupRounds(items, tr);
  if (!rounds.length) return null;
  return (
    <details className="einfo roundtimes" open>
      <summary><b>{tr("Day and time of each round")}</b></summary>
      <p className="hint">{tr("Every match of the round gets this day and time. Leave it empty to remove them.")}</p>
      {rounds.map((r) => {
        const found = new Set(r.ids.map((id) => times[id] || ""));
        const mixed = found.size > 1;
        const saved = mixed ? "" : toLocalInput([...found][0]);
        return <RoundTimeRow key={`${r.label}|${[...found].join()}`} round={r} saved={saved} mixed={mixed} call={call} />;
      })}
    </details>
  );
}

/** Editor: spreads a whole round's matches over time. items: the event's matches (from matchesOf). */
export function BulkSchedule({ items, call }) {
  const tr = useT();
  const { event, onSaved } = useMatchTimes();
  const rounds = groupRounds(items, tr);
  const [round, setRound] = useState("");
  const [start, setStart] = useState("");
  const [gap, setGap] = useState(120);
  const [together, setTogether] = useState(1);
  const [err, setErr] = useState("");
  if (!rounds.length) return null;
  const cur = rounds.find((r) => r.label === round) || rounds[0];
  async function save(e) {
    e.preventDefault();
    setErr("");
    const plan = planRound(cur.ids, start, gap, together);
    if (!plan) return setErr(tr("Check the start and the numbers."));
    try {
      const j = await call("/api/mtime/bulk", { event, items: plan });
      onSaved && onSaved(tr.server(j.message));
    } catch (x) {
      setErr(tr.server(x.message));
    }
    return undefined;
  }
  return (
    <details className="einfo bulksched">
      <summary><b>{tr("Schedule a whole round")}</b></summary>
      <form onSubmit={save}>
        <div className="einfogrid">
          <label className="f">{tr("Round")}
            <select value={cur.label} onChange={(e) => setRound(e.target.value)}>{rounds.map((r) => <option key={r.label} value={r.label}>{r.label} ({r.ids.length})</option>)}</select>
          </label>
          <label className="f">{tr("First match")}<input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required /></label>
          <label className="f">{tr("Minutes between matches")}<input type="number" min="0" max="1440" value={gap} onChange={(e) => setGap(Number(e.target.value))} /></label>
          <label className="f">{tr("Matches at the same time")}<input type="number" min="1" max="32" value={together} onChange={(e) => setTogether(Number(e.target.value))} /></label>
        </div>
        <div className="row">
          <button className="btn pri" type="submit">{tr("Apply to the {n} matches", { n: cur.ids.length })}</button>
          {err && <span className="err">{err}</span>}
        </div>
      </form>
    </details>
  );
}
