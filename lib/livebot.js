// The bot's post when a live match gets tense (server only: kept apart from lib/livemore.js, which the pages use).
import { tension } from "./livemore.js";

/** The bot: one post when a live match reaches overtime or its deciding map (once each). */
export async function closeMatchPosts(db, state, settings, now = Date.now()) {
  const { allMatches } = await import("./matchlist.js");
  const { postMessage } = await import("./botapi.js");
  const { logBot, sendOnce } = await import("./botstore.js");
  const { EVENT_NAMES } = await import("./paths.js");
  const L = (fr, en) => (settings.lang === "en" ? en : fr);
  const site = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || "vct-emea.vercel.app"}`;
  for (const m of allMatches(state).filter((x) => x.live && x.sa == null && x.a && x.b && settings.events[x.event] !== false)) {
    const live = (state.live[m.event] || {})[m.id];
    const t = tension(live, m.bo);
    const line = (txt) => `${txt} · ${EVENT_NAMES[m.event] || m.event} · ${site}/match/${m.event}/${m.id}`;
    const posts = [];
    if (t.ot && sendOnce(db, `ot:${m.event}:${m.id}:${t.ot}`, now)) posts.push(line(L(`🔥 **Prolongation** sur ${t.ot} : **${m.a.name}** ${t.a}–${t.b} **${m.b.name}**`, `🔥 **Overtime** on ${t.ot}: **${m.a.name}** ${t.a}–${t.b} **${m.b.name}**`)));
    if (t.decider && sendOnce(db, `decider:${m.event}:${m.id}`, now)) posts.push(line(L(`⚔️ **Map décisive** : **${m.a.name}** ${live.a ?? live.sa}–${live.b ?? live.sb} **${m.b.name}**${t.map ? `, sur ${t.map}` : ""}`, `⚔️ **Deciding map**: **${m.a.name}** ${live.a ?? live.sa}–${live.b ?? live.sb} **${m.b.name}**${t.map ? `, on ${t.map}` : ""}`)));
    for (const content of posts) {
      try { await postMessage(settings.channel, { content, allowed_mentions: { parse: [] } }); logBot(db, "match serré", `${m.a.name} vs ${m.b.name}`); } catch (e) { logBot(db, "match serré", e.message, false); }
    }
  }
}
