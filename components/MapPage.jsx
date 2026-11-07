"use client";

import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import { ThemeSwitch } from "./theme.jsx";
import { EmeaMark } from "./Brand.jsx";
import SearchBar from "./SearchBar.jsx";
import SiteNav from "./SiteNav.jsx";
import { Flag } from "./TeamCard.jsx";
import { EVENT_NAMES, teamHref } from "../lib/paths.js";

function View({ card, event, events }) {
  const tr = useT();
  const base = card ? `/map/${encodeURIComponent(card.map.toLowerCase())}` : "/stats";
  return (
    <div className="wrap teampage">
      <div className="topbar">
        <h1 className="brandh"><a className="homelink" href="/" title={tr("Home")}><EmeaMark /></a><span>{card ? card.map : tr("Map")}</span></h1>
        <SearchBar />
        <div className="prefs"><ThemeSwitch /><LangSwitch /></div>
      </div>
      <SiteNav />
      <nav className="crumbs" aria-label={tr("Breadcrumb")}><a href="/">{tr("Home")}</a> › <a href="/stats">{tr("Stats")}</a> › {card ? card.map : tr("Map")}</nav>
      <div className="tabs sub" role="tablist" aria-label={tr("Event")}>
        <a role="tab" className="tablink" aria-selected={!event} href={base}>{tr("All events")}</a>
        {events.map((e) => <a key={e} role="tab" className="tablink" aria-selected={e === event} href={`${base}?e=${e}`}>{tr(EVENT_NAMES[e] || e)}</a>)}
      </div>
      {!card ? <p className="note">{tr("No map played here yet.")}</p> : (
        <>
          <div className="recapnums">
            <span><b>{card.played}</b> {tr("maps played")}</span>
            <span>{tr("Average gap")} : <b>{card.diff}</b> {tr("rounds")}</span>
            <span><b>{card.overtime}</b> {tr("in overtime")}</span>
            {card.attack != null && <span>{tr("Attack wins {a}% of the rounds, defence {d}%", { a: card.attack, d: 100 - card.attack })}</span>}
          </div>
          {card.attack != null && (
            <div className="sidebar" role="img" aria-label={tr("Attack wins {a}% of the rounds, defence {d}%", { a: card.attack, d: 100 - card.attack })}>
              <i className="atk" style={{ width: `${card.attack}%` }}>{tr("Attack")} {card.attack}%</i>
              <i className="def" style={{ width: `${100 - card.attack}%` }}>{tr("Defence")} {100 - card.attack}%</i>
            </div>
          )}
          {card.attack == null && <p className="hint">{tr("Attack and defence rounds appear as vlr.gg's pages are read again.")}</p>}
          <div className="cols2">
            <section>
              <h2>{tr("Strongest teams")}</h2>
              {card.teams.length === 0 ? <p className="note">{tr("No team has played it twice yet.")}</p> : (
                <table className="vlrtable statstable">
                  <thead><tr><th className="vlrp">{tr("Team")}</th><th>{tr("Maps")}</th><th>%</th></tr></thead>
                  <tbody>{card.teams.map((t) => <tr key={t.slug}><td className="vlrp"><a href={teamHref(t.name)}>{t.name}</a></td><td>{t.won} – {t.played - t.won}</td><td><b>{Math.round((t.won / t.played) * 100)}%</b></td></tr>)}</tbody>
                </table>
              )}
            </section>
            <section>
              <h2>{tr("Best players")}</h2>
              {card.players.length === 0 ? <p className="note">{tr("No player has played it twice yet.")}</p> : (
                <table className="vlrtable statstable">
                  <thead><tr><th className="vlrp">{tr("Player")}</th><th>{tr("Maps")}</th><th>R</th><th>ACS</th><th>K/D</th></tr></thead>
                  <tbody>{card.players.map((p) => <tr key={p.slug}><td className="vlrp"><span className="pt">{p.cc ? <Flag cc={p.cc} /> : null}<a href={`/player/${p.slug}`}>{p.name}</a></span></td><td>{p.maps}</td><td><b>{p.r != null ? p.r.toFixed(2) : "–"}</b></td><td>{p.acs ?? "–"}</td><td>{p.kd != null ? Number(p.kd).toFixed(2) : "–"}</td></tr>)}</tbody>
                </table>
              )}
            </section>
          </div>
          {(card.comps || []).length > 0 && (
            <section>
              <h2>{tr("Most played compositions")}</h2>
              <table className="vlrtable statstable">
                <thead><tr><th className="vlrp">{tr("Agents")}</th><th>{tr("Played")}</th><th>{tr("Won")}</th><th>%</th></tr></thead>
                <tbody>{card.comps.map((c, i) => <tr key={i}><td className="vlrp">{c.agents.map((a) => a.charAt(0).toUpperCase() + a.slice(1)).join(", ")}</td><td>{c.played}</td><td>{c.won}</td><td>{Math.round((c.won / c.played) * 100)}%</td></tr>)}</tbody>
              </table>
            </section>
          )}
          {card.closest && <p className="note">{tr("Closest map")} : <a href={`/match/${card.closest.event}/${card.closest.id}`}>{card.closest.ta} {card.closest.a}–{card.closest.b} {card.closest.tb}</a></p>}
          <p className="vlrcredit">{tr("Numbers from")} <a href="https://www.vlr.gg/" target="_blank" rel="noopener noreferrer">vlr.gg</a></p>
        </>
      )}
    </div>
  );
}

export default function MapPage({ lang, ...p }) {
  return <LangProvider lang={lang}><View {...p} /></LangProvider>;
}
