// Makes light copies of the agents', maps' and abilities' pictures for the site's pages (WebP, at the size they are shown),
// in public/va/, and lists them in lib/valorant-local.json. The originals stay in lib/valorant-assets.json for the share
// pictures and the bot. Run again after updating the pictures: node scripts/optimize-assets.mjs
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const ASSETS = JSON.parse(fs.readFileSync(path.join(root, "lib/valorant-assets.json"), "utf8"));
const ABILITIES = JSON.parse(fs.readFileSync(path.join(root, "lib/valorant-abilities.json"), "utf8"));
const out = path.join(root, "public/va");
fs.mkdirSync(path.join(out, "agents"), { recursive: true });
fs.mkdirSync(path.join(out, "maps"), { recursive: true });
fs.mkdirSync(path.join(out, "abilities"), { recursive: true });

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const jobs = [];
const local = { agents: {}, maps: {}, abilities: {} };
// [remote url, local path, resize options, quality]
const add = (url, rel, resize, quality, set) => { if (url) jobs.push({ url, rel, resize, quality, set }); };

for (const [k, a] of Object.entries(ASSETS.agents)) {
  const l = (local.agents[k] = {});
  add(a.icon, `agents/${k}-icon.webp`, { width: 128, height: 128, fit: "inside" }, 82, (p) => (l.icon = p));
  add(a.portrait, `agents/${k}-portrait.webp`, { height: 1000, fit: "inside", withoutEnlargement: true }, 78, (p) => (l.portrait = p));
  add(a.pose, `agents/${k}-pose.webp`, { width: 700, fit: "inside", withoutEnlargement: true }, 80, (p) => (l.pose = p));
}
for (const [name, m] of Object.entries(ASSETS.maps)) {
  const k = norm(name);
  const l = (local.maps[name] = {});
  add(m.splash, `maps/${k}-splash.webp`, { width: 1600, fit: "inside", withoutEnlargement: true }, 72, (p) => (l.splash = p));
  add(m.list, `maps/${k}-list.webp`, { width: 600, fit: "inside", withoutEnlargement: true }, 76, (p) => (l.list = p));
  add(m.icon, `maps/${k}-mini.webp`, { width: 400, fit: "inside", withoutEnlargement: true }, 82, (p) => (l.icon = p));
}
for (const [k, list] of Object.entries(ABILITIES.agents)) {
  const l = (local.abilities[k] = {});
  for (const x of list) add(x.icon, `abilities/${k}-${norm(x.slot)}.webp`, { width: 128, height: 128, fit: "inside" }, 85, (p) => (l[x.slot] = p));
}

let before = 0;
let after = 0;
const run = async (j) => {
  const file = path.join(out, j.rel);
  if (!fs.existsSync(file)) {
    const res = await fetch(j.url.startsWith("http") ? j.url : `https:${j.url}`, { headers: { "User-Agent": "vct-emea-site/1.0" } });
    if (!res.ok) { console.log(`skip ${j.rel}: ${res.status}`); return; }
    const buf = Buffer.from(await res.arrayBuffer());
    before += buf.length;
    await sharp(buf).resize(j.resize).webp({ quality: j.quality, effort: 5 }).toFile(file);
  }
  after += fs.statSync(file).size;
  j.set(`/va/${j.rel}`);
};
// a few at a time, to be gentle with the image hosts
for (let i = 0; i < jobs.length; i += 6) await Promise.all(jobs.slice(i, i + 6).map(run));
fs.writeFileSync(path.join(root, "lib/valorant-local.json"), JSON.stringify(local, null, 1) + "\n");
console.log(`${jobs.length} pictures · downloaded ${(before / 1e6).toFixed(1)} MB · light copies ${(after / 1e6).toFixed(1)} MB`);
