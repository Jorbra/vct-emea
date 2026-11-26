// Is a logo hard to see on a light page? Read from its pixels (RGBA, as a canvas gives them), with no list kept by hand.
// A logo is "light" when it has see-through parts (so the page shows behind it) and most of what is drawn is very pale:
// white or near white, pale yellow, light grey. A photo or a logo on its own square never counts: it brings its background.

// Relative luminance (WCAG) of an sRGB colour, 0 (black) to 1 (white).
export function luminance(r, g, b) {
  const f = (c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

// Paler than this, a colour has under 1.6:1 contrast with the light page (#f5f4f2): hard to make out.
export const PALE = 0.55;
// Darker than this, a colour has under 1.6:1 contrast with the dark page (#0c0e13): black, near-black, very dark navy.
export const DARK = 0.035;

/** { cover, pale, light, dark }: the share of the image that is drawn, the share of the drawn part that is pale, and the verdicts
 * (light: hard to see on a light page; dark: hard to see on a dark one). */
export function logoLum(data) {
  let drawn = 0, pale = 0, deep = 0, weight = 0;
  const n = Math.floor(data.length / 4);
  for (let i = 0; i < n; i++) {
    const a = data[i * 4 + 3];
    if (a < 40) continue;
    const w = a / 255;
    drawn++;
    weight += w;
    const l = luminance(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    if (l > PALE) pale += w;
    else if (l < DARK) deep += w;
  }
  const cover = n ? drawn / n : 0;
  const share = weight ? pale / weight : 0;
  const dshare = weight ? deep / weight : 0;
  const open = cover > 0.02 && cover < 0.92;
  // at least 8% see-through (else the logo carries its own background), something drawn, and half of it pale
  return { cover, pale: share, light: open && share >= 0.5, dark: open && dshare >= 0.5 };
}

/** Parses a computed CSS colour ("rgb(1, 2, 3)", "rgba(1, 2, 3, .5)", "color(srgb .1 .2 .3 / .5)"); null if see-through or unknown. */
export function solidColor(css) {
  const c = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/.exec(String(css || "").trim());
  if (c) {
    const a = c[4] === undefined ? 1 : c[4].endsWith("%") ? parseFloat(c[4]) / 100 : parseFloat(c[4]);
    return a < 0.5 ? null : [c[1], c[2], c[3]].map((x) => Math.round(parseFloat(x) * 255));
  }
  const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/.exec(String(css || "").trim());
  if (!m) return null;
  const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return a < 0.5 ? null : [+m[1], +m[2], +m[3]];
}

/** A pale logo needs help only on a light background. */
export const needsBackdrop = (logoIsLight, bg) => !!(logoIsLight && bg && luminance(bg[0], bg[1], bg[2]) > 0.45);

/** A dark logo needs help only on a dark background. */
export const needsLightBackdrop = (logoIsDark, bg) => !!(logoIsDark && bg && luminance(bg[0], bg[1], bg[2]) < 0.2);
