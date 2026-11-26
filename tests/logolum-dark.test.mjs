// Dark logos (black, near-black) are hard to see on the dark theme: they get a light plate there (lib/logolum.js).
import test from "node:test";
import assert from "node:assert/strict";
import { logoLum, needsBackdrop, needsLightBackdrop } from "../lib/logolum.js";

const img = (px, n = 100) => { const d = new Uint8ClampedArray(n * 4); for (let i = 0; i < n; i++) { const p = i < px.length ? px[i] : [0, 0, 0, 0]; d.set(p, i * 4); } return d; };

test("logo tone: a black logo with see-through parts is dark, a white one light, a coloured one neither", () => {
  const black = img(Array(50).fill([10, 10, 12, 255]));
  const white = img(Array(50).fill([250, 250, 250, 255]));
  const red = img(Array(50).fill([220, 30, 40, 255]));
  assert.equal(logoLum(black).dark, true);
  assert.equal(logoLum(black).light, false);
  assert.equal(logoLum(white).light, true);
  assert.equal(logoLum(white).dark, false);
  assert.equal(logoLum(red).dark || logoLum(red).light, false);
});

test("logo plate: a dark logo gets help on a dark page only, a pale one on a light page only", () => {
  assert.equal(needsLightBackdrop(true, [12, 14, 19]), true);
  assert.equal(needsLightBackdrop(true, [245, 244, 242]), false);
  assert.equal(needsBackdrop(true, [245, 244, 242]), true);
  assert.equal(needsBackdrop(true, [12, 14, 19]), false);
});
