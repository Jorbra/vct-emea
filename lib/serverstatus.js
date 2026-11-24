// The editor's "Server" panel: whether each site on the server answers (its /api/health) and how fast, the last backup,
// and the last time the background task ran to the end. The sites come from STATUS_SITES (addresses separated by commas or spaces).
import { readItems } from "./lpstore.js";

export const DEFAULT_SITES = [
  "https://bwjfwnimgrnqrfh7yyri1iia.155.133.199.119.sslip.io",
  "https://w5gdmxcfdpoes8kiqjnnfwhm.155.133.199.119.sslip.io",
  "https://wq9eosznf5ywgbrgdvrh1jef.155.133.199.119.sslip.io",
];
const NAMES = ["VCT EMEA", "Flashback", "Planning"];

/** The sites to watch: [{ name, url }]. A name can be given before the address: "Flashback=https://…". */
export function statusSites(value = process.env.STATUS_SITES) {
  const raw = String(value || "").trim();
  // commas, semicolons or new lines between them; spaces too between plain addresses (a name may have spaces)
  const list = raw ? raw.split(/[,;\n]+/).flatMap((x) => (x.includes("=") ? [x.trim()] : x.trim().split(/\s+/))).filter(Boolean) : DEFAULT_SITES;
  return list.slice(0, 10).map((item, i) => {
    const m = /^([^=]{1,40})=(https?:\/\/.+)$/.exec(item);
    const url = (m ? m[2] : item).replace(/\/+$/, "");
    let host = url;
    try { host = new URL(url).hostname; } catch { /* shown as given */ }
    const name = m ? m[1] : !raw && NAMES[i] ? NAMES[i] : host.split(".")[0];
    return { name, url };
  }).filter((s) => /^https?:\/\/[^\s/]+/.test(s.url));
}

/** Asks each site's /api/health: [{ name, url, ok, status, ms, error }]. A site that takes more than `timeout` ms is down. */
export async function pingSites(sites, { fetchImpl = fetch, timeout = 6000, now = () => Date.now() } = {}) {
  return Promise.all(sites.map(async (s) => {
    const t0 = now();
    try {
      const res = await fetchImpl(`${s.url}/api/health`, { signal: AbortSignal.timeout(timeout), cache: "no-store", headers: { "user-agent": "vct-emea-status/1.0" } });
      return { ...s, ok: res.status >= 200 && res.status < 400, status: res.status, ms: now() - t0, error: "" };
    } catch (e) {
      return { ...s, ok: false, status: 0, ms: now() - t0, error: e && e.name === "TimeoutError" ? "timeout" : String((e && e.message) || e).slice(0, 120) };
    }
  }));
}

/** What the database says about the night's backup and the background task. */
export function jobsInfo(db) {
  const meta = readItems("meta", db);
  return {
    backup: meta.backup_last || null,
    backupError: meta.backup_error || null,
    tick: meta["ok:tick"] || null,
    regular: meta["ok:regular"] || null,
  };
}
