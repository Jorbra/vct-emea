"use client";

// Round 19: two teams' map pools side by side, an agent's share of the picks event by event.
import { useT } from "./lang.jsx";
import { Crest } from "./Crest.jsx";
import { mapList } from "./Assets.jsx";

/** Both teams' maps on one list: each one's win rate on either side, the map's picture behind. */
export function PoolsCompare({ a, b, pools }) {
  const tr = useT();
  const names = [...new Set([...pools.a, ...pools.b].map((m) => m.map))];
  const of = (list, map) => list.find((m) => m.map === map) || null;
  const pct = (m) => (m ? Math.round((m.won / m.played) * 100) : null);
  const rows = names.map((map) => ({ map, a: of(pools.a, map), b: of(pools.b, map) }))
    .sort((x, y) => ((y.a ? y.a.played : 0) + (y.b ? y.b.played : 0)) - ((x.a ? x.a.played : 0) + (x.b ? x.b.played : 0)));
  const cell = (m, side) => (
    <span className={"pcside " + side}>
      {m ? <><b className={pct(m) >= 50 ? "up" : "down"}>{pct(m)}%</b><small>{m.won}–{m.played - m.won}</small></> : <small>{tr("not played")}</small>}
      {m && <i className="pcbar" style={{ width: `${pct(m)}%` }} />}
    </span>
  );
  return (
    <section className="poolscmp">
      <h2>{tr("Map pools")}</h2>
      <div className="pchead"><span><Crest team={a} />{a.name}</span><span /><span>{b.name}<Crest team={b} /></span></div>
      {rows.map((r) => (
        <div key={r.map} className="pcrow" style={mapList(r.map) ? { "--mapimg": `url(${mapList(r.map)})` } : undefined}>
          {cell(r.a, "a")}
          <a className="pcmap" href={`/map/${r.map.toLowerCase()}`}>{r.map}</a>
          {cell(r.b, "b")}
        </div>
      ))}
      <p className="hint">{tr("From vlr.gg's tables of the site's events.")}</p>
    </section>
  );
}

/** An agent's share of the picks in each event, as bars. */
export function AgentByEvent({ list, color }) {
  const tr = useT();
  if (!list || list.length < 2) return null;
  const max = Math.max(10, ...list.map((x) => x.share));
  return (
    <section className="agbyev" style={{ "--agc": color || "var(--lime)" }}>
      <h2>📈 {tr("Event by event")}</h2>
      <div className="abecols">{list.map((x) => (
        <div key={x.event} className="abecol" title={`${tr(x.name)} : ${x.share}%`}>
          <span className="abeval">{x.share}%</span>
          <span className="abebar"><i style={{ height: `${Math.max(3, Math.round((x.share / max) * 100))}%` }} /></span>
          <small>{tr(x.name)}</small>
        </div>
      ))}</div>
      <p className="hint">{tr("Share of the teams that took it, in each event with vlr.gg's tables.")}</p>
    </section>
  );
}

const ROLE_ORDER = ["Duelist", "Initiator", "Controller", "Sentinel"];

/** The best players of each role (from their most played agent), four columns. */
export function RoleLeaders({ roles }) {
  const tr = useT();
  const shown = ROLE_ORDER.filter((r) => (roles[r] || []).length);
  if (!shown.length) return null;
  return (
    <section className="roleleaders">
      <h2>🎯 {tr("Best players by role")}</h2>
      <div className="rlgrid">{shown.map((role) => (
        <div key={role} className="rlcol">
          <h3>{tr(role)}</h3>
          <ol>{roles[role].map((p) => (
            <li key={p.slug} style={{ "--agc": p.color }}>
              {p.icon && <img src={p.icon} alt="" width="22" height="22" loading="lazy" />}
              <a href={`/player/${p.slug}`}><b>{p.name}</b><small>{p.team}</small></a>
              <span>{p.r.toFixed(2)}</span>
            </li>
          ))}</ol>
        </div>
      ))}</div>
      <p className="hint">{tr("Role from each player's most played agent; 4 maps at least.")}</p>
    </section>
  );
}
