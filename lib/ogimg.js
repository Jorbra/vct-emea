// What the pictures shared on Discord and X read: a team's logo straight from the database, a color for a name.
export function logoData(db, team) {
  const m = /^\/api\/logos\/(.+\.(png|jpe?g))$/i.exec((team && team.logo) || "");
  if (!m) return "";
  const row = db.prepare("SELECT data FROM lp_logos WHERE file = ?").get(decodeURIComponent(m[1]));
  if (!row) return "";
  return `data:image/${m[2].toLowerCase() === "png" ? "png" : "jpeg"};base64,${Buffer.from(row.data).toString("base64")}`;
}

/** A steady color for a name, when there is no logo color to go by. */
export function nameColor(name) {
  let h = 0;
  for (const c of String(name || "")) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h}, 55%, 38%)`;
}
