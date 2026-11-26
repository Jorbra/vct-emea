// New things shown first to the main account and the editors, then to everyone with one switch in the editor (no new
// deployment). Each one is a name here; the switch is saved in the kv table ("apercu:<name>" = "public"). Pure but for the db.

/** The new things that can wait in preview: name -> what it changes (French, as the editor shows it). */
export const APERCU = {
  pictos: { title: "Pictos des rounds", text: "Tête de mort, explosion, spike barré et chrono à la place des symboles, sur la page du match et /live." },
  cartes: { title: "Cartes des joueurs", text: "L'agent en entier en haut de la carte, sans le gros rond à initiale par-dessus." },
  perdant: { title: "Perdant lisible", text: "Le nom de l'équipe perdante en gris clair au lieu d'être presque invisible." },
  logos: { title: "Logos sombres lisibles", text: "Un fond clair discret derrière les logos noirs ou très sombres, en mode sombre (TH, UCAM…)." },
  flash: { title: "Flash des scores", text: "Un score qui change à l'écran (round, carte, série) s'illumine un instant." },
  projection: { title: "Classement suisse projeté", text: "Pendant les matchs, un bouton montre le tableau suisse s'ils finissaient maintenant, avec les places gagnées ou perdues." },
};

const key = (name) => `apercu:${name}`;

/** { name: true } for the new things open to everyone. */
export function publicApercu(db) {
  const out = {};
  for (const name of Object.keys(APERCU)) {
    const r = db.prepare("SELECT value FROM kv WHERE key = ?").get(key(name));
    out[name] = !!r && r.value === JSON.stringify("public");
  }
  return out;
}

/** The names a visitor sees: every one for an editor, those open to everyone otherwise. */
export function shownApercu(db, editor) {
  const open = publicApercu(db);
  return Object.keys(APERCU).filter((name) => editor || open[name]);
}

/** Opens a new thing to everyone (on: true) or puts it back in preview. { ok, message } | { ok: false, status, error }. */
export function setApercu(db, name, on) {
  if (!APERCU[name]) return { ok: false, status: 400, error: "Unknown new thing." };
  db.prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(key(name), JSON.stringify(on ? "public" : "preview"));
  return { ok: true, message: on ? `Nouveauté ouverte à tout le monde : ${APERCU[name].title}` : `Nouveauté remise en aperçu éditeurs : ${APERCU[name].title}` };
}
