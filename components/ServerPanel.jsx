"use client";
// The editor's "Server" panel: each site of the server (online, response time), the last backup, the background task's last round.

import { useCallback, useEffect, useState } from "react";
import { useT } from "./lang.jsx";

const ago = (iso, tr) => {
  if (!iso) return tr("never");
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return tr("just now");
  if (min < 60) return tr("{n} min ago", { n: min });
  const h = Math.round(min / 60);
  return h < 48 ? tr("{n} h ago", { n: h }) : tr("{n} days ago", { n: Math.round(h / 24) });
};
const when = (iso) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function ServerPanel() {
  const tr = useT();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const load = useCallback(async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/server-status", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }, []);
  const [open, setOpen] = useState(false);
  useEffect(() => { load(); }, [load]); // the summary shows even folded
  // every minute while the panel is open and in sight
  useEffect(() => {
    if (!open) return undefined;
    const t = setInterval(() => { if (!document.hidden) load(); }, 60000);
    return () => clearInterval(t);
  }, [open, load]);
  const down = data ? data.sites.filter((s) => !s.ok).length : 0;
  const tickLate = data && (!data.tick || Date.now() - new Date(data.tick.at).getTime() > 5 * 60000);
  const backupLate = data && (!data.backup || Date.now() - new Date(data.backup.at).getTime() > 30 * 3600000);
  const bad = down + (tickLate ? 1 : 0) + (backupLate ? 1 : 0);
  return (
    <section>
      <details className="einfo serverpanel" onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary><b>{tr("Server")}</b> {data && <span className={"hstate " + (bad ? "bad" : "ok")}>{bad ? tr("{n} to look at", { n: bad }) : tr("All good")}</span>}</summary>
        {err && <p className="err">{err}</p>}
        {!data ? <p className="note">{busy ? tr("Loading…") : ""}</p> : (
          <>
            <div className="srvsites">
              {data.sites.map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className={"srvsite " + (s.ok ? "up" : "down")}>
                  <span className="srvdot" aria-hidden="true" />
                  <b>{s.name}</b>
                  <span>{s.ok ? tr("Online") : tr("Not answering")}{s.status ? ` · ${s.status}` : s.error ? ` · ${s.error}` : ""}</span>
                  <small className={s.ms > 2000 ? "slow" : ""}>{s.ms} ms</small>
                </a>
              ))}
            </div>
            <div className="tablewrap"><table>
              <tbody>
                <tr className={backupLate ? "late" : ""}>
                  <td><b>{tr("Last backup")}</b><br /><small>{tr("Every night at 4:00, the last 14 kept")}</small></td>
                  <td>{data.backup ? <>{backupLate ? "⚠️ " : "✅ "}{when(data.backup.at)} <small>({ago(data.backup.at, tr)})</small><br /><small>{data.backup.file} · {(data.backup.size / 1048576).toFixed(1)} Mo · {tr("{n} kept", { n: data.backup.kept })}</small></> : `⚠️ ${tr("never")}`}
                    {data.backupError && (!data.backup || data.backupError.at > data.backup.at) && <><br /><small className="err">{when(data.backupError.at)} : {data.backupError.message}</small></>}
                  </td>
                </tr>
                <tr className={tickLate ? "late" : ""}>
                  <td><b>{tr("Background task")}</b><br /><small>{tr("Its last full round (every minute)")}</small></td>
                  <td>{data.tick ? <>{tickLate ? "⚠️ " : "✅ "}{when(data.tick.at)} <small>({ago(data.tick.at, tr)})</small></> : `⚠️ ${tr("never")}`}</td>
                </tr>
              </tbody>
            </table></div>
            <p className="hint">{tr("Checked at {t}.", { t: when(data.at) })} <button type="button" className="btn small" disabled={busy} onClick={load}>{tr("Check again")}</button></p>
          </>
        )}
      </details>
    </section>
  );
}
