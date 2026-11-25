// Light, dark or auto (follows the device). The choice lives in a cookie; the little script before paint (THEME_SCRIPT)
// turns it into data-theme="light|dark" on <html>, and keeps following the device while the choice is auto.
export const THEMES = ["light", "dark", "auto"];
export const THEME_COOKIE = "theme";

/** The saved choice: "light", "dark" or "auto" (nothing saved = auto). */
export const normTheme = (x) => (THEMES.includes(x) ? x : "auto");

// Bar colours of the phone's browser, the same as --bg.
const BAR = { light: "#f5f4f2", dark: "#121212" };

// Runs in <head> before the page paints, so there is no flash. data-theme-mode keeps the choice, data-theme the result.
// window.__vctTheme(mode) is how the switch changes it later.
export const THEME_SCRIPT = `try{(function(){var d=document.documentElement,q=matchMedia("(prefers-color-scheme: light)"),c=(document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark|auto)(?:;|$)/)||[])[1]||"auto";function bar(t){var m=document.getElementById("vct-bar");if(!m){m=document.createElement("meta");m.name="theme-color";m.id="vct-bar";document.head.appendChild(m)}m.setAttribute("content",t==="light"?"${BAR.light}":"${BAR.dark}")}function s(){var m=d.getAttribute("data-theme-mode")||"auto",t=m==="auto"?(q.matches?"light":"dark"):m;if(d.getAttribute("data-theme")!==t)d.setAttribute("data-theme",t);bar(t)}d.setAttribute("data-theme-mode",c);s();if(q.addEventListener)q.addEventListener("change",s);else if(q.addListener)q.addListener(s);window.__vctTheme=function(m){d.setAttribute("data-theme-mode",m==="light"||m==="dark"?m:"auto");s()}})()}catch(e){}`;

/** Saves a choice on this device and shows it at once (browser only). */
export function applyTheme(mode) {
  const m = normTheme(mode);
  document.cookie = `${THEME_COOKIE}=${m}; path=/; max-age=31536000; samesite=lax`;
  if (typeof window.__vctTheme === "function") window.__vctTheme(m);
  else document.documentElement.dataset.theme = m === "auto" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : m;
  window.dispatchEvent(new Event("vct-theme"));
  return m;
}

/** The choice currently shown (browser only). */
export const currentTheme = () => normTheme(document.documentElement.getAttribute("data-theme-mode"));
