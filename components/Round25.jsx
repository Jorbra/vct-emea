"use client";

// Round 25: the players with the closest profile, and the stats page's cloud (ACS against rating).
import { useMemo, useState } from "react";
import { useT } from "./lang.jsx";
import { agentInfo } from "./Assets.jsx";

/** Cards of the players whose radar looks the most like this one's. */
export function SimilarPlayers({ list }) {
  const tr = useT();
  if (!list || !list.length) return null;
  return (
    <section className="similar25">
      <h2>🧬 {tr("Similar players")} <small>{tr("The closest profiles on the radar")}</small></h2>
      <div className="sim25row">{list.map((p) => {
        const ag = agentInfo(p.agent);
        return (
          <a key={p.slug} href={`/player/${p.slug}`} className="sim25" style={ag ? { "--agc": ag.color || "var(--lime)" } : undefined}>
            {ag && ag.icon && <img src={ag.icon} alt="" width="40" height="40" loading="lazy" />}
            <span className="sim25name"><b>{p.name}</b><small>{p.team}</small></span>
            <span className="sim25match" title={tr("How close the two profiles are")}>
              <svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" className="bg" /><circle cx="18" cy="18" r="15" className="fg" style={{ strokeDasharray: `${(p.match / 100) * 94.2} 94.2` }} /></svg>
              <b>{p.match}%</b>
            </span>
            <span className="sim25nums">{p.r != null ? Number(p.r).toFixed(2) : "–"} R · {p.acs ?? "–"} ACS</span>
          </a>
        );
      })}</div>
    </section>
  );
}

const TWO = ["r", "kd", "fk"];
const show = (k, v) => (v == null ? "–" : TWO.includes(k) ? Number(v).toFixed(2) : ["kast", "hs", "win", "rounds"].includes(k) ? `${v}%` : v);

/**
 * A cloud of dots: one stat across, another up (both chosen from `fields`), the best named, each dot a link.
 * rows: players or teams; fields: [[key, label]]; hrefOf(row) gives its page.
 */
export function StatCloud({ rows, fields = [["acs", "ACS"], ["r", "Rating"], ["kd", "K/D"], ["kast", "KAST"], ["adr", "ADR"], ["hs", "HS%"], ["fk", "FK"]], x: x0key = "acs", y: y0key = "r", hrefOf = (p) => (p.slug ? `/player/${p.slug}` : undefined), title, note }) {
  const tr = useT();
  const [hover, setHover] = useState(null);
  const [xk, setXk] = useState(x0key);
  const [yk, setYk] = useState(y0key);
  const pts = useMemo(() => (rows || []).filter((p) => p[xk] != null && p[yk] != null), [rows, xk, yk]);
  if (pts.length < 8) return null;
  const W = 640, H = 360, P = 40;
  const xs = pts.map((p) => p[xk]), ys = pts.map((p) => p[yk]);
  const padX = (Math.max(...xs) - Math.min(...xs)) * 0.04 || 1, padY = (Math.max(...ys) - Math.min(...ys)) * 0.06 || 0.05;
  const xa = Math.min(...xs) - padX, xb = Math.max(...xs) + padX, ya = Math.min(...ys) - padY, yb = Math.max(...ys) + padY;
  const X = (v) => P + ((v - xa) / (xb - xa)) * (W - P * 1.5);
  const Y = (v) => H - P - ((v - ya) / (yb - ya)) * (H - P * 1.6);
  const avgX = xs.reduce((s, v) => s + v, 0) / xs.length, avgY = ys.reduce((s, v) => s + v, 0) / ys.length;
  // the best on both: the furthest towards the top right
  const both = (p) => (p[xk] - xa) / (xb - xa) + (p[yk] - ya) / (yb - ya);
  const named = new Set([...pts].sort((a, b) => both(b) - both(a)).slice(0, 6).map((p) => p.slug || p.name));
  const tick = (k, v) => (TWO.includes(k) ? v.toFixed(2) : Math.round(v));
  const fx = [0, 0.25, 0.5, 0.75, 1].map((f) => xa + f * (xb - xa));
  const fy = [0, 0.25, 0.5, 0.75, 1].map((f) => ya + f * (yb - ya));
  const lab = (k) => (fields.find(([f]) => f === k) || [k, k])[1];
  return (
    <figure className="cloud25">
      <figcaption>
        {title || tr("ACS and rating of every player")} <small>{note || tr("Top right: the ones who do both")}</small>
        {fields.length > 2 && (
          <span className="c25pick">
            <label>↔ <select value={xk} onChange={(e) => setXk(e.target.value)} aria-label={tr("Across")}>{fields.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label>↕ <select value={yk} onChange={(e) => setYk(e.target.value)} aria-label={tr("Up")}>{fields.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          </span>
        )}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${lab(xk)} / ${lab(yk)}`}>
        {fx.map((v, i) => <g key={"x" + i}><line className="c25grid" x1={X(v)} x2={X(v)} y1={P * 0.6} y2={H - P} /><text className="c25tick" x={X(v)} y={H - P + 16} textAnchor="middle">{tick(xk, v)}</text></g>)}
        {fy.map((v, i) => <g key={"y" + i}><line className="c25grid" x1={P} x2={W - P / 2} y1={Y(v)} y2={Y(v)} /><text className="c25tick" x={P - 6} y={Y(v) + 4} textAnchor="end">{tick(yk, v)}</text></g>)}
        <line className="c25avg" x1={X(avgX)} x2={X(avgX)} y1={P * 0.6} y2={H - P} />
        <line className="c25avg" x1={P} x2={W - P / 2} y1={Y(avgY)} y2={Y(avgY)} />
        <text className="c25axis" x={W - P / 2} y={H - 6} textAnchor="end">{lab(xk)} →</text>
        <text className="c25axis" x={8} y={14}>↑ {lab(yk)}</text>
        {pts.map((p) => {
          const k = p.slug || p.name;
          const top = named.has(k);
          const ag = p.agents && p.agents[0] ? agentInfo(p.agents[0].name) : null;
          return (
            <a key={k} href={hrefOf(p)} onMouseEnter={() => setHover(p)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(p)} onBlur={() => setHover(null)}>
              <circle cx={X(p[xk])} cy={Y(p[yk])} r={top ? 6 : 4} className={"c25dot" + (top ? " top" : "")} style={ag ? { "--agc": ag.color } : undefined}><title>{`${p.name}${p.team ? ` (${p.team})` : ""} · ${lab(xk)} ${show(xk, p[xk])} · ${lab(yk)} ${show(yk, p[yk])}`}</title></circle>
              {top && <text className="c25name" x={X(p[xk]) + 8} y={Y(p[yk]) - 6}>{p.name}</text>}
            </a>
          );
        })}
        {hover && <g className="c25tip" transform={`translate(${Math.min(X(hover[xk]) + 10, W - 180)}, ${Math.max(Y(hover[yk]) - 44, 6)})`}><rect width="170" height="38" rx="6" /><text x="8" y="16" className="t1">{hover.name}</text><text x="8" y="31" className="t2">{`${lab(xk)} ${show(xk, hover[xk])} · ${lab(yk)} ${show(yk, hover[yk])}${hover.maps ? ` · ${hover.maps} maps` : ""}`}</text></g>}
      </svg>
    </figure>
  );
}
