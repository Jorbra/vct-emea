// For the editor's "Sources" screen: each event's links as followed now (the code's or an editor's) and when each was last read.
import { EVENT_NAMES } from "./paths.js";
import { readItems } from "./lpstore.js";
import { isQualifier, readSources, toornamentLink, vlrLink } from "./sources.js";
import { toornamentIds } from "./toornament.js";
import { vlrSources } from "./vlrmatch.js";

export function sourcesReport(db) {
  const set = readSources(db);
  const ids = toornamentIds(db);
  const { events, brackets } = vlrSources(db);
  const tmeta = readItems("tsync_meta", db);
  const lists = readItems("vlr_event", db);
  return Object.keys(EVENT_NAMES).map((event) => {
    const v = events.find((x) => x.event === event);
    const t = tmeta[event] || {};
    const list = v ? lists[`vlr:${v.vlr}`] : null;
    return {
      event, qualifier: isQualifier(event), set: set[event] || null,
      toornament: ids[event] ? { id: ids[event], link: toornamentLink(ids[event]), at: t.at || "", error: t.error || "", teams: t.teams || 0 } : null,
      vlr: v ? { id: v.vlr, link: vlrLink(v.vlr), stage: v.stage.source === "." ? "" : v.stage.source.replace(/\\b/g, "").replace(/\\s\*/g, " ").replace(/\\(.)/g, "$1"), at: (list && list.at) || "", matches: list ? list.matches.filter((x) => v.stage.test(x.stage || "")).length : 0 } : null,
      bracket: brackets.includes(event),
    };
  });
}
