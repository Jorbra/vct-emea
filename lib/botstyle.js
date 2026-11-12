// One look for every answer of the bot: the site as author, a footer with the site's name, the time, the site's colour when none is set.
const COLOR = 0xc9f03c;

/** The answer with each embed dressed the same way (the content and buttons are left as they are). Pure. */
export function styleAnswer(answer, site, lang = "fr") {
  if (!answer || !Array.isArray(answer.embeds)) return answer;
  const host = site ? site.replace(/^https?:\/\//, "") : "vct-emea.vercel.app";
  const icon = site ? `${site}/brand/icon-192.png` : undefined;
  return {
    ...answer,
    embeds: answer.embeds.map((e) => ({
      color: COLOR,
      ...e,
      author: e.author || { name: "VCT EMEA", ...(site ? { url: site } : {}), ...(icon ? { icon_url: icon } : {}) },
      footer: e.footer ? { ...e.footer, text: `${e.footer.text} · ${host}`.slice(0, 2000) } : { text: lang === "en" ? `${host} · results, stats and games` : `${host} · résultats, stats et jeux` },
      timestamp: e.timestamp || new Date().toISOString(),
    })),
  };
}
