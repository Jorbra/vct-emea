"use client";

import { useEffect, useMemo, useState } from "react";
import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import { ThemeSwitch } from "./theme.jsx";
import { EmeaMark } from "./Brand.jsx";
import SearchBar from "./SearchBar.jsx";
import SiteNav from "./SiteNav.jsx";
import { Flag } from "./TeamCard.jsx";
import { localeOf } from "../lib/i18n.js";
import { teamSlug } from "../lib/paths.js";

/** Liquipedia's role in the visitor's words: a benched player was "Inactive" before being let go. */
const roleText = (p, tr) => {
  if (!p.role) return p.staff ? "" : tr("Player");
  if (/^inactive$/i.test(p.role)) return tr("Player (benched)");
  if (/^substitute$/i.test(p.role)) return tr("Substitute");
  if (/^stand-?in$/i.test(p.role)) return tr("Stand-in");
  return p.role;
};

const plain = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function View({ list, at, pages }) {
  const tr = useT();
  const [tab, setTab] = useState("players");
  const [q, setQ] = useState("");
  const [days, setDays] = useState(null); // dates in the visitor's language, once in the browser
  useEffect(() => {
    const f = new Intl.DateTimeFormat(localeOf(tr.lang), { day: "numeric", month: "short", year: "numeric" });
    setDays((d) => (iso) => f.format(new Date(`${iso}T12:00:00Z`)));
  }, [tr.lang]);
  const shown = useMemo(() => list.filter((p) => (tab === "staff" ? p.staff : !p.staff)).filter((p) => !q || plain(p.name).includes(plain(q)) || plain(p.from).includes(plain(q))), [list, tab, q]);
  const count = (staff) => list.filter((p) => p.staff === staff).length;
  return (
    <div className="wrap teampage">
      <div className="topbar">
        <h1 className="brandh"><a className="homelink" href="/" title={tr("Home")}><EmeaMark /></a><span>{tr("LFT players")}</span></h1>
        <SearchBar />
        <div className="prefs"><ThemeSwitch /><LangSwitch /></div>
      </div>
      <SiteNav />
      <p className="note">{tr("Players and staff of the EMEA region whose team let them go in the last six months, with no new team announced since.")}</p>
      <div className="lftbar">
        <div className="tabs sub" role="tablist" aria-label={tr("LFT players")}>
          <button type="button" role="tab" aria-selected={tab === "players"} onClick={() => setTab("players")}>{tr("Players")} <small>{count(false)}</small></button>
          <button type="button" role="tab" aria-selected={tab === "staff"} onClick={() => setTab("staff")}>{tr("Coaches and staff")} <small>{count(true)}</small></button>
        </div>
        <input type="search" className="lftfind" placeholder={tr("Find a player or a team")} aria-label={tr("Find a player or a team")} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {!pages ? <p className="note">{tr("The list is being read on Liquipedia: come back in a few minutes.")}</p> : shown.length === 0 ? <p className="note">{tr("Nobody here.")}</p> : (
        <div className="tablewrap wide">
          <table className="cards">
            <thead><tr><th>{tr("Free since")}</th><th>{tr("Player")}</th><th>{tr("Former team")}</th><th>{tr("Role")}</th><th>{tr("Source")}</th></tr></thead>
            <tbody>
              {shown.map((p) => (
                <tr key={`${p.name}|${p.date}|${p.from}`}>
                  <td className="nowrap" data-label={tr("Free since")}>{days ? days(p.date) : p.date}</td>
                  <td data-label={tr("Player")}><span className="pt">{p.cc ? <Flag cc={p.cc} /> : null}<a href={`/player/${teamSlug(p.name)}`}>{p.name}</a></span></td>
                  <td data-label={tr("Former team")}>{p.fromHref ? <a href={p.fromHref}>{p.from}</a> : p.from}</td>
                  <td data-label={tr("Role")}>{roleText(p, tr)}</td>
                  <td data-label={tr("Source")}>{p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer">{tr("Announcement")}</a> : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="note">{tr("From the transfer pages of")} <a href="https://liquipedia.net/valorant/Portal:Transfers" target="_blank" rel="noopener noreferrer">Liquipedia</a> (CC-BY-SA). {tr("A player who signed without an announcement on Liquipedia may still show.")}{at ? ` ${tr("Updated: {when}", { when: days ? days(at.slice(0, 10)) : at.slice(0, 10) })}` : ""}</p>
    </div>
  );
}

export const LftPage = ({ lang, ...props }) => <LangProvider lang={lang}><View {...props} /></LangProvider>;
