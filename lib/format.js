// Dates and amounts from Liquipedia and vlr.gg, written the way the visitor's language writes them. Pure.
import { localeOf } from "./i18n.js";

/** "2026-11-03" as a date of this language; anything else (2025-12-??, a year alone) as it came. */
export function dayText(value, lang) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!m) return String(value || "");
  return new Intl.DateTimeFormat(localeOf(lang), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])));
}

/** "2024-11-07 — 2025-09-06" with each date of this language. */
export const periodText = (value, lang) => String(value || "").replace(/\d{4}-\d{2}-\d{2}/g, (d) => dayText(d, lang));

/** "$1,000,000" or "$6,650.78" as an amount of this language; anything else as it came. */
export function moneyText(value, lang) {
  const m = /^\$\s*([\d,]+(?:\.\d+)?)(.*)$/.exec(String(value || "").trim());
  if (!m) return String(value || "");
  const n = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return String(value);
  const text = new Intl.NumberFormat(localeOf(lang), { style: "currency", currency: "USD", maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);
  return text + (m[2] && !/^\s*USD\s*$/i.test(m[2]) ? m[2] : "");
}
