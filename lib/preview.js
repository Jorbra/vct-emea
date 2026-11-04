// What a page says of itself when its link is shared (Discord, X...): title, one line about where things stand, a picture.
import { makeT } from "./i18n.js";
import { EVENT_NAMES } from "./paths.js";
import { eventStatus, formatDates } from "./status.js";

const TABS = { swiss: "Swiss Stage", bracket: "Bracket", stats: "Statistics" };

export function eventPreview(event, tab, state, lang = "fr") {
  const tr = makeT(lang);
  const st = eventStatus(state)[event];
  const parts = [
    tr(st.state === "done" ? "Finished" : st.state === "live" ? "Live" : "Upcoming"),
    formatDates(state.info && state.info[event], lang),
    st.of ? `${st.teams}/${st.of} ${tr("teams")}` : `${st.teams} ${tr("teams")}`,
  ].filter(Boolean);
  const out = st.out.map((t) => t.name).join(", ");
  return {
    title: `${tr(EVENT_NAMES[event])}${TABS[tab] ? ` · ${tr(TABS[tab])}` : ""} · VCT EMEA`,
    description: parts.join(" · ") + (out ? ` · ${tr("Qualified")} : ${out}` : ""),
    image: "/brand/emea-kickoff.png",
  };
}

export function teamPreview(profile, lang = "fr") {
  const tr = makeT(lang);
  const tot = profile.events.reduce((o, e) => ({ w: o.w + e.w, l: o.l + e.l }), { w: 0, l: 0 });
  return {
    title: `${profile.name} · VCT EMEA`,
    description: `${tr("{w} wins, {l} losses", tot)} · ${profile.events.map((e) => tr(EVENT_NAMES[e.event])).join(", ")}`,
    image: profile.team.logo || "/brand/emea-icon.png",
  };
}

/** The same as Next metadata. */
export function sharedPreview({ title, description, image }) {
  return {
    title, description,
    openGraph: { siteName: "VCT EMEA", type: "website", title, description, images: [{ url: image }] },
    twitter: { card: "summary", title, description, images: [image] },
  };
}
