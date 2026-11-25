// The home page on a match day: what to show from today's matches.

/** The day's state from its matches (in playing order): "before" (with the first and the time left), "live", "over" or null. Pure. */
export function matchDayState(today, now) {
  if (!today.length) return null;
  if (today.some((m) => m.live)) return { kind: "live" };
  if (today.every((m) => m.sa != null)) return { kind: "over" };
  const first = today.find((m) => m.sa == null && new Date(m.at).getTime() > now);
  const started = today.some((m) => m.sa != null || new Date(m.at).getTime() <= now);
  if (first && !started) return { kind: "before", first, left: new Date(first.at).getTime() - now };
  return { kind: "live" }; // between two matches, or a match whose live score is not read yet
}
