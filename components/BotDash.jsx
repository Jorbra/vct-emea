"use client";

// The building blocks of the bot's dashboard in the editor (components/BotPanel.jsx, BotServer.jsx, BotPages.jsx):
// a channel or role picker read from Discord with a search, a message editor with clickable variables, an embed builder,
// and a live preview that looks like a Discord message. Written in French, as the server's editors read it.
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { VARIABLES } from "../lib/botdash.js";

// ---- pickers ----

/** One channel or role from the list, searchable: no id to copy. items: [{ id, name, color? }]; prefix "#" or "@". */
export function Picker({ items = [], value = "", onChange, prefix = "#", placeholder = "Aucun", none = true, label, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef(null);
  const input = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    setTimeout(() => input.current && input.current.focus(), 0);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const cur = items.find((x) => x.id === value);
  const list = items.filter((x) => !q.trim() || x.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 80);
  const pick = (id) => { onChange(id); setOpen(false); setQ(""); };
  const body = (
    <div className="bpick" ref={box}>
      <button type="button" className="bpickbtn" disabled={disabled || !items.length} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {cur ? <span className="bchip" style={cur.color ? { "--chip": cur.color } : undefined}>{prefix}{cur.name}</span> : <span className="bmuted">{items.length ? placeholder : "Choisis d'abord le serveur"}</span>}
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="bpickpop" role="listbox" data-nodirty="" onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
          <input ref={input} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={prefix === "@" ? "Chercher un rôle" : "Chercher un salon"} aria-label="Chercher" onKeyDown={(e) => { if (e.key === "Enter" && list[0]) { e.preventDefault(); pick(list[0].id); } }} />
          <ul>
            {none && <li><button type="button" onClick={() => pick("")}>{placeholder}</button></li>}
            {list.map((x) => <li key={x.id}><button type="button" role="option" aria-selected={x.id === value} onClick={() => pick(x.id)}><span className="bchip" style={x.color ? { "--chip": x.color } : undefined}>{prefix}{x.name}</span></button></li>)}
            {!list.length && <li className="bmuted">Rien ne correspond.</li>}
          </ul>
        </div>
      )}
    </div>
  );
  return label ? <div className="f"><span>{label}</span>{body}</div> : body;
}

/** Several channels or roles: chips with ×, and a searchable list to add one. */
export function MultiPicker({ items = [], value = [], onChange, prefix = "#", label, add = "Ajouter" }) {
  const left = items.filter((x) => !value.includes(x.id));
  return (
    <div className="f bmulti">
      {label && <span>{label}</span>}
      <div className="bchips">
        {value.map((id) => {
          const x = items.find((y) => y.id === id) || { id, name: "inconnu" };
          return <span key={id} className="bchip" style={x.color ? { "--chip": x.color } : undefined}>{prefix}{x.name}<button type="button" aria-label={`Retirer ${x.name}`} onClick={() => onChange(value.filter((v) => v !== id))}>×</button></span>;
        })}
        <Picker items={left} value="" onChange={(id) => id && onChange([...value, id])} prefix={prefix} placeholder={`+ ${add}`} none={false} />
      </div>
    </div>
  );
}

// ---- a Discord-looking preview ----

const SAMPLE = Object.fromEntries(VARIABLES.map(([k, , v]) => [k, v]));
/** The variables replaced by plausible values, for the preview. */
export const sampleOf = (text) => String(text || "").replace(/\{[a-z.]+\}/g, (k) => SAMPLE[k] ?? { "{membre}": "@Alice", "{pseudo}": "Alice", "{serveur}": "VCT EMEA", "{nombre}": "1 234" }[k] ?? k);

/** Discord's light markdown, as React nodes: **bold**, *italic*, __underline__, `code`, mentions, relative times. */
export function md(text) {
  const parts = String(text || "").split(/(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|`[^`\n]+`|<t:\d+:[a-zA-Z]>|@[\wÀ-ÿ-]+|<#\d+>|#[\w-]+)/g);
  return parts.map((p, k) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <b key={k}>{p.slice(2, -2)}</b>;
    if (/^__[^_]+__$/.test(p)) return <u key={k}>{p.slice(2, -2)}</u>;
    if (/^\*[^*]+\*$/.test(p)) return <i key={k}>{p.slice(1, -1)}</i>;
    if (/^`[^`]+`$/.test(p)) return <code key={k}>{p.slice(1, -1)}</code>;
    if (/^<t:\d+:[a-zA-Z]>$/.test(p)) return <span key={k} className="dtime">dans 1 heure</span>;
    if (/^(@[\wÀ-ÿ-]+|#[\w-]+|<#\d+>)$/.test(p)) return <span key={k} className="dmention">{p.startsWith("<#") ? "#salon" : p}</span>;
    return <Fragment key={k}>{p}</Fragment>;
  });
}

/** One embed as Discord draws it. e: { title, text, color, image, fields }. */
export function EmbedView({ e }) {
  return (
    <div className="dembed2" style={{ "--ecolor": e.color || "#ff4655" }}>
      {e.title && <b className="dtitle">{md(sampleOf(e.title))}</b>}
      {e.text && <div className="dtext2">{md(sampleOf(e.text).replace(/\\n/g, "\n"))}</div>}
      {(e.fields || []).length > 0 && (
        <div className="dfields">{e.fields.map((f, k) => <div key={k} className={"dfield2" + (f.inline ? " inline" : "")}><b>{md(sampleOf(f.name))}</b><div>{md(sampleOf(f.value))}</div></div>)}</div>
      )}
      {e.image && <img className="dimage" src={e.image} alt="" loading="lazy" />}
    </div>
  );
}

/** A message as Discord shows it: the bot's name, its "BOT" mark, the text, the embeds, the buttons. */
export function DiscordMessage({ content = "", embeds = [], buttons = [], name = "VCT EMEA" }) {
  const time = useMemo(() => new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }), []);
  return (
    <div className="dmsg2" aria-label="Aperçu du message sur Discord">
      <span className="davatar" aria-hidden="true">V</span>
      <div className="dbody">
        <div className="dhead"><b>{name}</b> <span className="dbot">BOT</span> <small>Aujourd&apos;hui à {time}</small></div>
        {content && <div className="dtext2">{md(sampleOf(content))}</div>}
        {embeds.map((e, k) => <EmbedView key={k} e={e} />)}
        {buttons.length > 0 && <div className="dbuttons">{buttons.map((b, k) => <span key={k} className={"dbutton " + (b.style || "blurple")}>{b.label}</span>)}</div>}
      </div>
    </div>
  );
}

// ---- writing a message ----

/** The variables as buttons: a click puts the variable where the cursor is. */
function VarChips({ onInsert, vars = VARIABLES }) {
  return (
    <div className="bvars" role="group" aria-label="Variables">
      {vars.map(([k, what]) => <button key={k} type="button" className="bvar" title={what} onClick={() => onInsert(k)}><code>{k}</code><small>{what}</small></button>)}
    </div>
  );
}

/** Inserts at the cursor of a text field, then puts the cursor after it. */
function useInsert(ref, value, onChange) {
  return (k) => {
    const el = ref.current;
    const at = el && typeof el.selectionStart === "number" ? el.selectionStart : String(value || "").length;
    const end = el && typeof el.selectionEnd === "number" ? el.selectionEnd : at;
    const next = String(value || "").slice(0, at) + k + String(value || "").slice(end);
    onChange(next);
    setTimeout(() => { if (el) { el.focus(); el.setSelectionRange(at + k.length, at + k.length); } }, 0);
  };
}

/** A message's text with its variables to click and its preview, live. */
export function MessageEditor({ label, value, onChange, max = 2000, rows = 3, vars = VARIABLES, hint, embedsBelow = [] }) {
  const ref = useRef(null);
  const insert = useInsert(ref, value, onChange);
  return (
    <div className="bmsged">
      <label className="f">{label}{hint && <small> {hint}</small>}
        <textarea ref={ref} rows={rows} maxLength={max} value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
      <div className="bmsgmeta"><VarChips onInsert={insert} vars={vars} /><small className="bmuted">{String(value || "").length}/{max}</small></div>
      <DiscordMessage content={value} embeds={embedsBelow} />
    </div>
  );
}

/** An embed built field by field (title, text, colour, image, fields), with its preview. value: { name?, title, text, color, image, fields }. */
export function EmbedBuilder({ value, onChange, withName = false, vars = VARIABLES, buttons = [], content = "" }) {
  const e = { title: "", text: "", color: "#ff4655", image: "", fields: [], ...value };
  const textRef = useRef(null);
  const set = (k, v) => onChange({ ...e, [k]: v });
  const insert = useInsert(textRef, e.text, (v) => set("text", v));
  const setField = (k, f) => set("fields", e.fields.map((x, j) => (j === k ? { ...x, ...f } : x)));
  return (
    <div className="bembed">
      <div className="bembedform">
        {withName && <label className="f">Nom du modèle <small>(celui qu&apos;on choisit dans /embed template:)</small><input type="text" maxLength={40} value={e.name || ""} onChange={(x) => set("name", x.target.value)} /></label>}
        <label className="f">Titre<input type="text" maxLength={256} value={e.title} onChange={(x) => set("title", x.target.value)} /></label>
        <label className="f">Texte<textarea ref={textRef} rows={4} maxLength={4000} value={e.text} onChange={(x) => set("text", x.target.value)} /></label>
        <VarChips onInsert={insert} vars={vars} />
        <div className="bembedrow">
          <label className="f bcolor">Couleur<input type="color" value={e.color} onChange={(x) => set("color", x.target.value)} /></label>
          <label className="f">Image <small>(https://…, facultatif)</small><input type="url" maxLength={500} value={e.image} onChange={(x) => set("image", x.target.value)} placeholder="https://" /></label>
        </div>
        <fieldset className="bfields"><legend>Champs <small>({e.fields.length}/10)</small></legend>
          {e.fields.map((f, k) => (
            <div key={k} className="bfieldrow">
              <input type="text" maxLength={256} value={f.name} placeholder="Nom" aria-label={`Nom du champ ${k + 1}`} onChange={(x) => setField(k, { name: x.target.value })} />
              <input type="text" maxLength={1024} value={f.value} placeholder="Valeur" aria-label={`Valeur du champ ${k + 1}`} onChange={(x) => setField(k, { value: x.target.value })} />
              <label className="chk"><input type="checkbox" checked={!!f.inline} onChange={(x) => setField(k, { inline: x.target.checked })} /> en ligne</label>
              <button type="button" className="btn small" onClick={() => set("fields", e.fields.filter((_, j) => j !== k))} aria-label={`Retirer le champ ${k + 1}`}>×</button>
            </div>
          ))}
          {e.fields.length < 10 && <button type="button" className="btn small" onClick={() => set("fields", [...e.fields, { name: "", value: "", inline: false }])}>Ajouter un champ</button>}
        </fieldset>
      </div>
      <div className="bembedprev"><small className="bmuted">Aperçu</small><DiscordMessage content={content} embeds={[e]} buttons={buttons} /></div>
    </div>
  );
}

// ---- the home's cards ----

const STATE = { ready: ["✅", "Prêt"], setup: ["🛠️", "À configurer"], missing: ["⚠️", "Droit ou intent manquant"], off: ["⏸️", "Désactivé"] };

/** A module's card: its switch, what it does, its state, and "Configurer". */
export function ModuleCard({ m, state, onToggle, onOpen, busy }) {
  const [icon, label] = STATE[state.state] || STATE.ready;
  const on = state.state !== "off";
  return (
    <article className={`bmod ${state.state}`}>
      <header>
        <h4><span aria-hidden="true">{m.icon}</span> {m.name}</h4>
        <label className={"btoggle mini" + (on ? " on" : "")} title={on ? "Désactiver le module" : "Activer le module"}>
          <input type="checkbox" role="switch" checked={on} disabled={busy} onChange={(e) => onToggle(e.target.checked)} aria-label={`${m.name} : ${on ? "activé" : "désactivé"}`} />
          <span className="btsw" aria-hidden="true" />
        </label>
      </header>
      <p>{m.text}</p>
      <footer>
        <span className={`bmstate ${state.state}`} title={state.why || label}>{icon} {label}</span>
        <button type="button" className="btn small" onClick={onOpen}>Configurer</button>
      </footer>
      {state.why && <small className="bmwhy">{state.why}</small>}
    </article>
  );
}
