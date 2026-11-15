"use client";

// Round 22: the look. A cinematic home banner over the maps' art, numbers that count up,
// sections that rise into view, a glow that follows the pointer on cards, a loading bar between pages.
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useT } from "./lang.jsx";
import { mapSplash } from "./Assets.jsx";
import { siteHref } from "../lib/paths.js";

const POOL = ["Ascent", "Lotus", "Haven", "Bind", "Icebox", "Sunset", "Corrode", "Abyss", "Pearl", "Split", "Fracture", "Breeze"];
const calm = () => typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A number that counts up from 0 once it is on screen. */
export function CountUp({ value, ms = 1100 }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const el = ref.current;
    if (!el || calm() || !Number.isFinite(value) || value <= 0 || !("IntersectionObserver" in window)) { setShown(value); return undefined; }
    setShown(0);
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (t) => {
        const k = Math.min(1, (t - t0) / ms);
        setShown(Math.round(value * (1 - Math.pow(1 - k, 3))));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value, ms]);
  return <span ref={ref}>{shown}</span>;
}

/** The home banner: the maps' art crossfading behind, the season's numbers, the main links. */
export function HomeHero({ events = [] }) {
  const tr = useT();
  const shots = useMemo(() => POOL.map((m) => ({ map: m, src: mapSplash(m) })).filter((x) => x.src), []);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (shots.length < 2 || calm()) return undefined;
    const t = setInterval(() => { if (!document.hidden) setI((k) => (k + 1) % shots.length); }, 6000);
    return () => clearInterval(t);
  }, [shots.length]);
  const n = useMemo(() => {
    let played = 0, maps = 0, live = 0;
    const teams = new Set();
    for (const e of events) {
      for (const m of e.items) {
        if (!m.a || !m.b) continue;
        teams.add(m.a.name); teams.add(m.b.name);
        if (m.sa != null) { played++; maps += (Number(m.sa) || 0) + (Number(m.sb) || 0); }
        else if (e.live[m.id]) live++;
      }
    }
    return { played, maps, live, teams: teams.size };
  }, [events]);
  const cur = shots[i];
  return (
    <section className="hero22" aria-label="VCT EMEA">
      <div className="h22art" aria-hidden="true">
        {shots.map((s, k) => <img key={s.map} src={s.src} alt="" loading={k === 0 ? "eager" : "lazy"} decoding="async" className={k === i ? "on" : ""} />)}
      </div>
      <div className="h22shade" aria-hidden="true" />
      <div className="h22body">
        <span className="h22kick">Champions Tour 2027 · EMEA</span>
        <h2 className="h22title">{tr("Road to the EMEA Kickoff")}</h2>
        <p>{tr("Every qualifier, the Qualifier Playoffs and the Kickoff, with results updated live.")}</p>
        <div className="h22acts">
          <a className="btn pri" href={siteHref("kickoff")}>Kickoff ›</a>
          {n.live > 0 ? <a className="btn h22live" href="/live"><i />{tr("{n} live", { n: n.live })}</a> : <a className="btn" href="/calendrier">{tr("Calendar")}</a>}
        </div>
      </div>
      <div className="h22nums">
        <div><b><CountUp value={n.played} /></b><span>{tr("Matches played")}</span></div>
        <div><b><CountUp value={n.maps} /></b><span>{tr("Maps played")}</span></div>
        <div><b><CountUp value={n.teams} /></b><span>{tr("Teams")}</span></div>
      </div>
      {cur && <a className="h22map" href={`/map/${cur.map.toLowerCase()}`} key={cur.map}>{cur.map} ›</a>}
    </section>
  );
}

/** The site-wide motion, mounted once in the layout: the loading bar between pages, the glow on cards.
 *  (Sections rising into view are CSS only, scroll-driven: nothing here touches the page before React has taken it over.) */
export function Motion() {
  const path = usePathname();
  const bar = useRef(null);
  useEffect(() => {
    const el = bar.current;
    if (!el) return undefined;
    const onClick = (ev) => {
      if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      const a = ev.target.closest && ev.target.closest("a[href]");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      el.classList.remove("done");
      el.classList.add("go");
    };
    const reset = () => { el.classList.remove("go"); el.classList.add("done"); };
    document.addEventListener("click", onClick);
    window.addEventListener("pageshow", reset);
    return () => { document.removeEventListener("click", onClick); window.removeEventListener("pageshow", reset); };
  }, []);
  useEffect(() => {
    const el = bar.current;
    if (el && el.classList.contains("go")) { el.classList.remove("go"); el.classList.add("done"); }
  }, [path]);
  // a glow that follows the pointer on cards (only once the visitor moves it: the page is React's by then)
  useEffect(() => {
    if (calm() || !window.matchMedia("(hover: hover)").matches) return undefined;
    const SEL = ".informcard, .evcard, .bt, .reccol, .rlcol, .pstatbar > div, .h22nums > div";
    let raf = 0;
    const onMove = (ev) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = ev.target.closest && ev.target.closest(SEL);
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${ev.clientX - r.left}px`);
        el.style.setProperty("--my", `${ev.clientY - r.top}px`);
      });
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => { document.removeEventListener("pointermove", onMove); cancelAnimationFrame(raf); };
  }, []);
  return <div ref={bar} className="navbar22" aria-hidden="true" />;
}

/** A stat's text ("1.48", "83%", "+12", "204/105/56") whose number counts up once on screen; other text as it is. */
export function RollNum({ text }) {
  const str = String(text ?? "");
  const m = /^([+-]?)(\d+(?:[.,]\d+)?)(%?)$/.exec(str.trim());
  const ref = useRef(null);
  const [shown, setShown] = useState(str);
  useEffect(() => {
    setShown(str);
    const el = ref.current;
    if (!m || !el || calm() || !("IntersectionObserver" in window)) return undefined;
    const end = parseFloat(m[2].replace(",", "."));
    if (!Number.isFinite(end) || end === 0) return undefined;
    const dec = (m[2].split(/[.,]/)[1] || "").length;
    const sep = m[2].includes(",") ? "," : ".";
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (t) => {
        const k = Math.min(1, (t - t0) / 900);
        setShown(k < 1 ? m[1] + (end * (1 - Math.pow(1 - k, 3))).toFixed(dec).replace(".", sep) + m[3] : str);
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [str]); // eslint-disable-line react-hooks/exhaustive-deps
  return <span ref={ref}>{shown}</span>;
}
