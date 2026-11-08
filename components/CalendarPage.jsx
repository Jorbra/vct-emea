"use client";

import { useEffect, useMemo, useState } from "react";
import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import SiteNav from "./SiteNav.jsx";
import { ThemeSwitch } from "./theme.jsx";
import { EmeaMark } from "./Brand.jsx";
import { Crest } from "./Crest.jsx";
import SearchBar from "./SearchBar.jsx";
import { MatchModalProvider } from "./MatchModal.jsx";
import { useOpenMatch } from "./openMatch.js";
import { useFavorites } from "./favorites.js";
import { AlertsButton } from "./MatchAlerts.jsx";
import { useAutoRefresh } from "./autoRefresh.js";
import { localeOf } from "../lib/i18n.js";
import { allMatches, eventData, matchesOf } from "../lib/matchlist.js";
import { scoreLabel } from "../lib/scoretext.js";
import { EVENT_NAMES, siteHref, teamSlug } from "../lib/paths.js";
import { TIME_EVENTS } from "../lib/schedule.js";

const REGIONS = [
  ["all", "All", null],
  ["eu", "Europe", ["q1", "q2", "playoffs"]],
  ["tr", "Türkiye", ["trq1", "trq2", "tr"]],
  ["mena", "MENA", ["meq1", "meq2", "naq1", "naq2", "mena"]],
  ["kickoff", "Kickoff", ["kickoff"]],
  ["gc", "Game Changers", ["gc"]],
];
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function Agenda({ days }) {
  const tr = useT();
  const open = useOpenMatch();
  const fmtDay = new Intl.DateTimeFormat(localeOf(tr.lang), { weekday: "long", day: "numeric", month: "long" });
  const fmtHour = new Intl.DateTimeFormat(localeOf(tr.lang), { hour: "2-digit", minute: "2-digit" });
  const [openDays, setOpenDays] = useState({});
  const today = dayKey(new Date());
  const fmtChip = new Intl.DateTimeFormat(localeOf(tr.lang), { weekday: "short", day: "numeric" });
  if (!days.length) return <p className="note">{tr("No match this month.")}</p>;
  return (
    <>
    <nav className="daystrip" aria-label={tr("Days")}>
      {days.map(([k, list]) => (
        <a key={k} href={`#d-${k}`} className={"daychip" + (k === today ? " today" : "") + (list.some((m) => m.sa == null && m.live) ? " live" : "")}>
          <b>{fmtChip.format(new Date(list[0].at))}</b><small>{tr("{n} matches", { n: list.length })}</small>
        </a>
      ))}
    </nav>
    {days.map(([k, list]) => (
    <div className="schd" key={k} id={`d-${k}`}>
      <h3 className="schday">{fmtDay.format(new Date(list[0].at))} <small>{tr("{n} matches", { n: list.length })}</small></h3>
      {list.slice(0, openDays[k] || list.length <= 16 ? list.length : 12).map((m) => {
        const done = m.sa != null && m.sb != null;
        return (
          <div key={m.event + m.id} className={"schm mclick" + (done ? " done" : "")} role="button" tabIndex={0} onClick={() => open(m.event, m.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(m.event, m.id); } }}>
            <span className="schh">{fmtHour.format(new Date(m.at))}</span>
            <span className="schr">{tr(EVENT_NAMES[m.event])}</span>
            <span className="schteams">
              <span className={"scht" + (m.win === "a" ? " w" : m.win ? " lo" : "")}><Crest team={m.a} /><span className="tn">{(m.a && m.a.name) || tr("TBD")}</span></span>
              <span className="schs">{done ? scoreLabel(m, tr) : "vs"}</span>
              <span className={"scht" + (m.win === "b" ? " w" : m.win ? " lo" : "")}><Crest team={m.b} /><span className="tn">{(m.b && m.b.name) || tr("TBD")}</span></span>
            </span>
          </div>
        );
      })}
      {list.length > 16 && !openDays[k] && <button type="button" className="btn small daymore" onClick={() => setOpenDays((o) => ({ ...o, [k]: true }))}>{tr("Show the {n} other matches", { n: list.length - 12 })}</button>}
    </div>
    ))}
    </>
  );
}

function View({ initial }) {
  const tr = useT();
  useAutoRefresh();
  const fav = useFavorites();
  const [region, setRegion] = useState("all");
  const [favOnly, setFavOnly] = useState(false);
  const [month, setMonth] = useState(null); // first day of the month shown, known once on the client (its time zone)
  useEffect(() => { const n = new Date(); setMonth(new Date(n.getFullYear(), n.getMonth(), 1)); }, []);

  const all = useMemo(() => allMatches(initial).filter((m) => m.at), [initial]);
  const events = useMemo(() => TIME_EVENTS.map((e) => ({
    event: e, href: siteHref(e), items: matchesOf(e, eventData(initial, e)), times: (initial.times && initial.times[e]) || {},
    live: (initial.live && initial.live[e]) || {}, extra: (initial.extra && initial.extra[e]) || {}, stream: (initial.info && initial.info[e] && initial.info[e].stream) || "",
  })), [initial]);
  const allowed = REGIONS.find((r) => r[0] === region)[2];
  const isFav = (m) => [m.a, m.b].some((t) => t && t.name && fav.has(teamSlug(t.name)));
  const shown = all.filter((m) => (!allowed || allowed.includes(m.event)) && (!favOnly || isFav(m)));
  const feedQuery = [allowed ? `region=${region}` : "", favOnly && fav.list.length ? `teams=${fav.list.slice(0, 30).map(encodeURIComponent).join(",")}` : ""].filter(Boolean).join("&");
  const feed = `/api/calendar${feedQuery ? `?${feedQuery}` : ""}`;
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.host), []);

  let grid = null;
  let days = [];
  if (month) {
    const inMonth = shown.filter((m) => { const d = new Date(m.at); return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth(); })
      .sort((a, b) => a.at.localeCompare(b.at));
    const byDay = new Map();
    for (const m of inMonth) { const k = dayKey(new Date(m.at)); byDay.set(k, [...(byDay.get(k) || []), m]); }
    days = [...byDay.entries()];
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const lead = (month.getDay() + 6) % 7; // Monday first
    const today = dayKey(new Date());
    const names = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(localeOf(tr.lang), { weekday: "short" }).format(new Date(2024, 0, 1 + i)));
    grid = (
      <div className="calgrid" dir="ltr">
        {names.map((n) => <div className="calh" key={n}>{n}</div>)}
        {Array.from({ length: lead }, (_, i) => <span key={`e${i}`} />)}
        {Array.from({ length: count }, (_, i) => {
          const k = dayKey(new Date(month.getFullYear(), month.getMonth(), i + 1));
          const n = (byDay.get(k) || []).length;
          return n ? (
            <a key={k} className={"calday has h" + (n >= 9 ? 4 : n >= 5 ? 3 : n >= 3 ? 2 : 1) + (k === today ? " today" : "")} href={`#d-${k}`}><b>{i + 1}</b><small>{n} {tr("Matches").toLowerCase()}</small></a>
          ) : <span key={k} className={"calday" + (k === today ? " today" : "")}><b>{i + 1}</b></span>;
        })}
      </div>
    );
  }
  const go = (d) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + d, 1));
  return (
    <div className="wrap">
      <div className="topbar">
        <h1 className="brandh"><a className="homelink" href="/" title={tr("Home")}><EmeaMark /></a><span>{tr("Calendar")}</span></h1>
        <SearchBar />
        <div className="prefs"><ThemeSwitch /><LangSwitch /></div>
      </div>
      <SiteNav />
      <nav className="crumbs" aria-label={tr("Breadcrumb")}><a href="/">{tr("Home")}</a> › <span>{tr("Calendar")}</span></nav>
      <div className="calbar">
        <div className="navpills" role="group" aria-label={tr("Region")}>
          {REGIONS.map(([k, l]) => <button key={k} type="button" aria-pressed={region === k} data-on={region === k} onClick={() => setRegion(k)}>{l === "All" ? tr("All") : l}</button>)}
          <button type="button" aria-pressed={favOnly} data-on={favOnly} onClick={() => setFavOnly(!favOnly)}>★ {tr("My teams")}</button>
        </div>
        <div className="calmonth">
          <button type="button" className="btn" aria-label={tr("Previous month")} onClick={() => go(-1)}>‹</button>
          <b>{month ? new Intl.DateTimeFormat(localeOf(tr.lang), { month: "long", year: "numeric" }).format(month) : " "}</b>
          <button type="button" className="btn" aria-label={tr("Next month")} onClick={() => go(1)}>›</button>
        </div>
      </div>
      {grid}
      <MatchModalProvider state={initial} events={events}>
        <div className="sched calagenda">{month && <Agenda days={days} />}</div>
      </MatchModalProvider>
      <section className="calsub">
        <h2>{tr("Subscribe")}</h2>
        <p className="note">{tr("Add these matches to your phone or computer calendar: it follows the changes by itself.")}</p>
        <div className="calsublinks">
          <a className="btn pri" href={origin ? `webcal://${origin}${feed}` : feed}>{tr("Subscribe to this calendar")}</a>
          <a className="btn" href={feed} download="vct-emea.ics">{tr("Download (.ics)")}</a>
          <AlertsButton />
        </div>
      </section>
    </div>
  );
}

export default function CalendarPage({ initial, lang }) {
  return <LangProvider lang={lang}><View initial={initial} /></LangProvider>;
}
