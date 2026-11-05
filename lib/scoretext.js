// How a result reads. A result from Toornament can be a forfeit or a score in rounds ("13 – 3"): the bracket still needs its winner in maps,
// but nobody should read a 2 – 0 that was never played. Pure.

/** The saved note of a match: { kind: "ff" } | { kind: "win" } | { kind: "raw", a, b }, or null. */
export function parseNote(text) {
  if (text === "ff" || text === "win") return { kind: text };
  const m = /^raw:(\d+)-(\d+)$/.exec(String(text || ""));
  return m ? { kind: "raw", a: Number(m[1]), b: Number(m[2]) } : null;
}

/** "13 – 3", "Forfait", "Victoire" or the usual "2 – 1". */
export function scoreLabel(m, tr, sep = "–") {
  const n = m.note;
  if (n && n.kind === "raw") return `${n.a} ${sep} ${n.b}`;
  if (n && n.kind === "ff") return tr("Forfeit");
  if (n && n.kind === "win") return tr("Win");
  return `${m.sa} ${sep} ${m.sb}`;
}

/** One side's part of a result, for the places that show one team per line. side: "a" or "b". */
export function sideScore(m, side, score) {
  const n = m.note;
  if (n && n.kind === "raw") return n[side];
  if (n) return m.win === side ? "W" : n.kind === "ff" ? "FF" : "–";
  return score;
}
