// The result of a daily game as text to share: squares, no answer given away. Pure, for the browser too.
/** The text to share once done: the day, the game, the result in squares (no answer given away). Pure. */
export function shareText(game, g, day, site) {
  if (game === "joueur") return `VCT EMEA · Joueur mystère ${day} · ${g.won ? `${g.guesses.length}/6` : "X/6"}\n${g.guesses.map((x) => ["team", "cc", "agent", "r", "acs"].map((k) => (x.clues[k] === "ok" ? "🟩" : /near/.test(x.clues[k]) ? "🟨" : "⬛")).join("")).join("\n")}\n${site}/jeux`;
  if (game === "agent") return `VCT EMEA · Agent mystère ${day} · ${g.won ? `${g.guesses.length}/5` : "X/5"}\n${g.guesses.map((x) => (x.ok ? "🟩" : "🟥")).join("")}\n${site}/jeux`;
  if (game === "logo") return `VCT EMEA · Logo mystère ${day} · ${g.won ? `${g.guesses.length}/5` : "X/5"}\n${g.guesses.map((x) => (x.ok ? "🟩" : "🟥")).join("")}\n${site}/jeux`;
  return `VCT EMEA · Plus ou moins ${day} · ${g.answers.filter((x) => x.ok).length}/10\n${g.answers.map((x) => (x.ok ? "🟩" : "🟥")).join("")}\n${site}/jeux`;
}
