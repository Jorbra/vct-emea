"use client";

import { useT } from "./lang.jsx";
import { usePlayers } from "./players.js";

/** Follow a player: with alerts on, a message when they become free or sign somewhere. */
export default function FollowStar({ slug, small = false }) {
  const tr = useT();
  const players = usePlayers();
  const on = players.has(slug);
  const label = on ? tr("Stop following this player") : tr("Follow this player");
  return (
    <button type="button" className={"favstar" + (on ? " on" : "") + (small ? " small" : "")} aria-pressed={on} title={label} aria-label={label} onClick={() => players.toggle(slug)}>
      {on ? "★" : "☆"}
    </button>
  );
}
