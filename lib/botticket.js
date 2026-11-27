// A ticket read in the editor (components/BotTicket.jsx): its saved transcript turned back into messages, or, while it is
// open, its live messages from Discord in the same shape. Pure.

const IMAGE = /\.(png|jpe?g|gif|webp)(\?|$)/i;

/**
 * The text transcript (lib/botmod2.js buildTranscript) as messages: { head: { opened, closedBy, count }, messages:
 * [{ at, who, text, files, embeds }] }, oldest first. Lines that do not start a message continue the one before.
 */
export function parseTranscript(text) {
  const head = { opened: "", closedBy: "", count: 0 };
  const messages = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    const m = line.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\] (.*?) : (.*)$/);
    if (m) {
      let rest = m[3];
      const files = [];
      const embeds = [];
      // the attachments and embeds were put after the text, each in brackets
      for (;;) {
        const tail = rest.match(/ \[([^\[\]]*)\]$/);
        if (!tail) break;
        if (/^https?:\/\//.test(tail[1])) files.unshift(tail[1]); else embeds.unshift(tail[1]);
        rest = rest.slice(0, tail.index);
      }
      messages.push({ at: `${m[1].replace(" ", "T")}:00Z`, who: m[2], text: rest.split(" ⏎ ").join("\n"), files, embeds, bot: false });
      continue;
    }
    if (!messages.length) {
      const o = line.match(/^Ouvert : (.+)$/); if (o) head.opened = o[1];
      const c = line.match(/^Fermé par : (.+)$/); if (c) head.closedBy = c[1];
      const n = line.match(/^(\d+) messages$/); if (n) head.count = Number(n[1]);
    } else if (line.trim()) {
      messages[messages.length - 1].text += `\n${line}`;
    }
  }
  return { head, messages };
}

/** Discord's messages (newest first, as the API gives them) in the same shape, oldest first, with avatars. */
export function liveMessages(list) {
  return [...(list || [])].reverse().filter((m) => m && (m.content || (m.attachments || []).length || (m.embeds || []).length)).map((m) => ({
    at: m.timestamp || "",
    who: (m.member && m.member.nick) || (m.author && (m.author.global_name || m.author.username)) || "?",
    id: (m.author && m.author.id) || "",
    avatar: m.author && m.author.avatar ? `https://cdn.discordapp.com/avatars/${m.author.id}/${m.author.avatar}.png?size=64` : "",
    bot: !!(m.author && m.author.bot),
    text: m.content || "",
    files: (m.attachments || []).map((a) => a.url),
    embeds: (m.embeds || []).map((e) => [e.title, e.description].filter(Boolean).join(" · ").slice(0, 600)).filter(Boolean),
  }));
}

export const isImage = (url) => IMAGE.test(String(url || ""));
