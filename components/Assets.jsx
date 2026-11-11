"use client";

// The agents' icons and the maps' pictures, from valorant-api.com (Riot's game assets, which fan sites may show).
import ASSETS from "../lib/valorant-assets.json";

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z]/g, "");
const cap = (s) => String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1);

export const agentInfo = (name) => ASSETS.agents[norm(name)] || null;
export const mapInfo = (name) => {
  const k = Object.keys(ASSETS.maps).find((m) => norm(m) === norm(name));
  return k ? ASSETS.maps[k] : null;
};

/** An agent's icon (its name in the tooltip), or its name when the icon is unknown. */
export function AgentIcon({ name, size = 22, label = false }) {
  const a = agentInfo(name);
  const shown = a ? a.name : cap(name);
  if (!a) return <span className="agtxt">{shown}</span>;
  return (
    <span className={"agicon" + (label ? " lbl" : "")} title={shown}>
      <img src={a.icon} alt={shown} width={size} height={size} loading="lazy" />
      {label && <span>{shown}</span>}
    </span>
  );
}

/** Several agents in a row. */
export const AgentList = ({ list, size = 22 }) => <span className="aglist">{(list || []).map((a, i) => <AgentIcon key={`${a}${i}`} name={typeof a === "string" ? a : a.name} size={size} />)}</span>;

/** A map's small picture with its name. */
export function MapThumb({ map, children = null }) {
  const m = mapInfo(map);
  return (
    <span className="mapthumb">
      {m && <img src={m.list} alt="" loading="lazy" />}
      <b>{map}</b>{children}
    </span>
  );
}

/** A map's large picture, for a page header or a background: its address, or "". */
export const mapSplash = (map) => (mapInfo(map) || {}).splash || "";
export const mapList = (map) => (mapInfo(map) || {}).list || "";
