import test from "node:test";
import assert from "node:assert/strict";
import { fieldValue, isSaveRequest, isTracked, linkLeaves, sameValue } from "../lib/unsaved.js";

const field = (tag, props = {}, inside = null) => ({ tagName: tag.toUpperCase(), type: "text", value: "", ...props, closest: (sel) => (inside && sel.includes(inside) ? {} : null) });

test("unsaved: which fields count", () => {
  assert.equal(isTracked(field("input")), true);
  assert.equal(isTracked(field("textarea")), true);
  assert.equal(isTracked(field("select")), true);
  assert.equal(isTracked(field("input", { type: "search" })), false);
  assert.equal(isTracked(field("input", { type: "password" })), false);
  assert.equal(isTracked(field("input", { type: "file" })), false);
  assert.equal(isTracked(field("input", {}, "[data-nodirty]")), false); // a filter
  assert.equal(isTracked(field("select", {}, ".prefs")), false); // the language list
  assert.equal(isTracked(field("button")), false);
});

test("unsaved: values and going back to the original", () => {
  assert.equal(fieldValue({ type: "checkbox", checked: true }), "1");
  assert.equal(fieldValue({ type: "checkbox", checked: false }), "0");
  assert.equal(fieldValue({ type: "text", value: "Fnatic" }), "Fnatic");
  assert.equal(fieldValue({ multiple: true, options: [{ value: "a", selected: true }, { value: "b", selected: false }, { value: "c", selected: true }] }), "a\u0001c");
  assert.equal(sameValue("Fnatic ", "Fnatic"), true);
  assert.equal(sameValue("Fnatic", "FNC"), false);
});

const a = (href, extra = {}) => ({ href, target: "", hasAttribute: (k) => k in extra, ...extra });
test("unsaved: which links would leave the page", () => {
  const here = "https://site.test/admin/q1";
  assert.equal(linkLeaves(a("/team/fnatic"), here), true);
  assert.equal(linkLeaves(a("https://vlr.gg/x"), here), true);
  assert.equal(linkLeaves(a("/admin/q1#teams"), here), false); // same page
  assert.equal(linkLeaves(a("/team/fnatic", { target: "_blank" }), here), false);
  assert.equal(linkLeaves(a("/export.csv", { download: "" }), here), false);
  assert.equal(linkLeaves(a("mailto:x@y.z"), here), false);
  assert.equal(linkLeaves(a("/team/fnatic"), here, { ctrlKey: true }), false); // new tab
});

test("unsaved: which requests are saves", () => {
  const here = "https://site.test/admin";
  assert.equal(isSaveRequest("/api/teams/a1", "PATCH", here), true);
  assert.equal(isSaveRequest("/api/matches/score", "POST", here), true);
  assert.equal(isSaveRequest("/api/state", "GET", here), false);
  assert.equal(isSaveRequest("/api/logout", "POST", here), false);
  assert.equal(isSaveRequest("https://other.test/api/x", "POST", here), false);
  assert.equal(isSaveRequest("/team/x", "POST", here), false);
});
