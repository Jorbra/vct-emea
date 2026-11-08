"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "./lang.jsx";
import { Crest } from "./Crest.jsx";
import { useOpenMatch } from "./openMatch.js";
import { EVENT_NAMES } from "../lib/paths.js";
import { formatMatchTime } from "../lib/schedule.js";
import { countdownText } from "./matchTime.jsx";
import { Score, useTeamColor } from "./visual.jsx";

// the last rounds weigh more: a final is the match of the day before a round of 256
const WEIGHT = (id) => (/^gf|^third/.test(id) ? 6 : /^sf/.test(id) ? 5 : /^qf/.test(id) ? 4 : /^r16/.test(id) ? 3 : /^r32/.test(id) ? 2 : 1);

/**
 * The match of the moment, big at the top of the home page: a live one (the latest round first), else the next one with both
 * teams, else the latest result. events: as the home page builds them.
 */
export default function FeaturedMatch({ events }) {
  const tr = useT();
  const open = useOpenMatch();
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const all = useMemo(() => events.flatMap((e) => e.items.filter((m) => m.a && m.b && m.a.name && m.b.name).map((m) => ({
    ...m, event: e.event, at: e.times[m.id] || "", live: !!e.live[m.id] && m.sa == null, score: e.live[m.id] || null,
    ex: (e.extra && e.extra[m.id]) || {}, stream: (e.extra && e.extra[m.id] && e.extra[m.id].stream) || e.stream || "",
  }))), [events]);
  const pick = useMemo(() => {
    if (now == null) return null;
    const live = all.filter((m) => m.live).sort((x, y) => WEIGHT(y.id) - WEIGHT(x.id));
    if (live.length) return { m: live[0], kind: "live" };
    const next = all.filter((m) => m.sa == null && m.at && new Date(m.at).getTime() > now).sort((x, y) => x.at.localeCompare(y.at) || WEIGHT(y.id) - WEIGHT(x.id));
    if (next.length) return { m: next[0], kind: "next" };
    const done = all.filter((m) => m.sa != null).sort((x, y) => (y.at || "").localeCompare(x.at || ""));
    return done.length ? { m: done[0], kind: "done" } : null;
  }, [all, now == null ? 0 : Math.floor(now / 30000)]); // eslint-disable-line react-hooks/exhaustive-deps
  const ca = useTeamColor(pick && pick.m.a.logo);
  const cb = useTeamColor(pick && pick.m.b.logo);
  if (!pick) return null;
  const { m, kind } = pick;
  const round = m.round.map(([k, v]) => tr(k, v)).join(" · ");
  const maps = kind === "live" ? (m.score && m.score.maps) || [] : (m.ex.maps || []).filter((x) => x.a != null);
  const left = m.at && now ? new Date(m.at).getTime() - now : 0;
  const center = kind === "live" ? `${m.score ? m.score.a : 0} : ${m.score ? m.score.b : 0}` : kind === "done" ? `${m.sa} : ${m.sb}` : "vs";
  const side = (t, s, color) => (
    <div className={"fmteam " + s + (kind === "done" && m.win === s ? " w" : kind === "done" && m.win ? " lo" : "")} style={color ? { "--tc": color } : undefined}>
      <Crest team={t} />
      <span className="fmname">{t.name}</span>
    </div>
  );
  return (
    <section className={"featured cut" + (kind === "live" ? " live" : "")} aria-label={tr("Match of the moment")}>
      <div className="fmtop">
        {kind === "live" ? <span className="livebadge">{tr("LIVE")}</span> : <span className="fmkind">{kind === "next" ? tr("Next match") : tr("Latest result")}</span>}
        <span className="fmwhere">{tr(EVENT_NAMES[m.event] || m.event)} · {round}{m.bo ? ` · Bo${m.bo}` : ""}</span>
      </div>
      <div className="fmvs">
        {side(m.a, "a", ca)}
        <div className="fmscore">
          <Score className="fmnum" value={center} />
          {kind === "next" && left > 0 && <span className="fmcount">{countdownText(left, tr.lang)}</span>}
          {kind === "next" && m.at && <span className="fmwhen">{formatMatchTime(m.at, tr.lang, true)}</span>}
        </div>
        {side(m.b, "b", cb)}
      </div>
      {maps.length > 0 && (
        <div className="fmmaps">{maps.map((x, i) => <span key={i} className={"mcchip" + (kind === "live" && !x.done && i === maps.length - 1 ? " now" : "")}>{x.map ? `${x.map} ` : ""}{x.a}–{x.b}</span>)}</div>
      )}
      <div className="fmacts">
        {kind === "live" && m.stream && <a className="btn pri cut" href="/live">▶ {tr("Watch")}</a>}
        <button type="button" className="btn cut" onClick={() => (open ? open(m.event, m.id) : window.location.assign(`/match/${m.event}/${m.id}`))}>{kind === "live" ? tr("Live stats") : tr("Match page")}</button>
      </div>
    </section>
  );
}
