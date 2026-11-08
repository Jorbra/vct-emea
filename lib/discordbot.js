// The Discord bot's commands. Discord calls /api/discord; each call is checked with the application's public key.
// handleInteraction answers at once (autocomplete, buttons) or says "thinking…" and sends the answer right after.
import crypto from "node:crypto";
import { allMatches } from "./matchlist.js";
import { EVENT_NAMES, teamSlug } from "./paths.js";
import { parseRoster } from "./tournament.js";

const EVENT_KEYS = Object.keys(EVENT_NAMES);
const STATS = [["rating", "r"], ["acs", "acs"], ["kd", "kd"], ["kast", "kast"], ["adr", "adr"], ["hs", "hs"], ["kills", "k"], ["fk", "fk"]];
const team = (required, description = "Nom de l'équipe") => ({ type: 3, name: "equipe", description, required, autocomplete: true });

/** What Discord shows when "/" is typed. */
export const COMMANDS = [
  { name: "score", description: "Matchs en cours et derniers résultats (d'une équipe si tu la donnes)", options: [team(false)] },
  { name: "prochain", description: "Prochains matchs (d'une équipe si tu la donnes)", options: [team(false)] },
  { name: "classement", description: "Top 10 des pronostics de la saison" },
  { name: "equipe", description: "Fiche d'une équipe : roster, résultats, prochain match", options: [{ ...team(true), name: "nom" }] },
  { name: "joueur", description: "Stats de la saison d'un joueur", options: [{ type: 3, name: "nom", description: "Pseudo du joueur", required: true, autocomplete: true }] },
  { name: "bracket", description: "Où en est un tournoi, avec l'image du tableau", options: [{ type: 3, name: "tournoi", description: "Le tournoi", required: true, autocomplete: true }] },
  { name: "match", description: "Le match en cours ou le dernier match d'une équipe, carte par carte", options: [team(true)] },
  { name: "live", description: "Tous les matchs en direct, avec leurs streams" },
  { name: "top", description: "Top 10 des joueurs pour une stat", options: [
    { type: 3, name: "stat", description: "La stat", required: true, choices: STATS.map(([v]) => ({ name: v === "kd" ? "K/D" : v === "hs" ? "HS%" : v.toUpperCase() === "RATING" ? "Rating" : v.toUpperCase(), value: v })) },
    { type: 3, name: "tournoi", description: "Un seul tournoi", required: false, autocomplete: true },
  ] },
  { name: "lft", description: "Les derniers joueurs EMEA devenus libres" },
  { name: "suivre", description: "Recevoir en message privé les matchs d'une équipe (sans équipe : ta liste)", options: [team(false)] },
  { name: "pronostic", description: "Pronostiquer les prochains matchs avec des boutons", options: [{ type: 3, name: "nom", description: "Ton nom dans le classement (la première fois)", required: false }] },
  { name: "lier", description: "Jouer aux pronostics avec ton nom du site (code donné sur la page Pronostics)", options: [{ type: 3, name: "code", description: "Le code à 6 caractères", required: true }] },
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

const COLOR = 0xff4655;
const unix = (iso) => Math.floor(new Date(iso).getTime() / 1000);
const nameOf = (t) => (t && t.name) || "?";
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "");
const opt = (i, n) => {
  const o = ((i.data && i.data.options) || []).find((x) => x.name === n);
  return o ? String(o.value ?? "") : "";
};
const clip = (lines, max = 3800) => {
  let out = "";
  for (const l of lines) { if ((out + "\n" + l).length > max) break; out += (out ? "\n" : "") + l; }
  return out;
};
const cap = (s) => String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1);

/** The answer's words: French, or English when the editor chose it. */
const words = (lang) => (fr, en) => (lang === "en" ? en : fr);

/** A team of the site from what was typed: its exact name or tag first, then the closest. */
export function findTeam(teams, q) {
  const k = norm(q);
  if (!k) return null;
  return teams.find((t) => norm(t.name) === k || norm(t.tag) === k) || teams.find((t) => norm(t.name).startsWith(k)) || teams.find((t) => norm(t.name).includes(k)) || null;
}

const plays = (m, slug) => !slug || [teamSlug(nameOf(m.a)), teamSlug(nameOf(m.b))].includes(slug);
const evName = (e) => EVENT_NAMES[e] || e;
const roundOf = (m, L) => m.round.map(([k, v]) => String(k).replace(/\{(\w+)\}/g, (_, x) => (v && v[x] != null ? v[x] : ""))).join(" · ") || L("Match", "Match");

/** Suggestions while typing: [{ name, value }], 25 at most. */
export function autocomplete(i, ctx) {
  const focused = ((i.data && i.data.options) || []).find((o) => o.focused) || {};
  const q = norm(focused.value);
  const pick = (list) => list.filter((x) => !q || norm(x).includes(q)).sort((a, b) => Number(!norm(a).startsWith(q)) - Number(!norm(b).startsWith(q)) || a.localeCompare(b)).slice(0, 25);
  if (focused.name === "tournoi") return EVENT_KEYS.filter((e) => !q || norm(evName(e)).includes(q) || e.includes(q)).slice(0, 25).map((e) => ({ name: evName(e), value: e }));
  if (i.data.name === "joueur") return pick([...new Set(ctx.players().map((p) => p.name))]).map((n) => ({ name: n, value: n }));
  return pick(ctx.teams().map((t) => t.name)).map((n) => ({ name: n.slice(0, 100), value: n.slice(0, 100) }));
}

/** A command's answer: { content?, embeds?, components? }. ctx brings the data, read only when a command needs it. */
export function answerCommand(name, i, ctx) {
  const L = words(ctx.lang);
  const site = ctx.site;
  const state = ctx.state();
  const link = (m) => (site ? ` · [${L("fiche", "page")}](${site}/match/${m.event}/${m.id})` : "");
  const embed = (title, description, extra = {}) => ({ embeds: [{ title, description: description || L("Rien pour l'instant.", "Nothing for now."), color: COLOR, ...extra }] });
  const teamArg = opt(i, "equipe") || opt(i, "nom");
  const found = teamArg ? findTeam(ctx.teams(), teamArg) : null;
  if (teamArg && !found && ["score", "prochain", "equipe", "match", "suivre"].includes(name)) return { content: L(`Aucune équipe trouvée pour « ${teamArg} ».`, `No team found for "${teamArg}".`) };
  const slug = found ? teamSlug(found.name) : "";
  const all = allMatches(state).filter((m) => m.a && m.b && m.a.name && m.b.name);
  const liveOf = (m) => (state.live[m.event] || {})[m.id] || {};
  const liveLine = (m) => {
    const s = liveOf(m);
    const maps = (s.maps || []).map((x) => `${x.map} ${x.a}–${x.b}`).join(", ");
    return `🔴 **${nameOf(m.a)} ${s.a ?? 0}–${s.b ?? 0} ${nameOf(m.b)}**${maps ? ` (${maps})` : ""} · ${evName(m.event)}${link(m)}`;
  };
  const doneLine = (m) => `${m.win === "a" ? `**${nameOf(m.a)}**` : nameOf(m.a)} ${m.sa}–${m.sb} ${m.win === "b" ? `**${nameOf(m.b)}**` : nameOf(m.b)} · ${evName(m.event)}${link(m)}`;
  const nextLine = (m) => `<t:${unix(m.at)}:f> (<t:${unix(m.at)}:R>) · **${nameOf(m.a)}** vs **${nameOf(m.b)}** · ${evName(m.event)}${m.bo ? ` · Bo${m.bo}` : ""}`;
  const done = (list) => list.filter((m) => m.sa != null && m.sb != null).sort((x, y) => (y.at || "").localeCompare(x.at || ""));
  const coming = (list) => list.filter((m) => m.sa == null && !m.live && m.at && new Date(m.at).getTime() > ctx.now).sort((x, y) => x.at.localeCompare(y.at));

  switch (name) {
    case "score": {
      const mine = all.filter((m) => plays(m, slug));
      const live = mine.filter((m) => m.live).slice(0, 8).map(liveLine);
      const last = done(mine).slice(0, live.length ? 5 : 8).map((m) => `✅ ${doneLine(m)}`);
      return embed(found ? `${found.name} · ${L("scores", "scores")}` : L("Scores", "Scores"), clip([...live, ...last]));
    }
    case "prochain":
      return embed(found ? `${found.name} · ${L("prochains matchs", "next matches")}` : L("Prochains matchs", "Next matches"), clip(coming(all.filter((m) => plays(m, slug))).slice(0, 10).map((m) => `🔔 ${nextLine(m)}`)));
    case "classement": {
      const rows = ctx.ranking().slice(0, 10).map((r, k) => `${["🥇", "🥈", "🥉"][k] || `${k + 1}.`} **${r.name}** · ${r.points} pts (${r.good}/${r.total})`);
      return embed(L("Pronostics · classement de la saison", "Predictions · season ranking"), clip(rows), site ? { url: `${site}/predictions`, footer: { text: L("Joue avec /pronostic", "Play with /pronostic") } } : {});
    }
    case "equipe": {
      const t = found;
      const info = ctx.teamInfo(slug);
      const roster = (parseRoster(t.roster).length ? parseRoster(t.roster).map((p) => p.name) : ((info && info.roster) || []).map((p) => p.id)).slice(0, 8);
      const mine = all.filter((m) => plays(m, slug));
      const last = done(mine).slice(0, 5).map((m) => `${m.win && teamSlug(nameOf(m.win === "a" ? m.a : m.b)) === slug ? "🟢" : "🔴"} ${doneLine(m)}`);
      const next = coming(mine)[0];
      const live = mine.find((m) => m.live);
      const fields = [
        roster.length ? { name: "Roster", value: roster.join(" · "), inline: false } : null,
        live ? { name: L("En direct", "Live"), value: liveLine(live) } : next ? { name: L("Prochain match", "Next match"), value: nextLine(next) } : null,
        last.length ? { name: L("Derniers résultats", "Latest results"), value: clip(last, 1000) } : null,
      ].filter(Boolean);
      const logo = t.logo ? (t.logo.startsWith("/") ? site + t.logo : t.logo) : "";
      return { embeds: [{ title: t.name, url: site ? `${site}/team/${slug}` : undefined, color: COLOR, description: [t.tag ? `\`${t.tag}\`` : "", info && info.region ? info.region : ""].filter(Boolean).join(" · ") || undefined, fields, ...(logo && /^https:/.test(logo) ? { thumbnail: { url: logo } } : {}) }] };
    }
    case "joueur": {
      const q = norm(opt(i, "nom"));
      const p = ctx.stats().players.find((x) => norm(x.name) === q) || ctx.stats().players.find((x) => norm(x.name).startsWith(q));
      const known = ctx.players().find((x) => norm(x.name) === q);
      if (!p) {
        if (!known) return { content: L(`Aucun joueur trouvé pour « ${opt(i, "nom")} ».`, `No player found for "${opt(i, "nom")}".`) };
        return embed(known.name, L(`Joue chez **${known.team || "?"}**. Pas encore de stats vlr.gg sur les tournois du site.`, `Plays for **${known.team || "?"}**. No vlr.gg numbers on the site's events yet.`), site ? { url: `${site}/player/${teamSlug(known.name)}` } : {});
      }
      const f = (v, d = 0) => (v == null ? "–" : Number(v).toFixed(d));
      return {
        embeds: [{
          title: `${p.name} · ${p.team}`, url: site ? `${site}/player/${p.slug}` : undefined, color: COLOR,
          fields: [
            { name: "Rating", value: f(p.r, 2), inline: true }, { name: "ACS", value: f(p.acs), inline: true }, { name: "K/D", value: f(p.kd, 2), inline: true },
            { name: "KAST", value: p.kast != null ? `${p.kast}%` : "–", inline: true }, { name: "ADR", value: f(p.adr), inline: true }, { name: "HS%", value: p.hs != null ? `${p.hs}%` : "–", inline: true },
            { name: L("Cartes", "Maps"), value: String(p.maps), inline: true }, { name: "K / D / A", value: `${p.k} / ${p.d} / ${p.a}`, inline: true },
            { name: L("Agents", "Agents"), value: p.agents.map((a) => `${cap(a.name)} (${a.n})`).join(", ") || "–", inline: true },
          ],
          footer: { text: L("Tournois du site, d'après vlr.gg", "The site's events, from vlr.gg") },
        }],
      };
    }
    case "bracket": {
      const ev = EVENT_KEYS.includes(opt(i, "tournoi")) ? opt(i, "tournoi") : EVENT_KEYS.find((e) => norm(evName(e)).includes(norm(opt(i, "tournoi"))));
      if (!ev) return { content: L("Tournoi inconnu.", "Unknown event.") };
      const items = all.filter((m) => m.event === ev);
      const played = items.filter((m) => m.sa != null).length;
      const now = items.find((m) => m.sa == null);
      const r = ctx.recap(ev);
      const lines = [
        `${L("Matchs joués", "Matches played")} : **${played}** / ${items.length}`,
        now ? `${L("Tour en cours", "Current round")} : **${roundOf(now, L)}**` : played ? L("**Tournoi terminé**", "**Event over**") : L("Pas encore commencé", "Not started yet"),
        r && !r.done && r.aliveCount ? `${L("Équipes encore en lice", "Teams still in")} : **${r.aliveCount}**${r.alive.length ? ` (${r.alive.map((a) => a.team.name).join(", ")})` : ""}` : "",
        r && r.done ? `${L("Qualifiés", "Qualified")} : **${r.qualified.map((q) => q.team.name).join(", ")}**` : "",
      ].filter(Boolean);
      return embed(evName(ev), clip(lines), { ...(site ? { url: `${site}${ctx.eventHref(ev)}` } : {}), ...(r && site ? { image: { url: `${site}/api/og/bracket/${ev}?v=${played}` } } : {}) });
    }
    case "match": {
      const mine = all.filter((m) => plays(m, slug));
      const m = mine.find((x) => x.live) || done(mine)[0];
      if (!m) return { content: L(`Aucun match de ${found.name} pour l'instant.`, `No match of ${found.name} yet.`) };
      const ex = (state.extra[m.event] || {})[m.id] || {};
      const s = m.live ? liveOf(m) : null;
      const maps = s ? s.maps || [] : ex.maps || [];
      const mvp = ex.mvp || ctx.mvp(m.event, m.id);
      return {
        embeds: [{
          title: `${nameOf(m.a)} ${m.live ? `${s.a ?? 0}–${s.b ?? 0}` : `${m.sa}–${m.sb}`} ${nameOf(m.b)}`,
          url: site ? `${site}/match/${m.event}/${m.id}` : undefined, color: m.live ? 0xff0000 : COLOR,
          description: `${m.live ? `🔴 ${L("En direct", "Live")} · ` : ""}${evName(m.event)} · ${roundOf(m, L)}${m.bo ? ` · Bo${m.bo}` : ""}`,
          fields: [
            ...maps.filter((x) => x.a != null).map((x) => ({ name: x.map || L("Carte", "Map"), value: `${x.a} – ${x.b}`, inline: true })),
            ...(mvp ? [{ name: "MVP", value: mvp, inline: false }] : []),
          ],
          ...(site && !m.live ? { image: { url: `${site}/api/og/${m.event}/${m.id}?v=${m.sa}-${m.sb}` } } : {}),
        }],
      };
    }
    case "live": {
      const live = all.filter((m) => m.live);
      const lines = live.slice(0, 15).map((m) => {
        const stream = ((state.extra[m.event] || {})[m.id] || {}).stream || (state.info[m.event] || {}).stream || "";
        return `${liveLine(m)}${stream ? ` · [stream](${stream})` : ""}`;
      });
      return embed(`🔴 ${L("En direct", "Live")} (${live.length})`, live.length ? clip(lines) : L("Aucun match en cours.", "No match being played."), site ? { url: `${site}/live` } : {});
    }
    case "top": {
      const key = (STATS.find(([v]) => v === opt(i, "stat")) || STATS[0])[1];
      const ev = EVENT_KEYS.includes(opt(i, "tournoi")) ? opt(i, "tournoi") : "";
      const list = ctx.stats(ev).players.filter((p) => p.maps >= 4 && p[key] != null).sort((a, b) => b[key] - a[key]).slice(0, 10);
      const show = (v) => (key === "r" || key === "kd" ? Number(v).toFixed(2) : key === "kast" || key === "hs" ? `${v}%` : v);
      const label = (STATS.find(([, k]) => k === key) || ["rating"])[0];
      return embed(`Top 10 · ${label === "kd" ? "K/D" : label === "hs" ? "HS%" : cap(label)}${ev ? ` · ${evName(ev)}` : ""}`, clip(list.map((p, k) => `${k + 1}. **${p.name}** (${p.team}) · ${show(p[key])} · ${p.maps} ${L("cartes", "maps")}`)), { footer: { text: L("4 cartes jouées au moins, d'après vlr.gg", "4 maps played at least, from vlr.gg") } });
    }
    case "lft": {
      const list = ctx.lft().filter((p) => !p.staff).slice(0, 12);
      return embed(L("Joueurs libres (LFT)", "Free agents (LFT)"), clip(list.map((p) => `${p.cc ? `:flag_${p.cc.slice(0, 2)}: ` : ""}**${p.name}** · ${L("a quitté", "left")} ${p.from} · <t:${unix(`${p.date}T12:00:00Z`)}:d>${p.role && !/^player$/i.test(p.role) ? ` · ${p.role}` : ""}`)), site ? { url: `${site}/lft` } : {});
    }
    default:
      return { content: L("Commande inconnue.", "Unknown command.") };
  }
}

/** /pronostic: the next open matches, each with its two buttons, the visitor's picks marked. */
export function pronosticMessage(ctx, picks) {
  const L = words(ctx.lang);
  const open = allMatches(ctx.state()).filter((m) => ctx.isOpen(m)).sort((x, y) => (x.at || "9").localeCompare(y.at || "9")).slice(0, 5);
  if (!open.length) return { content: L("Aucun match à pronostiquer pour l'instant.", "No match to predict for now."), flags: 64 };
  const lines = open.map((m) => `**${nameOf(m.a)}** vs **${nameOf(m.b)}** · ${evName(m.event)}${m.at ? ` · <t:${unix(m.at)}:R>` : ""}`);
  const button = (m, side) => {
    const t = side === "a" ? m.a : m.b;
    const on = picks[`${m.event}:${m.id}`] === t.name;
    return { type: 2, style: on ? 3 : 2, label: `${on ? "✓ " : ""}${t.name}`.slice(0, 80), custom_id: `p|${m.event}|${m.id}|${side}` };
  };
  return {
    flags: 64,
    embeds: [{ title: L("Pronostics", "Predictions"), description: clip(lines), color: COLOR, footer: { text: L("Clique sur l'équipe qui gagne. Ça compte au classement du site.", "Click the team that wins. It counts in the site's ranking.") } }],
    components: open.map((m) => ({ type: 1, components: [button(m, "a"), button(m, "b")] })),
  };
}

/** A name for the ranking from a Discord user: the one given, else their Discord name, made to fit (2 to 20 letters or numbers). */
export function voterName(given, user) {
  const raw = String(given || (user && (user.global_name || user.username)) || "").normalize("NFC").replace(/[^\p{L}\p{N} ._-]/gu, "").trim().slice(0, 20);
  return raw.length >= 2 ? raw : `Joueur ${String((user && user.id) || "").slice(-4)}`;
}
