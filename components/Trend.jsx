"use client";

import { useState } from "react";
import { useT } from "./lang.jsx";

/**
 * One measure match after match (oldest first), as a thin line: one series, so no legend, the title names it.
 * Hover or focus a point for its match and value; the table below the chart has every number.
 */
function Line({ title, points, fmt, base }) {
  const [cur, setCur] = useState(-1);
  const W = 560;
  const H = 150;
  const P = { l: 34, r: 10, t: 12, b: 20 };
  const vals = points.map((p) => p.v);
  const lo = Math.min(...vals, base ?? Infinity);
  const hi = Math.max(...vals, base ?? -Infinity);
  const span = hi - lo || 1;
  const x = (i) => P.l + (points.length === 1 ? (W - P.l - P.r) / 2 : (i * (W - P.l - P.r)) / (points.length - 1));
  const y = (v) => P.t + (1 - (v - lo) / span) * (H - P.t - P.b);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const shown = cur >= 0 ? points[cur] : null;
  return (
    <figure className="trend">
      <figcaption>{title}{shown && <span className="trendtip">{shown.label} · <b>{fmt(shown.v)}</b></span>}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} onMouseLeave={() => setCur(-1)}>
        {[lo, hi].map((v, i) => <g key={i}><line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} className="trendgrid" /><text x={P.l - 6} y={y(v) + 4} className="trendaxis" textAnchor="end">{fmt(v)}</text></g>)}
        {base != null && <line x1={P.l} x2={W - P.r} y1={y(base)} y2={y(base)} className="trendbase" />}
        <path d={d} className="trendline" />
        {points.map((p, i) => (
          <g key={i} onMouseEnter={() => setCur(i)} onFocus={() => setCur(i)} onBlur={() => setCur(-1)} tabIndex={0} aria-label={`${p.label}: ${fmt(p.v)}`}>
            <circle cx={x(i)} cy={y(p.v)} r={12} className="trendhit" />
            <circle cx={x(i)} cy={y(p.v)} r={cur === i ? 5 : 4} className={"trenddot" + (p.won ? " w" : "")} />
          </g>
        ))}
      </svg>
    </figure>
  );
}

/** ACS and rating, each on its own chart (two scales never share an axis). */
export default function Trend({ matches }) {
  const tr = useT();
  const list = [...matches].reverse(); // the page lists the latest first
  if (list.length < 2) return null;
  const label = (m) => tr("vs {team}", { team: m.opponent });
  const acs = list.filter((m) => m.acs != null).map((m) => ({ v: m.acs, label: label(m), won: m.won }));
  const r = list.filter((m) => m.r != null).map((m) => ({ v: m.r, label: label(m), won: m.won }));
  return (
    <div className="trends">
      {acs.length > 1 && <Line title={tr("ACS match after match")} points={acs} fmt={(v) => Math.round(v)} />}
      {r.length > 1 && <Line title={tr("Rating match after match")} points={r} fmt={(v) => Number(v).toFixed(2)} base={1} />}
    </div>
  );
}
