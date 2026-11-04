"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { needWins } from "../lib/tournament.js";
import { Crest } from "./Crest.jsx";
import { useT } from "./lang.jsx";
import { When, useLiveScore, useMatchClick, useMatchTimes } from "./matchTime.jsx";

/**
 * The Kickoff bracket drawn like Liquipedia: Upper, Mid and Lower Bracket, one column per round, compact two-line match
 * boxes (logo, name, maps), the winner in bold, and lines from each match to the one its winner moves on to.
 * Read-only on the site. In the editor (pick + onScore given) the sides chosen by hand get a team menu and every score
 * cell becomes a field, both drawn so the bracket looks the same.
 */
export default function KickoffBoard({ bracket, teams, pick, onScore, renderDetails }) {
  const tr = useT();
  return (
    <div className="lpb">
      {bracket.sections.map((sec) => <Section key={sec.key} sec={sec} teams={teams} pick={pick} onScore={onScore} tr={tr} />)}
    </div>
  );
}

function Section({ sec, teams, pick, onScore, tr, renderDetails }) {
  const ref = useRef(null);
  const [lines, setLines] = useState([]);
  const last = sec.rounds[sec.rounds.length - 1].matches[0];
  const champ = last.winner ? teams[last.winner - 1] : null;
  // Lines are measured from the boxes once drawn, so they follow the layout whatever the width.
  useLayoutEffect(() => {
    const row = ref.current;
    if (!row) return undefined;
    const draw = () => {
      const base = row.getBoundingClientRect();
      const side = (id, k) => {
        const el = row.querySelector(`[data-mid="${id}"]`);
        if (!el) return null;
        if (k) { const line = el.querySelector(`[data-side="${k}"]`); return line && line.getBoundingClientRect(); }
        // the box without its time row: from its first team line to its last
        const ls = el.querySelectorAll(".lpl");
        const r = el.getBoundingClientRect();
        if (!ls.length) return r;
        const top = ls[0].getBoundingClientRect().top;
        return { left: r.left, right: r.right, top, height: ls[ls.length - 1].getBoundingClientRect().bottom - top };
      };
      const out = [];
      const join = (from, to, k) => {
        const a = side(from);
        const b = side(to, k);
        if (!a || !b) return;
        const x1 = a.right - base.left;
        const y1 = Math.round(a.top + a.height / 2 - base.top) + 0.5;
        const x2 = b.left - base.left;
        const y2 = Math.round(b.top + b.height / 2 - base.top) + 0.5;
        const mx = Math.round(x1 + (x2 - x1) / 2) + 0.5;
        out.push(`M${x1} ${y1}H${mx}V${y2}H${x2}`);
      };
      // a line for each winner moving on; a loser comes from another bracket and has none
      for (const r of sec.rounds) for (const m of r.matches) {
        for (const k of ["a", "b"]) if (m.feed[k] && m.feed[k][1] === "winner") join(m.feed[k][0], m.id, k);
      }
      join(last.id, `${sec.key}-q`, "a");
      setLines(out);
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(row);
    return () => ro.disconnect();
  }, [sec, last.id]);
  return (
    <div className="lpsec" aria-label={tr(sec.name)}>
      <div className="lpscroll">
        <div className="lprow" ref={ref}>
          <svg className="lplines" aria-hidden="true">{lines.map((d, i) => <path key={i} d={d} />)}</svg>
          {sec.rounds.map((r) => (
            <div className="lpcol" key={r.key}>
              <div className="lph">{tr(r.name)}</div>
              <div className="lpms">
                {r.matches.map((m) => <Match key={m.id + "|" + m.a + "|" + m.b + "|" + m.sa + "|" + m.sb} m={m} teams={teams} pick={pick} onScore={onScore} renderDetails={renderDetails} />)}
              </div>
            </div>
          ))}
          <div className="lpcol">
            <div className="lph">{tr("Qualified")}</div>
            <div className="lpms">
              <div className={"lpbox lpq" + (champ ? " set" : "")} data-mid={`${sec.key}-q`}>
                <div className={"lpl" + (champ ? " w" : "")} data-side="a">
                  <Crest team={champ} />
                  <span className={"tn" + (champ ? "" : " tbd")}>{champ ? champ.name : "TBD"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** One match: two lines (team, maps). In the editor the score is saved once both numbers make a finished series. */
function Match({ m, teams, pick, onScore, renderDetails }) {
  const edit = !!onScore;
  const [sa, setSa] = useState(m.sa ?? "");
  const [sb, setSb] = useState(m.sb ?? "");
  const ready = !!(m.a && m.b);
  const done = m.winner != null;
  const [details, setDetails] = useState(false);
  const tr = useT();
  const ls = useLiveScore(m.id, done); // maps won so far while the match is being played
  const { event } = useMatchTimes();
  const click = useMatchClick(edit ? null : event, m.id); // the site opens the match's details
  function commit(a, b) {
    if (a === "" && b === "") { if (m.sa != null) onScore(m, null, null); return; }
    if (a === "" || b === "") return; // wait for the other number
    const x = Number(a);
    const y = Number(b);
    if (x !== m.sa || y !== m.sb) onScore(m, x, y);
  }
  const line = (k, val, set) => {
    const t = m[k] ? teams[m[k] - 1] : null;
    const won = done && m.winner === m[k];
    const menu = edit && pick ? pick(m, k) : null;
    return (
      <div className={"lpl" + (won ? " w" : done ? " l" : "")} data-side={k}>
        <Crest team={t} />
        {menu ? <span className="tn pick">{menu}</span> : <span className={"tn" + (t && t.name ? "" : " tbd")} title={t ? t.name : ""}>{(t && t.name) || "TBD"}</span>}
        {edit ? (
          <input className="lps" type="number" min="0" max={needWins(m.bo)} value={val} disabled={!ready} aria-label={`${(t && t.name) || "TBD"} maps`}
            onChange={(e) => set(e.target.value)} onBlur={() => commit(k === "a" ? val : sa, k === "b" ? val : sb)}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
        ) : (
          <span className={"lps" + (ls ? " lv" : "")}>{m[k === "a" ? "sa" : "sb"] ?? (ls ? ls[k] : "")}</span>
        )}
      </div>
    );
  };
  return (
    <div {...click} className={"lpbox" + (click.className ? " " + click.className : "")} data-mid={m.id} title={`Bo${m.bo}`}>
      <When id={m.id} done={m.winner != null} />
      {line("a", sa, setSa)}
      {line("b", sb, setSb)}
      {renderDetails && (
        <>
          <button type="button" className="lpmore" title={tr("Time, stream, maps")} aria-label={tr("Time, stream, maps")} onClick={() => setDetails(true)}>⋯</button>
          {details && (
            <div className="mmback" onClick={() => setDetails(false)}>
              <div className="mm adm lpdetails" role="dialog" aria-modal="true" aria-label={tr("Time, stream, maps")} onClick={(e) => e.stopPropagation()}>
                <button type="button" className="mmclose" aria-label={tr("Close")} onClick={() => setDetails(false)}>×</button>
                {renderDetails(m)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
