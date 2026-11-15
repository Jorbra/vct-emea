"use client";

// Round 21: the players in form on the home page; a map's or a player's records.
import { useT } from "./lang.jsx";
import { AgentIcon } from "./Assets.jsx";

/** The players whose last 14 days are the furthest above their season. */
export function InForm({ list }) {
  const tr = useT();
  if (!list || !list.length) return null;
  return (
    <section className="inform">
      <h2>🔥 {tr("In form")} <small>{tr("Their last maps against the ones before")}</small></h2>
      <div className="informrow">{list.map((p) => (
        <a key={p.slug} href={`/player/${p.slug}`} className="informcard">
          <b>{p.name}</b>
          <small>{p.team}</small>
          <span className="infnums"><strong>{Number(p.recent).toFixed(2)}</strong><em className={p.delta >= 0 ? "up" : "down"}>{p.delta >= 0 ? "▲" : "▼"} {Math.abs(Number(p.delta)).toFixed(2)}</em></span>
        </a>
      ))}</div>
    </section>
  );
}

/** Records: the best lines for ACS, kills, rating (and first kills), each with its player, map and match. */
export function Records({ rec, title, player = false }) {
  const tr = useT();
  if (!rec) return null;
  const blocks = [["acs", tr("Best ACS"), (v) => v], ["kills", tr("Most kills"), (v) => v], ["rating", tr("Best rating"), (v) => Number(v).toFixed(2)], ["fk", tr("Most first kills"), (v) => v]].filter(([k]) => (rec[k] || []).length);
  return (
    <section className="records21">
      <h2>🏅 {title}</h2>
      <div className="recgrid">{blocks.map(([k, label, fmt]) => (
        <div key={k} className="reccol">
          <h3>{label}</h3>
          <ol>{rec[k].map((x, i) => (
            <li key={i}>
              <strong>{fmt(x.value)}</strong>
              {x.agent ? <AgentIcon name={x.agent} size={20} /> : null}
              <span>{player ? <a href={`/map/${x.map.toLowerCase()}`}>{x.map}</a> : <a href={`/player/${x.slug}`}>{x.name}</a>}<small> · <a href={`/match/${x.event}/${x.id}`}>{player ? tr("Match page") : x.map}</a></small></span>
            </li>
          ))}</ol>
        </div>
      ))}</div>
    </section>
  );
}
