import { test } from "node:test";
import assert from "node:assert/strict";
import { normTheme, THEME_SCRIPT, THEMES } from "../lib/theme.js";
import { logoLum, luminance, needsBackdrop, solidColor } from "../lib/logolum.js";
import { cleanPrefs } from "../lib/accounts.js";

test("theme: three choices, auto when nothing or nonsense is saved", () => {
  assert.deepEqual(THEMES, ["light", "dark", "auto"]);
  assert.equal(normTheme("light"), "light");
  assert.equal(normTheme("dark"), "dark");
  assert.equal(normTheme(undefined), "auto");
  assert.equal(normTheme("pink"), "auto");
  assert.equal(cleanPrefs({ theme: "auto" }).theme, "auto");
  assert.equal(cleanPrefs({ theme: "pink" }).theme, undefined);
});

test("theme: the script before paint is valid and follows the device on auto", () => {
  const attrs = {};
  const listeners = [];
  const el = { getAttribute: (k) => attrs[k] ?? null, setAttribute: (k, v) => { attrs[k] = String(v); } };
  let light = true;
  const meta = { setAttribute: (k, v) => { meta[k] = v; } };
  const doc = { documentElement: el, cookie: "", head: { appendChild() {} }, getElementById: () => meta, createElement: () => meta };
  const win = {};
  const mq = { get matches() { return light; }, addEventListener: (_, f) => listeners.push(f) };
  new Function("document", "matchMedia", "window", THEME_SCRIPT)(doc, () => mq, win);
  assert.equal(attrs["data-theme-mode"], "auto");
  assert.equal(attrs["data-theme"], "light");
  assert.equal(meta.content, "#f5f4f2");
  light = false; listeners.forEach((f) => f());
  assert.equal(attrs["data-theme"], "dark");
  win.__vctTheme("light");
  assert.equal(attrs["data-theme"], "light");
  assert.equal(attrs["data-theme-mode"], "light");
  light = true; listeners.forEach((f) => f()); light = false; listeners.forEach((f) => f());
  assert.equal(attrs["data-theme"], "light"); // a fixed choice ignores the device
  // a saved choice in the cookie
  const a2 = {};
  const el2 = { getAttribute: (k) => a2[k] ?? null, setAttribute: (k, v) => { a2[k] = v; } };
  new Function("document", "matchMedia", "window", THEME_SCRIPT)({ ...doc, documentElement: el2, cookie: "lang=fr; theme=dark" }, () => mq, {});
  assert.equal(a2["data-theme"], "dark");
});

const px = (list) => Uint8ClampedArray.from(list.flat());
test("logos: white on see-through is light; dark, opaque or empty is not", () => {
  const white = Array.from({ length: 100 }, (_, i) => (i < 50 ? [255, 255, 255, 255] : [0, 0, 0, 0]));
  assert.equal(logoLum(px(white)).light, true);
  const navy = Array.from({ length: 100 }, (_, i) => (i < 50 ? [20, 30, 90, 255] : [0, 0, 0, 0]));
  assert.equal(logoLum(px(navy)).light, false);
  const photo = Array.from({ length: 100 }, () => [250, 250, 250, 255]); // brings its own background
  assert.equal(logoLum(px(photo)).light, false);
  assert.equal(logoLum(px(Array.from({ length: 100 }, () => [0, 0, 0, 0]))).light, false);
  const mixed = Array.from({ length: 100 }, (_, i) => (i < 30 ? [255, 255, 255, 255] : i < 45 ? [200, 20, 30, 255] : [0, 0, 0, 0]));
  assert.equal(logoLum(px(mixed)).light, true); // two thirds white: the name would vanish
});

test("logos: a plate only on a light background", () => {
  assert.ok(luminance(255, 255, 255) > 0.99 && luminance(0, 0, 0) === 0);
  assert.deepEqual(solidColor("rgb(245, 244, 242)"), [245, 244, 242]);
  assert.equal(solidColor("rgba(0, 0, 0, 0)"), null);
  assert.deepEqual(solidColor("color(srgb 1 1 1)"), [255, 255, 255]);
  assert.equal(needsBackdrop(true, [245, 244, 242]), true);
  assert.equal(needsBackdrop(true, [18, 18, 18]), false); // dark theme: unchanged
  assert.equal(needsBackdrop(false, [245, 244, 242]), false);
  assert.equal(needsBackdrop(true, null), false);
});
