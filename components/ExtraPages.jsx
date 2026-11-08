"use client";

import { useMemo, useState } from "react";
import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import SiteNav from "./SiteNav.jsx";
import { ThemeSwitch } from "./theme.jsx";
import { EmeaMark } from "./Brand.jsx";
import { Flag } from "./TeamCard.jsx";
import SearchBar from "./SearchBar.jsx";
import { EVENT_NAMES, teamSlug } from "../lib/paths.js";
import { dayText, moneyText } from "../lib/format.js";

function Top({ title, crumb }) {
  const tr = useT();
  return (
    <>
      <div className="topbar">
        <h1 className="brandh"><a className="homelink" href="/" title={tr("Home")}><EmeaMark /></a><span>{title}</span></h1>
        <SearchBar />
        <div className="prefs"><ThemeSwitch /><LangSwitch /></div>
      </div>
      <SiteNav />
      <nav className="crumbs" aria-label={tr("Breadcrumb")}><a href="/">{tr("Home")}</a> › <span>{crumb || title}</span></nav>
    </>
  );
}

// ---- transfers
function TransfersView({ list }) {
  const tr = useT();
  return (
    <div className="wrap teampage">
      <Top title={tr("Transfers")} />
      <p className="note">{tr("From the teams read so far on Liquipedia.")}</p>
      {list.length === 0 ? <p className="note">{tr("No transfer known yet.")}</p> : (
        <div className="tablewrap wide">
          <table className="cards">
            <thead><tr><th>{tr("Date")}</th><th>{tr("Player")}</th><th>{tr("Team")}</th><th>{tr("Move")}</th></tr></thead>
            <tbody>
              {list.map((t, i) => (
                <tr key={i}>
                  <td className="nowrap" data-label={tr("Date")}>{dayText(t.date, tr.lang)}</td>
                  <td data-label={tr("Player")}><span className="pt"><Flag cc={t.cc} /><a href={`/player/${teamSlug(t.id)}`}>{t.id}</a></span></td>
                  <td data-label={tr("Team")}><a href={`/team/${t.teamKey}`}>{t.team}</a></td>
                  <td data-label={tr("Move")}>
                    {t.kind === "in" ? <span className="tin">→ {tr("Joined")}</span> : <span className="tout">← {tr("Left")}{t.to ? " · " : ""}{t.toHref ? <a href={t.toHref}>{t.to}</a> : t.to ? tr(t.to) : ""}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="note">{tr("Information from")} <a href="https://liquipedia.net/valorant/" target="_blank" rel="noopener noreferrer">Liquipedia</a> (CC-BY-SA).</p>
    </div>
  );
}
export const TransfersPage = ({ list, lang }) => <LangProvider lang={lang}><TransfersView list={list} /></LangProvider>;

// ---- comparing two players
function CompareView({ a, b, qa, qb }) {
  const tr = useT();
  const rows = [
    ["Team", (p) => p.team || "–"],
    ["Role:", (p) => (p.roles ? tr(p.roles) : "–")],
    ["Rating", (p) => (p.totals ? p.totals.rating : "–"), true],
    ["ACS", (p) => (p.totals ? p.totals.acs : "–"), true],
    ["K/D", (p) => (p.totals ? p.totals.kd : "–"), true],
    ["ADR", (p) => (p.totals ? p.totals.adr : "–"), true],
    ["KAST", (p) => (p.totals ? p.totals.kast : "–"), true],
    ["Maps", (p) => (p.totals ? p.totals.maps : "–"), true],
    ["Titles", (p) => p.titles, true],
    ["Winnings:", (p) => (p.winnings ? moneyText(p.winnings, tr.lang) : "–")],
  ];
  const best = (va, vb, on) => (on && typeof va === "number" && typeof vb === "number" ? [va > vb, vb > va] : [false, false]);
  return (
    <div className="wrap teampage">
      <Top title={tr("Compare players")} />
      <form className="cmpform" method="get" action="/compare">
        <label className="f">{tr("Player 1")}<input name="a" defaultValue={qa} maxLength={40} /></label>
        <label className="f">{tr("Player 2")}<input name="b" defaultValue={qb} maxLength={40} /></label>
        <button className="btn pri" type="submit">{tr("Compare them")}</button>
      </form>
      {qa && !a && <p className="err">{tr("Unknown player: {name}", { name: qa })}</p>}
      {qb && !b && <p className="err">{tr("Unknown player: {name}", { name: qb })}</p>}
      {a && b && (
        <div className="tablewrap wide">
          <table>
            <thead><tr><th><a href={a.href}>{a.name}</a></th><th /><th><a href={b.href}>{b.name}</a></th></tr></thead>
            <tbody>
              {rows.map(([label, get, on]) => {
                const va = get(a);
                const vb = get(b);
                const [wa, wb] = best(va, vb, on);
                return (
                  <tr key={label}>
                    <td className={wa ? "cmpw" : ""}>{va}</td>
                    <th scope="row">{tr(label).replace(/\s*:$/, "")}</th>
                    <td className={wb ? "cmpw" : ""}>{vb}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {a && b && a.season && b.season && (
        <div className="cmpbars" aria-hidden="true">
          <div className="cmpnames"><b>{a.name}</b><b>{b.name}</b></div>
          {[["Rating", "r", 2], ["ACS", "acs", 0], ["K/D", "kd", 2], ["KAST", "kast", 0, "%"], ["ADR", "adr", 0], ["HS%", "hs", 0, "%"]].map(([label, k, d, unit = ""]) => {
            const va = a.season[k];
            const vb = b.season[k];
            if (va == null || vb == null) return null;
            const top = Math.max(va, vb) || 1;
            return (
              <div className="cmpbar" key={k}>
                <span className={"cba" + (va > vb ? " w" : "")}><i style={{ width: `${Math.round((va / top) * 100)}%` }} /><em>{Number(va).toFixed(d)}{unit}</em></span>
                <small>{label}</small>
                <span className={"cbb" + (vb > va ? " w" : "")}><i style={{ width: `${Math.round((vb / top) * 100)}%` }} /><em>{Number(vb).toFixed(d)}{unit}</em></span>
              </div>
            );
          })}
        </div>
      )}
      {a && b && (a.season || b.season) && (
        <div className="tablewrap wide">
          <h2>{tr("This season on the site")}</h2>
          <table>
            <thead><tr><th><a href={a.href}>{a.name}</a></th><th /><th><a href={b.href}>{b.name}</a></th></tr></thead>
            <tbody>
              {[["Maps", "maps", false], ["Rating", "r", true], ["ACS", "acs", false], ["K/D", "kd", true], ["KAST", "kast", false, "%"], ["ADR", "adr", false], ["HS%", "hs", false, "%"], ["FK", "fk", false], ["FD", "fd", false, "", true]].map(([label, k, two, unit = "", low = false]) => {
                const va = a.season ? a.season[k] : null;
                const vb = b.season ? b.season[k] : null;
                const show = (v) => (v == null ? "–" : (two ? Number(v).toFixed(2) : v) + unit);
                const both = va != null && vb != null;
                const wa = both && (low ? va < vb : va > vb);
                const wb = both && (low ? vb < va : vb > va);
                return <tr key={k}><td className={wa ? "cmpw" : ""}>{show(va)}</td><th scope="row">{label === "Maps" ? tr("Maps") : label}</th><td className={wb ? "cmpw" : ""}>{show(vb)}</td></tr>;
              })}
            </tbody>
          </table>
          <p className="hint">{tr("The matches of this site's events, from vlr.gg's tables. Averages per map.")}</p>
        </div>
      )}
      {a && b && (a.waiting || b.waiting) && <p className="note lpwait" role="status">{tr("Looking for this information…")}</p>}
      <p className="note">{tr("Statistics and recent results from")} vlr.gg · {tr("Information from")} Liquipedia (CC-BY-SA).</p>
    </div>
  );
}
export const ComparePage = (p) => <LangProvider lang={p.lang}><CompareView {...p} /></LangProvider>;

// ---- rankings over the matches of the site
const SORTS = [["acs", "ACS"], ["kd", "K/D"], ["k", "K"], ["a", "A"], ["matches", "Matches"]];

function RankingsView({ byEvent }) {
  const tr = useT();
  const [event, setEvent] = useState("");
  const [sort, setSort] = useState("acs");
  const rows = useMemo(() => [...(byEvent[event] || [])].sort((x, y) => y[sort] - x[sort] || x.name.localeCompare(y.name)), [byEvent, event, sort]);
  const events = Object.keys(byEvent).filter(Boolean);
  return (
    <div className="wrap teampage">
      <Top title={tr("Rankings")} />
      <div className="cmpform">
        <label className="f">{tr("Event")}
          <select value={event} onChange={(e) => setEvent(e.target.value)}>
            <option value="">{tr("All events")}</option>
            {events.map((k) => <option key={k} value={k}>{tr(EVENT_NAMES[k])}</option>)}
          </select>
        </label>
        <label className="f">{tr("Sort by")}
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map(([k, label]) => <option key={k} value={k}>{tr(label)}</option>)}
          </select>
        </label>
      </div>
      {rows.length === 0 ? <p className="note">{tr("The rankings fill in as the players' numbers are entered on matches.")}</p> : (
        <div className="tablewrap wide">
          <table>
            <thead><tr><th>#</th><th>{tr("Player")}</th><th>ACS</th><th>K/D</th><th>K</th><th>D</th><th>A</th><th>{tr("Matches")}</th></tr></thead>
            <tbody>
              {rows.map((p, i) => (
                <tr key={p.name}><td>{i + 1}</td><td><a href={`/player/${teamSlug(p.name)}`}>{p.name}</a></td><td><b>{p.acs}</b></td><td>{p.kd}</td><td>{p.k}</td><td>{p.d}</td><td>{p.a}</td><td>{p.matches}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
export const RankingsPage = ({ byEvent, lang }) => <LangProvider lang={lang}><RankingsView byEvent={byEvent} /></LangProvider>;

// ---- about
function AboutView() {
  const tr = useT();
  return (
    <div className="wrap teampage">
      <Top title={tr("About")} />
      <article className="newsbody">
        <h2>{tr("A site made by a fan")}</h2>
        <p>{tr("This site follows VCT EMEA and Game Changers EMEA: results, brackets, teams and players. It is not official: it is not affiliated with or endorsed by Riot Games, and the names and logos belong to their owners.")}</p>
        <h2>{tr("Where the information comes from")}</h2>
        <p>{tr("Results and schedules are entered by the site's editors.")}</p>
        <p>{tr("Team, player and tournament information comes from")} <a href="https://liquipedia.net/valorant/" target="_blank" rel="noopener noreferrer">Liquipedia</a>{tr(", under the CC-BY-SA licence; it may have been reformatted here.")}</p>
        <p>{tr("Career statistics and some recent results come from")} <a href="https://www.vlr.gg/" target="_blank" rel="noopener noreferrer">vlr.gg</a>.</p>
        <h2>{tr("Your data")}</h2>
        <p>{tr("An account is optional. It keeps your name, your password in a form nobody can read back, your favorite teams, predictions and settings, until you delete it from your account page.")}</p>
        <p>{tr("No account is needed to read the site. Your favorite teams stay in your browser. If you turn alerts on, the site keeps your browser's notification address and the teams you follow, until you turn them off. If you play predictions, it keeps the name you chose and your picks.")}</p>
      </article>
    </div>
  );
}
export const AboutPage = ({ lang }) => <LangProvider lang={lang}><AboutView /></LangProvider>;
