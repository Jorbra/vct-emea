"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "./lang.jsx";
import { Crest } from "./Crest.jsx";
import { Flag } from "./TeamCard.jsx";
import { typing } from "./autoRefresh.js";

const logoUrl = (f) => `/api/lp-img?f=${encodeURIComponent(f)}`;
const MAX_SHOWN = 10;

/** Adds what Liquipedia and vlr.gg found to each group, without showing anything twice. */
function addLive(own, live) {
  if (!own && !live) return null;
  const res = own || { events: [], teams: [], players: [] }; // whichever answers first
  if (!live) return res;
  const add = (list, more) => {
    const seen = new Set(list.map((x) => x.href));
    return [...list, ...(more || []).filter((x) => !seen.has(x.href))].slice(0, MAX_SHOWN);
  };
  return { ...res, events: add(res.events, live.events), teams: add(res.teams, live.teams), players: add(res.players, live.players) };
}

/** A result's address: its page is read again when it is opened from here. */
// a map has no picture: its first letter
const openHref = (href) => (/^\/(team|player|tournament)\//.test(href || "") ? `${href}?maj=1` : href);

/** The picture of a result: a team's crest, a Liquipedia logo (one per theme when there are two), a player's flag. */
function Pic({ r }) {
  /* eslint-disable @next/next/no-img-element */
  if (r.crest) return <Crest team={r.crest} />;
  if (r.logo && r.logoDark && r.logoDark !== r.logo) {
    return <><img className="lpimg forlight" src={logoUrl(r.logo)} alt="" /><img className="lpimg fordark" src={logoUrl(r.logoDark)} alt="" /></>;
  }
  if (r.logo) return <img className="lpimg" src={logoUrl(r.logo)} alt="" loading="lazy" />;
  if (r.type === "player") return <Flag cc={r.cc} />;
  if (r.type === "map") return <span className="lpimg none mapletter" aria-hidden="true">{r.name.charAt(0)}</span>;
  return <span className="lpimg none" aria-hidden="true" />;
  /* eslint-enable @next/next/no-img-element */
}

/** The search bar of the site's pages: tournaments, teams and players as you type; arrows and Enter choose, "/" jumps to it. */
export default function SearchBar() {
  const tr = useT();
  const [q, setQ] = useState("");
  const [own, setRes] = useState(null);
  const [live, setLive] = useState(null);
  const res = addLive(own, live);
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState(0);
  const [asking, setAsking] = useState(false);
  const box = useRef(null);
  const input = useRef(null);

  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) { setRes(null); return undefined; }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(text)}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (j) { setRes(j); setCur(0); } })
        .catch(() => { /* typed further, or offline: the list stays as it was */ });
    }, 150);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  // once typing pauses, ask Liquipedia and vlr.gg too
  useEffect(() => {
    const text = q.trim();
    setAsking(false);
    setLive(null);
    if (text.length < 3) return undefined;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setAsking(true);
      fetch(`/api/search/live?q=${encodeURIComponent(text)}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (j) setLive(j); setAsking(false); })
        .catch((e) => { if (e.name !== "AbortError") setAsking(false); });
    }, 700);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  useEffect(() => {
    const onDown = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey || typing()) return;
      e.preventDefault();
      input.current && input.current.focus();
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, []);

  const groups = res ? [["Tournaments", res.events], ["Teams", res.teams], ["Players", res.players], ["Matches", res.matches || []], ["Maps", res.maps || []]].filter(([, l]) => l.length) : [];
  const flat = groups.flatMap(([, l]) => l);
  const go = (r) => {
    if (!r || !r.href) return;
    window.location.assign(openHref(r.href));
  };
  const onKey = (e) => {
    if (e.key === "Escape") { setOpen(false); e.currentTarget.blur(); return; }
    if (!flat.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setCur((c) => (c + 1) % flat.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setOpen(true); setCur((c) => (c - 1 + flat.length) % flat.length); }
    else if (e.key === "Enter") { e.preventDefault(); go(flat[cur]); }
  };

  const shown = open && q.trim().length >= 2 && res;
  let n = -1;
  return (
    <div className="searchbar" ref={box} role="search">
      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      <input ref={input} type="search" value={q} placeholder={tr("Search: tournament, team, player, match")} aria-label={tr("Search: tournament, team, player, match")}
        role="combobox" aria-expanded={!!shown} aria-controls="searchres" autoComplete="off" spellCheck="false"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey} />
      {shown && (
        <div className="searchres" id="searchres" role="listbox">
          {!flat.length && !asking && <p className="searchnone">{tr("No result.")}</p>}
          {groups.map(([title, list]) => (
            <div key={title}>
              <div className="searchh">{tr(title)}</div>
              {list.map((r) => {
                n += 1;
                const i = n;
                return (
                  <a key={r.type + r.name} className={"searchitem" + (i === cur ? " on" : "")} role="option" aria-selected={i === cur} href={openHref(r.href) || undefined}
                    onMouseEnter={() => setCur(i)}>
                    <span className="searchpic"><Pic r={r} /></span>
                    <span className="searchname">{r.name}</span>
                    {r.sub && <span className="searchsub">{r.sub}</span>}
                  </a>
                );
              })}
            </div>
          ))}
          {asking && <p className="searchnone" role="status">{tr("Searching Liquipedia and vlr.gg…")}</p>}
        </div>
      )}
    </div>
  );
}
