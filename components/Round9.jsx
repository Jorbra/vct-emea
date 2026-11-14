"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "./lang.jsx";
import { Crest } from "./Crest.jsx";
import { Score } from "./visual.jsx";
import { fanToken } from "./Fans.jsx";
import { useFavorites } from "./favorites.js";
import { EVENT_NAMES, teamSlug } from "../lib/paths.js";
import { localeOf } from "../lib/i18n.js";
import { DensitySwitch } from "./Round10.jsx";
import { FootAgents } from "./Round15.jsx";

const safe = (f, d) => { try { return f(); } catch { return d; } };

// ---- R7. an event's header: what is at stake, how far it is, when the next match is

export function EventHero({ numbers, teams, qualified = [], favCount }) {
  const tr = useT();
  const fav = useFavorites();
  const [now, setNow] = useState(0);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const mine = favCount != null ? favCount : teams.filter((t) => t && t.name && fav.has(teamSlug(t.name))).length;
  const left = numbers.next && now ? new Date(numbers.next).getTime() - now : 0;
  const when = left > 0 ? (left > 86400000 ? tr("in {n} d", { n: Math.round(left / 86400000) }) : left > 3600000 ? tr("in {n} h", { n: Math.floor(left / 3600000) }) : tr("in {n} min", { n: Math.max(1, Math.round(left / 60000)) })) : "";
  const pct = numbers.total ? Math.round((numbers.played / numbers.total) * 100) : 0;
  return (
    <div className="evhero">
      <div className="evhnums">
        <div><b>{numbers.played}<small>/{numbers.total}</small></b><span>{tr("Matches played")}</span><i className="evhbar"><em style={{ width: `${pct}%` }} /></i></div>
        {numbers.live > 0 ? <div className="evhlive"><b>{numbers.live}</b><span>{tr("Live now")}</span></div> : when ? <div><b>{when}</b><span>{tr("Next match")}</span></div> : null}
        {numbers.places > 0 && <div><b>{numbers.places}</b><span>{numbers.places === 1 ? tr("place goes on") : tr("places go on")}</span></div>}
        <div><b>⭐ {mine}</b><span>{tr("of your teams")}</span></div>
      </div>
      {qualified.length > 0 && (
        <div className="evhqual"><span>{tr("Qualified")} :</span>{qualified.map((t) => <a key={t.name} href={`/team/${teamSlug(t.name)}`}><Crest team={t} />{t.name}</a>)}</div>
      )}
    </div>
  );
}

// ---- R8. the live matches as a TV wall

export function TvMode({ live }) {
  const tr = useT();
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!on) return undefined;
    const esc = (e) => { if (e.key === "Escape") setOn(false); };
    window.addEventListener("keydown", esc);
    safe(() => document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}), null);
    return () => { window.removeEventListener("keydown", esc); safe(() => document.fullscreenElement && document.exitFullscreen(), null); };
  }, [on]);
  if (!live.length) return null;
  return (
    <>
      <p><button type="button" className="btn" onClick={() => setOn(true)}>📺 {tr("TV mode")}</button></p>
      {on && (
        <div className="tvwall" role="dialog" aria-label={tr("TV mode")}>
          <button type="button" className="tvclose" onClick={() => setOn(false)} aria-label={tr("Close")}>×</button>
          <div className={"tvgrid n" + Math.min(live.length, 6)}>
            {live.slice(0, 6).map((m) => (
              <div key={m.event + m.id} className="tvcard">
                <small>{tr(EVENT_NAMES[m.event] || m.event)}{m.bo ? ` · Bo${m.bo}` : ""}</small>
                <div className="tvteams">
                  <div><Crest team={m.a} /><b>{(m.a && m.a.name) || tr("TBD")}</b></div>
                  <Score className="tvscore spoil" value={m.score ? `${m.score.a} – ${m.score.b}` : "vs"} />
                  <div><Crest team={m.b} /><b>{(m.b && m.b.name) || tr("TBD")}</b></div>
                </div>
                {m.score && (m.score.maps || []).length > 0 && <div className="tvmaps">{m.score.maps.map((x) => <span key={x.map} className={x.done ? "done" : "now"}>{x.map} <b className="spoil">{x.a}–{x.b}</b></span>)}</div>}
              </div>
            ))}
          </div>
          <p className="tvhint">{tr("Refreshed every 30 seconds · Escape to leave")}</p>
        </div>
      )}
    </>
  );
}

// ---- R9. the calendar as a week

export function WeekView({ matches }) {
  const tr = useT();
  const [start, setStart] = useState(null);
  useEffect(() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); setStart(d); }, []);
  const days = useMemo(() => (start ? Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)) : []), [start]);
  if (!start) return null;
  const key = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const byDay = new Map(days.map((d) => [key(d), []]));
  for (const m of matches) { const d = new Date(m.at); const k = key(d); if (byDay.has(k)) byDay.get(k).push(m); }
  const hours = [...new Set([...byDay.values()].flat().map((m) => new Date(m.at).getHours()))].sort((a, b) => a - b);
  const fmt = new Intl.DateTimeFormat(localeOf(tr.lang), { weekday: "short", day: "numeric" });
  const move = (n) => setStart(new Date(start.getFullYear(), start.getMonth(), start.getDate() + n * 7));
  return (
    <div className="weekview">
      <div className="calmonth"><button type="button" className="btn" onClick={() => move(-1)} aria-label={tr("Previous week")}>‹</button><b>{fmt.format(days[0])} – {fmt.format(days[6])}</b><button type="button" className="btn" onClick={() => move(1)} aria-label={tr("Next week")}>›</button></div>
      {hours.length === 0 ? <p className="note">{tr("No match this week.")}</p> : (
        <div className="wkgrid" style={{ gridTemplateColumns: `52px repeat(7, minmax(0, 1fr))` }}>
          <span />
          {days.map((d) => <b key={key(d)} className={"wkday" + (key(d) === key(new Date()) ? " today" : "")}>{fmt.format(d)}</b>)}
          {hours.map((h) => [
            <span key={`h${h}`} className="wkhour">{String(h).padStart(2, "0")}h</span>,
            ...days.map((d) => {
              const list = byDay.get(key(d)).filter((m) => new Date(m.at).getHours() === h);
              return (
                <div key={`${h}${key(d)}`} className="wkcell">
                  {list.slice(0, 4).map((m) => <a key={m.event + m.id} href={`/match/${m.event}/${m.id}`} className={"wkm" + (m.live ? " live" : m.sa != null ? " done" : "")} title={`${m.a.name} vs ${m.b.name}`}>{(m.a.tag || m.a.name).slice(0, 6)}–{(m.b.tag || m.b.name).slice(0, 6)}</a>)}
                  {list.length > 4 && <small>+{list.length - 4}</small>}
                </div>
              );
            }),
          ])}
        </div>
      )}
    </div>
  );
}

// ---- V1. the accent colour

export const ACCENT_KEY = "vct-accent";
export const ACCENTS = { lime: ["#c9f03c", "#151a02"], red: ["#ff4655", "#ffffff"], blue: ["#5aa9ff", "#04122a"], violet: ["#a78bfa", "#150a33"], orange: ["#f2a63b", "#1f1200"] };
export const ACCENT_SCRIPT = `try{var a=localStorage.getItem("${ACCENT_KEY}");if(a)document.documentElement.dataset.accent=a}catch(e){}`;

export function AccentPicker() {
  const tr = useT();
  const [cur, setCur] = useState("lime");
  useEffect(() => setCur(document.documentElement.dataset.accent || "lime"), []);
  const pick = (k) => {
    setCur(k);
    if (k === "lime") delete document.documentElement.dataset.accent; else document.documentElement.dataset.accent = k;
    safe(() => (k === "lime" ? localStorage.removeItem(ACCENT_KEY) : localStorage.setItem(ACCENT_KEY, k)), null);
  };
  return (
    <div className="accents" role="radiogroup" aria-label={tr("Accent colour")}>
      {Object.entries(ACCENTS).map(([k, [c]]) => <button key={k} type="button" role="radio" aria-checked={cur === k} aria-label={k} className={"accdot" + (cur === k ? " on" : "")} style={{ background: c }} onClick={() => pick(k)} />)}
    </div>
  );
}

// ---- R12. the footer

export function SiteFooter() {
  const tr = useT();
  return (
    <footer className="sitefoot">
      <FootAgents />
      <div className="ftcols">
        <div><b>VCT EMEA</b><p>{tr("Results, brackets, schedule and teams of the VCT EMEA and Game Changers EMEA, updated live.")}</p><AccentPicker /><DensitySwitch /></div>
        <div><b>{tr("Follow")}</b><a href="/live">{tr("Live")}</a><a href="/calendar">{tr("Calendar")}</a><a href="/soiree">{tr("Match night")}</a><a href="/news">{tr("News")}</a></div>
        <div><b>{tr("Play")}</b><a href="/predictions">{tr("Predictions")}</a><a href="/jeux">{tr("Games of the day")}</a><a href="/fantasy">Fantasy</a><a href="/tierlist">{tr("Tier list")}</a></div>
        <div><b>{tr("Learn")}</b><a href="/format">{tr("How the events work")}</a><a href="/palmares">{tr("Hall of fame")}</a><a href="/equipes">{tr("Compare teams")}</a><a href="/agent">{tr("Agents")}</a><a href="/map">{tr("Maps")}</a><a href="/overlay/studio">{tr("Stream overlays")}</a><a href="/about">{tr("About")}</a></div>
      </div>
      <p className="ftnote">{tr("Fan site, not affiliated with Riot Games. Data from Toornament, vlr.gg and Liquipedia (CC-BY-SA).")}</p>
    </footer>
  );
}

// ---- V3. while a page loads

export function PageSkeleton() {
  return (
    <div className="wrap pageskel" aria-busy="true" aria-label="…">
      <div className="sk sk-title" />
      <div className="sk sk-bar" />
      <div className="skgrid">{Array.from({ length: 6 }, (_, i) => <div key={i} className="sk sk-card" />)}</div>
    </div>
  );
}

// ---- A2. the MVP of each event

export function MvpPicks({ name }) {
  const tr = useT();
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState("");
  const load = (body = {}) => fetch("/api/mvp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: fanToken(), ...body }) }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; });
  useEffect(() => { load().then(setD).catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d || !d.events.length) return null;
  const save = async (event, player) => { setMsg(""); try { setD(await load({ event, player })); setMsg(tr("MVP pick saved.")); } catch (e) { setMsg(tr.server(e.message)); } };
  return (
    <section className="mvppicks">
      <h2>🏅 {tr("MVP of each event")}</h2>
      <p className="note">{tr("Who will be the best player (rating) of the event? Pick before its first match.")}</p>
      <div className="mvplist">
        {d.events.map((e) => {
          const mine = d.mine[e.event] || "";
          return (
            <div key={e.event} className="mvpev">
              <b>{tr(e.name)}</b>
              {e.mvp ? <span>{tr("MVP")} : <b>{e.mvp}</b> {mine ? (mine.toLowerCase() === e.mvp.toLowerCase() ? "✅" : `❌ (${mine})`) : ""}</span>
                : e.open ? (
                  <>
                    <input list={`mvp-${e.event}`} defaultValue={mine} placeholder={tr("A player's name")} disabled={!name} onBlur={(ev) => ev.target.value && ev.target.value !== mine && save(e.event, ev.target.value)} />
                    <datalist id={`mvp-${e.event}`}>{e.players.map((p) => <option key={p} value={p} />)}</datalist>
                  </>
                ) : <span className="hint">{mine ? tr("Your pick: {name}", { name: mine }) : tr("Closed")}</span>}
            </div>
          );
        })}
      </div>
      {!name && <p className="hint">{tr("Make a first prediction to get your name first.")}</p>}
      {msg && <p className="hint" role="status">{msg}</p>}
    </section>
  );
}

// ---- A5. the fan's avatar and colour

export function StyleEditor() {
  const tr = useT();
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState("");
  const call = (body = {}) => fetch("/api/style", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: fanToken(), ...body }) }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; });
  useEffect(() => { call().then(setD).catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return null;
  const save = async (patch) => { const next = { ...d.style, ...patch }; setD({ ...d, style: next }); try { await call({ save: true, ...next }); setMsg(tr("Profile saved.")); } catch (e) { setMsg(tr.server(e.message)); } };
  return (
    <details className="styleed">
      <summary>🎨 {tr("My avatar and colour")}</summary>
      <div className="stylepick">{d.emojis.map((e) => <button key={e} type="button" className={"btn small" + (d.style.emoji === e ? " on" : "")} onClick={() => save({ emoji: d.style.emoji === e ? "" : e })}>{e}</button>)}</div>
      <div className="stylepick">{d.colors.map((c) => <button key={c} type="button" className={"accdot" + (d.style.color === c ? " on" : "")} style={{ background: c }} aria-label={c} onClick={() => save({ color: d.style.color === c ? "" : c })} />)}</div>
      {msg && <p className="hint" role="status">{msg}</p>}
    </details>
  );
}

/** A fan's name with their avatar and colour. */
export const FanName = ({ name, style }) => <span className="fanname" style={style && style.color ? { color: style.color } : undefined}>{style && style.emoji ? `${style.emoji} ` : ""}{name}</span>;

// ---- B1. the latest qualified teams, on the home page

export function QualifiedStrip({ list }) {
  const tr = useT();
  if (!list.length) return null;
  return (
    <section className="qualstrip">
      <h2>🎟️ {tr("Qualified teams")}</h2>
      <div className="qualrow">{list.map((q) => <a key={q.event + q.slug} href={`/team/${q.slug}`} className="qualcard" title={q.team}><Crest team={{ name: q.team, logo: q.logo }} /><b>{q.team}</b><small>{tr(q.name)} → {tr(q.to)}</small></a>)}</div>
    </section>
  );
}

// ---- E1, E2. the editor: teams with no logo, many scores at once

export function MissingLogos({ list, onOpen }) {
  const tr = useT();
  if (!list.length) return null;
  const total = list.reduce((s, x) => s + x.teams.length, 0);
  return (
    <section>
      <details className="einfo">
        <summary><b>🖼️ {tr("Teams with no logo")}</b> <small>{total}</small></summary>
        {list.map((e) => (
          <div key={e.event} className="mlrow">
            <h3 className="sub">{tr(e.name)} <small>({e.teams.length})</small> <button type="button" className="btn small" onClick={() => onOpen(e.event, true)}>{tr("Add logos")}</button></h3>
            <p className="hint">{e.teams.slice(0, 40).join(", ")}{e.teams.length > 40 ? " …" : ""}</p>
          </div>
        ))}
        <p className="hint">{tr("They show the default logo for now. In the event's teams, give each a short tag and upload its logo.")}</p>
      </details>
    </section>
  );
}

export function BulkScores({ list, call, onDone }) {
  const tr = useT();
  const [vals, setVals] = useState({});
  const set = (k, side, v) => setVals((x) => ({ ...x, [k]: { ...(x[k] || {}), [side]: v } }));
  const ready = Object.entries(vals).filter(([, v]) => v.sa !== "" && v.sb !== "" && v.sa != null && v.sb != null);
  const send = async () => {
    const scores = ready.map(([k, v]) => { const [event, id] = k.split("|"); return { event, id, sa: Number(v.sa), sb: Number(v.sb) }; });
    try { const j = await call("/api/bulkscore", { scores }); onDone(tr("{n} score(s) saved.", { n: j.saved }) + (j.failed.length ? ` · ${tr("{n} refused", { n: j.failed.length })}` : "")); window.location.reload(); } catch (e) { onDone(tr.server(e.message)); }
  };
  if (!list.length) return null;
  return (
    <section>
      <details className="einfo">
        <summary><b>✍️ {tr("Enter many scores")}</b> <small>{list.length}</small></summary>
        <div className="tablewrap"><table className="bulk">
          <thead><tr><th>{tr("Match")}</th><th>Bo</th><th>{tr("Score")}</th></tr></thead>
          <tbody>{list.map((m) => {
            const k = `${m.event}|${m.id}`;
            return (
              <tr key={k}>
                <td>{m.live ? "🔴 " : ""}{m.a} vs {m.b}<small className="hint"> · {tr(EVENT_NAMES[m.event] || m.event)}</small></td>
                <td>{m.bo}</td>
                <td className="row"><input type="number" min="0" max="5" value={(vals[k] || {}).sa ?? ""} onChange={(e) => set(k, "sa", e.target.value)} style={{ width: 54 }} aria-label={m.a} /> – <input type="number" min="0" max="5" value={(vals[k] || {}).sb ?? ""} onChange={(e) => set(k, "sb", e.target.value)} style={{ width: 54 }} aria-label={m.b} /></td>
              </tr>
            );
          })}</tbody>
        </table></div>
        <p className="row"><button type="button" className="btn pri" disabled={!ready.length} onClick={send}>{tr("Save {n} score(s)", { n: ready.length })}</button></p>
        <p className="hint">{tr("Saved together as one change: one undo takes them all back.")}</p>
      </details>
    </section>
  );
}
