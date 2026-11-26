"use client";

// A team's next match under its header: live with the score, else the next one with a countdown.
import { useEffect, useState } from "react";
import { useClock } from "./clock.js";
import { useT } from "./lang.jsx";
import { Crest } from "./Crest.jsx";
import { EVENT_NAMES } from "../lib/paths.js";

const left = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d ? `${d} j ${h} h` : h ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min ${String(s % 60).padStart(2, "0")}`;
};

export function NextMatchBanner({ rows, name, live }) {
  const tr = useT();
  const now = useClock(1000); // the page's one clock (components/clock.js), paused while the tab is hidden
  if (now == null) return null;
  const playing = rows.find((m) => m.live);
  const next = playing || rows.filter((m) => m.sa == null && m.at && new Date(m.at).getTime() > now && m.a && m.b && m.a.name && m.b.name).sort((x, y) => x.at.localeCompare(y.at))[0];
  if (!next) return null;
  const other = next.a && next.a.name === name ? next.b : next.a;
  const score = playing ? (live[next.event] || {})[next.id] : null;
  return (
    <a className={"nextban" + (playing ? " live" : "")} href={`/match/${next.event}/${next.id}`}>
      <span className="nbstate">{playing ? <><i className="ssdot inline" /> {tr("LIVE")}</> : tr("Next match")}</span>
      <span className="nbvs">{tr("vs")} <Crest team={other} /><b>{(other && other.name) || tr("TBD")}</b></span>
      <span className="nbwhen">{playing ? (score ? `${score.a ?? 0} – ${score.b ?? 0}` : tr("Live")) : left(new Date(next.at).getTime() - now)}</span>
      <small>{tr(EVENT_NAMES[next.event] || next.event)} ›</small>
    </a>
  );
}
