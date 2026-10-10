import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const temp = mkdtempSync(path.join(tmpdir(), "sijal-rules-"));
writeFileSync(path.join(temp, "package.json"), '{"type":"module"}');
for (const [source, target] of [
  ["src/components/entertainment/word-duel-lexicon.ts", "lexicon.js"],
  ["src/components/entertainment/word-duel-engine.ts", "engine.js"],
  ["src/data/sijal-arabic-words.ts", "dictionary.js"],
]) {
  const text = readFileSync(new URL(`../${source}`, import.meta.url), "utf8")
    .replaceAll('"./word-duel-lexicon"', '"./lexicon.js"')
    .replaceAll('"../../data/sijal-arabic-words"', '"./dictionary.js"');
  writeFileSync(
    path.join(temp, target),
    ts.transpileModule(text, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText,
  );
}
const lexicon = await import(pathToFileURL(path.join(temp, "lexicon.js")));
const engine = await import(pathToFileURL(path.join(temp, "engine.js")));
const {
  initialWordData,
  reduceWordDuel,
  rematchWordDuel,
  finishWordDuel,
  validateWord,
  getWordParticipants,
  chooseWordBotAction,
  normalizeWordOptions,
} = engine;
await lexicon.ensureWordDictionary();
after(() => rmSync(temp, { recursive: true, force: true }));
const players = ["خالد", "عبدالله", "عمر", "نواف"].map((name, i) => ({
  id: `p${i}`,
  name,
  joinedAt: 100 + i,
  ready: true,
  avatarUrl: null,
}));
const start = (options = { rounds: 3, topic: "general" }, roster = players) => ({
  phase: "playing",
  round: 0,
  scores: Object.fromEntries(roster.map((p) => [p.id, 0])),
  data: initialWordData(roster, 0, options, 1000),
  bots: roster.filter((p) => p.isBot),
});
const active = (s) => s.data.roster[s.data.turnIndex];
const stamp = (s, value = {}) => ({ ...value, turnSequence: s.data.turnSequence, round: s.round });
const apply = (s, type, value = {}, now = s.data.turnStartedAt + 100, live = players) =>
  reduceWordDuel(s, { type, playerId: active(s).id, value: stamp(s, value) }, live, now);
const legal = (s) =>
  lexicon.eligibleWords(
    s.data.currentLetter,
    new Set(s.data.words.map((w) => w.key)),
    s.data.currentCategory,
  )[0];
const submit = (s) => apply(s, "word-submit", { word: legal(s).word });

test("all requested spelling variants share lookup, chaining and duplicate identity", () => {
  for (const variants of [
    ["مسؤول", "مسوول", "مسئول"],
    ["خطأ", "خطا"],
    ["بطئ", "بطيء", "بطيي"],
    ["مدرسة", "مدرسه"],
    ["رُؤْية", "رويه"],
    ["إيمان", "ايمان"],
  ]) {
    const keys = variants.map(lexicon.spellingKey);
    assert.ok(
      keys.every((key) => key === keys[0]),
      variants.join("/"),
    );
    for (const word of variants) {
      const s = start();
      s.data.currentLetter = keys[0][0];
      assert.equal(validateWord(s.data, word).ok, true, word);
      const accepted = apply(s, "word-submit", { word });
      assert.equal(accepted.scores.p0, 1);
      assert.equal(accepted.data.words[0].word, lexicon.cleanArabicWord(word));
      const again = structuredClone(accepted);
      again.data.currentLetter = keys[0][0];
      for (const spelling of variants)
        assert.match(validateWord(again.data, spelling).reason, /استُخدمت/);
    }
  }
  assert.notEqual(
    lexicon.spellingKey("حي"),
    lexicon.spellingKey("حيي"),
    "no generic repeated-letter collapse",
  );
});
test("real words outside the bot list are accepted but nonsense and digits are rejected", () => {
  for (const word of [
    "استطاعة",
    "ديمقراطية",
    "استقلال",
    "اتصالات",
    "الاتصالات",
    "المدرسة",
    "الكتاب",
  ]) {
    const s = start();
    s.data.currentLetter = lexicon.spellingKey(word)[0];
    assert.equal(validateWord(s.data, word).ok, true, word);
  }
  const s = start();
  s.data.currentLetter = "م";
  for (const word of ["م123ار", "م", "مززظضضضقققق", "م!", "hello", "م🙂"]) {
    assert.equal(validateWord(s.data, word).ok, false);
    assert.equal(apply(s, "word-submit", { word }), s);
  }
  assert.equal(apply(s, "word-submit", { word: "بحر" }), s, "wrong first letter");
});
test("each turn has 30 seconds; one timeout consumes one turn without adding a point", () => {
  const s = start();
  assert.equal(s.data.turnDeadline - s.data.turnStartedAt, 30000);
  const early = apply(
    s,
    "word-timeout",
    { deadline: s.data.turnDeadline },
    s.data.turnDeadline - 1,
  );
  assert.equal(early, s);
  const expired = apply(s, "word-timeout", { deadline: s.data.turnDeadline }, s.data.turnDeadline);
  assert.equal(expired.data.turnIndex, 1);
  assert.equal(expired.data.stats.p0.timeouts, 1);
  assert.equal(expired.scores.p0, 0);
  assert.equal(expired.data.turnDeadline - expired.data.turnStartedAt, 30000);
  const stale = {
    type: "word-timeout",
    playerId: "p0",
    value: stamp(s, { deadline: s.data.turnDeadline }),
  };
  assert.equal(reduceWordDuel(expired, stale, players, expired.data.turnStartedAt), expired);
});
test("late answers become a single timeout and delayed or forged actions cannot affect the next turn", () => {
  const s = start();
  const word = legal(s).word;
  const late = apply(s, "word-submit", { word }, s.data.turnDeadline + 20);
  assert.equal(late.data.words.length, 0);
  assert.equal(late.data.stats.p0.timeouts, 1);
  const packet = { type: "word-submit", playerId: "p0", value: stamp(s, { word }) };
  assert.equal(reduceWordDuel(late, packet, players, late.data.turnStartedAt + 50), late);
  assert.equal(reduceWordDuel(s, { ...packet, playerId: "p2" }, players, 1100), s);
  assert.equal(reduceWordDuel(s, { ...packet, value: { word } }, players, 1100), s);
  assert.equal(
    reduceWordDuel(s, { ...packet, value: { ...packet.value, round: 99 } }, players, 1100),
    s,
  );
  assert.equal(apply(s, "word-submit", { word }, s.data.turnStartedAt - 1), s);
});
test("hint is partial, once per match, and preserves the current deadline and word chain", () => {
  const s = start();
  s.data.currentLetter = "م";
  const hint = apply(s, "word-hint");
  assert.equal(hint.data.turnSequence, s.data.turnSequence);
  assert.equal(hint.data.turnDeadline, s.data.turnDeadline);
  assert.equal(hint.data.turnIndex, s.data.turnIndex);
  assert.deepEqual(hint.data.words, s.data.words);
  assert.equal(hint.data.hintUsed.p0, true);
  assert.match(hint.data.hints.p0.text, /حرفها الثاني/);
  assert.equal(hint.data.stats.p0.hints, 1);
  assert.equal(apply(hint, "word-hint"), hint);
  let next = hint;
  for (let i = 0; i < 4; i++) next = apply(next, "word-skip");
  // The next round rotates the first player; bring p0 to their next turn.
  while (active(next).id !== "p0") next = apply(next, "word-skip");
  assert.equal(apply(next, "word-hint"), next);
});
test("rounds give every seat one turn and rotate the first player; joint winners gain no session win", () => {
  let s = start();
  const turns = [];
  while (s.phase === "playing") {
    turns.push([s.data.roundNumber, active(s).id]);
    s = submit(s);
  }
  assert.equal(turns.length, 12);
  for (let round = 1; round <= 3; round++) {
    const seats = turns.filter(([r]) => r === round).map(([, id]) => id);
    assert.equal(new Set(seats).size, 4);
    assert.equal(seats[0], players[round - 1].id);
  }
  assert.deepEqual(s.scores, { p0: 3, p1: 3, p2: 3, p3: 3 });
  assert.deepEqual(
    s.data.winnerIds,
    players.map((p) => p.id),
  );
  assert.ok(Object.values(s.data.sessionWins).every((wins) => wins === 0));
  assert.equal(s.data.turnDeadline, null);
});
test("a unique winner earns one session win; rematch resets points and hints but preserves roster, bots and options", () => {
  const roster = players.map((p, i) =>
    i ? { ...p, isBot: true, difficulty: ["easy", "medium", "hard"][i - 1] } : p,
  );
  let s = start({ rounds: 3, topic: "animals" }, roster);
  while (s.phase === "playing") s = active(s).id === "p0" ? submit(s) : apply(s, "word-skip");
  assert.deepEqual(s.data.winnerIds, ["p0"]);
  assert.equal(s.data.sessionWins.p0, 1);
  assert.equal(finishWordDuel(s), s, "no second win increment");
  const next = rematchWordDuel(s, [players[0]], 900000);
  assert.deepEqual(
    next.data.roster.map((p) => p.id),
    roster.map((p) => p.id),
  );
  assert.deepEqual(next.bots, s.bots);
  assert.deepEqual(next.data.options, s.data.options);
  assert.equal(next.data.matchNumber, 2);
  assert.equal(next.data.sessionWins.p0, 1);
  assert.deepEqual(next.data.words, []);
  assert.deepEqual(next.data.hintUsed, {});
  assert.ok(Object.values(next.scores).every((score) => score === 0));
  assert.equal(next.data.turnDeadline, 930000);
  assert.ok(next.data.turnSequence > s.data.turnSequence);
});
test("category matches reject unrelated real words and varied matches change category at round boundaries", () => {
  const s = start({ rounds: 3, topic: "animals" });
  s.data.currentLetter = "م";
  assert.equal(validateWord(s.data, "ماعز").ok, true);
  assert.equal(validateWord(s.data, "مسؤول").ok, false);
  s.data.currentLetter = "ا";
  assert.equal(validateWord(s.data, "الفيل").ok, true);
  let varied = start({ rounds: 3, topic: "varied" });
  for (const category of ["animals", "foods", "cities"]) {
    assert.equal(varied.data.currentCategory, category);
    for (let i = 0; i < players.length; i++) varied = submit(varied);
  }
  assert.equal(varied.phase, "results");
});
test("an exhausted letter or a full pass cycle starts a playable new letter without repeating a word", () => {
  let s = start();
  s.data.currentLetter = "ء";
  s = apply(s, "word-skip");
  assert.ok(legal(s));
  assert.equal(s.data.event.chainRestarted, true);
  const previous = submit(s);
  const used = previous.data.words[0].key;
  let passed = previous;
  for (let i = 0; i < players.length; i++) passed = apply(passed, "word-skip");
  assert.equal(passed.data.event.chainRestarted, true);
  assert.ok(
    lexicon
      .eligibleWords(passed.data.currentLetter, new Set([used]), passed.data.currentCategory)
      .every((w) => w.key !== used),
  );
});
test("reconnecting players and a successor host preserve seats and deadlines", () => {
  const s = submit(start());
  const live = [players[3], { ...players[1], joinedAt: 999999 }, players[2]];
  const restored = getWordParticipants(s.data, live);
  assert.deepEqual(
    restored.map((p) => p.id),
    players.map((p) => p.id),
  );
  assert.equal(restored[0].connected, false);
  assert.equal(restored[1].joinedAt, 101);
  const same = reduceWordDuel(s, { type: "word-clock", playerId: "p1" }, live, 200000);
  assert.equal(same, s);
  assert.equal(same.data.turnDeadline, s.data.turnDeadline);
  const timed = apply(
    s,
    "word-timeout",
    { deadline: s.data.turnDeadline },
    s.data.turnDeadline,
    live,
  );
  assert.equal(timed.data.turnIndex, 2);
});
test("legacy rooms gain a clock while preserving words and points", () => {
  const s = {
    phase: "playing",
    round: 0,
    scores: { p0: 2 },
    data: { currentLetter: "هـ", turnIndex: 1, words: [{ playerId: "p0", word: "مدرسة" }] },
  };
  const upgraded = reduceWordDuel(s, { type: "word-clock", playerId: "p1" }, players, 5000);
  assert.equal(upgraded.data.turnDeadline, 35000);
  assert.equal(upgraded.data.currentLetter, "ه");
  assert.equal(upgraded.data.words[0].key, "مدرسه");
  assert.deepEqual(upgraded.scores, s.scores);
  assert.equal(upgraded.data.turnIndex, 1);
  assert.equal(upgraded.data.stats.p0.words, 1);
});
test("all three bot levels submit valid unrepeated words in every category", () => {
  for (const difficulty of ["easy", "medium", "hard"]) {
    for (const topic of ["general", "animals", "foods", "cities", "varied"]) {
      const roster = players.map((p) => ({ ...p, isBot: true, difficulty }));
      let s = start({ rounds: 5, topic }, roster);
      let turns = 0;
      while (s.phase === "playing") {
        const action = chooseWordBotAction(s, roster);
        assert.ok(action);
        if (action.type === "word-submit")
          assert.equal(validateWord(s.data, action.value.word).ok, true);
        const next = reduceWordDuel(
          s,
          { ...action, value: stamp(s, action.value) },
          roster,
          s.data.turnStartedAt + 100,
        );
        assert.notEqual(next, s);
        s = next;
        turns++;
      }
      assert.equal(turns, 20);
      assert.equal(new Set(s.data.words.map((w) => w.key)).size, s.data.words.length);
    }
  }
});
test("eight players can complete ten rounds in each category with unique valid words", () => {
  const roster = Array.from({ length: 8 }, (_, i) => ({
    id: `p${i}`,
    name: `لاعب ${i}`,
    joinedAt: i,
    isBot: true,
    difficulty: "hard",
  }));
  for (const topic of ["general", "animals", "foods", "cities", "varied"]) {
    let s = start({ rounds: 10, topic }, roster);
    for (let i = 0; i < 80; i++) {
      assert.equal(s.phase, "playing");
      const action = chooseWordBotAction(s, roster);
      assert.equal(action.type, "word-submit", topic);
      assert.equal(validateWord(s.data, action.value.word).ok, true);
      s = reduceWordDuel(
        s,
        { ...action, value: stamp(s, action.value) },
        roster,
        s.data.turnStartedAt + 100,
      );
    }
    assert.equal(s.phase, "results");
    assert.equal(s.data.words.length, 80);
    assert.ok(Object.values(s.scores).every((score) => score === 10));
  }
});
test("options are normalized and early host finish produces the same ranked result", () => {
  assert.deepEqual(normalizeWordOptions({ rounds: 999, topic: "invalid" }), {
    rounds: 5,
    topic: "general",
  });
  const s = submit(start());
  const ended = finishWordDuel(s);
  assert.equal(ended.phase, "results");
  assert.equal(ended.data.endedEarly, true);
  assert.deepEqual(ended.data.winnerIds, ["p0"]);
  assert.equal(ended.data.sessionWins.p0, 1);
  assert.equal(ended.data.turnDeadline, null);
});
