"use client";
// Small pieces of the site's look: a team's color read from its logo, a score that pulses when it changes, loading skeletons.
import { useEffect, useRef, useState } from "react";
import { useT as useT2 } from "./lang.jsx";

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
        // the colored pixels by hue, in 12 families: the logo's color is the biggest family's, not a mix of them all
        // (a mix of red, blue and yellow would give brown)
        const fam = Array.from({ length: 12 }, () => ({ r: 0, g: 0, b: 0, n: 0 }));
        for (let i = 0; i < d.length; i += 4) {
          const [R, G, B, A] = [d[i], d[i + 1], d[i + 2], d[i + 3]];
          if (A < 200) continue;
          const max = Math.max(R, G, B);
          const min = Math.min(R, G, B);
          // leave out white, black and grays: they say nothing of the team
          if (max - min < 40 || max < 50 || min > 225) continue;
          const c = max - min;
          let h = max === R ? ((G - B) / c) % 6 : max === G ? (B - R) / c + 2 : (R - G) / c + 4;
          h = (h * 60 + 360) % 360;
          const f = fam[Math.floor(h / 30) % 12];
          f.r += R; f.g += G; f.b += B; f.n++;
        }
        const top = fam.reduce((x, y) => (y.n > x.n ? y : x));
        resolve(top.n >= 10 ? `rgb(${Math.round(top.r / top.n)}, ${Math.round(top.g / top.n)}, ${Math.round(top.b / top.n)})` : "");
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
    if (!src) { setColor(""); return undefined; }
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

/** How many matches are live now, read every minute (shared by the menu and the phone's bar). */
export function useLiveCount() {
  const [n, setN] = useState(0);
  useEffect(() => {
    let on = true;
    const load = () => fetch("/api/now").then((r) => (r.ok ? r.json() : null)).then((j) => { if (on && j) setN(j.items.filter((a) => a.kind === "live").length); }).catch(() => { /* offline */ });
    load();
    const t = setInterval(load, 60000);
    return () => { on = false; clearInterval(t); };
  }, []);
  return n;
}

/** A match that ends while the page is open: a banner for a few seconds ("Barça wins 2–1"). Only what ends after the page opened. */
export function ResultToast() {
  const tr = useT2();
  const [shown, setShown] = useState([]);
  const known = useRef(null);
  useEffect(() => {
    let on = true;
    const load = () => fetch("/api/now").then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!on || !j) return;
      const results = j.items.filter((a) => a.kind === "result");
      if (known.current === null) { known.current = new Set(results.map((a) => a.key)); return; }
      const fresh = results.filter((a) => !known.current.has(a.key));
      fresh.forEach((a) => known.current.add(a.key));
      if (!fresh.length) return;
      setShown((s) => [...s, ...fresh.slice(0, 3)].slice(-3));
      setTimeout(() => setShown((s) => s.filter((x) => !fresh.includes(x))), 7000);
    }).catch(() => { /* offline */ });
    load();
    const t = setInterval(load, 30000);
    return () => { on = false; clearInterval(t); };
  }, []);
  if (!shown.length) return null;
  return (
    <div className="rtoasts" role="status" aria-live="polite">
      {shown.map((a) => {
        const winner = a.sa > a.sb ? a.a : a.b;
        return (
          <a key={a.key} className="rtoast" href={a.url}>
            <span className="rtk">{tr("Match over")}</span>
            <b>{a.note && a.note.kind === "ff" ? tr("{team} wins by forfeit", { team: winner }) : tr("{team} wins {a}–{b}", { team: winner, a: Math.max(a.sa, a.sb), b: Math.min(a.sa, a.sb) })}</b>
            <small>{a.a} vs {a.b}</small>
          </a>
        );
      })}
    </div>
  );
}

const THEME_KEY = "vct-team-theme";
const readTheme = () => { try { return JSON.parse(localStorage.getItem(THEME_KEY) || "null"); } catch { return null; } };

/** The site in the colors of the visitor's team, when chosen on its page. */
export function TeamTheme() {
  const [team, setTeam] = useState(null);
  useEffect(() => {
    const sync = () => setTeam(readTheme());
    sync();
    window.addEventListener("vct-team-theme", sync);
    return () => window.removeEventListener("vct-team-theme", sync);
  }, []);
  const color = useTeamColor(team && team.logo);
  useEffect(() => {
    const root = document.documentElement.style;
    if (!color) { root.removeProperty("--lime"); root.removeProperty("--lime-ink"); return; }
    const [r, g, b] = (color.match(/\d+/g) || [0, 0, 0]).map(Number);
    // too dark a color is lifted a little, so that it stays seen on the dark background
    const lift = (v) => Math.min(255, Math.round(v + (255 - v) * 0.25));
    const c = (r + g + b) / 3 < 90 ? `rgb(${lift(r)}, ${lift(g)}, ${lift(b)})` : color;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    root.setProperty("--lime", c);
    root.setProperty("--lime-ink", lum > 0.55 ? "#111" : "#fff");
  }, [color]);
  return null;
}

/** On a team's page: use its colors for the whole site, or go back to the site's own. */
export function TeamThemeButton({ team }) {
  const tr = useT2();
  const [on, setOn] = useState(false);
  useEffect(() => { const t = readTheme(); setOn(!!t && t.name === team.name); }, [team.name]);
  if (!team || !team.logo || !team.logo.startsWith("/")) return null;
  const toggle = () => {
    try {
      if (on) localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, JSON.stringify({ name: team.name, logo: team.logo }));
    } catch { /* not remembered */ }
    setOn(!on);
    window.dispatchEvent(new Event("vct-team-theme"));
  };
  return <button type="button" className="btn" aria-pressed={on} onClick={toggle}>🎨 {on ? tr("Back to the site's colors") : tr("Site in this team's colors")}</button>;
}

/** A small map of a big bracket: where the view is; a click moves it there. */
export function MiniMap({ boxRef }) {
  const [v, setV] = useState({ x: 0, y: 0, w: 1, h: 1, show: false });
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const upd = () => setV({ x: el.scrollLeft / el.scrollWidth, y: el.scrollTop / el.scrollHeight, w: el.clientWidth / el.scrollWidth, h: el.clientHeight / el.scrollHeight, show: el.scrollWidth > el.clientWidth * 1.3 || el.scrollHeight > el.clientHeight * 1.3 });
    upd();
    el.addEventListener("scroll", upd, { passive: true });
    const ro = window.ResizeObserver ? new ResizeObserver(upd) : null;
    if (ro) ro.observe(el);
    return () => { el.removeEventListener("scroll", upd); if (ro) ro.disconnect(); };
  }, [boxRef]);
  if (!v.show) return null;
  const go = (e) => {
    const el = boxRef.current;
    const r = e.currentTarget.getBoundingClientRect();
    el.scrollTo({ left: ((e.clientX - r.left) / r.width) * el.scrollWidth - el.clientWidth / 2, top: ((e.clientY - r.top) / r.height) * el.scrollHeight - el.clientHeight / 2, behavior: "smooth" });
  };
  return (
    <div className="qmini" onClick={go} role="presentation">
      <i style={{ left: `${v.x * 100}%`, top: `${v.y * 100}%`, width: `${Math.max(4, v.w * 100)}%`, height: `${Math.max(4, v.h * 100)}%` }} />
    </div>
  );
}
