"use client";

// The visitor's own streams on the live page: paste Twitch, YouTube or Kick links (a co-stream, another channel…),
// watch them side by side (up to 4), tie each to a match for its score, and share the view as a link.
// Kept on this device; a shared link (?s=…) adds its streams when it is opened.
import { useEffect, useState } from "react";
import { useT } from "./lang.jsx";
import { embedUrl } from "../lib/media.js";
import { StreamScore } from "./StreamScore.jsx";

const KEY = "vct-my-streams";
const MAX = 4;

/** A stream's short name from its link: the channel, or the site. */
export function streamName(link) {
  try {
    const u = new URL(link);
    const h = u.hostname.replace(/^(www|m)\./, "");
    const first = u.pathname.split("/").filter(Boolean)[0] || "";
    if (h === "twitch.tv") return first === "videos" ? "Twitch VOD" : first;
    if (h === "kick.com") return first;
    if (h === "youtube.com" || h === "youtu.be") return "YouTube";
    return h;
  } catch { return ""; }
}

/** The links found in a pasted text (several at once, separated by spaces, commas or lines). */
export const linksIn = (text) => String(text || "").split(/[\s,]+/).map((x) => x.trim()).filter((x) => /^https:\/\//i.test(x));

export function MyStreams({ live, host }) {
  const tr = useT();
  const [list, setList] = useState([]);
  const [text, setText] = useState("");
  const [match, setMatch] = useState("");
  const [msg, setMsg] = useState("");
  const save = (next) => { setList(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* not remembered */ } };
  // the device's list, plus the streams of a shared link
  useEffect(() => {
    let mine = [];
    try { mine = JSON.parse(localStorage.getItem(KEY) || "[]") || []; } catch { /* none */ }
    const shared = new URLSearchParams(window.location.search).getAll("s").flatMap(linksIn);
    for (const url of shared) if (!mine.some((x) => x.url === url) && embedUrl(url, "site.test")) mine.push({ url, match: "" });
    mine = mine.slice(-MAX);
    setList(mine);
    try { localStorage.setItem(KEY, JSON.stringify(mine)); } catch { /* not remembered */ }
  }, []);
  const add = (e) => {
    e.preventDefault();
    const found = linksIn(text);
    const good = found.filter((u) => embedUrl(u, host || "site.test"));
    if (!good.length) { setMsg(tr("Link not recognised: paste a Twitch, YouTube or Kick link.")); return; }
    const next = [...list.filter((x) => !good.includes(x.url)), ...good.map((url) => ({ url, match }))].slice(-MAX);
    save(next);
    setText("");
    setMsg(good.length < found.length ? tr("Some links were not recognised: Twitch, YouTube or Kick only.") : "");
  };
  const share = async () => {
    const q = new URLSearchParams();
    list.forEach((x) => q.append("s", x.url));
    const url = `${window.location.origin}/live?${q.toString()}`;
    try {
      if (navigator.share) await navigator.share({ url, title: "VCT EMEA" });
      else { await navigator.clipboard.writeText(url); setMsg(tr("Link copied: whoever opens it sees the same streams.")); }
    } catch { /* closed */ }
  };
  const matchOf = (key) => live.find((m) => `${m.event}:${m.id}` === key) || null;
  return (
    <section className="mystreams">
      <h2>📺 {tr("My streams")}</h2>
      <form className="msform" onSubmit={add}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={tr("Paste one or more links: twitch.tv/…, youtube.com/…, kick.com/…")} aria-label={tr("Stream links")} />
        {live.length > 0 && (
          <select value={match} onChange={(e) => setMatch(e.target.value)} aria-label={tr("Match shown above")}>
            <option value="">{tr("No match")}</option>
            {live.map((m) => <option key={m.event + m.id} value={`${m.event}:${m.id}`}>{(m.a && m.a.name) || "?"} vs {(m.b && m.b.name) || "?"}</option>)}
          </select>
        )}
        <button type="submit" className="btn pri">{tr("Add")}</button>
      </form>
      {msg && <p className="hint" role="status">{msg}</p>}
      {list.length > 0 && host && (
        <>
          <div className={"multistream n" + list.length}>
            {list.map((x, i) => {
              const m = x.match ? matchOf(x.match) : null;
              return (
                <div key={x.url} className="mstile">
                  <div className="msbar">
                    {m ? <StreamScore m={m} /> : <span className="msname">{streamName(x.url)}</span>}
                    <select value={x.match} onChange={(e) => save(list.map((y, j) => (j === i ? { ...y, match: e.target.value } : y)))} aria-label={tr("Match shown above")}>
                      <option value="">{tr("No match")}</option>
                      {live.map((mm) => <option key={mm.event + mm.id} value={`${mm.event}:${mm.id}`}>{(mm.a && mm.a.tag) || (mm.a && mm.a.name)} vs {(mm.b && mm.b.tag) || (mm.b && mm.b.name)}</option>)}
                    </select>
                    <button type="button" className="msx" onClick={() => save(list.filter((_, j) => j !== i))} aria-label={tr("Remove this stream")} title={tr("Remove this stream")}>×</button>
                  </div>
                  <div className="liveplayer"><iframe src={embedUrl(x.url, host)} title={streamName(x.url)} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div>
                </div>
              );
            })}
          </div>
          <p className="row"><button type="button" className="btn" onClick={share}>🔗 {tr("Share this view")}</button> <button type="button" className="btn" onClick={() => save([])}>{tr("Remove all")}</button></p>
        </>
      )}
      {list.length === 0 && <p className="hint">{tr("Up to 4 streams side by side, kept on this device. Share the view and others see the same streams.")}</p>}
    </section>
  );
}
