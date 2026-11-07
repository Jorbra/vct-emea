"use client";

import { useMemo, useState } from "react";
import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import { ThemeSwitch } from "./theme.jsx";
import { EmeaMark } from "./Brand.jsx";
import SearchBar from "./SearchBar.jsx";
import SiteNav from "./SiteNav.jsx";
import { Flag } from "./TeamCard.jsx";
import { EVENT_NAMES, teamSlug } from "../lib/paths.js";

const PCOLS = [["maps", "Maps"], ["r", "R"], ["acs", "ACS"], ["kd", "K/D"], ["kast", "KAST"], ["adr", "ADR"], ["hs", "HS%"], ["k", "K"], ["d", "D"], ["a", "A"], ["fk", "FK"], ["fd", "FD"]];
const PCT = ["kast", "hs"];
const plain = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const fmt = (k, v) => (v == null ? "–" : PCT.includes(k) ? `${v}%` : k === "r" || k === "kd" ? Number(v).toFixed(2) : v);

function Players({ list }) {
  const tr = useT();
  const [sort, setSort] = useState("r");
  const [min, setMin] = useState(3);
  const [q, setQ] = useState("");
  const rows = useMemo(() => list.filter((p) => p.maps >= min).filter((p) => !q || plain(p.name).includes(plain(q)) || plain(p.team).includes(plain(q)))
    .sort((x, y) => (y[sort] ?? -1) - (x[sort] ?? -1) || x.name.localeCompare(y.name)), [list, sort, min, q]);
  return (
    <>
      <div className="statsbar">
        <label className="f">{tr("At least")}
          <select value={min} onChange={(e) => setMin(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => <option key={n} value={n}>{tr("{n} maps", { n })}</option>)}
          </select>
        </label>
        <input type="search" className="lftfind" placeholder={tr("Find a player or a team")} aria-label={tr("Find a player or a team")} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="vlrscroll">
        <table className="vlrtable statstable">
          <thead>
            <tr>
              <th>#</th>
              <th className="vlrp">{tr("Player")}</th>
              {PCOLS.map(([k, label]) => (
                <th key={k} aria-sort={sort === k ? "descending" : undefined}>
                  <button type="button" className={"sortbtn" + (sort === k ? " on" : "")} onClick={() => setSort(k)}>{label === "Maps" ? tr("Maps") : label}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={p.slug}>
                <td>{i + 1}</td>
                <td className="vlrp">
                  <span className="vlrname">{p.cc && <Flag cc={p.cc} />}<a href={`/player/${p.slug}`}>{p.name}</a></span>
                  <span className="vlragents">{p.team ? <a href={`/team/${teamSlug(p.team)}`}>{p.team}</a> : null}{p.agents.length ? ` · ${p.agents.slice(0, 3).map((a) => cap(a.name)).join(", ")}` : ""}</span>
                </td>
                {PCOLS.map(([k]) => <td key={k} className={k === sort ? "strong" : ""}>{fmt(k, p[k])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="note">{tr("Nobody here.")}</p>}
    </>
  );
}

function Teams({ teams }) {
  const tr = useT();
  const list = Object.entries(teams).map(([slug, t]) => ({ slug, ...t, pct: t.maps ? Math.round((t.mapsWon / t.maps) * 100) : 0, diff: t.roundsW - t.roundsL }))
    .sort((x, y) => y.mapsWon - x.mapsWon || y.diff - x.diff);
  return (
    <div className="vlrscroll">
      <table className="vlrtable statstable">
        <thead><tr><th className="vlrp">{tr("Team")}</th><th>{tr("Maps")}</th><th>%</th><th>{tr("Rounds")}</th><th>+/–</th><th>{tr("Best map")}</th><th>{tr("Best player")}</th></tr></thead>
        <tbody>
          {list.map((t) => {
            const top = t.byMap.filter((m) => m.played).sort((x, y) => y.won / y.played - x.won / x.played || y.played - x.played)[0];
            return (
              <tr key={t.slug}>
                <td className="vlrp"><a href={`/team/${t.slug}`}>{t.name}</a></td>
                <td>{t.mapsWon} – {t.maps - t.mapsWon}</td>
                <td>{t.pct}%</td>
                <td>{t.roundsW} – {t.roundsL}</td>
                <td className={t.diff > 0 ? "vlrpos" : t.diff < 0 ? "vlrneg" : ""}>{t.diff > 0 ? `+${t.diff}` : t.diff}</td>
                <td>{top ? `${top.map} (${top.won}/${top.played})` : "–"}</td>
                <td>{t.best[0] ? <a href={`/player/${teamSlug(t.best[0].name)}`}>{t.best[0].name}</a> : "–"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Maps({ maps, event }) {
  const tr = useT();
  const total = maps.reduce((n, m) => n + m.played, 0);
  return (
    <div className="vlrscroll">
      <table className="vlrtable statstable">
        <thead><tr><th className="vlrp">{tr("Map")}</th><th>{tr("Played")}</th><th>%</th><th>{tr("Attack")}</th><th>{tr("Average gap")}</th><th>{tr("Overtime")}</th><th>{tr("Closest map")}</th></tr></thead>
        <tbody>
          {maps.map((m) => (
            <tr key={m.map}>
              <td className="vlrp"><a href={`/map/${encodeURIComponent(m.map.toLowerCase())}${event ? `?e=${event}` : ""}`}><b>{m.map}</b></a></td>
              <td>{m.played}</td>
              <td>{total ? Math.round((m.played / total) * 100) : 0}%</td>
              <td>{m.attack != null ? `${m.attack}%` : "–"}</td>
              <td>{m.diff} {tr("rounds")}</td>
              <td>{m.overtime}</td>
              <td>{m.closest ? <a href={`/match/${m.closest.event}/${m.closest.id}`}>{m.closest.ta} {m.closest.a}–{m.closest.b} {m.closest.tb}</a> : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function View({ stats, event, events }) {
  const tr = useT();
  const [tab, setTab] = useState("players");
  return (
    <div className="wrap teampage">
      <div className="topbar">
        <h1 className="brandh"><a className="homelink" href="/" title={tr("Home")}><EmeaMark /></a><span>{tr("Stats")}</span></h1>
        <SearchBar />
        <div className="prefs"><ThemeSwitch /><LangSwitch /></div>
      </div>
      <SiteNav />
      {events.length > 1 && (
        <div className="tabs sub" role="tablist" aria-label={tr("Event")}>
          {events.map((e) => <a key={e} role="tab" aria-selected={e === event} className="tablink" href={`/stats?e=${e}`}>{tr(EVENT_NAMES[e] || e)}</a>)}
        </div>
      )}
      {!stats ? <p className="note">{tr("The numbers appear once the first matches have their vlr.gg table.")}</p> : (
        <>
          <p className="note">{tr(EVENT_NAMES[event] || event)} · {tr("{n} maps played", { n: stats.maps.reduce((n, m) => n + m.played, 0) })} · {tr("Averages per map.")} <a href={`/recap/${event}`}>{tr("Recap")} ›</a></p>
          <div className="tabs sub" role="tablist" aria-label={tr("Stats")}>
            {[["players", "Players"], ["teams", "Teams"], ["maps", "Maps"]].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{tr(l)}</button>)}
          </div>
          {tab === "players" && <Players list={stats.players} />}
          {tab === "teams" && <Teams teams={stats.teams} />}
          {tab === "maps" && <Maps maps={stats.maps} event={event} />}
          <p className="vlrcredit">{tr("Numbers from")} <a href="https://www.vlr.gg/" target="_blank" rel="noopener noreferrer">vlr.gg</a></p>
        </>
      )}
    </div>
  );
}

export default function StatsPage({ lang, ...props }) {
  return <LangProvider lang={lang}><View {...props} /></LangProvider>;
}
