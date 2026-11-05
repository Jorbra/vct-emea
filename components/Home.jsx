"use client";

import { useMemo } from "react";
import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import { ThemeSwitch } from "./theme.jsx";
import SearchBar from "./SearchBar.jsx";
import SiteNav from "./SiteNav.jsx";
import { useEffect, useState } from "react";
import { EVENT_NAMES } from "../lib/paths.js";
import { EmeaMark } from "./Brand.jsx";
import { Crest } from "./Crest.jsx";
import { useAutoRefresh } from "./autoRefresh.js";
import { eventStatus, formatDates } from "../lib/status.js";
import { TYPE_LABEL } from "../lib/einfo.js";
import { siteHref, teamHref, teamSlug } from "../lib/paths.js";
import { siteTeams } from "../lib/teams.js";
import { useFavorites } from "./favorites.js";
import { localeOf } from "../lib/i18n.js";
import { AlertsButton } from "./MatchAlerts.jsx";
import { eventData, matchesOf } from "../lib/matchlist.js";
import { TIME_EVENTS } from "../lib/schedule.js";
import { MatchStrip } from "./matchTime.jsx";
import { MatchModalProvider } from "./MatchModal.jsx";

const sameDay = (iso, now) => { const a = new Date(iso); const b = new Date(now); return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); };

/** Each event being played today: how far it has gone, and the way to its bracket. */
function TodayPulse({ events }) {
  const tr = useT();
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
  if (now == null) return null;
  const rows = events.map((e) => {
    const list = e.items.filter((m) => (e.times[m.id] && sameDay(e.times[m.id], now)) || (e.live[m.id] && m.sa == null));
    return { e, total: list.length, done: list.filter((m) => m.sa != null).length, live: list.filter((m) => e.live[m.id] && m.sa == null).length };
  }).filter((r) => r.total);
  if (!rows.length) return null;
  return (
    <section className="pulse" aria-label={tr("Today")}>
      {rows.slice(0, 4).map(({ e, total, done, live }) => (
        <a key={e.event} className="pulsecard" href={e.href}>
          <b>{tr(EVENT_NAMES[e.event])}</b>
          <span className="pulsebar" aria-hidden="true"><i style={{ width: `${Math.round((done / total) * 100)}%` }} /></span>
          <span className="pulsetext">{tr("{done} of {total} matches finished today", { done, total })}{live ? ` · ${tr("{n} live", { n: live })}` : ""}</span>
          <span className="evgo">{tr("Open")} ›</span>
        </a>
      ))}
    </section>
  );
}

/** While matches are being played, the latest results come before the matches of the next days. */
function HomeStrips({ events, state }) {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const now = Date.now();
    setBusy(events.some((e) => e.items.some((m) => e.times[m.id] && m.sa != null && now - new Date(e.times[m.id]).getTime() < 24 * 3600e3)));
  }, [events]);
  return (
    <MatchModalProvider state={state} events={events}>
      <MatchStrip events={events} Crest={Crest} showEvent today />
      {busy && <MatchStrip events={events} Crest={Crest} showEvent recent />}
      <MatchStrip events={events} Crest={Crest} showEvent skipToday />
      {!busy && <MatchStrip events={events} Crest={Crest} showEvent recent />}
    </MatchModalProvider>
  );
}

export default function Home(props) {
  return (
    <LangProvider lang={props.lang}>
      <HomeView {...props} />
    </LangProvider>
  );
}

const ROAD = [
  ["Europe", [["q1", "Qualifier 1"], ["q2", "Qualifier 2"]], ["playoffs", "Qualifier Playoffs"], "2"],
  ["Türkiye", [["trq1", "Qualifier 1"], ["trq2", "Qualifier 2"]], ["tr", "Qualifier Playoffs"], "1"],
  ["MENA", [["meq1", "ME Qualifier 1"], ["meq2", "ME Qualifier 2"], ["naq1", "NA Qualifier 1"], ["naq2", "NA Qualifier 2"]], ["mena", "Qualifier Playoffs"], "1"],
];

/** The way to the Kickoff: open qualifiers, then Qualifier Playoffs, then the Kickoff and Masters. Each box opens its event. */
function RoadToKickoff({ status }) {
  const tr = useT();
  const stage = (ev, label) => <a key={ev} className={"rdbox " + status[ev].state} href={siteHref(ev)} title={tr(status[ev].state === "done" ? "Finished" : status[ev].state === "live" ? "Live" : "Upcoming")}><i aria-hidden="true" />{label}</a>;
  return (
    <section>
      <h2>{tr("Road to the Kickoff")}</h2>
      <div className="road">
        <div className="rdrows">
          {ROAD.map(([region, quals, po, spots]) => (
            <div className="rdrow" key={region}>
              <span className="rdname">{region}</span>
              <div className="rdquals">{quals.map(([ev, l]) => stage(ev, l))}</div>
              <span className="rdarrow" aria-hidden="true">→</span>
              {stage(po[0], po[1])}
              <span className="rdarrow spots">{tr("{n} to the Kickoff", { n: spots })} →</span>
            </div>
          ))}
        </div>
        <div className="rdend">
          <a className={"rdbox big " + status.kickoff.state} href={siteHref("kickoff")}><i aria-hidden="true" />EMEA Kickoff<small>{tr("+ 8 partner teams")}</small></a>
          <span className="rdarrow" aria-hidden="true">↓</span>
          <span className="rdbox big plain">Masters<small>{tr("3 qualified teams")}</small></span>
        </div>
      </div>
      <p className="rdlegend"><span><i className="upcoming" />{tr("Upcoming")}</span><span><i className="live" />{tr("Live")}</span><span><i className="done" />{tr("Finished")}</span></p>
    </section>
  );
}

/** The latest news. */
function LatestNews({ news }) {
  const tr = useT();
  if (!news || !news.length) return null;
  return (
    <section>
      <h2><a href="/news">{tr("News")}</a></h2>
      <div className="newslist">
        {news.map((n) => (
          <a key={n.id} className="newsitem" href={`/news/${n.id}`}>
            <small>{new Intl.DateTimeFormat(localeOf(tr.lang), { dateStyle: "long" }).format(new Date(n.at))}</small>
            <b>{n.title}</b>
            <span>{n.body.length > 140 ? `${n.body.slice(0, 140)}…` : n.body}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

/** The visitor's favorite teams, once chosen with the star of a team's page. */
function MyTeams({ initial }) {
  const tr = useT();
  const fav = useFavorites();
  const mine = siteTeams(initial).filter((t) => fav.has(teamSlug(t.name)));
  if (!mine.length) return null;
  return (
    <section>
      <h2>★ {tr("My teams")}</h2>
      <p><AlertsButton /></p>
      <div className="torg">
        {mine.map((t) => <a key={t.name} href={teamHref(t.name)}><Crest team={t} />{t.name}</a>)}
      </div>
    </section>
  );
}

function HomeView({ initial }) {
  const tr = useT();
  const ev = useMemo(() => eventStatus(initial), [initial]);
  const info = initial.info || {};
  const matchEvents = useMemo(() => TIME_EVENTS.map((e) => ({
    event: e, href: siteHref(e), items: matchesOf(e, eventData(initial, e)),
    times: (initial.times && initial.times[e]) || {}, live: (initial.live && initial.live[e]) || {},
    extra: (initial.extra && initial.extra[e]) || {}, stream: (initial.info && initial.info[e] && initial.info[e].stream) || "",
  })), [initial]);
  useAutoRefresh();

  const card = (key, title, meta, outLabel) => {
    const e = ev[key];
    return (
      <a key={key} className={"evcard " + e.state} href={siteHref(key)}>
        <span className="evtop">
          <span className={"evstate " + e.state}>{tr(e.state === "done" ? "Finished" : e.state === "live" ? "Live" : "Upcoming")}</span>
          <span className="evcount">{e.of ? `${e.teams}/${e.of}` : e.teams} {tr("teams")}</span>
        </span>
        <span className="evtitle">{title}</span>
        <span className="evdates">{formatDates(info[key], tr.lang) || tr("Dates to be announced")}</span>
        <span className="evmeta">{[info[key] && info[key].location, tr(TYPE_LABEL[info[key] && info[key].type] || "Online"), meta].filter(Boolean).join(" · ")}</span>
        {e.out.length > 0 && (
          <span className="evout">
            <span className="evoutl">{outLabel}</span>
            {e.out.map((t, i) => <span key={i} className="evteam"><Crest team={t} /><span>{t.name}</span></span>)}
          </span>
        )}
        <span className="evgo">{tr("Open")} ›</span>
      </a>
    );
  };

  const kick = initial.kickoff.teams;
  return (
    <div className="wrap home">
      <div className="topbar">
        <h1 className="brandh"><EmeaMark /><span>VCT EMEA</span></h1>
        <SearchBar /><div className="prefs"><ThemeSwitch /><LangSwitch /></div>
      </div>

      <SiteNav />

      <div className="hero">
        <div>
          <div className="herokick">Champions Tour 2027</div>
          <div className="herotitle">{tr("Road to the EMEA Kickoff")}</div>
          <p>{tr("Every qualifier, the Qualifier Playoffs and the Kickoff, with results updated live.")}</p>
        </div>
        <a className="btn pri" href={siteHref("kickoff")}>Kickoff ›</a>
      </div>

      <TodayPulse events={matchEvents} />
      <MyTeams initial={initial} />
      <LatestNews news={initial.news} />
      <HomeStrips events={matchEvents} state={initial} />

      <section>
        <h2><a href={siteHref("kickoff")}>VCT 2027: EMEA Kickoff</a></h2>
        <div className="kickgrid">
          {kick.map((t, i) => (
            <a key={i} className={"kslot" + (t.name ? "" : " open")} href={siteHref("kickoff")}>
              <Crest team={t} />
              <span className="kname">{t.name || tr("TBD")}</span>
              <span className="ksrc">{t.source ? `${t.source.replace("TR ", "Türkiye ")} #${t.pos}` : tr("Invited")}</span>
            </a>
          ))}
        </div>
      </section>

      <section>
        <h2>VCT EMEA</h2>
        <div className="evgroup">
          <h3>Europe</h3>
          <div className="evgrid">
            {card("q1", "Qualifier 1", tr("{n} teams · top 4 go on", { n: initial.qualifiers.q1.slots.length }), tr("Qualified"))}
            {card("q2", "Qualifier 2", tr("{n} teams · top 4 go on", { n: initial.qualifiers.q2.slots.length }), tr("Qualified"))}
            {card("playoffs", "Qualifier Playoffs", tr("Swiss + bracket"), tr("To the Kickoff"))}
          </div>
        </div>
        <div className="evgroup">
          <h3>Türkiye</h3>
          <div className="evgrid">
            {card("trq1", "Qualifier 1", tr("top 2 go on"), tr("Qualified"))}
            {card("trq2", "Qualifier 2", tr("top 2 go on"), tr("Qualified"))}
            {card("tr", "Qualifier Playoffs", tr("8 teams · GSL groups"), tr("To the Kickoff"))}
          </div>
        </div>
        <div className="evgroup">
          <h3>MENA</h3>
          <div className="evgrid">
            {card("meq1", "ME Qualifier 1", tr("winner goes on"), tr("Qualified"))}
            {card("meq2", "ME Qualifier 2", tr("winner goes on"), tr("Qualified"))}
            {card("naq1", "NA Qualifier 1", tr("winner goes on"), tr("Qualified"))}
            {card("naq2", "NA Qualifier 2", tr("winner goes on"), tr("Qualified"))}
            {card("mena", "Qualifier Playoffs", tr("4 teams · semifinals + final"), tr("To the Kickoff"))}
          </div>
        </div>
        <div className="evgroup">
          <h3>Kickoff</h3>
          <div className="evgrid">
            {card("kickoff", "VCT 2027: EMEA Kickoff", tr("12 teams · triple elimination"), tr("To Masters"))}
          </div>
        </div>
      </section>

      <RoadToKickoff status={ev} />

      <section>
        <h2>VCT Game Changers EMEA</h2>
        <div className="evgrid">
          {card("gc", "Game Changers EMEA", "", "")}
        </div>
      </section>

    </div>
  );
}
