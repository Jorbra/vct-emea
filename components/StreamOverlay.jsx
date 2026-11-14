"use client";

// The stream overlays, for OBS (a 1920×1080 browser source, transparent background): scoreboard, next match, ticker,
// standby screen, result card and the match's maps. They read /api/overlay every 10 s.
import { useEffect, useState } from "react";
import { LangProvider, useT } from "./lang.jsx";
import { Crest } from "./Crest.jsx";
import { useTeamColor } from "./visual.jsx";
import { mapList, mapSplash } from "./Assets.jsx";
import { localeOf } from "../lib/i18n.js";

const ACCENT = "#c9f03c";

/** The overlay's data, read again every 10 s (and at once when the tab comes back). */
function useOverlay(initial, p) {
  const [d, setD] = useState(initial);
  useEffect(() => {
    let on = true;
    const qs = new URLSearchParams({ ...(p.event ? { event: p.event } : {}), ...(p.match ? { match: p.match } : {}) }).toString();
    const load = () => fetch(`/api/overlay${qs ? `?${qs}` : ""}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (on && j) setD(j); }).catch(() => { /* offline: keep what is shown */ });
    const t = setInterval(load, 10000);
    return () => { on = false; clearInterval(t); };
  }, [p.event, p.match]);
  return d;
}

/** The clock, ticking every second (for countdowns). */
function useNow() {
  const [now, setNow] = useState(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  return now;
}

const roundOf = (m, tr) => (m.round || []).map(([k, v]) => tr(k, v)).join(" · ");
const tag = (t) => (t ? t.tag || t.name : "TBD");
const timeOf = (iso, lang) => (iso ? new Intl.DateTimeFormat(localeOf(lang), { hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "");
const dayOf = (iso, lang) => (iso ? new Intl.DateTimeFormat(localeOf(lang), { weekday: "short", day: "numeric", month: "short" }).format(new Date(iso)) : "");
const left = (ms) => {
  if (ms <= 0) return "00:00";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const pad = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}` : `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
};

// ---- scoreboard: the bar at the top (or bottom) of the screen

function Side({ t, score, side, won, live }) {
  const color = useTeamColor(t && t.logo);
  return (
    <div className={"osside " + side + (won ? " won" : "")} style={color ? { "--team": color } : undefined}>
      <span className="oscrest"><Crest team={t} /></span>
      <span className="osname"><b>{tag(t)}</b><small>{t ? t.name : ""}</small></span>
      <span className={"osscore" + (live ? " live" : "")}>{score ?? "–"}</span>
    </div>
  );
}

function Scoreboard({ d, p }) {
  const tr = useT();
  const m = d.match;
  if (!m) return null;
  const now = m.maps.find((x) => !x.done && x.map) || null;
  const need = m.bo ? Math.ceil(m.bo / 2) : 0;
  const pips = (won) => (need > 1 ? <span className="ospips">{Array.from({ length: need }, (_, i) => <i key={i} className={i < won ? "on" : ""} />)}</span> : null);
  return (
    <div className={"osboard " + p.pos}>
      <div className="osbar">
        <Side t={m.a} score={m.sa} side="a" won={m.done && m.win === "a"} live={m.live} />
        <div className="osmid">
          <span className="osstate">{m.live ? <><i className="osdot" />{tr("LIVE")}</> : m.done ? tr("Final") : `${dayOf(m.at, tr.lang)} · ${timeOf(m.at, tr.lang)}`}</span>
          <span className="osbo">{m.bo ? `Bo${m.bo}` : "vs"}</span>
          <div className="ospipsrow">{pips(m.sa || 0)}{pips(m.sb || 0)}</div>
        </div>
        <Side t={m.b} score={m.sb} side="b" won={m.done && m.win === "b"} live={m.live} />
      </div>
      <div className="osinfo">
        <span>{tr(m.eventName)}{roundOf(m, tr) ? ` · ${roundOf(m, tr)}` : ""}</span>
        {now && <span className="osnow" style={mapList(now.map) ? { "--mapimg": `url(${mapList(now.map)})` } : undefined}><b>{now.map}</b>{now.a != null ? ` ${now.a} – ${now.b}` : ""}</span>}
      </div>
    </div>
  );
}

// ---- next match with its countdown

function NextMatch({ d }) {
  const tr = useT();
  const now = useNow();
  // the next match; when none is planned, the one being played
  const m = (d.match && !d.match.done && !d.match.live ? d.match : d.upcoming[0]) || d.live[0] || (d.match && d.match.live ? d.match : null);
  if (!m) return null;
  const ms = m.at && now ? new Date(m.at).getTime() - now : 0;
  return (
    <div className="osnext">
      <small>{m.live ? <><i className="osdot" /> {tr("LIVE")}</> : tr("Next match")}</small>
      <div className="osnextvs">
        <span><Crest team={m.a} /><b>{tag(m.a)}</b></span>
        <em>vs</em>
        <span><b>{tag(m.b)}</b><Crest team={m.b} /></span>
      </div>
      <div className="osnextinfo">{tr(m.eventName)}{roundOf(m, tr) ? ` · ${roundOf(m, tr)}` : ""}{m.bo ? ` · Bo${m.bo}` : ""}</div>
      {m.live ? <div className="oscount">{m.sa} – {m.sb}</div> : <div className="oscount">{m.at ? (ms > 0 ? left(ms) : tr("Starting soon")) : tr("Time to be announced")}</div>}
      {m.at && !m.live && <div className="osnextinfo">{dayOf(m.at, tr.lang)} · {timeOf(m.at, tr.lang)}</div>}
    </div>
  );
}

// ---- ticker: a band at the bottom with live matches, results and what is coming

function Ticker({ d }) {
  const tr = useT();
  const items = [
    ...d.live.map((m) => <span key={`l${m.event}${m.id}`} className="otlive"><i className="osdot" />{tag(m.a)} <b>{m.sa}–{m.sb}</b> {tag(m.b)}</span>),
    ...d.results.slice(0, 8).map((m) => <span key={`r${m.event}${m.id}`}><b className={m.win === "a" ? "w" : ""}>{tag(m.a)}</b> <em>{m.sa}–{m.sb}</em> <b className={m.win === "b" ? "w" : ""}>{tag(m.b)}</b></span>),
    ...d.upcoming.slice(0, 6).map((m) => <span key={`u${m.event}${m.id}`}><small>{timeOf(m.at, tr.lang)}</small> {tag(m.a)} vs {tag(m.b)}</span>),
  ];
  if (!items.length) return null;
  return (
    <div className="osticker">
      <b className="otlabel">VCT EMEA</b>
      <div className="ottrack"><div className="otmove">{items}{items.map((x, i) => <span key={`dup${i}`} aria-hidden="true">{x.props.children}</span>)}</div></div>
    </div>
  );
}

// ---- standby: the whole screen before the stream starts or during a break

function Standby({ d, p }) {
  const tr = useT();
  const now = useNow();
  const next = d.upcoming[0] || null;
  let target = next && next.at ? new Date(next.at).getTime() : 0;
  if (p.until && now) {
    const [h, mi] = p.until.split(":").map(Number);
    const t = new Date(now);
    t.setHours(h, mi, 0, 0);
    if (t.getTime() < now - 60000) t.setDate(t.getDate() + 1);
    target = t.getTime();
  }
  const bg = (d.match && d.match.maps.length && mapSplash(d.match.maps[d.match.maps.length - 1].map)) || mapSplash("Ascent");
  return (
    <div className="osstandby" style={bg ? { "--bg": `url(${bg})` } : undefined}>
      <div className="osstandin">
        <small>VCT EMEA</small>
        <h1>{p.title || tr("The stream starts soon")}</h1>
        {target > 0 && now && <div className="oscount big">{target - now > 0 ? left(target - now) : tr("Starting soon")}</div>}
        {d.upcoming.length > 0 && (
          <div className="osupnext">
            <h2>{tr("Coming up")}</h2>
            {d.upcoming.slice(0, 5).map((m) => (
              <div key={m.event + m.id} className="osuprow">
                <span className="ostime">{timeOf(m.at, tr.lang)}</span>
                <span><Crest team={m.a} />{m.a.name}</span>
                <em>vs</em>
                <span>{m.b.name}<Crest team={m.b} /></span>
                <small>{tr(m.eventName)}</small>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- result: the card at the end of a match

function Result({ d }) {
  const tr = useT();
  const m = d.match && d.match.done ? d.match : d.results[0];
  if (!m) return null;
  const winner = m.win === "a" ? m.a : m.b;
  return (
    <div className="osresult">
      <small>{tr("Final")} · {tr(m.eventName)}{roundOf(m, tr) ? ` · ${roundOf(m, tr)}` : ""}</small>
      <div className="osresvs">
        <span className={m.win === "a" ? "w" : "l"}><Crest team={m.a} /><b>{m.a.name}</b></span>
        <strong>{m.sa} – {m.sb}</strong>
        <span className={m.win === "b" ? "w" : "l"}><b>{m.b.name}</b><Crest team={m.b} /></span>
      </div>
      {m.maps.length > 0 && <div className="osresmaps">{m.maps.map((x, i) => <span key={i} style={mapList(x.map) ? { "--mapimg": `url(${mapList(x.map)})` } : undefined} className={x.a > x.b ? "wa" : "wb"}><b>{x.map}</b><em>{x.a}–{x.b}</em></span>)}</div>}
      <div className="oswin">🏆 {tr("{team} wins", { team: winner ? winner.name : "" })}{m.mvp ? ` · MVP ${m.mvp}` : ""}</div>
    </div>
  );
}

// ---- maps: the match's maps, played, being played and left

function Maps({ d }) {
  const tr = useT();
  const m = d.match;
  if (!m) return null;
  const slots = Math.max(m.bo || 1, m.maps.length);
  const list = Array.from({ length: slots }, (_, i) => m.maps[i] || null);
  return (
    <div className="osmaps">
      {list.map((x, i) => (
        <div key={i} className={"osmap" + (x && !x.done && x.map ? " now" : "") + (!x || !x.map ? " tbd" : "")} style={x && mapSplash(x.map) ? { "--mapimg": `url(${mapList(x.map)})` } : undefined}>
          <small>{tr("Map #{n}", { n: i + 1 })}</small>
          <b>{x && x.map ? x.map : tr("TBD")}</b>
          {x && x.a != null ? <em><span className={x.done && x.a > x.b ? "w" : ""}>{tag(m.a)} {x.a}</span> – <span className={x.done && x.b > x.a ? "w" : ""}>{x.b} {tag(m.b)}</span></em> : <em>{x && x.map ? tr("Up next") : ""}</em>}
        </div>
      ))}
    </div>
  );
}

const VIEWS = { scoreboard: Scoreboard, next: NextMatch, ticker: Ticker, standby: Standby, result: Result, maps: Maps };

function View({ initial, p }) {
  const d = useOverlay(initial, p);
  const Shown = VIEWS[p.type] || Scoreboard;
  return (
    <div className={`osroot ${p.type} theme-${p.theme}`} style={{ "--osacc": p.accent || ACCENT, "--osscale": p.scale }}>
      <Shown d={d} p={p} />
      {/* only the overlay: no site banner, footer or menus around it, and a transparent page for OBS */}
      <style>{"html,body{background:transparent!important;overflow:hidden}body>*:not(#content){display:none!important}#content>*:not(.osroot){display:none!important}"}</style>
    </div>
  );
}

export default function StreamOverlay({ initial, p, lang }) {
  return <LangProvider lang={lang}><View initial={initial} p={p} /></LangProvider>;
}
