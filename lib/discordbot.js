// The Discord bot's commands. Discord calls /api/discord; each call is checked with the application's public key.
// handleInteraction answers at once (autocomplete, buttons) or says "thinking…" and sends the answer right after.
import crypto from "node:crypto";
import { allMatches } from "./matchlist.js";
import { EVENT_NAMES, teamSlug } from "./paths.js";
import { parseRoster } from "./tournament.js";

/** /aide: every command and what it does. */
export function helpMessage(lang, disabled = []) {
  const L = words(lang);
  const lines = COMMANDS.filter((c) => !disabled.includes(c.name)).map((c) => `\`/${c.name}${(c.options || []).map((o) => (o.required ? ` <${o.name}>` : ` [${o.name}]`)).join("")}\` · ${c.description}`);
  return { flags: 64, embeds: [{ title: L("Commandes du bot VCT EMEA", "VCT EMEA bot commands"), description: clip(lines), color: COLOR, footer: { text: L("<…> obligatoire · […] facultatif", "<…> required · […] optional") } }] };
}

const EVENT_KEYS = Object.keys(EVENT_NAMES);
const STATS = [["rating", "r"], ["acs", "acs"], ["kd", "kd"], ["kast", "kast"], ["adr", "adr"], ["hs", "hs"], ["kills", "k"], ["fk", "fk"]];
const team = (required, description = "Nom de l'équipe") => ({ type: 3, name: "equipe", description, required, autocomplete: true });

/** What Discord shows when "/" is typed. */
export const COMMANDS = [
  { name: "score", description: "Matchs en cours et derniers résultats (d'une équipe si tu la donnes)", options: [team(false)] },
  { name: "prochain", description: "Prochains matchs (d'une équipe si tu la donnes)", options: [team(false)] },
  { name: "classement", description: "Top 10 des pronostics : de la saison, ou de ce serveur", options: [{ type: 3, name: "portee", description: "Le site ou ce serveur", required: false, choices: [{ name: "Tout le site", value: "site" }, { name: "Ce serveur", value: "serveur" }] }] },
  { name: "rappel", description: "Un message privé 15 min avant le match de ton choix", options: [{ type: 3, name: "match", description: "Le match", required: true, autocomplete: true }] },
  { name: "duel", description: "Deux joueurs face à face, en image", options: [{ type: 3, name: "joueur1", description: "Premier joueur", required: true, autocomplete: true }, { type: 3, name: "joueur2", description: "Deuxième joueur", required: true, autocomplete: true }] },
  { name: "cartedujour", description: "Le joueur du jour, en carte" },
  { name: "devine", description: "Mini-jeu : devine le joueur, son équipe ou le vainqueur d'un match" },
  { name: "classementjeu", description: "Le classement du mini-jeu /devine" },
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
  { name: "carte", description: "Une carte : attaque/défense, équipes et joueurs les plus forts", options: [{ type: 3, name: "nom", description: "La carte", required: true, autocomplete: true }, { type: 3, name: "tournoi", description: "Un seul tournoi", required: false, autocomplete: true }] },
  { name: "compare", description: "Deux joueurs côte à côte, stats de la saison", options: [{ type: 3, name: "joueur1", description: "Premier joueur", required: true, autocomplete: true }, { type: 3, name: "joueur2", description: "Deuxième joueur", required: true, autocomplete: true }] },
  { name: "h2h", description: "Face-à-face de deux équipes sur le site", options: [{ ...team(true), name: "equipe1", description: "Première équipe" }, { ...team(true), name: "equipe2", description: "Deuxième équipe" }] },
  { name: "agent", description: "Un agent : taux de choix, victoires, meilleurs joueurs", options: [{ type: 3, name: "nom", description: "L'agent", required: true, autocomplete: true }] },
  { name: "records", description: "Les records de la saison (ACS, kills, cartes les plus longues…)", options: [{ type: 3, name: "tournoi", description: "Un seul tournoi", required: false, autocomplete: true }] },
  { name: "recap", description: "Le récap d'un tournoi : qualifiés, meilleurs joueurs, plus gros matchs", options: [{ type: 3, name: "tournoi", description: "Le tournoi", required: true, autocomplete: true }] },
  { name: "calendrier", description: "Le programme d'aujourd'hui, de demain ou de la semaine", options: [{ type: 3, name: "jour", description: "Quel jour", required: false, choices: [{ name: "Aujourd'hui", value: "today" }, { name: "Demain", value: "tomorrow" }, { name: "7 prochains jours", value: "week" }] }] },
  { name: "mesprono", description: "Ta place au classement et tes derniers pronostics" },
  { name: "profil", description: "Ta carte : points, place, badges et succès" },
  { name: "fantasy", description: "Ton équipe fantasy, ses points et ta place" },
  { name: "rappelprono", description: "Un message privé quand tu n'as pas pronostiqué les matchs qui arrivent (active / désactive)" },
  { name: "jeux", description: "Les jeux du jour du site : joueur mystère, plus ou moins, logo mystère" },
  { name: "simule", description: "Les chances de qualification d'une équipe (simulation)", options: [team(true)] },
  { name: "tierlist", description: "La tier list de la communauté, en image" },
  { name: "puissance", description: "Le classement de puissance des équipes (Elo de la saison)", options: [{ type: 3, name: "region", description: "Une seule région", required: false, choices: [{ name: "Europe", value: "eu" }, { name: "Türkiye", value: "tr" }, { name: "MENA", value: "mena" }] }] },
  { name: "aide", description: "Toutes les commandes du bot" },
];

export const MAPS = ["Abyss", "Ascent", "Bind", "Breeze", "Corrode", "Fracture", "Haven", "Icebox", "Lotus", "Pearl", "Split", "Sunset"];
export const AGENTS = ["Astra", "Breach", "Brimstone", "Chamber", "Clove", "Cypher", "Deadlock", "Fade", "Gekko", "Harbor", "Iso", "Jett", "KAY/O", "Killjoy", "Neon", "Omen", "Phoenix", "Raze", "Reyna", "Sage", "Skye", "Sova", "Tejo", "Viper", "Vyse", "Waylay", "Yoru"];

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
  if (i.data.name === "joueur" || /^joueur\d$/.test(focused.name)) return pick([...new Set(ctx.players().map((p) => p.name))]).map((n) => ({ name: n, value: n }));
  if (i.data.name === "carte") return pick(MAPS).map((n) => ({ name: n, value: n }));
  if (focused.name === "match") {
    const soon = allMatches(ctx.state()).filter((m) => m.a && m.b && m.a.name && m.b.name && m.sa == null && m.at && new Date(m.at).getTime() > ctx.now).sort((x, y) => x.at.localeCompare(y.at));
    return soon.filter((m) => !q || norm(`${m.a.name}${m.b.name}`).includes(q)).slice(0, 25)
      .map((m) => ({ name: `${m.a.name} vs ${m.b.name} · ${new Date(m.at).toLocaleString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`.slice(0, 100), value: `${m.event}:${m.id}` }));
  }
  if (i.data.name === "agent") return pick(AGENTS).map((n) => ({ name: n, value: n }));
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
  if (teamArg && !found && ["score", "prochain", "equipe", "match", "suivre", "simule"].includes(name)) return { content: L(`Aucune équipe trouvée pour « ${teamArg} ».`, `No team found for "${teamArg}".`) };
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
      return { embeds: [{ title: t.name, url: site ? `${site}/team/${slug}` : undefined, color: COLOR, description: [t.tag ? `\`${t.tag}\`` : "", info && info.region ? info.region : ""].filter(Boolean).join(" · ") || undefined, fields, ...(logo && /^https:/.test(logo) ? { thumbnail: { url: logo } } : {}), ...(site ? { image: { url: `${site}/api/og/team/${slug}?v=${last.length}` } } : {}) }] };
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
          ...(site ? { image: { url: `${site}/api/og/player/${p.slug}?v=${p.maps}` } } : {}),
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
          ...(site ? { image: { url: `${site}/api/og/${m.event}/${m.id}?v=${m.live ? `l${s.a ?? 0}-${s.b ?? 0}` : `${m.sa}-${m.sb}`}` } } : {}),
        }],
      };
    }
    case "duel": {
      const players = ctx.stats().players;
      const find = (q) => players.find((x) => norm(x.name) === norm(q)) || players.find((x) => norm(x.name).startsWith(norm(q)));
      const a = find(opt(i, "joueur1"));
      const b = find(opt(i, "joueur2"));
      if (!a || !b) return { content: L("Il me faut deux joueurs avec des stats sur les tournois du site.", "I need two players with numbers on the site's events.") };
      return { embeds: [{ title: `${a.name} vs ${b.name}`, color: COLOR, url: site ? `${site}/compare?a=${encodeURIComponent(a.name)}&b=${encodeURIComponent(b.name)}` : undefined, ...(site ? { image: { url: `${site}/api/og/duel?a=${a.slug}&b=${b.slug}` } } : {}) }] };
    }
    case "cartedujour": {
      const pool = ctx.stats().players.filter((p) => p.maps >= 4).sort((x, y) => x.slug.localeCompare(y.slug));
      if (!pool.length) return { content: L("Pas encore de joueur à montrer.", "No player to show yet.") };
      const day = Math.floor((ctx.now + 3600000) / 86400000);
      const p = pool[(day * 7919) % pool.length];
      return { embeds: [{ title: L(`Carte du jour : ${p.name}`, `Card of the day: ${p.name}`), color: COLOR, url: site ? `${site}/player/${p.slug}` : undefined, description: `${p.team} · Rating **${Number(p.r).toFixed(2)}** · ACS **${p.acs}**`, ...(site ? { image: { url: `${site}/api/og/player/${p.slug}?d=${day}` } } : {}) }] };
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
    case "carte": {
      const ev = EVENT_KEYS.includes(opt(i, "tournoi")) ? opt(i, "tournoi") : "";
      const c = ctx.mapCard(opt(i, "nom"), ev);
      if (!c) return { content: L(`Pas encore de partie sur « ${opt(i, "nom")} ».`, `No game on "${opt(i, "nom")}" yet.`) };
      return {
        embeds: [{
          title: `${c.map}${ev ? ` · ${evName(ev)}` : ""}`, url: site ? `${site}/map/${encodeURIComponent(c.map.toLowerCase())}${ev ? `?e=${ev}` : ""}` : undefined, color: COLOR,
          description: [`${L("Cartes jouées", "Maps played")} : **${c.played}**`, `${L("Écart moyen", "Average gap")} : **${c.diff}** ${L("manches", "rounds")}`, `${L("Prolongations", "Overtimes")} : **${c.overtime}**`, c.attack != null ? `${L("Attaque", "Attack")} **${c.attack}%** · ${L("Défense", "Defence")} **${100 - c.attack}%**` : ""].filter(Boolean).join("\n"),
          fields: [
            c.teams.length ? { name: L("Équipes les plus fortes", "Strongest teams"), value: clip(c.teams.slice(0, 5).map((t) => `**${t.name}** ${t.won}–${t.played - t.won} (${Math.round((t.won / t.played) * 100)}%)`), 1000), inline: true } : null,
            c.players.length ? { name: L("Meilleurs joueurs", "Best players"), value: clip(c.players.slice(0, 5).map((p) => `**${p.name}** ${p.r != null ? p.r.toFixed(2) : "–"} · ${p.acs ?? "–"} ACS`), 1000), inline: true } : null,
          ].filter(Boolean),
        }],
      };
    }
    case "compare": {
      const players = ctx.stats().players;
      const find = (q) => players.find((x) => norm(x.name) === norm(q)) || players.find((x) => norm(x.name).startsWith(norm(q)));
      const a = find(opt(i, "joueur1"));
      const b = find(opt(i, "joueur2"));
      if (!a || !b) return { content: L(`Pas de stats pour « ${!a ? opt(i, "joueur1") : opt(i, "joueur2")} » sur les tournois du site.`, `No numbers for "${!a ? opt(i, "joueur1") : opt(i, "joueur2")}" on the site's events.`) };
      const rows = [["Rating", "r", 2], ["ACS", "acs", 0], ["K/D", "kd", 2], ["KAST", "kast", 0, "%"], ["ADR", "adr", 0], ["HS%", "hs", 0, "%"], [L("Cartes", "Maps"), "maps", 0]];
      const show = (v, d, u = "") => (v == null ? "–" : `${Number(v).toFixed(d)}${u}`);
      const mark = (x, y) => (x != null && y != null && x > y ? " ◀" : "");
      return {
        embeds: [{
          title: `${a.name} vs ${b.name}`, color: COLOR, url: site ? `${site}/compare?a=${encodeURIComponent(a.name)}&b=${encodeURIComponent(b.name)}` : undefined,
          fields: [
            { name: `${a.name} (${a.team})`, value: rows.map(([l, k, d, u]) => `${l} : **${show(a[k], d, u)}**${k === "maps" ? "" : mark(a[k], b[k])}`).join("\n"), inline: true },
            { name: `${b.name} (${b.team})`, value: rows.map(([l, k, d, u]) => `${l} : **${show(b[k], d, u)}**${k === "maps" ? "" : mark(b[k], a[k])}`).join("\n"), inline: true },
          ],
          footer: { text: L("◀ : le meilleur des deux. Tournois du site, d'après vlr.gg", "◀: the better of the two. The site's events, from vlr.gg") },
        }],
      };
    }
    case "h2h": {
      const t1 = findTeam(ctx.teams(), opt(i, "equipe1"));
      const t2 = findTeam(ctx.teams(), opt(i, "equipe2"));
      if (!t1 || !t2) return { content: L("Équipe inconnue.", "Unknown team.") };
      const c = ctx.h2h(t1, t2);
      const rate = (r) => (r.w + r.l ? Math.round((r.w / (r.w + r.l)) * 100) : 0);
      return {
        embeds: [{
          title: `${t1.name} ${c.h2h.a} – ${c.h2h.b} ${t2.name}`, color: COLOR,
          description: c.meetings.length ? clip(c.meetings.slice(0, 8).map((x) => `${x.won === "a" ? "🟢" : "🔴"} ${t1.name} ${x.sa}–${x.sb} ${t2.name} · ${evName(x.event)}${link(x)}`)) : L("Jamais affrontées sur le site.", "Never met on the site."),
          fields: [
            { name: t1.name, value: `${c.a.w}V – ${c.a.l}D (${rate(c.a)}%)\n${L("Cartes", "Maps")} ${c.a.mw}–${c.a.ml}`, inline: true },
            { name: t2.name, value: `${c.b.w}V – ${c.b.l}D (${rate(c.b)}%)\n${L("Cartes", "Maps")} ${c.b.mw}–${c.b.ml}`, inline: true },
          ],
        }],
      };
    }
    case "agent": {
      const q = norm(opt(i, "nom"));
      const list = ctx.extra().agents;
      const a = list.find((x) => norm(x.agent) === q || norm(x.name) === q) || list.find((x) => norm(x.agent).startsWith(q));
      if (!a) return { content: L(`« ${opt(i, "nom")} » n'a pas encore été joué sur les tournois du site.`, `"${opt(i, "nom")}" has not been played on the site's events yet.`) };
      const total = list.reduce((s, x) => s + x.picks, 0) / 5;
      return embed(a.name, [
        `${L("Choisi", "Picked")} : **${a.picks}** ${L("fois", "times")} (${total ? Math.round((a.picks / total) * 100) : 0}% ${L("des compos", "of the line-ups")})`,
        `${L("Cartes gagnées", "Maps won")} : **${a.pct}%**`,
        a.best.length ? `${L("Meilleurs joueurs", "Best players")} : ${a.best.map((p) => `**${p.name}** (${p.r != null ? p.r.toFixed(2) : "–"})`).join(", ")}` : "",
      ].filter(Boolean).join("\n"));
    }
    case "records": {
      const ev = EVENT_KEYS.includes(opt(i, "tournoi")) ? opt(i, "tournoi") : "";
      const r = ctx.extra(ev).records;
      const top = (list, f) => (list.length ? clip(list.slice(0, 3).map((x, k) => `${k + 1}. ${f(x)}`), 1000) : "–");
      return {
        embeds: [{
          title: `${L("Records", "Records")}${ev ? ` · ${evName(ev)}` : ""}`, color: COLOR, url: site ? `${site}/stats${ev ? `?e=${ev}` : ""}` : undefined,
          fields: [
            { name: L("Plus gros ACS sur une carte", "Highest ACS on a map"), value: top(r.acs, (x) => `**${x.name}** ${x.value} · ${x.map}`) },
            { name: L("Plus de kills sur une carte", "Most kills on a map"), value: top(r.kills, (x) => `**${x.name}** ${x.value} · ${x.map}`) },
            { name: L("Cartes les plus longues", "Longest maps"), value: top(r.long, (x) => `${x.a} **${x.sa}–${x.sb}** ${x.b} · ${x.map}`) },
            { name: L("Plus grosses victoires", "Biggest wins"), value: top(r.blowout, (x) => `**${x.winner}** ${x.w}–${x.l} ${x.loser} · ${x.map}`) },
            { name: L("Remontées", "Comebacks"), value: top(r.comeback, (x) => `**${x.winner}** ${x.sa}–${x.sb} ${x.loser}`) },
          ],
        }],
      };
    }
    case "recap": {
      const ev = EVENT_KEYS.includes(opt(i, "tournoi")) ? opt(i, "tournoi") : EVENT_KEYS.find((e) => norm(evName(e)).includes(norm(opt(i, "tournoi"))));
      const r = ev ? ctx.recap(ev) : null;
      if (!r) return { content: L("Pas de récap pour ce tournoi (seulement les qualifiers).", "No recap for this event (qualifiers only).") };
      return {
        embeds: [{
          title: `${L("Récap", "Recap")} · ${evName(ev)}`, url: site ? `${site}/recap/${ev}` : undefined, color: COLOR,
          description: [`${r.played} / ${r.total} ${L("matchs joués", "matches played")}`, r.overtime ? `${r.overtime} ${L("cartes en prolongation", "maps in overtime")}` : "", r.maps[0] ? `${L("Carte la plus jouée", "Most played map")} : **${r.maps[0].map}**` : ""].filter(Boolean).join(" · "),
          fields: [
            r.done ? { name: L("Qualifiés", "Qualified"), value: r.qualified.map((q) => `**${q.team.name}**`).join(", ") } : { name: L(`Encore en course (${r.aliveCount})`, `Still in (${r.aliveCount})`), value: r.alive.length ? r.alive.map((a) => a.team.name).join(", ") : L("Plus de 16 équipes", "More than 16 teams") },
            r.top.length ? { name: L("Meilleurs joueurs", "Best players"), value: clip(r.top.slice(0, 5).map((p, k) => `${k + 1}. **${p.name}** (${p.team}) · ${p.r != null ? p.r.toFixed(2) : "–"}`), 1000) } : null,
            r.bigGames.length ? { name: L("Plus gros matchs", "Biggest games"), value: clip(r.bigGames.slice(0, 3).map((g) => `**${g.name}** ${g.acs} ACS (${g.k}/${g.d})`), 1000) } : null,
          ].filter(Boolean),
          ...(site ? { image: { url: `${site}/api/og/bracket/${ev}?v=${r.played}` } } : {}),
        }],
      };
    }
    case "calendrier": {
      const which = opt(i, "jour") || "today";
      const paris = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);
      const today = paris(new Date(ctx.now));
      const tomorrow = paris(new Date(ctx.now + 86400000));
      const inRange = (m) => {
        if (!m.at) return false;
        const d = paris(new Date(m.at));
        if (which === "tomorrow") return d === tomorrow;
        if (which === "week") return new Date(m.at).getTime() >= ctx.now - 3 * 3600000 && new Date(m.at).getTime() < ctx.now + 7 * 86400000;
        return d === today;
      };
      const list = all.filter(inRange).sort((x, y) => x.at.localeCompare(y.at));
      const line = (m) => (m.live ? liveLine(m) : m.sa != null ? `✅ ${doneLine(m)}` : `<t:${unix(m.at)}:${which === "week" ? "f" : "t"}> · **${nameOf(m.a)}** vs **${nameOf(m.b)}** · ${evName(m.event)}`);
      const title = which === "tomorrow" ? L("Programme de demain", "Tomorrow's schedule") : which === "week" ? L("Les 7 prochains jours", "The next 7 days") : L("Programme du jour", "Today's schedule");
      return embed(`${title} (${list.length})`, list.length ? clip(list.slice(0, 30).map(line)) : L("Aucun match prévu.", "No match planned."), site ? { url: `${site}/calendar` } : {});
    }
    case "puissance": {
      const REG = { eu: ["q1", "q2", "playoffs"], tr: ["trq1", "trq2", "tr"], mena: ["meq1", "meq2", "naq1", "naq2", "mena"] };
      const region = REG[opt(i, "region")];
      const keep = region ? new Set(all.filter((m) => region.includes(m.event)).flatMap((m) => [teamSlug(nameOf(m.a)), teamSlug(nameOf(m.b))])) : null;
      const rows = ctx.power().filter((t) => !keep || keep.has(t.slug)).slice(0, 15);
      const move = (t) => (t.move == null ? "🆕" : t.move > 0 ? `🔼 ${t.move}` : t.move < 0 ? `🔽 ${-t.move}` : "➖");
      return embed(L("Classement de puissance", "Power ranking") + (region ? ` · ${opt(i, "region").toUpperCase()}` : ""), clip(rows.map((t, k) => `${["🥇", "🥈", "🥉"][k] || `${k + 1}.`} **${t.name}** · ${t.rating} · ${t.w}V-${t.l}D · ${move(t)}`)), { ...(site ? { url: `${site}/puissance` } : {}), footer: { text: L("Elo sur toutes les séries de la saison · flèche : places en 7 jours", "Elo over every series of the season · arrow: places in 7 days") } });
    }
    case "simule": {
      const list = ctx.chances(found.name);
      if (!list.length) return { content: L(`**${found.name}** n'est plus en course dans un qualifier en cours.`, `**${found.name}** is no longer in a running qualifier.`) };
      return embed(L(`Chances de ${found.name}`, `${found.name}'s chances`), list.map((x) => `**${x.name}** · ${x.pct}% ${L("de se qualifier", "to qualify")}`).join("\n"), { ...(site ? { url: `${site}/simulateur` } : {}), footer: { text: L("800 tirages d'après le classement de puissance", "800 draws from the power ranking") } });
    }
    case "tierlist": {
      const c = ctx.tiers();
      if (!c.lists) return { content: L(`Personne n'a encore fait sa tier list : ${site}/tierlist`, `Nobody made a tier list yet: ${site}/tierlist`) };
      const name = new Map(c.teams.map((t) => [t.slug, t.tag || t.name]));
      const param = ["S", "A", "B", "C", "D"].filter((k) => c.tiers[k].length).map((k) => `${k}:${c.tiers[k].join(",")}`).join(";");
      return embed(L(`Tier list de la communauté (${c.lists})`, `The community's tier list (${c.lists})`), ["S", "A", "B", "C", "D"].filter((k) => c.tiers[k].length).map((k) => `**${k}** · ${c.tiers[k].map((s) => name.get(s) || s).join(", ")}`).join("\n"), site ? { url: `${site}/tierlist`, image: { url: `${site}/api/og/tier?t=${encodeURIComponent(param)}` } } : {});
    }
    case "jeux":
      return embed(L("🎮 Jeux du jour", "🎮 Games of the day"), L("**Joueur mystère** : trouve le joueur en 6 essais.\n**Plus ou moins** : qui a la meilleure stat ?\n**Logo mystère** : reconnais l'équipe.\n\nNouveaux chaque jour à minuit, une partie chacun.", "**Mystery player**: find the player in 6 guesses.\n**Higher or lower**: who has the better number?\n**Mystery logo**: name the team.\n\nNew every day at midnight, one go each."), site ? { url: `${site}/jeux` } : {});
    default:
      return { content: L("Commande inconnue.", "Unknown command.") };
  }
}

/**
 * The buttons under an answer: the page on the site, follow the team, refresh a live answer. Discord shows them under the embed.
 * Pure: from the command, what was asked and the answer.
 */
export function answerButtons(name, i, payload, site, lang) {
  const L = words(lang);
  const e = payload.embeds && payload.embeds[0];
  const row = [];
  if (e && e.url && /^https:/.test(e.url)) row.push({ type: 2, style: 5, label: L("Voir sur le site", "Open on the site"), url: e.url });
  const team = opt(i, "equipe") || (name === "equipe" ? opt(i, "nom") : "");
  if (["equipe", "match", "score", "prochain"].includes(name) && team) row.push({ type: 2, style: 2, label: L("🔔 Suivre en MP", "🔔 Follow in DMs"), custom_id: `f|${team.slice(0, 80)}` });
  if (["score", "live", "match"].includes(name)) row.push({ type: 2, style: 2, label: L("🔄 Actualiser", "🔄 Refresh"), custom_id: `r|${name}|${team.slice(0, 80)}` });
  return row.length ? { ...payload, components: [{ type: 1, components: row.slice(0, 5) }] } : payload;
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
