"use client";

// One ticket read in the editor, as a Discord conversation: its details (subject, author, category, who took it, why it
// was closed, the rating, the form's answers) and its messages, saved or live. Written in French, as the editors read it.
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { ask, Who } from "./BotPages.jsx";

const when = (iso) => (iso ? new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "–");
const dayOf = (iso) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : "");
const IMAGE = /\.(png|jpe?g|gif|webp)(\?|$)/i;
// a colour per author, picked from their name, for the round initial when there is no avatar
const HUES = ["#5865f2", "#3ba55d", "#e0a526", "#eb459e", "#ed4245", "#4a8ef0", "#9b59b6", "#1abc9c"];
const hueOf = (name) => HUES[[...String(name)].reduce((n, c) => n + c.charCodeAt(0), 0) % HUES.length];

/** A message's text: **bold**, *italic*, `code`, links, mentions of members by their names. */
function Text({ text, names }) {
  const parts = String(text || "").split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|https?:\/\/[^\s<>]+|<@!?\d+>|<#\d+>|<@&\d+>)/g);
  return parts.map((p, k) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <b key={k}>{p.slice(2, -2)}</b>;
    if (/^\*[^*]+\*$/.test(p)) return <i key={k}>{p.slice(1, -1)}</i>;
    if (/^`[^`]+`$/.test(p)) return <code key={k}>{p.slice(1, -1)}</code>;
    if (/^https?:\/\//.test(p)) return <a key={k} href={p} target="_blank" rel="noreferrer noopener">{p}</a>;
    const u = p.match(/^<@!?(\d+)>$/);
    if (u) return <span key={k} className="dmention">@{(names && names[u[1]]) || "membre"}</span>;
    if (/^<#\d+>$/.test(p)) return <span key={k} className="dmention">#salon</span>;
    if (/^<@&\d+>$/.test(p)) return <span key={k} className="dmention">@rôle</span>;
    return <Fragment key={k}>{p}</Fragment>;
  });
}

/** The ticket, in a panel over the page. Escape or the button closes it. */
export function TicketView({ guild, thread, onClose, onMember, onChanged }) {
  const [data, setData] = useState(null);
  const [reply, setReply] = useState("");
  const [reason, setReason] = useState("");
  const [closing, setClosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [say, setSay] = useState({ ok: true, text: "" });
  const box = useRef(null);
  const closeRef = useRef(null);
  const atEnd = useRef(true);
  const load = useCallback(() => ask({ action: "ticket", guild, thread }).then((j) => setData((cur) => (j.error && cur ? cur : j))), [guild, thread]);
  useEffect(() => { setData(null); setSay({ ok: true, text: "" }); setClosing(false); atEnd.current = true; load(); }, [load]);
  // an open ticket read live: its new messages come every 15 seconds while the panel is open and the page seen
  const live = !!(data && data.source === "live" && data.ticket && !data.ticket.closed);
  useEffect(() => {
    if (!live) return undefined;
    const id = setInterval(() => { if (document.visibilityState === "visible") load(); }, 15000);
    return () => clearInterval(id);
  }, [live, load]);
  const act = async (body, done) => {
    setBusy(true);
    setSay({ ok: true, text: "" });
    const j = await ask({ ...body, guild, thread });
    setBusy(false);
    // on an error too, the ticket is read again: a thread deleted on Discord shows as such
    if (j.error) { setSay({ ok: false, text: j.error }); await load(); return; }
    setSay({ ok: true, text: j.message || "" });
    if (done) done();
    atEnd.current = true;
    await load();
    if (onChanged) onChanged();
  };
  useEffect(() => {
    const key = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    if (closeRef.current) closeRef.current.focus();
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  // the conversation opens on its last messages, as on Discord
  // (and stays on them as new ones come, unless the editor scrolled up to read)
  useEffect(() => { if (data && box.current && atEnd.current) box.current.scrollTop = box.current.scrollHeight; }, [data]);
  const onScroll = () => { const el = box.current; if (el) atEnd.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; };
  const t = data && data.ticket;
  const names = (data && data.names) || {};
  const msgs = (data && data.messages) || [];
  return (
    <div className="btkback" onClick={onClose}>
      <aside className="btkview" role="dialog" aria-modal="true" aria-label={t ? `Ticket : ${t.subject || "sans sujet"}` : "Ticket"} onClick={(e) => e.stopPropagation()}>
        <header className="btkhead">
          <div>
            <h3>🎫 {t ? t.subject || "Sans sujet" : "Ticket"}</h3>
            {t && <small>{t.closed ? <>📁 fermé {when(t.closed)}</> : <span className="bopen">● ouvert</span>}{t.category ? ` · ${t.category}` : ""}{t.priority ? ` · priorité ${t.priority}` : ""}</small>}
          </div>
          <button ref={closeRef} type="button" className="btn small" onClick={onClose}>Fermer</button>
        </header>
        {!data ? <p className="note">Chargement du ticket…</p> : data.error ? <p className="err">{data.error}</p> : (
          <>
            <dl className="btkfacts">
              <dt>Ouvert par</dt><dd><Who id={t.user} names={names} onMember={onMember ? (id) => { onClose(); onMember(id); } : undefined} /> · {when(t.opened)}</dd>
              <dt>Pris en charge</dt><dd>{t.claimed ? <Who id={t.claimed} names={names} /> : "personne"}</dd>
              {t.first_reply && <><dt>Première réponse</dt><dd>en {Math.max(1, Math.round(Number(t.first_reply) / 60000))} min</dd></>}
              {t.closed && <><dt>Raison de fermeture</dt><dd>{t.reason || "–"}</dd></>}
              {t.rating && <><dt>Note</dt><dd aria-label={`${t.rating} sur 5`}>{"★".repeat(Number(t.rating))}{"☆".repeat(5 - Number(t.rating))}</dd></>}
            </dl>
            {t.details && <div className="btkform"><b>Réponses au formulaire</b><p>{t.details}</p></div>}
            <p className="btksrc bmuted">
              {live ? "Messages lus en direct sur Discord, mis à jour toutes les 15 secondes." : data.source === "live" ? "Messages lus sur Discord." : data.source === "transcript" ? "Transcription enregistrée à la fermeture." : t.closed ? "Aucune transcription n'a été enregistrée pour ce ticket." : "Les messages d'un ticket ouvert se lisent avec le jeton du bot."}
              {!data.gone && <>{" "}<a href={`https://discord.com/channels/${data.guild}/${t.thread}`} target="_blank" rel="noreferrer noopener">Ouvrir dans Discord ↗</a></>}
            </p>
            <div className="btkchat" ref={box} tabIndex={0} aria-label="Messages du ticket" onScroll={onScroll}>
              {msgs.length === 0 ? <p className="note">Aucun message à afficher.</p> : msgs.map((m, k) => {
                const prev = msgs[k - 1];
                const newDay = !prev || dayOf(prev.at) !== dayOf(m.at);
                // a message right after another by the same author, within 7 minutes, joins it (as on Discord)
                const joined = prev && !newDay && prev.who === m.who && Date.parse(m.at) - Date.parse(prev.at) < 7 * 60000;
                return (
                  <Fragment key={k}>
                    {newDay && <div className="btkday"><span>{dayOf(m.at)}</span></div>}
                    <div className={"btkmsg" + (joined ? " joined" : "")}>
                      {!joined && (m.avatar ? <img className="btkav" src={m.avatar} alt="" width={36} height={36} loading="lazy" /> : <span className="btkav" style={{ background: hueOf(m.who) }} aria-hidden="true">{m.who.slice(0, 1).toUpperCase()}</span>)}
                      <div className="btkbody">
                        {!joined && <div className="btkwho"><b>{m.who}</b>{m.bot && <span className="dbot">BOT</span>}<small>{when(m.at)}</small></div>}
                        {m.text && <div className="btktext"><Text text={m.text} names={names} /></div>}
                        {m.embeds.map((e, j) => <div key={j} className="btkembed"><Text text={e} names={names} /></div>)}
                        {m.files.map((f, j) => (IMAGE.test(f)
                          ? <a key={j} href={f} target="_blank" rel="noreferrer noopener"><img className="btkimg" src={f} alt="Image jointe" loading="lazy" /></a>
                          : <a key={j} className="btkfile" href={f} target="_blank" rel="noreferrer noopener">📎 {decodeURIComponent(f.split("/").pop().split("?")[0])}</a>))}
                      </div>
                    </div>
                  </Fragment>
                );
              })}
            </div>
            {say.text && <p className={say.ok ? "okmsg" : "err"} role="status">{say.text}</p>}
            {data.gone ? (
              <p className="note warn btkgone">🗑️ Le fil de ce ticket a été supprimé sur Discord : on ne peut plus y répondre ni le rouvrir. {data.source === "transcript" ? "La transcription reste lisible ici." : ""}</p>
            ) : !t.closed ? (
              <div className="btkact">
                {!closing ? (
                  <form className="btkreply" onSubmit={(e) => { e.preventDefault(); act({ action: "ticket-reply", text: reply }, () => setReply("")); }}>
                    <label className="sr-only" htmlFor="btkreply">Répondre dans le ticket</label>
                    <textarea id="btkreply" rows={2} maxLength={1800} value={reply} placeholder="Répondre dans le ticket… (Ctrl + Entrée pour envoyer)" onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && reply.trim() && !busy) { e.preventDefault(); act({ action: "ticket-reply", text: reply }, () => setReply("")); } }} />
                    <div className="row">
                      <button type="submit" className="btn pri" disabled={busy || !reply.trim()}>Envoyer</button>
                      <button type="button" className="btn danger" disabled={busy} onClick={() => setClosing(true)}>🔒 Fermer le ticket</button>
                    </div>
                    <small className="bmuted">Le bot écrit la réponse dans le fil, avec ton nom d&apos;éditeur.</small>
                  </form>
                ) : (
                  <form className="btkreply" onSubmit={(e) => { e.preventDefault(); act({ action: "ticket-close", reason }, () => { setClosing(false); setReason(""); }); }}>
                    <label className="f">Raison de la fermeture <small className="bmuted">(facultative, envoyée au membre)</small>
                      <input type="text" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
                    </label>
                    <div className="row">
                      <button type="submit" className="btn danger" disabled={busy}>Fermer le ticket</button>
                      <button type="button" className="btn" disabled={busy} onClick={() => setClosing(false)}>Annuler</button>
                    </div>
                    <small className="bmuted">Comme sur Discord : transcription enregistrée, message privé au membre avec la note à donner, fil verrouillé.</small>
                  </form>
                )}
              </div>
            ) : (
              <div className="btkact row">
                <button type="button" className="btn" disabled={busy} onClick={() => act({ action: "ticket-reopen" })}>🔓 Rouvrir le ticket</button>
                <small className="bmuted">Le fil est déverrouillé et le membre peut de nouveau écrire.</small>
              </div>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
