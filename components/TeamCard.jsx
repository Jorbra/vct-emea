"use client";

import { useState } from "react";
import { parseRoster, parseStaff } from "../lib/tournament.js";
import { teamHref } from "../lib/paths.js";
import { playerHref } from "../lib/playerstats.js";
import { Crest } from "./Crest.jsx";
import { useT } from "./lang.jsx";

const ORD = ["", "1st", "2nd", "3rd", "4th"]; // translated where shown

/** The starting players from the comma separated roster, padded with TBD up to five; substitutes are listed apart. */
function playersOf(roster) {
  const list = parseRoster(roster).filter((p) => !p.sub);
  while (list.length < 5) list.push({ name: "TBD", cc: "" });
  return list;
}

/** A player of the roster, linked to the player's page. */
function PlayerName({ name }) {
  const href = playerHref(name);
  return <span>{href ? <a href={href}>{name}</a> : name}</span>;
}

export function Flag({ cc }) {
  if (!cc) return <span className="flag none" aria-hidden="true" />;
  return (
    <img
      className="flag"
      src={`https://flagcdn.com/w40/${cc}.png`}
      srcSet={`https://flagcdn.com/w80/${cc}.png 2x`}
      alt={cc.toUpperCase()}
      title={cc.toUpperCase()}
      loading="lazy"
      width="20"
      height="15"
    />
  );
}

/**
 * One team card: crest, name, badge, fold button, then (when `rosters`) the Main / Staff tabs.
 * barText: text of the grey bar; null when the team has a `source` (Qualifier 1, 2nd...). record: "3-1" or "".
 */
export default function TeamCard({ team: t, badge, inv, barText, record, cls = "", rosters = true }) {
  const tr = useT();
  const [shut, setShut] = useState(false);
  const [view, setView] = useState("main"); // main | subs | staff
  const staff = parseStaff(t.staff);
  const subs = parseRoster(t.roster).filter((p) => p.sub);
  const tabs = [["main", "Main"], ...(subs.length ? [["subs", "Subs"]] : []), ["staff", "Staff"]]; // a Subs tab only when the team has some
  const shown = view === "subs" && !subs.length ? "main" : view;
  const showBar = barText !== undefined && (t.source || barText);
  return (
    <div className={"team" + cls}>
      <Crest team={t} />
      <div className="name">{t.name ? <a href={teamHref(t.name)} title={tr("Team page")}>{t.name}</a> : "TBD"}</div>
      {badge ? <span className={"tag" + (inv ? " inv" : "")}>{badge}</span> : <span />}
      {rosters && (
        <button className="fold" aria-label={shut ? tr("Show roster") : tr("Hide roster")} aria-expanded={!shut} onClick={() => setShut(!shut)}>
          <svg viewBox="0 0 12 8" width="12" height="8" aria-hidden="true" className={shut ? "down" : ""}>
            <path d="M1 7l5-5 5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      {rosters && !shut && (
        <div className="roster">
          {showBar && (
            <div className="rsrc">
              {t.source ? (
                <>
                  <span>{t.source}</span>
                  <b className={"pos p" + t.pos}>{ORD[t.pos] ? tr(ORD[t.pos]) : ""}</b>
                </>
              ) : (
                <span>{barText}</span>
              )}
              {record && <span className="rrec">{record}</span>}
            </div>
          )}
          <div className="rtabs" role="tablist">
            {tabs.map(([k, text]) => (
              <button key={k} role="tab" aria-selected={shown === k} className={shown === k ? "on" : ""} onClick={() => setView(k)}>
                {tr(text)}{k === "subs" ? ` (${subs.length})` : ""}
              </button>
            ))}
          </div>
          <ul className="plist">
            {shown === "subs" ? (
              subs.map((p, i) => (
                <li key={i}>
                  <Flag cc={p.cc} />
                  <PlayerName name={p.name} />
                </li>
              ))
            ) : shown === "staff" ? (
              staff.length ? (
                staff.map((p, i) => (
                  <li key={i}>
                    <Flag cc={p.cc} />
                    <PlayerName name={p.name} />
                    <small className="role">{p.role === "assistant" ? tr("Assistant Coach") : tr("Coach")}</small>
                  </li>
                ))
              ) : (
                <li className="tbdp"><span className="flag q">?</span><span>{tr("No staff listed")}</span></li>
              )
            ) : (
              playersOf(t.roster).map((p, i) => (
                <li key={i} className={p.name === "TBD" ? "tbdp" : ""}>
                  {p.name === "TBD" ? <span className="flag q">?</span> : <Flag cc={p.cc} />}
                  {p.name === "TBD" ? <span>{p.name}</span> : <PlayerName name={p.name} />}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
