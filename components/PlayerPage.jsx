"use client";

import { Fragment, useState } from "react";
import { PartTabs } from "./Round10.jsx";
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
import FollowStar from "./FollowStar.jsx";
import { AlertsButton } from "./MatchAlerts.jsx";
import Trend from "./Trend.jsx";
import { PlayerRadar } from "./Round8Bits.jsx";
import { CareerTimeline } from "./Round10.jsx";
import { PlayerHero } from "./Round11.jsx";
import { RatingByMap } from "./Round13.jsx";
import { AgentMastery } from "./Round16.jsx";
import { NextMatchBanner } from "./Team18.jsx";
import { Records } from "./Round21.jsx";
import { RollNum } from "./Round22.jsx";
import { Radar, TopBadges } from "./Round24.jsx";
import { SimilarPlayers } from "./Round25.jsx";
import { topBadges } from "../lib/radar24.js";

// the map where the player rates best (2 maps at least there)
const bestMap = (t) => ((t && t.byMap) || []).filter((x) => x.r != null && x.n >= 2).sort((a, b) => b.r - a.r)[0] || null;
import { AgentIcon, AgentList, agentInfo } from "./Assets.jsx";

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
function PlayerSide({ p, historyOnly = false }) {
  const tr = useT();
  const { lp } = p;
  const otherTeam = lp.team && teamSlug(lp.team) !== p.teamSlug;
  const present = (s) => s.replace(/Present$/, tr("Present"));
  const Box = historyOnly ? Fragment : "aside";
  return (
    <Box>
      {!historyOnly && <div className="info tinfo">
        <h3>{tr("Player information")}</h3>
        <dl>
          {lp.nationality.length > 0 && <><dt>{tr("Nationality:")}</dt><dd>{lp.nationality.map((n) => countryName(n, tr.lang)).join(", ")}</dd></>}
          {lp.status && <><dt>{tr("Status:")}</dt><dd>{tr(lp.status)}</dd></>}
          {lp.roles && <><dt>{tr("Role:")}</dt><dd>{tr(lp.roles)}</dd></>}
          {lp.years && <><dt>{tr("Years active:")}</dt><dd>{present(lp.years)}</dd></>}
          {otherTeam && <><dt>{tr("Team on Liquipedia:")}</dt><dd>{lp.team}</dd></>}
          {lp.winnings && <><dt>{tr("Winnings:")}</dt><dd>{moneyText(lp.winnings, tr.lang)}</dd></>}
        </dl>
      </div>}
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
    </Box>
  );
}

/** The player's numbers in the tournaments, from vlr.gg's tables: averages per map, agents and each match. */
function Tournament({ t }) {
  const tr = useT();
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const fix = (v) => (v == null ? "–" : Number(v).toFixed(2));
  return (
    <section>
      <h2>{tr("Tournament stats")}</h2>
      <div className="pstatbar">
        <div><b><RollNum text={fix(t.r)} /></b><span>{tr("Rating")}</span></div>
        <div><b><RollNum text={t.acs ?? "–"} /></b><span>ACS</span></div>
        <div><b><RollNum text={fix(t.kd)} /></b><span>K/D</span></div>
        <div><b><RollNum text={t.kast != null ? `${t.kast}%` : "–"} /></b><span>KAST</span></div>
        <div><b><RollNum text={t.adr ?? "–"} /></b><span>ADR</span></div>
        <div><b><RollNum text={t.hs != null ? `${t.hs}%` : "–"} /></b><span>HS%</span></div>
        <div><b><RollNum text={t.maps} /></b><span>{tr("Maps")}</span></div>
      </div>
      <Trend matches={t.matches} />
      <AgentMastery agents={t.agents} />
      <RatingByMap list={t.byMap} />
      <Radar a={t.radar} />
      <SimilarPlayers list={t.similar} />
      <Records rec={t.records} title={tr("Personal bests")} player />
      {t.agents.length > 0 && <p className="note agline">{tr("Agents")} : {t.agents.map((a) => <span key={a.name}><AgentIcon name={a.name} size={24} /> {a.n}</span>)}</p>}
      <div className="tablewrap">
        <table>
          <thead><tr><th>{tr("Match")}</th><th>{tr("Score")}</th><th>R</th><th>ACS</th><th>K/D/A</th><th>{tr("Agents")}</th></tr></thead>
          <tbody>
            {t.matches.map((m) => (
              <tr key={m.event + m.id} className={m.won ? "w" : "l"}>
                <td><a href={`/match/${m.event}/${m.id}`}>{tr("vs {team}", { team: m.opponent })}</a> <small className="muted">{m.round.map(([k, v]) => tr(k, v)).join(" · ")}</small></td>
                <td>{m.score[0] ?? "–"} – {m.score[1] ?? "–"}</td>
                <td>{fix(m.r)}</td><td><b>{m.acs ?? "–"}</b></td><td>{m.k}/{m.d}/{m.a}</td><td><AgentList list={m.agents} size={20} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="vlrcredit">{tr("Numbers from")} <a href="https://www.vlr.gg/" target="_blank" rel="noopener noreferrer">vlr.gg</a> · <a href="/stats">{tr("All the tournament's stats")}</a></p>
    </section>
  );
}

/** Years old on a birth date (YYYY-MM-DD), or null. */
function ageOf(born, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(born || "");
  if (!m) return null;
  let age = now.getFullYear() - Number(m[1]);
  if (now.getMonth() + 1 < Number(m[2]) || (now.getMonth() + 1 === Number(m[2]) && now.getDate() < Number(m[3]))) age -= 1;
  return age >= 10 && age < 80 ? age : null;
}

/** The top of the player sheet (preview "fiche"), as player pages on Liquipedia and vlr.gg: photo, names, country, team, role, key numbers. */
function FicheHead({ p, hero, team, links, ag }) {
  const tr = useT();
  const { lp } = p;
  const [broken, setBroken] = useState(false);
  const age = lp ? ageOf(lp.born) : null;
  const country = lp && lp.nationality[0] ? countryName(lp.nationality[0], tr.lang) : "";
  return (
    <div className={"fhead" + (ag ? " withagent" : "")} data-agent={ag ? ag.name : undefined}>
      <div className="fphotobox">
        {p.photo && !broken ? <img className="fphoto" src={p.photo} alt="" onError={() => setBroken(true)} /> : <span className="finit" aria-hidden="true">{p.name.charAt(0).toUpperCase()}</span>}
      </div>
      <div className="fid">
        <div className="fname"><span>{p.name}</span><FollowStar slug={p.slug || teamSlug(p.name)} />{p.captain && <span className="tcapt" title={tr("Captain")}>C</span>}</div>
        {(p.realName || (lp && lp.name)) && <div className="freal">{p.realName || lp.name}</div>}
        <div className="fmeta">
          {(p.cc || country) && <span className="fcountry"><Flag cc={p.cc} /> {country || String(p.cc).toUpperCase()}</span>}
          {p.team && <span className="fteam">{p.teamOnSite ? <Crest team={team} /> : <span className="thlogo"><LpImg f={p.teamLogo} /></span>}<a href={teamHref(p.team)}>{p.team}</a></span>}
          {p.role && <span className="rolebadge">{tr(p.role)}</span>}
          {age != null && <span>{tr("{n} years old", { n: age })}</span>}
        </div>
        {hero && <div className="fnums">{hero.nums.map(([label, value]) => <div key={label}><b>{value}</b><span>{label}</span></div>)}</div>}
        <div className="tlinks"><a href={`/compare?a=${encodeURIComponent(p.name)}`}>{tr("Compare")}</a>{links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer">{l.type} ↗</a>)}</div>
        <p className="hint followhint">{tr("Follow this player to be alerted when they become a free agent or sign with a team.")} <AlertsButton /></p>
      </div>
    </div>
  );
}

/** The identity card at the side of the player sheet (preview "fiche"), from Liquipedia: one line per thing known. */
function FicheBox({ p }) {
  const tr = useT();
  const { lp } = p;
  if (!lp) return null;
  const present = (s) => s.replace(/Present$/, tr("Present"));
  const age = ageOf(lp.born);
  const rows = [
    [tr("Name"), lp.name],
    [tr("Alternate names"), lp.altIds],
    [tr("Born"), lp.born ? `${dayText(lp.born, tr.lang)}${age != null ? ` (${tr("{n} years old", { n: age })})` : ""}` : ""],
    [tr("Nationality"), lp.nationality.map((n) => countryName(n, tr.lang)).join(", ")],
    [tr("Status"), lp.status ? tr(lp.status) : ""],
    [tr("Role"), lp.roles ? tr(lp.roles) : ""],
    [tr("Team"), p.team || lp.team],
    [tr("Years active"), lp.years ? present(lp.years) : ""],
    [tr("Approx. winnings"), lp.winnings ? moneyText(lp.winnings, tr.lang) : ""],
  ].filter(([, v]) => v);
  return (
    <div className="info fbox">
      <h3>{tr("Player information")}</h3>
      <dl>
        {rows.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}
        {(lp.signature || []).length > 0 && <><dt>{tr("Signature agents")}</dt><dd className="fsig">{lp.signature.map((a) => <span key={a} title={a}><AgentIcon name={a} size={22} /></span>)}</dd></>}
      </dl>
    </div>
  );
}

function View({ p, fiche = false }) {
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
  // the card's front: this season's numbers on the site, else vlr.gg's career ones
  const src = p.tour || null;
  const fix = (v, d = 0) => (v == null ? "–" : Number(v).toFixed(d));
  const hero = src ? {
    agent: src.agents && src.agents[0] ? src.agents[0].name.toUpperCase() : "",
    nums: [["Rating", fix(src.r, 2)], ["ACS", fix(src.acs)], ["K/D", fix(src.kd, 2)], [tr("Maps"), src.maps]],
  } : p.totals ? { agent: "", nums: [["ACS", p.totals.acs], ["K/D", p.totals.kd], ["Rating", p.totals.rating], [tr("Maps"), p.totals.maps]] } : null;
  // the main agent's portrait behind the card and its colour for the numbers
  const ag = hero && hero.agent ? agentInfo(hero.agent) : null;
  const [part, setPart] = useState("overview");
  const agentStyle = ag ? { "--agc": ag.color, ...(ag.portrait ? { "--agimg": `url(${ag.portrait})` } : {}) } : undefined;
  return (
    <div className={"wrap teampage playerpage" + (fiche ? " tabbed fiche" : "")} data-tab={fiche ? part : undefined} style={agentStyle}>
      <div className="topbar">
        <h1 className="brandh"><a className="homelink" href="/" title={tr("Home")}><EmeaMark /></a><span>{p.name}</span></h1>
        <SearchBar />
        <div className="prefs"><ThemeSwitch /><LangSwitch /></div>
      </div>
      <SiteNav />
      <nav className="crumbs" aria-label={tr("Breadcrumb")}><a href="/">{tr("Home")}</a> › {p.team ? <><a href={teamHref(p.team)}>{p.team}</a> › </> : null}<span>{p.name}</span></nav>
      {fiche && <FicheHead p={p} hero={hero} team={team} links={links} ag={ag} />}
      {fiche && <PartTabs value={part} onChange={setPart} label={tr("Player")} items={[["overview", tr("Overview")], ["stats", tr("Stats")], ["matches", tr("Matches")], ["history", tr("History")]]} />}
      {!fiche && <div className={"thead" + (hero ? " pcard" : "") + (ag ? " withagent" : "")} data-agent={hero ? (ag ? ag.name : hero.agent) : undefined}>
        {p.photo && <img className="pphoto phead" src={p.photo} alt="" loading="lazy" onError={(ev) => { ev.currentTarget.style.display = "none"; }} />}
        {p.team ? (p.teamOnSite ? <Crest team={team} /> : <span className="thlogo"><LpImg f={p.teamLogo} /></span>) : null}
        <div>
          <div className="tname"><span className="pt"><Flag cc={p.cc} /><span>{p.name}</span><FollowStar slug={p.slug || teamSlug(p.name)} />{p.captain && <span className="tcapt" title={tr("Captain")}>C</span>}</span></div>
          {about.length > 0 && <div className="tsub">{about.map((x, i) => <Fragment key={i}>{i ? " · " : ""}{x}</Fragment>)}</div>}
          <p className="hint followhint">{tr("Follow this player to be alerted when they become a free agent or sign with a team.")} <AlertsButton /></p>
          {p.tour && (p.tour.agents || []).length > 0 && <div className="pcardpool">{agentInfo(p.tour.agents[0].name) && agentInfo(p.tour.agents[0].name).role ? <span className="rolebadge">{tr(agentInfo(p.tour.agents[0].name).role)}</span> : null}<TopBadges list={topBadges(p.tour.radar)} />{p.tour.agents.slice(0, 3).map((a) => <AgentIcon key={a.name} name={a.name} size={28} link />)}<a className="bestmap dl" href={`/api/og/player/${p.slug}`} download={`${p.slug}-vct-emea.png`} title={tr("Download the card")}>⬇ {tr("Card")}</a>{bestMap(p.tour) && <a className="bestmap" href={`/map/${bestMap(p.tour).map.toLowerCase()}`}>🗺️ {bestMap(p.tour).map} · {bestMap(p.tour).r.toFixed(2)}</a>}</div>}
          {hero && (
            <div className="pcardnums">
              {hero.nums.map(([label, value]) => <div key={label}><b>{value}</b><span>{label}</span></div>)}
            </div>
          )}
          <div className="tlinks"><a href={`/compare?a=${encodeURIComponent(p.name)}`}>{tr("Compare")}</a>{links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer">{l.type} ↗</a>)}</div>
        </div>
      </div>}
      <div data-part="overview"><PlayerHero p={p} /></div>
      {(p.teamRows || []).length > 0 && <div data-part="overview"><NextMatchBanner rows={p.teamRows} name={p.team} live={p.teamLive || {}} /></div>}
      {p.tour && p.ranges && <div data-part="stats"><PlayerRadar stats={p.tour} ranges={p.ranges} /></div>}
      {p.lp && <div data-part="history"><CareerTimeline history={p.lp.history} /></div>}
      {p.lpState === "pending" && <p className="note lpwait" role="status">{tr("Looking for this information…")}</p>}
      {p.updating && <p className="note lpwait" role="status">{tr("Updating this information…")}</p>}
      {p.lpState === "none" && !p.onSite && !p.teamOnSite && !p.vlr && !p.updating && !p.lines.length && <p className="note">{tr("No information found for now.")}</p>}
      {p.totals && (
        <div className="pstatbar" data-part="overview">
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
          {p.tour && <div data-part="stats"><Tournament t={p.tour} /></div>}
          <div data-part="stats"><VlrStats vlr={p.vlr} /></div>
          {p.lines.length > 0 && (
            <section data-part="matches">
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
            <section data-part="matches">
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
          <div data-part="overview matches"><VlrResults vlr={p.vlr} /></div>
          {lp && lp.results.length > 0 && <div data-part="history"><Achievements list={lp.results} /></div>}
          <VlrCredit vlr={p.vlr} />
          {lp && (
            <p className="note">
              {tr("Player information from")} <a href={lp.url} target="_blank" rel="noopener noreferrer">Liquipedia</a> (CC-BY-SA), {tr("as of {date}", { date: lp.fetched.slice(0, 10) })}.
            </p>
          )}
        </main>
        {lp && (fiche ? <aside><FicheBox p={p} /><PlayerSide p={p} historyOnly /></aside> : <PlayerSide p={p} />)}
      </div>
    </div>
  );
}

export default function PlayerPage({ profile, lang, fiche = false }) {
  return <LangProvider lang={lang}><View p={profile} fiche={fiche} /></LangProvider>;
}
