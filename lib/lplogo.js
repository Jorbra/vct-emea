// Team logos from Liquipedia (lib/valorant-teams.json names each one by its path under liquipedia.net/commons/images/).
// Each size of each logo is downloaded once and kept in the database, so Liquipedia is not asked again.
import crypto from "node:crypto";
import { sniffImage } from "./images.js";
import { readBlob, saveBlob } from "./lpstore.js";

const UA = "vct-kickoff-site/1.0 (personal tournament site; team logos)";
export const TYPES = { png: "image/png", svg: "image/svg+xml", webp: "image/webp", jpg: "image/jpeg" };

/** A logo path as found in valorant-teams.json ("a/a9/Team_Heretics_2024_allmode.png"), or null for anything else. */
export function lpFile(f) {
  const m = /^([0-9a-f])\/([0-9a-f]{2})\/([^/\\]{1,150}\.(png|svg|jpe?g|webp))$/i.exec(String(f || ""));
  return m && m[2].startsWith(m[1]) && !m[3].includes("..") ? { dir: `${m[1]}/${m[2]}`, base: m[3], ext: m[4].toLowerCase() } : null;
}

// Downloads run one after the other: a suggestion list asks for up to ten logos at once, and Liquipedia refuses bursts.
let queue = Promise.resolve();

/** The logo `width` pixels wide (a PNG thumbnail, also for SVG logos): { buf, ext } or null. */
export function lpLogo(f, width) {
  const job = queue.then(() => fetchLogo(f, width));
  queue = job.catch(() => null);
  return job;
}

async function fetchLogo(f, width) {
  const p = lpFile(f);
  if (!p) return null;
  const key = crypto.createHash("sha1").update(`${f}@${width}`).digest("hex");
  const kept = readBlob(key);
  if (kept) return kept;
  let name = p.base;
  try { name = decodeURIComponent(name); } catch { /* not %-encoded */ } // older lists kept names as in the page ("Be%C5%9Fikta%C5%9F...")
  const thumb = `${name}${p.ext === "svg" ? ".png" : ""}`;
  const base = `https://liquipedia.net/commons/images`;
  // Liquipedia does not make a thumbnail of every size; the original file is the fallback (not for SVG, which is never served as is).
  const urls = [`${base}/thumb/${p.dir}/${encodeURIComponent(name)}/${width}px-${encodeURIComponent(thumb)}`];
  if (p.ext !== "svg") urls.push(`${base}/${p.dir}/${encodeURIComponent(name)}`);
  let buf = null;
  for (const url of urls) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) { buf = Buffer.from(await res.arrayBuffer()); break; }
  }
  const ext = buf && sniffImage(buf);
  if (!ext || ext === "svg") return null;
  // Originals can weigh over a megabyte: shrink to the size asked (sharp comes with Next.js).
  const { default: sharp } = await import("sharp");
  const out = await sharp(buf).resize({ width, height: width, fit: "inside", withoutEnlargement: true }).png().toBuffer();
  saveBlob(key, out, "png");
  return { buf: out, ext: "png" };
}
