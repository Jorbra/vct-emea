"use client";

// Round 24: the radar of a player's percentiles (one player, or two face to face), the "Top X%" badges,
// and an agent's podium.
import { useT } from "./lang.jsx";
import { StatPodium } from "./Round23.jsx";

const fmtVal = (key, v) => (v == null ? "–" : key === "r" || key === "kd" || key === "fk" ? Number(v).toFixed(2) : key === "kast" ? `${v}%` : v);

/** The radar: each axis a stat, the distance its percentile; a second player drawn over in another color. */
export function Radar({ a, b = null, nameA = "", nameB = "", title }) {
  const tr = useT();
  if (!a || a.length < 3) return null;
  const axes = a.map((x) => x.key).filter((k) => !b || b.some((y) => y.key === k));
  if (axes.length < 3) return null;
  const S = 320, C = S / 2, R = 112;
  const at = (i, r) => {
    const ang = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    return [C + Math.cos(ang) * r, C + Math.sin(ang) * r];
  };
  const shape = (list) => axes.map((k, i) => at(i, (Math.max(4, (list.find((x) => x.key === k) || { pct: 0 }).pct) / 100) * R).join(",")).join(" ");
  const label = (k) => (a.find((x) => x.key === k) || {}).label || k;
  return (
    <section className="radar24">
      <h2>🕸️ {title || tr("Where they stand")} <small>{tr("Percentile among the players with 3 maps at least")}</small></h2>
      <div className="r24body">
        <svg viewBox={`0 0 ${S} ${S}`} className="r24svg" role="img" aria-label={tr("Radar of the stats")}>
          {[0.25, 0.5, 0.75, 1].map((f) => <polygon key={f} className="r24ring" points={axes.map((_, i) => at(i, R * f).join(",")).join(" ")} />)}
          {axes.map((_, i) => { const [x, y] = at(i, R); return <line key={i} className="r24axis" x1={C} y1={C} x2={x} y2={y} />; })}
          <polygon className="r24a" points={shape(a)} />
          {b && <polygon className="r24b" points={shape(b)} />}
          {axes.map((k, i) => { const [x, y] = at(i, R + 26); return <text key={k} x={x} y={y} className="r24lab" textAnchor="middle" dominantBaseline="middle">{label(k)}</text>; })}
        </svg>
        <ul className="r24list">
          {axes.map((k) => {
            const x = a.find((v) => v.key === k);
            const y = b ? b.find((v) => v.key === k) : null;
            return (
              <li key={k}>
                <span className="r24k">{label(k)}</span>
                <span className="r24v a"><b>{fmtVal(k, x.value)}</b><i style={{ width: `${x.pct}%` }} /><small>{tr("better than {p}%", { p: x.pct })}</small></span>
                {y && <span className="r24v b"><b>{fmtVal(k, y.value)}</b><i style={{ width: `${y.pct}%` }} /><small>{tr("better than {p}%", { p: y.pct })}</small></span>}
              </li>
            );
          })}
        </ul>
      </div>
      {b && <p className="r24legend"><span className="a">{nameA}</span><span className="b">{nameB}</span></p>}
    </section>
  );
}

/** "Top 3% ACS" chips, for the player's card. */
export function TopBadges({ list }) {
  const tr = useT();
  if (!list || !list.length) return null;
  return (
    <span className="topbadges">{list.map((x) => (
      <span key={x.key} className={"topbadge" + (x.top <= 3 ? " gold" : "")} title={tr("Among the players with 3 maps at least")}>{tr("Top {n}%", { n: x.top })} {x.label}</span>
    ))}</span>
  );
}

/** An agent's podium: the three best ratings on it. */
export function AgentPodium({ best, agent }) {
  const tr = useT();
  const list = (best || []).filter((p) => p.r != null).sort((x, y) => y.r - x.r).slice(0, 3).map((p) => ({ ...p, agents: [{ name: agent }] }));
  if (list.length < 3) return null;
  return (
    <section className="agpod24">
      <h2>🏆 {tr("The best on {agent}", { agent })}</h2>
      <StatPodium list={list} label="Rating" fmt={(p) => Number(p.r).toFixed(2)} />
    </section>
  );
}
