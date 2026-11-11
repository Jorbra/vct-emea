"use client";

import { useMemo, useState } from "react";
import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import { ThemeSwitch } from "./theme.jsx";
import { EmeaMark } from "./Brand.jsx";
import SearchBar from "./SearchBar.jsx";
import SiteNav from "./SiteNav.jsx";
import { Flag } from "./TeamCard.jsx";
import { EVENT_NAMES, teamSlug } from "../lib/paths.js";
import { AgentMapTable, FormList } from "./Round10.jsx";

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
      {rows.length >= 3 && (() => {
        const top = rows.filter((p) => p[sort] != null).slice(0, 10);
        const max = Math.max(...top.map((p) => p[sort])) || 1;
        const min = Math.min(...top.map((p) => p[sort]));
        const fmt = (v) => (["r", "kd"].includes(sort) ? Number(v).toFixed(2) : Math.round(v));
        return (
          <figure className="statchart" aria-label={tr("Top 10")}>
            <figcaption>{tr("Top 10")} · {String(sort).toUpperCase() === "R" ? "Rating" : String(sort).toUpperCase()}</figcaption>
            {top.map((p, i) => (
              <div key={p.slug || p.name} className="scrow">
                <span className="scname">{i + 1}. {p.name}<small> · {p.team}</small></span>
                <span className="scbar"><i style={{ width: `${Math.max(8, Math.round(((p[sort] - min * 0.9) / (max - min * 0.9)) * 100))}%` }} /></span>
                <b>{fmt(p[sort])}</b>
              </div>
            ))}
          </figure>
        );
      })()}
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

/** Each agent: maps picked, maps won, its best players. */
function Agents({ list }) {
  const tr = useT();
  const total = list.reduce((n, a) => n + a.picks, 0);
  return (
    <div className="vlrscroll">
      <table className="vlrtable statstable">
        <thead><tr><th className="vlrp">{tr("Agent")}</th><th>{tr("Picked")}</th><th>{tr("Pick rate")}</th><th>{tr("Maps won")}</th><th>{tr("Best players")}</th></tr></thead>
        <tbody>{list.map((a) => (
          <tr key={a.agent}>
            <td className="vlrp"><b>{a.name}</b></td>
            <td>{a.picks}</td>
            <td>{total ? Math.round((a.picks / (total / 5)) * 100) : 0}%</td>
            <td>{a.pct}%</td>
            <td className="vlrp">{a.best.map((p, i) => <span key={p.slug}>{i ? " · " : ""}<a href={`/player/${p.slug}`}>{p.name}</a> <small>{p.r != null ? p.r.toFixed(2) : "–"}</small></span>)}</td>
          </tr>
        ))}</tbody>
      </table>
      <p className="hint">{tr("Pick rate: share of the maps where a team played the agent. Best players: 2 maps on it at least, by rating.")}</p>
    </div>
  );
}

/** The tournament's records. */
function Records({ r, event }) {
  const tr = useT();
  const link = (x, text) => <a href={`/match/${x.event}/${x.id}`}>{text}</a>;
  const block = (title, list, show) => list.length > 0 && (
    <section className="recordbox">
      <h3>{title}</h3>
      <ol>{list.map((x, i) => <li key={i}>{show(x)}</li>)}</ol>
    </section>
  );
  return (
    <div className="records">
      {block(tr("Highest ACS on a map"), r.acs, (x) => <><a href={`/player/${x.slug}`}><b>{x.name}</b></a> {x.value} ACS · {link(x, x.map)} <small>{x.team}</small></>)}
      {block(tr("Most kills on a map"), r.kills, (x) => <><a href={`/player/${x.slug}`}><b>{x.name}</b></a> {x.value} kills · {link(x, x.map)} <small>{x.team}</small></>)}
      {block(tr("Longest maps"), r.long, (x) => link(x, <>{x.a} <b>{x.sa}–{x.sb}</b> {x.b} · {x.map} <small>({tr("{n} rounds", { n: x.rounds })})</small></>))}
      {block(tr("Biggest wins on a map"), r.blowout, (x) => link(x, <><b>{x.winner}</b> {x.w}–{x.l} {x.loser} · {x.map}</>))}
      {block(tr("Comebacks: won after losing the first map"), r.comeback, (x) => link(x, <><b>{x.winner}</b> {x.sa}–{x.sb} {x.loser}</>))}
      {event && <p className="hint"><a href={`/recap/${event}`}>{tr("Recap")} ›</a></p>}
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
            {[["players", "Players"], ["form", "Players in form"], ["teams", "Teams"], ["maps", "Maps"], ["agents", "Agents"], ["agentmaps", "Agents by map"], ["records", "Records"]].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{tr(l)}</button>)}
          </div>
          {tab === "players" && <Players list={stats.players} />}
          {tab === "teams" && <Teams teams={stats.teams} />}
          {tab === "maps" && <Maps maps={stats.maps} event={event} />}
          {tab === "agents" && <Agents list={stats.agents || []} />}
          {tab === "agentmaps" && <AgentMapTable data={stats.agentMaps} />}
          {tab === "form" && <FormList list={stats.form} />}
          {tab === "records" && stats.records && <Records r={stats.records} event={event} />}
          <p className="vlrcredit">{tr("Numbers from")} <a href="https://www.vlr.gg/" target="_blank" rel="noopener noreferrer">vlr.gg</a></p>
        </>
      )}
    </div>
  );
}

export default function StatsPage({ lang, ...props }) {
  return <LangProvider lang={lang}><View {...props} /></LangProvider>;
}
