"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "./lang.jsx";
import { Crest } from "./Crest.jsx";
import { fanToken } from "./Fans.jsx";
import { EVENT_NAMES } from "../lib/paths.js";
import { allMatches } from "../lib/matchlist.js";
import { AgentIcon, MapThumb } from "./Assets.jsx";

const safe = (f, d) => { try { return f(); } catch { return d; } };

// ---- tabs over parts of a page (R13, R16): the parts carry data-part, the page data-tab

export function PartTabs({ value, onChange, items, label }) {
  return (
    <div className="parttabs" role="tablist" aria-label={label}>
      {items.map(([k, text]) => <button key={k} type="button" role="tab" aria-selected={value === k} className={value === k ? "on" : ""} onClick={() => onChange(k)}>{text}</button>)}
    </div>
  );
}

// ---- R14. a player's career, team by team

const yearsOf = (period) => {
  const ys = [...String(period || "").matchAll(/(19|20)\d{2}/g)].map((m) => Number(m[0]));
  const now = new Date().getFullYear();
  if (!ys.length) return null;
  return [ys[0], /present|aujourd|now/i.test(period) || ys.length === 1 ? now : ys[ys.length - 1]];
};

export function CareerTimeline({ history }) {
  const tr = useT();
  const spans = (history || []).map((h) => ({ ...h, y: yearsOf(h.period) })).filter((h) => h.y).reverse();
  if (spans.length < 2) return null;
  const lo = Math.min(...spans.map((s) => s.y[0]));
  const hi = Math.max(...spans.map((s) => s.y[1])) + 1;
  const span = Math.max(1, hi - lo);
  const years = Array.from({ length: hi - lo }, (_, i) => lo + i);
  return (
    <section className="career">
      <h2>{tr("Career")}</h2>
      <div className="crgrid">
        <div className="cryears">{years.map((y) => <span key={y} style={{ left: `${((y - lo) / span) * 100}%` }}>{y}</span>)}</div>
        {spans.map((s, i) => (
          <div key={i} className="crrow">
            <span className="crbar" style={{ left: `${((s.y[0] - lo) / span) * 100}%`, width: `${Math.max(3, ((s.y[1] + 1 - s.y[0]) / span) * 100)}%` }} title={s.period}>{s.team}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---- R15. today's matches as cards to swipe (phones)

export function TodayCarousel({ events }) {
  const tr = useT();
  const [now, setNow] = useState(0);
  useEffect(() => setNow(Date.now()), []);
  const list = useMemo(() => {
    if (!now) return [];
    const day = (t) => new Date(t).toDateString();
    const today = day(now);
    return events.flatMap((e) => e.items.filter((m) => m.a && m.b && m.a.name && m.b.name && e.times[m.id] && day(e.times[m.id]) === today)
      .map((m) => ({ ...m, event: e.event, at: e.times[m.id], live: !!e.live[m.id] && m.sa == null, ls: e.live[m.id] })))
      .sort((x, y) => Number(y.live) - Number(x.live) || x.at.localeCompare(y.at)).slice(0, 20);
  }, [events, now]);
  if (!list.length) return null;
  const time = (iso) => new Date(iso).toLocaleTimeString(tr.lang === "en" ? "en-GB" : tr.lang, { hour: "2-digit", minute: "2-digit" });
  return (
    <section className="todaycar" aria-label={tr("Today")}>
      <h2>{tr("Today")} <small>({list.length})</small></h2>
      <div className="tcrow">
        {list.map((m) => (
          <a key={m.event + m.id} href={`/match/${m.event}/${m.id}`} className={"tccard" + (m.live ? " live" : m.sa != null ? " done" : "")}>
            <small>{m.live ? `● ${tr("LIVE")}` : m.sa != null ? tr("Finished") : time(m.at)} · {tr(EVENT_NAMES[m.event] || m.event)}</small>
            <div className="tcteams">
              <span><Crest team={m.a} />{m.a.name}</span>
              <b className="spoil">{m.sa != null ? `${m.sa}–${m.sb}` : m.live && m.ls ? `${m.ls.a ?? 0}–${m.ls.b ?? 0}` : "vs"}</b>
              <span><Crest team={m.b} />{m.b.name}</span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

// ---- R17. a bracket, one round at a time (phones)

export function RoundList({ bracket, rounds, slots, roundName }) {
  const tr = useT();
  const playable = rounds.filter((r) => bracket.matches.some((m) => m.round === r.key && (m.a || m.b)));
  const firstOpen = playable.find((r) => bracket.matches.some((m) => m.round === r.key && m.a && m.b && m.winner == null));
  const [cur, setCur] = useState((firstOpen || playable[playable.length - 1] || rounds[0] || {}).key);
  const ref = useRef(null);
  useEffect(() => { const el = ref.current && ref.current.querySelector('[aria-selected="true"]'); if (el) el.scrollIntoView({ block: "nearest", inline: "center" }); }, [cur]);
  if (!playable.length) return null;
  const name = (s) => (s && slots[s - 1] ? slots[s - 1].name : tr("TBD"));
  const list = bracket.matches.filter((m) => m.round === cur && (m.a || m.b) && !m.bye);
  return (
    <div className="roundlist">
      <div className="parttabs scroll" role="tablist" ref={ref}>
        {playable.map((r) => <button key={r.key} type="button" role="tab" aria-selected={cur === r.key} className={cur === r.key ? "on" : ""} onClick={() => setCur(r.key)}>{tr(roundName(r))}</button>)}
      </div>
      <div className="rlist">
        {list.map((m) => (
          <div key={m.id} className="rlrow">
            <span className={m.winner && m.winner === m.a ? "w" : m.winner ? "lo" : ""}><Crest team={m.a ? slots[m.a - 1] : null} />{name(m.a)}</span>
            <b className="spoil">{m.sa != null ? `${m.sa} – ${m.sb}` : "vs"}</b>
            <span className={"r " + (m.winner && m.winner === m.b ? "w" : m.winner ? "lo" : "")}>{name(m.b)}<Crest team={m.b ? slots[m.b - 1] : null} /></span>
          </div>
        ))}
        {list.length === 0 && <p className="note">{tr("No match in this round yet.")}</p>}
      </div>
    </div>
  );
}

// ---- V4. the compact mode

export const DENSITY_KEY = "vct-density";
export const DENSITY_SCRIPT = `try{if(localStorage.getItem("${DENSITY_KEY}")==="compact")document.documentElement.dataset.density="compact"}catch(e){}`;

export function DensitySwitch() {
  const tr = useT();
  const [on, setOn] = useState(false);
  useEffect(() => setOn(document.documentElement.dataset.density === "compact"), []);
  const toggle = () => {
    const next = !on;
    setOn(next);
    if (next) document.documentElement.dataset.density = "compact"; else delete document.documentElement.dataset.density;
    safe(() => (next ? localStorage.setItem(DENSITY_KEY, "compact") : localStorage.removeItem(DENSITY_KEY)), null);
  };
  return <label className="sw densw"><input type="checkbox" checked={on} onChange={toggle} /> {tr("Compact mode")}</label>;
}

// ---- A6. agents by map

export function AgentMapTable({ data }) {
  const tr = useT();
  if (!data || !data.maps.length || !data.agents.length) return null;
  return (
    <section>
      <h2>{tr("Agents by map")}</h2>
      <p className="note">{tr("The share of teams that picked each agent on each map.")}</p>
      <div className="tablewrap"><table className="agmap">
        <thead><tr><th>{tr("Map")}</th>{data.agents.map((a) => <th key={a}><AgentIcon name={a} size={26} /></th>)}</tr></thead>
        <tbody>{data.maps.map(({ map, games }) => (
          <tr key={map}><th scope="row" data-map={map}><MapThumb map={map}><small> ({games})</small></MapThumb></th>
            {data.keys.map((k) => { const v = data.cells[`${map}|${k}`] || 0; return <td key={k} style={{ "--v": v / 100 }} className={v >= 50 ? "hot" : ""}>{v ? `${v}%` : "–"}</td>; })}
          </tr>
        ))}</tbody>
      </table></div>
    </section>
  );
}

// ---- A8. players in form

export function FormList({ list }) {
  const tr = useT();
  if (!list || !list.length) return null;
  return (
    <section>
      <h2>📈 {tr("Players in form")}</h2>
      <p className="note">{tr("Their rating over the last 14 days against their season average.")}</p>
      <ol className="formlist">{list.map((p) => (
        <li key={p.slug}><a href={`/player/${p.slug}`}>{p.name}</a><small>{p.team}</small><span>{p.season.toFixed(2)} → <b>{p.recent.toFixed(2)}</b></span><em className={p.delta >= 0 ? "up" : "down"}>{p.delta >= 0 ? "+" : ""}{p.delta.toFixed(2)}</em></li>
      ))}</ol>
    </section>
  );
}

// ---- A7. a visitor's accuracy over time

export function AccuracyChart() {
  const tr = useT();
  const [weeks, setWeeks] = useState(null);
  useEffect(() => {
    fetch("/api/accuracy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: fanToken() }) }).then((r) => r.json()).then((j) => setWeeks(j.weeks || [])).catch(() => setWeeks([]));
  }, []);
  if (!weeks || weeks.length < 2) return null;
  const W = 600;
  const H = 160;
  const pts = weeks.map((w, i) => [30 + (i * (W - 50)) / (weeks.length - 1), H - 20 - (w.good / w.total) * (H - 40)]);
  return (
    <section>
      <h2>{tr("Your accuracy, week by week")}</h2>
      <svg viewBox={`0 0 ${W} ${H}`} className="accchart" role="img" aria-label={tr("Your accuracy, week by week")}>
        {[0, 50, 100].map((p) => <g key={p}><line x1="30" x2={W - 10} y1={H - 20 - (p / 100) * (H - 40)} y2={H - 20 - (p / 100) * (H - 40)} className="acgrid" /><text x="0" y={H - 16 - (p / 100) * (H - 40)} className="aclabel">{p}%</text></g>)}
        <polyline points={pts.map((p) => p.join(",")).join(" ")} className="acline" />
        {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" className="acdot"><title>{`${weeks[i].week} : ${weeks[i].good}/${weeks[i].total}`}</title></circle>)}
      </svg>
    </section>
  );
}

// ---- E4. the control room: every live and coming match of the day on one screen, for the editors

export function ControlRoom({ initial, call, onDone, notes: given }) {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(given || {});
  const [vals, setVals] = useState({});
  useEffect(() => { if (open) call("/api/notes", {}).then((j) => setNotes(j.notes || {})).catch(() => {}); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = useMemo(() => {
    const out = [];
    const day = new Date().toDateString();
    for (const [event, times] of Object.entries(initial.times || {})) {
      for (const [id, at] of Object.entries(times)) if (new Date(at).toDateString() === day) out.push({ event, id, at });
    }
    for (const [event, ids] of Object.entries(initial.live || {})) for (const id of Object.keys(ids)) if (!out.some((x) => x.event === event && x.id === id)) out.push({ event, id, at: "" });
    return out;
  }, [initial]);
  const byKey = new Map(allMatches(initial).map((m) => [`${m.event}:${m.id}`, m]));
  const rows = list.map((x) => byKey.get(`${x.event}:${x.id}`)).filter((m) => m && m.a && m.b && m.a.name && m.b.name).sort((a, b) => Number(!!b.live) - Number(!!a.live) || (a.at || "").localeCompare(b.at || ""));
  const live = (m) => (initial.live[m.event] || {})[m.id] || { a: 0, b: 0 };
  const setLive = async (m, a, b) => { try { const j = await call("/api/mlive", { event: m.event, id: m.id, live: true, a: Math.max(0, a), b: Math.max(0, b) }); onDone(tr.server(j.message)); } catch (e) { onDone(tr.server(e.message)); } };
  const final = async (m) => {
    const v = vals[`${m.event}:${m.id}`] || {};
    try { const j = await call("/api/bulkscore", { scores: [{ event: m.event, id: m.id, sa: Number(v.sa), sb: Number(v.sb) }] }); onDone(j.failed.length ? tr.server(j.failed[0].error) : tr("{n} score(s) saved.", { n: j.saved })); } catch (e) { onDone(tr.server(e.message)); }
  };
  const note = async (m, body) => { try { const j = await call("/api/notes", { event: m.event, id: m.id, body }); setNotes(j.notes || {}); } catch (e) { onDone(tr.server(e.message)); } };
  return (
    <>
      <p><button type="button" className="btn pri" onClick={() => setOpen(true)}>🎛️ {tr("Control room")}</button> <small className="hint">{tr("Every live and coming match of the day on one screen.")}</small></p>
      {open && (
        <div className="regie" role="dialog" aria-label={tr("Control room")}>
          <div className="regiehead"><b>🎛️ {tr("Control room")}</b><small>{rows.length} {tr("Matches").toLowerCase()}</small><button type="button" className="btn" onClick={() => { setOpen(false); window.location.reload(); }}>{tr("Close")}</button></div>
          <div className="regiegrid">
            {rows.length === 0 && <p className="note">{tr("No match today.")}</p>}
            {rows.map((m) => {
              const k = `${m.event}:${m.id}`;
              const s = live(m);
              return (
                <div key={k} className={"regiecard" + (m.live ? " live" : "")}>
                  <small>{tr(EVENT_NAMES[m.event] || m.event)} · {m.id} · Bo{m.bo}{m.at ? ` · ${new Date(m.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}` : ""}</small>
                  <b>{m.a.name} <span className="rgscore">{m.sa != null ? `${m.sa}–${m.sb}` : `${s.a ?? 0}–${s.b ?? 0}`}</span> {m.b.name}</b>
                  {m.sa == null && (
                    <div className="row">
                      <button type="button" className="btn small" onClick={() => setLive(m, (s.a || 0) + 1, s.b || 0)}>+1 {m.a.tag || m.a.name.slice(0, 6)}</button>
                      <button type="button" className="btn small" onClick={() => setLive(m, s.a || 0, (s.b || 0) + 1)}>+1 {m.b.tag || m.b.name.slice(0, 6)}</button>
                      <input type="number" min="0" max="5" placeholder="A" value={(vals[k] || {}).sa ?? ""} onChange={(e) => setVals({ ...vals, [k]: { ...(vals[k] || {}), sa: e.target.value } })} style={{ width: 48 }} />
                      <input type="number" min="0" max="5" placeholder="B" value={(vals[k] || {}).sb ?? ""} onChange={(e) => setVals({ ...vals, [k]: { ...(vals[k] || {}), sb: e.target.value } })} style={{ width: 48 }} />
                      <button type="button" className="btn small pri" onClick={() => final(m)}>{tr("Final score")}</button>
                    </div>
                  )}
                  <textarea rows={2} defaultValue={(notes[k] || {}).body || ""} placeholder={tr("Note for the editors (not shown on the site)")} onBlur={(e) => e.target.value !== ((notes[k] || {}).body || "") && note(m, e.target.value)} />
                  {(notes[k] || {}).who !== undefined && notes[k] && <small className="hint">{tr("Note by {who}", { who: notes[k].who || tr("Main account") })}</small>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// ---- V5. one colour per map

export const MAP_HUES = { Abyss: 265, Ascent: 205, Bind: 25, Breeze: 175, Corrode: 95, Fracture: 330, Haven: 45, Icebox: 195, Lotus: 300, Pearl: 225, Split: 0, Sunset: 15 };
export const mapStyle = (map) => (MAP_HUES[map] != null ? { "--maph": MAP_HUES[map] } : undefined);
