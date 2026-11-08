"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import SiteNav from "./SiteNav.jsx";
import { ThemeSwitch } from "./theme.jsx";
import SearchBar from "./SearchBar.jsx";
import { EmeaMark } from "./Brand.jsx";
import { Crest } from "./Crest.jsx";
import TeamCard, { Flag } from "./TeamCard.jsx";
import { useAutoRefresh } from "./autoRefresh.js";
import { MatchStrip } from "./matchTime.jsx";
import { EVENT_NAMES, MatchModalProvider } from "./MatchModal.jsx";
import { useOpenMatch } from "./openMatch.js";
import { useFavorites } from "./favorites.js";
import { byLeaveYear, mergeStints, teamProfile } from "../lib/teams.js";
import { scoreLabel } from "../lib/scoretext.js";
import { dayText, moneyText } from "../lib/format.js";
import { playerHref } from "../lib/playerstats.js";
import LpImg from "./LpImg.jsx";
import { VlrCredit, VlrResults } from "./VlrBlocks.jsx";
import { AlertsButton } from "./MatchAlerts.jsx";
import { TeamMaps } from "./EventStats.jsx";
import { siteHref, teamHref, teamSlug } from "../lib/paths.js";
import { formatMatchTime } from "../lib/schedule.js";
import { TeamThemeButton, useTeamColor } from "./visual.jsx";

export default function TeamPage(props) {
  return (
    <LangProvider lang={props.lang}>
      {props.outside ? <OutsideTeam {...props} /> : <TeamView {...props} />}
    </LangProvider>
  );
}

function When({ iso }) {
  const tr = useT();
  const [text, setText] = useState("");
  useEffect(() => setText(iso ? formatMatchTime(iso, tr.lang, true) : ""), [iso, tr.lang]);
  return <>{text || "–"}</>;
}

/** Every match of the team, the latest first; each row opens the match's details. */
function MatchTable({ rows, slug }) {
  const tr = useT();
  const open = useOpenMatch();
  if (!rows.length) return <p className="note">{tr("No match yet.")}</p>;
  return (
    <div className="tablewrap">
      <table className="tmatches">
        <thead>
          <tr><th>{tr("Date")}</th><th>{tr("Event")}</th><th>{tr("Round")}</th><th>{tr("Score")}</th><th>{tr("Opponent")}</th></tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            const side = m.a && m.a.name && teamSlug(m.a.name) === slug ? "a" : "b";
            const opp = side === "a" ? m.b : m.a;
            const done = m.sa != null && m.sb != null;
            const [f, g] = side === "a" ? [m.sa, m.sb] : [m.sb, m.sa];
            const res = !done ? "" : m.win === side ? " w" : " l";
            return (
              <tr key={m.event + m.id} className={"mclick" + res} role="button" tabIndex={0} onClick={() => open(m.event, m.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(m.event, m.id); } }}>
                <td className="nowrap"><When iso={m.at} /></td>
                <td>{tr(EVENT_NAMES[m.event])}</td>
                <td>{m.round.map(([k, v]) => tr(k, v)).join(" · ")} <span className="bobadge">Bo{m.bo}</span></td>
                <td className="tscore">{done ? scoreLabel({ sa: f, sb: g, note: m.note && m.note.kind === "raw" && side === "b" ? { kind: "raw", a: m.note.b, b: m.note.a } : m.note }, tr) : m.live ? tr("LIVE") : "vs"}</td>
                <td>
                  <span className="topp">
                    <Crest team={opp} />
                    {opp && opp.name ? <a href={teamHref(opp.name)} onClick={(e) => e.stopPropagation()}>{opp.name}</a> : <span className="tbdn">{tr("TBD")}</span>}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const https = (url) => /^https?:\/\//i.test(url || ""); // links come from another site: only web addresses are shown

/** Subscribes the visitor's calendar to this team's matches. */
function TeamCalendar({ slug }) {
  const tr = useT();
  const [host, setHost] = useState("");
  useEffect(() => setHost(window.location.host), []);
  const feed = `/api/calendar?team=${slug}`;
  return <a className="btn" href={host ? `webcal://${host}${feed}` : feed} title={tr("Team calendar")}>📅 {tr("Team calendar")}</a>;
}

/** Adds or removes the team from the visitor's favorites. */
function FavStar({ slug }) {
  const tr = useT();
  const fav = useFavorites();
  const on = fav.has(slug);
  return <button type="button" className={"favstar" + (on ? " on" : "")} aria-pressed={on} title={on ? tr("Remove from my teams") : tr("Add to my teams")} aria-label={on ? tr("Remove from my teams") : tr("Add to my teams")} onClick={() => fav.toggle(slug)}>{on ? "★" : "☆"}</button>;
}

const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www./, ""); } catch { return url; } };

/** The team's own accounts; statistics sites are left out, this page takes their place. */
function TeamLinks({ lp }) {
  const links = lp ? lp.links.filter((l) => https(l.url) && l.type !== "VLR") : [];
  if (!links.length) return null;
  return <div className="tlinks">{links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer">{l.type === "Website" ? hostOf(l.url) : l.type}</a>)}</div>;
}

/** Players or staff from Liquipedia: flag, ID (linked to its page here), real name, role, join date. */
function People({ list, role = false }) {
  const tr = useT();
  return (
    <div className="tablewrap">
      <table className="tpeople">
        <thead><tr><th>{tr(role ? "Member" : "Player")}</th><th>{tr("Name")}</th>{role && <th>{tr("Role")}</th>}<th>{tr("Joined")}</th></tr></thead>
        <tbody>
          {list.map((p) => (
            <tr key={p.id}>
              <td className="nowrap">
                <span className="pt">
                  <Flag cc={p.cc} />
                  <a href={playerHref(p.id)}>{p.id}</a>
                  {p.captain && <span className="tcapt" title={tr("Captain")}>C</span>}
                </span>
              </td>
              <td>{p.name || "–"}</td>
              {role && <td>{p.role ? tr(p.role) : "–"}</td>}
              <td className="nowrap">{p.join ? dayText(p.join, tr.lang) : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The roster and the staff, side by side when there is room. */
function LpPeople({ lp }) {
  const tr = useT();
  return (
    <div className="tgrid">
      {lp && lp.roster.length > 0 && (
        <section>
          <h2>{tr("Current roster")}</h2>
          <People list={lp.roster} />
        </section>
      )}
      {lp && lp.staff.length > 0 && (
        <section>
          <h2>{tr("Organization")}</h2>
          <People list={lp.staff} role />
        </section>
      )}
    </div>
  );
}

/** People who are no longer active: when they were there, their role and where they went. A long list starts closed. */
function PastPeople({ title, list: raw, inactive = false, staff = false }) {
  const tr = useT();
  const list = mergeStints(raw);
  if (!list.length) return null;
  const showRole = list.some((p) => p.role);
  const showNew = list.some((p) => p.newTeam);
  const table = (
    <div className="tablewrap">
      <table className="tpeople">
        <thead><tr><th>{tr(staff ? "Member" : "Player")}</th><th>{tr("Name")}</th>{showRole && <th>{tr("Role")}</th>}<th>{tr("Joined")}</th><th>{tr(inactive ? "Inactive since" : "Left")}</th>{showNew && <th>{tr("New team")}</th>}</tr></thead>
        <tbody>
          {byLeaveYear(list).map(({ year, people }) => (
            <Fragment key={year}>
              <tr className="tyear"><th colSpan={4 + (showRole ? 1 : 0) + (showNew ? 1 : 0)} scope="colgroup">{year || tr("Date unknown")}</th></tr>
              {people.map((p, i) => (
                <tr key={`${p.id}-${i}`}>
                  <td className="nowrap"><span className="pt"><Flag cc={p.cc} /><a href={playerHref(p.id)}>{p.id}</a></span></td>
                  <td>{p.name || "–"}</td>
                  {showRole && <td>{p.role ? tr(p.role) : "–"}</td>}
                  <td className="nowrap">{p.join ? dayText(p.join, tr.lang) : "–"}</td>
                  <td className="nowrap">{p.leave ? dayText(p.leave, tr.lang) : "–"}</td>
                  {showNew && <td>{p.newTeamHref ? <a href={p.newTeamHref}>{p.newTeam}</a> : p.newTeam ? tr(p.newTeam) : "–"}</td>}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <section>
      <h2>{tr(title)} <span className="tcount">{list.length}</span></h2>
      {list.length <= 12 ? table : <details className="tfold"><summary>{tr("Show the list")}</summary>{table}</details>}
    </section>
  );
}

/** Everyone who has left the team, and who is inactive. */
function LpPast({ lp }) {
  if (!lp) return null;
  return (
    <>
      <PastPeople title="Inactive players" list={lp.inactivePlayers} inactive />
      <PastPeople title="Former players" list={lp.formerPlayers} />
      <PastPeople title="Former coaches and staff" list={lp.formerStaff} staff />
    </>
  );
}

/** The results Liquipedia lists for the team, then where they come from. */
function LpAchievements({ lp }) {
  const tr = useT();
  if (!lp) return null;
  return (
    <>
      {lp.results.length > 0 && (
        <section>
          <h2>{tr("Achievements")}</h2>
          <div className="tablewrap">
            <table className="cards">
              <thead><tr><th>{tr("Date")}</th><th>{tr("Place")}</th><th>{tr("Tier")}</th><th>{tr("Tournament")}</th><th>{tr("Last match")}</th><th>{tr("Prize")}</th></tr></thead>
              <tbody>
                {lp.results.map((r, i) => (
                  <tr key={i}>
                    <td className="nowrap" data-label={tr("Date")}>{dayText(r.date, tr.lang)}</td>
                    <td className="nowrap" data-label={tr("Place")}><b>{r.place}</b></td>
                    <td className="nowrap" data-label={tr("Tier")}>{r.tier}</td>
                    <td data-label={tr("Tournament")}>
                      <span className="tach">
                        <LpImg f={r.tournamentLogo} dark={r.tournamentLogoDark} />
                        {r.tournamentHref ? <a href={r.tournamentHref}>{r.tournament}</a> : r.tournament}
                      </span>
                    </td>
                    <td className="nowrap" data-label={tr("Last match")}>
                      <span className="tach">
                        <span className="tachs">{r.score}</span>
                        {r.opponentLogo && <LpImg f={r.opponentLogo} dark={r.opponentLogoDark} />}
                        {r.opponent && (r.opponentHref ? <a href={r.opponentHref} title={r.opponentName}>{r.opponent}</a> : <span title={r.opponentName}>{r.opponent}</span>)}
                      </span>
                    </td>
                    <td className="nowrap" data-label={tr("Prize")}>{moneyText(r.prize, tr.lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <p className="note">
        {tr("Team information from")} <a href={lp.url} target="_blank" rel="noopener noreferrer">Liquipedia</a> (CC-BY-SA), {tr("as of {date}", { date: lp.fetched.slice(0, 10) })}.
      </p>
    </>
  );
}

/** The team's facts from Liquipedia. */
function LpFacts({ lp }) {
  const tr = useT();
  if (!lp) return null;
  return (
    <div className="info tinfo">
      <h3>{tr("Team information")}</h3>
      <dl>
        {lp.location.length > 0 && <><dt>{tr("Location:")}</dt><dd>{lp.location.join(", ")}</dd></>}
        {lp.region && <><dt>{tr("Region:")}</dt><dd>{lp.region}</dd></>}
        {lp.coach && <><dt>{tr("Coach:")}</dt><dd>{lp.coach}</dd></>}
        {lp.igl && <><dt>{tr("In-game leader:")}</dt><dd>{lp.igl}</dd></>}
        {lp.manager && <><dt>{tr("Manager:")}</dt><dd>{lp.manager}</dd></>}
        {lp.winnings && <><dt>{tr("Winnings:")}</dt><dd>{moneyText(lp.winnings, tr.lang)}</dd></>}
        {lp.created[0] && <><dt>{tr("Created:")}</dt><dd>{dayText(lp.created[0], tr.lang)}</dd></>}
        {lp.created[1] && <><dt>{tr("On VALORANT:")}</dt><dd>{dayText(lp.created[1], tr.lang)}</dd></>}
      </dl>
    </div>
  );
}

/** Other teams of the organization. */
function OrgNav({ org }) {
  const tr = useT();
  if (!org.length) return null;
  return (
    <nav className="torg" aria-label={tr("Same organization")}>
      <span className="torgl">{tr("Same organization")}</span>
      {org.map((o) => (
        <a key={o.page} href={o.href}>
          <LpImg f={o.logo} dark={o.logoDark} />
          {o.name}
        </a>
      ))}
    </nav>
  );
}

/** A team that does not play on this site: what Liquipedia says about it. */
function OutsideTeam({ lp, org = [], outside, vlr, updating }) {
  const tr = useT();
  useAutoRefresh();
  return (
    <div className="wrap teampage">
      <div className="topbar">
        <h1 className="brandh"><a className="homelink" href="/" title={tr("Home")}><EmeaMark /></a><span>{outside.name}</span></h1>
        <SearchBar /><div className="prefs"><ThemeSwitch /><LangSwitch /></div>
      </div>
      <SiteNav />
      <nav className="crumbs" aria-label={tr("Breadcrumb")}><a href="/">{tr("Home")}</a> › <span>{tr("Teams")}</span> › <span>{outside.name}</span></nav>
      <div className="thead">
        {outside.logo && <span className="thlogo"><LpImg f={outside.logo} /></span>}
        <div>
          <div className="tname">{outside.name}{outside.tag ? <span className="ttag">{outside.tag}</span> : null}</div>
          <TeamLinks lp={lp} />
        </div>
      </div>
      <OrgNav org={org} />
      {outside.pending && <p className="note lpwait" role="status">{tr("Looking for this information…")}</p>}
      {updating && <p className="note lpwait" role="status">{tr("Updating this information…")}</p>}
      {!outside.pending && !lp && !vlr && !updating && <p className="note">{tr("No information found for now.")}</p>}
      {(lp || vlr) && (
        <div className={lp ? "cols" : undefined}>
          <main>
            <LpPeople lp={lp} />
            <LpPast lp={lp} />
            <VlrResults vlr={vlr} />
            <LpAchievements lp={lp} />
            <VlrCredit vlr={vlr} />
          </main>
          {lp && <aside><LpFacts lp={lp} /></aside>}
        </div>
      )}
    </div>
  );
}

/** The team's numbers in the tournaments, from vlr.gg's tables. */
/** The team's header: a banner in the color of its logo, the logo over it, its key numbers and recent form. */
function TeamHead({ team, children, stats = [], form = [] }) {
  const tr = useT();
  const color = useTeamColor(team && team.logo);
  return (
    <div className={"thead teamhero" + (color ? " tinted" : "")} style={color ? { "--team": color } : undefined}>
      <div className="thband" aria-hidden="true" />
      <div className="thbody">
        {children}
        {(stats.length > 0 || form.length > 0) && (
          <div className="thnums">
            {stats.map(([label, value]) => <div key={label}><b>{value}</b><span>{label}</span></div>)}
            {form.length > 0 && (
              <div><span className="thform">{form.map((f, i) => <i key={i} className={f.won ? "w" : "l"} title={f.label}>{f.won ? tr("W") : tr("L")}</i>)}</span><span>{tr("Form")}</span></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TeamTournament({ s }) {
  const tr = useT();
  const pct = s.maps ? Math.round((s.mapsWon / s.maps) * 100) : 0;
  const diff = s.roundsW - s.roundsL;
  return (
    <section>
      <h2>{tr("Tournament stats")}</h2>
      <div className="pstatbar">
        <div><b>{s.mapsWon} – {s.maps - s.mapsWon}</b><span>{tr("Maps")}</span></div>
        <div><b>{pct}%</b><span>{tr("Maps won")}</span></div>
        <div><b>{s.roundsW} – {s.roundsL}</b><span>{tr("Rounds")}</span></div>
        <div><b>{diff > 0 ? `+${diff}` : diff}</b><span>+/–</span></div>
      </div>
      <div className="tablewrap">
        <table>
          <thead><tr><th>{tr("Map")}</th><th>{tr("Played")}</th><th>{tr("Won")}</th><th>%</th></tr></thead>
          <tbody>{s.byMap.map((m) => <tr key={m.map}><td>{m.map}</td><td>{m.played}</td><td>{m.won}</td><td>{Math.round((m.won / m.played) * 100)}%</td></tr>)}</tbody>
        </table>
      </div>
      {(s.comps || []).length > 0 && (
        <>
          <h3>{tr("Compositions by map")}</h3>
          <div className="tablewrap">
            <table>
              <thead><tr><th>{tr("Map")}</th><th>{tr("Agents")}</th><th>{tr("Played")}</th><th>{tr("Won")}</th></tr></thead>
              <tbody>{s.comps.map((c, i) => <tr key={i}><td>{c.map}</td><td>{c.agents.map((a) => a.charAt(0).toUpperCase() + a.slice(1)).join(", ")}</td><td>{c.played}</td><td>{c.won}</td></tr>)}</tbody>
            </table>
          </div>
        </>
      )}
      {s.best.length > 0 && (
        <p className="note">{tr("Best players")} : {s.best.map((p, i) => <span key={p.slug}>{i ? " · " : ""}<a href={`/player/${p.slug}`}>{p.name}</a> ({tr("rating")} {Number(p.r).toFixed(2)}, ACS {p.acs})</span>)}</p>
      )}
      <p className="vlrcredit">{tr("Numbers from")} <a href="https://www.vlr.gg/" target="_blank" rel="noopener noreferrer">vlr.gg</a> · <a href="/stats">{tr("All the tournament's stats")}</a></p>
    </section>
  );
}

function TeamView({ initial, slug, lp, org = [], vlr, updating, tstats = null }) {
  const tr = useT();
  useAutoRefresh();
  const p = useMemo(() => teamProfile(initial, slug), [initial, slug]);
  if (!p) return null;
  const t = p.team;
  const per = (o, e) => (o && o[e]) || {};
  // the strips and the match popup see only this team's matches
  const events = p.events.map((e) => ({
    event: e.event, href: siteHref(e.event), items: e.matches,
    times: per(initial.times, e.event), live: per(initial.live, e.event), extra: per(initial.extra, e.event),
    stream: (initial.info && initial.info[e.event] && initial.info[e.event].stream) || "",
  }));
  const rows = events.flatMap((e) => e.items.map((m) => ({ ...m, event: e.event, at: e.times[m.id] || "", live: !!e.live[m.id] && m.sa == null })))
    .filter((m) => m.at || (m.sa != null && m.sb != null))
    .sort((x, y) => (y.at || "").localeCompare(x.at || ""));
  // the header's numbers and the last five results, oldest first
  const mine = (m) => (m.a && m.a.name === t.name ? "a" : "b");
  const form = rows.filter((m) => m.win).slice(0, 5).reverse().map((m) => ({ won: m.win === mine(m), label: `${m.a ? m.a.name : "?"} ${m.sa}–${m.sb} ${m.b ? m.b.name : "?"}` }));
  const headStats = [
    [tr("Wins"), `${rows.filter((m) => m.win && m.win === mine(m)).length}–${rows.filter((m) => m.win && m.win !== mine(m)).length}`],
    ...(tstats ? [[tr("Maps"), `${tstats.mapsWon}–${tstats.maps - tstats.mapsWon}`], ...(tstats.best[0] ? [[tr("Best player"), tstats.best[0].name]] : [])] : []),
  ];
  const tot = p.events.reduce((o, e) => ({ w: o.w + e.w, l: o.l + e.l }), { w: 0, l: 0 });
  return (
    <div className="wrap teampage">
      <div className="topbar">
        <h1 className="brandh"><a className="homelink" href="/" title={tr("Home")}><EmeaMark /></a><span>{p.name}</span></h1>
        <SearchBar /><div className="prefs"><ThemeSwitch /><LangSwitch /></div>
      </div>
      <SiteNav />
      <nav className="crumbs" aria-label={tr("Breadcrumb")}><a href="/">{tr("Home")}</a> › <span>{tr("Teams")}</span> › <span>{p.name}</span></nav>
      {p.events.some((e) => e.matches.length) && (
        <p className="pathlinks">{tr("Run")} : {p.events.filter((e) => e.matches.length).map((e, n) => <span key={e.event}>{n ? " · " : ""}<a href={`/parcours/${e.event}/${slug}`}>{tr(EVENT_NAMES[e.event])}</a></span>)}</p>
      )}

      <TeamHead team={t} stats={headStats} form={form}>
        <Crest team={t} />
        <div>
          <div className="tname">{p.name}{t.tag ? <span className="ttag">{t.tag}</span> : null}<FavStar slug={slug} /></div>
          <div className="tsub">{tr("{w} wins, {l} losses", tot)} · {tr("{n} events", { n: p.events.length })}</div>
          <TeamLinks lp={lp} />
          <p><AlertsButton /> <TeamCalendar slug={slug} /> <TeamThemeButton team={t} /></p>
        </div>
      </TeamHead>

      <OrgNav org={org} />
      {updating && <p className="note lpwait" role="status">{tr("Updating this information…")}</p>}

      <MatchModalProvider state={initial} events={events}>
        <div className="cols">
          <main>
            <MatchStrip events={events} Crest={Crest} />
            <MatchStrip events={events} Crest={Crest} recent />
            <LpPeople lp={lp} />
            <section>
              <h2>{tr("Matches")}</h2>
              <MatchTable rows={rows} slug={slug} />
            </section>
            {tstats ? <TeamTournament s={tstats} /> : <TeamMaps state={initial} team={slug} />}
            <section>
              <h2>{tr("Season")}</h2>
              <div className="tablewrap">
                <table>
                  <thead><tr><th>{tr("Event")}</th><th>{tr("Entry")}</th><th>{tr("Matches")}</th><th>{tr("Maps")}</th></tr></thead>
                  <tbody>
                    {p.events.map((e) => (
                      <tr key={e.event}>
                        <td><a href={siteHref(e.event)}>{tr(EVENT_NAMES[e.event])}</a></td>
                        <td>{e.team.status === "invited" ? tr("Invited") : e.team.status === "qualified" || e.team.source ? tr("Qualified") : "–"}</td>
                        <td>{e.w + e.l ? `${e.w} – ${e.l}` : "–"}</td>
                        <td>{e.mw + e.ml ? `${e.mw} – ${e.ml}` : "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <LpPast lp={lp} />
            <VlrResults vlr={vlr} />
            <LpAchievements lp={lp} />
            <VlrCredit vlr={vlr} />
          </main>
          <aside>
            <LpFacts lp={lp} />
            {/* the roster typed for this site's events; without one, the Liquipedia roster above says it all */}
            {(t.roster || t.staff || !lp) && (
              <div className="teams hover">
                <TeamCard team={t} />
              </div>
            )}
          </aside>
        </div>
      </MatchModalProvider>
    </div>
  );
}
