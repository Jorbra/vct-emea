"use client";

import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import { ThemeSwitch } from "./theme.jsx";
import { EmeaMark } from "./Brand.jsx";
import SearchBar from "./SearchBar.jsx";
import SiteNav from "./SiteNav.jsx";
import { Crest } from "./Crest.jsx";
import { Flag } from "./TeamCard.jsx";
import { EVENT_NAMES, siteHref, teamHref } from "../lib/paths.js";

/** One team's way through: each match, its opponent and its score. */
function Path({ team, path, ev }) {
  const tr = useT();
  return (
    <div className="recapteam">
      <h3><Crest team={team} /><a href={teamHref(team.name)}>{team.name}</a></h3>
      <ol className="recappath">
        {path.map((m) => (
          <li key={m.id} className={m.won ? "w" : "lo"}>
            <a href={`/match/${ev}/${m.id}`}>
              <span className="rround">{m.round.map(([k, v]) => tr(k, v)).join(" · ")}</span>
              <span className="ropp"><Crest team={m.opponent} />{(m.opponent && m.opponent.name) || tr("TBD")}</span>
              <b>{m.note && m.note.kind === "ff" ? tr("Forfeit") : `${m.mine}–${m.theirs}`}</b>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

function View({ r }) {
  const tr = useT();
  const title = tr(EVENT_NAMES[r.event] || r.event);
  return (
    <div className="wrap teampage recap">
      <div className="topbar">
        <h1 className="brandh"><a className="homelink" href="/" title={tr("Home")}><EmeaMark /></a><span>{tr("Recap")} · {title}</span></h1>
        <SearchBar />
        <div className="prefs"><ThemeSwitch /><LangSwitch /></div>
      </div>
      <SiteNav />
      <nav className="crumbs" aria-label={tr("Breadcrumb")}><a href="/">{tr("Home")}</a> › <a href={siteHref(r.event)}>{title}</a> › {tr("Recap")}</nav>
      <div className="recapnums">
        <span><b>{r.played}</b> / {r.total} {tr("matches played")}</span>
        {r.overtime > 0 && <span><b>{r.overtime}</b> {tr("maps in overtime")}</span>}
        {r.maps[0] && <span>{tr("Most played map")} : <a href={`/map/${encodeURIComponent(r.maps[0].map.toLowerCase())}?e=${r.event}`}><b>{r.maps[0].map}</b></a> ({r.maps[0].played})</span>}
        {r.agent && <span>{tr("Most played agent")} : <b>{r.agent.name.charAt(0).toUpperCase() + r.agent.name.slice(1)}</b></span>}
      </div>
      {!r.done && <p className="note">{tr("The event is still being played: this recap fills in as the results come.")}</p>}
      <section>
        <h2>{r.done ? (r.n === 1 ? tr("Qualified team") : tr("The {n} qualified teams", { n: r.n })) : tr("Still in the race ({n})", { n: r.aliveCount })}</h2>
        {(r.done ? r.qualified : r.alive).length > 0
          ? <div className="recapgrid">{(r.done ? r.qualified : r.alive).map((q) => <Path key={q.team.name} team={q.team} path={q.path} ev={r.event} />)}</div>
          : <p className="note">{tr("Shown once 16 teams or fewer are left.")}</p>}
      </section>
      {r.top.length > 0 && (
        <section>
          <h2>{tr("Best players")}</h2>
          <div className="vlrscroll">
            <table className="vlrtable statstable">
              <thead><tr><th>#</th><th className="vlrp">{tr("Player")}</th><th>{tr("Maps")}</th><th>R</th><th>ACS</th><th>K/D</th><th>KAST</th><th>ADR</th></tr></thead>
              <tbody>{r.top.map((p, i) => (
                <tr key={p.slug}><td>{i + 1}</td><td className="vlrp"><span className="pt">{p.cc ? <Flag cc={p.cc} /> : null}<a href={`/player/${p.slug}`}>{p.name}</a></span> <small>{p.team}</small></td><td>{p.maps}</td><td><b>{p.r != null ? p.r.toFixed(2) : "–"}</b></td><td>{p.acs ?? "–"}</td><td>{p.kd != null ? Number(p.kd).toFixed(2) : "–"}</td><td>{p.kast != null ? `${p.kast}%` : "–"}</td><td>{p.adr ?? "–"}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <p className="hint">{tr("4 maps played at least, best rating first.")} <a href={`/stats?e=${r.event}`}>{tr("All the stats")} ›</a></p>
        </section>
      )}
      <div className="cols2">
        {r.bigGames.length > 0 && (
          <section>
            <h2>{tr("Biggest games")}</h2>
            <ul className="recaplist">{r.bigGames.map((g, i) => (
              <li key={i}><a href={`/player/${g.slug}`}><b>{g.name}</b></a> <span className="acsbig">{g.acs} ACS</span> <small>{g.k}/{g.d} · {g.team} vs <a href={`/match/${r.event}/${g.id}`}>{g.opponent && g.opponent.name ? g.opponent.name : g.opponent}</a></small></li>
            ))}</ul>
          </section>
        )}
        {r.closest.length > 0 && (
          <section>
            <h2>{tr("Closest maps")}</h2>
            <ul className="recaplist">{r.closest.map((c, i) => (
              <li key={i}><a href={`/match/${r.event}/${c.id}`}>{c.a} <b>{c.sa}–{c.sb}</b> {c.b}</a> <small>{c.map}</small></li>
            ))}</ul>
          </section>
        )}
      </div>
      <p className="vlrcredit">{tr("Numbers from")} <a href="https://www.vlr.gg/" target="_blank" rel="noopener noreferrer">vlr.gg</a></p>
    </div>
  );
}

export default function RecapPage({ lang, recap }) {
  return <LangProvider lang={lang}><View r={recap} /></LangProvider>;
}
