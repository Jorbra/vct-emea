"use client";
import { createContext, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import { LANG_COOKIE, LANGS, makeT } from "../lib/i18n.js";
import { pushAccount } from "./account.js";

const Ctx = createContext(makeT("fr"));

export function LangProvider({ lang, children }) {
  const tr = useMemo(() => makeT(lang), [lang]);
  return <Ctx.Provider value={tr}>{children}</Ctx.Provider>;
}

/** tr(key, vars) for the current language; tr.lang is its code ("fr", "en", "tr", "ar"). */
export const useT = () => useContext(Ctx);

/** FR | EN | TR | AR buttons. The choice is kept in a cookie so the server renders the right language at once. */
export function LangSwitch() {
  const tr = useT();
  const router = useRouter();
  const pick = (l) => {
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    pushAccount({ prefs: { lang: l } });
    router.refresh();
  };
  return (
    <div className="langsw" role="group" aria-label={tr("Language")}>
      {LANGS.map((l) => (
        <button key={l} type="button" aria-pressed={tr.lang === l} className={tr.lang === l ? "on" : ""} onClick={() => pick(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
