"use client";
// Small pieces of the site's look: a team's color read from its logo, a score that pulses when it changes, loading skeletons.
import { useEffect, useRef, useState } from "react";
import { useT as useT2 } from "./lang.jsx";
import { knownPalette, loadPalette, readableLogo, themeColors } from "./teamcolors.js";
import { pushAccount } from "./account.js";

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

/** A team's color from its logo, once known (the site's own logos and Toornament's). */
export function useTeamColor(logo) {
  const p = useTeamPalette(logo);
  return p ? `rgb(${p.primary.join(", ")})` : "";
}

/** A team's palette from its logo: { primary, secondary } or null. */
export function useTeamPalette(logo) {
  const [p, setP] = useState(() => knownPalette(logo) || null);
  useEffect(() => {
    let on = true;
    if (!readableLogo(logo)) { setP(null); return undefined; }
    loadPalette(logo).then((x) => { if (on) setP(x); });
    return () => { on = false; };
  }, [logo]);
  return p;
}
void readColor; void colors;

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
      if (!fresh.length || document.documentElement.dataset.nospoil === "1") return; // no spoilers: no result toast, no confetti
      setShown((s) => [...s, ...fresh.slice(0, 3)].slice(-3));
      // a favorite team won: a little confetti
      let favs = [];
      try { favs = JSON.parse(localStorage.getItem("vct-favorites") || "[]"); } catch { /* none */ }
      const slug = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (fresh.some((a) => favs.includes(slug(a.sa > a.sb ? a.a : a.b)))) confetti();
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

export const THEME_KEY = "vct-team-theme";
export const readTheme = () => { try { const t = JSON.parse(localStorage.getItem(THEME_KEY) || "null"); return t && t.name ? t : null; } catch { return null; } };

/** Chooses (or leaves, with null) the team whose colors the site wears; kept on this device and in the account. */
export function setTeamTheme(team) {
  const value = team ? { name: team.name, logo: team.logo || "" } : null;
  try { if (value) localStorage.setItem(THEME_KEY, JSON.stringify(value)); else localStorage.removeItem(THEME_KEY); } catch { /* not remembered */ }
  pushAccount({ prefs: { teamTheme: value } });
  window.dispatchEvent(new Event("vct-team-theme"));
}

/** The site in the colors of the visitor's team: accent, bands, a stripe at the top; readable in dark and light mode. */
export function TeamTheme() {
  const [team, setTeam] = useState(null);
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const sync = () => setTeam(readTheme());
    sync();
    window.addEventListener("vct-team-theme", sync);
    window.addEventListener("storage", sync);
    // light or dark: the switch writes data-theme, else the device decides
    const mode = () => {
      const t = document.documentElement.dataset.theme;
      setDark(t ? t !== "light" : !window.matchMedia("(prefers-color-scheme: light)").matches);
    };
    mode();
    const mo = new MutationObserver(mode);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener("change", mode);
    return () => { window.removeEventListener("vct-team-theme", sync); window.removeEventListener("storage", sync); mo.disconnect(); mq.removeEventListener("change", mode); };
  }, []);
  const palette = useTeamPalette(team && team.logo);
  useEffect(() => {
    const root = document.documentElement;
    const vars = ["--lime", "--lime-ink", "--band", "--band-fg", "--team-2", "--team-raw"];
    const c = team ? themeColors(palette, dark) : null;
    if (!c) { vars.forEach((v) => root.style.removeProperty(v)); delete root.dataset.teamtheme; return; }
    root.style.setProperty("--lime", c.accent);
    root.style.setProperty("--lime-ink", c.accentInk);
    root.style.setProperty("--band", c.band);
    root.style.setProperty("--band-fg", c.bandInk);
    root.style.setProperty("--team-2", c.second);
    root.style.setProperty("--team-raw", c.raw);
    root.dataset.teamtheme = team.name;
  }, [team, palette, dark]);
  return null;
}

/** On a team's page: use its colors for the whole site, or go back to the site's own. */
export function TeamThemeButton({ team }) {
  const tr = useT2();
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => { const t = readTheme(); setOn(!!t && t.name === team.name); };
    sync();
    window.addEventListener("vct-team-theme", sync);
    return () => window.removeEventListener("vct-team-theme", sync);
  }, [team.name]);
  if (!team || !readableLogo(team.logo)) return null;
  return <button type="button" className="btn" aria-pressed={on} onClick={() => setTeamTheme(on ? null : team)}>🎨 {on ? tr("Back to the site's colors") : tr("Site in this team's colors")}</button>;
}

/** A team to choose in the picker: its crest in its own colors. */
function ThemeChoice({ team, on, onPick }) {
  const p = useTeamPalette(team.logo);
  const c = themeColors(p, true);
  return (
    <button type="button" className={"themechoice" + (on ? " on" : "")} aria-pressed={on} onClick={() => onPick(team)} disabled={!c} title={c ? undefined : "—"}>
      <span className="themeswatch" style={c ? { background: `linear-gradient(90deg, ${c.accent} 0 60%, ${c.second} 60%)` } : undefined} />
      <span className="themename">{team.name}</span>
    </button>
  );
}

/** Choosing the site's colors among the visitor's teams (or any listed), with the site's own as the first choice. */
export function TeamThemePicker({ teams }) {
  const tr = useT2();
  const [cur, setCur] = useState(null);
  useEffect(() => {
    const sync = () => setCur(readTheme());
    sync();
    window.addEventListener("vct-team-theme", sync);
    return () => window.removeEventListener("vct-team-theme", sync);
  }, []);
  const list = teams.filter((t) => readableLogo(t.logo));
  return (
    <div className="themepicker">
      <button type="button" className={"themechoice" + (!cur ? " on" : "")} aria-pressed={!cur} onClick={() => setTeamTheme(null)}>
        <span className="themeswatch site" /><span className="themename">{tr("The site's colors")}</span>
      </button>
      {list.map((t) => <ThemeChoice key={t.name} team={t} on={!!cur && cur.name === t.name} onPick={setTeamTheme} />)}
      {!list.length && <p className="hint">{tr("Add favorite teams (★) to choose their colors here.")}</p>}
    </div>
  );
}


/** A short burst of confetti from the top of the screen; nothing for those who asked for less motion. */
export function confetti() {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = document.createElement("canvas");
  c.className = "confetti";
  c.width = window.innerWidth;
  c.height = window.innerHeight;
  document.body.appendChild(c);
  const g = c.getContext("2d");
  const style = getComputedStyle(document.documentElement);
  const colors = [style.getPropertyValue("--lime").trim() || "#c9f03c", style.getPropertyValue("--team-2").trim() || "#ff4655", "#ffffff"];
  const bits = Array.from({ length: 120 }, () => ({ x: Math.random() * c.width, y: -20 - Math.random() * 200, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 3, r: Math.random() * 6.28, s: 5 + Math.random() * 5, col: colors[Math.floor(Math.random() * colors.length)] }));
  const start = performance.now();
  const tick = (t) => {
    g.clearRect(0, 0, c.width, c.height);
    for (const b of bits) { b.x += b.vx; b.y += b.vy; b.r += 0.1; g.save(); g.translate(b.x, b.y); g.rotate(b.r); g.fillStyle = b.col; g.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); g.restore(); }
    if (t - start < 3200) requestAnimationFrame(tick); else c.remove();
  };
  requestAnimationFrame(tick);
}

/** A phone wallpaper in a team's colors. */
export function WallpaperButton({ team, slug }) {
  const tr = useT2();
  const p = useTeamPalette(team && team.logo);
  const hex = (rgb) => (rgb ? rgb.map((v) => v.toString(16).padStart(2, "0")).join("") : "");
  const q = p && !p.mono ? `?c1=${hex(p.primary)}${p.secondary ? `&c2=${hex(p.secondary)}` : ""}` : "";
  return <a className="btn" href={`/api/og/wallpaper/${slug}${q}`} target="_blank" rel="noopener noreferrer" download={`${slug}-fond-d-ecran.png`}>📱 {tr("Phone wallpaper")}</a>;
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
