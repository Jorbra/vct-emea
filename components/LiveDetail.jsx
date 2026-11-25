"use client";

// During a match, from vlr.gg's page (lib/vlive.js): the map being played with its score and halves, its rounds one by one
// (who won, on which side, how) and the players' numbers, for the map being played or every map.
import { useState } from "react";
import { useT } from "./lang.jsx";
import { AgentIcon } from "./Assets.jsx";

const HOW = { e: "Eliminations", b: "Spike exploded", d: "Spike defused", t: "Time ran out" };
const short = (t) => (t && (t.tag || t.name)) || "";

// How a round ended, drawn (the same in every browser, in the square's text colour): every enemy down (a skull), the spike
// gone off (a burst), the spike defused (the spike with a cut through it), the time run out (a clock).
const PATHS = {
  e: <path fillRule="evenodd" d="M12 3a7 7 0 0 0-7 7c0 2.3 1.1 4.3 2.8 5.6V19c0 .6.4 1 1 1h1.2v-2.2h1.5V20h3v-2.2h1.5V20h1.2c.6 0 1-.4 1-1v-3.4A7 7 0 0 0 12 3zm-3 7.2a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4zm6 0a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4zM12 14l-1.2 2h2.4z" />,
  b: <path d="M12 1.5l2 5.6 5.4-2.6-2.6 5.4 5.7 2.1-5.7 2.1 2.6 5.4-5.4-2.6-2 5.6-2-5.6-5.4 2.6 2.6-5.4-5.7-2.1 5.7-2.1-2.6-5.4 5.4 2.6z" />,
  d: <><path d="M12 2l5 4.5v8L12 22l-5-7.5v-8z" opacity=".95" /><path d="M4 17L20 5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" fill="none" className="rcut" /></>,
  t: <><circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" strokeWidth="2.4" /><path d="M12 8.5V13l3 2" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /><path d="M9 2.5h6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></>,
};
export function RoundIcon({ how }) {
  const p = PATHS[how];
  return p ? <svg className="ricon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{p}</svg> : null;
}

/** A map's rounds: one square per round, in the colour of the team that won it, halves and overtime set apart. */
export function RoundStrip({ rnd, a, b }) {
  const tr = useT();
  if (!(rnd || []).length) return null;
  return (
    <ol className="rstrip" aria-label={tr("Rounds")}>
      {rnd.map((r, i) => {
        const team = r[0] === "a" ? a : b;
        const side = r[1] === "c" ? tr("defence") : tr("attack");
        return (
          <li key={i} className={`rsq-${r[0]}` + (i === 12 || (i >= 24 && i % 2 === 0) ? " rsq-half" : "")}
            title={tr("Round {n}: {team} ({side}), {how}", { n: i + 1, team: short(team) || r[0].toUpperCase(), side, how: tr(HOW[r[2]] || HOW.e) })}>
            <RoundIcon how={r[2] || "e"} />
          </li>
        );
      })}
    </ol>
  );
}

function Players({ rows, a, b }) {
  const tr = useT();
  const sides = [["a", a], ["b", b]].map(([s, t]) => [t, rows.filter((p) => p.side === s).sort((x, y) => (y.acs || 0) - (x.acs || 0))]).filter(([, l]) => l.length);
  if (!sides.length) return null;
  return (
    <div className="lplayers">
      {sides.map(([t, list], i) => (
        <table key={i} className="lptable">
          <caption>{(t && t.name) || ""}</caption>
          <thead><tr><th scope="col">{tr("Player")}</th><th scope="col" title={tr("Kills / deaths / assists")}>K/D/A</th><th scope="col">+/–</th><th scope="col" title={tr("Average combat score")}>ACS</th><th scope="col" className="lpopt" title={tr("Rating")}>R</th></tr></thead>
          <tbody>
            {list.map((p) => {
              const pm = p.k != null && p.d != null ? p.k - p.d : null;
              return (
                <tr key={p.name}>
                  <th scope="row">{p.agent && <AgentIcon name={p.agent} size={20} />}<span>{p.name}</span></th>
                  <td>{p.k ?? "–"}/{p.d ?? "–"}/{p.a ?? "–"}</td>
                  <td className={pm > 0 ? "up" : pm < 0 ? "down" : ""}>{pm == null ? "–" : pm > 0 ? `+${pm}` : pm}</td>
                  <td>{p.acs ?? "–"}</td>
                  <td className="lpopt">{p.r != null ? p.r.toFixed(2) : "–"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ))}
    </div>
  );
}

/**
 * The match being played, in detail. detail: liveDetail() (lib/db.js). compact: only the map being played and its rounds
 * (the cards of /live).
 */
export default function LiveDetail({ detail, a, b, compact = false }) {
  const tr = useT();
  const maps = (detail && detail.maps) || [];
  const [pick, setPick] = useState("");
  const [scope, setScope] = useState("map");
  if (!maps.length) return null;
  const shown = maps.find((m) => m.map === (pick || detail.now)) || maps[maps.length - 1];
  const playing = shown.map === detail.now && !shown.done;
  const halves = shown.t && shown.ct ? shown : null;
  const head = (
    <div className="ldhead">
      <b>{shown.map}</b>
      <span className="ldscore"><span className={shown.a > shown.b ? "lead" : ""}>{shown.a}</span>–<span className={shown.b > shown.a ? "lead" : ""}>{shown.b}</span></span>
      {playing ? <span className="ldnow">{tr("Being played")}</span> : shown.done ? <span className="ldnow done">{tr("Finished")}</span> : null}
    </div>
  );
  if (compact) {
    return (
      <div className="livedetail compact">
        {head}
        <RoundStrip rnd={shown.rnd} a={a} b={b} />
      </div>
    );
  }
  const rows = scope === "map" && shown.map === detail.now ? (detail.players.map || []) : (detail.players.all || []);
  return (
    <section className="livedetail" aria-label={tr("Live details")}>
      {maps.length > 1 && (
        <div className="ldmaps" role="group" aria-label={tr("Maps")}>
          {maps.map((m) => (
            <button key={m.map} type="button" className={"btn sm" + (m.map === shown.map ? " pri" : "")} aria-pressed={m.map === shown.map} onClick={() => setPick(m.map)}>
              {m.map} {m.a}–{m.b}
            </button>
          ))}
        </div>
      )}
      {head}
      {halves && (
        <p className="ldhalves">
          <span>{short(a)} : {tr("{t} on attack, {ct} on defence", { t: halves.t[0], ct: halves.ct[0] })}</span>
          <span>{short(b)} : {tr("{t} on attack, {ct} on defence", { t: halves.t[1], ct: halves.ct[1] })}</span>
        </p>
      )}
      <RoundStrip rnd={shown.rnd} a={a} b={b} />
      {(shown.rnd || []).length > 0 && (
        <p className="ldkey"><span className="rkey-a">■</span> {short(a)} <span className="rkey-b">■</span> {short(b)} · <RoundIcon how="e" /> {tr("Eliminations")} · <RoundIcon how="b" /> {tr("Spike exploded")} · <RoundIcon how="d" /> {tr("Spike defused")} · <RoundIcon how="t" /> {tr("Time ran out")}</p>
      )}
      {((detail.players.map || []).length > 0 || (detail.players.all || []).length > 0) && (
        <>
          <div className="ldscope" role="group" aria-label={tr("Players")}>
            <button type="button" className={"btn sm" + (scope === "map" ? " pri" : "")} aria-pressed={scope === "map"} onClick={() => setScope("map")} disabled={!(detail.players.map || []).length}>{detail.now ? tr("On {map}", { map: detail.now }) : tr("Map being played")}</button>
            <button type="button" className={"btn sm" + (scope === "all" ? " pri" : "")} aria-pressed={scope === "all"} onClick={() => setScope("all")}>{tr("All maps")}</button>
          </div>
          <Players rows={rows.length ? rows : detail.players.all || []} a={a} b={b} />
        </>
      )}
      <p className="hint">{tr("From vlr.gg, read every minute · last read at {time}", { time: new Date(detail.at).toLocaleTimeString(tr.lang === "fr" ? "fr-FR" : undefined, { hour: "2-digit", minute: "2-digit" }) })}</p>
    </section>
  );
}
