"use client";

import { memo, useMemo, useRef, useState } from "react";
import { THIRD, buildBracket, matchId, podium, roundsFor } from "../lib/bracket.js";
import { Crest } from "./Crest.jsx";
import TeamCard from "./TeamCard.jsx";
import { useT } from "./lang.jsx";
import { Schedule } from "./matchTime.jsx";
import { matchesOf } from "../lib/matchlist.js";
import { useOpenMatch } from "./openMatch.js";
import { useFavorites } from "./favorites.js";
import { formatMatchTime } from "../lib/schedule.js";
import { teamSlug } from "../lib/paths.js";
import { useMatchTimes } from "./matchTime.jsx";

const CELL = 56; // px per first-round match; every later round doubles it

/** Name, crest and score of one side of a match. */
function Side({ slot, slots, m, side, bye, lit, fav }) {
  const tr = useT();
  const team = slot ? slots[slot - 1] : null;
  const res = m.winner != null;
  const win = res && m.winner === slot;
  const score = side === "a" ? m.sa : m.sb;
  let label = team ? team.name : bye ? "" : tr("TBD");
  if (!team && m.bye) label = tr("BYE");
  return (
    <div className={"bl" + (res ? (win ? " bw" : " lo") : "") + (lit ? " lit" : "") + (fav ? " fav" : "")} data-s={team ? slot : undefined}>
      <Crest team={team} />
      <span className={"tn" + (team ? "" : " tbdn")}>{label}</span>
      <span className="bs">{res && score != null && !m.bye ? score : ""}</span>
    </div>
  );
}

/** One match. Clicks and hovers are handled once, by the bracket around it. lit: the side of the team being followed, "a" or "b". */
const MatchBox = memo(function MatchBox({ m, slots, lit, canOpen, favs }) {
  const tr = useT();
  const emptyR1 = m.first && !m.a && !m.b;
  const can = canOpen && !emptyR1 && !m.bye;
  const nameOf = (s) => (s && slots[s - 1] ? slots[s - 1].name : tr("TBD"));
  return (
    <div className={"bbox qbox" + (emptyR1 ? " void" : "") + (can ? " can" : "") + (lit ? " lit" : "")} data-m={m.id}
      {...(can ? { "data-open": "1", role: "button", tabIndex: 0, "aria-label": `${nameOf(m.a)} vs ${nameOf(m.b)}` } : {})}>
      <Side slot={m.a} slots={slots} m={m} side="a" bye={emptyR1} lit={lit === "a"} fav={favs.includes("a")} />
      <Side slot={m.b} slots={slots} m={m} side="b" bye={emptyR1} lit={lit === "b"} fav={favs.includes("b")} />
    </div>
  );
});

const plain = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

export function BigBracket({ event, slots, scores, bo }) {
  const tr = useT();
  const bracket = useMemo(() => buildBracket(slots, scores, bo), [slots, scores, bo]);
  const third = bracket.byId[matchId("third", 0)];
  const rounds = roundsFor(slots.length);
  const open = useOpenMatch();
  const box = useRef(null);
  const drag = useRef(null);
  const moved = useRef(false);
  const [hover, setHover] = useState(0);
  const [found, setFound] = useState(0);
  const [dragging, setDragging] = useState(false);
  const canOpen = !!(open && event);
  const followed = hover || found;
  const litOf = (m) => (!followed ? "" : m.a === followed ? "a" : m.b === followed ? "b" : "");
  const fav = useFavorites();
  const { times } = useMatchTimes() || {};
  const favSlots = useMemo(() => slots.map((t, i) => (t && fav.list.includes(teamSlug(t.name)) ? i + 1 : 0)).filter(Boolean), [slots, fav.list]);
  const favsOf = (m) => `${favSlots.includes(m.a) ? "a" : ""}${favSlots.includes(m.b) ? "b" : ""}`;
  /** Where a followed team stands: its next match, or how it ended. */
  const standing = (slot) => {
    const mine = bracket.matches.filter((m) => m.a === slot || m.b === slot);
    const next = mine.find((m) => m.winner == null && !m.bye);
    if (next) {
      const other = next.a === slot ? next.b : next.a;
      const at = times && times[next.id];
      return `${tr("Next match")} : ${other && slots[other - 1] ? slots[other - 1].name : tr("TBD")}${at ? ` · ${formatMatchTime(at, tr.lang, true)}` : ""}`;
    }
    return bracket.byId[matchId("gf", 0)].winner === slot ? tr("Winner") : mine.some((m) => m.loser === slot) ? tr("Eliminated") : "";
  };

  function openFrom(target) {
    const el = target.closest("[data-open]");
    if (el && canOpen) open(event, el.dataset.m);
  }
  // Dragging with the mouse moves the bracket; a finger already does. A real drag is not a click.
  function down(e) {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = box.current;
    drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
    moved.current = false;
  }
  function move(e) {
    const d = drag.current;
    if (!d) {
      const side = e.target.closest && e.target.closest("[data-s]");
      const s = side && e.pointerType === "mouse" ? Number(side.dataset.s) : 0;
      if (s !== hover) setHover(s);
      return;
    }
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!moved.current && Math.abs(dx) + Math.abs(dy) < 6) return;
    if (!moved.current) { moved.current = true; setDragging(true); setHover(0); }
    box.current.scrollLeft = d.left - dx;
    box.current.scrollTop = d.top - dy;
  }
  function up() {
    drag.current = null;
    setDragging(false);
  }
  /** The team's last match, in the middle of the bracket's window. */
  function show(slot) {
    const mine = bracket.matches.filter((m) => m.a === slot || m.b === slot);
    const last = mine.filter((m) => m.round !== "third").pop() || mine[mine.length - 1];
    const el = box.current;
    const target = last && el && el.querySelector(`[data-m="${last.id}"]`);
    if (!target) return;
    const a = el.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    el.scrollLeft += b.left - a.left - (el.clientWidth - b.width) / 2;
    el.scrollTop += b.top - a.top - (el.clientHeight - b.height) / 2;
  }
  function find(text) {
    const q = plain(text);
    const i = q ? slots.findIndex((t) => t && plain(t.name) === q) : -1;
    setFound(i + 1);
    if (i >= 0) show(i + 1);
  }
  const listId = `qteams-${event || "x"}`;
  return (
    <>
    <div className="qfind">
      <input type="search" list={listId} placeholder={tr("Find a team")} aria-label={tr("Find a team")} onChange={(e) => find(e.target.value)} />
      <datalist id={listId}>{slots.filter(Boolean).map((t) => <option key={t.name} value={t.name} />)}</datalist>
    </div>
    {favSlots.length > 0 && (
      <ul className="qfavs" aria-label={tr("My teams")}>
        {favSlots.map((slot) => (
          <li key={slot}>
            <button type="button" className="qfav" aria-pressed={found === slot} onClick={() => { const on = found !== slot; setFound(on ? slot : 0); if (on) show(slot); }}>
              <Crest team={slots[slot - 1]} /><b>{slots[slot - 1].name}</b><small>{standing(slot)}</small>
            </button>
            <a className="qfavrun" href={`/parcours/${event}/${teamSlug(slots[slot - 1].name)}`}>{tr("Run")} ›</a>
          </li>
        ))}
      </ul>
    )}
    <div ref={box} className={"qbracket" + (dragging ? " dragging" : "") + (found ? " finding" : "")} tabIndex={0} aria-label={tr("Bracket")}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={() => { up(); setHover(0); }}
      onClick={(e) => { if (moved.current) { moved.current = false; return; } openFrom(e.target); }}
      onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && e.target.closest("[data-open]")) { e.preventDefault(); openFrom(e.target); } }}>
      {rounds.map((r, ri) => (
        <div className="qcol" key={r.key} style={{ "--cell": `${CELL * 2 ** ri}px` }}>
          <div className="qh">{tr(r.name)}</div>
          {Array.from({ length: r.count }, (_, i) => {
            const m = bracket.byId[matchId(r.key, i)];
            return (
              <div key={m.id} className={"qcell" + (ri < rounds.length - 1 ? (i % 2 ? " lo" : " up") : "") + (ri > 0 ? " in" : "")}>
                <MatchBox m={m} slots={slots} lit={litOf(m)} canOpen={canOpen} favs={favsOf(m)} />
              </div>
            );
          })}
          {r.key === "gf" && (
            <div className="qthird">
              <div className="qh">{tr(THIRD.name)}</div>
              <MatchBox m={third} slots={slots} lit={litOf(third)} canOpen={canOpen} favs={favsOf(third)} />
            </div>
          )}
        </div>
      ))}
    </div>
    </>
  );
}

/** An open Qualifier (EU, Türkiye or MENA): its `qualify` best teams go on to the `next` event's Qualifier Playoffs. */
export default function Qualifier({ event, data, onGo, next = "playoffs", qualify = 4 }) {
  const tr = useT();
  const { slots, scores, bo } = data;
  const size = slots.length;
  const bracket = useMemo(() => buildBracket(slots, scores, bo), [slots, scores, bo]);
  const [more, setMore] = useState(false);
  const [view, setView] = useState(size > 64 ? "top16" : "all"); // top16 | top64 (every team) | all
  const [opts, setOpts] = useState({ rosters: true, compact: true, hover: true });

  const nameOf = (slot) => (slot && slots[slot - 1] ? slot : null);
  const by = (round) => bracket.matches.filter((m) => m.round === round);
  const losers = (round) => by(round).map((m) => nameOf(m.loser));
  const [first, second, third, fourth] = podium(bracket).map(nameOf);
  // Places are decided by the round a team went out in; inside a group the bracket order is kept.
  const rows = [
    { place: "1", ids: [first], cls: "p1", kick: qualify >= 1 },
    { place: "2", ids: [second], cls: "p2", kick: qualify >= 2 },
    { place: "3", ids: [third], cls: "p3", kick: qualify >= 3 },
    { place: "4", ids: [fourth], kick: qualify >= 4 },
    ...roundsFor(size).filter((r) => r.count >= 4).reverse().map((r) => ({ place: `${r.count + 1}-${r.count * 2}`, ids: losers(r.key) })),
  ];
  const shown = more ? rows : rows.slice(0, 4);

  const all = slots.map((t, i) => (t ? { ...t, slot: i + 1 } : null));
  const top16 = by("r16").flatMap((m) => [m.a, m.b]).map((slot) => (slot ? all[slot - 1] : null));
  const cards = (list) => (
    <div className={"teams" + (opts.compact ? " compact" : "") + (opts.hover ? " hover" : "")}>
      {list.map((t, i) => (
        <TeamCard key={t ? t.slot : "e" + i} team={t || { name: "" }} rosters={opts.rosters} />
      ))}
    </div>
  );
  const pad = (list, n) => Array.from({ length: n }, (_, i) => list[i] || null);

  return (
    <div className="panel">
      <section>
        <h2>{tr("Format")}</h2>
        <ul className="fmt">
          <li>{tr("Single-elimination bracket of up to {n} teams, with a Third Place Match", { n: size })}</li>
          <li>{qualify === 1 ? tr("The winner qualifies for the Qualifier Playoffs") : qualify === 2 ? tr("The two best teams qualify for the Qualifier Playoffs") : tr("The four best teams qualify for the Qualifier Playoffs")}</li>
        </ul>
      </section>
      <Schedule Crest={Crest} items={matchesOf(event, data)} />

      <section>
        <h2>{tr("Prize Pool")}</h2>
        <div className="tablewrap">
          <table>
            <thead>
              <tr><th>{tr("Place")}</th><th>{tr("Participant")}</th><th>{tr("Qualifies to")}</th></tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.place} className={r.cls || ""}>
                  <td><span className="place">{r.place}</span></td>
                  <td>
                    {r.ids.map((slot, i) => (
                      <div key={i} className={"tbd prize" + (slot ? " set" : "")}>
                        <Crest team={slot ? slots[slot - 1] : null} />
                        {slot ? slots[slot - 1].name : "TBD"}
                      </div>
                    ))}
                  </td>
                  <td>{r.kick ? <button type="button" className="kick linklike" onClick={() => onGo && onGo(next)}>{tr("Qualifier Playoffs")}</button> : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="more" aria-expanded={more} onClick={() => setMore(!more)}>
            {more ? tr("Hide places 5 to {n} ⌃", { n: size }) : tr("Show places 5 to {n} ⌄", { n: size })}
          </button>
        </div>
      </section>

      <section>
        <h2>{tr("Participants")} <small>{all.filter(Boolean).length}/{size}</small></h2>
        <div className="toggles">
          <label className="sw"><input type="checkbox" checked={opts.rosters} onChange={(e) => setOpts({ ...opts, rosters: e.target.checked })} /> {tr("Show rosters")}</label>
          <label className="sw"><input type="checkbox" checked={opts.compact} onChange={(e) => setOpts({ ...opts, compact: e.target.checked })} /> {tr("Compact view")}</label>
          <label className="sw"><input type="checkbox" checked={opts.hover} onChange={(e) => setOpts({ ...opts, hover: e.target.checked })} /> {tr("Enable hover")}</label>
        </div>
        <div className="tabs sub" role="tablist" aria-label={tr("Participants")}>
          {[["top16", "Top 16"], ["top64", `Top ${size}`], ["all", "Show All"]].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)}>{tr(l)}</button>
          ))}
        </div>
        {(view === "top16" || view === "all") && (
          <>
            <h3 className="sub redsub">Top 16</h3>
            {cards(pad(top16, 16))}
          </>
        )}
        {(view === "top64" || view === "all") && (
          <>
            <h3 className="sub redsub">Top {size}</h3>
            {cards(pad(all.filter(Boolean), size))}
          </>
        )}
      </section>

      <section>
        <h2>{tr("Results")}</h2>
        <BigBracket event={event} slots={slots} scores={scores} bo={bo} />
      </section>
    </div>
  );
}
