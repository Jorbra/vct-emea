// The Discord bot's slash commands: /score, /prochain, /classement. Discord calls /api/discord; each call is checked with the
// application's public key. Pure answers from getState() and the season ranking.
import crypto from "node:crypto";
import { allMatches } from "./matchlist.js";
import { EVENT_NAMES, teamSlug } from "./paths.js";

export const COMMANDS = [
  { name: "score", description: "Les matchs en cours et les derniers résultats (d'une équipe si tu la donnes)", options: [{ type: 3, name: "equipe", description: "Nom de l'équipe", required: false }] },
  { name: "prochain", description: "Les prochains matchs (d'une équipe si tu la donnes)", options: [{ type: 3, name: "equipe", description: "Nom de l'équipe", required: false }] },
  { name: "classement", description: "Le top 10 des pronostics de la saison" },
];

const DER_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/** Discord's signature: ed25519 of timestamp + body, with the application's public key (hex). */
export function verifyDiscord(publicKeyHex, signatureHex, timestamp, body) {
  try {
    if (!/^[0-9a-f]{64}$/i.test(publicKeyHex || "") || !/^[0-9a-f]{128}$/i.test(signatureHex || "") || !timestamp) return false;
    const key = crypto.createPublicKey({ key: Buffer.concat([DER_PREFIX, Buffer.from(publicKeyHex, "hex")]), format: "der", type: "spki" });
    return crypto.verify(null, Buffer.from(timestamp + body), key, Buffer.from(signatureHex, "hex"));
  } catch {
    return false;
  }
}

const unix = (iso) => Math.floor(new Date(iso).getTime() / 1000);
const nameOf = (t) => (t && t.name) || "?";
const plays = (m, q) => !q || [nameOf(m.a), nameOf(m.b), (m.a && m.a.tag) || "", (m.b && m.b.tag) || ""].some((x) => teamSlug(x).includes(q));

/** The text of a command's answer (Discord markdown, 2000 characters at most). */
export function answerCommand(name, options, state, { ranking = [], site = "" } = {}, now = Date.now()) {
  const q = teamSlug(((options || []).find((o) => o.name === "equipe") || {}).value || "");
  const all = allMatches(state).filter((m) => m.a && m.b && plays(m, q));
  const link = (m) => (site ? ` · <${site}/match/${m.event}/${m.id}>` : "");
  const ev = (m) => EVENT_NAMES[m.event] || m.event;
  let lines = [];
  if (name === "score") {
    const live = all.filter((m) => m.live).slice(0, 8).map((m) => {
      const s = (state.live[m.event] || {})[m.id] || {};
      const maps = (s.maps || []).map((x) => `${x.map} ${x.a}–${x.b}`).join(", ");
      return `🔴 **${nameOf(m.a)} ${s.a ?? 0}–${s.b ?? 0} ${nameOf(m.b)}**${maps ? ` (${maps})` : ""} · ${ev(m)}${link(m)}`;
    });
    const done = all.filter((m) => m.sa != null && m.sb != null).sort((x, y) => (y.at || "").localeCompare(x.at || "")).slice(0, live.length ? 5 : 8)
      .map((m) => `✅ ${m.win === "a" ? `**${nameOf(m.a)}**` : nameOf(m.a)} ${m.sa}–${m.sb} ${m.win === "b" ? `**${nameOf(m.b)}**` : nameOf(m.b)} · ${ev(m)}${link(m)}`);
    lines = [...live, ...done];
    if (!lines.length) lines = [q ? "Aucun match trouvé pour cette équipe." : "Aucun résultat pour l'instant."];
  } else if (name === "prochain") {
    lines = all.filter((m) => m.sa == null && !m.live && m.at && new Date(m.at).getTime() > now).sort((x, y) => x.at.localeCompare(y.at)).slice(0, 8)
      .map((m) => `🔔 <t:${unix(m.at)}:f> (<t:${unix(m.at)}:R>) · **${nameOf(m.a)}** vs **${nameOf(m.b)}** · ${ev(m)}${m.bo ? ` · Bo${m.bo}` : ""}`);
    if (!lines.length) lines = [q ? "Aucun prochain match connu pour cette équipe." : "Aucun prochain match connu."];
  } else if (name === "classement") {
    lines = ranking.slice(0, 10).map((r, i) => `${["🥇", "🥈", "🥉"][i] || `${i + 1}.`} **${r.name}** · ${r.points} pts (${r.good}/${r.total})`);
    if (!lines.length) lines = ["Le classement commence avec les premiers résultats."];
    if (site) lines.push(`<${site}/predictions>`);
  } else {
    lines = ["Commande inconnue."];
  }
  let text = "";
  for (const l of lines) { if ((text + "\n" + l).length > 1900) break; text += (text ? "\n" : "") + l; }
  return text;
}
