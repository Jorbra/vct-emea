"use client";

// The agents' icons and the maps' pictures, from valorant-api.com (Riot's game assets, which fan sites may show).
import RAW from "../lib/valorant-assets.json";
import LOCAL from "../lib/valorant-local.json";
import { withLocal } from "../lib/assetmerge.js";

/** The pictures as the pages show them: light copies from the site itself. */
export const VIEW = withLocal(RAW, LOCAL);
const ASSETS = VIEW;

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z]/g, "");
const cap = (s) => String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1);

export const agentInfo = (name) => ASSETS.agents[norm(name)] || null;
export const mapInfo = (name) => {
  const k = Object.keys(ASSETS.maps).find((m) => norm(m) === norm(name));
  return k ? ASSETS.maps[k] : null;
};

/** An agent's icon (its name in the tooltip), or its name when the icon is unknown. */
export function AgentIcon({ name, size = 22, label = false, link = false }) {
  const a = agentInfo(name);
  const shown = a ? a.name : cap(name);
  if (!a) return <span className="agtxt">{shown}</span>;
  const inner = <><img src={a.icon} alt={shown} width={size} height={size} loading="lazy" />{label && <span>{shown}</span>}</>;
  if (link) return <a className={"agicon" + (label ? " lbl" : "")} title={shown} href={`/agent/${norm(a.name)}`}>{inner}</a>;
  return <span className={"agicon" + (label ? " lbl" : "")} title={shown}>{inner}</span>;
}

/** Several agents in a row. */
export const AgentList = ({ list, size = 22, link = false }) => <span className="aglist">{(list || []).map((a, i) => <AgentIcon key={`${a}${i}`} name={typeof a === "string" ? a : a.name} size={size} link={link} />)}</span>;

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

/** A map's layout seen from above (minimap): its address, or "". */
export const mapMinimap = (map) => (mapInfo(map) || {}).icon || "";

/** A map's large picture, for a page header or a background: its address, or "". */
export const mapSplash = (map) => (mapInfo(map) || {}).splash || "";
export const mapList = (map) => (mapInfo(map) || {}).list || "";
