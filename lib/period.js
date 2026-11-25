// The season's period, for the site's look: Kickoff (January to mid-February), Masters (the two international events),
// the Stages between them, Champions (September to mid-October), else the off-season (qualifiers, no special look).
// Approximate windows of the VCT calendar, by Paris date.
const WINDOWS = [
  ["01-01", "02-20", "kickoff"],
  ["02-21", "03-20", "masters"],
  ["03-21", "05-31", "stage"],
  ["06-01", "06-25", "masters"],
  ["06-26", "08-31", "stage"],
  ["09-01", "10-12", "champions"],
];
const PARIS_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" });

/** "kickoff", "masters", "stage", "champions" or "offseason" for a time. VCT_PERIOD on the server forces one. Pure. */
export function periodOf(now = Date.now(), forced = process.env.VCT_PERIOD) {
  if (["kickoff", "masters", "stage", "champions", "offseason"].includes(forced)) return forced;
  const md = PARIS_DAY.format(new Date(now)).slice(5);
  const w = WINDOWS.find(([from, to]) => md >= from && md <= to);
  return w ? w[2] : "offseason";
}
