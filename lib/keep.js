// Work that goes over the whole season and only moves when a match ends, kept for a while in the server's memory.
// Once older than `ms`, the next visitor still gets it at once and it is worked out again right after that page is sent:
// nobody waits for it but the very first visitor after the site starts.
import { after } from "next/server";

export async function keepFor(key, ms, compute) {
  const all = (globalThis.__kept ||= new Map());
  const kept = all.get(key);
  if (kept && Date.now() - kept.at < ms) return kept.data;
  if (kept) {
    if (!kept.refreshing) {
      kept.refreshing = true;
      after(async () => {
        try { all.set(key, { at: Date.now(), data: await compute() }); } catch (e) { kept.refreshing = false; console.log(`[keep] ${key}: ${e.message}`); }
      });
    }
    return kept.data;
  }
  const data = await compute();
  all.set(key, { at: Date.now(), data });
  return data;
}
