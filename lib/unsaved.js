// Unsaved changes in the editor: which fields count, what a field's value is, and which clicks would lose the changes.
// Read by components/UnsavedGuard.jsx; plain functions so they can be tested without a browser.

// Fields that are typed into. Search boxes, files, passwords and buttons are never "changes".
const SKIP_TYPES = new Set(["search", "file", "password", "hidden", "submit", "button", "reset", "image"]);
export const FIELD_SELECTOR = "input, select, textarea";

/** Does this field hold something to save? (filters, the language list and the like are marked data-nodirty) */
export function isTracked(el) {
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  if (tag !== "input" && tag !== "select" && tag !== "textarea") return false;
  if (tag === "input" && SKIP_TYPES.has(String(el.type || "text").toLowerCase())) return false;
  if (el.closest && el.closest("[data-nodirty], .prefs, .langsel, .searchbar, [role=dialog]")) return false;
  return true;
}

/** The value a field shows, as a string to compare: ticked or not, the chosen options, or the text. */
export function fieldValue(el) {
  const type = String(el.type || "").toLowerCase();
  if (type === "checkbox" || type === "radio") return el.checked ? "1" : "0";
  if (el.multiple && el.options) return [...el.options].filter((o) => o.selected).map((o) => o.value).join("\u0001");
  return String(el.value ?? "");
}

/** Text typed back to what it was is not a change; spaces at the ends do not count either. */
export const sameValue = (a, b) => String(a ?? "").trim() === String(b ?? "").trim();

/**
 * Would following this link leave the page? Only plain clicks on links to another page of this site (or elsewhere):
 * not a new tab, not a download, not a jump within the same page.
 */
export function linkLeaves(a, here, mods = {}) {
  if (!a || !a.href) return false;
  if (mods.ctrlKey || mods.metaKey || mods.shiftKey || mods.altKey || mods.button > 0) return false;
  const target = String(a.target || "").toLowerCase();
  if (target && target !== "_self") return false;
  if (a.hasAttribute && a.hasAttribute("download")) return false;
  let to, from;
  try { to = new URL(a.href, here); from = new URL(here); } catch { return false; }
  if (!/^https?:$/.test(to.protocol)) return false; // mailto:, tel:, javascript:
  if (to.origin === from.origin && to.pathname === from.pathname && to.search === from.search) return false; // #anchor
  return true;
}

/** Is this request a save (anything but reading, to the site's own API)? */
export function isSaveRequest(url, method, here) {
  if (String(method || "GET").toUpperCase() === "GET" || String(method).toUpperCase() === "HEAD") return false;
  try {
    const u = new URL(url, here);
    return u.origin === new URL(here).origin && u.pathname.startsWith("/api/") && !/^\/api\/(logout|login|ping|health|track|visit)\b/.test(u.pathname);
  } catch { return false; }
}
