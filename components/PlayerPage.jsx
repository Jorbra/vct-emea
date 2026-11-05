"use client";

import { Fragment } from "react";
import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import SiteNav from "./SiteNav.jsx";
import { ThemeSwitch } from "./theme.jsx";
import { EmeaMark } from "./Brand.jsx";
import { Crest } from "./Crest.jsx";
import { Flag } from "./TeamCard.jsx";
import LpImg from "./LpImg.jsx";
import { VlrCredit, VlrResults, VlrStats } from "./VlrBlocks.jsx";
import SearchBar from "./SearchBar.jsx";
import { useAutoRefresh } from "./autoRefresh.js";
import { EVENT_NAMES, siteHref, teamHref, teamSlug } from "../lib/paths.js";
import { localeOf } from "../lib/i18n.js";
import { dayText, moneyText, periodText } from "../lib/format.js";

/** A name, linked to its page on this site when it has one. */
const Named = ({ href, title, children }) => (href ? <a href={href} title={title}>{children}</a> : <span title={title}>{children}</span>);

/** The results Liquipedia lists for the person. */
function Achievements({ list }) {
  const tr = useT();
  return (
    <section>
      <h2>{tr("Achievements")}</h2>
      <div className="tablewrap">
        <table className="cards">
          <thead><tr><th>{tr("Date")}</th><th>{tr("Place")}</th><th>{tr("Tier")}</th><th>{tr("Tournament")}</th><th>{tr("Team")}</th><th>{tr("Last match")}</th><th>{tr("Prize")}</th></tr></thead>
          <tbody>
            {list.map((r, i) => (
              <tr key={i}>
                <td className="nowrap" data-label={tr("Date")}>{dayText(r.date, tr.lang)}</td>
                <td className="nowrap" data-label={tr("Place")}><b>{r.place}</b></td>
                <td className="nowrap" data-label={tr("Tier")}>{r.tier}</td>
                <td data-label={tr("Tournament")}><span className="tach"><LpImg f={r.tournamentLogo} dark={r.tournamentLogoDark} /><Named href={r.tournamentHref}>{r.tournament}</Named></span></td>
                <td className="nowrap" data-label={tr("Team")}><span className="tach">{r.teamLogo && <LpImg f={r.teamLogo} dark={r.teamLogoDark} />}<Named href={r.teamHref} title={r.teamName}>{r.team}</Named></span></td>
                <td className="nowrap" data-label={tr("Last match")}><span className="tach"><span className="tachs">{r.score}</span>{r.opponentLogo && <LpImg f={r.opponentLogo} dark={r.opponentLogoDark} />}{r.opponent && <Named href={r.opponentHref} title={r.opponentName}>{r.opponent}</Named>}</span></td>
                <td className="nowrap" data-label={tr("Prize")}>{moneyText(r.prize, tr.lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** A country in the visitor's language, when it has a two-letter code; else as Liquipedia names it. */
function countryName(n, lang) {
  try {
    return (/^[a-z]{2}$/.test(n.cc) && new Intl.DisplayNames([localeOf(lang)], { type: "region" }).of(n.cc.toUpperCase())) || n.name;
  } catch {
    return n.name;
  }
}

/** The side column: the person's information and former teams, from Liquipedia. */
function PlayerSide({ p }) {
  const tr = useT();
  const { lp } = p;
  const otherTeam = lp.team && teamSlug(lp.team) !== p.teamSlug;
  const present = (s) => s.replace(/Present$/, tr("Present"));
  return (
    <aside>
      <div className="info tinfo">
        <h3>{tr("Player information")}</h3>
        <dl>
          {lp.nationality.length > 0 && <><dt>{tr("Nationality:")}</dt><dd>{lp.nationality.map((n) => countryName(n, tr.lang)).join(", ")}</dd></>}
          {lp.status && <><dt>{tr("Status:")}</dt><dd>{tr(lp.status)}</dd></>}
          {lp.roles && <><dt>{tr("Role:")}</dt><dd>{tr(lp.roles)}</dd></>}
          {lp.years && <><dt>{tr("Years active:")}</dt><dd>{present(lp.years)}</dd></>}
          {otherTeam && <><dt>{tr("Team on Liquipedia:")}</dt><dd>{lp.team}</dd></>}
          {lp.winnings && <><dt>{tr("Winnings:")}</dt><dd>{moneyText(lp.winnings, tr.lang)}</dd></>}
        </dl>
      </div>
      {lp.history.length > 0 && (
        <div className="info tinfo">
          <h3>{tr("Team history")}</h3>
          <ul className="phist">
            {lp.history.map((h, i) => (
              <li key={i}>
                <Named href={h.href}>{h.team}</Named>{h.note ? <small> ({tr(h.note)})</small> : null}
                <small className="phperiod">{present(periodText(h.period, tr.lang))}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}

function View({ p }) {
  const tr = useT();
  useAutoRefresh();
  const played = p.matches.filter((m) => m.sa != null && m.sb != null || m.at).sort((x, y) => (y.at || "").localeCompare(x.at || "")).slice(0, 15);
  const team = { name: p.team, logo: p.teamOnSite ? p.teamLogo : "", tag: p.teamTag };
  const { lp } = p;
  const fmt = (at) => (at ? new Intl.DateTimeFormat(localeOf(tr.lang), { day: "numeric", month: "short", year: "numeric" }).format(new Date(at)) : "–");
  // the person's own accounts; statistics sites are left out, this page takes their place
  const links = lp ? lp.links.filter((l) => l.type !== "VLR") : [];
  const about = [
    p.realName,
    p.team ? <a href={teamHref(p.team)}>{p.team}</a> : "",
    p.role ? tr(p.role) : "",
    p.sub ? tr("Sub") : "",
    p.join ? `${tr("Joined")} ${dayText(p.join, tr.lang)}` : "",
  ].filter(Boolean);
  return (
    <div className="wrap teampage">
      <div className="topbar">
        <h1 className="brandh"><a className="homelink" href="/" title={tr("Home")}><EmeaMark /></a><span>{p.name}</span></h1>
        <SearchBar />
        <div className="prefs"><ThemeSwitch /><LangSwitch /></div>
      </div>
      <SiteNav />
      <nav className="crumbs" aria-label={tr("Breadcrumb")}><a href="/">{tr("Home")}</a> › {p.team ? <><a href={teamHref(p.team)}>{p.team}</a> › </> : null}<span>{p.name}</span></nav>
      <div className="thead">
        {p.team ? (p.teamOnSite ? <Crest team={team} /> : <span className="thlogo"><LpImg f={p.teamLogo} /></span>) : null}
        <div>
          <div className="tname"><span className="pt"><Flag cc={p.cc} /><span>{p.name}</span>{p.captain && <span className="tcapt" title={tr("Captain")}>C</span>}</span></div>
          {about.length > 0 && <div className="tsub">{about.map((x, i) => <Fragment key={i}>{i ? " · " : ""}{x}</Fragment>)}</div>}
          <div className="tlinks"><a href={`/compare?a=${encodeURIComponent(p.name)}`}>{tr("Compare")}</a>{links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer">{l.type} ↗</a>)}</div>
        </div>
      </div>
      {p.lpState === "pending" && <p className="note lpwait" role="status">{tr("Looking for this information…")}</p>}
      {p.updating && <p className="note lpwait" role="status">{tr("Updating this information…")}</p>}
      {p.lpState === "none" && !p.onSite && !p.teamOnSite && !p.vlr && !p.updating && !p.lines.length && <p className="note">{tr("No information found for now.")}</p>}
      {p.totals && (
        <div className="pstatbar">
          <div><b>{p.totals.acs}</b><span>ACS</span></div>
          <div><b>{p.totals.kd}</b><span>K/D</span></div>
          <div><b>{p.totals.k}/{p.totals.d}/{p.totals.a}</b><span>K/D/A</span></div>
          <div><b>{p.mvps.length}</b><span>MVP</span></div>
          <div><b>{p.totals.matches}</b><span>{tr("Matches")}</span></div>
        </div>
      )}
      {!p.totals && p.mvps.length > 0 && <div className="pstatbar"><div><b>{p.mvps.length}</b><span>MVP</span></div></div>}
      <div className={lp ? "cols" : undefined}>
        <main>
          <VlrStats vlr={p.vlr} />
          {p.lines.length > 0 && (
            <section>
              <h2>{tr("Matches played")}</h2>
              <div className="tablewrap">
                <table>
                  <thead><tr><th>{tr("Event")}</th><th>{tr("Round")}</th><th>{tr("Opponent")}</th><th>ACS</th><th>K</th><th>D</th><th>A</th></tr></thead>
                  <tbody>{p.lines.map((l) => (
                    <tr key={l.event + l.id}><td>{tr(EVENT_NAMES[l.event])}</td><td>{l.round.map(([k, v]) => tr(k, v)).join(" · ")}</td><td>{(l.opponent && l.opponent.name) || tr("TBD")}</td><td><b>{l.acs}</b></td><td>{l.k}</td><td>{l.d}</td><td>{l.a}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </section>
          )}
          {(p.onSite || p.teamOnSite) && (
            <section>
              <h2>{tr("{team}'s matches", { team: p.team })}</h2>
              {played.length === 0 ? <p className="note">{tr("No match yet.")}</p> : (
                <div className="tablewrap">
                  <table>
                    <thead><tr><th>{tr("Date")}</th><th>{tr("Event")}</th><th>{tr("Match")}</th><th>{tr("Score")}</th></tr></thead>
                    <tbody>{played.map((m) => (
                      <tr key={m.event + m.id}><td className="nowrap">{fmt(m.at)}</td><td><a href={siteHref(m.event)}>{tr(EVENT_NAMES[m.event])}</a></td><td>{(m.a && m.a.name) || tr("TBD")} vs {(m.b && m.b.name) || tr("TBD")}</td><td className="tscore">{m.sa != null ? `${m.sa} – ${m.sb}` : "–"}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </section>
          )}
          <VlrResults vlr={p.vlr} />
          {lp && lp.results.length > 0 && <Achievements list={lp.results} />}
          <VlrCredit vlr={p.vlr} />
          {lp && (
            <p className="note">
              {tr("Player information from")} <a href={lp.url} target="_blank" rel="noopener noreferrer">Liquipedia</a> (CC-BY-SA), {tr("as of {date}", { date: lp.fetched.slice(0, 10) })}.
            </p>
          )}
        </main>
        {lp && <PlayerSide p={p} />}
      </div>
    </div>
  );
}

export default function PlayerPage({ profile, lang }) {
  return <LangProvider lang={lang}><View p={profile} /></LangProvider>;
}
