"use client";

// Round 15: sorting chips, the roles' share of the picks, the MVP's card, the footer's band of agents.
import { useT } from "./lang.jsx";
import { VIEW as ASSETS } from "./Assets.jsx";
import { agentInfo } from "./Assets.jsx";

const ROLE_COLORS = { Duelist: "#ff5c7a", Initiator: "#ffb347", Controller: "#7d8cff", Sentinel: "#5cd6aa" };

/** A small "sort by" choice. */
export function SortPick({ value, onChange, items }) {
  const tr = useT();
  return (
    <label className="sortpick">
      <span>{tr("Sort")}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>{items.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
    </label>
  );
}

/** How the picks split between the four roles, as one bar. */
export function RoleShare({ list }) {
  const tr = useT();
  const by = {};
  for (const a of list) if (a.role) by[a.role] = (by[a.role] || 0) + a.picks;
  const total = Object.values(by).reduce((s, x) => s + x, 0);
  if (!total) return null;
  const rows = Object.entries(by).sort((x, y) => y[1] - x[1]).map(([role, n]) => ({ role, pct: Math.round((n / total) * 100) }));
  return (
    <div className="roleshare" aria-label={tr("Picks by role")}>
      <div className="rsbar">{rows.map((r) => <i key={r.role} style={{ width: `${r.pct}%`, background: ROLE_COLORS[r.role] || "var(--lime)" }} title={`${tr(r.role)} ${r.pct}%`} />)}</div>
      <div className="rslegend">{rows.map((r) => <span key={r.role}><i style={{ background: ROLE_COLORS[r.role] || "var(--lime)" }} />{tr(r.role)} <b>{r.pct}%</b></span>)}</div>
    </div>
  );
}

/** The match's MVP (best ACS) as a card, their main agent behind. */
export function MvpCard({ r, who }) {
  const tr = useT();
  const ag = r.agents && r.agents[0] ? agentInfo(r.agents[0]) : null;
  return (
    <div className="mvpcard" data-part="summary stats" style={ag ? { "--agc": ag.color, "--agimg": `url(${ag.portrait})` } : undefined}>
      <small>MVP</small>
      <b>{who(r.name)}</b>
      <div className="mvpnums">
        <span><b>{r.acs}</b> ACS</span>
        {r.r != null && <span><b>{Number(r.r).toFixed(2)}</b> R</span>}
        {r.k != null && <span><b>{r.k}/{r.d}/{r.a}</b> K/D/A</span>}
      </div>
      {ag && <em>{ag.name}</em>}
      <p className="hint">{tr("best ACS: {acs}", { acs: r.acs })}</p>
    </div>
  );
}

/** The footer's band: every agent's icon, each leading to its page. */
export function FootAgents() {
  const list = Object.entries(ASSETS.agents).filter(([, a]) => a.icon);
  return <div className="footagents" aria-hidden="true">{list.map(([k, a]) => <a key={k} href={`/agent/${k}`} tabIndex={-1} style={{ "--agc": a.color }}><img src={a.icon} alt="" width="30" height="30" loading="lazy" /></a>)}</div>;
}
