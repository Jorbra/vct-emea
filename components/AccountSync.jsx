"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LANG_COOKIE } from "../lib/i18n.js";
import { THEME_COOKIE } from "../lib/theme.js";
import { accountName, applyAccount, forgetAccount } from "./account.js";

const read = (name) => (document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`)) || [])[1] || "";
const put = (name, value) => { document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`; };

/** On every page, for a signed-in visitor: this device follows the account (favorites, predictions, language, theme). */
export default function AccountSync() {
  const router = useRouter();
  useEffect(() => {
    if (!accountName()) return;
    fetch("/api/account").then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!j) return; // offline or a passing error: stay as we are
      if (!j.account) { forgetAccount(); return; } // ended elsewhere (new password, deleted)
      applyAccount(j.account);
      const { lang, theme } = j.account.prefs || {};
      if (theme && document.documentElement.dataset.theme !== theme) {
        put(THEME_COOKIE, theme);
        document.documentElement.dataset.theme = theme;
      }
      if (lang && read(LANG_COOKIE) !== lang) {
        put(LANG_COOKIE, lang);
        router.refresh();
      }
    }).catch(() => { /* offline */ });
  }, [router]);
  return null;
}
