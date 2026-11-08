"use client";

import { useEffect, useState } from "react";
import { useT } from "./lang.jsx";

// ---- 2. no spoilers: the scores are hidden all over the site until a click on one shows it

export const SPOILER_KEY = "vct-nospoil";
export const spoilersHidden = () => { try { return localStorage.getItem(SPOILER_KEY) === "1"; } catch { return false; } };

/** Read before the page paints, so that no score flashes: put in <head>. */
export const SPOILER_SCRIPT = `try{if(localStorage.getItem("${SPOILER_KEY}")==="1")document.documentElement.dataset.nospoil="1"}catch(e){}`;

/** What holds a score: a click on one of them shows that one. */
const SCORES = ".sc:not(.vs), .tscore, .mcs, .mcchip, .mmscore, .livescore, .lsscore, .ntscore, .qlscore, .weeklist a, .mmmaps .mms, .spoil";

function setHidden(on) {
  try { localStorage.setItem(SPOILER_KEY, on ? "1" : "0"); } catch { /* private window: for this page only */ }
  if (on) document.documentElement.dataset.nospoil = "1";
  else delete document.documentElement.dataset.nospoil;
  window.dispatchEvent(new Event("vct-nospoil"));
}

/** The switch in the menu, and the click that shows one score. */
export function SpoilerSwitch() {
  const tr = useT();
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(document.documentElement.dataset.nospoil === "1");
    sync();
    window.addEventListener("vct-nospoil", sync);
    const reveal = (e) => {
      if (document.documentElement.dataset.nospoil !== "1") return;
      const el = e.target instanceof Element ? e.target.closest(SCORES) : null;
      if (!el || el.classList.contains("shown")) return;
      e.preventDefault();
      e.stopPropagation();
      el.classList.add("shown");
    };
    document.addEventListener("click", reveal, true);
    return () => { window.removeEventListener("vct-nospoil", sync); document.removeEventListener("click", reveal, true); };
  }, []);
  return (
    <button type="button" className={"navspoil" + (on ? " on" : "")} aria-pressed={on} onClick={() => setHidden(!on)} title={tr("Hide the scores until you click on one")}>
      <svg className="navicon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={on ? "M3 3l18 18M10.6 6.1A9 9 0 0 1 12 6c5 0 9 6 9 6a15 15 0 0 1-2.6 3.1M6.6 7.6A15 15 0 0 0 3 12s4 6 9 6a8.6 8.6 0 0 0 4-1M9.9 10a3 3 0 0 0 4.1 4.1" : "M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6zM12 9a3 3 0 1 0 .01 0"} />
      </svg>
      <span>{on ? tr("Scores hidden") : tr("No spoilers")}</span>
    </button>
  );
}

// ---- 8. the editor's banner

/** The banner at the top of every page; closed, it stays closed until the editor writes another one. */
export function SiteBanner({ banner }) {
  const tr = useT();
  const [closed, setClosed] = useState(true);
  useEffect(() => {
    try { setClosed(localStorage.getItem("vct-banner-closed") === banner.key); } catch { setClosed(false); }
  }, [banner.key]);
  if (closed) return null;
  const close = () => { try { localStorage.setItem("vct-banner-closed", banner.key); } catch { /* still closed for this page */ } setClosed(true); };
  return (
    <div className={`sitebanner ${banner.tone}`} role="status">
      {banner.tone === "live" && <i className="livedot" aria-hidden="true" />}
      {banner.url ? <a href={banner.url}>{banner.text} ›</a> : <span>{banner.text}</span>}
      <button type="button" className="sbclose" aria-label={tr("Close")} onClick={close}>×</button>
    </div>
  );
}
