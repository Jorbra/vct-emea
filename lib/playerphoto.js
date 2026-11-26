// A player's photo: the one on their Liquipedia page first, else the one on their vlr.gg page; "" without one.
// Liquipedia's files come through the site (/api/lp-img, kept once downloaded); vlr.gg's straight from its image server.

/** The photo of a player's Liquipedia infobox, as a path under commons/images; "" without one or for a placeholder. Pure. */
export function lpPhotoPath(html) {
  const at = String(html || "").indexOf("infobox-image");
  if (at < 0) return "";
  const box = html.slice(at, at + 2500);
  const src = (box.match(/<img[^>]*src="\/commons\/images\/(?:thumb\/)?([0-9a-f]\/[0-9a-f]{2}\/[^/"]+)/) || [])[1] || "";
  return src && !/placeholder|filler|liquipedia_logo|lp_logo|allmode|lightmode|darkmode/i.test(src) ? src : "";
}

/** The photo of a vlr.gg player page (its avatar), as an https address; "" for vlr.gg's silhouette. Pure. */
export function vlrPhotoUrl(html) {
  const m = /wf-avatar mod-player[\s\S]{0,300}?<img src="([^"]+)"/.exec(String(html || ""));
  if (!m) return "";
  const url = m[1].startsWith("//") ? `https:${m[1]}` : m[1];
  return /^https:\/\/owcdn\.net\/img\/[\w.-]+\.(png|jpe?g|webp)$/i.test(url) ? url : "";
}

/** The address to show for a player (key: their slug), from what was read on Liquipedia and vlr.gg. */
export function photoOf(key, playerInfo, vlrPlayers) {
  const lp = playerInfo && playerInfo[key] && playerInfo[key].photo;
  if (lp) return `/api/lp-img?f=${encodeURIComponent(lp)}&w=240`;
  const v = vlrPlayers && vlrPlayers[key] && vlrPlayers[key].photo;
  return v || "";
}
