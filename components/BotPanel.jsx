"use client";

// The Discord bot's dashboard, in the editor's home. The home shows the bot's state (online, latency, server, members),
// shortcuts, and one card per module (switch, what it does, its state, "Configurer"); each module has its own page, and
// the "Commandes", "Sanctions", "Tickets", "Journal", "Statistiques" and "Réglages" pages sit in the menu.
import { useCallback, useEffect, useState } from "react";
import { useT } from "./lang.jsx";
import { Skeleton } from "./visual.jsx";
import BotServer from "./BotServer.jsx";
import { DiscordMessage, EmbedBuilder, MessageEditor, ModuleCard, Picker } from "./BotDash.jsx";
import { CasesPage, CommandsPage, LogPage, TicketsPage } from "./BotPages.jsx";
import { ActivityPanel, MembersPage } from "./BotMembers.jsx";
import { MODULES, moduleState } from "../lib/botdash.js";
import { P } from "../lib/botperms.js";

const ANNOUNCE = [["start", "Match starts"], ["result", "Results"], ["image", "Results with picture"], ["transfers", "Transfers (free agents, signings)"], ["news", "News"]];
const KINDS = [["start", "Match start"], ["result", "Result"], ["reminder", "Reminder 15 min"], ["live", "Live score message"], ["poll", "Poll"], ["daily", "Evening summary"]];
const AUTO = [["reminder", "Reminder 15 minutes before each match"], ["daily", "Evening summary at 10 pm (the day's results)"], ["weekly", "Prediction ranking every Monday at 10 am"], ["liveEdit", "One message per live match, updated as it goes"], ["polls", "A poll \"Who wins?\" before the final rounds"], ["fanRoles", "Fans' roles: /suivre gives the team's role, mentioned at its matches"], ["recap", "The recap of a qualifier as soon as it ends"], ["threadMaps", "In each match's thread: every map's result, then the series'"], ["oracle", "Oracle of the week: every Monday, the server's best predictor gets the role"], ["games", "Games of the day every morning at 9, with yesterday's best"], ["weekRecap", "The week's recap as a picture every Monday at 11"], ["pronoDm", "Private reminder to predict (for those who asked with /rappelprono)"], ["qualified", "A picture each time a team qualifies for the next event"], ["motd", "Prediction of the day at noon, with buttons, and its result once played"], ["teamWeek", "The team of the week every Monday at noon (the best player per role)"], ["tiers", "Bronze, Silver and Gold predictor roles on the server, by points (once a day)"], ["closeMatch", "A message when a live match goes to overtime or to its deciding map"]];
// the automatic messages, by when they happen
const AUTO_GROUPS = [
  ["During the matches", ["reminder", "liveEdit", "threadMaps", "closeMatch", "polls"]],
  ["Every day", ["daily", "games", "motd", "pronoDm", "tiers"]],
  ["Every week", ["weekly", "oracle", "weekRecap", "teamWeek"]],
  ["As the events go", ["recap", "qualified", "fanRoles"]],
];
// the menu: the home, then the pages that are not a module
const PAGES = [["home", "🏠 Accueil"], ["commands", "⌨️ Commandes"], ["members", "👤 Membres"], ["cases", "⚖️ Sanctions"], ["tickets", "🎫 Tickets"], ["log", "📜 Journal"], ["stats", "📈 Statistiques"], ["settings", "⚙️ Réglages"]];
// the announcements module's tabs
const ANN_TABS = [["settings", "Salons et contenu"], ["auto", "Messages automatiques"], ["announce", "Écrire une annonce"], ["embeds", "Messages préparés (/embed)"], ["samples", "Exemples"], ["pin", "Message épinglé"]];
const when = (iso) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** One option as a switch, its whole row clickable. */
function Toggle({ checked, onChange, children, title, disabled = false }) {
  return (
    <label className={"btoggle" + (checked ? " on" : "")} title={title}>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="btsw" aria-hidden="true" />
      <span className="btlabel">{children}</span>
    </label>
  );
}

/** A group of switches with how many are on, and "all" / "none". */
function Group({ title, on, total, onAll, children, wide = false }) {
  const tr = useT();
  return (
    <fieldset className={"bgroup" + (wide ? " wide" : "")}>
      <legend>{title} <small>{on}/{total}</small></legend>
      {onAll && <span className="bgall"><button type="button" className="linkbtn" onClick={() => onAll(true)}>{tr("All")}</button> · <button type="button" className="linkbtn" onClick={() => onAll(false)}>{tr("None")}</button></span>}
      <div className="bgitems">{children}</div>
    </fieldset>
  );
}

/** A Discord embed sent by the site (the examples, the pinned message), in the preview's shape. */
const asEmbed = (e) => ({
  title: e.title || "", color: e.color ? `#${Number(e.color).toString(16).padStart(6, "0")}` : "#ff4655", image: (e.image && e.image.url) || "",
  text: [e.description || "", e.footer ? `\n${e.footer.text}` : ""].join("").replace(/<t:(\d+):[a-zA-Z]>/g, (_, x) => new Date(Number(x) * 1000).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })),
  fields: (e.fields || []).map((f) => ({ name: f.name, value: String(f.value).replace(/<t:(\d+):[a-zA-Z]>/g, (_, x) => new Date(Number(x) * 1000).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })), inline: !!f.inline })),
});

/** The Discord bot's dashboard, in the editor's home. */
export default function BotPanel() {
  const tr = useT();
  const [d, setD] = useState(null);
  const [s, setS] = useState(null);
  const [page, setPage] = useState("home");
  const [memberQ, setMemberQ] = useState("");
  const [annTab, setAnnTab] = useState("settings");
  const [msg, setMsg] = useState({ ok: true, text: "" });
  const [busy, setBusy] = useState(false);
  const [ann, setAnn] = useState({ title: "", text: "", embed: true, mention: false, at: "", color: "#ff4655", image: "", fields: [] });
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("start");
  const [sample, setSample] = useState(null);
  const [saved, setSaved] = useState(""); // the settings as last saved, to tell what changed
  useEffect(() => {
    if (page !== "mod:announce" || annTab !== "samples") return;
    setSample(null);
    fetch("/api/bot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sample", kind }) })
      .then((r) => r.json()).then((j) => setSample(j.sample || { error: j.error })).catch(() => setSample({ error: "Network error" }));
  }, [page, annTab, kind]);
  const load = useCallback((guild = "") => {
    fetch(`/api/bot${guild ? `?guild=${guild}` : ""}`).then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!j) return;
      setD(j);
      setS((cur) => {
        if (cur) return { ...cur, guild: j.guild || cur.guild };
        const first = { ...j.settings, guild: j.guild || j.settings.guild };
        setSaved(JSON.stringify(first));
        return first;
      });
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
      setMsg({ ok: true, text: j.message ? tr.server(j.message) : "" });
      if (after) after(j);
    } catch (e) { setMsg({ ok: false, text: tr.server(e.message) }); } finally { setBusy(false); }
  };
  const go = (p, tab) => { setPage(p); if (tab) setAnnTab(tab); setMsg({ ok: true, text: "" }); };
  const openMember = (id) => { setMemberQ(String(id)); go("members"); };
  const set = (k, v) => setS((x) => ({ ...x, [k]: v }));
  const dirty = !!s && !!saved && JSON.stringify(s) !== saved;
  const save = () => call({ action: "save", ...s }, () => setSaved(JSON.stringify(s)));
  const pick = (label, key, list, prefix = "#") => <Picker label={label} items={list} value={s[key] || ""} onChange={(v) => { set(key, v); if (key === "guild") load(v); }} prefix={prefix} none={key !== "guild"} />;
  const toAdd = d && d.registered ? d.commands.filter((c) => !d.registered.includes(c.name)).length : null;
  // commands Discord still has that the bot no longer knows (former names, grouped commands): registering takes them away
  const toDrop = d && d.registered ? d.registered.filter((n) => !d.commands.some((c) => c.name === n)).length : 0;
  const missing = toAdd == null ? null : toAdd + toDrop;
  const max = d ? Math.max(1, ...d.usage.days.map((x) => x.n)) : 1;
  const cmdMax = d && d.usage.byCmd.length ? d.usage.byCmd[0].n : 1;
  const g = (d && d.gateway) || {};
  const guildName = d && s ? ((d.guilds || []).find((x) => x.id === s.guild) || {}).name || g.guildName || "" : "";
  const stateOf = (m) => moduleState(m, { server: d.server, settings: s, perms: d.botPerms, gateway: g, P });
  const mod = page.startsWith("mod:") ? MODULES.find((m) => m.key === page.slice(4)) : null;
  const toggleModule = (m, on) => call({ action: "module", key: m.key, on }, (j) => setD((x) => ({ ...x, server: j.server })));
  const settingsBar = (
    <div className={"bsavebar" + (dirty ? " dirty" : "")}>
      <span>{dirty ? tr("Changes not saved yet") : tr("Everything is saved")}</span>
      {dirty && <button type="button" className="btn" disabled={busy} onClick={() => setS(JSON.parse(saved))}>{tr("Undo the changes")}</button>}
      <button type="button" className="btn pri" disabled={busy || !dirty} onClick={save}>{tr("Save the bot's settings")}</button>
    </div>
  );
  return (
    <section>
      <details className="einfo botpanel" onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary><b>🤖 {tr("Discord bot")}</b>{d && <small> · {g.on ? "🟢 en ligne" : "⚪ hors ligne"} · {d.usage.total} {tr("Uses (30 days)").toLowerCase()}</small>}</summary>
        {!d || !s ? <div className="botbody"><Skeleton lines={5} /></div> : (
          <div className="botbody">
            {/* the bot's state and the common actions, on every page */}
            <div className="bdash">
              <div className="bdstate">
                <span className={"bdot " + (g.on ? "on" : "off")} aria-hidden="true" />
                <b>{g.on ? "En ligne" : "Hors ligne"}</b>
                {g.on && g.ping != null && <span className="bmuted">{g.ping} ms</span>}
                {guildName && <span>· {guildName}</span>}
                {g.memberCount ? <span className="bmuted">· {Number(g.memberCount).toLocaleString("fr-FR").replace(/ /g, " ")} membres</span> : null}
                {!d.token && <span className="bbadge bad">jeton absent</span>}
                {d.error && <span className="bbadge bad">{tr.server(d.error)}</span>}
              </div>
              <div className="bdshort">
                {missing > 0 && <button type="button" className="btn small pri" disabled={busy} onClick={() => call({ action: "register" }, () => load(s.guild))}>⬆️ Enregistrer les commandes ({missing})</button>}
                <button type="button" className="btn small" onClick={() => go("mod:announce", "announce")}>📣 Écrire une annonce</button>
                <button type="button" className="btn small" onClick={() => go("cases")}>⚖️ Sanctions</button>
                <button type="button" className="btn small" onClick={() => go("tickets")}>🎫 Tickets{d.ticketStats && d.ticketStats.open ? ` (${d.ticketStats.open})` : ""}</button>
                <button type="button" className="btn small" disabled={busy || !d.token} onClick={() => call({ action: "test" })}>✉️ Message de test</button>
              </div>
            </div>
            <nav className="bnav" aria-label="Pages du bot">
              {PAGES.map(([k, l]) => <button key={k} type="button" aria-current={page === k || (k === "home" && !!mod) ? "page" : undefined} onClick={() => go(k)}>{l}</button>)}
            </nav>

            {page === "home" && (
              <>
                <div className="bmods">
                  {MODULES.map((m) => <ModuleCard key={m.key} m={m} state={stateOf(m)} busy={busy} onToggle={(on) => toggleModule(m, on)} onOpen={() => go(`mod:${m.key}`)} />)}
                </div>
                <ActivityPanel guild={s.guild} go={go} onMember={openMember} />
                {d.botPerms == null && d.token && <p className="hint">Les droits du bot sur le serveur n&apos;ont pas pu être lus : choisis le serveur dans Réglages.</p>}
              </>
            )}

            {mod && (
              <div className="bmodpage">
                <header className="bmodhead">
                  <button type="button" className="btn small" onClick={() => go("home")}>← Accueil</button>
                  <h3><span aria-hidden="true">{mod.icon}</span> {mod.name}</h3>
                  <Toggle checked={stateOf(mod).state !== "off"} disabled={busy} onChange={(on) => toggleModule(mod, on)}>{stateOf(mod).state !== "off" ? "Activé" : "Désactivé"}</Toggle>
                </header>
                <p className="hint">{mod.text}</p>
                {stateOf(mod).why && <p className={"note" + (stateOf(mod).state === "missing" ? " warn" : "")}>{stateOf(mod).why}</p>}
                {mod.key !== "announce" && <BotServer key={mod.key} section={mod.key} d={d} busy={busy} call={call} onSaved={(server) => setD((x) => ({ ...x, server }))} />}
                {mod.key === "logs" && <p className="hint"><button type="button" className="linkbtn" onClick={() => go("log")}>Voir le journal du bot →</button></p>}
                {mod.key === "tickets" && <p className="hint"><button type="button" className="linkbtn" onClick={() => go("tickets")}>Voir les tickets et leurs transcriptions →</button></p>}
                {mod.key === "moderation" && <p className="hint"><button type="button" className="linkbtn" onClick={() => go("cases")}>Voir le tableau des sanctions →</button></p>}
                {mod.key === "announce" && (
                  <>
                    <div className="tabs sub" role="tablist" aria-label="Annonces">
                      {ANN_TABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={annTab === k} onClick={() => { setAnnTab(k); setMsg({ ok: true, text: "" }); }}>{l}</button>)}
                    </div>
                    {annTab === "settings" && (
                      <>
                        <div className="botgrid">
                          {d.token && pick(tr("Announcements channel"), "channel", d.channels)}
                          {d.token && pick(tr("Pinned message channel (today's matches, live)"), "pinChannel", d.channels)}
                          {d.token && pick(tr("Results channel (else the announcements one)"), "resultChannel", d.channels)}
                          {d.token && pick(tr("Transfers channel (else the announcements one)"), "transferChannel", d.channels)}
                          {d.token && pick(tr("Role to mention at a match start"), "role", d.roles, "@")}
                          <label className="f">{tr("When to mention it")}
                            <select value={s.roleWhen} onChange={(e) => set("roleWhen", e.target.value)}>
                              <option value="none">{tr("Never")}</option><option value="final">{tr("Final rounds only")}</option><option value="all">{tr("Every match")}</option>
                            </select>
                          </label>
                        </div>
                        <div className="bgroups">
                          <Group title={tr("What to post")} on={ANNOUNCE.filter(([k]) => s.announce[k]).length} total={ANNOUNCE.length}>
                            {ANNOUNCE.map(([k, l]) => <Toggle key={k} checked={!!s.announce[k]} onChange={(v) => set("announce", { ...s.announce, [k]: v })}>{tr(l)}</Toggle>)}
                          </Group>
                          <Group title={tr("Events")} on={Object.values(s.events).filter(Boolean).length} total={Object.keys(s.events).length}
                            onAll={(v) => set("events", Object.fromEntries(Object.keys(s.events).map((e) => [e, v])))}>
                            {Object.keys(s.events).map((e) => <Toggle key={e} checked={!!s.events[e]} onChange={(v) => set("events", { ...s.events, [e]: v })}>{tr(d.events[e] || e)}</Toggle>)}
                          </Group>
                        </div>
                        <p className="hint">{tr("Give the bot the right to see the channels and send messages there (and to pin, for the pinned message).")}</p>
                        {settingsBar}
                      </>
                    )}
                    {annTab === "auto" && (
                      <>
                        <div className="bgroups">
                          {AUTO_GROUPS.map(([title, keys]) => {
                            const list = AUTO.filter(([k]) => keys.includes(k));
                            return (
                              <Group key={title} title={tr(title)} on={list.filter(([k]) => s.auto[k]).length} total={list.length}>
                                {list.map(([k, l]) => <Toggle key={k} checked={!!s.auto[k]} onChange={(v) => set("auto", { ...s.auto, [k]: v })}>{tr(l)}</Toggle>)}
                              </Group>
                            );
                          })}
                        </div>
                        <div className="botgrid">
                          <label className="f">{tr("A thread for each match that starts")}
                            <select value={s.threads} onChange={(e) => set("threads", e.target.value)}>
                              <option value="none">{tr("Never")}</option><option value="final">{tr("Final rounds only")}</option><option value="all">{tr("Every match")}</option>
                            </select>
                          </label>
                        </div>
                        {settingsBar}
                      </>
                    )}
                    {annTab === "embeds" && <BotServer key="embeds" section="embeds" d={d} busy={busy} call={call} onSaved={(server) => setD((x) => ({ ...x, server }))} />}
                    {annTab === "samples" && (
                      <>
                        <div className="tabs sub" role="tablist" aria-label={tr("Examples")}>
                          {KINDS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)}>{tr(l)}</button>)}
                        </div>
                        {!sample ? <Skeleton lines={3} /> : sample.error ? <p className="note">{tr.server(sample.error)}</p> : (
                          sample.poll
                            ? <DiscordMessage embeds={[{ title: `📊 ${sample.poll.question.text}`, text: `${tr("{n} hours", { n: sample.poll.duration })}`, color: "#5865f2" }]} buttons={sample.poll.answers.map((a) => ({ label: a.poll_media.text, style: "grey" }))} />
                            : <DiscordMessage content={(sample.content || "")} embeds={(sample.embeds || []).map(asEmbed)} />
                        )}
                        <p className="row" style={{ marginTop: 10 }}><button type="button" className="btn pri" disabled={busy || !d.token || !s.channel || !sample || !!sample.error} onClick={() => call({ action: "testkind", kind })}>{tr("Send this example as a test")}</button></p>
                        <p className="hint">{tr("Made with a real match of the site. The test is posted in the announcements channel, marked [TEST].")}</p>
                      </>
                    )}
                    {annTab === "announce" && (
                      <form className="acctform" onSubmit={(e) => { e.preventDefault(); call({ action: "announce", ...ann, at: ann.at ? new Date(ann.at).toISOString() : "", channel: s._annChannel || "" }, () => { setAnn((a) => ({ ...a, title: "", text: "", at: "", fields: [] })); load(s.guild); }); }}>
                        {d.token && pick(tr("Channel"), "_annChannel", d.channels)}
                        <div className="row">
                          <label className="chk"><input type="checkbox" checked={ann.embed} onChange={(e) => setAnn({ ...ann, embed: e.target.checked })} /> {tr("As a card (embed)")}</label>
                          <label className="chk"><input type="checkbox" checked={ann.mention} disabled={!s.role} onChange={(e) => setAnn({ ...ann, mention: e.target.checked })} /> {tr("Mention the role")}</label>
                        </div>
                        {ann.embed
                          ? <EmbedBuilder value={ann} vars={[["{server}", "le nom du serveur", "VCT EMEA"]]} content={ann.mention ? "@rôle" : ""} onChange={(v) => setAnn({ ...ann, ...v })} />
                          : <MessageEditor label={tr("Your message")} value={ann.text} max={1900} rows={5} vars={[["{server}", "le nom du serveur", "VCT EMEA"]]} onChange={(v) => setAnn({ ...ann, text: v })} />}
                        <label className="f">{tr("Send at (optional)")}<input type="datetime-local" value={ann.at} onChange={(e) => setAnn({ ...ann, at: e.target.value })} /></label>
                        <button type="submit" className="btn pri" disabled={busy || !d.token || !ann.text.trim()}>{ann.at ? tr("Schedule the announcement") : tr("Send the announcement")}</button>
                        {d.scheduled.length > 0 && (
                          <>
                            <h3 className="sub">{tr("Scheduled")} ({d.scheduled.length})</h3>
                            <ul className="ahhist">{d.scheduled.map((x) => <li key={x.id}><b>{when(x.at)}</b> · {x.label} <small>#{(d.channels.find((c) => c.id === x.channel) || {}).name || x.channel}</small> <button type="button" className="btn small danger" onClick={() => call({ action: "unschedule", id: x.id }, () => load(s.guild))}>{tr("Cancel")}</button></li>)}</ul>
                          </>
                        )}
                        <p className="hint">{tr("Announcements channel (default)")} : {(d.channels.find((c) => c.id === s.channel) || {}).name ? `#${d.channels.find((c) => c.id === s.channel).name}` : "–"}</p>
                      </form>
                    )}
                    {annTab === "pin" && (
                      <>
                        <DiscordMessage embeds={[asEmbed(d.pinPreview)]} />
                        <div className="row" style={{ marginTop: 10 }}>
                          <button type="button" className="btn pri" disabled={busy || !d.token || !s.pinChannel} onClick={() => call({ action: "pin-now" })}>{tr("Update it now")}</button>
                        </div>
                        <p className="hint">{tr("The bot updates it by itself every minute when something changes.")}</p>
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {page === "commands" && <CommandsPage d={d} settings={s} busy={busy} call={call} onSaved={(j) => { setD((x) => ({ ...x, server: j.server })); setS((x) => ({ ...x, disabled: j.settings.disabled })); setSaved((old) => JSON.stringify({ ...JSON.parse(old || "{}"), disabled: j.settings.disabled })); }} />}
            {page === "members" && <MembersPage guild={s.guild} busy={busy} call={call} start={memberQ} />}
            {page === "cases" && <CasesPage guild={s.guild} busy={busy} call={call} onMember={openMember} />}
            {page === "tickets" && <TicketsPage guild={s.guild} onMember={openMember} />}
            {page === "log" && <LogPage />}

            {page === "settings" && (
              <>
                <div className="botstate">
                  <span className={"bstate " + (d.publicKey ? "ok" : "bad")}>{d.publicKey ? "✅" : "⚠️"} {tr("Public key on the server")} : <b>{tr(d.publicKey ? "set" : "missing")}</b></span>
                  <span className={"bstate " + (d.token && !d.error ? "ok" : "bad")}>{d.token && !d.error ? "✅" : "⚠️"} {tr("Bot token on the server")} : <b>{tr(d.token ? (d.error ? "refused" : "set") : "missing")}</b></span>
                  <span className={"bstate " + (missing === 0 ? "ok" : "bad")}>{missing === 0 ? "✅" : "⚠️"} {tr("Commands on Discord")} : <b>{missing == null ? tr("unknown") : missing === 0 ? tr("up to date") : [toAdd ? tr("{n} to register", { n: toAdd }) : "", toDrop ? tr("{n} former ones taken away", { n: toDrop }) : ""].filter(Boolean).join(" · ")}</b></span>
                </div>
                <div className="botgrid">
                  {d.token && pick(tr("Server"), "guild", d.guilds)}
                  <label className="f">{tr("Bot language")}
                    <select value={s.lang} onChange={(e) => set("lang", e.target.value)}><option value="fr">Français</option><option value="en">English</option></select>
                  </label>
                </div>
                <div className="row" style={{ marginTop: 10 }}>
                  <button type="button" className="btn" disabled={busy || !d.token} onClick={() => call({ action: "register" }, () => load(s.guild))}>{tr("Register the commands with Discord")}</button>
                  {d.invite && <a className="btn" href={d.invite} target="_blank" rel="noopener noreferrer">{tr("Give the bot these rights")} ↗</a>}
                </div>
                <p className="hint">{tr("The bot posts by itself once its token is set on the server (DISCORD_BOT_TOKEN) and a channel is chosen; until then the webhook keeps posting.")}</p>
                <p className="note">🛡️ {tr("Moderation, server and ticket commands: the bot needs the rights to kick, ban, time out, delete messages, manage channels, roles and threads. Its role must also sit above the members it acts on.")}</p>
                {settingsBar}
              </>
            )}

            {page === "stats" && (
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
          </div>
        )}
      </details>
    </section>
  );
}
