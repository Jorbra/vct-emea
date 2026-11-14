// Calendar files and video players built from a match's links. Pure.
import { EVENT_NAMES, siteHref } from "./paths.js";

const pad = (n) => String(n).padStart(2, "0");
const icsDate = (t) => `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}T${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}00Z`;
const icsText = (s) => String(s).replace(/\\/g, "\\\\").replace(/[;,]/g, (c) => "\\" + c).replace(/\r?\n/g, "\\n");

/** A match as a calendar event; it lasts an hour per map it can have. */
function icsEvent({ uid, title, at, bo, url }, now) {
  const start = new Date(at);
  const end = new Date(start.getTime() + Math.max(1, bo || 3) * 3600e3);
  return ["BEGIN:VEVENT", `UID:${icsText(uid)}@vct-emea`, `DTSTAMP:${icsDate(now)}`, `DTSTART:${icsDate(start)}`, `DTEND:${icsDate(end)}`, `SUMMARY:${icsText(title)}`, `DESCRIPTION:${icsText(url)}`, "END:VEVENT"];
}

/** A calendar file. events: [{ uid, title, at, bo, url }]. */
export function icsFile(events, name = "VCT EMEA", now = new Date()) {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//VCT EMEA//Matches//FR", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${icsText(name)}`, ...events.flatMap((e) => icsEvent(e, now)), "END:VCALENDAR"].join("\r\n") + "\r\n";
}

/** The Google Calendar link of a match. */
export function googleCalendarUrl({ title, at, bo, url }) {
  const start = new Date(at);
  const end = new Date(start.getTime() + Math.max(1, bo || 3) * 3600e3);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${icsDate(start)}/${icsDate(end)}&details=${encodeURIComponent(url)}`;
}

/** Scheduled matches of the given events as calendar events (with their full addresses when `base` is given). */
export function scheduleEvents(list, base = "") {
  return list.filter((m) => m.at).map((m) => ({
    uid: `${m.event}-${m.id}`,
    title: `${(m.a && m.a.name) || "TBD"} vs ${(m.b && m.b.name) || "TBD"} · ${EVENT_NAMES[m.event] || ""}`,
    at: m.at, bo: m.bo, url: base + siteHref(m.event),
  }));
}

/** The address to show a stream or video inside the site: Twitch and YouTube only. "" when it cannot be embedded. */
export function embedUrl(link, host = "localhost") {
  let u;
  try {
    u = new URL(link);
  } catch {
    return "";
  }
  if (u.protocol !== "https:") return "";
  const h = u.hostname.replace(/^(www|m)\./, "");
  const parent = encodeURIComponent(host);
  if (h === "twitch.tv") {
    const [first, second] = u.pathname.split("/").filter(Boolean);
    if (first === "videos" && /^\d+$/.test(second || "")) return `https://player.twitch.tv/?video=${second}&parent=${parent}&autoplay=false`;
    return first && /^\w+$/.test(first) ? `https://player.twitch.tv/?channel=${first}&parent=${parent}&autoplay=false` : "";
  }
  // Kick: a channel
  if (h === "kick.com") {
    const [first] = u.pathname.split("/").filter(Boolean);
    return first && /^[\w-]{2,40}$/.test(first) ? `https://player.kick.com/${first}?autoplay=false` : "";
  }
  let id = "";
  if (h === "youtu.be") id = u.pathname.slice(1);
  if (h === "youtube.com") {
    const parts = u.pathname.split("/").filter(Boolean);
    id = u.searchParams.get("v") || (["live", "embed", "shorts"].includes(parts[0]) ? parts[1] : "") || "";
  }
  return /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : "";
}
