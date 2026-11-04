"use client";

import { useEffect, useRef, useState } from "react";

// A tag can be up to 7 letters (used for the logo file name); the small badge only has room for 3.
const initialsOf = (t) => (t && t.name && (t.tag || t.name.slice(0, 2).toUpperCase()).slice(0, 3)) || "?";

export function Crest({ team }) {
  const logo = team && team.name ? team.logo : "";
  const [broken, setBroken] = useState(false);
  const ref = useRef(null);
  useEffect(() => setBroken(false), [logo]);
  // The server-rendered <img> can fail before React is attached, so onError never fires: check once mounted.
  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0) setBroken(true);
  }, [logo]);
  if (logo && !broken) {
    return (
      <div className="crest logo">
        <img ref={ref} src={logo} alt="" loading="lazy" onError={() => setBroken(true)} />
      </div>
    );
  }
  if (!team || !team.name) return <div className="crest open">?</div>;
  // No logo set: a badge whose colour comes from the team name, so every team looks distinct without any setup.
  let h = 0;
  for (const ch of team.name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return (
    <div className="crest gen" style={{ "--h": h }}>
      {initialsOf(team)}
    </div>
  );
}
