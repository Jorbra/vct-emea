"use client";

// Round 16: a player's agents as portrait tiles, the compare page's two heads, and for the editors today's pictures.
import { useState } from "react";
import { useT } from "./lang.jsx";
import { agentInfo } from "./Assets.jsx";
import { allMatches } from "../lib/matchlist.js";
import { EVENT_NAMES } from "../lib/paths.js";

/** A player's most played agents as tiles with each portrait. */
export function AgentMastery({ agents }) {
  const tr = useT();
  const list = (agents || []).slice(0, 4).map((a) => ({ ...a, info: agentInfo(a.name) })).filter((a) => a.info);
  if (list.length < 1) return null;
  const total = (agents || []).reduce((s, a) => s + a.n, 0) || 1;
  return (
    <div className="mastery" aria-label={tr("Agents played")}>
      {list.map((a) => (
        <a key={a.name} href={`/agent/${a.name.toLowerCase().replace(/[^a-z]/g, "")}`} className="mtile" style={{ "--agc": a.info.color, "--agimg": `url(${a.info.portrait})` }}>
          <b>{a.info.name}</b>
          <small>{a.n} {tr("maps")} · {Math.round((a.n / total) * 100)}%</small>
        </a>
      ))}
    </div>
  );
}

/** The compare page's top: each player with their main agent behind, face to face. */
export function CompareHeads({ a, b }) {
  const head = (p, side) => {
    const ag = p.season && p.season.agent ? agentInfo(p.season.agent) : null;
    return (
      <a href={p.href} className={"cmphead " + side} style={ag ? { "--agc": ag.color, "--agimg": `url(${ag.portrait})` } : undefined}>
        <b>{p.name}</b>
        <small>{p.team || ""}{ag ? ` · ${ag.name}` : ""}</small>
      </a>
    );
  };
  return <div className="cmpheads">{head(a, "l")}<span className="cmpvs">VS</span>{head(b, "r")}</div>;
}

// ---- for the editors

/** Today's finished matches with their pictures to post: the 1200×630 one and the 9:16 story. */
export function SharePictures({ initial, now }) {
  const tr = useT();
  const [open, setOpen] = useState(false);
  if (now == null) return null;
  const day = new Date(now).toDateString();
  const list = allMatches(initial).filter((m) => m.sa != null && m.at && new Date(m.at).toDateString() === day && m.a && m.b).slice(0, 20);
  if (!list.length) return null;
  return (
    <details className="einfo" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary><b>🖼️ {tr("Today's pictures to post")}</b> <small>({list.length})</small></summary>
      <ul className="sharepics">{list.map((m) => (
        <li key={m.event + m.id}>
          <span>{m.a.name} {m.sa}–{m.sb} {m.b.name} <small>{tr(EVENT_NAMES[m.event] || m.event)}</small></span>
          <a className="btn small" href={`/api/og/${m.event}/${m.id}`} target="_blank" rel="noopener noreferrer">1200×630</a>
          <a className="btn small" href={`/api/og/story/${m.event}/${m.id}`} target="_blank" rel="noopener noreferrer">Story 9:16</a>
        </li>
      ))}</ul>
    </details>
  );
}
