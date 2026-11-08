"use client";

import { useEffect, useMemo, useState } from "react";
import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import { ThemeSwitch } from "./theme.jsx";
import { EmeaMark } from "./Brand.jsx";
import SearchBar from "./SearchBar.jsx";
import SiteNav from "./SiteNav.jsx";
import { Crest } from "./Crest.jsx";
import { useFavorites } from "./favorites.js";
import { deviceToken } from "./account.js";
import { EVENT_NAMES, teamSlug } from "../lib/paths.js";
import { ShareCard } from "./Fans.jsx";

/** The visitor's week: their predictions and what they earned, their teams' results. Read in the browser: nothing about them is on the page. */
function Week({ matches }) {
  const tr = useT();
  const fav = useFavorites();
  const [me, setMe] = useState(null);
  useEffect(() => {
    const token = deviceToken();
    if (!token) { setMe({ name: "", picks: {}, scores: {} }); return; }
    fetch("/api/predictions/me", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      .then((r) => (r.ok ? r.json() : null)).then((j) => setMe(j || { name: "", picks: {}, scores: {} })).catch(() => setMe({ name: "", picks: {}, scores: {} }));
  }, []);
  const mine = useMemo(() => {
    if (!me) return null;
    const rows = matches.filter((m) => me.picks[`${m.event}:${m.id}`]).map((m) => {
      const pick = me.picks[`${m.event}:${m.id}`];
      const winner = m.win === "a" ? m.a.name : m.b.name;
      const exact = (me.scores || {})[`${m.event}:${m.id}`] === `${Math.max(m.sa, m.sb)}-${Math.min(m.sa, m.sb)}`;
      return { ...m, pick, ok: pick === winner, exact: pick === winner && exact };
    });
    return { rows, good: rows.filter((r) => r.ok).length, points: rows.filter((r) => r.ok).length + rows.filter((r) => r.exact).length };
  }, [me, matches]);
  const teams = matches.filter((m) => fav.has(teamSlug(m.a.name)) || fav.has(teamSlug(m.b.name)));
  const won = teams.filter((m) => fav.has(teamSlug((m.win === "a" ? m.a : m.b).name))).length;
  return (
    <div className="wrap teampage">
      <div className="topbar">
        <h1 className="brandh"><a className="homelink" href="/" title={tr("Home")}><EmeaMark /></a><span>{tr("My week")}</span></h1>
        <SearchBar />
        <div className="prefs"><ThemeSwitch /><LangSwitch /></div>
      </div>
      <SiteNav />
      <p className="note">{tr("The last 7 days, for you: your predictions and your teams.")}</p>
      {!mine ? null : (
        <>
          <div className="pcardnums weeknums">
            <div><b>{mine.points}</b><span>{tr("Points this week")}</span></div>
            <div><b>{mine.good}/{mine.rows.length}</b><span>{tr("Right picks")}</span></div>
            <div><b>{won}/{teams.length}</b><span>{tr("Your teams' wins")}</span></div>
          </div>
          {me.name && <p><ShareCard name={me.name} /></p>}
          <section>
            <h2>{tr("Your predictions")}</h2>
            {mine.rows.length === 0 ? <p className="note">{tr("No prediction on a finished match this week.")} <a href="/predictions">{tr("Predictions")} ›</a></p> : (
              <ul className="weeklist">{mine.rows.map((m) => (
                <li key={m.event + m.id} className={m.ok ? "ok" : "ko"}>
                  <span>{m.ok ? (m.exact ? "🎯" : "✅") : "❌"}</span>
                  <a href={`/match/${m.event}/${m.id}`}>{m.a.name} {m.sa}–{m.sb} {m.b.name}</a>
                  <small>{tr("you picked {team}", { team: m.pick })} · {tr(EVENT_NAMES[m.event] || m.event)}</small>
                </li>
              ))}</ul>
            )}
          </section>
          <section>
            <h2>{tr("Your teams")}</h2>
            {teams.length === 0 ? <p className="note">{tr("No match of your favorite teams this week.")}</p> : (
              <ul className="weeklist">{teams.map((m) => {
                const w = fav.has(teamSlug((m.win === "a" ? m.a : m.b).name));
                return <li key={m.event + m.id} className={w ? "ok" : "ko"}><Crest team={m.win === "a" ? m.a : m.b} /><a href={`/match/${m.event}/${m.id}`}>{m.a.name} {m.sa}–{m.sb} {m.b.name}</a><small>{tr(EVENT_NAMES[m.event] || m.event)}</small></li>;
              })}</ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default function WeekPage({ lang, matches }) {
  return <LangProvider lang={lang}><Week matches={matches} /></LangProvider>;
}
