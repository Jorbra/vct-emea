"use client";

import { useEffect, useRef, useState } from "react";

// A tag can be up to 7 letters (used for the logo file name); the small badge only has room for 3.
export const DEFAULT_LOGO = "/brand/default-team.png";
// The site's own logo files go through Next's image resizer (lib/maj40.js crestSrc); any other address is shown as it is.
import { OWN_LOGO as OWN, crestSrc } from "../lib/maj40.js";
export { crestSrc };

const initialsOf = (t) => (t && t.name && (t.tag || t.name.slice(0, 2).toUpperCase()).slice(0, 3)) || "?";

export function Crest({ team }) {
  const logo = team && team.name ? team.logo : "";
  const [broken, setBroken] = useState(false);
  // the resized copy failed: the file itself, then the default logo
  const [plain, setPlain] = useState(false);
  const fail = () => { if (!plain && OWN.test(String(logo || ""))) setPlain(true); else setBroken(true); };
  const ref = useRef(null);
  useEffect(() => { setBroken(false); setPlain(false); }, [logo]);
  // The server-rendered <img> can fail before React is attached, so onError never fires: check once mounted.
  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0) fail();
  }, [logo]);
  if (logo && !broken) {
    return (
      <div className="crest logo">
        <img ref={ref} {...(plain ? { src: logo } : crestSrc(logo))} alt="" loading="lazy" decoding="async" onError={fail} />
      </div>
    );
  }
  if (!team || !team.name) return <div className="crest open">?</div>;
  // No logo (or a broken one): the site's default logo, the team's initials for screen readers
  return (
    <div className="crest logo deflogo" title={team.name}>
      <img src={DEFAULT_LOGO} alt={initialsOf(team)} loading="lazy" decoding="async" />
    </div>
  );
}
