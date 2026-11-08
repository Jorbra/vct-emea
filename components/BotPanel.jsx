"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "./lang.jsx";

const ANNOUNCE = [["start", "Match starts"], ["result", "Results"], ["image", "Results with picture"], ["transfers", "Transfers (free agents, signings)"], ["news", "News"]];

/** The Discord bot's dashboard, in the editor's home: where it posts, what, which role, its language, its commands, its use. */
export default function BotPanel() {
  const tr = useT();
  const [d, setD] = useState(null);
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState({ ok: true, text: "" });
  const [busy, setBusy] = useState(false);
  const load = useCallback((guild = "") => {
    fetch(`/api/bot${guild ? `?guild=${guild}` : ""}`).then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!j) return;
      setD(j);
      setS((cur) => cur ? { ...cur, guild: j.guild || cur.guild } : { ...j.settings, guild: j.guild || j.settings.guild });
    }).catch(() => { /* offline */ });
  }, []);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (open && !d) load(); }, [open, d, load]);
  const call = async (body) => {
    setBusy(true);
    setMsg({ ok: true, text: "" });
    try {
      const r = await fetch("/api/bot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setMsg({ ok: true, text: tr.server(j.message) });
    } catch (e) { setMsg({ ok: false, text: tr.server(e.message) }); } finally { setBusy(false); }
  };
  const set = (k, v) => setS((x) => ({ ...x, [k]: v }));
  const pick = (label, key, list, none = true) => (
    <label className="f">{label}
      <select value={s[key] || ""} onChange={(e) => { set(key, e.target.value); if (key === "guild") load(e.target.value); }}>
        {none && <option value="">{tr("None")}</option>}
        {list.map((x) => <option key={x.id} value={x.id}>{key === "role" ? "@" : key === "guild" ? "" : "#"}{x.name}</option>)}
      </select>
    </label>
  );
  return (
    <section>
      <details className="einfo botpanel" onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary><b>🤖 {tr("Discord bot")}</b></summary>
        {!d || !s ? <p className="note">{tr("Loading…")}</p> : (
          <>
            <div className="botstate">
              <span>{d.publicKey ? "✅" : "⚠️"} {tr("Public key on Vercel")} : {tr(d.publicKey ? "set" : "missing")}</span>
              <span>{d.token ? "✅" : "⚠️"} {tr("Bot token on Vercel")} : {tr(d.token ? "set" : "missing")}</span>
            </div>
            <p className="hint">{tr("The bot posts by itself once its token is on Vercel (DISCORD_BOT_TOKEN) and a channel is chosen; until then the webhook keeps posting.")}</p>
            {d.error && <p className="err">{d.error}</p>}
            <div className="botgrid">
              {d.token && pick(tr("Server"), "guild", d.guilds, false)}
              {d.token && pick(tr("Announcements channel"), "channel", d.channels)}
              {d.token && pick(tr("Pinned message channel (today's matches, live)"), "pinChannel", d.channels)}
              {d.token && pick(tr("Role to mention at a match start"), "role", d.roles)}
              <label className="f">{tr("Role to mention at a match start")}
                <select value={s.roleWhen} onChange={(e) => set("roleWhen", e.target.value)}>
                  <option value="none">{tr("Never")}</option><option value="final">{tr("Final rounds only")}</option><option value="all">{tr("Every match")}</option>
                </select>
              </label>
              <label className="f">{tr("Bot language")}
                <select value={s.lang} onChange={(e) => set("lang", e.target.value)}><option value="fr">Français</option><option value="en">English</option></select>
              </label>
            </div>
            <fieldset><legend>{tr("What to post")}</legend>
              {ANNOUNCE.map(([k, l]) => <label key={k} className="chk"><input type="checkbox" checked={!!s.announce[k]} onChange={(e) => set("announce", { ...s.announce, [k]: e.target.checked })} /> {tr(l)}</label>)}
            </fieldset>
            <fieldset><legend>{tr("Events")}</legend>
              {Object.keys(s.events).map((e) => <label key={e} className="chk"><input type="checkbox" checked={s.events[e]} onChange={(x) => set("events", { ...s.events, [e]: x.target.checked })} /> {tr(d.events[e] || e)}</label>)}
            </fieldset>
            <fieldset><legend>{tr("Commands turned on")}</legend>
              {d.commands.map((c) => <label key={c.name} className="chk" title={c.description}><input type="checkbox" checked={!s.disabled.includes(c.name)} onChange={(e) => set("disabled", e.target.checked ? s.disabled.filter((x) => x !== c.name) : [...s.disabled, c.name])} /> /{c.name}</label>)}
            </fieldset>
            <div className="row" style={{ marginTop: 10 }}>
              <button type="button" className="btn pri" disabled={busy} onClick={() => call({ action: "save", ...s })}>{tr("Save the bot's settings")}</button>
              <button type="button" className="btn" disabled={busy || !d.token} onClick={() => call({ action: "test" })}>{tr("Send a test message")}</button>
              <button type="button" className="btn" disabled={busy || !d.token} onClick={() => call({ action: "register" })}>{tr("Register the commands with Discord")}</button>
            </div>
            {msg.text && <p className={msg.ok ? "okmsg" : "err"} role="status">{msg.text}</p>}
            <p className="hint">{tr("Give the bot the right to see the channels and send messages there (and to pin, for the pinned message).")}</p>
            <h3 className="sub">{tr("Uses (30 days)")}</h3>
            <div className="botstats">
              <span><b>{d.usage.total}</b> {tr("Uses (30 days)").toLowerCase()}</span>
              <span><b>{d.usage.users}</b> {tr("Users").toLowerCase()}</span>
              <span><b>{d.usage.week}</b> {tr("This week").toLowerCase()}</span>
              <span><b>{d.usage.follows}</b> {tr("Following a team").toLowerCase()}</span>
              <span><b>{d.usage.links}</b> {tr("Tied to a site name").toLowerCase()}</span>
            </div>
            {d.usage.byCmd.length > 0 && <p className="note">{d.usage.byCmd.map((c) => `/${c.cmd} ${c.n}`).join(" · ")}</p>}
          </>
        )}
      </details>
    </section>
  );
}
