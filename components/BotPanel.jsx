"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "./lang.jsx";

const ANNOUNCE = [["start", "Match starts"], ["result", "Results"], ["image", "Results with picture"], ["transfers", "Transfers (free agents, signings)"], ["news", "News"]];
const TABS = [["settings", "Settings"], ["announce", "Announcement"], ["pin", "Pinned message"], ["stats", "Statistics"]];

/** A Discord card as Discord draws it, roughly: for the pinned message's preview. */
function EmbedPreview({ e }) {
  return (
    <div className="dembed">
      {e.title && <b className="dtitle">{e.title}</b>}
      {e.description && <p>{e.description}</p>}
      {(e.fields || []).map((f, i) => <div key={i} className="dfield"><b>{f.name}</b><p>{String(f.value).replace(/<t:(\d+):[a-zA-Z]>/g, (_, s) => new Date(Number(s) * 1000).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })).replace(/\*\*/g, "")}</p></div>)}
      {e.footer && <small>{e.footer.text}</small>}
    </div>
  );
}

/** The Discord bot's dashboard, in the editor's home: settings, a manual announcement, the pinned message, its use. */
export default function BotPanel() {
  const tr = useT();
  const [d, setD] = useState(null);
  const [s, setS] = useState(null);
  const [tab, setTab] = useState("settings");
  const [msg, setMsg] = useState({ ok: true, text: "" });
  const [busy, setBusy] = useState(false);
  const [ann, setAnn] = useState({ title: "", text: "", embed: true, mention: false, channel: "" });
  const [open, setOpen] = useState(false);
  const load = useCallback((guild = "") => {
    fetch(`/api/bot${guild ? `?guild=${guild}` : ""}`).then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!j) return;
      setD(j);
      setS((cur) => (cur ? { ...cur, guild: j.guild || cur.guild } : { ...j.settings, guild: j.guild || j.settings.guild }));
    }).catch(() => { /* offline */ });
  }, []);
  useEffect(() => { if (open && !d) load(); }, [open, d, load]);
  const call = async (body, after) => {
    setBusy(true);
    setMsg({ ok: true, text: "" });
    try {
      const r = await fetch("/api/bot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setMsg({ ok: true, text: tr.server(j.message) });
      if (after) after();
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
  const missing = d && d.registered ? d.commands.filter((c) => !d.registered.includes(c.name)).length : null;
  const state = (ok, label, value) => <span className={"bstate " + (ok ? "ok" : "bad")}>{ok ? "✅" : "⚠️"} {label} : <b>{value}</b></span>;
  const max = d ? Math.max(1, ...d.usage.days.map((x) => x.n)) : 1;
  const cmdMax = d && d.usage.byCmd.length ? d.usage.byCmd[0].n : 1;
  return (
    <section>
      <details className="einfo botpanel" onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary><b>🤖 {tr("Discord bot")}</b>{d && <small> · {d.usage.total} {tr("Uses (30 days)").toLowerCase()}</small>}</summary>
        {!d || !s ? <p className="note">{tr("Loading…")}</p> : (
          <>
            <div className="botstate">
              {state(d.publicKey, tr("Public key on Vercel"), tr(d.publicKey ? "set" : "missing"))}
              {state(d.token && !d.error, tr("Bot token on Vercel"), tr(d.token ? (d.error ? "refused" : "set") : "missing"))}
              {state(missing === 0, tr("Commands on Discord"), missing == null ? tr("unknown") : missing === 0 ? tr("up to date") : tr("{n} to register", { n: missing }))}
              {missing > 0 && <button type="button" className="btn small pri" disabled={busy} onClick={() => call({ action: "register" }, () => load(s.guild))}>{tr("Register the commands with Discord")}</button>}
            </div>
            {d.error && <p className="err">{tr.server(d.error)}</p>}
            <div className="tabs sub" role="tablist" aria-label={tr("Discord bot")}>
              {TABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setMsg({ ok: true, text: "" }); }}>{tr(l)}</button>)}
            </div>

            {tab === "settings" && (
              <>
                <p className="hint">{tr("The bot posts by itself once its token is on Vercel (DISCORD_BOT_TOKEN) and a channel is chosen; until then the webhook keeps posting.")}</p>
                <div className="botgrid">
                  {d.token && pick(tr("Server"), "guild", d.guilds, false)}
                  {d.token && pick(tr("Announcements channel"), "channel", d.channels)}
                  {d.token && pick(tr("Pinned message channel (today's matches, live)"), "pinChannel", d.channels)}
                  {d.token && pick(tr("Role to mention at a match start"), "role", d.roles)}
                  <label className="f">{tr("When to mention it")}
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
                <fieldset><legend>{tr("Commands turned on")} <small>({d.commands.length - s.disabled.length}/{d.commands.length})</small></legend>
                  {d.commands.map((c) => <label key={c.name} className="chk" title={c.description}><input type="checkbox" checked={!s.disabled.includes(c.name)} onChange={(e) => set("disabled", e.target.checked ? s.disabled.filter((x) => x !== c.name) : [...s.disabled, c.name])} /> /{c.name}</label>)}
                </fieldset>
                <div className="row" style={{ marginTop: 10 }}>
                  <button type="button" className="btn pri" disabled={busy} onClick={() => call({ action: "save", ...s })}>{tr("Save the bot's settings")}</button>
                  <button type="button" className="btn" disabled={busy || !d.token} onClick={() => call({ action: "test" })}>{tr("Send a test message")}</button>
                  <button type="button" className="btn" disabled={busy || !d.token} onClick={() => call({ action: "register" }, () => load(s.guild))}>{tr("Register the commands with Discord")}</button>
                </div>
                <p className="hint">{tr("Give the bot the right to see the channels and send messages there (and to pin, for the pinned message).")}</p>
              </>
            )}

            {tab === "announce" && (
              <form className="acctform" onSubmit={(e) => { e.preventDefault(); call({ action: "announce", ...ann, channel: s._annChannel || "" }, () => setAnn((a) => ({ ...a, title: "", text: "" }))); }}>
                <h3 className="sub">{tr("Write an announcement")}</h3>
                {d.token && pick(tr("Channel"), "_annChannel", d.channels)}
                {ann.embed && <label className="f">{tr("Title (optional)")}<input value={ann.title} maxLength={200} onChange={(e) => setAnn({ ...ann, title: e.target.value })} /></label>}
                <label className="f">{tr("Your message")}<textarea rows={5} maxLength={1900} value={ann.text} onChange={(e) => setAnn({ ...ann, text: e.target.value })} /></label>
                <div className="row">
                  <label className="chk"><input type="checkbox" checked={ann.embed} onChange={(e) => setAnn({ ...ann, embed: e.target.checked })} /> {tr("As a card (embed)")}</label>
                  <label className="chk"><input type="checkbox" checked={ann.mention} disabled={!s.role} onChange={(e) => setAnn({ ...ann, mention: e.target.checked })} /> {tr("Mention the role")}</label>
                </div>
                <button type="submit" className="btn pri" disabled={busy || !d.token || !ann.text.trim()}>{tr("Send the announcement")}</button>
                <p className="hint">{tr("Announcements channel (default)")} : {(d.channels.find((c) => c.id === s.channel) || {}).name ? `#${d.channels.find((c) => c.id === s.channel).name}` : "–"}</p>
              </form>
            )}

            {tab === "pin" && (
              <>
                <h3 className="sub">{tr("Preview of the pinned message")}</h3>
                <EmbedPreview e={d.pinPreview} />
                <div className="row" style={{ marginTop: 10 }}>
                  <button type="button" className="btn pri" disabled={busy || !d.token || !s.pinChannel} onClick={() => call({ action: "pin-now" })}>{tr("Update it now")}</button>
                </div>
                <p className="hint">{tr("The bot updates it by itself every minute when something changes.")} {tr("Pinned message channel (today's matches, live)")} : {(d.channels.find((c) => c.id === s.pinChannel) || {}).name ? `#${d.channels.find((c) => c.id === s.pinChannel).name}` : "–"}</p>
              </>
            )}

            {tab === "stats" && (
              <>
                <div className="botstats">
                  <span><b>{d.usage.total}</b> {tr("Uses (30 days)").toLowerCase()}</span>
                  <span><b>{d.usage.users}</b> {tr("Users").toLowerCase()}</span>
                  <span><b>{d.usage.week}</b> {tr("This week").toLowerCase()}</span>
                  <span><b>{d.usage.clicks}</b> {tr("Prediction clicks").toLowerCase()}</span>
                  <span><b>{d.usage.follows}</b> {tr("Following a team").toLowerCase()}</span>
                  <span><b>{d.usage.links}</b> {tr("Tied to a site name").toLowerCase()}</span>
                </div>
                <h3 className="sub">{tr("Uses per day (14 days)")}</h3>
                <div className="visitbars" role="img" aria-label={tr("Uses per day (14 days)")}>
                  {d.usage.days.map((x) => <div key={x.day} className="vbar" title={`${x.day} : ${x.n}`}><i style={{ height: `${Math.round((x.n / max) * 100)}%` }} /><small>{x.day.slice(8)}</small></div>)}
                </div>
                <div className="cols2">
                  <div>
                    <h3 className="sub">{tr("Most used commands (30 days)")}</h3>
                    {d.usage.byCmd.length === 0 ? <p className="note">{tr("No use yet.")}</p> : (
                      <ul className="hbars">{d.usage.byCmd.map((c) => <li key={c.cmd}><span>/{c.cmd.replace("pronostic-clic", "pronostic (clic)")}</span><i style={{ width: `${Math.round((c.n / cmdMax) * 100)}%` }} /><b>{c.n}</b></li>)}</ul>
                    )}
                  </div>
                  <div>
                    <h3 className="sub">{tr("Most followed teams")}</h3>
                    {d.usage.topFollows.length === 0 ? <p className="note">{tr("No use yet.")}</p> : (
                      <ul className="hbars">{d.usage.topFollows.map((f) => <li key={f.name}><span>{f.name}</span><i style={{ width: `${Math.round((f.n / d.usage.topFollows[0].n) * 100)}%` }} /><b>{f.n}</b></li>)}</ul>
                    )}
                  </div>
                </div>
              </>
            )}
            {msg.text && <p className={msg.ok ? "okmsg" : "err"} role="status">{msg.text}</p>}
          </>
        )}
      </details>
    </section>
  );
}
