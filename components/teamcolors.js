"use client";
// A team's colors from its logo: its main color and a second one, read in the browser.
// The site's own logos are read straight; Toornament's go through /api/tlogo, served from the site so that they can be read.

import { paletteOf, themeColors, toHsl } from "../lib/palette.js";

export { paletteOf, themeColors, toHsl };

const palettes = new Map(); // address → { primary, secondary }, for the whole visit

/** The address the browser may read the logo from, or "" (an outside image it cannot read). */
export function readableLogo(logo) {
  const s = String(logo || "");
  if (s.startsWith("/")) return s;
  const t = /^https:\/\/play\.toornament\.com\/media\/file\/(\d{5,25})\//.exec(s);
  if (t) return `/api/tlogo?id=${t[1]}`;
  const v = /^https:\/\/owcdn\.net\/img\/([\w-]{4,40}\.(?:png|jpe?g|webp))$/i.exec(s);
  return v ? `/api/vlogo?f=${v[1]}` : "";
}

function readPalette(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = 32;
        c.height = 32;
        const g = c.getContext("2d", { willReadFrequently: true });
        g.drawImage(img, 0, 0, 32, 32);
        resolve(paletteOf(g.getImageData(0, 0, 32, 32).data));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** A logo's palette, once read: { primary: [r, g, b], secondary: [r, g, b] | null } or null. */
export function loadPalette(logo) {
  const src = readableLogo(logo);
  if (!src) return Promise.resolve(null);
  if (palettes.has(src)) return Promise.resolve(palettes.get(src));
  return readPalette(src).then((p) => { palettes.set(src, p); return p; });
}
export const knownPalette = (logo) => palettes.get(readableLogo(logo));
