// Light or dark. With no choice saved, the site follows the device setting (prefers-color-scheme in globals.css).
export const THEMES = ["light", "dark"];
export const THEME_COOKIE = "theme";

export const normTheme = (x) => (THEMES.includes(x) ? x : undefined);
