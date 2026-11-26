"use client";

// For the editors only: a notice when the site was updated since their last visit (with what changed, from the log), and,
// while a page stays open, when a newer version goes online (reload to get it). Visitors never get it (app/layout.js).
import { useEffect, useState } from "react";
import { useT } from "./lang.jsx";

const KEY = "vct-seen-version";
const EVERY = 60000;

const readSeen = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } };
const writeSeen = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private window: seen again next time */ } };

export default function UpdateNotice() {
  const tr = useT();
  const [news, setNews] = useState(null); // { entries } after an update since the last visit
  const [newer, setNewer] = useState(false); // a newer version went online while this page was open

  useEffect(() => {
    let mine = null;
    let stop = false;
    const seen = readSeen();
    fetch(`/api/version${seen && seen.at ? `?since=${encodeURIComponent(seen.at)}` : ""}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j || stop) return;
        mine = j.version.id;
        // the first visit only remembers the version: nothing to announce yet
        if (seen && seen.id !== j.version.id) {
          setNews({ entries: j.entries || [] });
          // GitHub can be slow to give the log the first time: asked once more a moment later
          if (!(j.entries || []).length) {
            setTimeout(() => fetch(`/api/version?since=${encodeURIComponent(seen.at)}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null))
              .then((k) => { if (k && !stop && (k.entries || []).length) setNews({ entries: k.entries }); }).catch(() => {}), 4000);
          }
        } else writeSeen(j.version);
      })
      .catch(() => {});
    const t = setInterval(() => {
      if (document.hidden || !mine) return;
      fetch("/api/version", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && j.version.id !== mine) setNewer(true); }).catch(() => {});
    }, EVERY);
    return () => { stop = true; clearInterval(t); };
  }, []);

  const close = () => {
    fetch("/api/version", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) writeSeen(j.version); }).catch(() => {});
    setNews(null);
  };

  if (newer) {
    return (
      <div className="updnote" role="status">
        <b>🔄 {tr("A new version of the site is online")}</b>
        <span>{tr("Reload the page to get it.")}</span>
        <div className="updbtns"><button type="button" className="btn pri small" onClick={() => window.location.reload()}>{tr("Reload")}</button><button type="button" className="btn small" onClick={() => setNewer(false)}>{tr("Later")}</button></div>
      </div>
    );
  }
  if (!news) return null;
  return (
    <div className="updnote" role="status">
      <b>✨ {tr("The site was updated")}</b>
      {news.entries.length > 0
        ? <ul>{news.entries.map((e, i) => <li key={i}><small>{e.kind}</small> {e.text}</li>)}</ul>
        : <span>{tr("Small fixes behind the scenes.")}</span>}
      <div className="updbtns"><a className="btn small" href="/admin/nouveautes" onClick={close}>{tr("All the news")}</a><button type="button" className="btn pri small" onClick={close}>{tr("Got it")}</button></div>
      <small className="updwho">{tr("Shown to the editors only")}</small>
    </div>
  );
}
