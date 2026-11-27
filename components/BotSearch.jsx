"use client";

// The bot dashboard's quick search (Ctrl + K): a page, a module, a command, a case "#12" or a member, reached by typing.
import { useEffect, useMemo, useRef, useState } from "react";

const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * items: what can be found, [{ label, hint, icon, words, run }]; onClose. Typing filters them; a "#12" offers that case,
 * other words offer the member's search too. Arrows move, Enter opens, Escape closes.
 */
export function QuickSearch({ items, onClose, onCase, onMember }) {
  const [q, setQ] = useState("");
  const [at, setAt] = useState(0);
  const input = useRef(null);
  useEffect(() => { if (input.current) input.current.focus(); }, []);
  const list = useMemo(() => {
    const f = fold(q.trim());
    const found = f ? items.filter((x) => fold(`${x.label} ${x.words || ""}`).includes(f)) : items;
    const extra = [];
    const num = q.trim().match(/^#?(\d{1,7})$/);
    if (num) extra.push({ label: `Sanction n°${num[1]}`, hint: "Ouvrir le tableau des sanctions sur ce cas", icon: "⚖️", run: () => onCase(`#${num[1]}`) });
    if (q.trim().length >= 2) extra.push({ label: `Chercher le membre « ${q.trim()} »`, hint: "Pseudo, @mention ou identifiant", icon: "👤", run: () => onMember(q.trim()) });
    return [...found.slice(0, 12), ...extra];
  }, [q, items, onCase, onMember]);
  useEffect(() => { setAt(0); }, [q]);
  const open = (x) => { if (!x) return; onClose(); x.run(); };
  return (
    <div className="bqsback" onClick={onClose}>
      <div className="bqs" role="dialog" aria-modal="true" aria-label="Recherche rapide" onClick={(e) => e.stopPropagation()}>
        <input ref={input} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Page, module, commande, #cas ou membre…" aria-label="Rechercher dans le tableau de bord" role="combobox" aria-expanded="true" aria-controls="bqslist" aria-activedescendant={list[at] ? `bqs-${at}` : undefined}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); onClose(); }
            else if (e.key === "ArrowDown") { e.preventDefault(); setAt((n) => Math.min(list.length - 1, n + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setAt((n) => Math.max(0, n - 1)); }
            else if (e.key === "Enter") { e.preventDefault(); open(list[at]); }
          }} />
        <ul id="bqslist" role="listbox" aria-label="Résultats">
          {list.length === 0 ? <li className="bmuted bqsnone">Rien ne correspond.</li> : list.map((x, k) => (
            <li key={`${x.label}-${k}`} id={`bqs-${k}`} role="option" aria-selected={k === at} className={k === at ? "on" : ""} onMouseEnter={() => setAt(k)} onClick={() => open(x)}>
              <span aria-hidden="true">{x.icon}</span>
              <span><b>{x.label}</b>{x.hint && <small className="bmuted"> · {x.hint}</small>}</span>
            </li>
          ))}
        </ul>
        <p className="bqskeys bmuted">↑ ↓ pour choisir · Entrée pour ouvrir · Échap pour fermer</p>
      </div>
    </div>
  );
}
