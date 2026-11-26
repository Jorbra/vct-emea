// The editors' update notice: the log's lines of the updates put online since their last visit (lib/version.js).
import test from "node:test";
import assert from "node:assert/strict";
import { entriesSince, siteVersion } from "../lib/version.js";

test("update notice: only the lines after the last version seen, newest first", () => {
  const e = [{ at: "2026-11-25T10:00:00Z", text: "a" }, { at: "2026-11-26T09:00:00Z", text: "b" }, { at: "2026-11-26T12:00:00Z", text: "c" }];
  assert.deepEqual(entriesSince(e, "2026-11-26T00:00:00Z").map((x) => x.text), ["c", "b"]);
  assert.deepEqual(entriesSince(e, ""), []);
  assert.ok(siteVersion().id);
});
