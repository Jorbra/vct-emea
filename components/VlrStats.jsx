"use client";

import { useState } from "react";
import { useT } from "./lang.jsx";
import { Crest } from "./Crest.jsx";
import { Flag } from "./TeamCard.jsx";
import { playerHref } from "../lib/playerstats.js";
import { AgentList, mapList } from "./Assets.jsx";

const COLS = [["r", "R", "Rating 2.0"], ["acs", "ACS", "Average Combat Score"], ["k", "K", "Kills"], ["d", "D", "Deaths"], ["a", "A", "Assists"], ["pm", "+/–", "Kills – Deaths"], ["kast", "KAST", "Kill, Assist, Trade, Survive %"], ["adr", "ADR", "Average Damage per Round"], ["hs", "HS%", "Headshot %"], ["fk", "FK", "First Kills"], ["fd", "FD", "First Deaths"], ["fpm", "+/–", "First Kills – First Deaths"]];
const PCT = ["kast", "hs"];
const SIGNED = ["pm", "fpm"];
const show = (key, v) => (v == null ? "–" : PCT.includes(key) ? `${v}%` : SIGNED.includes(key) && v > 0 ? `+${v}` : key === "r" ? v.toFixed(2) : v);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** One team's table, like vlr.gg's: each player with flag and agents, then every number. */
function TeamTable({ team, rows }) {
  const tr = useT();
  const name = (team && team.name) || tr("TBD");
  return (
    <div className="vlrteam">
      <div className="vlrteamname"><Crest team={team} /><b>{name}</b></div>
      <div className="vlrscroll">
        <table className="vlrtable">
          <thead><tr><th className="vlrp">{tr("Player")}</th>{COLS.map(([k, label, title]) => <th key={k} title={title}>{label}</th>)}</tr></thead>
          <tbody>
            {rows.map((p) => {
              const href = playerHref(p.name);
              return (
                <tr key={p.name}>
                  <td className="vlrp">
                    <span className="vlrname">{p.cc && <Flag cc={p.cc} />}{href ? <a href={href}>{p.name}</a> : p.name}</span>
                    {p.agents && p.agents.length > 0 && <span className="vlragents"><AgentList list={p.agents} size={20} /></span>}
                  </td>
                  {COLS.map(([k]) => <td key={k} className={SIGNED.includes(k) && p[k] ? (p[k] > 0 ? "vlrpos" : "vlrneg") : k === "acs" ? "strong" : ""}>{show(k, p[k])}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** vlr.gg's numbers for a match: "All maps" and each map, both teams apart. */
export default function VlrStats({ details, m }) {
  const tr = useT();
  const [tab, setTab] = useState(-1);
  const maps = details.maps || [];
  const rows = tab < 0 ? details.all || [] : (maps[tab] && maps[tab].rows) || [];
  const of = (side) => rows.filter((p) => p.side === side).sort((x, y) => (y.acs || 0) - (x.acs || 0));
  const split = rows.some((p) => p.side);
  return (
    <section className="vlrstats">
      <div className="tabs sub vlrtabs" role="tablist" aria-label={tr("Maps")}>
        <button type="button" role="tab" aria-selected={tab < 0} onClick={() => setTab(-1)}>{tr("All maps")}</button>
        {maps.map((x, i) => (
          <button type="button" role="tab" key={x.map + i} aria-selected={tab === i} onClick={() => setTab(i)} className={mapList(x.map) ? "maptab" : ""} style={mapList(x.map) ? { "--mapimg": `url(${mapList(x.map)})` } : undefined}>
            {x.map} <small>{x.a}–{x.b}</small>
          </button>
        ))}
      </div>
      {split ? <><TeamTable team={m.a} rows={of("a")} /><TeamTable team={m.b} rows={of("b")} /></> : <TeamTable team={null} rows={rows} />}
      <p className="vlrcredit">{tr("Numbers from")} <a href="https://www.vlr.gg/" target="_blank" rel="noopener noreferrer">vlr.gg</a></p>
    </section>
  );
}
