"use client";
// Logos that are white or very pale vanish on the light theme. Each image is read once (its brightness and see-through
// share, lib/logolum.js); when a pale logo sits on a light background, it gets data-lumfix and the stylesheet draws a
// discreet dark plate behind it. On a dark background nothing changes, so the dark theme looks as before.

import { useEffect } from "react";
import { logoLum, needsBackdrop, solidColor } from "../lib/logolum.js";
import { readableLogo } from "./teamcolors.js";

const CACHE_KEY = "vct-logo-lum";
const SKIP = ".flag, .aflag, [data-lum-skip], .avatar, .pphoto";
const known = new Map(); // address → true (pale) / false

function loadCache() {
  try { Object.entries(JSON.parse(localStorage.getItem(CACHE_KEY) || "{}")).forEach(([k, v]) => known.set(k, !!v)); } catch { /* none */ }
}
let saveTimer = 0;
function saveCache() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries([...known].slice(-500)))); } catch { /* full or private */ }
  }, 800);
}

// The address the browser may read: the site's own, or Toornament's through the site.
function readable(src) {
  try {
    const u = new URL(src, location.href);
    if (u.origin === location.origin) return u.pathname + u.search;
  } catch { return ""; }
  return readableLogo(src);
}

function measure(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = 32; c.height = 32;
        const g = c.getContext("2d", { willReadFrequently: true });
        g.drawImage(img, 0, 0, 32, 32);
        resolve(logoLum(g.getImageData(0, 0, 32, 32).data).light);
      } catch { resolve(false); }
    };
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

// The colour actually behind the image: its own background if the stylesheet gives it one, else the first ancestor's.
function backdrop(el) {
  if (el.dataset.lumfix) { delete el.dataset.lumfix; } // measure without our own plate
  for (let n = el; n; n = n.parentElement) {
    const s = getComputedStyle(n);
    if (s.backgroundImage && s.backgroundImage !== "none") return null; // a picture or gradient: leave it
    const c = solidColor(s.backgroundColor);
    if (c) return c;
  }
  return null;
}

function place(img) {
  const on = needsBackdrop(img.dataset.lum === "light", backdrop(img));
  if (on) img.dataset.lumfix = "1"; else delete img.dataset.lumfix;
}

async function check(img) {
  if (img.closest(SKIP)) return;
  const src = readable(img.currentSrc || img.src);
  if (!src || src.startsWith("data:")) return;
  if (img.dataset.lumsrc === src) { place(img); return; }
  img.dataset.lumsrc = src;
  let light = known.get(src);
  if (light === undefined) { light = await measure(src); known.set(src, light); saveCache(); }
  if (img.dataset.lumsrc !== src) return; // changed meanwhile
  if (light) img.dataset.lum = "light"; else delete img.dataset.lum;
  place(img);
}

export default function LogoContrast() {
  useEffect(() => {
    loadCache();
    let queued = new Set();
    let raf = 0;
    const flush = () => { raf = 0; const list = [...queued]; queued = new Set(); list.forEach((i) => { if (i.isConnected) check(i); }); };
    const queue = (img) => { queued.add(img); if (!raf) raf = requestAnimationFrame(flush); };
    const scan = (root) => {
      if (root.tagName === "IMG") queue(root);
      else if (root.querySelectorAll) root.querySelectorAll("img").forEach(queue);
    };
    scan(document.body);
    const mo = new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === "attributes") queue(m.target);
        else m.addedNodes.forEach(scan);
      }
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
    // theme or team colours changed: the backgrounds did too
    // (once now, and again when the colour transitions have ended)
    const redo = () => document.querySelectorAll('img[data-lum="light"]').forEach(place);
    let later = 0;
    const rethink = () => { requestAnimationFrame(redo); clearTimeout(later); later = setTimeout(redo, 700); };
    const root = new MutationObserver(rethink);
    root.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "style", "data-teamtheme"] });
    return () => { mo.disconnect(); root.disconnect(); clearTimeout(later); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return null;
}
