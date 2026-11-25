// The quiz of the day: 3 questions on the matches of the days before, the same for everyone, one go per day. Each right answer
// adds to the visitor's streak of right answers in a row; a wrong one starts it again. The questions come from the weekly
// quiz's maker, seeded by the day instead of the week.
import crypto from "node:crypto";
import { weeklyQuiz } from "./round6.js";

const PARIS_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }); // made once: making one is slow
export const quizDay = (now = Date.now()) => PARIS_DAY.format(new Date(now));
const hashOf = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
const validToken = (t) => /^[A-Za-z0-9_-]{20,80}$/.test(String(t || ""));
const fail = (status, error) => ({ ok: false, status, error });
export const PER_DAY = 3;

function ensure(db) {
  db.exec("CREATE TABLE IF NOT EXISTS daily_quiz (hash TEXT NOT NULL, day TEXT NOT NULL, result TEXT NOT NULL, good INTEGER NOT NULL, at TEXT NOT NULL, PRIMARY KEY (hash, day))");
}

/** The day's questions, with their answers (server only). */
export const dailyQuiz = (state, day = quizDay()) => weeklyQuiz(state, day).slice(0, PER_DAY);

/** Streaks from the visitor's days (oldest first): { streak (now), best }. A day not played does not break it. Pure. */
export function streaks(days) {
  let streak = 0;
  let best = 0;
  for (const d of days) for (const ok of d) { streak = ok ? streak + 1 : 0; best = Math.max(best, streak); }
  return { streak, best };
}

const myDays = (db, hash) => db.prepare("SELECT day, result FROM daily_quiz WHERE hash = ? ORDER BY day").all(hash)
  .map((r) => { try { return { day: r.day, result: JSON.parse(r.result) }; } catch { return { day: r.day, result: [] }; } });

/** What a visitor did today and their streaks; null without a valid token. */
export function myDailyQuiz(db, token, now = Date.now()) {
  if (!validToken(token)) return null;
  ensure(db);
  const days = myDays(db, hashOf(token));
  const today = days.find((d) => d.day === quizDay(now));
  return { today: today ? today.result : null, ...streaks(days.map((d) => d.result.map((r) => r.ok))) };
}

/** Plays the day's quiz, once. answers: { [question id]: option }. */
export function answerDailyQuiz(db, state, { token, answers }, now = Date.now()) {
  if (!validToken(token)) return fail(400, "Reload the page and try again.");
  ensure(db);
  const day = quizDay(now);
  const quiz = dailyQuiz(state, day);
  if (!quiz.length) return fail(409, "No quiz today.");
  const hash = hashOf(token);
  if (db.prepare("SELECT 1 FROM daily_quiz WHERE hash = ? AND day = ?").get(hash, day)) return fail(409, "You already played today's quiz.");
  const given = answers && typeof answers === "object" ? answers : {};
  const result = quiz.map((q) => ({ id: q.id, given: String(given[q.id] ?? ""), answer: q.answer, ok: String(given[q.id] ?? "") === q.answer }));
  const good = result.filter((r) => r.ok).length;
  db.prepare("INSERT INTO daily_quiz (hash, day, result, good, at) VALUES (?, ?, ?, ?, ?)").run(hash, day, JSON.stringify(result), good, new Date(now).toISOString());
  return { ok: true, today: result, good, total: result.length, ...myDailyQuiz(db, token, now) };
}

/** The longest running streaks among the named visitors: [{ name, streak, best }]. */
export function streakRanking(db, limit = 10) {
  ensure(db);
  const rows = db.prepare("SELECT q.hash, q.result, v.name FROM daily_quiz q JOIN voters v ON v.hash = q.hash ORDER BY q.hash, q.day").all();
  const by = new Map();
  for (const r of rows) {
    if (!by.has(r.hash)) by.set(r.hash, { name: r.name, days: [] });
    try { by.get(r.hash).days.push(JSON.parse(r.result).map((x) => x.ok)); } catch { /* skipped */ }
  }
  return [...by.values()].map((v) => ({ name: v.name, ...streaks(v.days) })).filter((v) => v.streak > 0)
    .sort((a, b) => b.streak - a.streak || b.best - a.best || a.name.localeCompare(b.name)).slice(0, limit);
}
