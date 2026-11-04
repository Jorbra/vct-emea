"use client";

import { useMemo, useState } from "react";
import { THIRD, buildBracket, matchId, podium, roundsFor } from "../lib/bracket.js";
import { Crest } from "./Crest.jsx";
import TeamCard from "./TeamCard.jsx";
import { useT } from "./lang.jsx";
import { Schedule } from "./matchTime.jsx";
import { matchesOf } from "../lib/matchlist.js";

const CELL = 56; // px per first-round match; every later round doubles it

/** Name, crest and score of one side of a match. */
function Side({ slot, slots, m, side, bye }) {
  const tr = useT();
  const team = slot ? slots[slot - 1] : null;
  const res = m.winner != null;
  const win = res && m.winner === slot;
  const score = side === "a" ? m.sa : m.sb;
  let label = team ? team.name : bye ? "" : tr("TBD");
  if (!team && m.bye) label = tr("BYE");
  return (
    <div className={"bl" + (res ? (win ? " bw" : " lo") : "")}>
      <Crest team={team} />
      <span className={"tn" + (team ? "" : " tbdn")}>{label}</span>
      <span className="bs">{res && score != null && !m.bye ? score : ""}</span>
    </div>
  );
}

function MatchBox({ m, slots }) {
  const emptyR1 = m.first && !m.a && !m.b;
  return (
    <div className={"bbox qbox" + (emptyR1 ? " void" : "")}>
      <Side slot={m.a} slots={slots} m={m} side="a" bye={emptyR1} />
      <Side slot={m.b} slots={slots} m={m} side="b" bye={emptyR1} />
    </div>
  );
}

export function BigBracket({ slots, scores, bo }) {
  const tr = useT();
  const bracket = useMemo(() => buildBracket(slots, scores, bo), [slots, scores, bo]);
  const third = bracket.byId[matchId("third", 0)];
  const rounds = roundsFor(slots.length);
  return (
    <div className="qbracket" tabIndex={0} aria-label={tr("Bracket")}>
      {rounds.map((r, ri) => (
        <div className="qcol" key={r.key} style={{ "--cell": `${CELL * 2 ** ri}px` }}>
          <div className="qh">{tr(r.name)}</div>
          {Array.from({ length: r.count }, (_, i) => {
            const m = bracket.byId[matchId(r.key, i)];
            return (
              <div key={m.id} className={"qcell" + (ri < rounds.length - 1 ? (i % 2 ? " lo" : " up") : "") + (ri > 0 ? " in" : "")}>
                <MatchBox m={m} slots={slots} />
              </div>
            );
          })}
          {r.key === "gf" && (
            <div className="qthird">
              <div className="qh">{tr(THIRD.name)}</div>
              <MatchBox m={third} slots={slots} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** An open Qualifier (EU, Türkiye or MENA): its `qualify` best teams go on to the `next` event's Qualifier Playoffs. */
export default function Qualifier({ event, data, onGo, next = "playoffs", qualify = 4 }) {
  const tr = useT();
  const { slots, scores, bo } = data;
  const size = slots.length;
  const bracket = useMemo(() => buildBracket(slots, scores, bo), [slots, scores, bo]);
  const [more, setMore] = useState(false);
  const [view, setView] = useState(size > 64 ? "top16" : "all"); // top16 | top64 (every team) | all
  const [opts, setOpts] = useState({ rosters: true, compact: true, hover: true });

  const nameOf = (slot) => (slot && slots[slot - 1] ? slot : null);
  const by = (round) => bracket.matches.filter((m) => m.round === round);
  const losers = (round) => by(round).map((m) => nameOf(m.loser));
  const [first, second, third, fourth] = podium(bracket).map(nameOf);
  // Places are decided by the round a team went out in; inside a group the bracket order is kept.
  const rows = [
    { place: "1", ids: [first], cls: "p1", kick: qualify >= 1 },
    { place: "2", ids: [second], cls: "p2", kick: qualify >= 2 },
    { place: "3", ids: [third], cls: "p3", kick: qualify >= 3 },
    { place: "4", ids: [fourth], kick: qualify >= 4 },
    { place: "5-8", ids: losers("qf") },
    { place: "9-16", ids: losers("r16") },
    { place: "17-32", ids: losers("r32") },
    { place: "33-64", ids: losers("r64") },
    ...(size > 64 ? [{ place: "65-128", ids: losers("r128") }, { place: "129-256", ids: losers("r256") }] : []),
  ];
  const shown = more ? rows : rows.slice(0, 4);

  const all = slots.map((t, i) => (t ? { ...t, slot: i + 1 } : null));
  const top16 = by("r16").flatMap((m) => [m.a, m.b]).map((slot) => (slot ? all[slot - 1] : null));
  const cards = (list) => (
    <div className={"teams" + (opts.compact ? " compact" : "") + (opts.hover ? " hover" : "")}>
      {list.map((t, i) => (
        <TeamCard key={t ? t.slot : "e" + i} team={t || { name: "" }} rosters={opts.rosters} />
      ))}
    </div>
  );
  const pad = (list, n) => Array.from({ length: n }, (_, i) => list[i] || null);

  return (
    <div className="panel">
      <section>
        <h2>{tr("Format")}</h2>
        <ul className="fmt">
          <li>{tr("Single-elimination bracket of up to {n} teams, with a Third Place Match", { n: size })}</li>
          <li>{qualify === 1 ? tr("The winner qualifies for the Qualifier Playoffs") : qualify === 2 ? tr("The two best teams qualify for the Qualifier Playoffs") : tr("The four best teams qualify for the Qualifier Playoffs")}</li>
        </ul>
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
                    {r.ids.map((slot, i) => (
                      <div key={i} className={"tbd prize" + (slot ? " set" : "")}>
                        <Crest team={slot ? slots[slot - 1] : null} />
                        {slot ? slots[slot - 1].name : "TBD"}
                      </div>
                    ))}
                  </td>
                  <td>{r.kick ? <button type="button" className="kick linklike" onClick={() => onGo && onGo(next)}>{tr("Qualifier Playoffs")}</button> : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="more" aria-expanded={more} onClick={() => setMore(!more)}>
            {more ? tr("Hide places 5 to {n} ⌃", { n: size }) : tr("Show places 5 to {n} ⌄", { n: size })}
          </button>
        </div>
      </section>

      <section>
        <h2>{tr("Participants")} <small>{all.filter(Boolean).length}/{size}</small></h2>
        <div className="toggles">
          <label className="sw"><input type="checkbox" checked={opts.rosters} onChange={(e) => setOpts({ ...opts, rosters: e.target.checked })} /> {tr("Show rosters")}</label>
          <label className="sw"><input type="checkbox" checked={opts.compact} onChange={(e) => setOpts({ ...opts, compact: e.target.checked })} /> {tr("Compact view")}</label>
          <label className="sw"><input type="checkbox" checked={opts.hover} onChange={(e) => setOpts({ ...opts, hover: e.target.checked })} /> {tr("Enable hover")}</label>
        </div>
        <div className="tabs sub" role="tablist" aria-label={tr("Participants")}>
          {[["top16", "Top 16"], ["top64", `Top ${size}`], ["all", "Show All"]].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)}>{tr(l)}</button>
          ))}
        </div>
        {(view === "top16" || view === "all") && (
          <>
            <h3 className="sub redsub">Top 16</h3>
            {cards(pad(top16, 16))}
          </>
        )}
        {(view === "top64" || view === "all") && (
          <>
            <h3 className="sub redsub">Top {size}</h3>
            {cards(pad(all.filter(Boolean), size))}
          </>
        )}
      </section>

      <section>
        <h2>{tr("Results")}</h2>
        <BigBracket slots={slots} scores={scores} bo={bo} />
      </section>
    </div>
  );
}
