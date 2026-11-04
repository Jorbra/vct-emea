"use client";

import { useT } from "./lang.jsx";
import { playerHref, mapStats, mvpRanking, playerLeaders } from "../lib/playerstats.js";

/** Map, MVP and player tables, shown once the editor has saved such details. `known` tells which players have a page. */
export default function EventStats({ state, event = "", known = null }) {
  const tr = useT();
  const maps = mapStats(state, { event });
  const mvps = mvpRanking(state, event).slice(0, 10);
  const leaders = playerLeaders(state, event).slice(0, 15);
  if (!maps.length && !mvps.length && !leaders.length) return null;
  const who = (name) => (!known || known(name) ? <a href={playerHref(name)}>{name}</a> : name);
  return (
    <div className="tgrid evstats">
      {leaders.length > 0 && (
        <section>
          <h2>{tr("Best players")}</h2>
          <div className="tablewrap wide">
            <table>
              <thead><tr><th>{tr("Player")}</th><th>ACS</th><th>K/D</th><th>K</th><th>D</th><th>A</th><th>{tr("Matches")}</th></tr></thead>
              <tbody>{leaders.map((p) => <tr key={p.name}><td>{who(p.name)}</td><td><b>{p.acs}</b></td><td>{p.kd}</td><td>{p.k}</td><td>{p.d}</td><td>{p.a}</td><td>{p.matches}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}
      {mvps.length > 0 && (
        <section>
          <h2>{tr("Match MVPs")}</h2>
          <div className="tablewrap wide">
            <table>
              <thead><tr><th>{tr("Player")}</th><th>MVP</th></tr></thead>
              <tbody>{mvps.map((p) => <tr key={p.name}><td>{who(p.name)}</td><td><b>{p.n}</b></td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}
      {maps.length > 0 && (
        <section>
          <h2>{tr("Most played maps")}</h2>
          <div className="tablewrap wide">
            <table>
              <thead><tr><th>{tr("Map")}</th><th>{tr("Played")}</th></tr></thead>
              <tbody>{maps.map((m) => <tr key={m.map}><td>{m.map}</td><td><b>{m.played}</b></td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

/** A team's record on each map. */
export function TeamMaps({ state, team }) {
  const tr = useT();
  const maps = mapStats(state, { team });
  if (!maps.length) return null;
  return (
    <section>
      <h2>{tr("Maps")}</h2>
      <div className="tablewrap">
        <table>
          <thead><tr><th>{tr("Map")}</th><th>{tr("Played")}</th><th>W-L</th><th>%</th><th>{tr("Rounds")}</th><th>{tr("Picked")}</th></tr></thead>
          <tbody>
            {maps.map((m) => (
              <tr key={m.map}><td>{m.map}</td><td>{m.played}</td><td><b>{m.w} – {m.l}</b></td><td>{m.played ? Math.round((m.w / m.played) * 100) : 0}%</td><td>{m.rf} – {m.ra}</td><td>{m.picks}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
