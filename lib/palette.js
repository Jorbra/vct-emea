// A team's colors from its logo's pixels, and the colors to show them with. Pure: used in the browser and on the server.

/** RGB → HSL, h in degrees, s and l from 0 to 1. */
export function toHsl([r, g, b]) {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === R ? ((G - B) / d + (G < B ? 6 : 0)) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [h * 60, s, l];
}

const hsl = (h, s, l) => `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;

/**
 * The two strongest color families of the pixels (12 families by hue; white, black and grays left out): the main one, and a second
 * one far enough from it in hue. Pure: from the pixels' bytes (RGBA). null for a gray logo.
 */
export function paletteOf(data) {
  const fam = Array.from({ length: 12 }, () => ({ r: 0, g: 0, b: 0, n: 0 }));
  let opaque = 0;
  for (let i = 0; i < data.length; i += 4) {
    const [R, G, B, A] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (A < 200) continue;
    opaque++;
    const max = Math.max(R, G, B);
    const min = Math.min(R, G, B);
    if (max - min < 40 || max < 50 || min > 225) continue;
    const [h] = toHsl([R, G, B]);
    const f = fam[Math.floor(h / 30) % 12];
    f.r += R; f.g += G; f.b += B; f.n++;
  }
  const ranked = fam.map((f, i) => ({ ...f, i })).filter((f) => f.n >= 6).sort((x, y) => y.n - x.n);
  // a black-and-white logo: a black-and-white theme
  if (!ranked.length || ranked[0].n < 10) return opaque >= 30 ? { mono: true, primary: [233, 233, 230], secondary: null } : null;
  const rgb = (f) => [Math.round(f.r / f.n), Math.round(f.g / f.n), Math.round(f.b / f.n)];
  const far = (f) => { const d = Math.abs(f.i - ranked[0].i); return Math.min(d, 12 - d) >= 2; };
  const second = ranked.slice(1).find(far);
  return { primary: rgb(ranked[0]), secondary: second ? rgb(second) : null };
}

/**
 * The colors to use on the site, readable whatever the mode: the accent bright enough on the dark background (dark enough on the
 * light one), the band behind white text dark enough. Pure.
 */
export function themeColors(palette, dark = true) {
  if (!palette) return null;
  if (palette.mono) return { accent: dark ? "#ecece8" : "#1d1c1b", accentInk: dark ? "#0c0e13" : "#ffffff", band: dark ? "#2a2d36" : "#33302c", bandInk: "#ffffff", second: dark ? "#8b8f99" : "#66625d", raw: "rgb(233, 233, 230)" };
  const [h, s0] = toHsl(palette.primary);
  const s = Math.max(s0, 0.5);
  const accent = dark ? hsl(h, Math.min(s, 0.9), 0.62) : hsl(h, Math.min(s, 0.85), 0.36);
  const [h2, s2] = palette.secondary ? toHsl(palette.secondary) : [h, s];
  const band = hsl(h, Math.min(s, 0.75), dark ? 0.24 : 0.3);
  const second = hsl(h2, Math.max(s2, 0.45), dark ? 0.6 : 0.38);
  return { accent, accentInk: dark ? "#0c0e13" : "#ffffff", band, bandInk: "#ffffff", second, raw: `rgb(${palette.primary.join(", ")})` };
}
