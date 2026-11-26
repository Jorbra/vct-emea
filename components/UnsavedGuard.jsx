"use client";
// One guard for every form of the editor: no code in each form. Each field is compared with the value it had when it
// appeared (or after the last save); a form ("unit": a fieldset, a form, or the block that holds its buttons) with a field
// that differs gets data-dirty, which the stylesheet turns into a "Unsaved changes" mark and a highlighted Save button.
// A successful save (any POST/PATCH/PUT/DELETE to /api/ answered OK) makes the form it came from clean again, which also
// covers the forms that save by themselves. Before the changes could be lost (closing or reloading the tab, a link, the
// back button, another tab of the editor, folding a block), a question: stay (the default) or leave anyway.

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "./lang.jsx";
import { FIELD_SELECTOR, fieldValue, isSaveRequest, isTracked, linkLeaves, sameValue } from "../lib/unsaved.js";

const UNIT = "[data-unsaved-unit], form, fieldset, details.tform";

// The form a field belongs to: a fieldset or form, else the nearest block that also holds a button (its Save).
function unitOf(el, root) {
  if (!el || !root || !root.contains(el)) return null;
  const u = el.closest(UNIT);
  if (u && root.contains(u)) return u;
  for (let n = el.parentElement; n && n !== root; n = n.parentElement) {
    if (n.querySelector("button")) return n;
  }
  return null;
}

export default function UnsavedGuard({ children }) {
  const tr = useT();
  const root = useRef(null);
  const original = useRef(new WeakMap()); // field → its value when it appeared or was last saved
  const [dirty, setDirty] = useState([]); // the units with changes, in page order
  const [ask, setAsk] = useState(null); // { text, go(), stay() } while the question is shown
  const bypass = useRef(false);
  const lastActive = useRef(null);
  const typedAt = useRef(0);
  const stayBtn = useRef(null);
  const dirtyRef = useRef([]);
  dirtyRef.current = dirty;
  const guard = useRef({ on: false, href: "" });
  const pushGuard = useCallback(() => {
    try {
      history.pushState({ ...(history.state || {}), __vctGuard: 1 }, "", location.href);
      guard.current = { on: true, href: location.href };
    } catch { /* the browser refused: the other guards still work */ }
  }, []);

  const remember = useCallback((scope) => {
    const map = original.current;
    const list = scope.matches && scope.matches(FIELD_SELECTOR) ? [scope] : scope.querySelectorAll ? scope.querySelectorAll(FIELD_SELECTOR) : [];
    for (const el of list) if (isTracked(el) && !map.has(el)) map.set(el, fieldValue(el));
  }, []);

  const label = tr("Unsaved changes");
  const check = useCallback(() => {
    const r = root.current;
    if (!r) return;
    remember(r);
    const units = new Set();
    for (const el of r.querySelectorAll(FIELD_SELECTOR)) {
      if (!isTracked(el)) continue;
      if (!sameValue(fieldValue(el), original.current.get(el))) { const u = unitOf(el, r); if (u) units.add(u); }
    }
    for (const u of r.querySelectorAll("[data-dirty]")) if (!units.has(u)) u.removeAttribute("data-dirty");
    for (const u of units) if (u.getAttribute("data-dirty") !== label) u.setAttribute("data-dirty", label);
    const list = [...units];
    setDirty((old) => (old.length === list.length && old.every((u, i) => u === list[i]) ? old : list));
  }, [label, remember]);

  // a save went through: the form it was made from now holds the saved values
  const saved = useCallback(() => {
    const r = root.current;
    // the changed form that holds the button pressed (a Save button sits in a smaller block than its fields when the form has no
    // fieldset: the banner, for one); else the button's own block
    const act = lastActive.current;
    const unit = dirtyRef.current.find((u) => u.isConnected && act && u.contains(act)) || unitOf(act, r) || (act && act.closest && act.closest(UNIT));
    if (!unit || !unit.isConnected) { setTimeout(check, 0); return; }
    const at = Date.now();
    const settle = () => {
      if (typedAt.current > at) return; // typed again since: those are new changes
      for (const el of unit.querySelectorAll(FIELD_SELECTOR)) if (isTracked(el)) original.current.set(el, fieldValue(el));
      check();
    };
    settle();
    // the page refreshes its data after a save; values tidied by the server (spaces, capitals) settle meanwhile
    setTimeout(settle, 400);
    setTimeout(settle, 1500);
  }, [check]);

  // fields: typing, picking, fields appearing or going away
  useEffect(() => {
    const r = root.current;
    if (!r) return;
    remember(r);
    let timer = 0;
    const soon = () => { if (!timer) timer = setTimeout(() => { timer = 0; check(); }, 60); };
    const onInput = (e) => { typedAt.current = Date.now(); lastActive.current = e.target; soon(); };
    const onActive = (e) => { lastActive.current = e.target; setTimeout(check, 0); };
    r.addEventListener("input", onInput, true);
    r.addEventListener("change", onInput, true);
    r.addEventListener("pointerdown", onActive, true);
    r.addEventListener("keydown", onActive, true);
    r.addEventListener("click", onActive, true);
    const mo = new MutationObserver((list) => {
      for (const m of list) m.addedNodes.forEach((n) => { if (n.nodeType === 1) remember(n); });
      soon();
    });
    mo.observe(r, { childList: true, subtree: true });
    return () => {
      r.removeEventListener("input", onInput, true);
      r.removeEventListener("change", onInput, true);
      r.removeEventListener("pointerdown", onActive, true);
      r.removeEventListener("keydown", onActive, true);
      r.removeEventListener("click", onActive, true);
      mo.disconnect();
      clearTimeout(timer);
    };
  }, [check, remember]);

  // saves: every request of the editor goes through fetch
  useEffect(() => {
    const before = window.fetch;
    const watched = async (input, init) => {
      const res = await before(input, init);
      try {
        const url = typeof input === "string" ? input : input && input.url;
        const method = (init && init.method) || (input && input.method) || "GET";
        if (res.ok && isSaveRequest(url, method, location.href)) saved();
      } catch { /* not ours to judge */ }
      return res;
    };
    window.fetch = watched;
    return () => { if (window.fetch === watched) window.fetch = before; };
  }, [saved]);

  // leaving: the tab, links, the editor's tabs, folding a block, the back button
  useEffect(() => {
    const has = () => dirtyRef.current.some((u) => u.isConnected);
    const question = (text, go, stay = () => {}, goLabel = tr("Leave anyway")) => setAsk({ text, go, stay, goLabel });
    // let the chosen move through; kept a moment, as a real page change asks "beforeunload" a little later
    const through = (fn) => { bypass.current = true; try { fn(); } finally { setTimeout(() => { bypass.current = false; }, 1500); } };
    const onUnload = (e) => {
      if (bypass.current || !has()) return;
      e.preventDefault();
      e.returnValue = ""; // the browser shows its own question
    };
    const onClick = (e) => {
      if (bypass.current || !has() || e.defaultPrevented) return;
      const t = e.target && e.target.closest ? e.target : null;
      if (!t) return;
      const a = t.closest("a[href]");
      const tab = t.closest('[role="tab"]:not([aria-selected="true"]), [data-guard-leave]');
      const sum = t.closest("summary");
      const details = sum && sum.parentElement && sum.parentElement.tagName === "DETAILS" ? sum.parentElement : null;
      const folding = details && details.open && dirtyRef.current.some((u) => details.contains(u));
      let text = "";
      if (a && linkLeaves(a, location.href, e)) text = tr("You have unsaved changes. Leave anyway?");
      else if (tab && root.current && root.current.contains(tab)) text = tr("You have unsaved changes. Leave anyway?");
      else if (folding) text = tr("You have unsaved changes in this block. Fold it anyway?");
      if (!text) return;
      e.preventDefault();
      e.stopPropagation();
      const el = a || tab || sum;
      question(text, () => through(() => el.click()), undefined, folding && !a && !tab ? tr("Fold anyway") : undefined);
    };
    // The back button: while there are changes, the page has a second history entry at the same address (see below).
    // Going back lands on the first one, so nothing moves; then the question. Leaving goes back once more.
    const onPop = () => {
      const g = guard.current;
      if (!g.on || bypass.current || location.href !== g.href || (history.state && history.state.__vctGuard)) return;
      g.on = false; // the extra entry has just been left
      if (!has()) { through(() => history.back()); return; } // saved meanwhile: go where the visitor asked
      question(tr("You have unsaved changes. Leave anyway?"), () => through(() => history.back()), () => pushGuard());
    };
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop, true);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop, true);
    };
  }, [tr]);

  // the extra history entry, added once changes start (left in place afterwards: going back from it changes nothing visible)
  useEffect(() => { if (dirty.some((u) => u.isConnected) && (!guard.current.on || guard.current.href !== location.href)) pushGuard(); }, [dirty, pushGuard]);

  useEffect(() => { if (ask && stayBtn.current) stayBtn.current.focus(); }, [ask]);
  useEffect(() => {
    if (!ask) return;
    const key = (e) => { if (e.key === "Escape") { e.preventDefault(); ask.stay(); setAsk(null); } };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [ask]);

  // Ctrl+S (Cmd+S on a Mac): saves the form being changed, with its own main button; elsewhere the browser does as usual
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || String(e.key).toLowerCase() !== "s") return;
      const r = root.current;
      const list = dirtyRef.current.filter((u) => u.isConnected);
      if (!r || !list.length) return;
      const mine = unitOf(document.activeElement, r) || unitOf(lastActive.current, r);
      const unit = list.find((u) => u === mine || (mine && (u.contains(mine) || mine.contains(u)))) || list[0];
      const btn = unit.querySelector("button.pri:not([disabled]), button[type=submit]:not([disabled])");
      if (!btn) return;
      e.preventDefault();
      lastActive.current = btn;
      btn.click();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // a field with a length limit: "42 / 120" beside it while it is being typed in
  const [count, setCount] = useState(null);
  useEffect(() => {
    const r = root.current;
    if (!r) return undefined;
    const at = (el) => {
      const max = el && el.maxLength;
      if (!el || !(max > 0) || max > 20000 || !/^(INPUT|TEXTAREA)$/.test(el.tagName) || el.closest("[data-nodirty]")) { setCount(null); return; }
      const box = el.getBoundingClientRect();
      setCount({ n: el.value.length, max, top: box.bottom + 2, right: Math.max(4, window.innerWidth - box.right) });
    };
    const onIn = (e) => at(e.target);
    const off = () => setCount(null);
    r.addEventListener("focusin", onIn);
    r.addEventListener("input", onIn);
    r.addEventListener("focusout", off);
    window.addEventListener("scroll", off, { passive: true });
    return () => { r.removeEventListener("focusin", onIn); r.removeEventListener("input", onIn); r.removeEventListener("focusout", off); window.removeEventListener("scroll", off); };
  }, []);

  const live = dirty.filter((u) => u.isConnected);
  const show = () => {
    const u = live[0];
    if (!u) return;
    const d = u.closest("details");
    if (d && !d.open) d.open = true;
    u.scrollIntoView({ block: "center", behavior: "smooth" });
    const f = [...u.querySelectorAll(FIELD_SELECTOR)].find((el) => isTracked(el) && !sameValue(fieldValue(el), original.current.get(el)));
    if (f) setTimeout(() => f.focus({ preventScroll: true }), 300);
  };

  return (
    <div ref={root} className="unsavedroot">
      {children}
      {live.length > 0 && (
        <div className="unsavedbar" role="status">
          <span className="unsaveddot" aria-hidden="true" />
          <span>{live.length > 1 ? tr("Unsaved changes in {n} forms", { n: live.length }) : tr("Unsaved changes")}</span>
          <button type="button" className="btn sm" onClick={show}>{tr("Show")}</button>
          <kbd className="unsavedkey" title={tr("Saves the form being changed")}>Ctrl+S</kbd>
        </div>
      )}
      {count && <div className={"charcount" + (count.n >= count.max ? " full" : count.n >= count.max * 0.9 ? " near" : "")} style={{ top: count.top, right: count.right }} aria-hidden="true">{count.n} / {count.max}</div>}
      {ask && (
        <div className="unsavedask" role="presentation" onClick={() => { ask.stay(); setAsk(null); }}>
          <div className="unsavedbox" role="alertdialog" aria-modal="true" aria-labelledby="unsaved-q" onClick={(e) => e.stopPropagation()}>
            <p id="unsaved-q">{ask.text}</p>
            <div className="row">
              <button type="button" className="btn pri" ref={stayBtn} onClick={() => { ask.stay(); setAsk(null); }}>{tr("Stay")}</button>
              <button type="button" className="btn danger" onClick={() => { const go = ask.go; setAsk(null); go(); }}>{ask.goLabel}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
