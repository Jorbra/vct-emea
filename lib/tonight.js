// Tonight page: the night matches sorted for the screen. Pure, no import: the page uses it in the browser.
/** Tonight’s matches in three lists: being played, still to come (by time), finished (the latest first). */
export function tonightLists(matches) {
  const live = matches.filter((m) => m.live);
  const next = matches.filter((m) => !m.live && m.sa == null).sort((x, y) => (x.at || "").localeCompare(y.at || ""));
  const done = matches.filter((m) => !m.live && m.sa != null).sort((x, y) => (y.at || "").localeCompare(x.at || ""));
  return { live, next, done };
}
