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

/** Every player as a dot: ACS across, rating up; the best ones named, a search lights one up. */
export function StatCloud({ rows }) {
  const tr = useT();
  const [hover, setHover] = useState(null);
  const pts = useMemo(() => (rows || []).filter((p) => p.r != null && p.acs != null), [rows]);
  if (pts.length < 8) return null;
  const W = 640, H = 360, P = 40;
  const xs = pts.map((p) => p.acs), ys = pts.map((p) => p.r);
  const x0 = Math.min(...xs) - 5, x1 = Math.max(...xs) + 5, y0 = Math.min(...ys) - 0.05, y1 = Math.max(...ys) + 0.05;
  const X = (v) => P + ((v - x0) / (x1 - x0)) * (W - P * 1.5);
  const Y = (v) => H - P - ((v - y0) / (y1 - y0)) * (H - P * 1.6);
  const avgX = xs.reduce((s, v) => s + v, 0) / xs.length, avgY = ys.reduce((s, v) => s + v, 0) / ys.length;
  const named = new Set([...pts].sort((a, b) => b.r - a.r).slice(0, 6).map((p) => p.slug || p.name));
  const ticksX = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(x0 + f * (x1 - x0)));
  const ticksY = [0, 0.25, 0.5, 0.75, 1].map((f) => y0 + f * (y1 - y0));
  return (
    <figure className="cloud25">
      <figcaption>{tr("ACS and rating of every player")} <small>{tr("Top right: the ones who do both")}</small></figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={tr("ACS and rating of every player")}>
        {ticksX.map((v) => <g key={"x" + v}><line className="c25grid" x1={X(v)} x2={X(v)} y1={P * 0.6} y2={H - P} /><text className="c25tick" x={X(v)} y={H - P + 16} textAnchor="middle">{v}</text></g>)}
        {ticksY.map((v) => <g key={"y" + v}><line className="c25grid" x1={P} x2={W - P / 2} y1={Y(v)} y2={Y(v)} /><text className="c25tick" x={P - 6} y={Y(v) + 4} textAnchor="end">{v.toFixed(2)}</text></g>)}
        <line className="c25avg" x1={X(avgX)} x2={X(avgX)} y1={P * 0.6} y2={H - P} />
        <line className="c25avg" x1={P} x2={W - P / 2} y1={Y(avgY)} y2={Y(avgY)} />
        <text className="c25axis" x={W - P / 2} y={H - 6} textAnchor="end">ACS →</text>
        <text className="c25axis" x={8} y={14}>↑ Rating</text>
        {pts.map((p) => {
          const k = p.slug || p.name;
          const top = named.has(k);
          const ag = p.agents && p.agents[0] ? agentInfo(p.agents[0].name) : null;
          return (
            <a key={k} href={p.slug ? `/player/${p.slug}` : undefined} onMouseEnter={() => setHover(p)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(p)} onBlur={() => setHover(null)}>
              <circle cx={X(p.acs)} cy={Y(p.r)} r={top ? 6 : 4} className={"c25dot" + (top ? " top" : "")} style={ag ? { "--agc": ag.color } : undefined}><title>{`${p.name} (${p.team}) · ${Number(p.r).toFixed(2)} · ${p.acs} ACS`}</title></circle>
              {top && <text className="c25name" x={X(p.acs) + 8} y={Y(p.r) - 6}>{p.name}</text>}
            </a>
          );
        })}
        {hover && <g className="c25tip" transform={`translate(${Math.min(X(hover.acs) + 10, W - 170)}, ${Math.max(Y(hover.r) - 44, 6)})`}><rect width="160" height="38" rx="6" /><text x="8" y="16" className="t1">{hover.name}</text><text x="8" y="31" className="t2">{`${Number(hover.r).toFixed(2)} R · ${hover.acs} ACS · ${hover.maps} maps`}</text></g>}
      </svg>
    </figure>
  );
}
