"use client";

import { useMemo, useState } from "react";
import { buildRegional, groupStats, regPlaces } from "../lib/regional.js";
import { Crest } from "./Crest.jsx";
import TeamCard from "./TeamCard.jsx";
import { useT } from "./lang.jsx";
import { Schedule, When, useLiveScore, useMatchClick } from "./matchTime.jsx";
import { matchesOf } from "../lib/matchlist.js";

function Side({ team, score, win, lo }) {
  const tr = useT();
  return (
    <div className={"kbl" + (win ? " bw" : "") + (lo ? " lo" : "")}>
      <Crest team={team || null} />
      <span className={"tn" + (team && team.name ? "" : " tbdn")}>{team && team.name ? team.name : tr("TBD")}</span>
      <span className="bs">{score ?? ""}</span>
    </div>
  );
}

function RMatch({ m, teams, event }) {
  const done = m.winner != null;
  const ls = useLiveScore(m.id, done); // maps won so far while the match is being played
  const click = useMatchClick(event, m.id); // opens the match's details
  return (
    <div {...click} className={"kbox" + (click.className ? " " + click.className : "")}>
      <When id={m.id} done={done} />
      <Side team={m.a ? teams[m.a - 1] : null} score={m.sa ?? (ls ? ls.a : null)} win={done && m.winner === m.a} lo={done && m.winner !== m.a} />
      <Side team={m.b ? teams[m.b - 1] : null} score={m.sb ?? (ls ? ls.b : null)} win={done && m.winner === m.b} lo={done && m.winner !== m.b} />
    </div>
  );
}

/** One GSL group: the four teams (by final place once known), their match and map records, and its five matches on demand. */
function GslGroup({ stage, bracket, teams }) {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const g = stage.key;
  const places = bracket.groups[g];
  const st = groupStats(bracket, g);
  // final places first; teams not placed yet in the order they appear in the opening matches
  const seen = stage.rounds[0].matches.flatMap((m) => [m.a, m.b]).filter(Boolean);
  const order = [...places.filter(Boolean), ...seen.filter((t) => !places.includes(t))];
  const rows = Array.from({ length: 4 }, (_, i) => order[i] || null);
  return (
    <div className="gsl">
      <table>
        <thead><tr><th colSpan={4}>{tr(stage.name)}</th></tr></thead>
        <tbody>
          {rows.map((n, i) => {
            const placed = n && places[i] === n;
            const s = (n && st[n]) || { w: 0, l: 0, mw: 0, ml: 0 };
            return (
              <tr key={i} className={placed ? (i < 2 ? "adv" : "out") : ""}>
                <td className="gpos">{placed ? i + 1 : "–"}</td>
                <td><span className="pt"><Crest team={n ? teams[n - 1] : null} /><span>{n && teams[n - 1].name ? teams[n - 1].name : tr("TBD")}</span></span></td>
                <td className="num">{n ? `${s.w}-${s.l}` : "–"}</td>
                <td className="num">{n ? `${s.mw}-${s.ml}` : "–"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button className="more" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? tr("Hide {g} matches ⌃", { g: tr(stage.name) }) : tr("Show {g} matches ⌄", { g: tr(stage.name) })}
      </button>
      {open && (
        <div className="gslm">
          {stage.rounds.map((r) => (
            <div key={r.key}>
              <div className="kbh">{tr(r.name)}</div>
              <div className="kbms">{r.matches.map((m) => <RMatch key={m.id} m={m} teams={teams} event={event} />)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A regional Qualifier Playoffs page: format, prize pool, participants and results. Türkiye ("gsl8"): GSL groups, then a
 * double-elimination bracket. MENA ("se4"): a four-team single-elimination bracket.
 */
export default function Regional({ event = "tr", data, tab }) {
  const tr = useT();
  const { teams } = data;
  const bracket = useMemo(() => buildRegional(data.manual, data.scores, event), [data, event]);
  const gsl = bracket.format === "gsl8";
  const de8 = bracket.format === "de8"; // Game Changers: double elimination, its champion wins the event
  const total = Object.keys(bracket.byId).length;
  const [more, setMore] = useState(false);
  const [opts, setOpts] = useState({ rosters: true, compact: true, hover: true });
  const places = regPlaces(bracket);
  const team = (n) => (n ? teams[n - 1] : null);
  const named = (n) => !!(n && teams[n - 1].name);
  const rows = gsl
    ? [
      { place: "1", ids: [places[0]], cls: "p1", go: true },
      { place: "2", ids: [places[1]], cls: "p2" },
      { place: "3", ids: [places[2]], cls: "p3" },
      { place: "4", ids: [places[3]] },
      { place: "5-6", ids: [places[4], places[5]] },
      { place: "7-8", ids: [places[6], places[7]] },
    ]
    : de8 ? [
      { place: "1", ids: [places[0]], cls: "p1" },
      { place: "2", ids: [places[1]], cls: "p2" },
      { place: "3", ids: [places[2]], cls: "p3" },
      { place: "4", ids: [places[3]] },
      { place: "5-6", ids: [places[4], places[5]] },
      { place: "7-8", ids: [places[6], places[7]] },
    ]
    : [
      { place: "1", ids: [places[0]], cls: "p1", go: true },
      { place: "2", ids: [places[1]], cls: "p2" },
      { place: "3-4", ids: [places[2], places[3]], cls: "p3" },
    ];
  const shown = more || !(gsl || de8) ? rows : rows.slice(0, 4);
  const groups = bracket.stages.filter((s) => s.key !== "po");
  const po = bracket.stages.find((s) => s.key === "po");
  const round = (k) => bracket.stages.flatMap((s) => s.rounds).find((r) => r.key === k);
  const champ = bracket.byId.gf.winner;

  if (tab === "stats") {
    // every played match of the event, groups and playoffs
    const played = Object.values(bracket.byId).filter((m) => m.winner != null);
    const maps = played.reduce((n, m) => n + m.sa + m.sb, 0);
    const rec = {};
    for (const m of played) {
      for (const [t, mw, ml, won] of [[m.a, m.sa, m.sb, m.winner === m.a], [m.b, m.sb, m.sa, m.winner === m.b]]) {
        const r = (rec[t] = rec[t] || { w: 0, l: 0, mw: 0, ml: 0 });
        r.mw += mw; r.ml += ml; won ? r.w++ : r.l++;
      }
    }
    const list = Object.entries(rec).map(([t, r]) => ({ t: Number(t), ...r })).sort((a, b) => b.w - a.w || a.l - b.l || (b.mw - b.ml) - (a.mw - a.ml));
    return (
      <div className="panel">
        <section>
          <h2>{tr("Statistics")}</h2>
          <div className="stats">
            <div className="stat"><b>{teams.filter((t) => t.name).length}/{teams.length}</b><span>{tr("Teams confirmed")}</span></div>
            <div className="stat"><b>{played.length}/{total}</b><span>{tr("Matches played")}</span></div>
            <div className="stat"><b>{maps}</b><span>{tr("Maps played")}</span></div>
            <div className="stat"><b>{played.length ? (maps / played.length).toFixed(1) : "–"}</b><span>{tr("Maps per match")}</span></div>
          </div>
          {list.length > 0 ? (
            <div className="tablewrap">
              <table>
                <thead><tr><th>{tr("Team")}</th><th className="num">{tr("W-L")}</th><th className="num">{tr("Maps")}</th><th className="num">{tr("Map diff")}</th></tr></thead>
                <tbody>
                  {list.map((r) => {
                    const d = r.mw - r.ml;
                    return (
                      <tr key={r.t}>
                        <td><span className="pt"><Crest team={team(r.t)} /><span>{team(r.t).name || tr("TBD")}</span></span></td>
                        <td className="num">{r.w}-{r.l}</td>
                        <td className="num">{r.mw}-{r.ml}</td>
                        <td className="num">{d > 0 ? "+" : ""}{d}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="note">{gsl ? tr("Match and map statistics appear once the Group Stage begins.") : tr("Match and map statistics appear once the Semifinals begin.")}</p>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="panel">
      <section>
        <h2>{tr("Format")}</h2>
        {de8 ? (
          <ul className="fmt">
            <li>{tr("8 Team Double-Elimination bracket")}
              <ul>
                <li>{tr("All matches (excl. Grand Final) are Bo3")}</li>
                <li>{tr("Grand Final is Bo5")}</li>
              </ul>
            </li>
          </ul>
        ) : gsl ? (
          <ul className="fmt">
            <li>{tr("2 GSL Groups")}</li>
            <li>{tr("4 Team Double-Elimination bracket")}
              <ul>
                <li>{tr("All matches (excl. Grand Final) are Bo3")}</li>
                <li>{tr("Grand Final is Bo5")}</li>
              </ul>
            </li>
          </ul>
        ) : (
          <ul className="fmt">
            <li>{tr("Single-Elimination bracket")}
              <ul>
                <li>{tr("All matches are Bo5")}</li>
                <li>{tr("The Grand Final is played offline.")}</li>
              </ul>
            </li>
          </ul>
        )}
      </section>
      <Schedule Crest={Crest} items={matchesOf(event, data)} />

      <section>
        <h2>{tr("Prize Pool")}</h2>
        <div className="tablewrap">
          <table>
            <thead>
              <tr><th>{tr("Place")}</th><th>{tr("Participant")}</th><th>{tr("Qualifies to")}</th></tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.place} className={r.cls || ""}>
                  <td><span className="place">{r.place}</span></td>
                  <td>
                    {r.ids.map((n, i) => (
                      <div key={i} className={"tbd prize" + (named(n) ? " set" : "")}>
                        <Crest team={team(n)} />
                        {named(n) ? team(n).name : "TBD"}
                      </div>
                    ))}
                  </td>
                  <td>{r.go ? <span className="kick">Kickoff</span> : de8 && r.place === "1" ? tr("Champion") : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(gsl || de8) && (
            <button className="more" aria-expanded={more} onClick={() => setMore(!more)}>
              {more ? tr("Hide places 5 to 8 ⌃") : tr("Show places 5 to 8 ⌄")}
            </button>
          )}
        </div>
      </section>

      <section>
        <h2>{tr("Participants")} <small>{teams.filter((t) => t.name).length}/{teams.length}</small></h2>
        <div className="toggles">
          <label className="sw"><input type="checkbox" checked={opts.rosters} onChange={(e) => setOpts({ ...opts, rosters: e.target.checked })} /> {tr("Show rosters")}</label>
          <label className="sw"><input type="checkbox" checked={opts.compact} onChange={(e) => setOpts({ ...opts, compact: e.target.checked })} /> {tr("Compact view")}</label>
          <label className="sw"><input type="checkbox" checked={opts.hover} onChange={(e) => setOpts({ ...opts, hover: e.target.checked })} /> {tr("Enable hover")}</label>
        </div>
        <div className={"teams" + (opts.compact ? " compact" : "") + (opts.hover ? " hover" : "")}>
          {teams.map((t) => (
            <TeamCard
              key={t.slot}
              team={t}
              badge={t.status === "invited" ? tr("Invited") : tr("Qualified")}
              inv={t.status === "invited"}
              barText={t.source ? null : tr("Invited")}
              rosters={opts.rosters}
            />
          ))}
        </div>
      </section>

      <section>
        <h2>{tr("Results")}</h2>
        {gsl && (
          <>
            <h3 className="sub">{tr("Group Stage")}</h3>
            <div className="gsls">
              {groups.map((s) => <GslGroup key={s.key} stage={s} bracket={bracket} teams={teams} />)}
            </div>
            <h3 className="sub">{tr("Playoffs")}</h3>
          </>
        )}
        <div className="kbsec" aria-label={tr(gsl ? "Upper Bracket" : "Playoffs")}>
          <div className="kbscroll">
            <div className="kbrow">
              {(de8 ? ["ubq", "ubs", "ubf", "gf"] : gsl ? ["ubs", "ubf", "gf"] : ["sf", "gf"]).map((k) => (
                <div className="kbcol" key={k}>
                  <div className="kbh">{tr(round(k).name)}</div>
                  <div className="kbms">{round(k).matches.map((m) => <RMatch key={m.id} m={m} teams={teams} event={event} />)}</div>
                </div>
              ))}
              <div className="kbcol">
                <div className="kbh">{de8 ? tr("Champion") : tr("Qualified to Kickoff")}</div>
                <div className="kbms">
                  <div className={"kbox kq" + (champ ? " set" : "")}><Side team={team(champ)} win={!!champ} /></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {(gsl || de8) && (
          <div className="kbsec" aria-label={tr("Lower Bracket")}>
            <div className="kbscroll">
              <div className="kbrow">
                {(de8 ? ["lb1", "lbq", "lbs", "lbf"] : ["lbs", "lbf"]).map((k) => (
                  <div className="kbcol" key={k}>
                    <div className="kbh">{tr(round(k).name)}</div>
                    <div className="kbms">{round(k).matches.map((m) => <RMatch key={m.id} m={m} teams={teams} event={event} />)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
