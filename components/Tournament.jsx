"use client";

import { useEffect, useMemo, useState } from "react";
import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import SiteNav from "./SiteNav.jsx";
import { ThemeSwitch } from "./theme.jsx";
import SearchBar from "./SearchBar.jsx";
import { EmeaMark } from "./Brand.jsx";
import { useAutoRefresh } from "./autoRefresh.js";
import Qualifier from "./Qualifier.jsx";
import { Crest } from "./Crest.jsx";
import Kickoff from "./Kickoff.jsx";
import Regional from "./Regional.jsx";
import TeamCard, { Flag } from "./TeamCard.jsx";
import {
  prizePool,
  rankTeams,
  records,
  result,
  standing,
  swissGroups,
} from "../lib/tournament.js";
import { EVENT_NAMES, parseSitePath, siteHref } from "../lib/paths.js";
import { eventStatus, formatDate, formatDates } from "../lib/status.js";
import { TYPE_LABEL } from "../lib/einfo.js";
import { MatchStrip, MatchTimes, Schedule, When, useLiveScore } from "./matchTime.jsx";
import { eventData, matchesOf } from "../lib/matchlist.js";
import EventStats from "./EventStats.jsx";
import { knownPlayer } from "../lib/playerstats.js";
import { MatchModalProvider } from "./MatchModal.jsx";
import { BracketTools } from "./Round8Bits.jsx";
import { EventHero } from "./Round9.jsx";
import { eventTeamsOf } from "../lib/teams.js";
import { eventNumbers, qualifiedTeams } from "../lib/r9pure.js";
import { EventFeed } from "./Round11.jsx";
import { eventFeed } from "../lib/round11.js";

// Türkiye stages, like the EU ones: the Qualifier Playoffs (event "tr") and the two open qualifiers before it
const TR_STAGES = [
  ["tr", "Qualifier Playoffs"],
  ["trq1", "Qualifier 1"],
  ["trq2", "Qualifier 2"],
];

// MENA stages: its Qualifier Playoffs (event "mena") and the four open qualifiers whose winners play it
const MENA_STAGES = [
  ["mena", "Qualifier Playoffs"],
  ["meq1", "ME Qualifier 1"],
  ["meq2", "ME Qualifier 2"],
  ["naq1", "NA Qualifier 1"],
  ["naq2", "NA Qualifier 2"],
];
const isMenaStage = (e) => MENA_STAGES.some(([k]) => k === e);

const TR_SECTIONS = [
  ["overview", "Overview"],
  ["stats", "Statistics"],
];

const SECTIONS = [
  ["overview", "Overview"],
  ["swiss", "Swiss Stage"],
  ["bracket", "Bracket"],
  ["stats", "Statistics"],
];


const TAB_NAMES = { swiss: "Swiss Stage", bracket: "Bracket", stats: "Statistics" };
const pageTitle = (event, tab, tr) => `${tr(EVENT_NAMES[event] || "")}${TAB_NAMES[tab] ? ` · ${tr(TAB_NAMES[tab])}` : ""} · VCT EMEA`;

/** Time left before the event shown starts (its start date from the editor); nothing when the date is not known. */
function Countdown({ start, state }) {
  const tr = useT();
  const [text, setText] = useState("");
  useEffect(() => {
    const tick = () => {
      if (state === "done") return setText(tr("Finished"));
      if (!start) return setText("");
      const [y, m, d] = start.split("-").map(Number);
      const diff = new Date(y, m - 1, d || 1, 0, 0, 0).getTime() - Date.now();
      if (diff <= 0) return setText(tr("Under way"));
      if (!d) return setText(tr("Starts in {when}", { when: formatDate(start, tr.lang) }));
      setText(tr("Starts in {d} d {h} h", { d: Math.floor(diff / 864e5), h: Math.floor((diff % 864e5) / 36e5) }));
    };
    tick();
    const t = setInterval(tick, 60000);
    return () => clearInterval(t);
  }, [tr, start, state]);
  return <span className="countdown">{text}</span>;
}

function PrizeName({ id, name, team }) {
  return (
    <div className={"tbd prize" + (id ? " set" : "")}>
      <Crest team={id ? team : null} />
      {name(id)}
    </div>
  );
}

function MatchRow({ m, label, name }) {
  const res = result(m);
  const ls = useLiveScore(m.id, !!res); // maps won so far while the match is being played
  const wa = res && res.winner === m.a;
  const wb = res && res.winner === m.b;
  return (
    <div className="mrow">
      <div className="mmeta">
        {label} · Bo{m.bo || 3} <When id={m.id} inline done={!!res} />
      </div>
      <div className="mline">
        <span className={"tn" + (wa ? " w" : res ? " lo" : "")}>{name(m.a)}</span>
        <span className={"sc" + (res || ls ? "" : " vs") + (ls ? " lv" : "")}>{res ? `${m.sa} – ${m.sb}` : ls ? `${ls.a} – ${ls.b}` : "vs"}</span>
        <span className={"tn r" + (wb ? " w" : res ? " lo" : "")}>{name(m.b)}</span>
      </div>
    </div>
  );
}

/** One compact line of the Swiss "Detailed Results" boxes. `m` is null for a slot not played or drawn yet. */
function SeriesRow({ m, byId, name }) {
  if (!m) {
    return (
      <div className="sitem">
        <div className="srow">
          <span className="stn l tbdn">TBD</span>
          <Crest team={null} />
          <span className="ssc">–</span>
          <span className="ssc">–</span>
          <Crest team={null} />
          <span className="stn tbdn">TBD</span>
        </div>
      </div>
    );
  }
  const res = result(m);
  const cls = (id) => (res ? (res.winner === id ? " w" : " lo") : "") + (id ? "" : " tbdn");
  return (
    <div className="sitem">
      <div className="srow">
        <span className={"stn l" + cls(m.a)}>{name(m.a)}</span>
        <Crest team={byId[m.a]} />
        <span className="ssc">{res ? m.sa : "–"}</span>
        <span className="ssc">{res ? m.sb : "–"}</span>
        <Crest team={byId[m.b]} />
        <span className={"stn" + cls(m.b)}>{name(m.b)}</span>
      </div>
    </div>
  );
}

/** Swiss table: record, maps, and one cell per round with score and opponent. Bar colour: top 2, advancing zone, out. */
function SwissMatrix({ ranked, rec, swiss, byId }) {
  const tr = useT();
  return (
    <div className="tablewrap wide">
      <table className="rtbl">
        <thead>
          <tr>
            <th>#</th>
            <th>{tr("Participant")}</th>
            <th className="num">{tr("Match")}</th>
            <th className="num">{tr("Game")}</th>
            {[1, 2, 3, 4, 5].map((n) => <th key={n} className="num">{tr("Round {n}", { n })}</th>)}
          </tr>
        </thead>
        <tbody>
          {ranked.map((t, i) => {
            const R = rec[t.id];
            const zone = i < 2 ? "z1" : i < 8 ? "z2" : "z3";
            return (
              <tr key={t.id} className={zone + (standing(rec, t.id) === "out" ? " out" : "")}>
                <td className="rk"><span className="place">{i + 1}</span></td>
                <td><span className="pt"><Crest team={t} /><span>{t.name || "TBD"}</span></span></td>
                <td className="num"><b>{R.w} - {R.l}</b></td>
                <td className="num"><b>{R.mw} - {R.ml}</b></td>
                {[1, 2, 3, 4, 5].map((n) => {
                  const m = swiss.find((x) => x.round === n && (x.a === t.id || x.b === t.id));
                  if (!m) return <td key={n} className="rc" />;
                  const home = m.a === t.id;
                  const opp = byId[home ? m.b : m.a];
                  const tag = (opp && (opp.tag || opp.name)) || "TBD";
                  const res = result(m);
                  if (!res) return <td key={n} className="rc rp">{tr("vs")} {tag}</td>;
                  return (
                    <td key={n} className={"rc " + (res.winner === t.id ? "rw" : "rl")}>
                      <b>{home ? `${m.sa}-${m.sb}` : `${m.sb}-${m.sa}`}</b> {tag}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {ranked.length === 0 && (
            <tr><td colSpan={9} className="rc">{tr("No teams yet.")}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function BracketBox({ m, name }) {
  const res = m && result(m);
  const line = (id, score) => (
    <div className={"bl" + (res ? (res.winner === id ? " bw" : " lo") : "")}>
      <span className={"tn" + (id ? "" : " tbdn")}>{name(id)}</span>
      <span className="bs">{res && score != null ? score : ""}</span>
    </div>
  );
  return (
    <div className="bbox">
      {line(m && m.a, m && m.sa)}
      {line(m && m.b, m && m.sb)}
    </div>
  );
}

function BracketGroup({ g, byMatch, name }) {
  const tr = useT();
  const s1 = byMatch["e" + g + "-s1"];
  const s2 = byMatch["e" + g + "-s2"];
  const f = byMatch["e" + g + "-f"];
  const rf = f && result(f);
  return (
    <>
      <h3 className="sub">{tr("Group {g}", { g })}</h3>
      <div className="bwrap">
        <div className="bgrid">
          <div className="bh">{tr("Semifinals")}</div>
          <div />
          <div className="bh">{tr("Grand Final")}</div>
          <div />
          <div className="bh">{tr("Qualified to Kickoff")}</div>
          <div className="bsemi">
            <BracketBox m={s1} name={name} />
            <BracketBox m={s2} name={name} />
          </div>
          <svg className="bc" viewBox="0 0 28 128" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 28H14V64M0 100H14V64M14 64H28" />
          </svg>
          <div>
            <BracketBox m={f} name={name} />
          </div>
          <svg className="bc" viewBox="0 0 28 128" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 64H28" />
          </svg>
          <div>
            <div className="bbox bq">
              <div className={"bl" + (rf ? " bw" : "")}>
                <span className={"tn" + (rf ? "" : " tbdn")}>{rf ? name(rf.winner) : "TBD"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Tournament(props) {
  return (
    <LangProvider lang={props.lang}>
      <TournamentView {...props} />
    </LangProvider>
  );
}

function TournamentView({ initial, start, archive }) {
  const prefix = archive ? archive.prefix : ""; // an archived season lives under /archives/<season>
  const tr = useT();
  const L = (en, fr) => (tr.lang === "fr" ? fr : en);
  const { teams, matches, placements } = initial;

  const [tab, setTabState] = useState(start ? start.tab : "overview");
  const [event, setEvent] = useState(start ? start.event : "playoffs"); // playoffs | q1 | q2 | mena | tr | kickoff | gc (VCT Game Changers EMEA)
  const [lastEu, setLastEu] = useState(start && ["playoffs", "q1", "q2"].includes(start.event) ? start.event : "playoffs");
  const [lastVct, setLastVct] = useState(start && start.event !== "gc" ? start.event : "playoffs"); // where the "VCT EMEA" tab goes back to
  const [lastTr, setLastTr] = useState(start && TR_STAGES.some(([k]) => k === start.event) ? start.event : "tr"); // and the "Türkiye" one
  const [lastMena, setLastMena] = useState(start && isMenaStage(start.event) ? start.event : "mena"); // and the "MENA" one
  // Every tab has its own address (/playoffs/swiss, /kickoff...); the back button follows.
  const go = (ev, tb) => {
    setEvent(ev); setTabState(tb);
    if (ev === "playoffs" || ev === "q1" || ev === "q2") setLastEu(ev);
    if (TR_STAGES.some(([k]) => k === ev)) setLastTr(ev);
    if (isMenaStage(ev)) setLastMena(ev);
    if (ev !== "gc") setLastVct(ev);
    if (typeof window !== "undefined") {
      const href = prefix + siteHref(ev, tb);
      if (window.location.pathname !== href) window.history.pushState(null, "", href);
    }
  };
  const setTab = (tb) => go(event === "tr" || event === "mena" || event === "gc" ? event : "playoffs", tb); // the Playoffs sections, or a region's Overview / Statistics
  useEffect(() => {
    const onPop = () => {
      const st = parseSitePath(window.location.pathname.slice(prefix.length));
      if (!st) return;
      setEvent(st.event); setTabState(st.tab);
      if (st.event === "playoffs" || st.event === "q1" || st.event === "q2") setLastEu(st.event);
      if (TR_STAGES.some(([k]) => k === st.event)) setLastTr(st.event);
      if (isMenaStage(st.event)) setLastMena(st.event);
      if (st.event !== "gc") setLastVct(st.event);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [prefix]);
  const isKick = event === "kickoff";
  const isGc = event === "gc";
  const isTr = event === "tr";
  const isTrq = event === "trq1" || event === "trq2"; // Türkiye Qualifier 1 / 2
  const isMena = event === "mena"; // MENA Qualifier Playoffs
  const isMenaq = ["meq1", "meq2", "naq1", "naq2"].includes(event); // MENA open qualifiers (Middle East / North Africa 1 / 2)
  const isOther = isGc;
  const region = isTr || isTrq ? "tr" : isMena || isMenaq ? "mena" : isKick || isOther ? event : "eu";
  const qd = initial.qualifiers[event] && event !== "gc" ? initial.qualifiers[event] : null;
  const menaName = { meq1: "ME Qualifier 1", meq2: "ME Qualifier 2", naq1: "NA Qualifier 1", naq2: "NA Qualifier 2" }[event];
  const goTo = (e) => { go(e, "overview"); if (typeof window !== "undefined") window.scrollTo({ top: 0 }); };
  const evTitle = isGc ? "VCT Game Changers EMEA" : isKick ? "VCT 2027: EMEA Kickoff" : isMena ? "VCT EMEA Kickoff MENA Qualifier Playoffs" : isMenaq ? `VCT EMEA Kickoff MENA ${menaName}` : isTr ? "VCT EMEA Kickoff Türkiye Qualifier Playoffs" : isTrq ? `VCT EMEA Kickoff Türkiye ${event === "trq1" ? "Qualifier 1" : "Qualifier 2"}` : event === "playoffs" ? "VCT EMEA Kickoff Europe Qualifier Playoffs" : `VCT EMEA Kickoff Europe ${event === "q1" ? "Qualifier 1" : "Qualifier 2"}`;
  useEffect(() => { document.title = pageTitle(event, tab, tr); }, [event, tab, tr]);
  const [opts, setOpts] = useState({ rosters: true, compact: false, hover: true });
  const [more, setMore] = useState(false);
  const [hiddenBoxes, setHiddenBoxes] = useState({});

  const byId = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t])), [teams]);
  const byMatch = useMemo(() => Object.fromEntries(matches.map((m) => [m.id, m])), [matches]);
  const rec = useMemo(() => records(teams, matches), [teams, matches]);
  const ranked = useMemo(() => rankTeams(teams, rec), [teams, rec]);
  const swiss = matches.filter((m) => m.stage === "swiss");
  const elim = matches.filter((m) => m.stage === "elim");
  const name = (id) => (id && byId[id] && byId[id].name) || "TBD";

  // Keep the page current (also after edits made straight in the database), without disturbing someone typing.
  useAutoRefresh(30000, !archive);

  const named = teams.filter((t) => t.name).length;
  const status = useMemo(() => eventStatus(initial), [initial]);
  const st = status[event];
  const info = (initial.info && initial.info[event]) || {};
  const pool = prizePool(teams, matches, placements);

  const statusText = teams.length === 0 ? tr("No teams yet. An editor adds them in edit mode.") : "";

  /* ---------- sections ---------- */

  // Places 5-16 fill from the results; 17-23 are not decided by these playoffs and stay TBD.
  const prizeRows = [
    { place: "1-2", ids: pool.winners, cls: "p1", kick: true },
    { place: "3", ids: [pool.p3], cls: "p3" },
    { place: "4", ids: [pool.p4] },
    ...[0, 1, 2, 3].map((i) => ({ place: String(5 + i), ids: [pool.semiLosers[i] || ""] })),
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ place: String(9 + i), ids: [pool.out[i] || ""] })),
    { place: "17", ids: [""] },
    { place: "18", ids: [""] },
    { place: "19-20", ids: ["", ""] },
    { place: "21", ids: [""] },
    { place: "22-23", ids: ["", ""] },
  ];
  const shownRows = more ? prizeRows : prizeRows.slice(0, 3);

  const prizeSection = (
    <section>
      <h2>{tr("Prize Pool")}</h2>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>{tr("Place")}</th>
              <th>{tr("Participant")}</th>
              <th>{tr("Qualifies to")}</th>
            </tr>
          </thead>
          <tbody>
            {shownRows.map((r) => (
              <tr key={r.place} className={r.cls || ""}>
                <td><span className="place">{r.place}</span></td>
                <td>{r.ids.map((id, i) => <PrizeName key={i} id={id} name={name} team={byId[id]} />)}</td>
                <td>{r.kick ? <button type="button" className="kick linklike" onClick={() => goTo("kickoff")}>Kickoff</button> : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="more" aria-expanded={more} onClick={() => setMore(!more)}>
          {more ? tr("Hide places 5 to 23 ⌃") : tr("Show places 5 to 23 ⌄")}
        </button>
      </div>
      <p className="note">{tr("Places 1 to 16 fill in on their own as results are entered. Places 17 to 23 stay TBD here.")}</p>
    </section>
  );

  const teamsSection = (
    <section>
      <h2>{tr("Participants")}</h2>
      <div className="toggles">
        <label className="sw"><input type="checkbox" id="opt-rosters" checked={opts.rosters} onChange={(e) => setOpts({ ...opts, rosters: e.target.checked })} /> {tr("Show rosters")}</label>
        <label className="sw"><input type="checkbox" id="opt-compact" checked={opts.compact} onChange={(e) => setOpts({ ...opts, compact: e.target.checked })} /> {tr("Compact view")}</label>
        <label className="sw"><input type="checkbox" id="opt-hover" checked={opts.hover} onChange={(e) => setOpts({ ...opts, hover: e.target.checked })} /> {tr("Enable hover")}</label>
      </div>
      <div className={"teams" + (opts.compact ? " compact" : "") + (opts.hover ? " hover" : "")}>
        {teams.map((t) => {
          const r = rec[t.id];
          const st = standing(rec, t.id);
          const status = t.status === "invited" ? tr("Invited") : tr("Qualified");
          return (
            <TeamCard
              key={t.id}
              team={t}
              badge={r.n && opts.compact ? `${r.w}-${r.l}` : status}
              inv={t.status === "invited"}
              barText={t.source ? null : status}
              record={r.n > 0 ? `${r.w}-${r.l}` : ""}
              cls={st === "adv" ? " adv" : st === "out" ? " out" : ""}
              rosters={opts.rosters}
            />
          );
        })}
      </div>
    </section>
  );

  const swissFormat = L(
    <>
      <b>Swiss Stage:</b> November 25<sup>th</sup> – November 29<sup>th</sup>, 2026
      <ul>
        <li>16-team Swiss system format</li>
        <li>Invited teams face qualified teams in Round 1</li>
        <li>All matches are <abbr title="Best of 3 maps">Bo3</abbr></li>
        <li><span className="win">Teams that reach 3 wins</span> advance to the <i>Single Elimination</i></li>
        <li><span className="loss">Teams that reach 3 losses</span> are eliminated</li>
      </ul>
    </>,
    <>
      <b>Phase suisse :</b> du 25 au 29 novembre 2026
      <ul>
        <li>Système suisse à 16 équipes</li>
        <li>Les équipes invitées affrontent les équipes qualifiées au tour 1</li>
        <li>Tous les matchs sont en <abbr title="Au meilleur des 3 maps">Bo3</abbr></li>
        <li><span className="win">Les équipes qui atteignent 3 victoires</span> passent en <i>élimination directe</i></li>
        <li><span className="loss">Les équipes qui atteignent 3 défaites</span> sont éliminées</li>
      </ul>
    </>
  );
  const elimFormat = L(
    <>
      <b>Single Elimination:</b> <i>December 3<sup>rd</sup> – December 5<sup>th</sup>, 2026</i>
      <ul>
        <li>2 single-elimination bracket groups</li>
        <li>Teams with 3-0 records will face 3-2 teams in separate groups</li>
        <li>All matches <i>(excl. Finals)</i> are <abbr title="Best of 3 maps">Bo3</abbr></li>
        <li>Winners of each group qualify to VCT EMEA Kickoff</li>
        <li>Finals are <abbr title="Best of 5 maps">Bo5</abbr></li>
      </ul>
    </>,
    <>
      <b>Élimination directe :</b> <i>du 3 au 5 décembre 2026</i>
      <ul>
        <li>2 groupes à élimination directe</li>
        <li>Les équipes à 3-0 affrontent les équipes à 3-2, dans des groupes séparés</li>
        <li>Tous les matchs <i>(hors finales)</i> sont en <abbr title="Au meilleur des 3 maps">Bo3</abbr></li>
        <li>Le vainqueur de chaque groupe se qualifie pour le VCT EMEA Kickoff</li>
        <li>Les finales sont en <abbr title="Au meilleur des 5 maps">Bo5</abbr></li>
      </ul>
    </>
  );

  const resultsSection = (
    <section>
      <h2>{tr("Results")}</h2>
      <h3 className="sub">{tr("Swiss Stage")}</h3>
      <SwissMatrix ranked={ranked} rec={rec} swiss={swiss} byId={byId} />
      <p className="note">
        {tr("For detailed match results, open the")}{" "}
        <button className="linkbtn" onClick={() => setTab("swiss")}>{tr("Swiss Stage")}</button>{L(" tab.", ".")}
      </p>
      <h3 className="sub" style={{ marginTop: 24 }}>{tr("Single Elimination")}</h3>
      <BracketTools />
      <BracketGroup g="A" byMatch={byMatch} name={name} />
      <BracketGroup g="B" byMatch={byMatch} name={name} />
    </section>
  );

  const overview = (
    <div className="panel">
      <section>
        <h2>{tr("Format")}</h2>
        <ul className="fmt">
          <li>
            {swissFormat}
          </li>
          <li>
            {elimFormat}
          </li>
        </ul>
      </section>
      <Schedule Crest={Crest} items={matchesOf("playoffs", { teams, matches })} />
      {prizeSection}
      {teamsSection}
      {resultsSection}
    </div>
  );

  const layout = swissGroups(teams, matches);
  const boxKey = (round, g) => `${round}-${g.key}`;
  const allKeys = layout.flatMap((r) => r.groups.map((g) => boxKey(r.round, g)));
  const allHidden = allKeys.every((k) => hiddenBoxes[k]);
  const swissPanel = (
    <div className="panel">
      <p className="note" style={{ marginTop: 0 }}>
        {tr("This page is part of the")}{" "}
        <button className="linkbtn" onClick={() => setTab("overview")}>VCT EMEA Kickoff Europe Qualifier Playoffs</button>{" "}
        {L("article.", ".")}
      </p>

      <section>
        <h2>{tr("Format")}</h2>
        <ul className="fmt">
          <li>
            {swissFormat}
          </li>
        </ul>
      </section>

      <section>
        <h2>{tr("Results")}</h2>
        <h3 className="sub">{tr("Overview")}</h3>
        <SwissMatrix ranked={ranked} rec={rec} swiss={swiss} byId={byId} />
      </section>

      <section>
        <h2>{tr("Detailed Results")}</h2>
        <div className="toolbar">
          <button
            className="btn"
            onClick={() => setHiddenBoxes(allHidden ? {} : Object.fromEntries(allKeys.map((k) => [k, true])))}
          >
            {allHidden ? tr("Show all") : tr("Hide all")}
          </button>
        </div>
        {layout.map((r) => {
          const single = r.groups.length === 1;
          return (
            <div className="round" key={r.round}>
              <h3 className="sub">{single ? `${tr("Round {n}", { n: r.round })} (${r.groups[0].key})` : tr("Round {n}", { n: r.round })}</h3>
              <div className="sgroups">
                {r.groups.map((g) => {
                  const k = boxKey(r.round, g);
                  const rows = Array.from({ length: Math.max(g.size, g.matches.length) }, (_, i) => g.matches[i] || null);
                  return (
                    <div key={k}>
                      {!single && <h4 className="gname">{tr(g.name)} ({g.key})</h4>}
                      <div className="sbox">
                        <div className="sbox-h">
                          <span>{g.name ? tr("Round {n} {name} Matches", { n: r.round, name: tr(g.name) }) : tr("Round {n} Matches", { n: r.round })}</span>
                          <button
                            className="hidebtn"
                            aria-expanded={!hiddenBoxes[k]}
                            onClick={() => setHiddenBoxes({ ...hiddenBoxes, [k]: !hiddenBoxes[k] })}
                          >
                            {hiddenBoxes[k] ? tr("Show") : tr("Hide")}
                          </button>
                        </div>
                        {!hiddenBoxes[k] &&
                          rows.map((m, i) => (
                            <SeriesRow key={m ? m.id : `${k}-${i}`} m={m} byId={byId} name={name} />
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );

  const bracketPanel = (
    <div className="panel">
      <section>
        <h2>{tr("Single Elimination")} <small>{tr("Dec 3 – 5 · Bo3, finals Bo5")}</small></h2>
        {elim.length === 0 ? (
          <div className="empty">{tr("The bracket opens on December 3 once eight teams have three wins. Group winners qualify for Kickoff.")}</div>
        ) : (
          <div className="bgroups">
            {["A", "B"].map((g) => {
              const ms = elim.filter((m) => m.group === g);
              const semis = ms.filter((m) => m.round === "semi");
              const fin = ms.filter((m) => m.round === "final");
              return (
                <div key={g}>
                  <h3 className="sub">{tr("Group {g}", { g })}</h3>
                  <div style={{ display: "grid", gap: 8 }}>
                    {semis.map((m, i) => <MatchRow key={m.id} m={m} label={tr("Group {g} · Semifinal {n}", { g, n: i + 1 })} name={name} />)}
                    {fin.map((m) => <MatchRow key={m.id} m={m} label={tr("Group {g} · Final", { g })} name={name} />)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );

  const played = matches.filter((m) => result(m));
  const maps = played.reduce((x, m) => x + m.sa + m.sb, 0);
  const adv = teams.filter((t) => standing(rec, t.id) === "adv").length;
  const out = teams.filter((t) => standing(rec, t.id) === "out").length;
  const leaders = ranked.filter((t) => rec[t.id].n).slice(0, 5);
  const statsPanel = (
    <div className="panel">
      <section>
        <h2>{tr("Statistics")}</h2>
        <div className="stats">
          <div className="stat"><b>{named}/16</b><span>{tr("Teams confirmed")}</span></div>
          <div className="stat"><b>{played.length}</b><span>{tr("Matches played")}</span></div>
          <div className="stat"><b>{maps}</b><span>{tr("Maps played")}</span></div>
          <div className="stat"><b>{played.length ? (maps / played.length).toFixed(1) : "–"}</b><span>{tr("Maps per match")}</span></div>
          <div className="stat"><b>{adv}/8</b><span>{tr("Teams advanced")}</span></div>
          <div className="stat"><b>{out}/8</b><span>{tr("Teams eliminated")}</span></div>
        </div>
        {leaders.length > 0 ? (
          <>
            <h3 className="sub">{tr("Swiss leaders")}</h3>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr><th>{tr("Team")}</th><th className="num">{tr("W-L")}</th><th className="num">{tr("Map diff")}</th></tr>
                </thead>
                <tbody>
                  {leaders.map((t) => {
                    const r = rec[t.id];
                    const d = r.mw - r.ml;
                    return (
                      <tr key={t.id}>
                        <td>{t.name}</td>
                        <td className="num">{r.w}-{r.l}</td>
                        <td className="num">{d > 0 ? "+" : ""}{d}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="note">{tr("Match and map statistics appear once the Swiss Stage begins on November 25.")}</p>
        )}
      </section>
    </div>
  );

  return (
    <div className="wrap">
      <div className="topbar">
        <h1 className="brandh"><a className="homelink" href="/" title={tr("Home")}><EmeaMark /></a><span>{event === "playoffs" ? <>{evTitle}{tab === "swiss" ? tr(" - Swiss Stage") : ""}</> : evTitle}</span></h1>
        <SearchBar /><div className="prefs"><ThemeSwitch /><LangSwitch /></div>
      </div>
      <SiteNav />

      {archive && <div className="archbar"><b>{tr("Archive")} · {archive.name}</b><a href="/">{tr("Back to the current season")}</a></div>}
      {!isGc && (
        <div className="banner">
          <span><b>Champions Tour 2027</b> &nbsp;·&nbsp; Kickoff</span>
          <Countdown start={info.start} state={st.state} />
        </div>
      )}

      {/* One card for "where am I": circuit, then region, then stage (pills); the page's sections come below it. */}
      <nav className="evnav" aria-label={tr("Circuit")}>
        <div className="nav1" role="tablist" aria-label={tr("Circuit")}>
          <a className="navhome" href="/" title={tr("Home")} aria-label={tr("Home")}>
            <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5M5.5 9.5V20h5v-6h3v6h5V9.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /></svg>
          </a>
          <button role="tab" aria-selected={!isGc} onClick={() => goTo(lastVct)}>VCT EMEA</button>
          <button role="tab" aria-selected={isGc} onClick={() => goTo("gc")}>VCT GC EMEA</button>
        </div>
        {!isGc && (
          <div className="nav2" role="tablist" aria-label={tr("Region")}>
            {[["eu", "EU"], ["mena", "MENA"], ["tr", "Türkiye"], ["kickoff", "Kickoff"]].map(([k, label]) => (
              <button key={k} role="tab" aria-selected={region === k} onClick={() => goTo(k === "eu" ? lastEu : k === "tr" ? lastTr : k === "mena" ? lastMena : k)}>{label}</button>
            ))}
          </div>
        )}
        {(region === "eu" || region === "tr" || region === "mena") && (
          <div className="nav3" role="tablist" aria-label={tr("Stage")}>
            {(region === "tr" ? TR_STAGES : region === "mena" ? MENA_STAGES : [["playoffs", "Qualifier Playoffs"], ["q1", "Qualifier 1"], ["q2", "Qualifier 2"]]).map(([k, label]) => (
              <button key={k} role="tab" aria-selected={event === k} onClick={() => goTo(k)}>{label}</button>
            ))}
          </div>
        )}
        {/* where the event stands: state from the results, dates, teams */}
        <div className="navmeta">
          <span className={"evstate " + st.state}>{tr(st.state === "done" ? "Finished" : st.state === "live" ? "Live" : "Upcoming")}</span>
          <span>{formatDates(info, tr.lang) || tr("Dates to be announced")}</span>
          {info.location && <span className="dot">{info.location}</span>}
          <span className="dot">{tr(TYPE_LABEL[info.type] || "Online")}</span>
          <span className="dot">{st.of ? `${st.teams}/${st.of}` : st.teams} {tr("teams")}</span>
        </div>
      </nav>

      {(event === "playoffs" || isTr || isMena || isGc) && (
        <div className="nav4" role="tablist" aria-label={tr("Section")}>
          {(isTr || isMena || isGc ? TR_SECTIONS : SECTIONS).map(([k, label]) => (
            <button key={k} id={`t-${k}`} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
              {tr(label)}
            </button>
          ))}
        </div>
      )}

      {event !== "gc" && <EventHero numbers={eventNumbers(initial, event)} teams={eventTeamsOf(initial, event)} qualified={qualifiedTeams(initial).filter((q) => q.event === event).map((q) => ({ name: q.team, logo: q.logo }))} />}
      {statusText && <p className="statusline">{statusText}</p>}
      {event !== "gc" && <EventFeed feed={eventFeed(initial, event)} event={event} />}

      <MatchTimes event={event} times={initial.times ? initial.times[event] : {}} live={initial.live ? initial.live[event] : {}} extra={initial.extra ? initial.extra[event] : {}}>
      <MatchModalProvider state={initial} events={[{ event, href: prefix + siteHref(event), items: matchesOf(event, eventData(initial, event)), times: (initial.times && initial.times[event]) || {}, live: (initial.live && initial.live[event]) || {}, extra: (initial.extra && initial.extra[event]) || {}, stream: info.stream || "" }]}>
      <div className={"cols" + (isGc ? " single" : "")}>
        <main>
          {/* this event's live and next matches, on each of its tabs */}
          {initial.times && initial.times[event] && (() => {
            const ev = [{ event, href: prefix + siteHref(event), items: matchesOf(event, eventData(initial, event)), times: initial.times[event], live: (initial.live && initial.live[event]) || {}, extra: (initial.extra && initial.extra[event]) || {}, stream: info.stream || "" }];
            return <><MatchStrip Crest={Crest} events={ev} /><MatchStrip Crest={Crest} events={ev} recent /></>;
          })()}
          {qd && <Qualifier event={event} data={qd} onGo={goTo} next={isTrq ? "tr" : isMenaq ? "mena" : "playoffs"} qualify={isTrq ? 2 : isMenaq ? 1 : 4} />}
          {isKick && <Kickoff data={initial.kickoff} />}
          {isTr && <Regional event="tr" data={initial.regional.tr} tab={tab} />}
          {isMena && <Regional event="mena" data={initial.regional.mena} tab={tab} />}
          {isGc && <Regional event="gc" data={initial.regional.gc} tab={tab} />}
          {event === "playoffs" && tab === "overview" && overview}
          {event === "playoffs" && tab === "swiss" && swissPanel}
          {event === "playoffs" && tab === "bracket" && bracketPanel}
          {event === "playoffs" && tab === "stats" && statsPanel}
          {tab !== "swiss" && tab !== "bracket" && <EventStats state={initial} event={event} known={(name) => !archive && knownPlayer(initial, name)} />}
        </main>

        {!isGc && (
        <aside>
          <div className="info">
            <div className="head">{evTitle}</div>
            <div className="mark">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/emea-kickoff.png" alt="VCT EMEA Kickoff" />
            </div>
            <h3>{tr("League Information")}</h3>
            <dl>
              <dt>{tr("Series:")}</dt><dd>VCT</dd>
              <dt>{tr("Organizer:")}</dt><dd>Riot Games</dd>
              <dt>{tr("Type:")}</dt><dd>{tr(TYPE_LABEL[info.type] || "Online")}</dd>
              {info.location && <><dt>{tr("Location:")}</dt><dd>{info.location === "Türkiye" ? <span className="pt"><Flag cc="tr" /><span>Türkiye</span></span> : info.location}</dd></>}
              {info.venue && <><dt>{tr("Venue:")}</dt><dd>{info.venue}</dd></>}
              <dt>{tr("Start Date:")}</dt><dd>{formatDate(info.start, tr.lang) || tr("TBA")}</dd>
              <dt>{tr("End Date:")}</dt><dd>{formatDate(info.end, tr.lang) || tr("TBA")}</dd>
              <dt>{tr("Teams:")}</dt><dd>{isKick ? "12" : isTr ? "8" : isMena ? "4" : isOther ? "–" : qd ? `${qd.slots.filter(Boolean).length}/${qd.slots.length}` : `16 (${tr("{n} confirmed", { n: named })})`}</dd>
              {info.tier && <><dt>{tr("Tier:")}</dt><dd>{info.tier}</dd></>}
            </dl>
            <h3>{tr("Chronology")}</h3>
            <div className="chron">
              {isKick ? (
                <><button type="button" className="linkbtn" onClick={() => goTo("playoffs")}>‹ {tr("Qualifier Playoffs")}</button><span /></>
              ) : isMena ? (
                <><button type="button" className="linkbtn" onClick={() => goTo("meq1")}>‹ ME Qualifier 1</button><button type="button" className="linkbtn r" onClick={() => goTo("kickoff")}>Kickoff ›</button>
                <button type="button" className="linkbtn" onClick={() => goTo("meq2")}>‹ ME Qualifier 2</button><span />
                <button type="button" className="linkbtn" onClick={() => goTo("naq1")}>‹ NA Qualifier 1</button><span />
                <button type="button" className="linkbtn" onClick={() => goTo("naq2")}>‹ NA Qualifier 2</button><span /></>
              ) : isMenaq ? (
                <><span /><button type="button" className="linkbtn r" onClick={() => goTo("mena")}>{tr("Qualifier Playoffs")} ›</button></>
              ) : isTrq ? (
                <><span /><button type="button" className="linkbtn r" onClick={() => goTo("tr")}>{tr("Qualifier Playoffs")} ›</button></>
              ) : isTr ? (
                <><button type="button" className="linkbtn" onClick={() => goTo("trq1")}>‹ Qualifier 1</button><button type="button" className="linkbtn r" onClick={() => goTo("kickoff")}>Kickoff ›</button>
                <button type="button" className="linkbtn" onClick={() => goTo("trq2")}>‹ Qualifier 2</button><span /></>
              ) : (
                <><span>‹ Qualifier 1</span><button type="button" className="linkbtn r" onClick={() => goTo("kickoff")}>Kickoff ›</button>
                <span>‹ Qualifier 2</span><span /></>
              )}
            </div>
          </div>
        </aside>
        )}
      </div>
      </MatchModalProvider>
      </MatchTimes>

    </div>
  );
}
