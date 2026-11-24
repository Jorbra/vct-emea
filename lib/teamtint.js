// A team's colours worked out on the server from its logo, so that its page is tinted from the very first paint.
// Kept in the server's memory and in the database (lp_items, kind "tcolor"): a logo is read once, then only when it changes.
import fs from "node:fs";
import path from "node:path";
import { paletteOf } from "./palette.js";

const MEMORY_FOR = 6 * 3600e3; // a logo that could not be read is tried again after this
const SAVED_FOR = 3 * 86400e3; // a logo replaced under the same name gets its new colours within this
const memo = (globalThis.__teamTint ||= new Map());

/** The logo's bytes: a logo saved in the database, a bundled one, or Toornament's; null for anything else. */
async function logoBytes(db, logo) {
  const s = String(logo || "");
  const saved = /^\/api\/logos\/([^/?#]+)$/.exec(s);
  if (saved) {
    const row = db.prepare("SELECT data FROM lp_logos WHERE file = ?").get(decodeURIComponent(saved[1]));
    return row ? Buffer.from(row.data) : null;
  }
  const bundled = /^\/(team-logos|logos|brand)\/([\w.-]+\.(png|webp|jpe?g|svg))$/i.exec(s);
  if (bundled) {
    try { return fs.readFileSync(path.join(process.cwd(), "public", bundled[1], bundled[2])); } catch { return null; }
  }
  const t = /^https:\/\/play\.toornament\.com\/media\/file\/(\d{5,25})\//.exec(s);
  if (t) {
    try {
      const res = await fetch(`https://play.toornament.com/media/file/${t[1]}/logo_medium`, { signal: AbortSignal.timeout(2500) });
      return res.ok && /^image\//.test(res.headers.get("content-type") || "") ? Buffer.from(await res.arrayBuffer()) : null;
    } catch { return null; }
  }
  return null;
}

/** The palette of an image's bytes, read at 32×32 pixels. null when it cannot be read (no image library on this server). */
export async function paletteOfImage(bytes) {
  if (!bytes) return null;
  try {
    const { default: sharp } = await import("sharp");
    const data = await sharp(bytes, { density: 72 }).resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).ensureAlpha().raw().toBuffer();
    return paletteOf(data);
  } catch {
    return null;
  }
}

/** A logo's palette ({ primary, secondary } or { mono, primary }), or null. */
export async function teamTint(db, logo, now = Date.now()) {
  const key = String(logo || "").slice(0, 300);
  if (!key) return null;
  const kept = memo.get(key);
  if (kept && now - kept.at < (kept.palette ? SAVED_FOR : MEMORY_FOR)) return kept.palette;
  try {
    const row = db.prepare("SELECT json, at FROM lp_items WHERE kind = 'tcolor' AND key = ?").get(key);
    if (row && now - new Date(row.at).getTime() < SAVED_FOR) {
      const saved = JSON.parse(row.json);
      if (saved && saved.palette) { memo.set(key, { at: now, palette: saved.palette }); return saved.palette; }
    }
  } catch { /* worked out again */ }
  const palette = await paletteOfImage(await logoBytes(db, key));
  memo.set(key, { at: now, palette });
  if (palette) {
    try { db.prepare("INSERT OR REPLACE INTO lp_items (kind, key, json, at) VALUES ('tcolor', ?, ?, ?)").run(key, JSON.stringify({ palette }), new Date(now).toISOString()); } catch { /* kept in memory only */ }
  }
  return palette;
}

const pngs = (globalThis.__logoPng ||= new Map());

/** A logo as a PNG data address of 256 pixels at most, for the pictures made on the server (next/og reads PNG and JPEG only). "" when none. */
export async function logoPng(db, logo, now = Date.now()) {
  const key = String(logo || "").slice(0, 300);
  if (!key) return "";
  const kept = pngs.get(key);
  if (kept && now - kept.at < (kept.data ? SAVED_FOR : MEMORY_FOR)) return kept.data;
  let data = "";
  try {
    const bytes = await logoBytes(db, key);
    if (bytes) {
      const { default: sharp } = await import("sharp");
      const out = await sharp(bytes, { density: 144 }).resize(256, 256, { fit: "inside", withoutEnlargement: false }).png().toBuffer();
      data = `data:image/png;base64,${out.toString("base64")}`;
    }
  } catch { data = ""; }
  if (pngs.size > 500) pngs.clear();
  pngs.set(key, { at: now, data });
  return data;
}
