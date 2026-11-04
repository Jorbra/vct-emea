"use client";

import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import { ThemeSwitch } from "./theme.jsx";
import { EmeaMark } from "./Brand.jsx";
import LpImg from "./LpImg.jsx";
import SearchBar from "./SearchBar.jsx";
import { useAutoRefresh } from "./autoRefresh.js";

function View({ t }) {
  const tr = useT();
  useAutoRefresh();
  const { lp } = t;
  const facts = lp ? [["Series:", lp.series], ["Organizer:", lp.organizer], ["Type:", lp.type], ["Location:", lp.location], ["Venue:", lp.venue], ["Prize pool:", lp.prizePool], ["Start Date:", lp.start], ["End Date:", lp.end], ["Teams:", lp.teams], ["Tier:", lp.tier]].filter(([, v]) => v) : [];
  return (
    <div className="wrap teampage">
      <div className="topbar">
        <h1 className="brandh"><a className="homelink" href="/" title={tr("Home")}><EmeaMark /></a><span>{t.name}</span></h1>
        <SearchBar />
        <div className="prefs"><ThemeSwitch /><LangSwitch /></div>
      </div>
      <nav className="crumbs" aria-label={tr("Breadcrumb")}><a href="/">{tr("Home")}</a> › <span>{tr("Tournaments")}</span> › <span>{t.name}</span></nav>
      <div className="thead">
        {t.logo && <span className="thlogo"><LpImg f={t.logo} dark={t.logoDark} /></span>}
        <div>
          <div className="tname">{t.name}</div>
          {lp && lp.start && <div className="tsub">{lp.start}{lp.end && lp.end !== lp.start ? ` – ${lp.end}` : ""}</div>}
        </div>
      </div>
      {t.pending && <p className="note lpwait" role="status">{tr("Looking for this information…")}</p>}
      {t.updating && <p className="note lpwait" role="status">{tr("Updating this information…")}</p>}
      {!t.pending && !lp && !t.updating && <p className="note">{tr("No information found for now.")}</p>}
      {lp && (
        <div className="cols">
          <main>
            {lp.placements.length > 0 && (
              <section>
                <h2>{tr("Results")}</h2>
                <div className="tablewrap">
                  <table>
                    <thead><tr><th>{tr("Place")}</th><th>{tr("Team")}</th><th>{tr("Prize")}</th></tr></thead>
                    <tbody>
                      {lp.placements.map((p, i) => (
                        <tr key={i}>
                          <td className="nowrap"><b>{p.place}</b></td>
                          <td><span className="tach"><LpImg f={p.logo} dark={p.logoDark} />{p.href ? <a href={p.href}>{p.team}</a> : p.team}</span></td>
                          <td className="nowrap">{p.prize || "–"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            <p className="note">
              {tr("Tournament information from")} <a href={lp.url} target="_blank" rel="noopener noreferrer">Liquipedia</a> (CC-BY-SA), {tr("as of {date}", { date: lp.fetched.slice(0, 10) })}.
            </p>
          </main>
          <aside>
            <div className="info tinfo">
              <h3>{tr("Tournament information")}</h3>
              <dl>{facts.map(([k, v]) => <div key={k} style={{ display: "contents" }}><dt>{tr(k)}</dt><dd>{v}</dd></div>)}</dl>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

export default function LpTournamentPage({ t, lang }) {
  return <LangProvider lang={lang}><View t={t} /></LangProvider>;
}
