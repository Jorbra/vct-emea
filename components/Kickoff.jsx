"use client";

import { useMemo, useState } from "react";
import { buildKickoff, kickPlaces } from "../lib/kickoff.js";
import { Crest } from "./Crest.jsx";
import KickoffBoard from "./KickoffBoard.jsx";
import TeamCard from "./TeamCard.jsx";
import { useT } from "./lang.jsx";
import { Schedule } from "./matchTime.jsx";
import { matchesOf } from "../lib/matchlist.js";

/** The VCT EMEA Kickoff page: format, prize pool, participants and the triple-elimination bracket. */
export default function Kickoff({ data }) {
  const tr = useT();
  const { teams } = data;
  const bracket = useMemo(() => buildKickoff(data.manual, data.scores), [data]);
  const [more, setMore] = useState(false);
  const [opts, setOpts] = useState({ rosters: true, compact: true, hover: true });
  const places = kickPlaces(bracket);
  const nameOf = (n) => (n ? teams[n - 1].name || "" : "");
  const rows = [
    { place: "1", ids: [places[0]], cls: "p1", go: true },
    { place: "2", ids: [places[1]], cls: "p2", go: true },
    { place: "3", ids: [places[2]], cls: "p3", go: true },
    { place: "4", ids: [places[3]] },
    { place: "5", ids: [places[4]] },
    { place: "6", ids: [places[5]] },
    { place: "7-8", ids: [places[6], places[7]] },
    { place: "9-10", ids: [places[8], places[9]] },
    { place: "11-12", ids: [places[10], places[11]] },
  ];
  const shown = more ? rows : rows.slice(0, 4);

  return (
    <div className="panel">
      <section>
        <h2>{tr("Format")}</h2>
        <ul className="fmt">
          <li><b>{tr("Playoffs:")}</b>
            <ul>
              <li>{tr("Triple-Elimination bracket")}</li>
              <li>{tr("All matches (excl. UB Final, MB Final & LB Final) are Bo3")}</li>
              <li>{tr("UB Final, MB Final & LB Final are Bo5")}</li>
            </ul>
          </li>
        </ul>
      </section>
      <Schedule Crest={Crest} items={matchesOf("kickoff", data)} />

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
                      <div key={i} className={"tbd prize" + (n && nameOf(n) ? " set" : "")}>
                        <Crest team={n ? teams[n - 1] : null} />
                        {n && nameOf(n) ? nameOf(n) : "TBD"}
                      </div>
                    ))}
                  </td>
                  <td>{r.go ? <span className="kick">Masters Seoul</span> : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="more" aria-expanded={more} onClick={() => setMore(!more)}>
            {more ? tr("Hide places 5 to 12 ⌃") : tr("Show places 5 to 12 ⌄")}
          </button>
        </div>
      </section>

      <section>
        <h2>{tr("Participants")} <small>{teams.filter((t) => t.name).length}/12</small></h2>
        <div className="toggles">
          <label className="sw"><input type="checkbox" checked={opts.rosters} onChange={(e) => setOpts({ ...opts, rosters: e.target.checked })} /> {tr("Show rosters")}</label>
          <label className="sw"><input type="checkbox" checked={opts.compact} onChange={(e) => setOpts({ ...opts, compact: e.target.checked })} /> {tr("Compact view")}</label>
          <label className="sw"><input type="checkbox" checked={opts.hover} onChange={(e) => setOpts({ ...opts, hover: e.target.checked })} /> {tr("Enable hover")}</label>
        </div>
        <div className={"teams" + (opts.compact ? " compact" : "") + (opts.hover ? " hover" : "")}>
          {teams.map((t) => (
            <TeamCard
              key={t.id}
              team={t}
              badge={t.status === "invited" ? tr("Invited") : tr("Qualified")}
              inv={t.status === "invited"}
              barText={t.source ? null : tr("Partner Team")}
              rosters={opts.rosters}
            />
          ))}
        </div>
      </section>

      <section>
        <h2>{tr("Results")}</h2>
        <KickoffBoard bracket={bracket} teams={teams} />
      </section>
    </div>
  );
}
