import {
  cleanArabicWord,
  spellingKey,
  lookupArabicWord,
  eligibleWords,
  chooseWordLetter,
  wordInCategory,
  wordHint,
  WORD_CATEGORIES,
  WORD_TOPICS,
  type WordCategory,
  type WordTopic,
} from "./word-duel-lexicon";

export { WORD_CATEGORIES, WORD_TOPICS } from "./word-duel-lexicon";
export type { WordTopic } from "./word-duel-lexicon";
export const WORD_TURN_MS = 30_000;
export type WordOptions = { rounds: 3 | 5 | 10; topic: WordTopic };
export type WordPlayer = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  joinedAt?: number;
  isBot?: boolean;
  connected?: boolean;
  difficulty?: "easy" | "medium" | "hard";
};
export type WordAction = { type: string; playerId: string; value?: Record<string, unknown> };
export type PlayedWord = {
  id: number;
  playerId: string;
  word: string;
  key: string;
  firstLetter: string;
  lastLetter: string;
  round: number;
  at: number;
};
export type WordStats = { words: number; skips: number; timeouts: number; hints: number };
export type WordEvent = {
  sequence: number;
  type: "word" | "skip" | "timeout" | "hint";
  playerId: string;
  at: number;
  wordId?: number;
  chainRestarted?: boolean;
};
export type WordData = {
  roster: WordPlayer[];
  options: WordOptions;
  currentCategory: WordCategory;
  starterIndex: number;
  turnIndex: number;
  roundNumber: number;
  turnsInRound: number;
  currentLetter: string;
  words: PlayedWord[];
  consecutivePasses: number;
  hintUsed: Record<string, boolean>;
  hints: Record<string, { text: string; turnSequence: number }>;
  stats: Record<string, WordStats>;
  sessionWins: Record<string, number>;
  winnerIds: string[];
  matchNumber: number;
  endedEarly: boolean;
  turnSequence: number;
  turnStartedAt: number;
  turnDeadline: number | null;
  eventSequence: number;
  event: WordEvent | null;
  lastAction: string;
};
type WordState = {
  phase: "lobby" | "playing" | "results";
  round: number;
  scores: Record<string, number>;
  data: Record<string, unknown>;
};
const wrap = (i: number, n: number) => (n ? ((i % n) + n) % n : 0);
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const freshStats = (): WordStats => ({ words: 0, skips: 0, timeouts: 0, hints: 0 });
export function normalizeWordOptions(value?: Partial<WordOptions>): WordOptions {
  return {
    rounds: [3, 5, 10].includes(Number(value?.rounds)) ? (Number(value?.rounds) as 3 | 5 | 10) : 5,
    topic: WORD_TOPICS.some((t) => t.id === value?.topic) ? value!.topic! : "general",
  };
}
export function wordRoundCategory(options: WordOptions, round: number): WordCategory {
  return options.topic === "varied"
    ? (["animals", "foods", "cities"] as const)[(round - 1) % 3]
    : options.topic;
}
export function getWordParticipants<T extends WordPlayer>(
  data: Record<string, unknown>,
  live: T[],
): T[] {
  if (!Array.isArray(data.roster) || !data.roster.length) return live;
  return data.roster.map((saved: T) => {
    const current = live.find((p) => p.id === saved.id);
    return {
      ...saved,
      ...current,
      joinedAt: saved.joinedAt,
      connected: Boolean(saved.isBot || current),
    };
  });
}
export function initialWordData(
  players: WordPlayer[],
  starterIndex = 0,
  options?: Partial<WordOptions>,
  now = Date.now(),
): WordData {
  const selected = normalizeWordOptions(options);
  const category = wordRoundCategory(selected, 1);
  return {
    roster: players.map((p) => ({ ...p })),
    options: selected,
    currentCategory: category,
    starterIndex: wrap(starterIndex, players.length),
    turnIndex: wrap(starterIndex, players.length),
    roundNumber: 1,
    turnsInRound: 0,
    currentLetter: chooseWordLetter(new Set(), category),
    words: [],
    consecutivePasses: 0,
    hintUsed: {},
    hints: {},
    stats: Object.fromEntries(players.map((p) => [p.id, freshStats()])),
    sessionWins: Object.fromEntries(players.map((p) => [p.id, 0])),
    winnerIds: [],
    matchNumber: 1,
    endedEarly: false,
    turnSequence: 1,
    turnStartedAt: now,
    turnDeadline: now + WORD_TURN_MS,
    eventSequence: 0,
    event: null,
    lastAction: "بدأ سجال الحروف",
  };
}
export type WordValidation =
  | { ok: true; word: string; key: string; firstLetter: string; lastLetter: string }
  | { ok: false; reason: string };
export function validateWord(data: WordData, input: string): WordValidation {
  const word = cleanArabicWord(input);
  if (
    !word ||
    word.length > 40 ||
    !/^[\u0621-\u064a\u0671]+(?: [\u0621-\u064a\u0671]+)*$/.test(word) ||
    spellingKey(word).length < 2
  )
    return { ok: false, reason: "اكتب كلمة عربية من حرفين أو أكثر." };
  const key = spellingKey(word);
  const required = spellingKey(data.currentLetter);
  if (!key.startsWith(required))
    return { ok: false, reason: `ابدأ الكلمة بحرف «${data.currentLetter}».` };
  const entry = lookupArabicWord(word);
  if (!entry) return { ok: false, reason: "ما لقينا هذه الكلمة. جرّب كلمة أخرى." };
  if (data.words.some((w) => w.key === entry.key))
    return { ok: false, reason: "هذه الكلمة استُخدمت قبل." };
  if (!wordInCategory(entry.key, data.currentCategory))
    return { ok: false, reason: `اختر كلمة من فئة «${WORD_CATEGORIES[data.currentCategory]}».` };
  return { ok: true, word, key: entry.key, firstLetter: key[0], lastLetter: entry.key.slice(-1) };
}
function beginTurn(data: WordData, now: number) {
  data.turnSequence += 1;
  data.turnStartedAt = now;
  data.turnDeadline = now + WORD_TURN_MS;
}
function record(
  data: WordData,
  type: WordEvent["type"],
  playerId: string,
  now: number,
  wordId?: number,
) {
  data.eventSequence += 1;
  data.event = { sequence: data.eventSequence, type, playerId, at: now, wordId };
}
function finish<T extends WordState>(
  state: T,
  data: WordData,
  scores: Record<string, number>,
  early = false,
): T {
  const best = Math.max(0, ...data.roster.map((p) => scores[p.id] ?? 0));
  data.winnerIds = best
    ? data.roster.filter((p) => (scores[p.id] ?? 0) === best).map((p) => p.id)
    : [];
  if (data.winnerIds.length === 1)
    data.sessionWins[data.winnerIds[0]] = (data.sessionWins[data.winnerIds[0]] ?? 0) + 1;
  data.turnDeadline = null;
  data.endedEarly = early;
  data.lastAction =
    data.winnerIds.length === 1 ? "حُسم السجال بأعلى النقاط" : "انتهى السجال بالتعادل";
  return { ...state, phase: "results", data, scores };
}
function advance<T extends WordState>(
  state: T,
  data: WordData,
  scores: Record<string, number>,
  now: number,
): T {
  data.turnsInRound += 1;
  const used = new Set(data.words.map((w) => w.key));
  if (data.turnsInRound >= data.roster.length) {
    if (data.roundNumber >= data.options.rounds) return finish(state, data, scores);
    data.roundNumber += 1;
    data.turnsInRound = 0;
    data.turnIndex = wrap(data.starterIndex + data.roundNumber - 1, data.roster.length);
    const category = wordRoundCategory(data.options, data.roundNumber);
    if (category !== data.currentCategory) {
      data.currentCategory = category;
      data.currentLetter = chooseWordLetter(used, category);
      data.consecutivePasses = 0;
      if (data.event) data.event.chainRestarted = true;
    }
  } else data.turnIndex = wrap(data.turnIndex + 1, data.roster.length);
  if (
    data.consecutivePasses >= data.roster.length ||
    !eligibleWords(data.currentLetter, used, data.currentCategory).length
  ) {
    data.currentLetter = chooseWordLetter(used, data.currentCategory);
    data.consecutivePasses = 0;
    if (data.event) data.event.chainRestarted = true;
    data.lastAction += " · بدأنا حرفًا جديدًا";
  }
  beginTurn(data, now);
  return { ...state, data, scores };
}
function pass<T extends WordState>(
  state: T,
  data: WordData,
  player: WordPlayer,
  now: number,
  timedOut: boolean,
): T {
  data.stats[player.id] ??= freshStats();
  if (timedOut) data.stats[player.id].timeouts += 1;
  else data.stats[player.id].skips += 1;
  data.consecutivePasses += 1;
  data.lastAction = timedOut
    ? `انتهى وقت ${player.name} وانتقل الدور`
    : `${player.name} تخطّى الدور`;
  record(data, timedOut ? "timeout" : "skip", player.id, now);
  return advance(state, data, { ...state.scores }, now);
}
function clock<T extends WordState>(state: T, players: WordPlayer[], now: number): T {
  if (typeof state.data.turnDeadline === "number") return state;
  if (!Array.isArray(state.data.roster)) {
    const legacy = state.data;
    const data = initialWordData(players, Number(legacy.turnIndex ?? 0), undefined, now);
    const oldWords = Array.isArray(legacy.words) ? legacy.words : [];
    data.words = oldWords
      .filter((w) => typeof w.word === "string")
      .map((w, i) => ({
        id: i + 1,
        playerId: String(w.playerId),
        word: cleanArabicWord(w.word),
        key: spellingKey(w.word),
        firstLetter: spellingKey(w.word)[0],
        lastLetter: spellingKey(w.word).slice(-1),
        round: 1,
        at: now,
      }));
    for (const w of data.words) if (data.stats[w.playerId]) data.stats[w.playerId].words += 1;
    const letter = spellingKey(String(legacy.currentLetter ?? ""));
    if (letter.length === 1) data.currentLetter = letter;
    data.lastAction = "استعدنا السجال وبدأ مؤقت الدور";
    return { ...state, data };
  }
  const data = copy(state.data) as WordData;
  beginTurn(data, now);
  return { ...state, data };
}
export function reduceWordDuel<T extends WordState>(
  state: T,
  action: WordAction,
  live: WordPlayer[],
  now = Date.now(),
): T {
  if (state.phase !== "playing") return state;
  const players = getWordParticipants(state.data, live);
  if (players.length < 2) return state;
  if (action.type === "word-clock") return clock(state, players, now);
  const source = state.data as WordData;
  if (!Array.isArray(source.roster) || typeof source.turnDeadline !== "number") return state;
  const v = action.value;
  if (!v || v.turnSequence !== source.turnSequence || v.round !== state.round) return state;
  const player = players[source.turnIndex];
  if (!player || player.id !== action.playerId || now < source.turnStartedAt) return state;
  if (!["word-submit", "word-skip", "word-hint", "word-timeout"].includes(action.type))
    return state;
  if (
    action.type === "word-timeout" &&
    (v.deadline !== source.turnDeadline || now < source.turnDeadline)
  )
    return state;
  const data = copy(source);
  if (now >= source.turnDeadline) return pass(state, data, player, now, true);
  if (action.type === "word-skip") return pass(state, data, player, now, false);
  if (action.type === "word-hint") {
    if (data.hintUsed[player.id]) return state;
    const candidate = eligibleWords(
      data.currentLetter,
      new Set(data.words.map((w) => w.key)),
      data.currentCategory,
    ).find((w) => w.key.length >= 3);
    if (!candidate) return state;
    data.hintUsed[player.id] = true;
    data.hints[player.id] = { text: wordHint(candidate), turnSequence: data.turnSequence };
    data.stats[player.id].hints += 1;
    record(data, "hint", player.id, now);
    return { ...state, data };
  }
  const result = validateWord(data, typeof v.word === "string" ? v.word : "");
  if (!result.ok) return state;
  const word = {
    id: data.words.length + 1,
    playerId: player.id,
    ...result,
    round: data.roundNumber,
    at: now,
  };
  data.words.push(word);
  data.currentLetter = result.lastLetter;
  data.consecutivePasses = 0;
  data.stats[player.id].words += 1;
  data.lastAction = `${player.name} كتب «${result.word}»`;
  record(data, "word", player.id, now, word.id);
  const scores = { ...state.scores, [player.id]: (state.scores[player.id] ?? 0) + 1 };
  return advance(state, data, scores, now);
}
export function finishWordDuel<T extends WordState>(state: T): T {
  if (state.phase !== "playing" || !Array.isArray(state.data.roster)) return state;
  return finish(state, copy(state.data) as WordData, { ...state.scores }, true);
}
export function rematchWordDuel<T extends WordState>(
  state: T,
  live: WordPlayer[],
  now = Date.now(),
): T {
  if (state.phase !== "results") return state;
  const players = getWordParticipants(state.data, live);
  if (players.length < 2) return state;
  const old = state.data as WordData;
  const data = initialWordData(players, Number(old.starterIndex ?? 0) + 1, old.options, now);
  data.sessionWins = { ...old.sessionWins };
  data.matchNumber = Number(old.matchNumber ?? 1) + 1;
  data.turnSequence = Number(old.turnSequence ?? 0) + 1;
  return {
    ...state,
    phase: "playing",
    round: state.round + 1,
    scores: Object.fromEntries(players.map((p) => [p.id, 0])),
    data,
  };
}
export function chooseWordBotAction(state: WordState, live: WordPlayer[]): WordAction | null {
  if (state.phase !== "playing" || !Array.isArray(state.data.roster)) return null;
  const data = state.data as WordData;
  const player = getWordParticipants(state.data, live)[data.turnIndex];
  if (!player?.isBot) return null;
  const used = new Set(data.words.map((w) => w.key));
  const candidates = eligibleWords(data.currentLetter, used, data.currentCategory);
  if (!candidates.length || (player.difficulty === "easy" && Math.random() < 0.18))
    return { type: "word-skip", playerId: player.id };
  let chosen;
  if (player.difficulty === "hard") {
    chosen = candidates.slice().sort((a, b) => {
      const aNext = eligibleWords(
        a.key.slice(-1),
        new Set([...used, a.key]),
        data.currentCategory,
      ).length;
      const bNext = eligibleWords(
        b.key.slice(-1),
        new Set([...used, b.key]),
        data.currentCategory,
      ).length;
      return (aNext || 999) - (bNext || 999) || b.key.length - a.key.length;
    })[0];
  } else if (player.difficulty === "easy")
    chosen = candidates.slice().sort((a, b) => a.key.length - b.key.length)[0];
  else chosen = candidates[Math.floor(Math.random() * candidates.length)];
  return { type: "word-submit", playerId: player.id, value: { word: chosen.word } };
}
