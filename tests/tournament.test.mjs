// Run with: npm test   (Node's built-in test runner, no extra packages)
import test from "node:test";
import assert from "node:assert/strict";
import Database from "libsql";
import { resetQualifier, saveQualifierScore, setQualifierBo, setQualifierTeams } from "../lib/qactions.js";
import { ROUNDS, buildBracket, checkScore, matchId, podium, slotsFromLines } from "../lib/bracket.js";
import { makeT, serverFr } from "../lib/i18n.js";
import { sniffImage } from "../lib/images.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { findLogo, saveTagLogo, openDb, getState, upgradeTeams, fillSeedDefaults } from "../lib/db.js";
import { generateBracket, generateSwiss, resetStage, saveScore, toggleSwap, updateTeam } from "../lib/actions.js";
import { calc, planBracket, planSwiss, prizePool, rankTeams, records, standing, result, swissGroups, parseRoster, parseStaff, rosterEntry, validLogo, logoUrl } from "../lib/tournament.js";
import { checkPassword, makeToken, recordFailure, tooManyAttempts, verifyToken } from "../lib/auth.js";

function freshDb() {
  const db = openDb(":memory:");
  // Fill the 10 open slots so the Swiss Stage can start.
  for (let i = 7; i <= 16; i++) {
    const r = updateTeam(db, `t${String(i).padStart(2, "0")}`, {
      name: `Team ${i}`, tag: "", status: i <= 8 ? "invited" : "qualified", roster: "",
    });
    assert.equal(r.ok, true);
  }
  return db;
}

/** The team with the lower seed number always wins 2-0 (or 2-1 on odd rounds). */
function playRound(db, round) {
  const { teams, matches } = getState(db);
  const order = Object.fromEntries(teams.map((t) => [t.id, t.order]));
  for (const m of matches.filter((x) => x.stage === "swiss" && x.round === round)) {
    const aWins = order[m.a] < order[m.b];
    const loserMaps = round % 2 ? 1 : 0;
    const r = saveScore(db, { id: m.id, sa: aWins ? 2 : loserMaps, sb: aWins ? loserMaps : 2 });
    assert.equal(r.ok, true, r.error);
  }
}

test("series scores: only a finished series has a winner", () => {
  assert.deepEqual(calc(3, 2, 1, "a", "b"), { winner: "a", loser: "b" });
  assert.deepEqual(calc(5, 1, 3, "a", "b"), { winner: "b", loser: "a" });
  assert.equal(calc(3, 1, 1, "a", "b"), null);
  assert.equal(calc(3, 2, 2, "a", "b"), null);
  assert.equal(calc(3, null, 2, "a", "b"), null);
});

test("the seed data is the 16 slots, 8 invited and 8 qualified", () => {
  const { teams } = getState(openDb(":memory:"));
  assert.equal(teams.length, 16);
  assert.equal(teams.filter((t) => t.status === "invited").length, 8);
  assert.equal(teams.filter((t) => t.name).length, 6);
});

test("round 1 needs all teams named, then pairs invited with qualified", () => {
  const empty = openDb(":memory:");
  assert.equal(generateSwiss(empty).ok, false);

  const db = freshDb();
  assert.equal(generateSwiss(db).ok, true);
  const { teams, matches } = getState(db);
  assert.equal(matches.length, 8);
  const status = Object.fromEntries(teams.map((t) => [t.id, t.status]));
  for (const m of matches) assert.notEqual(status[m.a], status[m.b]);
  assert.equal(generateSwiss(db).ok, false, "round 2 must wait for round 1 results");
});

test("score validation", () => {
  const db = freshDb();
  generateSwiss(db);
  const id = getState(db).matches[0].id;
  assert.equal(saveScore(db, { id, sa: 2, sb: 2 }).ok, false);
  assert.equal(saveScore(db, { id, sa: 3, sb: 0 }).ok, false);
  assert.equal(saveScore(db, { id, sa: -1, sb: 2 }).ok, false);
  assert.equal(saveScore(db, { id, sa: 1.5, sb: 2 }).ok, false);
  assert.equal(saveScore(db, { id: "nope", sa: 2, sb: 0 }).status, 404);
  assert.equal(saveScore(db, { id, sa: 2, sb: 1 }).ok, true);
  assert.equal(saveScore(db, { id, sa: null, sb: null }).ok, true);
  assert.equal(getState(db).matches[0].sa, null);
});

test("a full tournament: Swiss to 8 advanced and 8 eliminated, then the bracket and the prize pool", () => {
  const db = freshDb();
  let rounds = 0;
  for (;;) {
    const r = generateSwiss(db);
    if (!r.ok) {
      assert.match(r.error, /complete/);
      break;
    }
    rounds++;
    playRound(db, rounds);
    assert.ok(rounds <= 5, "a 16-team Swiss to 3 wins never exceeds 5 rounds");
  }
  assert.ok(rounds >= 3 && rounds <= 5);

  let { teams, matches } = getState(db);
  const rec = records(teams, matches);
  assert.equal(teams.filter((t) => standing(rec, t.id) === "adv").length, 8);
  assert.equal(teams.filter((t) => standing(rec, t.id) === "out").length, 8);
  assert.equal(rankTeams(teams, rec)[0].order, 1, "best seed tops the table");

  // No pair of teams meets twice.
  const seen = new Set();
  for (const m of matches) {
    const key = [m.a, m.b].sort().join("|");
    assert.equal(seen.has(key), false, `rematch ${key}`);
    seen.add(key);
  }

  assert.equal(generateBracket(db).ok, true);
  assert.equal(generateBracket(db).ok, false, "only one bracket");
  ({ matches } = getState(db));
  assert.equal(matches.filter((m) => m.stage === "elim").length, 6);

  // Play group A semis, final slots fill on their own.
  const byId = () => Object.fromEntries(getState(db).matches.map((m) => [m.id, m]));
  let M = byId();
  assert.equal(saveScore(db, { id: "eA-s1", sa: 2, sb: 0 }).ok, true);
  assert.equal(saveScore(db, { id: "eA-s2", sa: 0, sb: 2 }).ok, true);
  M = byId();
  assert.equal(M["eA-f"].a, M["eA-s1"].a);
  assert.equal(M["eA-f"].b, M["eA-s2"].b);

  // Final is Bo5.
  assert.equal(saveScore(db, { id: "eA-f", sa: 2, sb: 2 }).ok, false);
  assert.equal(saveScore(db, { id: "eA-f", sa: 3, sb: 1 }).ok, true);

  // Changing a semi result clears the final that depended on it.
  assert.equal(saveScore(db, { id: "eA-s1", sa: 0, sb: 2 }).ok, true);
  M = byId();
  assert.equal(M["eA-f"].a, M["eA-s1"].b);
  assert.equal(M["eA-f"].sa, null);

  // Group B, then the prize pool.
  saveScore(db, { id: "eB-s1", sa: 2, sb: 1 });
  saveScore(db, { id: "eB-s2", sa: 2, sb: 0 });
  saveScore(db, { id: "eA-f", sa: 3, sb: 0 });
  saveScore(db, { id: "eB-f", sa: 1, sb: 3 });
  ({ teams, matches } = getState(db));
  const placements = getState(db).placements;
  const pool = prizePool(teams, matches, placements);
  M = byId();
  assert.equal(pool.winners[0], result(M["eA-f"]).winner);
  assert.equal(pool.winners[1], result(M["eB-f"]).winner);
  assert.equal(pool.p3, result(M["eA-f"]).loser);
  assert.equal(pool.semiLosers.length, 4);
  assert.equal(pool.out.length, 8);

  toggleSwap(db);
  const swapped = prizePool(teams, matches, getState(db).placements);
  assert.equal(swapped.p3, pool.p4);
  assert.equal(swapped.p4, pool.p3);

  // Resetting the bracket keeps the Swiss results; resetting Swiss clears everything.
  assert.equal(resetStage(db, "elim").ok, true);
  assert.equal(getState(db).matches.every((m) => m.stage === "swiss"), true);
  assert.equal(resetStage(db, "swiss").ok, true);
  assert.equal(getState(db).matches.length, 0);
  assert.equal(resetStage(db, "bogus").ok, false);
});

test("bracket is refused until eight teams have three wins", () => {
  const db = freshDb();
  generateSwiss(db);
  const { teams, matches } = getState(db);
  assert.match(planBracket(teams, matches).err, /8 teams/);
  assert.ok(planSwiss(teams, matches).err);
});

test("team editing is validated", () => {
  const db = openDb(":memory:");
  assert.equal(updateTeam(db, "t01", { name: "x".repeat(41), status: "invited" }).ok, false);
  assert.equal(updateTeam(db, "t01", { name: "Okay", status: "vip" }).ok, false);
  assert.equal(updateTeam(db, "zzz", { name: "Okay", status: "invited" }).status, 404);
  assert.equal(updateTeam(db, "t01", { name: "Okay Team", status: "invited", roster: "A, B" }).ok, true);
  const t = getState(db).teams[0];
  assert.equal(t.tag, ""); // no tag is made up: only the one the editor types
  assert.equal(updateTeam(db, "t01", { name: "", status: "invited" }).ok, true);
  assert.equal(getState(db).teams[0].tag, "");
});

test("admin session tokens", () => {
  const token = makeToken("secret", 1000);
  assert.equal(verifyToken(token, "secret", 2000), true);
  assert.equal(verifyToken(token, "other", 2000), false);
  assert.equal(verifyToken(token + "0", "secret", 2000), false);
  assert.equal(verifyToken("garbage", "secret", 2000), false);
  assert.equal(verifyToken(token, "secret", 1000 + 8 * 24 * 3600 * 1000), false, "expired");
  assert.equal(verifyToken(undefined, "secret"), false);
  assert.equal(checkPassword("pw", "pw"), true);
  assert.equal(checkPassword("pw ", "pw"), false);
  assert.equal(checkPassword("pw", ""), false);
  for (let i = 0; i < 8; i++) recordFailure("1.2.3.4", 5000);
  assert.equal(tooManyAttempts("1.2.3.4", 5001), true);
  assert.equal(tooManyAttempts("9.9.9.9", 5001), false);
  assert.equal(tooManyAttempts("1.2.3.4", 5000 + 11 * 60 * 1000), false);
});

test("100 random Swiss Stages always end with 8 advanced and 8 eliminated in at most 5 rounds", () => {
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  let rematchRuns = 0;
  for (let run = 0; run < 100; run++) {
    const db = freshDb();
    let rounds = 0;
    let rematch = false;
    for (;;) {
      const r = generateSwiss(db);
      if (!r.ok) break;
      if (r.message.includes("rematch")) rematch = true;
      rounds++;
      assert.ok(rounds <= 5, `run ${run}: too many rounds`);
      for (const m of getState(db).matches.filter((x) => x.stage === "swiss" && x.round === rounds)) {
        const aWins = rnd() < 0.5;
        const loser = rnd() < 0.5 ? 0 : 1;
        assert.equal(saveScore(db, { id: m.id, sa: aWins ? 2 : loser, sb: aWins ? loser : 2 }).ok, true);
      }
    }
    const { teams, matches } = getState(db);
    const rec = records(teams, matches);
    assert.equal(teams.filter((t) => standing(rec, t.id) === "adv").length, 8, `run ${run}`);
    assert.equal(teams.filter((t) => standing(rec, t.id) === "out").length, 8, `run ${run}`);
    assert.equal(generateBracket(db).ok, true, `run ${run}`);
    if (rematch) rematchRuns++;
  }
  console.log(`# runs that needed a forced rematch: ${rematchRuns}/100`);
});

test("seed: known rosters and where each qualified slot comes from", () => {
  const { teams } = getState(openDb(":memory:"));
  const by = Object.fromEntries(teams.map((t) => [t.id, t]));
  assert.equal(by.t01.roster, "BULD|pl");
  assert.equal(by.t03.roster.split(",").length, 5);
  assert.equal(by.t07.name, "");
  assert.equal(by.t07.source, "");
  assert.deepEqual([by.t09.source, by.t09.pos], ["Qualifier 1", 1]);
  assert.deepEqual([by.t12.source, by.t12.pos], ["Qualifier 1", 4]);
  assert.deepEqual([by.t13.source, by.t13.pos], ["Qualifier 2", 1]);
  assert.deepEqual([by.t16.source, by.t16.pos], ["Qualifier 2", 4]);
});

test("a database from the first version is upgraded without losing an editor's changes", () => {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE teams (id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '', tag TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'qualified', roster TEXT NOT NULL DEFAULT '', ord INTEGER NOT NULL)`);
  const ins = db.prepare("INSERT INTO teams (id, name, tag, status, roster, ord) VALUES (?, ?, ?, ?, ?, ?)");
  ins.run("t01", "UCAM Esports", "UC", "invited", "", 1);
  ins.run("t02", "Eintracht Frankfurt", "EF", "invited", "typed by an editor", 2);
  ins.run("t09", "", "", "qualified", "", 9);
  upgradeTeams(db);
  const row = (id) => db.prepare("SELECT roster, source, pos FROM teams WHERE id = ?").get(id);
  assert.equal(row("t01").roster, "BULD|pl");
  assert.equal(row("t02").roster, "typed by an editor");
  assert.equal(row("t09").source, "Qualifier 1");
  assert.equal(row("t09").pos, 1);
  upgradeTeams(db); // running it again changes nothing and does not fail
});

test("prize pool lists semifinal losers and Swiss eliminations in Swiss table order", () => {
  const db = freshDb();
  for (let r = 1; generateSwiss(db).ok; r++) playRound(db, r);
  generateBracket(db);
  for (const id of ["eA-s1", "eA-s2", "eB-s1", "eB-s2"]) saveScore(db, { id, sa: 2, sb: 0 });
  const { teams, matches, placements } = getState(db);
  const rec = records(teams, matches);
  const rank = rankTeams(teams, rec).map((t) => t.id);
  const pool = prizePool(teams, matches, placements);
  assert.equal(pool.semiLosers.length, 4);
  assert.deepEqual(pool.semiLosers, rank.filter((id) => pool.semiLosers.includes(id)));
  assert.equal(pool.out.length, 8);
  assert.deepEqual(pool.out, rank.filter((id) => pool.out.includes(id)));
});

test("Swiss matches fall into the fixed round and record brackets", () => {
  let seed = 777;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  for (let run = 0; run < 50; run++) {
    const db = freshDb();
    let rounds = 0;
    while (generateSwiss(db).ok) {
      rounds++;
      for (const m of getState(db).matches.filter((x) => x.stage === "swiss" && x.round === rounds)) {
        const aWins = rnd() < 0.5;
        saveScore(db, { id: m.id, sa: aWins ? 2 : 1, sb: aWins ? 1 : 2 });
      }
    }
    const { teams, matches } = getState(db);
    const layout = swissGroups(teams, matches);
    let placed = 0;
    for (const r of layout) {
      for (const g of r.groups) {
        placed += g.matches.length;
        if (r.round <= rounds) assert.equal(g.matches.length, g.size, `run ${run} round ${r.round} ${g.key}`);
        else assert.equal(g.matches.length, 0);
      }
    }
    assert.equal(placed, matches.length, "every match is shown somewhere");
  }
  // Before anything is generated the layout is still complete, just empty.
  const empty = swissGroups(getState(openDb(":memory:")).teams, []);
  assert.deepEqual(empty.map((r) => r.groups.map((g) => g.key)), [["0-0"], ["1-0", "0-1"], ["2-0", "1-1", "0-2"], ["2-1", "1-2"], ["2-2"]]);
});

test("logos and player countries", () => {
  assert.deepEqual(parseRoster("azury|FR, musashi|gb-eng, Fizzy, bad|xyz, kamo|pl|SUB, nocc||sub"), [
    { name: "azury", cc: "fr", sub: false },
    { name: "musashi", cc: "gb-eng", sub: false },
    { name: "Fizzy", cc: "", sub: false },
    { name: "bad", cc: "", sub: false },
    { name: "kamo", cc: "pl", sub: true },
    { name: "nocc", cc: "", sub: true },
  ]);
  // and back to text, read the same way
  const list = parseRoster("azury|fr, Fizzy, kamo|pl|sub, nocc||sub");
  assert.equal(list.map((p) => rosterEntry(p.name, p)).join(", "), "azury|fr, Fizzy, kamo|pl|sub, nocc||sub");
  assert.ok(validLogo("") && validLogo("https://cdn.example.com/a.png") && validLogo("/logos/a.svg"));
  assert.ok(!validLogo("javascript:alert(1)") && !validLogo("data:image/png;base64,AA") && !validLogo("//evil.com/a.png") && !validLogo("http://x.com/a.png"));
  // A logo sent with the team is ignored: only the short tag picks it.
  const db = openDb(":memory:");
  assert.equal(updateTeam(db, "t01", { name: "UCAM Esports", status: "invited", roster: "BULD|es", logo: "https://x.com/a.png" }).ok, true);
  assert.equal(getState(db, "/nonexistent").teams[0].logo, "");
  assert.equal(db.prepare("SELECT logo FROM teams WHERE id = 't01'").get().logo, "");
});

test("seed carries logos and player countries, and old databases get them", () => {
  const db = openDb(":memory:");
  const t = getState(db).teams;
  assert.equal(t[0].logo, "");
  assert.match(t[1].roster, /Fizzy\|pt/);
  // An old database: plain roster, no logo. It is upgraded; an edited roster is left alone.
  db.prepare("UPDATE teams SET logo = '', roster = 'azury, musashi, Fizzy' WHERE id = 't02'").run();
  db.prepare("UPDATE teams SET logo = '', roster = 'my own edit' WHERE id = 't03'").run();
  fillSeedDefaults(db);
  const u = getState(db).teams;
  assert.match(u[1].roster, /musashi\|de/);
  assert.equal(u[2].roster, "my own edit");
});

test("logos are found by file name in public/logos", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "logos-"));
  fs.writeFileSync(path.join(dir, "NJ.svg"), "<svg/>");
  fs.writeFileSync(path.join(dir, "uc.png"), "x");
  assert.equal(findLogo("NAVI Junior", dir, "NJ"), "/api/logos/NJ.svg");
  assert.equal(findLogo("UCAM Esports", dir, "UC"), "/api/logos/uc.png");
  assert.equal(findLogo("MIR", dir, "MR"), "");
  const db = openDb(":memory:");
  const teams = getState(db, dir).teams;
  assert.equal(teams[0].logo, "/api/logos/uc.png");
  assert.equal(teams[4].logo, "/api/logos/NJ.svg");
  // A value left in the logo column does not matter: the tag wins.
  db.prepare("UPDATE teams SET logo = 'https://x.com/a.png' WHERE id = 't01'").run();
  assert.equal(getState(db, dir).teams[0].logo, "/api/logos/uc.png");
});

test("an uploaded logo is saved under the short tag and replaces the old file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "logos-"));
  fs.writeFileSync(path.join(dir, "vit.svg"), "<svg/>");
  fs.writeFileSync(path.join(dir, "KC.png"), "x");
  assert.equal(saveTagLogo("Vit", Buffer.from("png"), "png", dir), "VIT.png");
  assert.deepEqual(fs.readdirSync(dir).sort(), ["KC.png", "VIT.png"]);
  assert.equal(findLogo("Team Vitality", dir, "VIT"), "/api/logos/VIT.png");
  assert.equal(saveTagLogo("", Buffer.from("png"), "png", dir), "");
  // tags with spaces, accents or signs get a plain file name, still found from the tag
  assert.equal(saveTagLogo("BJK FE", Buffer.from("png"), "png", dir), "BJK-FE.png");
  assert.equal(findLogo("Beşiktaş Esports Female", dir, "BJK FE"), "/api/logos/BJK-FE.png");
  assert.equal(saveTagLogo("[A].Co", Buffer.from("png"), "png", dir), "A-CO.png");
  // a file put in the folder by hand with an accent is found, and its address is encoded
  fs.writeFileSync(path.join(dir, "KRÜ.png"), "x");
  assert.equal(findLogo("KRÜ Esports", dir, "KRÜ"), "/api/logos/KR%C3%9C.png");
});

test("a bare file name in the logo column points to /logos/", () => {
  assert.equal(logoUrl("UCAM.png"), "/api/logos/UCAM.png");
  assert.equal(logoUrl("/logos/a.svg"), "/api/logos/a.svg");
  assert.equal(logoUrl("/pics/a.svg"), "/pics/a.svg");
  assert.equal(logoUrl("https://x.com/a.png"), "https://x.com/a.png");
  assert.equal(logoUrl("javascript:alert(1)"), "");
});

test("uploaded logos are recognised by content, not by name", () => {
  assert.equal(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])), "png");
  assert.equal(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0])), "jpg");
  assert.equal(sniffImage(Buffer.from("RIFF1234WEBPVP8 ")), "webp");
  assert.equal(sniffImage(Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>')), "svg");
  assert.equal(sniffImage(Buffer.from("<html><script>alert(1)</script></html>")), null);
  assert.equal(sniffImage(Buffer.from("MZ\x90\x00")), null);
});

test("French and English texts", () => {
  const fr = makeT("fr");
  const en = makeT("en");
  assert.equal(fr("Overview"), "Aperçu");
  assert.equal(en("Overview"), "Overview");
  assert.equal(fr("Round {n}", { n: 3 }), "Tour 3");
  assert.equal(fr("Not in the dictionary"), "Not in the dictionary");
  assert.equal(serverFr("Round 2 created."), "Tour 2 créé.");
  assert.equal(serverFr("Needs 8 teams with 3 wins (5 so far)."), "Il faut 8 équipes avec 3 victoires (5 pour l'instant).");
  assert.equal(serverFr("One team must reach 2 maps, the other fewer."), "Une équipe doit atteindre 2 maps, l'autre moins.");
  assert.equal(en.server("Wrong password."), "Wrong password.");
  assert.equal(fr.server("Wrong password."), "Mot de passe incorrect.");
});

test("staff: coach and assistant coach", () => {
  assert.deepEqual(parseStaff("Chap|fr|coach, Bob|DE|assistant, Zed|1|boss, ,"), [
    { name: "Chap", cc: "fr", role: "coach" },
    { name: "Bob", cc: "de", role: "assistant" },
    { name: "Zed", cc: "", role: "coach" },
  ]);
  const db = openDb(":memory:");
  assert.equal(updateTeam(db, "t01", { name: "UCAM Esports", status: "invited", roster: "BULD|pl", staff: "Chap|fr|coach, Bob|de|assistant" }).ok, true);
  assert.equal(getState(db).teams[0].staff, "Chap|fr|coach, Bob|de|assistant");
  // A save that does not mention staff keeps it.
  assert.equal(updateTeam(db, "t01", { name: "UCAM Esports", status: "invited", roster: "BULD|pl" }).ok, true);
  assert.equal(getState(db).teams[0].staff, "Chap|fr|coach, Bob|de|assistant");
  assert.equal(updateTeam(db, "t01", { name: "UCAM Esports", status: "invited", roster: "", staff: "x".repeat(201) }).ok, false);
  // Resetting the team to TBD clears the staff too.
  assert.equal(updateTeam(db, "t01", { name: "", status: "invited", roster: "", staff: "" }).ok, true);
  assert.equal(getState(db).teams[0].staff, "");
});

test("64-team bracket: byes, advancing, third place, changed results", () => {
  const slots = Array.from({ length: 64 }, (_, i) => (i < 40 ? { name: `T${i + 1}` } : null));
  let b = buildBracket(slots, {});
  assert.equal(b.matches.length, 32 + 16 + 8 + 4 + 2 + 1 + 1);
  // 40 teams: slots 33-40 sit in matches 17-20 (full), slots 41-64 are empty: matches 21-32 have no team at all.
  assert.equal(b.byId["r64-1"].bye, false);
  assert.equal(b.byId["r64-21"].a, null);
  const odd = buildBracket([{ name: "A" }, null, { name: "C" }, { name: "D" }, ...Array(60).fill(null)], {});
  assert.equal(odd.byId["r64-1"].bye, true);
  assert.equal(odd.byId["r64-1"].winner, 1);
  assert.equal(odd.byId["r32-1"].a, 1);
  assert.equal(odd.byId["r32-1"].b, null);
  // Play every match of a full bracket: the lower slot always wins 1-0 (Bo1) or 2-0 (Bo3).
  const full = Array.from({ length: 64 }, (_, i) => ({ name: `T${i + 1}` }));
  const scores = {};
  for (let pass = 0; pass < 8; pass++) {
    b = buildBracket(full, scores);
    for (const m of b.matches) {
      if (m.a && m.b && !scores[m.id]) {
        const lowWins = m.a < m.b;
        const n = Math.ceil(m.bo / 2);
        scores[m.id] = { a: m.a, b: m.b, sa: lowWins ? n : 0, sb: lowWins ? 0 : n };
      }
    }
  }
  b = buildBracket(full, scores);
  assert.equal(podium(b)[0], 1);
  assert.equal(podium(b)[1], 33); // the best slot of each half meet in the final
  assert.ok(podium(b).every((x) => x != null));
  // Changing a result upstream invalidates the matches that depended on it.
  scores["r64-1"] = { a: 1, b: 2, sa: 0, sb: 1 };
  b = buildBracket(full, scores);
  assert.equal(b.byId["r64-1"].winner, 2);
  assert.equal(b.byId["r32-1"].a, 2);
  assert.equal(b.byId["r32-1"].winner, null);
  assert.equal(podium(b)[0], null);
  assert.match(checkScore({ a: 1, b: null, bo: 1 }, 1, 0), /Both teams/);
  assert.equal(checkScore({ a: 1, b: 2, bo: 3, bye: false }, 2, 1), "");
  assert.match(checkScore({ a: 1, b: 2, bo: 3, bye: false }, 1, 1), /must reach 2/);
  assert.deepEqual(slotsFromLines("A\n\nB ; x|fr, y ; Chap|fr|coach\n\n").map((r) => [r.name, r.roster, r.staff]), [["A", "", ""], ["", "", ""], ["B", "x|fr, y", "Chap|fr|coach"]]);
  assert.equal(slotsFromLines(Array(80).fill("x").join("\n")).length, 64);
  assert.equal(matchId("qf", 2), "qf-3");
  assert.equal(ROUNDS.length, 6);
});

test("qualifier: teams, scores, stale results, reset", () => {
  const db = openDb(":memory:");
  const names = Array.from({ length: 64 }, (_, i) => `Team ${i + 1}`).join("\n");
  assert.equal(setQualifierTeams(db, "q1", names).ok, true);
  assert.equal(setQualifierTeams(db, "zz", names).ok, false);
  let q = getState(db).qualifiers;
  assert.equal(q.q1.slots[0].name, "Team 1");
  assert.equal(q.q1.slots[0].tag, ""); // no tag is made up
  assert.equal(q.q1.slots[0].roster, "");
  assert.equal(q.q2.slots[0], null);
  assert.equal(saveQualifierScore(db, { event: "q1", id: "r32-1", sa: 1, sb: 0 }).ok, false); // teams not known yet
  assert.equal(saveQualifierScore(db, { event: "q1", id: "r64-1", sa: 1, sb: 1 }).ok, false); // Bo1: not a result
  assert.equal(saveQualifierScore(db, { event: "q1", id: "r64-1", sa: 1, sb: 0 }).ok, true);
  assert.equal(saveQualifierScore(db, { event: "q1", id: "r64-2", sa: 0, sb: 1 }).ok, true);
  assert.equal(saveQualifierScore(db, { event: "q1", id: "r32-1", sa: 1, sb: 0 }).ok, true); // Team 1 vs Team 4
  // Flip the first match: the Round of 32 result no longer fits and is dropped.
  assert.equal(saveQualifierScore(db, { event: "q1", id: "r64-1", sa: 0, sb: 1 }).ok, true);
  q = getState(db).qualifiers.q1;
  assert.equal(q.scores["r32-1"], undefined);
  assert.ok(q.scores["r64-2"]);
  // Changing the best-of drops results that are no longer valid scores.
  assert.equal(setQualifierBo(db, "q1", { r64: 3 }).ok, true);
  assert.equal(getState(db).qualifiers.q1.scores["r64-2"], undefined);
  assert.equal(setQualifierBo(db, "q1", { r64: 7 }).ok, false);
  assert.equal(saveQualifierScore(db, { event: "q1", id: "r64-2", sa: null, sb: null }).ok, true);
  assert.equal(resetQualifier(db, "q1").ok, true);
  assert.equal(getState(db).qualifiers.q1.slots[0], null);
});

test("GC EMEA team list: teams saved by slot, listed in the state, kept apart from the Qualifiers", async () => {
  const { openDb, getState } = await import("../lib/db.js");
  const { setQualifierSlot } = await import("../lib/qactions.js");
  const db = openDb(":memory:");
  assert.equal(setQualifierSlot(db, { event: "gc", slot: 2, name: "Shopify Rebellion GC", tag: "srgc", roster: "a|us", staff: "c|fr|coach" }).ok, true);
  assert.equal(setQualifierSlot(db, { event: "gc", slot: 1, name: "G2 Gozen", roster: "", staff: "" }).ok, true);
  let s = getState(db, fs.mkdtempSync(path.join(os.tmpdir(), "gc-")));
  assert.deepEqual(s.gc.map((t) => [t.slot, t.name, t.tag]), [[1, "G2 Gozen", ""], [2, "Shopify Rebellion GC", "SRGC"]]);
  assert.equal(s.gc[1].staff, "c|fr|coach");
  assert.equal(s.qualifiers.q1.slots.filter(Boolean).length, 0);
  // entry: invited by default, kept when not sent, checked
  assert.equal(s.gc[0].status, "invited");
  assert.equal(setQualifierSlot(db, { event: "gc", slot: 2, name: "Shopify Rebellion GC", tag: "SRGC", entry: "qualified" }).ok, true);
  assert.equal(setQualifierSlot(db, { event: "gc", slot: 2, name: "Shopify Rebellion GC", tag: "SRGC" }).ok, true);
  assert.equal(getState(db, fs.mkdtempSync(path.join(os.tmpdir(), "gc-"))).gc[1].status, "qualified");
  assert.equal(setQualifierSlot(db, { event: "gc", slot: 2, name: "X", entry: "partner" }).ok, false);
  const r = setQualifierSlot(db, { event: "gc", slot: 1, name: "" });
  assert.equal(r.message, "Team removed.");
  s = getState(db, fs.mkdtempSync(path.join(os.tmpdir(), "gc-")));
  assert.deepEqual(s.gc.map((t) => t.name), ["Shopify Rebellion GC"]);
});

test("qualifier slot: set one slot, roster/staff kept, empty name empties it, validation", async () => {
  const { openDb, getQualifier } = await import("../lib/db.js");
  const { setQualifierSlot } = await import("../lib/qactions.js");
  const db = openDb(":memory:");
  assert.equal(setQualifierSlot(db, { event: "q1", slot: 3, name: "Alpha", roster: "a|fr, b|de", staff: "c|fr|coach" }).ok, true);
  let q = getQualifier(db, "q1");
  assert.equal(q.slots[2].name, "Alpha");
  assert.equal(q.slots[2].roster, "a|fr, b|de");
  assert.equal(q.slots[2].staff, "c|fr|coach");
  assert.equal(setQualifierSlot(db, { event: "q1", slot: 65, name: "X" }).ok, false);
  assert.equal(setQualifierSlot(db, { event: "q1", slot: 0, name: "X" }).ok, false);
  assert.equal(setQualifierSlot(db, { event: "zz", slot: 1, name: "X" }).ok, false);
  assert.equal(setQualifierSlot(db, { event: "q1", slot: 1, name: "x".repeat(41) }).ok, false);
  assert.equal(setQualifierSlot(db, { event: "q1", slot: 3, name: "" }).ok, true);
  q = getQualifier(db, "q1");
  assert.equal(q.slots[2] || null, null);
});

test("kickoff: bracket feeds, scores, stale scores, places", async () => {
  const { openDb, getKickoff } = await import("../lib/db.js");
  const { setKickoffTeam, setKickoffMatch, saveKickoffScore } = await import("../lib/kactions.js");
  const { buildKickoff, kickPlaces } = await import("../lib/kickoff.js");
  const db = openDb(":memory:");
  let k = getKickoff(db);
  assert.equal(k.teams.length, 12);
  assert.equal(k.teams[0].name, "Team Vitality");
  assert.equal(k.teams[8].source, "EU Qualifier");
  assert.equal(setKickoffTeam(db, { slot: 9, name: "Joblife", roster: "a|fr", staff: "" }).ok, true);
  assert.equal(getKickoff(db).teams[8].name, "Joblife");
  assert.equal(setKickoffTeam(db, { slot: 13, name: "X" }).ok, false);
  // set two teams by hand in UB round 1 and play it
  assert.equal(setKickoffMatch(db, { id: "u1-1", a: 1, b: 2 }).ok, true);
  assert.equal(setKickoffMatch(db, { id: "u1-1", a: 1, b: 1 }).ok, false);
  assert.equal(saveKickoffScore(db, { id: "u1-1", sa: 2, sb: 5 }).ok, false);
  assert.equal(saveKickoffScore(db, { id: "u1-1", sa: 2, sb: 1 }).ok, true);
  k = getKickoff(db);
  let b = buildKickoff(k.manual, k.scores);
  assert.equal(b.byId["u1-1"].winner, 1);
  assert.equal(b.byId["u2-1"].b, 1); // the winner moves on by itself
  assert.equal(b.byId["u2-1"].a, null); // the seed is set by hand
  assert.equal(saveKickoffScore(db, { id: "u2-1", sa: 2, sb: 0 }).ok, false); // other team unknown
  setKickoffMatch(db, { id: "u2-1", a: 3 });
  assert.equal(saveKickoffScore(db, { id: "u2-1", sa: 0, sb: 2 }).ok, true);
  // changing the first match's teams makes the later score stale
  setKickoffMatch(db, { id: "u1-1", a: 2, b: 1 });
  k = getKickoff(db);
  b = buildKickoff(k.manual, k.scores);
  assert.equal(b.byId["u1-1"].winner, null);
  assert.equal(b.byId["u2-1"].winner, null);
  assert.equal(b.byId.u4.bo, 5);
  assert.equal(b.byId["u1-1"].bo, 3);
  assert.deepEqual(kickPlaces(b), Array(12).fill(null));
});

test("kickoff team: tag and entry are kept, the logo follows the tag; bad values refused", async () => {
  const { openDb, getKickoff } = await import("../lib/db.js");
  const { setKickoffTeam } = await import("../lib/kactions.js");
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "logos-"));
  fs.writeFileSync(path.join(dir, "VIT.png"), "x");
  const db = openDb(":memory:");
  assert.equal(setKickoffTeam(db, { slot: 1, name: "Vit", tag: "vit", logo: "other.png", entry: "qualified" }).ok, true);
  const t = getKickoff(db, dir).teams[0];
  assert.equal(t.tag, "VIT");
  assert.equal(t.status, "qualified");
  assert.equal(t.logo, "/api/logos/VIT.png");
  assert.equal(setKickoffTeam(db, { slot: 1, name: "Vit", entry: "nope" }).ok, false);
});

test("kickoff tables: seeded, editable from the database, old kv data moved in", async () => {
  const { openDb, getKickoff } = await import("../lib/db.js");
  const Database = (await import("libsql")).default;
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "kick-")), "t.db");
  let db = openDb(file);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM kteams").get().n, 12);
  // an edit made directly in the database shows up
  db.prepare("UPDATE kteams SET name = 'Joblife', tag = 'JL' WHERE slot = 9").run();
  assert.equal(getKickoff(db).teams[8].name, "Joblife");
  db.prepare("INSERT INTO kmatches (id, a, b) VALUES ('u1-1', 1, 2)").run();
  assert.deepEqual(getKickoff(db).manual["u1-1"], { a: 1, b: 2 });
  db.close();
  // data saved by the previous version (kv) is moved into the tables
  const old = new Database(path.join(path.dirname(file), "old.db"));
  old.exec("CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  old.prepare("INSERT INTO kv VALUES (?, ?)").run("kick:teams", JSON.stringify({ 3: { name: "FUT", tag: "FU", roster: "a|fr", staff: "", logo: "", entry: "invited" } }));
  old.prepare("INSERT INTO kv VALUES (?, ?)").run("kick:manual", JSON.stringify({ "u1-1": { a: 1, b: 2 } }));
  old.prepare("INSERT INTO kv VALUES (?, ?)").run("kick:scores", JSON.stringify({ "u1-1": { a: 1, b: 2, sa: 2, sb: 0 } }));
  old.close();
  db = openDb(path.join(path.dirname(file), "old.db"));
  const k = getKickoff(db);
  assert.equal(k.teams[2].name, "FUT");
  assert.equal(k.teams[2].roster, "a|fr");
  assert.deepEqual(k.scores["u1-1"], { a: 1, b: 2, sa: 2, sb: 0 });
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM kv WHERE key LIKE 'kick:%'").get().n, 0);
  db.close();
});

test("findLogo: tied to the short tag only, never to the name", async () => {
  const { findLogo } = await import("../lib/db.js");
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "logos-"));
  for (const f of ["VIT.png", "vitality.png", "KC.svg", "kc.png", "fut.png"]) fs.writeFileSync(path.join(dir, f), "x");
  assert.equal(findLogo("Team Vitality", dir, "vit"), "/api/logos/VIT.png");
  assert.equal(findLogo("Karmine Corp", dir, "KC"), "/api/logos/kc.png");
  assert.equal(findLogo("FUT Esport", dir, ""), "");
  assert.equal(findLogo("FUT Esport", dir), "");
  assert.equal(findLogo("Team Vitality", dir, "ZZ"), "");
  assert.equal(findLogo("", dir, "VIT"), "");
  assert.equal(findLogo("Team Vitality", "/no/such/dir", "VIT"), "");
});

test("kickoff: the two Playoffs winners fill EU Qualifier 1st and 2nd", async () => {
  const { openDb, getKickoff } = await import("../lib/db.js");
  const { generateBracket, generateSwiss, saveScore, updateTeam } = await import("../lib/actions.js");
  const db = openDb(":memory:");
  assert.equal(getKickoff(db).teams[8].name, "");
  assert.equal(getKickoff(db).teams[8].auto, undefined);
  for (let i = 7; i <= 16; i++) updateTeam(db, `t${String(i).padStart(2, "0")}`, { name: `Team ${i}`, tag: `T${i}`, status: i <= 8 ? "invited" : "qualified", roster: "A|fr" });
  const ord = Object.fromEntries(db.prepare("SELECT id, ord FROM teams").all().map((r) => [r.id, r.ord]));
  const play = (round) => {
    db.prepare("SELECT id, a, b FROM matches WHERE stage = 'swiss' AND round = ? ORDER BY id").all(String(round)).forEach((m, i) => {
      const aw = ord[m.a] < ord[m.b];
      saveScore(db, { id: m.id, sa: aw ? 2 : i % 2, sb: aw ? i % 2 : 2 });
    });
  };
  generateSwiss(db); play(1);
  for (let r = 2; generateSwiss(db).ok; r++) play(r);
  const gb = generateBracket(db);
  assert.equal(gb.ok, true, JSON.stringify(gb));
  for (const g of ["A", "B"]) {
    for (const s of ["s1", "s2"]) {
      const m = db.prepare("SELECT a, b FROM matches WHERE id = ?").get(`e${g}-${s}`);
      saveScore(db, { id: `e${g}-${s}`, sa: m.a < m.b ? 2 : 0, sb: m.a < m.b ? 0 : 2 });
    }
    const f = db.prepare("SELECT a, b FROM matches WHERE id = ?").get(`e${g}-f`);
    saveScore(db, { id: `e${g}-f`, sa: f.a < f.b ? 3 : 0, sb: f.a < f.b ? 0 : 3 });
  }
  const k = getKickoff(db);
  assert.equal(k.teams[8].auto, true);
  assert.equal(k.teams[9].auto, true);
  assert.ok(k.teams[8].name && k.teams[9].name && k.teams[8].name !== k.teams[9].name);
  assert.equal(k.teams[8].source, "EU Qualifier");
  assert.equal(k.teams[8].status, "qualified");
  assert.equal(k.teams[10].auto, undefined);
  // ... and the two teams are really stored in the kteams table.
  const rows = db.prepare("SELECT slot, name, tag, roster FROM kteams WHERE slot IN (9, 10) ORDER BY slot").all();
  assert.equal(rows[0].name, k.teams[8].name);
  assert.equal(rows[1].name, k.teams[9].name);
  assert.equal(rows[0].tag, k.teams[8].tag);
  assert.ok(rows[0].tag && rows[0].roster);
});

test("short tag: up to 7 letters, upper-cased", async () => {
  const { openDb, listTeams } = await import("../lib/db.js");
  const { updateTeam } = await import("../lib/actions.js");
  const { setKickoffTeam } = await import("../lib/kactions.js");
  const { getKickoff } = await import("../lib/db.js");
  const db = openDb(":memory:");
  updateTeam(db, "t07", { name: "Long Tag Team", tag: "abcdefghij", status: "invited", roster: "" });
  assert.equal(listTeams(db).find((t) => t.id === "t07").tag, "ABCDEFG");
  setKickoffTeam(db, { slot: 1, name: "Vit", tag: "vitalit9" });
  assert.equal(getKickoff(db).teams[0].tag, "VITALIT");
});

test("qualifier slot keeps the typed short tag and uses it for the logo", async () => {
  const { openDb, getQualifier } = await import("../lib/db.js");
  const { setQualifierSlot, setQualifierTeams } = await import("../lib/qactions.js");
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "logos-"));
  fs.writeFileSync(path.join(dir, "JBL.png"), "x");
  const db = openDb(":memory:");
  setQualifierSlot(db, { event: "q1", slot: 1, name: "Joblife", tag: "jbl" });
  let s = getQualifier(db, "q1", dir).slots[0];
  assert.equal(s.tag, "JBL");
  assert.equal(s.logo, "/api/logos/JBL.png");
  setQualifierSlot(db, { event: "q1", slot: 2, name: "No Tag" });
  assert.equal(getQualifier(db, "q1", dir).slots[1].tag, "");
  setQualifierTeams(db, "q1", "Joblife ; a|fr\nNo Tag");
  assert.equal(getQualifier(db, "q1", dir).slots[0].tag, "JBL"); // bulk save keeps it
});

test("every tab has its own address (site and editor)", async () => {
  const { parseSitePath, siteHref, parseAdminPath, adminHref, adminHrefForEvent, siteHrefForAdmin } = await import("../lib/paths.js");
  assert.equal(parseSitePath("/"), null); // the home page
  // full addresses: circuit / region / stage / section
  assert.deepEqual(parseSitePath("/vctemea/eu/playoff/overview"), { event: "playoffs", tab: "overview" });
  assert.deepEqual(parseSitePath("/vctemea/eu/playoff/swiss"), { event: "playoffs", tab: "swiss" });
  assert.deepEqual(parseSitePath("/vctemea/eu/qualifier-2/overview"), { event: "q2", tab: "overview" });
  assert.deepEqual(parseSitePath("/vctemea/turkiye/playoff/stats"), { event: "tr", tab: "stats" });
  assert.deepEqual(parseSitePath("/vctemea/turkiye/qualifier-1/overview"), { event: "trq1", tab: "overview" });
  assert.deepEqual(parseSitePath("/vctemea/mena/playoff/stats"), { event: "mena", tab: "stats" });
  assert.deepEqual(parseSitePath("/VCTEMEA/Kickoff/overview"), { event: "kickoff", tab: "overview" });
  assert.deepEqual(parseSitePath("/vctgcemea/overview"), { event: "gc", tab: "overview" });
  assert.equal(siteHref("playoffs"), "/vctemea/eu/playoff/overview");
  assert.equal(siteHref("playoffs", "bracket"), "/vctemea/eu/playoff/bracket");
  assert.equal(siteHref("q1"), "/vctemea/eu/qualifier-1/overview");
  assert.equal(siteHref("trq2"), "/vctemea/turkiye/qualifier-2/overview");
  assert.equal(siteHref("tr", "stats"), "/vctemea/turkiye/playoff/stats");
  assert.equal(siteHref("mena", "stats"), "/vctemea/mena/playoff/stats");
  assert.equal(siteHref("kickoff", "stats"), "/vctemea/kickoff/overview"); // no such section
  assert.equal(siteHref("gc"), "/vctgcemea/overview");
  // short addresses: the page sends them on to the full one
  assert.deepEqual(parseSitePath("/vctemea"), { event: "playoffs", tab: "overview" });
  assert.deepEqual(parseSitePath("/vctemea/turkiye"), { event: "tr", tab: "overview" });
  assert.deepEqual(parseSitePath("/vctemea/eu/playoffs"), { event: "playoffs", tab: "overview" });
  assert.deepEqual(parseSitePath("/vctemea/kickoff"), { event: "kickoff", tab: "overview" });
  // old addresses still lead somewhere
  assert.deepEqual(parseSitePath("/playoffs/swiss"), { event: "playoffs", tab: "swiss" });
  assert.deepEqual(parseSitePath("/turkiye/qualifier-2"), { event: "trq2", tab: "overview" });
  assert.deepEqual(parseSitePath("/gc-emea"), { event: "gc", tab: "overview" });
  assert.deepEqual(parseSitePath("/mena/stats"), { event: "mena", tab: "stats" });
  // unknown
  assert.equal(parseSitePath("/nope"), null);
  assert.equal(parseSitePath("/vctemea/kickoff/swiss"), null);
  assert.equal(parseSitePath("/vctemea/eu/qualifier-1/stats"), null);
  assert.equal(parseSitePath("/vctemea/mena/qualifier-1/overview"), null);
  assert.equal(parseSitePath("/vctemea/eu/playoff/overview/x"), null);
  assert.equal(parseSitePath("/vctgcemea/swiss"), null);
  for (const [ev, tb] of [["playoffs", "overview"], ["playoffs", "swiss"], ["playoffs", "bracket"], ["playoffs", "stats"], ["q1", "overview"], ["q2", "overview"], ["mena", "overview"], ["mena", "stats"], ["tr", "overview"], ["tr", "stats"], ["trq1", "overview"], ["trq2", "overview"], ["kickoff", "overview"], ["gc", "overview"]]) {
    assert.deepEqual(parseSitePath(siteHref(ev, tb)), { event: ev, tab: tb });
  }
  // editor
  const D = { region: "eu", top: "q1", sub: "teams", kview: "teams" };
  assert.deepEqual(parseAdminPath("/admin"), { ...D, home: true }); // the editor's home page
  assert.equal(adminHref({ ...D, home: true }), "/admin");
  assert.equal(siteHrefForAdmin({ ...D, home: true }), "/");
  assert.equal(adminHref(D), "/admin/vctemea/eu/qualifier-1");
  assert.equal(adminHref({ ...D, top: "playoffs", sub: "matches" }), "/admin/vctemea/eu/playoff/matches");
  assert.equal(adminHref({ ...D, region: "tr", ttop: "trq1" }), "/admin/vctemea/turkiye/qualifier-1");
  assert.equal(adminHref({ ...D, region: "eu", top: "q2", ttop: "trq1" }), "/admin/vctemea/eu/qualifier-2");
  assert.equal(adminHref({ ...D, region: "tr", kview: "matches" }), "/admin/vctemea/turkiye/playoff/matches");
  assert.equal(adminHref({ ...D, region: "mena" }), "/admin/vctemea/mena/playoff/teams");
  assert.equal(adminHref({ ...D, region: "kickoff", kview: "matches" }), "/admin/vctemea/kickoff/matches");
  assert.equal(adminHref({ ...D, region: "gc" }), "/admin/vctgcemea/teams");
  assert.equal(parseAdminPath("/admin/vctgcemea/matches").kview, "matches");
  assert.deepEqual(parseSitePath("/vctgcemea/stats"), { event: "gc", tab: "stats" });
  assert.equal(parseAdminPath("/admin/vctemea/turkiye/qualifier-2").ttop, "trq2");
  assert.equal(parseAdminPath("/admin/vctemea/eu/playoff").sub, "teams");
  assert.equal(parseAdminPath("/admin/vctemea/eu/playoff/zzz"), null);
  assert.equal(parseAdminPath("/admin/vctemea/eu/qualifier-1/teams"), null);
  assert.equal(parseAdminPath("/admin/zzz"), null);
  // old editor addresses
  assert.equal(parseAdminPath("/admin/playoffs/matches").sub, "matches");
  assert.equal(parseAdminPath("/admin/kickoff/matches").kview, "matches");
  assert.equal(parseAdminPath("/admin/turkiye/qualifier-2").ttop, "trq2");
  assert.equal(parseAdminPath("/admin/gc-emea").region, "gc");
  for (const st of [D, { ...D, top: "q2" }, { ...D, top: "playoffs", sub: "tournament" }, { ...D, region: "kickoff", kview: "matches" }, { ...D, region: "tr" }, { ...D, region: "tr", ttop: "trq2" }, { ...D, region: "mena", kview: "matches" }, { ...D, region: "gc" }]) {
    assert.deepEqual(parseAdminPath(adminHref(st)), st);
  }
  // site <-> editor on the same event
  assert.equal(adminHrefForEvent("trq2"), "/admin/vctemea/turkiye/qualifier-2");
  assert.equal(adminHrefForEvent("playoffs"), "/admin/vctemea/eu/playoff/teams");
  assert.equal(siteHrefForAdmin({ ...D, region: "kickoff" }), "/vctemea/kickoff/overview");
  assert.equal(siteHrefForAdmin({ ...D, top: "playoffs" }), "/vctemea/eu/playoff/overview");
  for (const ev of ["playoffs", "q1", "q2", "tr", "trq1", "trq2", "mena", "kickoff", "gc"]) {
    assert.equal(siteHrefForAdmin(parseAdminPath(adminHrefForEvent(ev))), siteHref(ev));
  }
});

test("regional playoffs (Türkiye): GSL groups feed a double-elimination bracket, places 1-8", async () => {
  const { buildRegional, regPlaces, groupStats, isOpening, regIds, regBo } = await import("../lib/regional.js");
  assert.equal(regIds("tr").length, 16);
  assert.ok(isOpening("ga-o1", "tr") && isOpening("gb-o2", "tr") && !isOpening("ga-w", "tr") && !isOpening("ub1", "tr") && !isOpening("zz", "tr"));
  assert.equal(regBo("gf", "tr"), 5);
  assert.equal(regBo("ub1", "tr"), 3);
  // Group A: 1v2, 3v4; Group B: 5v6, 7v8. The lower team number always wins 2-0, except where noted.
  const manual = { "ga-o1": { a: 1, b: 2 }, "ga-o2": { a: 3, b: 4 }, "gb-o1": { a: 5, b: 6 }, "gb-o2": { a: 7, b: 8 } };
  const scores = {};
  const play = (id, sa, sb) => {
    const m = buildRegional(manual, scores).byId[id];
    assert.ok(m.a && m.b, `${id} has both teams`);
    scores[id] = { a: m.a, b: m.b, sa, sb };
  };
  for (const g of ["ga", "gb"]) for (const k of ["o1", "o2", "w", "e", "d"]) play(`${g}-${k}`, 2, 0);
  let b = buildRegional(manual, scores);
  // A: o1 1>2, o2 3>4, w 1>3, e 2>4, d 3>2  ->  1, 3, 2, 4
  assert.deepEqual(b.groups.ga, [1, 3, 2, 4]);
  assert.deepEqual(b.groups.gb, [5, 7, 6, 8]);
  assert.deepEqual(groupStats(b, "ga")[1], { w: 2, l: 0, mw: 4, ml: 0 });
  assert.deepEqual(groupStats(b, "ga")[2], { w: 1, l: 2, mw: 2, ml: 4 });
  // Playoffs seeds: A1 v B2, B1 v A2
  assert.deepEqual([b.byId.ub1.a, b.byId.ub1.b, b.byId.ub2.a, b.byId.ub2.b], [1, 7, 5, 3]);
  play("ub1", 2, 1); // 1 > 7
  play("ub2", 0, 2); // 3 > 5
  play("ubf", 2, 0); // 1 > 3
  play("lbs", 2, 0); // 7 > 5
  play("lbf", 1, 2); // ubf loser 3 v 7 -> 7
  play("gf", 3, 2); // 1 v 7, Bo5 -> 1
  b = buildRegional(manual, scores);
  assert.deepEqual(regPlaces(b), [1, 7, 3, 5, 2, 6, 4, 8]);
  // a Bo3 score is refused in the Bo5 final, and changing an opening match drops what depended on it
  assert.equal(buildRegional(manual, { ...scores, gf: { a: 1, b: 7, sa: 2, sb: 0 } }).byId.gf.winner, null);
  const moved = buildRegional({ ...manual, "ga-o1": { a: 2, b: 1 } }, scores);
  assert.equal(moved.byId["ga-o1"].winner, null);
  assert.equal(moved.byId.gf.a, null);
});

test("regional playoffs storage: default teams, opening matches, scores, stale scores dropped, winner sent to the Kickoff", async () => {
  const { openDb, getState } = await import("../lib/db.js");
  const { setRegionalTeam, setRegionalMatch, saveRegionalScore, resetRegional } = await import("../lib/ractions.js");
  const db = openDb(":memory:");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-"));
  let s = getState(db, dir);
  assert.deepEqual(s.regional.tr.teams.map((t) => t.name).slice(0, 4), ["Eternal Fire", "PCIFIC Esports", "Fire Flux Esports", "Beşiktaş Esports"]);
  assert.deepEqual(s.regional.tr.teams.slice(4).map((t) => [t.status, t.source, t.pos]), [["qualified", "Qualifier 1", 1], ["qualified", "Qualifier 1", 2], ["qualified", "Qualifier 2", 1], ["qualified", "Qualifier 2", 2]]);
  for (let i = 5; i <= 8; i++) assert.equal(setRegionalTeam(db, { event: "tr", slot: i, name: `Q${i}`, tag: `q${i}`, roster: "", staff: "" }).ok, true);
  assert.equal(setRegionalTeam(db, { event: "zz", slot: 1, name: "X" }).ok, false);
  assert.equal(setRegionalTeam(db, { event: "tr", slot: 9, name: "X" }).ok, false);
  assert.equal(setRegionalMatch(db, { event: "tr", id: "ga-w", a: 1, b: 2 }).ok, false); // fed, not set by hand
  assert.equal(setRegionalMatch(db, { event: "tr", id: "ga-o1", a: 1, b: 1 }).ok, false);
  const open = { "ga-o1": [1, 2], "ga-o2": [3, 4], "gb-o1": [5, 6], "gb-o2": [7, 8] };
  for (const [id, [a, b]] of Object.entries(open)) assert.equal(setRegionalMatch(db, { event: "tr", id, a, b }).ok, true);
  assert.equal(saveRegionalScore(db, { event: "tr", id: "ga-w", sa: 2, sb: 0 }).ok, false); // teams not known yet
  for (const g of ["ga", "gb"]) for (const k of ["o1", "o2", "w", "e", "d"]) assert.equal(saveRegionalScore(db, { event: "tr", id: `${g}-${k}`, sa: 2, sb: 0 }).ok, true);
  for (const id of ["ub1", "ub2", "ubf", "lbs", "lbf"]) assert.equal(saveRegionalScore(db, { event: "tr", id, sa: 2, sb: 1 }).ok, true);
  assert.equal(saveRegionalScore(db, { event: "tr", id: "gf", sa: 2, sb: 0 }).ok, false); // the final is Bo5
  assert.equal(saveRegionalScore(db, { event: "tr", id: "gf", sa: 3, sb: 0 }).ok, true);
  s = getState(db, dir);
  // the Türkiye winner (Eternal Fire, slot 1) takes the Kickoff "TR Qualifier" place
  const kslot = s.kickoff.teams.find((t) => t.source === "TR Qualifier");
  assert.equal(kslot.name, "Eternal Fire");
  assert.equal(kslot.auto, true);
  // changing an opening match drops the scores that depended on it
  assert.equal(setRegionalMatch(db, { event: "tr", id: "ga-o1", a: 2, b: 1 }).ok, true);
  s = getState(db, dir);
  assert.equal(s.regional.tr.scores["ga-o1"], undefined);
  assert.equal(s.regional.tr.scores.gf, undefined);
  assert.ok(s.regional.tr.scores["gb-o1"]); // the other group is untouched
  assert.equal(s.kickoff.teams.find((t) => t.source === "TR Qualifier").name, "");
  assert.equal(resetRegional(db, { event: "tr" }).ok, true);
  assert.deepEqual(getState(db, dir).regional.tr.scores, {});
  // with no Türkiye winner, a team typed by hand in that Kickoff place stays (read twice: nothing clears it)
  const { setKickoffTeam } = await import("../lib/kactions.js");
  const k = getState(db, dir).kickoff.teams.findIndex((t) => t.source === "TR Qualifier");
  assert.equal(setKickoffTeam(db, { slot: k + 1, name: "Typed By Hand", roster: "", staff: "" }).ok, true);
  assert.equal(getState(db, dir).kickoff.teams[k].name, "Typed By Hand");
  assert.equal(getState(db, dir).kickoff.teams[k].name, "Typed By Hand");
});

test("Türkiye Qualifier 1 / 2: own brackets, their top 2 fill the Qualifier Playoffs places by themselves", async () => {
  const { openDb, getState, getQualifier } = await import("../lib/db.js");
  const { setQualifierTeams, saveQualifierScore } = await import("../lib/qactions.js");
  const { setRegionalTeam } = await import("../lib/ractions.js");
  const { buildBracket } = await import("../lib/bracket.js");
  const db = openDb(":memory:");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "trq-"));
  // a full bracket of 64 (only first-round gaps are byes); the team listed first in each match wins it,
  // so T1 wins, T33 (best of the other half) is 2nd, T17 beats T49 in the Third Place Match
  const lines = (first) => [first, ...Array.from({ length: 63 }, (_, i) => `T${i + 2}`)].join("\n");
  assert.equal(setQualifierTeams(db, "trq1", lines("T1 ; a|tr")).ok, true);
  assert.equal(getState(db, dir).qualifiers.q1.slots.filter(Boolean).length, 0); // the EU qualifier is untouched
  const playAll = () => {
    for (let guard = 0; guard < 80; guard++) {
      const q = getQualifier(db, "trq1");
      const m = buildBracket(q.slots, q.scores, q.bo).matches.find((x) => x.a && x.b && !x.bye && x.winner == null);
      if (!m) return;
      const need = m.bo === 1 ? 1 : m.bo === 3 ? 2 : 3;
      assert.equal(saveQualifierScore(db, { event: "trq1", id: m.id, sa: need, sb: 0 }).ok, true);
    }
  };
  playAll();
  let t = getState(db, dir).regional.tr.teams;
  const q1 = (pos) => t.find((x) => x.source === "Qualifier 1" && x.pos === pos);
  assert.equal(q1(1).name, "T1");
  assert.equal(q1(1).roster, "a|tr");
  assert.equal(q1(1).auto, true);
  assert.equal(q1(2).name, "T33");
  assert.equal(t.find((x) => x.source === "Qualifier 2" && x.pos === 1).name, ""); // Qualifier 2 not played
  // results belong to bracket positions: a team renamed or swapped in a position takes that position's place
  assert.equal(setQualifierTeams(db, "trq1", lines("T1 ; a|tr").replace("T1 ; a|tr\nT2", "T2\nT1 ; a|tr")).ok, true);
  assert.equal(getState(db, dir).regional.tr.teams.find((x) => x.source === "Qualifier 1" && x.pos === 1).name, "T2");
  // the results taken back: the places empty again
  const { resetQualifier } = await import("../lib/qactions.js");
  assert.equal(resetQualifier(db, "trq1").ok, true);
  t = getState(db, dir).regional.tr.teams;
  assert.equal(q1(1).name, "");
  assert.equal(q1(1).auto, undefined);
  // with no result, a team typed by hand in a qualified place stays
  const slot = q1(2).slot;
  assert.equal(setRegionalTeam(db, { event: "tr", slot, name: "Typed", roster: "", staff: "" }).ok, true);
  assert.equal(getState(db, dir).regional.tr.teams[slot - 1].name, "Typed");
  assert.equal(getState(db, dir).regional.tr.teams[slot - 1].name, "Typed");
});

test("MENA Qualifier Playoffs: 4 qualified teams, North Africa and Middle East semifinals, all Bo5, winner to the Kickoff", async () => {
  const { buildRegional, regPlaces, regIds, regSlots, isOpening } = await import("../lib/regional.js");
  const { openDb, getState } = await import("../lib/db.js");
  const { setRegionalTeam, setRegionalMatch, saveRegionalScore } = await import("../lib/ractions.js");
  assert.equal(regSlots("mena"), 4);
  assert.deepEqual(regIds("mena"), ["sf1", "sf2", "gf"]);
  assert.deepEqual(regIds("mena").filter((id) => isOpening(id, "mena")), ["sf1", "sf2"]); // the semifinals are drawn by hand
  const draw = { sf1: { a: 3, b: 4 }, sf2: { a: 1, b: 2 } }; // NA #1 v #2, ME #1 v #2
  let b = buildRegional(draw, {}, "mena");
  assert.deepEqual([b.byId.sf1.a, b.byId.sf1.b, b.byId.sf2.a, b.byId.sf2.b], [3, 4, 1, 2]);
  assert.ok(Object.values(b.byId).every((m) => m.bo === 5));
  b = buildRegional(draw, { sf1: { a: 3, b: 4, sa: 1, sb: 3 }, sf2: { a: 1, b: 2, sa: 3, sb: 2 }, gf: { a: 4, b: 1, sa: 3, sb: 0 } }, "mena");
  assert.deepEqual(regPlaces(b), [4, 1, 3, 2]);
  // stored: default places, scores, the winner sent to the Kickoff "MENA Qualifier" place; Türkiye untouched
  const db = openDb(":memory:");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mena-"));
  let s = getState(db, dir);
  assert.deepEqual(s.regional.mena.teams.map((t) => [t.source, t.status, t.name]), [["ME Qualifier 1", "qualified", ""], ["ME Qualifier 2", "qualified", ""], ["NA Qualifier 1", "qualified", ""], ["NA Qualifier 2", "qualified", ""]]);
  for (const [slot, name] of [[1, "ME One"], [2, "ME Two"], [3, "NA One"], [4, "NA Two"]]) assert.equal(setRegionalTeam(db, { event: "mena", slot, name, roster: "", staff: "" }).ok, true);
  assert.equal(setRegionalTeam(db, { event: "mena", slot: 5, name: "X" }).ok, false);
  assert.equal(setRegionalMatch(db, { event: "mena", id: "gf", a: 1, b: 2 }).ok, false); // the final is fed
  assert.equal(saveRegionalScore(db, { event: "mena", id: "sf1", sa: 3, sb: 1 }).ok, false); // no teams drawn yet
  assert.equal(setRegionalMatch(db, { event: "mena", id: "sf1", a: 3, b: 4 }).ok, true);
  assert.equal(setRegionalMatch(db, { event: "mena", id: "sf2", a: 1, b: 3 }).ok, false); // NA #1 already plays sf1
  assert.equal(setRegionalMatch(db, { event: "mena", id: "sf2", a: 1, b: 2 }).ok, true);
  assert.equal(saveRegionalScore(db, { event: "mena", id: "sf1", sa: 2, sb: 0 }).ok, false); // Bo5
  assert.equal(saveRegionalScore(db, { event: "mena", id: "sf1", sa: 3, sb: 1 }).ok, true);
  assert.equal(saveRegionalScore(db, { event: "mena", id: "sf2", sa: 3, sb: 1 }).ok, true);
  assert.equal(saveRegionalScore(db, { event: "mena", id: "gf", sa: 0, sb: 3 }).ok, true);
  s = getState(db, dir);
  assert.equal(s.kickoff.teams.find((t) => t.source === "MENA Qualifier").name, "ME One");
  assert.deepEqual(s.regional.tr.scores, {});
  assert.equal(saveRegionalScore(db, { event: "tr", id: "sf1", sa: 3, sb: 1 }).ok, false); // not a Türkiye match
});

test("a team is placed in one match only: Türkiye opening matches, and once per Kickoff bracket", async () => {
  const { openDb, getKickoff } = await import("../lib/db.js");
  const { setRegionalMatch } = await import("../lib/ractions.js");
  const { setKickoffMatch } = await import("../lib/kactions.js");
  const { placedElsewhere } = await import("../lib/regional.js");
  const { kickPlacedElsewhere } = await import("../lib/kickoff.js");
  const db = openDb(":memory:");
  assert.equal(setRegionalMatch(db, { event: "tr", id: "ga-o1", a: 1, b: 2 }).ok, true);
  const r = setRegionalMatch(db, { event: "tr", id: "gb-o1", a: 2, b: 5 }); // team 2 already in Group A
  assert.equal(r.ok, false);
  assert.equal(r.error, "This team is already placed in another match.");
  assert.equal(setRegionalMatch(db, { event: "tr", id: "ga-o1", a: 2, b: 1 }).ok, true); // swapping inside its own match is fine
  assert.equal(setRegionalMatch(db, { event: "tr", id: "ga-o1", a: 3, b: 1 }).ok, true); // 2 freed...
  assert.equal(setRegionalMatch(db, { event: "tr", id: "gb-o1", a: 2, b: 5 }).ok, true); // ...and placed elsewhere
  assert.deepEqual([...placedElsewhere({ "ga-o1": { a: 3, b: 1 }, "gb-o1": { a: 2, b: 5 } }, "tr", "ga-o2")].sort(), [1, 2, 3, 5]);
  // Kickoff: a team is placed once (Round 1 or a seed); the mid and lower brackets fill themselves
  assert.equal(setKickoffMatch(db, { id: "u1-1", a: 1, b: 2 }).ok, true);
  assert.equal(setKickoffMatch(db, { id: "u1-2", a: 1, b: 3 }).ok, false); // twice in Round 1
  assert.equal(setKickoffMatch(db, { id: "u2-1", a: 2, b: null }).ok, false); // a seed already in Round 1
  assert.equal(setKickoffMatch(db, { id: "m1-1", a: 5, b: 4 }).error, "This match fills itself from earlier results.");
  assert.equal(setKickoffMatch(db, { id: "u2-1", a: 9, b: 4 }).ok, true); // side b is fed: only the seed is kept
  assert.deepEqual(getKickoff(db).manual["u2-1"], { a: 9, b: null });
  assert.deepEqual([...kickPlacedElsewhere(getKickoff(db).manual, "u1-3")].sort((x, y) => x - y), [1, 2, 9]);
});

test("EU Playoffs drawn by hand: Swiss matches by record (1-0, 0-1...), once per round; bracket semifinals from the 8 qualified", async () => {
  const { setSwissMatch, setBracketMatch } = await import("../lib/actions.js");
  const { swissDraw, bracketDraw } = await import("../lib/tournament.js");
  const db = freshDb();
  const ids = getState(db).teams.map((t) => t.id); // t01..t16
  // round 1: all 16 teams are 0-0, any pairing; a team once
  assert.equal(setSwissMatch(db, { id: "s1-m01", a: ids[0], b: ids[15] }).ok, true);
  let r = setSwissMatch(db, { id: "s1-m02", a: ids[0], b: ids[1] });
  assert.equal(r.ok, false);
  assert.equal(r.error, "This team already plays in this round.");
  assert.equal(setSwissMatch(db, { id: "s1-m02", a: ids[1], b: ids[1] }).ok, false);
  assert.equal(setSwissMatch(db, { id: "s1-m09", a: ids[1], b: ids[2] }).ok, false); // round 1 has 8 matches
  // round 2 cannot be drawn before round 1 is complete
  assert.equal(setSwissMatch(db, { id: "s2-m01", a: ids[0], b: ids[1] }).error, "Finish round 1 first.");
  for (let i = 1; i < 8; i++) assert.equal(setSwissMatch(db, { id: `s1-m0${i + 1}`, a: ids[i], b: ids[15 - i] }).ok, true);
  assert.equal(generateSwiss(db).ok, false); // round 1 not played yet
  playRound(db, 1); // the lower seed wins: t01..t08 are 1-0, t09..t16 are 0-1
  let d = swissDraw(getState(db).teams, getState(db).matches, 2);
  assert.ok(d.editable);
  assert.deepEqual(d.slots.map((s) => s.key), ["1-0", "1-0", "1-0", "1-0", "0-1", "0-1", "0-1", "0-1"]);
  assert.deepEqual(d.pools["1-0"], ids.slice(0, 8));
  // the 1-0 bracket only takes 1-0 teams
  r = setSwissMatch(db, { id: "s2-m01", a: ids[0], b: ids[9] });
  assert.equal(r.ok, false);
  assert.equal(r.error, "This team does not have a 1-0 record.");
  assert.equal(setSwissMatch(db, { id: "s2-m05", a: ids[8], b: ids[9] }).ok, true);
  assert.equal(setSwissMatch(db, { id: "s2-m01", a: ids[0], b: ids[1] }).ok, true);
  // the auto generator refuses a round that is only partly drawn
  assert.equal(generateSwiss(db).ok, false);
  // changing a drawn match clears its score; both sides empty removes it
  assert.equal(saveScore(db, { id: "s2-m01", sa: 2, sb: 0 }).ok, true);
  assert.equal(setSwissMatch(db, { id: "s2-m01", a: ids[0], b: ids[2] }).ok, true);
  assert.equal(getState(db).matches.find((m) => m.id === "s2-m01").sa, null);
  assert.equal(setSwissMatch(db, { id: "s2-m01", a: "", b: "" }).ok, true);
  assert.equal(getState(db).matches.some((m) => m.id === "s2-m01"), false);
  // round 1 is locked once round 2 exists
  assert.equal(setSwissMatch(db, { id: "s1-m01", a: ids[0], b: ids[14] }).error, "Round 2 already exists.");
  // the rest of the Swiss by the generator, then the bracket by hand
  assert.equal(setSwissMatch(db, { id: "s2-m05", a: "", b: "" }).ok, true);
  for (let round = 2; round <= 5; round++) {
    const g = generateSwiss(db);
    assert.equal(g.ok, true, g.error);
    playRound(db, round);
  }
  const bd = bracketDraw(getState(db).teams, getState(db).matches);
  assert.ok(bd.editable);
  assert.equal(bd.adv.length, 8);
  const out = getState(db).teams.find((t) => !bd.adv.includes(t.id)).id;
  assert.equal(setBracketMatch(db, { id: "eA-s1", a: bd.adv[0], b: out }).ok, false); // not qualified
  assert.equal(setBracketMatch(db, { id: "eA-s1", a: bd.adv[0], b: bd.adv[7] }).ok, true);
  assert.equal(setBracketMatch(db, { id: "eB-s2", a: bd.adv[7], b: bd.adv[1] }).error, "This team is already placed in another semifinal.");
  assert.equal(setBracketMatch(db, { id: "eA-s2", a: bd.adv[3], b: bd.adv[4] }).ok, true);
  assert.equal(setSwissMatch(db, { id: "s5-m01", a: "", b: "" }).error, "The bracket already exists.");
  // the semifinal result feeds the group final; redrawing it empties that side again
  assert.equal(saveScore(db, { id: "eA-s1", sa: 2, sb: 0 }).ok, true);
  assert.equal(getState(db).matches.find((m) => m.id === "eA-f").a, bd.adv[0]);
  assert.equal(setBracketMatch(db, { id: "eA-s1", a: bd.adv[7], b: bd.adv[0] }).ok, true);
  assert.equal(getState(db).matches.find((m) => m.id === "eA-f").a, "");
  assert.equal(getState(db).matches.find((m) => m.id === "eA-s1").sa, null);
});

test("Kickoff: losers drop by themselves through the Mid and Lower Brackets, a full bracket played", async () => {
  const { buildKickoff, kickPlaces } = await import("../lib/kickoff.js");
  // twelve teams A-L; placed by hand: Round 1 and the four UB Quarterfinal seeds
  const T = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9, J: 10, K: 11, L: 12 };
  const manual = {
    "u1-1": { a: T.A, b: T.B }, "u1-2": { a: T.C, b: T.D }, "u1-3": { a: T.E, b: T.F }, "u1-4": { a: T.G, b: T.H },
    "u2-1": { a: T.I }, "u2-2": { a: T.J }, "u2-3": { a: T.K }, "u2-4": { a: T.L },
  };
  const scores = {};
  // every result: [match, maps a, maps b]
  const results = [
    ["u1-1", 2, 0], ["u1-2", 0, 2], ["u1-3", 1, 2], ["u1-4", 0, 2],
    ["u2-1", 1, 2], ["u2-2", 0, 2], ["u2-3", 0, 2], ["u2-4", 1, 2],
    ["u3-1", 0, 2], ["u3-2", 2, 0], ["u4", 2, 3],
    ["m1-1", 2, 1], ["m1-2", 2, 1], ["m1-3", 2, 1], ["m1-4", 2, 0],
    ["m2-1", 0, 2], ["m2-2", 2, 0], ["m3-1", 1, 2], ["m3-2", 2, 0], ["m4", 2, 0], ["m5", 3, 2],
    ["l1-1", 2, 1], ["l1-2", 0, 2], ["l2-1", 2, 1], ["l2-2", 2, 1], ["l3-1", 0, 2], ["l3-2", 1, 2],
    ["l4", 0, 2], ["l5", 1, 2], ["l6", 0, 3],
  ];
  const teamsOf = (id) => { const m = buildKickoff(manual, scores).byId[id]; return [m.a, m.b]; };
  for (const [id, sa, sb] of results) {
    const [a, b] = teamsOf(id);
    assert.ok(a && b, `${id} has both teams`);
    scores[id] = { a, b, sa, sb };
  }
  const b = buildKickoff(manual, scores);
  const pair = (id) => [b.byId[id].a, b.byId[id].b];
  // Mid Bracket Round 1: UB Quarterfinal losers (reversed) against UB Round 1 losers
  assert.deepEqual(pair("m1-1"), [T.L, T.B]);
  assert.deepEqual(pair("m1-2"), [T.K, T.C]);
  assert.deepEqual(pair("m1-3"), [T.J, T.E]);
  assert.deepEqual(pair("m1-4"), [T.I, T.G]);
  assert.deepEqual(pair("m3-1"), [T.A, T.K]); // UB Semifinal losers drop to the Mid Quarterfinals
  assert.deepEqual(pair("m3-2"), [T.H, T.J]);
  assert.deepEqual(pair("m5"), [T.D, T.K]); // UB Final loser to the Mid Final
  assert.deepEqual(pair("l1-1"), [T.B, T.C]); // Mid Round 1 losers
  assert.deepEqual(pair("l1-2"), [T.E, T.G]);
  assert.deepEqual(pair("l2-1"), [T.I, T.B]); // Mid Round 2 losers, crossed
  assert.deepEqual(pair("l2-2"), [T.L, T.G]);
  assert.deepEqual(pair("l3-1"), [T.A, T.I]); // Mid Quarterfinal losers
  assert.deepEqual(pair("l3-2"), [T.J, T.L]);
  assert.deepEqual(pair("l5"), [T.H, T.L]); // Mid Semifinal loser
  assert.deepEqual(pair("l6"), [T.K, T.L]); // Mid Final loser
  // the three bracket winners qualify; the Lower Bracket Final loser is 4th
  // then each team by the Lower Bracket round it went out in: 5 Semifinal, 6 Quarterfinal, 7-8 Round 3, 9-10 Round 2, 11-12 Round 1
  assert.deepEqual(kickPlaces(b), [T.F, T.D, T.L, T.K, T.H, T.I, T.A, T.J, T.B, T.G, T.C, T.E]);
});

test("event information: defaults, saved by event, dates checked, shown in the state and in dates text", async () => {
  const { setEventInfo } = await import("../lib/db.js");
  const { formatDates } = await import("../lib/status.js");
  const db = openDb(":memory:");
  const { info } = getState(db);
  assert.equal(info.playoffs.start, "2026-11-25");
  assert.equal(info.kickoff.venue, "Riot Games Arena");
  assert.equal(info.q1.start, "");
  const base = { type: "online", location: "Europe", venue: "", tier: "A-Tier" };
  assert.equal(setEventInfo(db, { event: "q1", start: "2026-10-01", end: "2026-10-12", ...base }).ok, true);
  assert.deepEqual(getState(db).info.q1, { start: "2026-10-01", end: "2026-10-12", ...base, stream: "" });
  assert.equal(setEventInfo(db, { event: "kickoff", start: "2027-01", end: "2027-02-15", ...base, type: "offline" }).ok, true); // month only
  assert.equal(setEventInfo(db, { event: "q1", start: "2026-10-12", end: "2026-10-01", ...base }).ok, false); // end before start
  assert.equal(setEventInfo(db, { event: "q1", start: "2026-02-30", end: "", ...base }).ok, false); // no such day
  assert.equal(setEventInfo(db, { event: "q1", start: "01/10/2026", end: "", ...base }).ok, false);
  assert.equal(setEventInfo(db, { event: "q1", start: "", end: "", ...base, type: "lan" }).ok, false);
  assert.equal(setEventInfo(db, { event: "q1", start: "", end: "", ...base, tier: "Z" }).ok, false);
  assert.equal(setEventInfo(db, { event: "nope", start: "", end: "", ...base }).ok, false);
  assert.equal(getState(db).info.q1.start, "2026-10-01"); // refused saves changed nothing
  assert.equal(formatDates({ start: "2026-11-25", end: "2026-11-29" }, "en"), "25 – 29 Nov 2026");
  assert.equal(formatDates({ start: "2026-11-21", end: "2026-12-06" }, "fr"), "21 nov. – 6 déc. 2026");
  assert.equal(formatDates({ start: "", end: "" }, "fr"), "");
  assert.equal(serverFr("The end date is before the start date."), "La date de fin est avant la date de début.");
});

test("event information: a table from the first version (columns start / end) is renamed, its rows kept", async () => {
  const { fillEventInfo } = await import("../lib/db.js");
  const db = openDb(":memory:");
  db.exec(`DROP TABLE einfo; CREATE TABLE einfo (event TEXT PRIMARY KEY, start TEXT NOT NULL DEFAULT '', "end" TEXT NOT NULL DEFAULT '', type TEXT NOT NULL DEFAULT 'online', location TEXT NOT NULL DEFAULT '', venue TEXT NOT NULL DEFAULT '', tier TEXT NOT NULL DEFAULT '');
    INSERT INTO einfo (event, start, "end", type, location, venue, tier) VALUES ('q1', '2026-09-01', '2026-09-05', 'online', 'Europe', '', 'A-Tier');`);
  fillEventInfo(db);
  const { info } = getState(db);
  assert.equal(info.q1.start, "2026-09-01");
  assert.equal(info.playoffs.start, "2026-11-25"); // missing rows added
});

test("event state follows the dates: upcoming before the start, live in between, finished after the end", async () => {
  const { stateFor } = await import("../lib/status.js");
  const info = { start: "2026-11-25", end: "2026-12-05" };
  assert.equal(stateFor("upcoming", info, "2026-11-03"), "upcoming");
  assert.equal(stateFor("live", info, "2026-11-03"), "upcoming"); // scores typed early do not start it
  assert.equal(stateFor("done", info, "2026-11-03"), "upcoming");
  assert.equal(stateFor("upcoming", info, "2026-11-25"), "live");
  assert.equal(stateFor("upcoming", info, "2026-12-05"), "live");
  assert.equal(stateFor("done", info, "2026-12-01"), "done"); // winner known before the last day
  assert.equal(stateFor("upcoming", info, "2026-12-06"), "done");
  // month only
  const month = { start: "2027-01", end: "2027-02" };
  assert.equal(stateFor("upcoming", month, "2026-12-31"), "upcoming");
  assert.equal(stateFor("upcoming", month, "2027-01-01"), "live");
  assert.equal(stateFor("upcoming", month, "2027-02-28"), "live");
  assert.equal(stateFor("upcoming", month, "2027-03-01"), "done");
  // no dates: the results tell
  assert.equal(stateFor("live", { start: "", end: "" }, "2026-11-03"), "live");
  assert.equal(stateFor("upcoming", { start: "", end: "" }, "2026-11-03"), "upcoming");
  // only a start date: live once started
  assert.equal(stateFor("upcoming", { start: "2026-10-01", end: "" }, "2026-11-03"), "live");
});

test("match times: set per event and match, stored in UTC, checked, cleared", async () => {
  const { setMatchTime } = await import("../lib/db.js");
  const db = openDb(":memory:");
  assert.deepEqual(getState(db).times.kickoff, {});
  assert.equal(setMatchTime(db, { event: "kickoff", id: "u1-1", at: "2027-01-15T18:00+01:00" }).ok, true);
  assert.equal(getState(db).times.kickoff["u1-1"], "2027-01-15T17:00:00.000Z");
  assert.equal(setMatchTime(db, { event: "playoffs", id: "s1-m03", at: "2026-11-25T16:00:00.000Z" }).ok, true); // before the match is drawn
  assert.equal(setMatchTime(db, { event: "playoffs", id: "eB-f", at: "2026-12-05T16:00:00Z" }).ok, true);
  assert.equal(setMatchTime(db, { event: "q1", id: "r64-32", at: "2026-10-28T16:00:00Z" }).ok, true);
  assert.equal(setMatchTime(db, { event: "q1", id: "third-1", at: "2026-11-01T16:00:00Z" }).ok, true);
  assert.equal(setMatchTime(db, { event: "tr", id: "ga-o1", at: "2026-11-25T16:00:00Z" }).ok, true);
  assert.equal(setMatchTime(db, { event: "mena", id: "sf1", at: "2026-11-21T16:00:00Z" }).ok, true);
  assert.equal(setMatchTime(db, { event: "mena", id: "ga-o1", at: "2026-11-21T16:00:00Z" }).ok, false); // not a MENA match
  assert.equal(setMatchTime(db, { event: "q1", id: "r64-33", at: "2026-10-28T16:00:00Z" }).ok, false);
  assert.equal(setMatchTime(db, { event: "gc", id: "x", at: "2026-10-28T16:00:00Z" }).ok, false);
  assert.equal(setMatchTime(db, { event: "kickoff", id: "u1-1", at: "demain" }).ok, false);
  assert.equal(setMatchTime(db, { event: "kickoff", id: "u1-1", at: "2027-01-15T18:00" }).ok, false); // no time zone
  assert.equal(getState(db).times.kickoff["u1-1"], "2027-01-15T17:00:00.000Z");
  assert.equal(setMatchTime(db, { event: "kickoff", id: "u1-1", at: "" }).ok, true); // cleared
  assert.equal(getState(db).times.kickoff["u1-1"], undefined);
  assert.equal(Object.keys(getState(db).times.q1).length, 2);
});

test("live matches and the flat match list of every event", async () => {
  const { setMatchLive } = await import("../lib/db.js");
  const { matchesOf, eventData } = await import("../lib/matchlist.js");
  const db = openDb(":memory:");
  assert.equal(setMatchLive(db, { event: "kickoff", id: "u1-1", live: true }).ok, true);
  assert.equal(setMatchLive(db, { event: "kickoff", id: "u1-1", live: true }).ok, true); // twice: still one
  assert.deepEqual(getState(db).live.kickoff, { "u1-1": { a: 0, b: 0 } });
  assert.equal(setMatchLive(db, { event: "kickoff", id: "u1-1", live: true, a: 1, b: 0 }).ok, true); // score in progress
  assert.deepEqual(getState(db).live.kickoff, { "u1-1": { a: 1, b: 0 } });
  assert.equal(setMatchLive(db, { event: "kickoff", id: "u1-1", live: true, a: -1, b: 0 }).ok, false);
  assert.equal(setMatchLive(db, { event: "kickoff", id: "u1-1", live: true, a: 1.5, b: 0 }).ok, false);
  assert.deepEqual(getState(db).live.kickoff, { "u1-1": { a: 1, b: 0 } });
  assert.equal(setMatchLive(db, { event: "kickoff", id: "zz", live: true }).ok, false);
  assert.equal(setMatchLive(db, { event: "kickoff", id: "u1-1", live: false }).ok, true);
  assert.deepEqual(getState(db).live.kickoff, {});
  const st = getState(db);
  assert.equal(matchesOf("kickoff", eventData(st, "kickoff")).length, 30); // 11 upper + 10 mid + 9 lower
  assert.equal(matchesOf("q1", eventData(st, "q1")).length, 64); // 63 + third place
  assert.equal(matchesOf("tr", eventData(st, "tr")).length, 16);
  assert.equal(matchesOf("mena", eventData(st, "mena")).length, 3);
  assert.deepEqual(matchesOf("tr", eventData(st, "tr"))[0].round, [["Group A", {}], ["Opening Matches", {}]]);
  assert.equal(matchesOf("gc", eventData(st, "gc")).length, 14); // 8-team double elimination
  const k = Object.fromEntries(matchesOf("kickoff", eventData(st, "kickoff")).map((m) => [m.id, m.bo]));
  assert.deepEqual([k["u1-1"], k.u4, k.m5, k.l6], [3, 5, 5, 5]); // finals are Bo5
  assert.equal(matchesOf("q1", eventData(st, "q1"))[0].bo, 1); // Round of 64: Bo1
  assert.equal(matchesOf("mena", eventData(st, "mena"))[0].bo, 5);
});

test("MENA open qualifiers (ME / NA 1-2): own pages and addresses, each winner fills its MENA Qualifier Playoffs place", async () => {
  const { openDb, getState, getQualifier } = await import("../lib/db.js");
  const { setQualifierTeams, saveQualifierScore } = await import("../lib/qactions.js");
  const { buildBracket } = await import("../lib/bracket.js");
  const { parseSitePath, siteHref, parseAdminPath, adminHref, eventForAdmin } = await import("../lib/paths.js");
  const db = openDb(":memory:");
  // a full bracket (only first-round gaps are byes); the team listed first in each match wins it, so A wins
  assert.equal(setQualifierTeams(db, "naq2", ["A", ...Array.from({ length: 63 }, (_, i) => `N${i + 2}`)].join("\n")).ok, true);
  for (let guard = 0; guard < 80; guard++) {
    const q = getQualifier(db, "naq2");
    const m = buildBracket(q.slots, q.scores, q.bo).matches.find((x) => x.a && x.b && !x.bye && x.winner == null);
    if (!m) break;
    const need = m.bo === 1 ? 1 : m.bo === 3 ? 2 : 3;
    assert.equal(saveQualifierScore(db, { event: "naq2", id: m.id, sa: need, sb: 0 }).ok, true);
  }
  const t = getState(db).regional.mena.teams;
  assert.equal(t.find((x) => x.source === "NA Qualifier 2").name, "A");
  assert.equal(t.find((x) => x.source === "ME Qualifier 1").name, "");
  // addresses
  assert.equal(siteHref("meq1"), "/vctemea/mena/me-qualifier-1/overview");
  assert.deepEqual(parseSitePath("/vctemea/mena/na-qualifier-2/overview"), { event: "naq2", tab: "overview" });
  const nav = parseAdminPath("/admin/vctemea/mena/na-qualifier-1");
  assert.equal(nav.region, "mena");
  assert.equal(nav.ttop, "naq1");
  assert.equal(eventForAdmin(nav), "naq1");
  assert.equal(adminHref(nav), "/admin/vctemea/mena/na-qualifier-1");
  assert.equal(eventForAdmin({ region: "mena", top: "q1", ttop: "trq1" }), "mena"); // another region's stage is ignored
});

test("Game Changers EMEA: 8-team double elimination, losers drop to the lower bracket, places 1-8, seeded from its team list", async () => {
  const { buildRegional, regPlaces, isOpening } = await import("../lib/regional.js");
  const { openDb, getState } = await import("../lib/db.js");
  // teams 1-8: the upper quarterfinals 1v2, 3v4, 5v6, 7v8; side a always wins
  const manual = { ubq1: { a: 1, b: 2 }, ubq2: { a: 3, b: 4 }, ubq3: { a: 5, b: 6 }, ubq4: { a: 7, b: 8 } };
  const scores = {};
  for (let guard = 0; guard < 20; guard++) {
    const b = buildRegional(manual, scores, "gc");
    const m = Object.values(b.byId).find((x) => x.a && x.b && x.winner == null);
    if (!m) break;
    scores[m.id] = { a: m.a, b: m.b, sa: m.bo === 5 ? 3 : 2, sb: 0 };
  }
  const b = buildRegional(manual, scores, "gc");
  assert.deepEqual([b.byId.lb1.a, b.byId.lb1.b], [2, 4]); // the upper quarterfinal losers
  assert.deepEqual([b.byId.lbq1.a, b.byId.lbq1.b], [2, 7]); // crossed: the loser of the other upper semifinal
  assert.deepEqual([b.byId.lbf.a, b.byId.lbf.b], [2, 5]); // the upper final loser
  assert.deepEqual(regPlaces(b), [1, 2, 5, 6, 7, 3, 4, 8]); // 3rd upper final loser, 4th lower semifinal loser, 5-6 lower quarterfinals, 7-8 lower round 1
  assert.equal(isOpening("ubq3", "gc"), true);
  assert.equal(isOpening("ubs1", "gc"), false);
  assert.equal(b.byId.gf.bo, 5);
  // a new database: the 8 places, the teams of the Game Changers list first
  const db = openDb(":memory:");
  assert.equal(getState(db).regional.gc.teams.length, 8);
});

test("clearing a match removes its score, hand-picked teams, time, live flag and details", async () => {
  const { setMatchTime, setMatchLive, setMatchExtra, getKickoff, getRegional, getQualifier } = await import("../lib/db.js");
  const { clearMatch } = await import("../lib/mclear.js");
  const { setKickoffMatch, saveKickoffScore } = await import("../lib/kactions.js");
  const { setRegionalMatch, saveRegionalScore } = await import("../lib/ractions.js");
  const db = openDb(":memory:");
  const extras = (event, id) => {
    assert.equal(setMatchTime(db, { event, id, at: "2027-01-15T15:00:00Z" }).ok, true);
    assert.equal(setMatchLive(db, { event, id, live: true, a: 1, b: 0 }).ok, true);
    assert.equal(setMatchExtra(db, { event, id, stream: "https://twitch.tv/x", vod: "", maps: [{ map: "Bind", a: 13, b: 5, pick: "a" }] }).ok, true);
  };
  const noExtras = (event, id) => {
    const st = getState(db);
    assert.equal(st.times[event][id], undefined);
    assert.equal(st.live[event][id], undefined);
    assert.equal(st.extra[event][id], undefined);
  };
  // Kickoff, teams by hand and a score; another match keeps everything
  assert.equal(setKickoffMatch(db, { id: "u1-1", a: 1, b: 2 }).ok, true);
  assert.equal(setKickoffMatch(db, { id: "u1-2", a: 3, b: 4 }).ok, true);
  assert.equal(saveKickoffScore(db, { id: "u1-1", sa: 2, sb: 0 }).ok, true);
  extras("kickoff", "u1-1");
  extras("kickoff", "u1-2");
  assert.equal(clearMatch(db, { event: "kickoff", id: "u1-1" }).message, "Match cleared.");
  let k = getKickoff(db);
  assert.equal(k.manual["u1-1"], undefined);
  assert.equal(k.scores["u1-1"], undefined);
  assert.deepEqual(k.manual["u1-2"], { a: 3, b: 4 });
  noExtras("kickoff", "u1-1");
  assert.equal(getState(db).times.kickoff["u1-2"], "2027-01-15T15:00:00.000Z");
  // a fed Kickoff match: nothing to refuse, its teams simply keep coming from earlier results
  extras("kickoff", "u3-1");
  assert.equal(clearMatch(db, { event: "kickoff", id: "u3-1" }).ok, true);
  noExtras("kickoff", "u3-1");
  // regional opening match
  assert.equal(setRegionalMatch(db, { event: "mena", id: "sf1", a: 1, b: 2 }).ok, true);
  assert.equal(saveRegionalScore(db, { event: "mena", id: "sf1", sa: 3, sb: 0 }).ok, true);
  assert.equal(clearMatch(db, { event: "mena", id: "sf1" }).ok, true);
  const r = getRegional(db, "mena");
  assert.equal(r.manual.sf1, undefined);
  assert.equal(r.scores.sf1, undefined);
  // a qualifier match: the score goes, its teams come from the list
  assert.equal(setQualifierTeams(db, "q1", "A\nB").ok, true);
  assert.equal(saveQualifierScore(db, { event: "q1", id: "r64-1", sa: 1, sb: 0 }).ok, true);
  assert.equal(clearMatch(db, { event: "q1", id: "r64-1" }).ok, true);
  const q = getQualifier(db, "q1");
  assert.equal(q.scores["r64-1"], undefined);
  assert.equal(q.slots[0].name, "A");
  // EU Playoffs: a match that was never drawn, and bad input
  extras("playoffs", "s1-m01");
  assert.equal(clearMatch(db, { event: "playoffs", id: "s1-m01" }).ok, true);
  noExtras("playoffs", "s1-m01");
  assert.equal(clearMatch(db, { event: "playoffs", id: "zz" }).ok, false);
  assert.equal(clearMatch(db, { event: "nope", id: "u1-1" }).ok, false);
  assert.equal(serverFr("Match cleared."), "Match effacé.");
});

test("clearing a drawn EU Swiss match frees its teams, unless a later round already exists", async () => {
  const { clearMatch } = await import("../lib/mclear.js");
  const { setSwissMatch } = await import("../lib/actions.js");
  const db = openDb(":memory:");
  const named = getState(db).teams;
  named.forEach((t, i) => { if (!t.name) db.prepare("UPDATE teams SET name = ? WHERE id = ?").run(`Team ${i}`, t.id); });
  const [a, b] = getState(db).teams;
  assert.equal(setSwissMatch(db, { id: "s1-m01", a: a.id, b: b.id }).ok, true);
  assert.equal(saveScore(db, { id: "s1-m01", sa: 2, sb: 0 }).ok, true);
  assert.equal(clearMatch(db, { event: "playoffs", id: "s1-m01" }).message, "Match cleared.");
  assert.equal(db.prepare("SELECT 1 FROM matches WHERE id = 's1-m01'").get(), undefined);
  // a round 2 exists: round 1 can no longer be redrawn, the score still goes and the teams stay
  assert.equal(setSwissMatch(db, { id: "s1-m01", a: a.id, b: b.id }).ok, true);
  assert.equal(saveScore(db, { id: "s1-m01", sa: 2, sb: 0 }).ok, true);
  db.prepare("INSERT INTO matches (id, stage, round, a, b, bo) VALUES ('s2-m01', 'swiss', '2', '', '', 3)").run();
  assert.match(clearMatch(db, { event: "playoffs", id: "s1-m01" }).message, /teams stay/);
  const row = db.prepare("SELECT a, sa FROM matches WHERE id = 's1-m01'").get();
  assert.equal(row.a, a.id);
  assert.equal(row.sa, null);
});

test("team information read from a Liquipedia page: infobox, links, active roster and staff, achievements", async () => {
  const { parseTeamPage, countryCode } = await import("../lib/teaminfo.js");
  const flag = (c) => `<span class="flag"><img alt="${c}" src="/x.png" /></span>`;
  const table = (head, body) => `<table class="t"><tbody><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr>${body.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const tab = (name, inner) => `<li><span><span class="team-template-team-standard" data-highlighting-class="${name}"><span class="team-template-image-icon team-template-lightmode">${inner}</span> <span class="team-template-text">${name}</span></span></span></li>`;
  const html = `<ul class="nav tabs2">${tab("Self", '<a class="mw-selflink selflink">Self</a>')}${tab("Self GC", '<a href="/valorant/Self_GC"><img src="/commons/images/thumb/1/12/L.png/41px-L.png" /></a></span><span class="team-template-darkmode"><a href="/valorant/Self_GC"><img src="/commons/images/thumb/3/34/D.png/41px-D.png" /></a>')}<li class="x"><span><a href="/valorant/Self/Results">Results</a></span></li></ul><div class="infobox-center infobox-icons"><a href="https://team.gg">w</a><a href="https://x.com/team">x</a><a href="https://www.twitch.tv/team">t</a></div>
    <div><div class="infobox-cell-2 infobox-description">Location:</div><div>${flag("France")}&#160;France</div></div>
    <div><div class="infobox-cell-2 infobox-description">Region:</div><div>Europe</div></div>
    <div><div class="infobox-cell-2 infobox-description">Coach:</div><div>Ben</div></div>
    <div class="infobox-header">History</div>
    <div><div class="infobox-cell-2 infobox-description">Approx. Total Winnings:</div><div>$1,000</div></div>
    <div><div class="infobox-cell-2 infobox-description">Created:</div><div>2013-08-05<br>2021-02-04</div></div>
    <h2 id="Player_Roster">Player Roster</h2>
    <h3 id="Active">Active</h3>${table(["ID", "Name", "Join Date"], [[`${flag("Türkiye")} <a>One</a> <i class="fas fa-crown"></i>`, "Real &amp; Name", '2025-03-18 <sup>[1]</sup>'], [`${flag("Turkey")} <a>Two</a>`, "", "2024-01-01"]])}
    <h3 id="Former">Former</h3>${table(["ID", "Name", "Join Date"], [["<a>Gone</a>", "", ""]])}
    <h2 id="Organization">Organization</h2>
    <h3 id="Active_2">Active</h3>${table(["ID", "Name", "", "Join Date"], [[`${flag("France")} <a>Boss</a>`, "Big Boss", "Team Manager", "2026-03-27"]])}
    <h2 id="Results">Results</h2>${table(["Date", "Place", "Tier", "Tournament", "Result", "Prize"], [[""], ["2026-10-18", "2nd", "S-Tier", '<span><a href="/valorant/VCT/Champions"><img alt="" src="/commons/images/thumb/a/ae/VCT_icon_allmode.png/46px-VCT_icon_allmode.png" /></a></span>', '<a href="/valorant/VCT/Champions">Champions</a>', "1 &#58; 3", '<a href="/valorant/LOUD" title="LOUD Esports"><img src="/commons/images/8/8b/LOUD_allmode.png" /></a><span>LOUD</span>', "$400,000"], ["2026-04-26", "5th", "B-Tier", "", "Stage 2", "3/4 Grp S.", "-"]])}${table(["Other"], [["recent match"]])}
    <h2 id="Data">Data</h2>`;
  const r = parseTeamPage(html);
  assert.deepEqual(r.location, ["France"]);
  assert.deepEqual(r.org, [{ name: "Self GC", page: "Self GC", logo: "1/12/L.png", logoDark: "3/34/D.png" }]); // not itself, not the Results tab
  assert.equal(r.region, "Europe");
  assert.equal(r.coach, "Ben");
  assert.equal(r.winnings, "$1,000");
  assert.deepEqual(r.created, ["2013-08-05", "2021-02-04"]);
  assert.deepEqual(r.links.map((l) => l.type), ["Website", "X", "Twitch"]);
  assert.deepEqual(r.roster.map((p) => p.id), ["One", "Two"]); // the former players are left out
  assert.deepEqual(r.roster[0], { id: "One", name: "Real & Name", country: "Türkiye", cc: "tr", role: "", join: "2025-03-18", captain: true });
  assert.equal(r.roster[1].cc, "tr"); // Liquipedia writes Turkey
  assert.deepEqual(r.staff, [{ id: "Boss", name: "Big Boss", country: "France", cc: "fr", role: "Team Manager", join: "2026-03-27", captain: false }]);
  assert.deepEqual(r.results[0], {
    date: "2026-10-18", place: "2nd", tier: "S-Tier", tournament: "Champions", tournamentLogo: "a/ae/VCT_icon_allmode.png", tournamentLogoDark: "", tournamentUrl: "https://liquipedia.net/valorant/VCT/Champions",
    score: "1 : 3", opponent: "LOUD", opponentName: "LOUD Esports", opponentLogo: "8/8b/LOUD_allmode.png", opponentLogoDark: "", prize: "$400,000",
  });
  // a group-stage exit: no opponent, and the prize is still the last cell
  assert.deepEqual([r.results[1].tournament, r.results[1].score, r.results[1].opponent, r.results[1].prize], ["Stage 2", "3/4 Grp S.", "", "-"]);
  // no active players: the staff must not be taken for them
  const none = parseTeamPage(html.replace('<h3 id="Active">Active</h3>', '<h3 id="Inactive">Inactive</h3>').replace('id="Active_2"', 'id="Active"'));
  assert.deepEqual(none.roster, []);
  assert.equal(none.staff[0].id, "Boss");
  assert.equal(countryCode("Nowhere"), "");
  assert.deepEqual(parseTeamPage("<p>nothing</p>").roster, []);
});

test("player information: reads a Liquipedia player page", async () => {
  const { parsePlayerPage } = await import("../lib/teaminfo.js");
  const cell = (label, value) => `<div><div class="infobox-cell-2 infobox-description">${label}:</div><div>${value}</div></div>`;
  const html = `<div class="infobox-header">x</div>${cell("Name", "Jake Howlett")}${cell("Nationality", '<span class="flag"><a href="/c" title="United Kingdom"><img alt="United Kingdom" src="/f.png" /></a></span>&#160;<a>United Kingdom</a>')}${cell("Status", "Active")}${cell("Years Active (Player)", "2020 – <b>Present</b>")}${cell("Role", "In-game leader")}${cell("Team", "Fnatic")}${cell("Approx. Total Winnings", "$422,988")}
    <div class="infobox-header infobox-header-2">Links</div><div class="infobox-center infobox-icons"><a href="https://www.vlr.gg/player/438"></a><a href="https://twitter.com/x"></a></div>
    <div class="infobox-header infobox-header-2">History</div><div class="infobox-center"><table><tbody>
    <tr><td>2020-08-05 &#8212; 2021-02-03</td><td><a href="/valorant/SUMN_FC" title="SUMN FC">SUMN FC</a></td></tr>
    <tr><td>2026-09-08</td><td><a href="/valorant/Fnatic" title="Fnatic">Fnatic</a><span>(Inactive)</span></td></tr></tbody></table></div>
    <h2 id="Achievements">Achievements</h2><table><tbody><tr><th>Date</th></tr><tr style="display:none"><td></td></tr>
    <tr><td>2025-10-05</td><td>2nd</td><td>S-Tier</td><td><a href="/valorant/VCT"><img src="/commons/images/thumb/a/ae/VCT.png/46px-VCT.png" /></a></td><td><a href="/valorant/VCT/2025" title="VCT">Champions</a></td><td><a href="/valorant/Fnatic" title="Fnatic"><img src="/commons/images/thumb/f/f9/F.png/7px-F.png" /></a></td><td>1 : 3</td><td><a href="/valorant/NRG" title="NRG"></a>NRG</td><td>$250,000</td></tr>
    <tr><td>2025-01-01</td><td>9th</td><td>A-Tier</td><td></td><td>Cup</td><td><a title="Fnatic"></a></td><td>Group Stage</td><td>$100</td></tr>
    </tbody></table><h2 id="Awards">Awards</h2>`;
  const p = parsePlayerPage(html);
  assert.equal(p.name, "Jake Howlett");
  assert.deepEqual(p.nationality, [{ name: "United Kingdom", cc: "gb" }]);
  assert.equal(p.status, "Active");
  assert.equal(p.years, "2020 – Present");
  assert.equal(p.roles, "In-game leader");
  assert.equal(p.team, "Fnatic");
  assert.equal(p.winnings, "$422,988");
  assert.deepEqual(p.links.map((l) => l.type), ["VLR", "X"]);
  assert.deepEqual(p.history, [{ period: "2026-09-08", team: "Fnatic", note: "Inactive" }, { period: "2020-08-05 — 2021-02-03", team: "SUMN FC", note: "" }]);
  assert.equal(p.results.length, 2);
  assert.equal(p.results[0].tournament, "Champions");
  assert.equal(p.results[0].tournamentLogo, "a/ae/VCT.png");
  assert.equal(p.results[0].team, "Fnatic");
  assert.equal(p.results[0].score, "1 : 3");
  assert.equal(p.results[0].opponent, "NRG");
  assert.equal(p.results[0].prize, "$250,000");
  assert.equal(p.results[1].opponent, ""); // a group-stage exit
  assert.equal(p.results[1].prize, "$100");
  assert.deepEqual(parsePlayerPage("<p>nothing</p>").history, []);
  assert.equal(parsePlayerPage(cell("Name", "Игорь Власов") + cell("Romanized Name", "Igor Vlasov")).name, "Igor Vlasov");
});

test("player information: the right page for a nickname, and who to read next", async () => {
  const { isPlayerPage, nextPlayer, playerDue, playerPageMatches } = await import("../lib/teamfetch.js");
  const source = "{{Infobox player\n|id=Cloud\n|country=Turkey\n|team=BBL Esports\n}}";
  assert.equal(isPlayerPage(source), true);
  assert.equal(isPlayerPage("{{Infobox team|name=Fnatic}}"), false);
  assert.equal(playerPageMatches(source, { cc: "tr", team: "" }), true);
  assert.equal(playerPageMatches(source, { cc: "ru", team: "Fnatic" }), false); // another player with that nickname
  assert.equal(playerPageMatches(source, { cc: "ru", team: "BBL Esports" }), true);
  assert.equal(playerPageMatches(source, { cc: "", team: "" }), false);
  assert.equal(playerPageMatches("|country=United Kingdom", { cc: "gb-sct", team: "" }), true);
  assert.equal(playerPageMatches("|team=Team Liquid Brazil", { cc: "", team: "M8" }), false);
  assert.equal(playerPageMatches("|team=C++ (x)", { cc: "", team: "C++" }), true); // not read as a pattern

  const now = Date.parse("2026-11-04T12:00:00Z");
  const ago = (days) => new Date(now - days * 864e5).toISOString();
  assert.equal(playerDue(undefined, now), true);
  assert.equal(playerDue({ page: "A", fetched: ago(13) }, now), false);
  assert.equal(playerDue({ page: "A", fetched: ago(14) }, now), true);
  assert.equal(playerDue({ page: "", fetched: ago(6) }, now), false);
  assert.equal(playerDue({ page: "", fetched: ago(7) }, now), true);
  const list = [{ name: "Old" }, { name: "New" }, { name: "Recent" }];
  const info = { old: { page: "Old", fetched: ago(20) }, recent: { page: "Recent", fetched: ago(1) } };
  assert.equal(nextPlayer(list, info, {}, now).name, "New"); // never read comes first
  assert.equal(nextPlayer(list, info, { new: now - 1000 }, now).name, "Old"); // a network error waits a little
  assert.equal(nextPlayer([{ name: "Recent" }], info, {}, now), undefined);
});

test("team information: which team to fetch next, and what counts as its Liquipedia page", async () => {
  const { isTeamPage, nextMissing, sameTeamName, siteTeamNames } = await import("../lib/teamfetch.js");
  const now = Date.parse("2026-11-04T12:00:00Z");
  const ago = (ms) => new Date(now - ms).toISOString();
  const page = { page: "Fnatic", fetched: ago(30 * 864e5) };
  assert.equal(nextMissing(["Fnatic", "New Team"], { fnatic: page }, {}, now), "New Team");
  assert.equal(nextMissing(["Fnatic"], { fnatic: page }, {}, now), undefined); // already there, however old: refreshing comes later
  assert.equal(nextMissing(["Ghost"], { ghost: { page: "", fetched: ago(3600e3) } }, {}, now), undefined); // no page: not asked again at once
  assert.equal(nextMissing(["Ghost"], { ghost: { page: "", fetched: ago(2 * 864e5) } }, {}, now), "Ghost"); // ...but the next day
  assert.equal(nextMissing(["New"], {}, { new: now - 60000 }, now), undefined); // a network error waits 10 minutes
  assert.equal(nextMissing(["New"], {}, { new: now - 11 * 60000 }, now), "New");
  assert.equal(sameTeamName("FUT Esport", "FUT Esports"), true);
  assert.equal(sameTeamName("MIR", "Mirage Esports"), false);
  assert.equal(isTeamPage("{{Tabs}}\n{{Infobox team\n|name=X"), true);
  assert.equal(isTeamPage("{{Infobox player\n|id=MIR"), false);
  // the names come from every event: a team added to the Kickoff or to Game Changers counts
  const db = openDb(":memory:");
  db.prepare("UPDATE kteams SET name = 'Added Kickoff Team' WHERE slot = 9").run();
  db.prepare("UPDATE rteams SET name = 'Added GC Team' WHERE event = 'gc' AND slot = 1").run();
  const names = siteTeamNames(db);
  assert.ok(names.includes("Added Kickoff Team") && names.includes("Added GC Team") && names.includes("Eternal Fire"));
});

test("a team's organization: the teams its page lists and the ones listing it, linked here when they play on the site", async () => {
  const { orgOf } = await import("../lib/teams.js");
  const db = openDb(":memory:");
  db.prepare("UPDATE rteams SET name = 'Mates GC' WHERE event = 'gc' AND slot = 1").run();
  db.prepare("UPDATE kteams SET name = 'Mates' WHERE slot = 1").run();
  db.prepare("UPDATE kteams SET name = 'Other' WHERE slot = 2").run();
  const initial = getState(db);
  const info = {
    mates: { name: "Mates", page: "Mates Esports", org: [{ name: "Mates GC", page: "Mates GC", logo: "a/aa/x.png", logoDark: "" }, { name: "Mates Academy", page: "Mates Academy", logo: "", logoDark: "" }] },
    "mates-gc": { name: "Mates GC", page: "Mates GC", org: [] },
    other: { name: "Other", page: "Other", org: [{ name: "Mates", page: "Mates Esports", logo: "", logoDark: "" }] },
  };
  const org = orgOf(info, "mates");
  assert.deepEqual(org.map((t) => [t.name, t.href]), [["Mates GC", "/team/mates-gc"], ["Mates Academy", "/team/mates-academy"], ["Other", "/team/other"]]); // always a page here
  assert.deepEqual(orgOf(info, "mates-gc").map((t) => t.name), ["Mates"]); // listed by it, even with nothing on its own page
  assert.deepEqual(orgOf(info, "nope"), []);
  assert.equal(initial.kickoff.teams[0].name, "Mates");
});

test("directory: everything that can have a page here, and links to it", async () => {
  const { baseTitle, buildDirectory, linkResults, tournamentKey } = await import("../lib/directory.js");
  const dir = buildDirectory({
    lists: { teams: [["LOUD", "LOUD", "8/8b/l.png"]], players: { players: [["aspas", "br"]], staff: [["Coach One", "fr"]] } },
    teamInfo: { fnatic: { name: "Fnatic", page: "Fnatic", org: [{ name: "FNC Rising", logo: "" }], roster: [{ id: "Alfajer", cc: "tr" }], staff: [{ id: "CoJo", cc: "gb", role: "Head Coach" }], results: [{ tournament: "Champions", tournamentUrl: "https://liquipedia.net/valorant/VCT/2025/Champions", tournamentLogo: "a/ae/x.png", opponentName: "NRG", opponentLogo: "1/16/n.png" }] } },
    playerInfo: { filu: { page: "Filu (Polish player)", history: [{ team: "KOI" }], results: [] } },
    tournamentInfo: { "VCT/2025/Champions": { placements: [{ team: "DRX", logo: "1/1f/d.png" }] } },
  });
  for (const k of ["loud", "fnatic", "fnc-rising", "nrg", "koi", "drx"]) assert.ok(dir.teams[k], k);
  assert.equal(dir.teams.loud.tag, "LOUD");
  assert.equal(dir.people.aspas.cc, "br");
  assert.equal(dir.people["coach-one"].cc, "fr");
  assert.equal(dir.people.alfajer.team, "Fnatic");
  assert.equal(dir.people.cojo.role, "Head Coach");
  assert.equal(dir.people.filu.name, "Filu");
  assert.equal(dir.tournaments["VCT/2025/Champions"].name, "Champions");
  assert.equal(dir.teams.nobody, undefined);
  assert.equal(baseTitle("Cloud (Turkish player)"), "Cloud");
  assert.equal(tournamentKey("https://liquipedia.net/valorant/A/B_C%3A_D"), "A/B_C:_D");
  assert.equal(tournamentKey("https://evil.test/valorant/A"), "");
  const [r] = linkResults([{ tournamentUrl: "https://liquipedia.net/valorant/VCT/2025/Champions", teamName: "Fnatic", opponentName: "Unknown" }], dir);
  assert.equal(r.tournamentHref, "/tournament/VCT/2025/Champions");
  assert.equal(r.teamHref, "/team/fnatic");
  assert.equal(r.opponentHref, "");
});

test("tournament information: reads a Liquipedia tournament page", async () => {
  const { parseTournamentPage } = await import("../lib/teaminfo.js");
  const cell = (label, value) => `<div><div class="infobox-cell-2 infobox-description">${label}:</div><div>${value}</div></div>`;
  const team = (name, img) => `<td class="prizepooltable-col-team"><div class="block-team"><span class="team-template-image-icon"><a href="/valorant/${name}" title="${name}"><img src="/commons/images/thumb/${img}/7px-x.png" /></a></span><span class="name"><a title="${name}">${name}</a></span></div></td>`;
  const html = `${cell("Series", " VCT ")}${cell("Organizer", "Riot Games")}${cell("Type", "Offline")}${cell("Prize Pool", "$2,250,000&#160;USD")}${cell("Start Date", "2025-09-12")}${cell("End Date", "2025-10-05")}${cell("Teams", "16")}${cell("Liquipedia Tier", "S-Tier")}
    <h2 id="About">About</h2><h3 id="Prize_Pool">Prize Pool</h3><table>
    <tr><th>Place</th><th>Participant</th><th>$</th></tr>
    <tr><td class="prizepooltable-place" rowspan="1">1</td>${team("NRG", "1/16/N.png")}<td data-align="right">$1,000,000</td></tr>
    <tr><td class="prizepooltable-place" rowspan="2">5&#45;6</td>${team("EDG", "a/ab/E.png")}<td data-align="right">$85,000</td></tr>
    <tr>${team("G2", "c/cd/G.png")}<td data-align="right">$85,000</td></tr></table><h3 id="Schedule">Schedule</h3><table><tr><td class="prizepooltable-col-team"><a title="Not this">x</a></td></tr></table>`;
  const t = parseTournamentPage(html);
  assert.equal(t.series, "VCT");
  assert.equal(t.organizer, "Riot Games");
  assert.equal(t.prizePool, "$2,250,000 USD");
  assert.equal(t.start, "2025-09-12");
  assert.equal(t.end, "2025-10-05");
  assert.equal(t.teams, "16");
  assert.equal(t.tier, "S-Tier");
  assert.deepEqual(t.placements.map((p) => [p.place, p.team, p.prize]), [["1", "NRG", "$1,000,000"], ["5-6", "EDG", "$85,000"], ["5-6", "G2", "$85,000"]]);
  assert.equal(t.placements[0].logo, "1/16/N.png");
  assert.deepEqual(parseTournamentPage("<p>nothing</p>").placements, []);
});

test("vlr.gg: reads a player's page and a team's, and what to read next", async () => {
  const { parseVlrPlayer, parseVlrTeam, vlrId } = await import("../lib/vlrinfo.js");
  const { nextVlr, teamVlrId, vlrDue } = await import("../lib/vlrfetch.js");
  const { linkVlr } = await import("../lib/directory.js");
  const row = (agent, use, cells) => `<tr><td class="mod-agent"><img src="/x.png" alt="${agent}"></td><td class="mod-use">${use}</td>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
  const match = (cls, a, b, sa, sb) => `<a href="/1/x" class="wf-card fc-flex m-item"><div class="m-item-event text-of"><div class="text-of"> VCT 26: EMEA Stage 2 </div> Play-Ins &sdot; LR2 </div><div class="m-item-team text-of"><span class="m-item-team-name"> ${a} </span></div><div class="m-item-result ${cls} fc-flex" data-match-id="1"><span>${sa}</span><div>:</div><span>${sb}</span></div><!--x--><div class="m-item-team text-of mod-right"><span class="m-item-team-name"> ${b} </span></div><div class="m-item-date"><div> 2026/08/14 </div> 7:30 pm </div></a>`;
  const html = `<h2> Current Teams </h2><a class="wf-module-item" href="/team/2593/fnatic"><div style="font-weight: 500;"> FNATIC </div></a><h2> Past Teams </h2><a href="/team/668/sumn-fc"><div style="font-weight: 500;"> SUMN </div></a>
    <table class="st-table mod-agent-rows"><thead><tr><th>Use</th></tr></thead><tbody>
    ${row("omen", "(6) 86%", [100, "1.00", "200.0", "1.00", "70%", "100.0", "0.5", "0.3", "0.6", 50, 50, 20, 5, 5])}
    ${row("harbor", "(1) 14%", [300, "2.00", "100.0", "2.00", "60%", "200.0", "0.5", "0.3", "", 100, 50, 10, 1, 0])}
    </tbody></table>${match("mod-loss", "FNATIC", "Joblife", 0, 2)}${match("mod-win", "FNATIC", "NRG", 2, 1)}`;
  const p = parseVlrPlayer(html);
  assert.deepEqual(p.team, { id: "2593", name: "FNATIC" });
  assert.equal(p.agents.length, 2);
  assert.equal(p.agents[0].agent, "omen");
  assert.equal(p.agents[0].maps, 6);
  assert.equal(p.agents[1].pick, 14);
  assert.equal(p.agents[1].k, 100);
  assert.equal(p.totals.rounds, 400);
  assert.equal(p.totals.maps, 7);
  assert.equal(p.totals.rating, 1.75); // weighed by rounds
  assert.equal(p.totals.acs, 125);
  assert.equal(p.totals.k, 150);
  assert.equal(p.totals.kd, 1.5);
  assert.deepEqual(p.results[0], { event: "VCT 26: EMEA Stage 2", stage: "Play-Ins · LR2", a: "FNATIC", b: "Joblife", sa: 0, sb: 2, win: false, date: "2026-08-14" });
  assert.equal(p.results[1].win, true);
  assert.equal(parseVlrTeam(html).results.length, 2);
  assert.deepEqual(parseVlrPlayer("<p>nothing</p>"), { agents: [], totals: null, results: [], team: null });

  assert.equal(vlrId([{ url: "https://fnatic.com" }, { url: "https://www.vlr.gg/player/438" }], "player"), "438");
  assert.equal(vlrId([{ url: "https://www.vlr.gg/team/2593" }], "player"), "");
  assert.equal(vlrId([{ url: "https://evil.test/www.vlr.gg/player/1" }], "player"), "");

  const now = Date.parse("2026-11-04T12:00:00Z");
  const ago = (days) => new Date(now - days * 864e5).toISOString();
  assert.equal(vlrDue(undefined, now), true);
  assert.equal(vlrDue({ fetched: ago(13) }, now), false);
  assert.equal(vlrDue({ fetched: ago(14) }, now), true);
  const links = (kind, id) => ({ links: [{ url: `https://www.vlr.gg/${kind}/${id}` }] });
  const players = { boaster: links("player", "438"), nolink: { links: [] } };
  const teams = { fnatic: {} };
  const vlr = { players: { boaster: { fetched: ago(1), team: { id: "2593", name: "FNATIC" } } }, teams: {} };
  assert.equal(teamVlrId("fnatic", teams, vlr), "2593"); // from a player's current team
  assert.equal(teamVlrId("fnatic", { fnatic: links("team", "9") }, vlr), "9"); // its own first
  assert.equal(teamVlrId("nobody", teams, vlr), "");
  assert.deepEqual(nextVlr(["NoLink", "Boaster"], ["Fnatic"], players, teams, vlr, {}, now), { kind: "team", key: "fnatic", id: "2593" });
  assert.deepEqual(nextVlr(["Boaster"], [], players, teams, { players: {}, teams: {} }, {}, now), { kind: "player", key: "boaster", id: "438" });
  assert.equal(nextVlr(["Boaster"], [], players, teams, { players: {}, teams: {} }, { "player:boaster": now - 1000 }, now), undefined); // a network error waits
  const linked = linkVlr({ results: [{ a: "FNATIC", b: "Nobody" }] }, { teams: { fnatic: {} } });
  assert.equal(linked.results[0].aHref, "/team/fnatic");
  assert.equal(linked.results[0].bHref, "");
  assert.equal(linkVlr(undefined, { teams: {} }), null);
});

test("live search: what a page is, vlr.gg's results, and putting both together", async () => {
  const { classifyPage, mergeLive, parseVlrSearch } = await import("../lib/livesearch.js");
  const { buildDirectory } = await import("../lib/directory.js");
  assert.deepEqual(classifyPage("Fnatic", "{{Infobox team\n|name=Fnatic\n}}"), { type: "team", name: "Fnatic" });
  assert.deepEqual(classifyPage("Derke (Finnish)", "{{Infobox player\n|name=X\n|country=Finland\n}}"), { type: "player", name: "Derke", cc: "fi" });
  assert.deepEqual(classifyPage("VCT/2025/Champions", "{{Infobox league\n|name=VALORANT Champions 2025\n}}"), { type: "event", name: "VALORANT Champions 2025", key: "VCT/2025/Champions" });
  assert.equal(classifyPage("Champions 2024", "#REDIRECT [[VCT/2024/Champions]]"), null);
  assert.equal(classifyPage("Missing", undefined), null);
  const many = ["Zed Kit", "Kit One", "Kit Two", "Kit Three", "Kit Four", "Kit Five", "Kit"].map((n, i) => `<a href="/search/r/team/${i}/idx"><div class="search-item-title"> ${n} </div></a>`).join("");
  assert.deepEqual(parseVlrSearch(many, "kit").map((x) => x.name), ["Kit", "Kit One", "Kit Two", "Kit Three", "Kit Four"]); // the best five
  assert.equal(classifyPage("VCT/2025/M","{{Infobox league\n|name=Masters Toronto&nbsp;2025\n}}").name, "Masters Toronto 2025");
  assert.deepEqual(parseVlrSearch('<a href="/search/r/team/7/idx"><div class="search-item-title"> Paper Rex Academy (inactive ) </div></a>', "paper"), [{ type: "team", id: "7", name: "Paper Rex Academy" }]);
  const html = `<a href="/search/r/player/5022/idx" class="wf-module-item search-item mod-first"><div class="search-item-thumb"><img src="x"></div><div class="search-item-title"> Derke </div></a>
    <a href="/search/r/player/67356/idx" class="search-item"><div class="search-item-title"> qwerinn </div></a>
    <a href="/search/r/team/2593/idx" class="search-item"><div class="search-item-title"> Derke Team </div></a>
    <a href="/search/r/event/1/idx" class="search-item"><div class="search-item-title"> Derke Cup </div></a>`;
  assert.deepEqual(parseVlrSearch(html, "derke"), [{ type: "player", id: "5022", name: "Derke" }, { type: "team", id: "2593", name: "Derke Team" }]);
  const m = mergeLive(
    [{ type: "player", name: "Derke", cc: "fi" }, { type: "team", name: "Derke Team" }, { type: "event", name: "Derke Cup", key: "Derke/Cup_1" }, { type: "player", name: "Other" }],
    [{ type: "player", id: "5022", name: "Derke" }, { type: "player", id: "9", name: "Derke2" }, { type: "team", id: "2593", name: "Derke Team" }],
    "derke",
  );
  assert.deepEqual(m.players.map((x) => [x.name, x.sub, x.href]), [["Derke", "Liquipedia", "/player/derke"], ["Derke2", "vlr.gg", "/player/derke2"]]); // once each
  assert.deepEqual(m.teams.map((x) => x.href), ["/team/derke-team"]);
  assert.equal(m.events[0].href, "/tournament/Derke/Cup_1");
  assert.deepEqual(m.found.people.derke, { name: "Derke", cc: "fi", vlrId: "5022" });
  assert.equal(m.found.teams["derke-team"].vlrId, "2593");
  assert.equal(m.found.people.other, undefined); // not what was typed
  // what was found gets a page here
  const dir = buildDirectory({ searchFound: m.found });
  assert.equal(dir.people.derke2.name, "Derke2");
  assert.equal(dir.teams["derke-team"].name, "Derke Team");
  assert.equal(dir.tournaments["Derke/Cup_1"].name, "Derke Cup");
});

test("updates: opened from the search bar, read first unless just read", async () => {
  const { updateDue } = await import("../lib/teamfetch.js");
  const { vlrBlocked } = await import("../lib/vlrfetch.js");
  const now = Date.parse("2026-11-04T12:00:00Z");
  assert.equal(updateDue(undefined, now), true);
  assert.equal(updateDue({ fetched: new Date(now - 59 * 60000).toISOString() }, now), false);
  assert.equal(updateDue({ fetched: new Date(now - 61 * 60000).toISOString() }, now), true);
  assert.equal(vlrBlocked({ blockedUntil: new Date(now + 1000).toISOString() }, now), true);
  assert.equal(vlrBlocked({ blockedUntil: new Date(now - 1000).toISOString() }, now), false);
  assert.equal(vlrBlocked({ blockedUntil: "" }, now), false);
});

test("team information: inactive players, former players and former staff", async () => {
  const { parseTeamPage } = await import("../lib/teaminfo.js");
  const { nextOutdated, teamOutdated } = await import("../lib/teamfetch.js");
  const { buildDirectory, linkFormer } = await import("../lib/directory.js");
  const row = (id, name, role, join, leave, team) => `<tr><td><span class="flag"><img alt="Greece" src="/x.png" /></span><a title="${id}">${id}</a></td><td>${name}</td><td>${role}</td><td>${join} <sup>[1]</sup></td><td>${leave} <sup>[2]</sup></td><td>${team}</td></tr>`;
  const head = "<tr><th>ID</th><th>Name</th><th></th><th>Join Date</th><th>Leave Date</th><th>New Team</th></tr>";
  const html = `<h2 id="Player_Roster">Player Roster</h2><h3 id="Active">Active</h3><table><tr><th>ID</th><th>Name</th><th>Join Date</th></tr><tr><td><a>Now</a></td><td>N</td><td>2026-01-01</td></tr></table>
    <h3 id="Inactive">Inactive</h3><table><tr><th>ID</th><th>Name</th><th>Join Date</th><th>Inactive Date</th></tr><tr><td><a>Rest</a></td><td>R</td><td>2024-01-01</td><td>2026-09-08</td></tr></table>
    <h3 id="Former">Former</h3><table>${head}${row("Old", "O", "", "2021-01-01", "2022-01-01", '<a href="/valorant/index.php?title=Gone" title="Gone (page does not exist)">Gone</a>')}${row("Later", "L", "Inactive", "2023-01-01", "2024-02-02", '<span class="team-template-text"><a href="/valorant/NRG" title="NRG">NRG</a></span>')}</table>
    <h3 id="Stand-in">Stand-in</h3><table>${head}${row("Sub", "S", "", "2023-03-01", "2023-03-02", "")}</table>
    <h2 id="Organization">Organization</h2><h3 id="Active_2">Active</h3><table><tr><th>ID</th><th>Name</th><th>Position</th><th>Join Date</th></tr><tr><td><a>Boss</a></td><td>B</td><td>CEO</td><td>2020-01-01</td></tr></table>
    <h3 id="Former_2">Former</h3><table>${head}${row("OldCoach", "C", "Head Coach", "2021-01-01", "2022-06-06", "")}</table><h2 id="Results">Results</h2>`;
  const t = parseTeamPage(html);
  assert.deepEqual(t.roster.map((p) => p.id), ["Now"]);
  assert.deepEqual(t.staff.map((p) => p.id), ["Boss"]);
  assert.deepEqual(t.inactivePlayers.map((p) => [p.id, p.leave]), [["Rest", "2026-09-08"]]);
  assert.deepEqual(t.formerPlayers.map((p) => [p.id, p.leave, p.role]), [["Later", "2024-02-02", "Inactive"], ["Sub", "2023-03-02", "Stand-in"], ["Old", "2022-01-01", ""]]); // who left last first
  assert.equal(t.formerPlayers[0].newTeam, "NRG");
  assert.equal(t.formerPlayers[0].newTeamName, "NRG");
  assert.equal(t.formerPlayers[2].newTeam, "Gone");
  assert.equal(t.formerPlayers[2].newTeamName, ""); // that page does not exist
  assert.equal(t.formerPlayers[0].cc, "gr");
  assert.deepEqual(t.formerStaff.map((p) => [p.id, p.role, p.leave]), [["OldCoach", "Head Coach", "2022-06-06"]]);

  assert.equal(teamOutdated({ page: "A" }), true);
  assert.equal(teamOutdated({ page: "A", formerPlayers: [] }), false);
  assert.equal(teamOutdated({ page: "" }), false);
  assert.equal(teamOutdated(undefined), false);
  assert.equal(nextOutdated(["Done", "Old"], { done: { page: "D", formerPlayers: [] }, old: { page: "O" } }), "Old");

  const dir = buildDirectory({ teamInfo: { x: { name: "X", formerPlayers: t.formerPlayers, formerStaff: t.formerStaff, inactivePlayers: t.inactivePlayers } } });
  assert.ok(dir.people.oldcoach && dir.people.later && dir.people.rest); // a page for each
  assert.equal(dir.people.later.team, ""); // no longer their team
  assert.equal(linkFormer(t.formerPlayers, dir)[0].newTeamHref, "/team/nrg");
  assert.deepEqual(linkFormer(undefined, dir), []);

  const { byLeaveYear } = await import("../lib/teams.js");
  const years = byLeaveYear([{ id: "A", leave: "2024-02-02" }, { id: "B", leave: "" }, { id: "C", leave: "2026-12-??" }, { id: "D", leave: "2024-01-01" }, { id: "E", leave: "????-??-??" }]);
  assert.deepEqual(years.map((y) => [y.year, y.people.map((p) => p.id)]), [["2026", ["C"]], ["2024", ["A", "D"]], ["", ["B", "E"]]]); // the latest first, unknown dates last
  assert.deepEqual(byLeaveYear(undefined), []);
});

test("the list of pages to read, and what is saved in the database", async () => {
  const { askToRead, itemsMention, itemsStamp, readBlob, readItems, saveBlob, saveItem, takeRequest } = await import("../lib/lpstore.js");
  const { requestFetch } = await import("../lib/teamfetch.js");
  const { requestVlr } = await import("../lib/vlrfetch.js");
  const { findLogo, logoFiles, saveTagLogo } = await import("../lib/db.js");
  const db = openDb(":memory:");
  const before = globalThis.__kickoffDb;
  globalThis.__kickoffDb = db; // what the site's functions use
  try {
    // asked once, whoever asks; "first" goes ahead of the others; each reader takes its own
    requestFetch({ kind: "team", name: "A" });
    requestFetch({ kind: "team", name: "a" });
    requestFetch({ kind: "person", name: "A" });
    requestVlr({ kind: "player", key: "a", id: "1" });
    assert.equal(db.prepare("SELECT count(*) n FROM lp_requests").get().n, 3);
    requestFetch({ kind: "tournament", page: "VCT/2025" }, Date.now(), true);
    assert.equal(takeRequest("lp:").page, "VCT/2025");
    assert.equal(takeRequest("vlr:").id, "vlr:player:a");
    assert.equal(takeRequest("vlr:"), null);
    assert.equal(takeRequest("lp:").id, "lp:team:a");
    requestFetch({ kind: "team", name: "B" });
    requestFetch({ kind: "team", name: "B" }, Date.now(), true); // asked again, now first
    assert.equal(db.prepare("SELECT first FROM lp_requests WHERE id = 'lp:team:b'").get().first, 1);
    assert.equal(takeRequest("lp:").id, "lp:team:b");
    for (let n = 0; n < 5; n += 1) askToRead(`lp:x${n}`, {}, false, 3);
    assert.equal(db.prepare("SELECT count(*) n FROM lp_requests").get().n, 3); // a bounded list

    // the information
    const stamp = itemsStamp();
    saveItem("team", "x", { name: "X", page: "X", logo: "a/aa/logo.png" });
    assert.notEqual(itemsStamp(), stamp);
    saveItem("team", "x", { name: "X2", logo: "a/aa/logo.png" });
    assert.equal(readItems("team").x.name, "X2");
    assert.deepEqual(readItems("nothing"), {});
    assert.equal(itemsMention("a/aa/logo.png"), true);
    assert.equal(itemsMention("b/bb/other.png"), false);
    assert.equal(itemsMention('"; DROP TABLE lp_items; --'), false);

    // logos: bytes come back the same, a new one replaces the tag's old one, whatever its extension
    const bytes = Buffer.from([0, 1, 2, 255]);
    saveBlob("k", bytes, "png");
    assert.deepEqual(readBlob("k"), { buf: bytes, ext: "png" });
    assert.equal(readBlob("none"), null);
    assert.equal(saveTagLogo("BJK FE", bytes, "svg"), "BJK-FE.svg");
    assert.equal(findLogo("Team", undefined, "bjk fe"), "/api/logos/BJK-FE.svg");
    saveTagLogo("BJK FE", bytes, "png");
    assert.deepEqual(logoFiles(), ["BJK-FE.png"]);
    assert.equal(findLogo("Team", undefined, "NONE"), "");
  } finally {
    globalThis.__kickoffDb = before;
    db.close();
  }
});

test("search: tournaments, teams and people; the site's own first, and every result stays on the site", async () => {
  const { searchAll, searchIndex } = await import("../lib/search.js");
  const db = openDb(":memory:");
  db.prepare("UPDATE rteams SET name = 'Beşiktaş Esports', tag = 'BJK', roster = 'Ali|tr,Sub|tr|sub' WHERE event = 'tr' AND slot = 4").run();
  const initial = getState(db);
  const info = {
    "team-vitality": { name: "Team Vitality", page: "Team Vitality", roster: [{ id: "Jamppi", name: "Elias Olkkonen", cc: "fi" }],
      results: [{ tournament: "VALORANT Champions 2026", tournamentUrl: "https://liquipedia.net/valorant/VCT/2026/Champions", tournamentLogo: "a/ae/x.png" }, { tournament: "VALORANT Champions 2026" }] },
  };
  const lists = { teams: [["Team Vitality", "VIT", "1/11/v.png"], ["LOUD", "LOUD", "8/8b/l.png"]], players: { players: [["Jamppi", "fi"], ["aspas", "br"]], staff: [["Coachy", "fr"]] } };
  const items = searchIndex(initial, info, lists);
  const s = (q) => searchAll(items, q);
  assert.deepEqual(s("k"), { events: [], teams: [], players: [] }); // too short
  assert.equal(s("kickoff").events[0].href, "/vctemea/kickoff/overview");
  assert.ok(s("turquie").events.some((e) => e.name === "Türkiye Qualifier Playoffs")); // by another word
  assert.equal(s("champions").events.length, 1); // once, though two results name it
  assert.equal(s("champions").events[0].href, "/tournament/VCT/2026/Champions");
  assert.equal(s("besiktas").teams[0].href, "/team/besiktas-esports"); // without accents
  assert.equal(s("bjk").teams[0].name, "Beşiktaş Esports"); // by tag
  const vit = s("vitality").teams;
  assert.equal(vit.length, 1); // on the site: not listed again as a Liquipedia team
  assert.equal(vit[0].href, "/team/team-vitality");
  assert.equal(s("loud").teams[0].href, "/team/loud");
  assert.equal(s("jamppi").players.length, 1);
  assert.equal(s("jamppi").players[0].href, "/player/jamppi");
  assert.equal(s("olkkonen").players[0].name, "Jamppi"); // by real name
  assert.equal(s("ali").players[0].sub, "Beşiktaş Esports");
  assert.equal(s("aspas").players[0].href, "/player/aspas");
  assert.equal(s("coachy").players[0].href, "/player/coachy"); // staff too
  assert.deepEqual(s("zzzz"), { events: [], teams: [], players: [] });
});

test("where the editor opens from a page of the site, and on which view", async () => {
  const { adminHrefForPath, adminHref, adminNavForEvent, parseAdminPath } = await import("../lib/paths.js");
  assert.equal(adminHrefForPath("/"), "/admin");
  assert.equal(adminHrefForPath("/team/karmine-corp"), "/admin");
  assert.equal(adminHrefForPath("/nope"), "/admin");
  assert.equal(adminHrefForPath("/vctemea/kickoff/overview"), "/admin/vctemea/kickoff/teams");
  assert.equal(adminHrefForPath("/vctemea/mena/na-qualifier-2/overview"), "/admin/vctemea/mena/na-qualifier-2");
  assert.equal(adminHrefForPath("/vctgcemea/stats"), "/admin/vctgcemea/teams");
  for (const [ev, href] of [["playoffs", "/admin/vctemea/eu/playoff/matches"], ["kickoff", "/admin/vctemea/kickoff/matches"], ["tr", "/admin/vctemea/turkiye/playoff/matches"], ["gc", "/admin/vctgcemea/matches"], ["q2", "/admin/vctemea/eu/qualifier-2"], ["meq1", "/admin/vctemea/mena/me-qualifier-1"]]) {
    assert.equal(adminHref(adminNavForEvent(ev, true)), href);
    assert.equal(adminHref(parseAdminPath(href)), href);
  }
});

test("editor home: matches live, waiting for their score, and next", async () => {
  const { setMatchTime, setMatchLive } = await import("../lib/db.js");
  const { saveKickoffScore, setKickoffMatch } = await import("../lib/kactions.js");
  const { editorAgenda } = await import("../lib/matchlist.js");
  const db = openDb(":memory:");
  const now = Date.parse("2027-01-15T12:00:00Z");
  const at = (id, iso) => assert.equal(setMatchTime(db, { event: "kickoff", id, at: iso }).ok, true);
  at("u1-1", "2027-01-15T10:00:00Z"); // time passed, no score
  at("u1-2", "2027-01-15T11:00:00Z"); // time passed, live
  at("u1-3", "2027-01-15T09:00:00Z"); // time passed, score in
  at("u1-4", "2027-01-15T15:00:00Z"); // later
  assert.equal(setMatchLive(db, { event: "kickoff", id: "u1-2", live: true }).ok, true);
  assert.equal(setKickoffMatch(db, { id: "u1-3", a: 5, b: 6 }).ok, true);
  assert.equal(saveKickoffScore(db, { id: "u1-3", sa: 2, sb: 0 }).ok, true);
  const g = editorAgenda(getState(db), now);
  assert.deepEqual(g.live.map((m) => m.id), ["u1-2"]);
  assert.deepEqual(g.late.map((m) => m.id), ["u1-1"]);
  assert.deepEqual(g.next.map((m) => m.id), ["u1-4"]);
});

test("undo: reverses the last action only, whatever the event, and keeps the history", async () => {
  const { recordAction, lastAction, undoLast, listHistory } = await import("../lib/undo.js");
  const { saveKickoffScore, setKickoffMatch } = await import("../lib/kactions.js");
  const { setMatchTime, getKickoff } = await import("../lib/db.js");
  const db = openDb(":memory:");
  assert.equal(lastAction(db), null);
  assert.equal(undoLast(db).ok, false); // nothing yet
  // an insert, then an update of the same row, as two actions
  assert.equal(setKickoffMatch(db, { id: "u1-1", a: 1, b: 2 }).ok, true);
  recordAction(db, "Match saved.", "ana");
  assert.equal(saveKickoffScore(db, { id: "u1-1", sa: 2, sb: 0 }).ok, true);
  recordAction(db, "Score saved.", "ana");
  assert.equal(lastAction(db).label, "Score saved.");
  assert.equal(undoLast(db, "ana").ok, true);
  let k = getKickoff(db);
  assert.equal(k.scores["u1-1"], undefined); // the score is gone
  assert.deepEqual(k.manual["u1-1"], { a: 1, b: 2 }); // the teams are still there
  assert.equal(lastAction(db).label, "Match saved.");
  assert.equal(undoLast(db).ok, true);
  assert.equal(getKickoff(db).manual["u1-1"], undefined);
  // a deleted row comes back, even through an INSERT OR REPLACE and with text needing quotes
  db.prepare("UPDATE kteams SET name = ? WHERE slot = 3").run("O'Neil \"Team\"");
  recordAction(db, "Team saved.");
  db.prepare("UPDATE kteams SET name = '' WHERE slot = 3").run();
  recordAction(db, "Team saved.");
  undoLast(db);
  assert.equal(db.prepare("SELECT name FROM kteams WHERE slot = 3").get().name, "O'Neil \"Team\"");
  assert.equal(setMatchTime(db, { event: "kickoff", id: "u1-1", at: "2027-01-15T15:00:00Z" }).ok, true);
  recordAction(db, "Match time saved.");
  db.prepare("DELETE FROM mtimes").run();
  recordAction(db, "Match time cleared.");
  undoLast(db);
  assert.equal(getState(db).times.kickoff["u1-1"], "2027-01-15T15:00:00.000Z");
  // an action that changed nothing is not an undo step, but is in the history
  const before = lastAction(db).label;
  recordAction(db, "Nothing changed.");
  assert.equal(lastAction(db).label, before);
  assert.equal(listHistory(db)[0].message, "Nothing changed.");
  assert.ok(listHistory(db).some((h) => h.message === "Undone: Score saved." && h.who === "ana"));
});

test("editor accounts and sign-in tokens", async () => {
  const { addEditor, removeEditor, checkEditor, editorExists, listEditors } = await import("../lib/editors.js");
  const { makeToken, readToken, verifyToken } = await import("../lib/auth.js");
  const db = openDb(":memory:");
  assert.equal(addEditor(db, { name: "Léa", password: "abc" }).ok, false);
  assert.equal(addEditor(db, { name: "Min", password: "abcd" }).ok, true); // 4 characters are enough
  removeEditor(db, { name: "Min" });
  assert.equal(addEditor(db, { name: "x", password: "long enough pass" }).ok, false);
  assert.equal(addEditor(db, { name: "Léa", password: "long enough pass" }).ok, true);
  assert.equal(addEditor(db, { name: "léa", password: "long enough pass" }).ok, false); // taken, whatever the capitals
  assert.equal(checkEditor(db, "léa", "long enough pass"), "Léa");
  assert.equal(checkEditor(db, "Léa", "wrong"), "");
  assert.equal(checkEditor(db, "nobody", "long enough pass"), "");
  assert.ok(!JSON.stringify(db.prepare("SELECT * FROM editors").all()).includes("long enough pass")); // never kept as typed
  assert.equal(listEditors(db)[0].hash, undefined);
  assert.equal(readToken(makeToken("s", Date.now(), "Léa"), "s").who, "Léa");
  assert.equal(readToken(makeToken("s"), "s").who, "");
  assert.equal(verifyToken(makeToken("s", Date.now(), "Léa"), "other"), false);
  const [exp, , sig] = makeToken("s", Date.now(), "Léa").split(".");
  assert.equal(readToken(`${exp}.${Buffer.from("Boss").toString("base64url")}.${sig}`, "s"), null); // another name cannot be slipped in
  assert.equal(removeEditor(db, { name: "Léa" }).ok, true);
  assert.equal(editorExists(db, "Léa"), false);
  assert.equal(removeEditor(db, { name: "Léa" }).ok, false);
});

test("daily backup: one per day, the last 14 kept, and a usable copy", async () => {
  const { dailyBackup } = await import("../lib/backup.js");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bk-"));
  const db = new Database(path.join(dir, "live.db"));
  db.exec("CREATE TABLE t (x); INSERT INTO t VALUES (1)");
  const out = path.join(dir, "backups");
  for (let d = 1; d <= 16; d++) await dailyBackup(db, out, new Date(Date.UTC(2026, 10, d)));
  const files = fs.readdirSync(out).sort();
  assert.equal(files.length, 14);
  assert.equal(files[0], "kickoff-2026-11-03.db");
  await dailyBackup(db, out, new Date(Date.UTC(2026, 10, 16))); // same day: nothing more
  assert.equal(fs.readdirSync(out).length, 14);
  const copy = new Database(path.join(out, files[13]), { readonly: true });
  assert.equal(copy.prepare("SELECT x FROM t").get().x, 1);
  copy.close();
  db.close();
});

test("season archives: frozen copy, new season keeps the teams, undoable clear", async () => {
  const { archiveSeason, listSeasons, getSeason, removeSeason, clearResults } = await import("../lib/seasons.js");
  const { recordAction, undoLast } = await import("../lib/undo.js");
  const { saveKickoffScore, setKickoffMatch } = await import("../lib/kactions.js");
  const { getKickoff } = await import("../lib/db.js");
  const db = openDb(":memory:");
  assert.equal(setKickoffMatch(db, { id: "u1-1", a: 1, b: 2 }).ok, true);
  assert.equal(saveKickoffScore(db, { id: "u1-1", sa: 2, sb: 0 }).ok, true);
  assert.equal(archiveSeason(db, { name: "" }).ok, false);
  assert.equal(archiveSeason(db, { name: "VCT 2027" }).ok, true);
  assert.equal(archiveSeason(db, { name: "vct 2027" }).ok, false); // same address
  assert.equal(listSeasons(db)[0].slug, "vct-2027");
  recordAction(db, "Season archived.");
  assert.equal(clearResults(db).ok, true);
  recordAction(db, "All results cleared.");
  assert.equal(getKickoff(db).scores["u1-1"], undefined);
  assert.equal(getKickoff(db).teams[0].name, "Team Vitality"); // teams stay
  assert.equal(getSeason(db, "vct-2027").state.kickoff.scores["u1-1"].sa, 2); // the archive does not move
  assert.equal(undoLast(db).ok, true);
  assert.equal(getKickoff(db).scores["u1-1"].sa, 2); // and clearing can be undone
  assert.equal(getSeason(db, "nope"), null);
  assert.equal(removeSeason(db, { slug: "vct-2027" }).ok, true);
  assert.equal(removeSeason(db, { slug: "vct-2027" }).ok, false);
});

test("what a shared link says", async () => {
  const { eventPreview, sharedPreview, teamPreview } = await import("../lib/preview.js");
  const { teamProfile } = await import("../lib/teams.js");
  const st = getState(openDb(":memory:"));
  const p = eventPreview("playoffs", "swiss", st, "fr");
  assert.equal(p.title, "EU Qualifier Playoffs · Phase suisse · VCT EMEA");
  assert.match(p.description, /nov\. .* 2026/);
  assert.match(p.description, /équipes/);
  const t = teamPreview(teamProfile(st, "team-vitality"), "en");
  assert.equal(t.title, "Team Vitality · VCT EMEA");
  assert.match(t.description, /0 wins, 0 losses/);
  assert.equal(sharedPreview(t).openGraph.title, t.title);
});

test("languages: Turkish and Arabic for the public pages, English for the rest", async () => {
  const { isRtl, localeOf, normLang } = await import("../lib/i18n.js");
  assert.equal(makeT("tr")("Home"), "Ana sayfa");
  assert.equal(makeT("ar")("Round {n}", { n: 2 }), "الجولة 2");
  assert.equal(makeT("tr")("Sign out"), "Sign out"); // not translated: English
  assert.equal(makeT("tr").server("Score saved."), "Score saved.");
  assert.equal(makeT("fr").server("Score saved."), "Score enregistré.");
  assert.equal(normLang("ar"), "ar");
  assert.equal(normLang("de"), "fr");
  assert.equal(isRtl("ar"), true);
  assert.equal(isRtl("tr"), false);
  assert.match(new Intl.DateTimeFormat(localeOf("ar"), { day: "numeric" }).format(new Date(Date.UTC(2026, 10, 15, 12))), /15/); // usual digits
});

test("calendar files, match lists and video players", async () => {
  const { embedUrl, googleCalendarUrl, icsFile, scheduleEvents } = await import("../lib/media.js");
  const { allMatches } = await import("../lib/matchlist.js");
  const { setMatchTime, setMatchLive, setMatchExtra } = await import("../lib/db.js");
  const db = openDb(":memory:");
  assert.equal(setMatchTime(db, { event: "kickoff", id: "u4", at: "2027-01-15T15:00:00Z" }).ok, true);
  assert.equal(setMatchLive(db, { event: "mena", id: "sf1", live: true }).ok, true);
  assert.equal(setMatchExtra(db, { event: "kickoff", id: "u4", stream: "", vod: "", highlights: "https://youtu.be/abc123def", maps: [] }).ok, true);
  assert.equal(setMatchExtra(db, { event: "kickoff", id: "u4", highlights: "ftp://x" }).ok, false);
  const st = getState(db);
  assert.equal(st.extra.kickoff.u4.highlights, "https://youtu.be/abc123def");
  const all = allMatches(st);
  assert.equal(all.find((m) => m.event === "mena" && m.id === "sf1").live, true);
  const events = scheduleEvents(all, "https://site.test");
  assert.equal(events.length, 1);
  assert.equal(events[0].url, "https://site.test/vctemea/kickoff/overview");
  const ics = icsFile(events, "A; b", new Date("2026-11-04T10:00:00Z"));
  assert.ok(ics.includes("DTSTART:20270115T150000Z"));
  assert.ok(ics.includes("DTEND:20270115T200000Z")); // Bo5: five hours
  assert.ok(ics.includes("X-WR-CALNAME:A\\; b"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.ok(googleCalendarUrl(events[0]).includes("dates=20270115T150000Z/20270115T200000Z"));
  assert.equal(embedUrl("https://www.twitch.tv/valorant_emea", "site.test"), "https://player.twitch.tv/?channel=valorant_emea&parent=site.test&autoplay=false");
  assert.equal(embedUrl("https://twitch.tv/videos/123456", "site.test"), "https://player.twitch.tv/?video=123456&parent=site.test&autoplay=false");
  assert.equal(embedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  assert.equal(embedUrl("https://youtu.be/dQw4w9WgXcQ"), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  assert.equal(embedUrl("https://www.youtube.com/live/dQw4w9WgXcQ"), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  assert.equal(embedUrl("https://www.youtube.com/@channel"), ""); // no video: opens on YouTube
  assert.equal(embedUrl("https://example.com/x"), "");
  assert.equal(embedUrl("javascript:alert(1)"), "");
});

test("Discord: announces a match going live and its result, once each, nothing from before", async () => {
  const { announcements, isWebhook, nextAnnouncements } = await import("../lib/discord.js");
  const { setMatchLive } = await import("../lib/db.js");
  const { saveKickoffScore, setKickoffMatch } = await import("../lib/kactions.js");
  const db = openDb(":memory:");
  assert.equal(setKickoffMatch(db, { id: "u1-1", a: 1, b: 2 }).ok, true);
  assert.equal(setKickoffMatch(db, { id: "u1-2", a: 3, b: 4 }).ok, true);
  assert.equal(saveKickoffScore(db, { id: "u1-2", sa: 2, sb: 0 }).ok, true);
  assert.deepEqual(nextAnnouncements(db, getState(db)), []); // the first look posts nothing
  assert.deepEqual(nextAnnouncements(db, getState(db)), []);
  assert.equal(setMatchLive(db, { event: "kickoff", id: "u1-1", live: true }).ok, true);
  const live = nextAnnouncements(db, getState(db));
  assert.equal(live.length, 1);
  assert.match(live[0].text, /EN DIRECT : Team Vitality vs Karmine Corp/);
  assert.deepEqual(nextAnnouncements(db, getState(db)), []); // once
  assert.equal(saveKickoffScore(db, { id: "u1-1", sa: 2, sb: 1 }).ok, true);
  const done = nextAnnouncements(db, getState(db));
  assert.equal(done.length, 1);
  assert.match(done[0].text, /Team Vitality 2 – 1 Karmine Corp/);
  assert.equal(announcements(getState(db)).some((a) => a.key === "kickoff:u1-1:l"), false); // no longer live
  assert.equal(isWebhook("https://discord.com/api/webhooks/123/abc-DEF"), true);
  assert.equal(isWebhook("https://evil.test/api/webhooks/123/abc"), false);
});

test("players, MVPs, map statistics, comparison", async () => {
  const { compareTeams, mapStats, mvpRanking, playerIndex, playerLeaders, playerProfile } = await import("../lib/playerstats.js");
  const { setMatchExtra } = await import("../lib/db.js");
  const { saveKickoffScore, setKickoffMatch } = await import("../lib/kactions.js");
  const db = openDb(":memory:");
  assert.equal(setKickoffMatch(db, { id: "u1-1", a: 1, b: 2 }).ok, true);
  assert.equal(saveKickoffScore(db, { id: "u1-1", sa: 2, sb: 1 }).ok, true);
  assert.equal(setKickoffMatch(db, { id: "u1-2", a: 1, b: 2 }).ok, false); // already placed
  assert.equal(setMatchExtra(db, { event: "kickoff", id: "u1-1", mvp: "Jamppi", maps: [{ map: "Ascent", a: 13, b: 9, pick: "a" }, { map: "Bind", a: 5, b: 13, pick: "b" }, { map: "Ascent", a: 13, b: 11, pick: "d" }, { map: "Lotus", a: "", b: "", pick: "" }],
    pstats: [{ name: "Jamppi", k: 40, d: 20, a: 10, acs: 300 }, { name: "avez", k: 30, d: 30, a: 5, acs: 200 }, { name: "", k: "", d: "", a: "", acs: "" }] }).ok, true);
  assert.equal(setMatchExtra(db, { event: "kickoff", id: "u1-2", pstats: [{ name: "x", k: 1, d: "", a: 1, acs: 1 }] }).ok, false); // a line half filled
  assert.equal(setMatchExtra(db, { event: "kickoff", id: "u1-2", pstats: [{ name: "x", k: -1, d: 1, a: 1, acs: 1 }] }).ok, false);
  assert.equal(setMatchExtra(db, { event: "kickoff", id: "u1-3", mvp: "Jamppi" }).ok, true);
  const st = getState(db);
  assert.deepEqual(mvpRanking(st), [{ name: "Jamppi", n: 2 }]);
  assert.deepEqual(mvpRanking(st, "mena"), []);
  const all = mapStats(st, { event: "kickoff" });
  assert.deepEqual(all.map((m) => [m.map, m.played]), [["Ascent", 2], ["Bind", 1]]); // Lotus was not played
  const vit = mapStats(st, { team: "team-vitality" });
  assert.deepEqual(vit.find((m) => m.map === "Ascent"), { map: "Ascent", played: 2, picks: 1, w: 2, l: 0, rf: 26, ra: 20 });
  const kc = mapStats(st, { team: "karmine-corp" });
  assert.deepEqual([kc.find((m) => m.map === "Bind").w, kc.find((m) => m.map === "Bind").picks], [1, 1]);
  const lead = playerLeaders(st);
  assert.deepEqual([lead[0].name, lead[0].acs, lead[0].kd], ["Jamppi", 300, 2]);
  const info = { "team-vitality": { page: "Team Vitality", roster: [{ id: "Jamppi", name: "Elias Olkkonen", cc: "fi", join: "2025-11-23", captain: true }] } };
  assert.equal(playerIndex(st, info).jamppi.realName, "Elias Olkkonen");
  const p = playerProfile(st, info, "jamppi");
  assert.equal(p.team, "Team Vitality");
  assert.equal(p.mvps.length, 2);
  assert.equal(p.lines[0].opponent.name, "Karmine Corp");
  assert.equal(p.totals.acs, 300);
  assert.equal(playerProfile(st, info, "nobody"), null);
  const c = compareTeams(st, { name: "Team Vitality" }, { name: "Karmine Corp" });
  assert.deepEqual([c.a.w, c.a.l, c.b.w, c.b.l, c.a.mw, c.a.ml], [1, 0, 0, 1, 2, 1]);
  assert.deepEqual(c.h2h, { a: 1, b: 0 });
  assert.deepEqual(compareTeams(st, { name: "Team Vitality" }, { name: "Karmine Corp" }, "u1-1").h2h, { a: 0, b: 0 }); // this match left out
});

test("news and predictions", async () => {
  const { getNews, listNews, removeNews, saveNews, listVoters, myPredictions, predictionRanking, removeVoter, savePrediction, openForPrediction } = await import("../lib/community.js");
  const { setMatchTime } = await import("../lib/db.js");
  const { saveKickoffScore, setKickoffMatch } = await import("../lib/kactions.js");
  const { recordAction, undoLast } = await import("../lib/undo.js");
  const db = openDb(":memory:");
  // news
  assert.equal(saveNews(db, { title: "", body: "x" }).ok, false);
  assert.equal(saveNews(db, { title: "Titre", body: "Texte", who: "Léa" }).ok, true);
  recordAction(db, "News published.");
  const id = listNews(db)[0].id;
  assert.equal(saveNews(db, { id, title: "Autre", body: "Texte" }).ok, true);
  recordAction(db, "News saved.");
  assert.equal(getNews(db, id).title, "Autre");
  assert.equal(getState(db).news[0].title, "Autre");
  undoLast(db); // news can be undone too
  assert.equal(getNews(db, id).title, "Titre");
  assert.equal(removeNews(db, { id }).ok, true);
  assert.equal(getNews(db, id), null);
  assert.equal(removeNews(db, { id }).ok, false);
  // predictions
  const A = "a".repeat(30);
  const B = "b".repeat(30);
  const now = Date.parse("2027-01-15T12:00:00Z");
  assert.equal(setKickoffMatch(db, { id: "u1-1", a: 1, b: 2 }).ok, true);
  assert.equal(setKickoffMatch(db, { id: "u1-2", a: 3, b: 4 }).ok, true);
  assert.equal(setMatchTime(db, { event: "kickoff", id: "u1-2", at: "2027-01-15T10:00:00Z" }).ok, true);
  const p = (token, name, id2, pick) => savePrediction(db, getState(db), { token, name, event: "kickoff", id: id2, pick }, now);
  assert.equal(p("short", "Ana", "u1-1", "Team Vitality").ok, false); // no real token
  assert.equal(p(A, "x", "u1-1", "Team Vitality").ok, false); // name too short
  assert.equal(p(A, "Ana", "u1-1", "Fnatic").ok, false); // not in this match
  assert.equal(p(A, "Ana", "u1-2", "FUT Esport").ok, false); // its time has passed
  assert.equal(p(A, "Ana", "u1-1", "Team Vitality").ok, true);
  assert.equal(p(B, "ANA", "u1-1", "Karmine Corp").ok, false); // name taken
  assert.equal(p(B, "Bob", "u1-1", "Karmine Corp").ok, true);
  assert.equal(p(A, "", "u1-1", "Karmine Corp").ok, true); // changes the pick, the name is known
  assert.equal(p(A, "", "u1-1", "Team Vitality").ok, true);
  assert.deepEqual(myPredictions(db, A), { name: "Ana", picks: { "kickoff:u1-1": "Team Vitality" } });
  assert.deepEqual(myPredictions(db, "nope"), { name: "", picks: {} });
  assert.ok(!JSON.stringify(db.prepare("SELECT * FROM voters").all()).includes(A)); // the token is not kept as is
  assert.deepEqual(predictionRanking(db, getState(db)), []); // no result yet
  assert.equal(saveKickoffScore(db, { id: "u1-1", sa: 2, sb: 0 }).ok, true);
  assert.equal(p(A, "", "u1-1", "Karmine Corp").ok, false); // played: closed
  assert.deepEqual(predictionRanking(db, getState(db)), [{ name: "Ana", good: 1, total: 1 }, { name: "Bob", good: 0, total: 1 }]);
  assert.equal(listVoters(db).length, 2);
  assert.equal(removeVoter(db, { name: "Bob" }).ok, true);
  assert.equal(predictionRanking(db, getState(db)).length, 1);
  assert.equal(openForPrediction({ a: {}, b: { name: "x" } }), false);
});

test("scheduling a whole round, and reading the oldest team information again", async () => {
  const { planRound } = await import("../lib/schedule.js");
  const { setMatchTimes } = await import("../lib/db.js");
  const { nextStale } = await import("../lib/teamfetch.js");
  assert.deepEqual(planRound(["a", "b", "c"], "2027-01-15T10:00:00Z", 120, 2).map((x) => x.at), ["2027-01-15T10:00:00.000Z", "2027-01-15T10:00:00.000Z", "2027-01-15T12:00:00.000Z"]);
  assert.equal(planRound(["a"], "demain"), null);
  assert.equal(planRound(["a"], "2027-01-15T10:00:00Z", -5), null);
  const db = openDb(":memory:");
  assert.equal(setMatchTimes(db, { event: "kickoff", items: [{ id: "u1-1", at: "2027-01-15T10:00:00Z" }, { id: "u1-2", at: "2027-01-15T12:00:00Z" }] }).ok, true);
  assert.equal(Object.keys(getState(db).times.kickoff).length, 2);
  assert.equal(setMatchTimes(db, { event: "kickoff", items: [{ id: "u1-3", at: "2027-01-15T10:00:00Z" }, { id: "nope", at: "2027-01-15T12:00:00Z" }] }).ok, false);
  assert.equal(getState(db).times.kickoff["u1-3"], undefined); // all or none
  const now = Date.parse("2026-11-20T00:00:00Z");
  const info = { a: { page: "A", fetched: "2026-11-01T00:00:00Z" }, b: { page: "B", fetched: "2026-10-01T00:00:00Z" }, c: { page: "C", fetched: "2026-11-19T00:00:00Z" }, d: { page: "", fetched: "2026-01-01T00:00:00Z" } };
  assert.equal(nextStale(["a", "b", "c", "d"], info, now), "b"); // the oldest
  assert.equal(nextStale(["c", "d"], info, now), undefined); // recent, or no page
});
