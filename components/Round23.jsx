"use client";

// Round 23: the stats page's podium, the three best players drawn with their main agent.
import { useT } from "./lang.jsx";
import { agentInfo } from "./Assets.jsx";
import { RollNum } from "./Round22.jsx";

/** The top three for the chosen stat, second · first · third, each over their most played agent. */
export function StatPodium({ list, label, fmt }) {
  const tr = useT();
  if (!list || list.length < 3) return null;
  const order = [list[1], list[0], list[2]];
  const place = [2, 1, 3];
  return (
    <div className="podium23" role="list" aria-label={tr("Podium")}>
      {order.map((p, k) => {
        const ag = p.agents && p.agents[0] ? agentInfo(p.agents[0].name) : null;
        return (
          <a key={p.slug || p.name} role="listitem" href={p.slug ? `/player/${p.slug}` : undefined} className={"pod23 p" + place[k]} style={ag ? { "--agc": ag.color || "var(--lime)" } : undefined}>
            {ag && ag.portrait && <img className="pod23art" src={ag.portrait} alt="" loading="lazy" decoding="async" />}
            <span className="pod23rank">{["🥈", "🥇", "🥉"][k]}</span>
            <span className="pod23info">
              <b>{p.name}</b>
              <small>{p.team}{ag ? ` · ${ag.name}` : ""}</small>
              <strong><RollNum text={fmt(p)} /> <em>{label}</em></strong>
            </span>
            <span className="pod23step" aria-hidden="true">{place[k]}</span>
          </a>
        );
      })}
    </div>
  );
}

/** The home page's podium: the season's three best ratings (6 maps at least). */
export function HomePodium({ list }) {
  const tr = useT();
  if (!list || list.length < 3) return null;
  return (
    <section className="homepod23">
      <h2>🏆 {tr("The season's best")} <small>{tr("Rating, 6 maps at least")}</small> <a className="more" href="/stats">{tr("All the stats")} ›</a></h2>
      <StatPodium list={list} label="Rating" fmt={(p) => Number(p.r).toFixed(2)} />
    </section>
  );
}
