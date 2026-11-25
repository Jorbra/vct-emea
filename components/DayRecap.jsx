"use client";
// The day's recap page: results, player of the day, fans' MVP, standout line, closest map, and the card to share.

import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import { ThemeSwitch } from "./theme.jsx";
import { EmeaMark } from "./Brand.jsx";
import SearchBar from "./SearchBar.jsx";
import SiteNav from "./SiteNav.jsx";

const dayLabel = (day, lang) => new Date(`${day}T12:00:00Z`).toLocaleDateString(lang === "fr" ? "fr-FR" : lang, { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });

function Recap({ recap, prev, next }) {
  const tr = useT();
  const r = recap;
  const img = `/api/og/day?d=${r.day}`;
  return (
    <div className="wrap teampage dayrecap">
      <div className="topbar">
        <h1 className="brandh"><a className="homelink" href="/" title={tr("Home")}><EmeaMark /></a><span>{tr("Day recap")}</span></h1>
        <SearchBar />
        <div className="prefs"><ThemeSwitch /><LangSwitch /></div>
      </div>
      <SiteNav />
      <nav className="drnav" aria-label={tr("Days")}>
        {prev ? <a className="btn sm" href={`/jour?d=${prev}`}>← {dayLabel(prev, tr.lang)}</a> : <span />}
        <h2>{dayLabel(r.day, tr.lang)}</h2>
        {next ? <a className="btn sm" href={`/jour?d=${next}`}>{dayLabel(next, tr.lang)} →</a> : <span />}
      </nav>
      {!r.matches.length ? <p className="note">{tr("No match finished that day.")}</p> : (
        <>
          <div className="drcards">
            {r.star && <div className="drcard"><small>⭐ {tr("Player of the day")}</small><b>{r.star.name}</b><span>{Number(r.star.r).toFixed(2)} rating{r.star.acs != null ? ` · ${r.star.acs} ACS` : ""}</span><em>{r.star.vs}</em></div>}
            {r.fans && <div className="drcard"><small>🗳️ {tr("Fans' MVP")}</small><b>{r.fans.name}</b><span>{tr("{n} votes", { n: r.fans.n })}</span><em>{r.fans.vs}</em></div>}
            {r.best && <div className="drcard"><small>🔥 {tr("Standout line")}</small><b>{r.best.name}</b><span>{tr("{k} kills on {map}", { k: r.best.k, map: r.best.map })}{r.best.acs != null ? ` · ${r.best.acs} ACS` : ""}</span><em>{r.best.vs}</em></div>}
            {r.closest && <div className="drcard"><small>⚖️ {tr("Closest map")}</small><b>{r.closest.map} {r.closest.a}–{r.closest.b}</b><span>{r.closest.ta} vs {r.closest.tb}</span></div>}
          </div>
          <section>
            <h2>{tr("Results")}</h2>
            <ul className="drlist">
              {r.matches.map((m) => (
                <li key={m.event + m.id}>
                  <a href={`/match/${m.event}/${m.id}`}>
                    <span className={m.win === "a" ? "w" : ""}>{m.a}</span>
                    <b>{m.sa}–{m.sb}</b>
                    <span className={m.win === "b" ? "w" : ""}>{m.b}</span>
                    <small>{tr(m.eventName)}</small>
                  </a>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2>{tr("The card to share")}</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <a href={img} target="_blank" rel="noreferrer"><img className="drimg" src={img} alt={tr("Day recap")} width="1200" height="900" loading="lazy" /></a>
            <p><a className="btn" href={img} download={`vct-emea-${r.day}.png`}>⬇ {tr("Download the card")}</a></p>
          </section>
        </>
      )}
    </div>
  );
}

export default function DayRecap({ recap, prev, next, lang }) {
  return <LangProvider lang={lang}><Recap recap={recap} prev={prev} next={next} /></LangProvider>;
}
