"use client";
// Small pieces of the site's look: a team's color read from its logo, a score that pulses when it changes, loading skeletons.
import { useEffect, useRef, useState } from "react";

const colors = new Map(); // logo address → color, for the whole visit

/** The main color of a logo: the average of its strong-colored pixels. "" for an outside image the browser cannot read, or a gray logo. */
function readColor(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = 24;
        c.height = 24;
        const g = c.getContext("2d", { willReadFrequently: true });
        g.drawImage(img, 0, 0, 24, 24);
        const d = g.getImageData(0, 0, 24, 24).data;
        let r = 0, gr = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) {
          const [R, G, B, A] = [d[i], d[i + 1], d[i + 2], d[i + 3]];
          if (A < 200) continue;
          const max = Math.max(R, G, B);
          const min = Math.min(R, G, B);
          // leave out white, black and grays: they say nothing of the team
          if (max - min < 40 || max < 50 || min > 225) continue;
          r += R; gr += G; b += B; n++;
        }
        resolve(n >= 12 ? `rgb(${Math.round(r / n)}, ${Math.round(gr / n)}, ${Math.round(b / n)})` : "");
      } catch {
        resolve("");
      }
    };
    img.onerror = () => resolve("");
    img.src = src;
  });
}

/** A team's color from its logo, once known (only the site's own logos can be read). */
export function useTeamColor(logo) {
  const src = logo && logo.startsWith("/") ? logo : "";
  const [color, setColor] = useState(src ? colors.get(src) || "" : "");
  useEffect(() => {
    if (!src) return undefined;
    if (colors.has(src)) { setColor(colors.get(src)); return undefined; }
    let on = true;
    readColor(src).then((c) => { colors.set(src, c); if (on) setColor(c); });
    return () => { on = false; };
  }, [src]);
  return color;
}

/** A thin bar in the team's color, beside its name on a match card. */
export function TeamTick({ team }) {
  const color = useTeamColor(team && team.logo);
  return <span className="teamtick" style={color ? { background: color } : undefined} aria-hidden="true" />;
}

/** A score that pulses once when it changes (not when the page opens). */
export function Score({ value, className = "" }) {
  const prev = useRef(value);
  const [bump, setBump] = useState(false);
  useEffect(() => {
    if (prev.current !== value && prev.current !== undefined) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 900);
      prev.current = value;
      return () => clearTimeout(t);
    }
    prev.current = value;
    return undefined;
  }, [value]);
  return <span className={className + (bump ? " bump" : "")}>{value}</span>;
}

/** Gray animated lines while something loads. */
export function Skeleton({ lines = 3, height = 14 }) {
  return (
    <div className="skelbox" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => <span key={i} className="skel" style={{ height, width: `${[92, 78, 85, 64, 88][i % 5]}%` }} />)}
    </div>
  );
}
