import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Banknote,
  Bot,
  Building2,
  Check,
  ChevronLeft,
  Clipboard,
  Crown,
  Gavel,
  HelpCircle,
  Landmark,
  Link2,
  Loader2,
  LogOut,
  MapPin,
  Maximize2,
  Medal,
  Minimize2,
  Mountain,
  Play,
  RefreshCcw,
  RotateCw,
  Share2,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  Trophy,
  Trash2,
  Trees,
  UserCheck,
  Users,
  Waves,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { TRIVIA_QUESTIONS } from "@/data/trivia-questions";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { cn } from "@/lib/utils";

type GameKey =
  | "uno"
  | "saudi-deal"
  | "word-duel"
  | "baloot"
  | "wheel"
  | "challenge30"
  | "auction"
  | "judge"
  | "trivia";

type RoomPhase = "lobby" | "playing" | "results";
type BotDifficulty = "easy" | "medium" | "hard";

type Player = {
  id: string;
  name: string;
  avatarUrl: string | null;
  ready: boolean;
  joinedAt: number;
  isHost?: boolean;
  isBot?: boolean;
  difficulty?: BotDifficulty;
};

type RoomState = {
  phase: RoomPhase;
  game: GameKey;
  round: number;
  scores: Record<string, number>;
  data: Record<string, any>;
  bots: Player[];
};

type RoomAction = {
  type: string;
  playerId: string;
  value?: any;
};

type RoomPacket =
  | { kind: "request-state"; senderId: string }
  | { kind: "snapshot"; senderId: string; hostId: string; state: RoomState }
  | { kind: "action"; senderId: string; action: RoomAction }
  | { kind: "room-closed"; senderId: string };

type GameMeta = {
  id: GameKey;
  label: string;
  short: string;
  icon: LucideIcon;
  minPlayers: number;
  exactPlayers?: number;
  maxPlayers?: number;
};

const GAMES: GameMeta[] = [
  {
    id: "uno",
    label: "أونو",
    short: "يد خاصة لكل لاعب ومطابقة ألوان وأرقام وأوراق سحب وتخطي.",
    icon: Zap,
    minPlayers: 2,
    maxPlayers: 10,
  },
  {
    id: "saudi-deal",
    label: "سعودي ديل",
    short: "اجمع الأراضي، كوّن ثلاث مجموعات، واستخدم بطاقات الأكشن.",
    icon: Crown,
    minPlayers: 4,
    exactPlayers: 4,
    maxPlayers: 4,
  },
  {
    id: "word-duel",
    label: "سجال الحروف",
    short: "كلمة تبدأ بآخر حرف، والدور ينتقل بين الجوالات.",
    icon: Zap,
    minPlayers: 2,
  },
  {
    id: "trivia",
    label: "بنك الأسئلة",
    short: "كل لاعب يجيب من جواله وتظهر النتائج للجميع.",
    icon: HelpCircle,
    minPlayers: 2,
  },
  {
    id: "judge",
    label: "قاضي الجماعة",
    short: "تصويت سري من كل جوال ثم كشف النتيجة.",
    icon: UserCheck,
    minPlayers: 3,
  },
  {
    id: "challenge30",
    label: "الـ 30 ثانية",
    short: "الكلمة تظهر لصاحب الدور فقط والبقية يخمّنون.",
    icon: Timer,
    minPlayers: 2,
  },
  {
    id: "auction",
    label: "مزاد المعلومات",
    short: "كل لاعب يرسل مزايدته ويختار المضيف الفائز.",
    icon: Gavel,
    minPlayers: 2,
  },
  {
    id: "wheel",
    label: "القرعة",
    short: "قرعة مباشرة بين جميع الموجودين في الغرفة.",
    icon: RotateCw,
    minPlayers: 2,
  },
  {
    id: "baloot",
    label: "البلوت",
    short: "توزيع وشراء صن أو حكم وأكلات بين فريقين من أربعة لاعبين.",
    icon: Target,
    minPlayers: 4,
    exactPlayers: 4,
    maxPlayers: 4,
  },
];

const CHALLENGE_WORDS = [
  "القهوة العربية",
  "السيف",
  "الرياض",
  "نخلة",
  "مجلس العائلة",
  "الصقور",
  "رحلة برية",
  "مناسبة عائلية",
  "التراث",
  "الكرم",
  "العيد",
  "الكعبة",
];

const JUDGE_SCENARIOS = [
  "من أكثر شخص يصل متأخرًا للمناسبات؟",
  "من أكثر شخص يحفظ أسرار العائلة؟",
  "من أول شخص تطلب منه المساعدة؟",
  "من أكثر شخص يصنع أجواءً حلوة في المجلس؟",
  "من أكثر شخص يعرف أخبار العائلة؟",
  "من الأنسب لتنظيم الرحلة القادمة؟",
];

const AUCTION_PROMPTS = [
  "كم مدينة في المملكة زرتها؟",
  "كم اسمًا من أسماء الصحابة تستطيع ذكره؟",
  "كم طبقًا شعبيًا سعوديًا تستطيع تسميته؟",
  "كم دولة عربية تستطيع ذكر عاصمتها؟",
  "كم مثلًا شعبيًا تعرفه؟",
];

const LETTERS = ["ا", "ب", "ت", "ج", "ح", "د", "ر", "س", "ع", "ف", "ق", "ك", "م", "ن", "هـ", "و"];
const SESSION_KEY = "alsaif-live-game-room-v1";

type UnoColor = "red" | "blue" | "green" | "yellow" | "wild";
type UnoCard = {
  id: string;
  color: UnoColor;
  value: string;
};

type DealCard = {
  id: string;
  type: "property" | "money" | "action";
  label: string;
  value: number;
  group?: string;
  action?: "draw2" | "rent" | "steal";
};

type BalootSuit = "spades" | "hearts" | "diamonds" | "clubs";
type BalootCard = {
  id: string;
  suit: BalootSuit;
  rank: "7" | "8" | "9" | "J" | "Q" | "K" | "10" | "A";
};

const UNO_COLORS: Exclude<UnoColor, "wild">[] = ["red", "blue", "green", "yellow"];
const UNO_COLOR_LABELS: Record<Exclude<UnoColor, "wild">, string> = {
  red: "أحمر",
  blue: "أزرق",
  green: "أخضر",
  yellow: "أصفر",
};

const DEAL_GROUPS = [
  { id: "najd", label: "نجد", color: "#a66a1f", size: 2, cities: ["الدرعية", "الرياض"] },
  { id: "hijaz", label: "الحجاز", color: "#245a9b", size: 3, cities: ["مكة المكرمة", "المدينة المنورة", "جدة"] },
  { id: "sharqiya", label: "الشرقية", color: "#087f8c", size: 3, cities: ["الأحساء", "الدمام", "الخبر"] },
  { id: "shamal", label: "الشمال", color: "#7650a8", size: 2, cities: ["العلا", "تبوك"] },
  { id: "janoub", label: "الجنوب", color: "#397b45", size: 3, cities: ["أبها", "جازان", "الباحة"] },
  { id: "wasat", label: "الوسطى", color: "#a8443c", size: 3, cities: ["القصيم", "شقراء", "الخرج"] },
  { id: "sahil", label: "الساحل", color: "#c1652d", size: 2, cities: ["ينبع", "أملج"] },
  { id: "wadi", label: "الوادي", color: "#52636e", size: 2, cities: ["نجران", "وادي الدواسر"] },
] as const;

const BALOOT_SUITS: BalootSuit[] = ["spades", "hearts", "diamonds", "clubs"];
const BALOOT_RANKS: BalootCard["rank"][] = ["7", "8", "9", "J", "Q", "K", "10", "A"];
const BALOOT_SUIT_LABEL: Record<BalootSuit, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};
const BOT_NAMES = ["نواف", "تركي", "سلمان", "فيصل", "مشعل", "راكان", "سعود", "بدر", "فهد", "عبدالعزيز"];
const BOT_WORDS: Record<string, string[]> = {
  ا: ["أمل", "أسد", "أرض"],
  ب: ["باب", "بحر", "برق"],
  ت: ["تمر", "تاريخ", "تفاح"],
  ج: ["جبل", "جسر", "جميل"],
  ح: ["حصان", "حلم", "حديقة"],
  د: ["دار", "درب", "دليل"],
  ر: ["رياض", "ربيع", "رمل"],
  س: ["سيف", "سماء", "سلام"],
  ع: ["علم", "عائلة", "عسل"],
  ف: ["فجر", "فخر", "فرح"],
  ق: ["قمر", "قهوة", "قلب"],
  ك: ["كتاب", "كرم", "كنز"],
  م: ["مجلس", "مطر", "مجد"],
  ن: ["نجم", "نخلة", "نور"],
  هـ: ["هدية", "هلال", "هواء"],
  ه: ["هدية", "هلال", "هواء"],
  و: ["وطن", "ورد", "وفاء"],
};

function shuffle<T>(items: T[]): T[] {
  const copy = items.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function copyData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildUnoDeck(): UnoCard[] {
  const cards: UnoCard[] = [];
  let id = 0;
  UNO_COLORS.forEach((color) => {
    cards.push({ id: `uno-${id++}`, color, value: "0" });
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "skip", "reverse", "draw2"].forEach((value) => {
      cards.push({ id: `uno-${id++}`, color, value });
      cards.push({ id: `uno-${id++}`, color, value });
    });
  });
  for (let index = 0; index < 4; index += 1) {
    cards.push({ id: `uno-${id++}`, color: "wild", value: "wild" });
    cards.push({ id: `uno-${id++}`, color: "wild", value: "wild4" });
  }
  return shuffle(cards);
}

function initialUnoData(players: Player[]) {
  const deck = buildUnoDeck();
  const hands: Record<string, UnoCard[]> = {};
  players.forEach((player) => {
    hands[player.id] = deck.splice(0, 7);
  });
  let firstIndex = deck.findIndex((card) => card.color !== "wild");
  if (firstIndex < 0) firstIndex = 0;
  const [first] = deck.splice(firstIndex, 1);
  return {
    hands,
    drawPile: deck,
    discard: [first],
    currentColor: first.color,
    turnIndex: 0,
    direction: 1,
    drawnCardId: null,
    unoCalled: {},
    winnerId: null,
  };
}

function buildDealDeck(): DealCard[] {
  const cards: DealCard[] = [];
  let id = 0;
  DEAL_GROUPS.forEach((group) => {
    for (let index = 0; index < group.size * 2; index += 1) {
      cards.push({
        id: `deal-${id++}`,
        type: "property",
        label: group.cities[index % group.cities.length],
        value: Math.max(1, group.size - 1),
        group: group.id,
      });
    }
  });
  [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 4, 4, 5, 5, 10].forEach((value) => {
    cards.push({ id: `deal-${id++}`, type: "money", label: `${value} مليون`, value });
  });
  for (let index = 0; index < 6; index += 1) {
    cards.push({ id: `deal-${id++}`, type: "action", label: "فرصة استثمار", value: 1, action: "draw2" });
  }
  for (let index = 0; index < 8; index += 1) {
    cards.push({ id: `deal-${id++}`, type: "action", label: "تحصيل إيجار", value: 2, action: "rent" });
  }
  for (let index = 0; index < 5; index += 1) {
    cards.push({ id: `deal-${id++}`, type: "action", label: "استحواذ على أرض", value: 3, action: "steal" });
  }
  return shuffle(cards);
}

function initialDealData(players: Player[]) {
  const deck = buildDealDeck();
  const hands: Record<string, DealCard[]> = {};
  const banks: Record<string, DealCard[]> = {};
  const properties: Record<string, DealCard[]> = {};
  players.forEach((player) => {
    hands[player.id] = deck.splice(0, 5);
    banks[player.id] = [];
    properties[player.id] = [];
  });
  return {
    hands,
    banks,
    properties,
    drawPile: deck,
    discard: [],
    turnIndex: 0,
    needsDraw: true,
    actionsLeft: 3,
    winnerId: null,
    lastAction: "بدأت الجولة",
  };
}

function buildBalootDeck(): BalootCard[] {
  let id = 0;
  return shuffle(
    BALOOT_SUITS.flatMap((suit) =>
      BALOOT_RANKS.map((rank) => ({ id: `baloot-${id++}`, suit, rank })),
    ),
  );
}

function initialBalootData(players: Player[], matchScore: [number, number] = [0, 0], dealerIndex = 3) {
  const deck = buildBalootDeck();
  const hands: Record<string, BalootCard[]> = {};
  players.forEach((player) => {
    hands[player.id] = deck.splice(0, 5);
  });
  const buyCard = deck.shift()!;
  return {
    stage: "bidding",
    hands,
    drawPile: deck,
    buyCard,
    dealerIndex,
    bidTurnIndex: nextIndex(dealerIndex, players.length),
    biddingRound: 1,
    passes: 0,
    contract: null,
    trick: [],
    leaderIndex: 0,
    turnIndex: 0,
    teamTricks: [0, 0],
    rawPoints: [0, 0],
    matchScore,
    roundPoints: null,
    lastTrickWinnerId: null,
  };
}

function gameMeta(id: GameKey) {
  return GAMES.find((game) => game.id === id) ?? GAMES[0];
}

function makeRoomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function makeGuestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function cleanCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

function scoreFor(scores: Record<string, number>, id: string) {
  return scores[id] ?? 0;
}

function nextIndex(current: number, length: number) {
  return length ? (current + 1) % length : 0;
}

function initialGameData(game: GameKey, players: Player[], round = 0): Record<string, any> {
  switch (game) {
    case "uno":
      return initialUnoData(players);
    case "saudi-deal":
      return initialDealData(players);
    case "trivia":
      return { questionIndex: round % TRIVIA_QUESTIONS.length, answers: {}, revealed: false };
    case "judge":
      return { scenarioIndex: round % JUDGE_SCENARIOS.length, votes: {}, revealed: false };
    case "challenge30":
      return {
        activeIndex: round % Math.max(players.length, 1),
        wordIndex: Math.floor(Math.random() * CHALLENGE_WORDS.length),
        correct: 0,
        skips: 0,
        endsAt: Date.now() + 30000,
        finished: false,
      };
    case "auction":
      return { promptIndex: round % AUCTION_PROMPTS.length, bids: {}, revealed: false, winnerId: null };
    case "word-duel":
      return {
        currentLetter: LETTERS[Math.floor(Math.random() * LETTERS.length)],
        turnIndex: 0,
        words: [],
      };
    case "wheel":
      return { winnerId: null, spin: 0 };
    case "baloot":
      return initialBalootData(players);
  }
}

function lobbyState(game: GameKey = "trivia"): RoomState {
  return { phase: "lobby", game, round: 0, scores: {}, data: {}, bots: [] };
}

function makeBotPlayer(existing: Player[], difficulty: BotDifficulty): Player {
  const usedNames = new Set(existing.map((player) => player.name));
  const baseName = BOT_NAMES.find((name) => !usedNames.has(`بوت ${name}`)) ?? `لاعب ${existing.length + 1}`;
  return {
    id: `bot-${makeGuestId()}`,
    name: `بوت ${baseName}`,
    avatarUrl: null,
    ready: true,
    joinedAt: Date.now() + existing.length,
    isBot: true,
    difficulty,
  };
}

function startState(previous: RoomState, players: Player[]): RoomState {
  const scores = { ...previous.scores };
  players.forEach((player) => {
    if (scores[player.id] == null) scores[player.id] = 0;
  });
  return {
    ...previous,
    phase: "playing",
    round: 0,
    scores,
    data: initialGameData(previous.game, players),
  };
}

function wrappedIndex(index: number, length: number) {
  if (!length) return 0;
  return ((index % length) + length) % length;
}

function unoAdvance(index: number, direction: number, steps: number, players: Player[]) {
  return wrappedIndex(index + direction * steps, players.length);
}

function refillUnoDrawPile(data: any) {
  if (data.drawPile.length || data.discard.length <= 1) return;
  const top = data.discard[data.discard.length - 1];
  data.drawPile = shuffle(data.discard.slice(0, -1));
  data.discard = [top];
}

function takeUnoCards(data: any, count: number): UnoCard[] {
  const result: UnoCard[] = [];
  for (let index = 0; index < count; index += 1) {
    refillUnoDrawPile(data);
    const card = data.drawPile.shift();
    if (card) result.push(card);
  }
  return result;
}

function unoPlayable(card: UnoCard, data: any, hand: UnoCard[]) {
  const top = data.discard[data.discard.length - 1] as UnoCard;
  if (card.value === "wild4") {
    return !hand.some((item) => item.id !== card.id && item.color === data.currentColor);
  }
  return card.color === "wild" || card.color === data.currentColor || card.value === top.value;
}

function reduceUno(state: RoomState, action: RoomAction, players: Player[]): RoomState {
  const data = copyData(state.data);
  const active = players[data.turnIndex % Math.max(players.length, 1)];
  if (active?.id !== action.playerId || data.winnerId) return state;
  const hand = (data.hands[action.playerId] ?? []) as UnoCard[];

  if (action.type === "uno-call" && hand.length <= 2) {
    data.unoCalled[action.playerId] = true;
    return { ...state, data };
  }

  if (action.type === "uno-draw") {
    if (data.drawnCardId) return state;
    const [card] = takeUnoCards(data, 1);
    if (!card) return state;
    hand.push(card);
    data.hands[action.playerId] = hand;
    data.drawnCardId = card.id;
    return { ...state, data };
  }

  if (action.type === "uno-pass" && data.drawnCardId) {
    data.drawnCardId = null;
    data.unoCalled[action.playerId] = false;
    data.turnIndex = unoAdvance(data.turnIndex, data.direction, 1, players);
    return { ...state, data };
  }

  if (action.type !== "uno-play") return state;
  const cardIndex = hand.findIndex((card) => card.id === action.value?.cardId);
  if (cardIndex < 0) return state;
  const card = hand[cardIndex];
  if (data.drawnCardId && data.drawnCardId !== card.id) return state;
  if (!unoPlayable(card, data, hand)) return state;
  if (card.color === "wild" && !UNO_COLORS.includes(action.value?.color)) return state;

  hand.splice(cardIndex, 1);
  data.hands[action.playerId] = hand;
  data.discard.push(card);
  data.currentColor = card.color === "wild" ? action.value.color : card.color;
  data.drawnCardId = null;

  if (hand.length === 0) {
    data.winnerId = action.playerId;
    const scores = { ...state.scores, [action.playerId]: scoreFor(state.scores, action.playerId) + 1 };
    return { ...state, phase: "results", scores, data };
  }

  if (hand.length !== 1) data.unoCalled[action.playerId] = false;
  let direction = data.direction as number;
  let steps = 1;
  if (card.value === "reverse") {
    direction *= -1;
    data.direction = direction;
    steps = players.length === 2 ? 2 : 1;
  }
  if (card.value === "skip") steps = 2;
  if (card.value === "draw2" || card.value === "wild4") {
    const targetIndex = unoAdvance(data.turnIndex, direction, 1, players);
    const target = players[targetIndex];
    if (target) {
      const targetHand = (data.hands[target.id] ?? []) as UnoCard[];
      targetHand.push(...takeUnoCards(data, card.value === "draw2" ? 2 : 4));
      data.hands[target.id] = targetHand;
    }
    steps = 2;
  }
  data.turnIndex = unoAdvance(data.turnIndex, direction, steps, players);
  return { ...state, data };
}

function refillDealDrawPile(data: any) {
  if (data.drawPile.length || !data.discard.length) return;
  data.drawPile = shuffle(data.discard);
  data.discard = [];
}

function takeDealCards(data: any, count: number): DealCard[] {
  const result: DealCard[] = [];
  for (let index = 0; index < count; index += 1) {
    refillDealDrawPile(data);
    const card = data.drawPile.shift();
    if (card) result.push(card);
  }
  return result;
}

function completedDealSets(cards: DealCard[]) {
  return DEAL_GROUPS.filter((group) => cards.filter((card) => card.group === group.id).length >= group.size).length;
}

function finishDealMove(state: RoomState, data: any, playerId: string, players: Player[]): RoomState {
  const sets = completedDealSets(data.properties[playerId] ?? []);
  if (sets >= 3) {
    data.winnerId = playerId;
    const scores = { ...state.scores, [playerId]: scoreFor(state.scores, playerId) + 1 };
    return { ...state, phase: "results", scores, data };
  }
  data.actionsLeft -= 1;
  if (data.actionsLeft <= 0) {
    data.turnIndex = nextIndex(data.turnIndex, players.length);
    data.actionsLeft = 3;
    data.needsDraw = true;
  }
  return { ...state, data };
}

function takeDealPayment(data: any, payerId: string, amount: number): DealCard[] {
  const bank = (data.banks[payerId] ?? []) as DealCard[];
  const properties = (data.properties[payerId] ?? []) as DealCard[];
  const paid: DealCard[] = [];
  let total = 0;
  while (bank.length && total < amount) {
    const card = bank.shift()!;
    paid.push(card);
    total += card.value;
  }
  while (properties.length && total < amount) {
    const card = properties.pop()!;
    paid.push(card);
    total += card.value;
  }
  data.banks[payerId] = bank;
  data.properties[payerId] = properties;
  return paid;
}

function reduceDeal(state: RoomState, action: RoomAction, players: Player[]): RoomState {
  const data = copyData(state.data);
  const active = players[data.turnIndex % Math.max(players.length, 1)];
  if (active?.id !== action.playerId || data.winnerId) return state;
  const hand = (data.hands[action.playerId] ?? []) as DealCard[];

  if (action.type === "deal-draw" && data.needsDraw) {
    hand.push(...takeDealCards(data, hand.length ? 2 : 5));
    data.hands[action.playerId] = hand;
    data.needsDraw = false;
    data.lastAction = `${active.name} سحب أوراقه`;
    return { ...state, data };
  }

  if (action.type === "deal-discard" && hand.length > 7) {
    const index = hand.findIndex((card) => card.id === action.value);
    if (index < 0) return state;
    const [card] = hand.splice(index, 1);
    data.discard.push(card);
    data.hands[action.playerId] = hand;
    return { ...state, data };
  }

  if (action.type === "deal-end" && !data.needsDraw && hand.length <= 7) {
    data.turnIndex = nextIndex(data.turnIndex, players.length);
    data.actionsLeft = 3;
    data.needsDraw = true;
    data.lastAction = `انتهى دور ${active.name}`;
    return { ...state, data };
  }

  if (data.needsDraw || data.actionsLeft <= 0) return state;
  const cardIndex = hand.findIndex((card) => card.id === action.value?.cardId);
  if (cardIndex < 0) return state;
  const card = hand[cardIndex];

  if (action.type === "deal-bank" && (card.type === "money" || card.type === "action")) {
    hand.splice(cardIndex, 1);
    data.hands[action.playerId] = hand;
    data.banks[action.playerId].push(card);
    data.lastAction = `${active.name} أضاف بطاقة إلى البنك`;
    return finishDealMove(state, data, action.playerId, players);
  }

  if (action.type === "deal-property" && card.type === "property") {
    hand.splice(cardIndex, 1);
    data.hands[action.playerId] = hand;
    data.properties[action.playerId].push(card);
    data.lastAction = `${active.name} أضاف ${card.label}`;
    return finishDealMove(state, data, action.playerId, players);
  }

  if (action.type !== "deal-action" || card.type !== "action") return state;
  const targetId = action.value?.targetId as string | undefined;
  if (card.action !== "draw2" && (!targetId || targetId === action.playerId)) return state;
  hand.splice(cardIndex, 1);
  data.hands[action.playerId] = hand;
  data.discard.push(card);

  if (card.action === "draw2") {
    hand.push(...takeDealCards(data, 2));
    data.lastAction = `${active.name} حصل على فرصة استثمار`;
  }

  if (card.action === "rent" && targetId) {
    const ownProperties = data.properties[action.playerId] as DealCard[];
    const groupCounts = DEAL_GROUPS.map((group) => ownProperties.filter((item) => item.group === group.id).length);
    const rent = Math.max(1, Math.min(5, ...groupCounts));
    const payment = takeDealPayment(data, targetId, rent);
    payment.forEach((paidCard) => {
      if (paidCard.type === "property") data.properties[action.playerId].push(paidCard);
      else data.banks[action.playerId].push(paidCard);
    });
    const target = players.find((player) => player.id === targetId);
    data.lastAction = `${active.name} حصّل ${rent} مليون من ${target?.name ?? "لاعب"}`;
  }

  if (card.action === "steal" && targetId) {
    const targetProperties = data.properties[targetId] as DealCard[];
    const propertyIndex = targetProperties.findIndex((item) => item.id === action.value?.propertyId);
    if (propertyIndex >= 0) {
      const property = targetProperties[propertyIndex];
      const group = DEAL_GROUPS.find((item) => item.id === property.group);
      const groupCount = targetProperties.filter((item) => item.group === property.group).length;
      if (!group || groupCount < group.size) {
        targetProperties.splice(propertyIndex, 1);
        data.properties[action.playerId].push(property);
        data.lastAction = `${active.name} استحوذ على ${property.label}`;
      }
    }
  }

  return finishDealMove(state, data, action.playerId, players);
}

function finishBalootBidding(data: any, players: Player[], buyerIndex: number, mode: "sun" | "hokm", trump: BalootSuit | null) {
  players.forEach((player, index) => {
    const extra = index === buyerIndex ? 2 : 3;
    if (index === buyerIndex) data.hands[player.id].push(data.buyCard);
    data.hands[player.id].push(...data.drawPile.splice(0, extra));
  });
  data.contract = { mode, trump, buyerId: players[buyerIndex].id, buyerIndex };
  data.stage = "playing";
  data.leaderIndex = buyerIndex;
  data.turnIndex = buyerIndex;
  data.trick = [];
  data.teamTricks = [0, 0];
  data.rawPoints = [0, 0];
  data.roundPoints = null;
  return data;
}

function balootCardStrength(card: BalootCard, leadSuit: BalootSuit, mode: "sun" | "hokm", trump: BalootSuit | null) {
  const sunOrder: BalootCard["rank"][] = ["7", "8", "9", "J", "Q", "K", "10", "A"];
  const hokmOrder: BalootCard["rank"][] = ["7", "8", "Q", "K", "10", "A", "9", "J"];
  if (mode === "hokm" && trump && card.suit === trump) return 200 + hokmOrder.indexOf(card.rank);
  if (card.suit === leadSuit) return 100 + sunOrder.indexOf(card.rank);
  return 0;
}

function balootCardPoints(card: BalootCard, mode: "sun" | "hokm", trump: BalootSuit | null) {
  if (mode === "hokm" && card.suit === trump) {
    return ({ J: 20, "9": 14, A: 11, "10": 10, K: 4, Q: 3, "8": 0, "7": 0 } as Record<string, number>)[card.rank];
  }
  return ({ A: 11, "10": 10, K: 4, Q: 3, J: 2, "9": 0, "8": 0, "7": 0 } as Record<string, number>)[card.rank];
}

function reduceBaloot(state: RoomState, action: RoomAction, players: Player[]): RoomState {
  if (players.length !== 4) return state;
  const data = copyData(state.data);

  if (data.stage === "round-end" && action.type === "baloot-next-round") {
    const nextData = initialBalootData(players, data.matchScore, nextIndex(data.dealerIndex, players.length));
    return { ...state, round: state.round + 1, data: nextData };
  }

  if (data.stage === "bidding") {
    const bidder = players[data.bidTurnIndex];
    if (bidder?.id !== action.playerId) return state;
    if (action.type === "baloot-pass") {
      data.passes += 1;
      if (data.passes >= players.length) {
        if (data.biddingRound === 1) {
          data.biddingRound = 2;
          data.passes = 0;
          data.bidTurnIndex = nextIndex(data.dealerIndex, players.length);
        } else {
          return {
            ...state,
            data: initialBalootData(players, data.matchScore, nextIndex(data.dealerIndex, players.length)),
          };
        }
      } else {
        data.bidTurnIndex = nextIndex(data.bidTurnIndex, players.length);
      }
      return { ...state, data };
    }
    if (action.type === "baloot-bid") {
      const mode = action.value?.mode as "sun" | "hokm";
      if (mode !== "sun" && mode !== "hokm") return state;
      let trump: BalootSuit | null = null;
      if (mode === "hokm") {
        trump = data.biddingRound === 1 ? data.buyCard.suit : action.value?.trump;
        if (!BALOOT_SUITS.includes(trump as BalootSuit)) return state;
        if (data.biddingRound === 2 && trump === data.buyCard.suit) return state;
      }
      return { ...state, data: finishBalootBidding(data, players, data.bidTurnIndex, mode, trump) };
    }
    return state;
  }

  if (data.stage !== "playing" || action.type !== "baloot-play") return state;
  const active = players[data.turnIndex];
  if (active?.id !== action.playerId) return state;
  const hand = (data.hands[action.playerId] ?? []) as BalootCard[];
  const cardIndex = hand.findIndex((card) => card.id === action.value);
  if (cardIndex < 0) return state;
  const card = hand[cardIndex];
  const leadSuit = data.trick[0]?.card?.suit as BalootSuit | undefined;
  if (leadSuit && hand.some((item) => item.suit === leadSuit) && card.suit !== leadSuit) return state;

  hand.splice(cardIndex, 1);
  data.hands[action.playerId] = hand;
  data.trick.push({ playerId: action.playerId, card });
  if (data.trick.length < 4) {
    data.turnIndex = nextIndex(data.turnIndex, players.length);
    return { ...state, data };
  }

  const contract = data.contract as { mode: "sun" | "hokm"; trump: BalootSuit | null; buyerId: string; buyerIndex: number };
  const trickLead = data.trick[0].card.suit as BalootSuit;
  const winningPlay = data.trick.reduce((best: any, play: any) =>
    balootCardStrength(play.card, trickLead, contract.mode, contract.trump) >
    balootCardStrength(best.card, trickLead, contract.mode, contract.trump)
      ? play
      : best,
  );
  const winnerIndex = players.findIndex((player) => player.id === winningPlay.playerId);
  const winningTeam = winnerIndex % 2;
  const trickPoints = data.trick.reduce(
    (sum: number, play: any) => sum + balootCardPoints(play.card, contract.mode, contract.trump),
    0,
  );
  data.rawPoints[winningTeam] += trickPoints;
  data.teamTricks[winningTeam] += 1;
  data.lastTrickWinnerId = winningPlay.playerId;

  const roundFinished = players.every((player) => data.hands[player.id].length === 0);
  if (!roundFinished) {
    data.trick = [];
    data.leaderIndex = winnerIndex;
    data.turnIndex = winnerIndex;
    return { ...state, data };
  }

  data.rawPoints[winningTeam] += 10;
  const totalPoints = contract.mode === "sun" ? 26 : 16;
  let teamZero = contract.mode === "sun" ? Math.round(data.rawPoints[0] / 5) : Math.round(data.rawPoints[0] / 10);
  teamZero = Math.max(0, Math.min(totalPoints, teamZero));
  let roundPoints: [number, number] = [teamZero, totalPoints - teamZero];
  const buyerTeam = contract.buyerIndex % 2;
  if (roundPoints[buyerTeam] <= roundPoints[1 - buyerTeam]) {
    roundPoints = buyerTeam === 0 ? [0, totalPoints] : [totalPoints, 0];
  }
  data.roundPoints = roundPoints;
  data.matchScore = [data.matchScore[0] + roundPoints[0], data.matchScore[1] + roundPoints[1]];
  data.stage = "round-end";
  data.trick = [];

  const scores = { ...state.scores };
  players.forEach((player, index) => {
    scores[player.id] = data.matchScore[index % 2];
  });
  const matchFinished = data.matchScore[0] >= 152 || data.matchScore[1] >= 152;
  return { ...state, phase: matchFinished ? "results" : state.phase, scores, data };
}

function applyRoomAction(state: RoomState, action: RoomAction, players: Player[]): RoomState {
  const bots = state.bots ?? [];
  if (action.type === "add-bot" && state.phase === "lobby") {
    const limit = gameMeta(state.game).maxPlayers ?? 12;
    if (players.length >= limit) return state;
    return { ...state, bots: [...bots, makeBotPlayer(players, action.value as BotDifficulty)] };
  }
  if (action.type === "fill-bots" && state.phase === "lobby") {
    const meta = gameMeta(state.game);
    const target = meta.exactPlayers ?? meta.minPlayers;
    const nextBots = bots.slice();
    const nextPlayers = players.slice();
    while (nextPlayers.length < target) {
      const bot = makeBotPlayer(nextPlayers, action.value as BotDifficulty);
      nextBots.push(bot);
      nextPlayers.push(bot);
    }
    return { ...state, bots: nextBots };
  }
  if (action.type === "remove-bot" && state.phase === "lobby") {
    return { ...state, bots: bots.filter((bot) => bot.id !== action.value) };
  }
  if (action.type === "set-bot-difficulty" && state.phase === "lobby") {
    return {
      ...state,
      bots: bots.map((bot) =>
        bot.id === action.value?.botId ? { ...bot, difficulty: action.value.difficulty as BotDifficulty } : bot,
      ),
    };
  }
  if (action.type === "set-game" && state.phase === "lobby") {
    return { ...lobbyState(action.value as GameKey), bots };
  }
  if (action.type === "start" && state.phase === "lobby") return startState(state, players);
  if (action.type === "lobby") return { ...lobbyState(state.game), bots };
  if (action.type === "finish") return { ...state, phase: "results" };
  if (state.phase !== "playing") return state;

  if (state.game === "uno") return reduceUno(state, action, players);
  if (state.game === "saudi-deal") return reduceDeal(state, action, players);
  if (state.game === "baloot") return reduceBaloot(state, action, players);

  const data = state.data;
  const scores = { ...state.scores };

  if (state.game === "trivia") {
    if (action.type === "answer" && !data.revealed && data.answers[action.playerId] == null) {
      return { ...state, data: { ...data, answers: { ...data.answers, [action.playerId]: action.value } } };
    }
    if (action.type === "reveal" && !data.revealed) {
      const question = TRIVIA_QUESTIONS[data.questionIndex % TRIVIA_QUESTIONS.length];
      Object.entries(data.answers as Record<string, number>).forEach(([id, answer]) => {
        if (answer === question.correct) scores[id] = scoreFor(scores, id) + 1;
      });
      return { ...state, scores, data: { ...data, revealed: true } };
    }
    if (action.type === "next") {
      const round = state.round + 1;
      return { ...state, round, data: initialGameData("trivia", players, round) };
    }
  }

  if (state.game === "judge") {
    if (action.type === "vote" && !data.revealed && data.votes[action.playerId] == null) {
      return { ...state, data: { ...data, votes: { ...data.votes, [action.playerId]: action.value } } };
    }
    if (action.type === "reveal") return { ...state, data: { ...data, revealed: true } };
    if (action.type === "next") {
      const round = state.round + 1;
      return { ...state, round, data: initialGameData("judge", players, round) };
    }
  }

  if (state.game === "challenge30") {
    const active = players[data.activeIndex % Math.max(players.length, 1)];
    if (action.type === "next") {
      const round = state.round + 1;
      return { ...state, round, data: initialGameData("challenge30", players, round) };
    }
    if (active?.id !== action.playerId) return state;
    if (action.type === "correct" && !data.finished) {
      scores[action.playerId] = scoreFor(scores, action.playerId) + 1;
      return {
        ...state,
        scores,
        data: {
          ...data,
          correct: data.correct + 1,
          wordIndex: nextIndex(data.wordIndex, CHALLENGE_WORDS.length),
        },
      };
    }
    if (action.type === "skip" && !data.finished) {
      return {
        ...state,
        data: {
          ...data,
          skips: data.skips + 1,
          wordIndex: nextIndex(data.wordIndex, CHALLENGE_WORDS.length),
        },
      };
    }
    if (action.type === "end-turn") return { ...state, data: { ...data, finished: true } };
  }

  if (state.game === "auction") {
    if (action.type === "bid" && !data.revealed) {
      const bid = Math.max(0, Math.min(999, Number(action.value) || 0));
      return { ...state, data: { ...data, bids: { ...data.bids, [action.playerId]: bid } } };
    }
    if (action.type === "reveal") return { ...state, data: { ...data, revealed: true } };
    if (action.type === "award" && data.revealed && players.some((p) => p.id === action.value)) {
      scores[action.value] = scoreFor(scores, action.value) + 1;
      return { ...state, scores, data: { ...data, winnerId: action.value } };
    }
    if (action.type === "next") {
      const round = state.round + 1;
      return { ...state, round, data: initialGameData("auction", players, round) };
    }
  }

  if (state.game === "word-duel") {
    const active = players[data.turnIndex % Math.max(players.length, 1)];
    if (action.type === "word" && active?.id === action.playerId) {
      const word = String(action.value ?? "").trim();
      if (word.length < 2 || !word.startsWith(data.currentLetter)) return state;
      const words = [...data.words, { playerId: action.playerId, word }];
      scores[action.playerId] = scoreFor(scores, action.playerId) + 1;
      return {
        ...state,
        scores,
        data: {
          ...data,
          words,
          currentLetter: word.slice(-1),
          turnIndex: nextIndex(data.turnIndex, players.length),
        },
      };
    }
    if (action.type === "skip" && active?.id === action.playerId) {
      return {
        ...state,
        data: {
          ...data,
          currentLetter: LETTERS[Math.floor(Math.random() * LETTERS.length)],
          turnIndex: nextIndex(data.turnIndex, players.length),
        },
      };
    }
  }

  if (state.game === "wheel" && action.type === "spin" && players.length) {
    const winner = players[Math.floor(Math.random() * players.length)];
    return { ...state, data: { winnerId: winner.id, spin: (data.spin ?? 0) + 1 } };
  }

  return state;
}

function randomItem<T>(items: T[]): T | undefined {
  return items[Math.floor(Math.random() * items.length)];
}

function botDifficulty(bot: Player): BotDifficulty {
  return bot.difficulty ?? "medium";
}

function unoBotAction(state: RoomState, bot: Player, players: Player[]): RoomAction | null {
  const data = state.data;
  const hand = (data.hands[bot.id] ?? []) as UnoCard[];
  if (!hand.length) return null;
  if (hand.length <= 2 && !data.unoCalled[bot.id]) return { type: "uno-call", playerId: bot.id };

  let playable = hand.filter((card) => unoPlayable(card, data, hand));
  if (data.drawnCardId) playable = playable.filter((card) => card.id === data.drawnCardId);
  if (!playable.length) {
    return data.drawnCardId
      ? { type: "uno-pass", playerId: bot.id }
      : { type: "uno-draw", playerId: bot.id };
  }

  const difficulty = botDifficulty(bot);
  if (!data.drawnCardId && difficulty === "easy" && Math.random() < 0.22) {
    return { type: "uno-draw", playerId: bot.id };
  }
  const valueScore: Record<string, number> = { wild4: 9, draw2: 8, skip: 7, reverse: 6, wild: 5 };
  if (difficulty === "medium") playable.sort((a, b) => (valueScore[b.value] ?? 0) - (valueScore[a.value] ?? 0));
  if (difficulty === "hard") {
    const colorCount = UNO_COLORS.reduce<Record<string, number>>((acc, color) => {
      acc[color] = hand.filter((card) => card.color === color).length;
      return acc;
    }, {});
    playable.sort((a, b) =>
      ((valueScore[b.value] ?? 0) + (colorCount[b.color] ?? 0)) -
      ((valueScore[a.value] ?? 0) + (colorCount[a.color] ?? 0)),
    );
  }
  const card = difficulty === "easy" ? randomItem(playable)! : playable[0];
  let color: Exclude<UnoColor, "wild"> | undefined;
  if (card.color === "wild") {
    if (difficulty === "easy") color = randomItem(UNO_COLORS)!;
    else {
      color = UNO_COLORS.slice().sort(
        (a, b) => hand.filter((item) => item.color === b).length - hand.filter((item) => item.color === a).length,
      )[0];
    }
  }
  return { type: "uno-play", playerId: bot.id, value: { cardId: card.id, color } };
}

function dealTargetWealth(data: any, playerId: string) {
  return [...(data.banks[playerId] ?? []), ...(data.properties[playerId] ?? [])]
    .reduce((sum: number, card: DealCard) => sum + card.value, 0);
}

function dealBotAction(state: RoomState, bot: Player, players: Player[]): RoomAction | null {
  const data = state.data;
  const hand = (data.hands[bot.id] ?? []) as DealCard[];
  if (data.needsDraw) return { type: "deal-draw", playerId: bot.id };
  const difficulty = botDifficulty(bot);
  if (hand.length > 7) {
    const card = difficulty === "easy"
      ? randomItem(hand)!
      : hand.slice().sort((a, b) => a.value - b.value)[0];
    return { type: "deal-discard", playerId: bot.id, value: card.id };
  }
  if (data.actionsLeft <= 0 || !hand.length || (difficulty === "easy" && data.actionsLeft < 3 && Math.random() < 0.18)) {
    return { type: "deal-end", playerId: bot.id };
  }

  const properties = hand.filter((card) => card.type === "property");
  const actions = hand.filter((card) => card.type === "action");
  const money = hand.filter((card) => card.type === "money");
  let card: DealCard | undefined;
  if (difficulty === "hard" && properties.length) {
    const owned = (data.properties[bot.id] ?? []) as DealCard[];
    card = properties.slice().sort((a, b) => {
      const groupA = DEAL_GROUPS.find((group) => group.id === a.group);
      const groupB = DEAL_GROUPS.find((group) => group.id === b.group);
      const needA = (groupA?.size ?? 9) - owned.filter((item) => item.group === a.group).length;
      const needB = (groupB?.size ?? 9) - owned.filter((item) => item.group === b.group).length;
      return needA - needB;
    })[0];
  } else if (difficulty !== "easy") {
    card = properties[0] ?? actions[0] ?? money[0];
  } else {
    card = randomItem(hand);
  }
  if (!card) return { type: "deal-end", playerId: bot.id };
  if (card.type === "property") return { type: "deal-property", playerId: bot.id, value: { cardId: card.id } };
  if (card.type === "money") return { type: "deal-bank", playerId: bot.id, value: { cardId: card.id } };

  if (difficulty === "easy" && Math.random() < 0.45) {
    return { type: "deal-bank", playerId: bot.id, value: { cardId: card.id } };
  }
  if (card.action === "draw2") return { type: "deal-action", playerId: bot.id, value: { cardId: card.id } };

  const opponents = players.filter((player) => player.id !== bot.id);
  if (card.action === "rent") {
    const target = difficulty === "hard"
      ? opponents.slice().sort((a, b) => dealTargetWealth(data, b.id) - dealTargetWealth(data, a.id))[0]
      : randomItem(opponents);
    if (target && dealTargetWealth(data, target.id) > 0) {
      return { type: "deal-action", playerId: bot.id, value: { cardId: card.id, targetId: target.id } };
    }
  }

  if (card.action === "steal") {
    const choices = opponents.flatMap((target) =>
      ((data.properties[target.id] ?? []) as DealCard[])
        .filter((property) => {
          const group = DEAL_GROUPS.find((item) => item.id === property.group);
          const count = (data.properties[target.id] as DealCard[]).filter((item) => item.group === property.group).length;
          return !group || count < group.size;
        })
        .map((property) => ({ target, property })),
    );
    const choice = difficulty === "hard"
      ? choices.slice().sort((a, b) => {
          const owned = (data.properties[bot.id] ?? []) as DealCard[];
          return owned.filter((item) => item.group === b.property.group).length - owned.filter((item) => item.group === a.property.group).length;
        })[0]
      : randomItem(choices);
    if (choice) {
      return {
        type: "deal-action",
        playerId: bot.id,
        value: { cardId: card.id, targetId: choice.target.id, propertyId: choice.property.id },
      };
    }
  }
  return { type: "deal-bank", playerId: bot.id, value: { cardId: card.id } };
}

function balootBotAction(state: RoomState, bot: Player, players: Player[]): RoomAction | null {
  const data = state.data;
  const hand = (data.hands[bot.id] ?? []) as BalootCard[];
  const difficulty = botDifficulty(bot);

  if (data.stage === "bidding") {
    const sunPoints = hand.reduce((sum, card) => sum + balootCardPoints(card, "sun", null), 0);
    const allowedSuits = BALOOT_SUITS.filter((suit) => data.biddingRound === 1 || suit !== data.buyCard.suit);
    const bestSuit = allowedSuits.slice().sort(
      (a, b) => hand.filter((card) => card.suit === b).length - hand.filter((card) => card.suit === a).length,
    )[0];
    const bestSuitCount = hand.filter((card) => card.suit === bestSuit).length + (data.buyCard.suit === bestSuit ? 1 : 0);

    if (difficulty === "easy") {
      if (Math.random() < 0.42) return { type: "baloot-pass", playerId: bot.id };
      const mode = Math.random() < 0.5 ? "sun" : "hokm";
      return { type: "baloot-bid", playerId: bot.id, value: { mode, trump: bestSuit } };
    }
    if (difficulty === "medium") {
      if (bestSuitCount >= 3) return { type: "baloot-bid", playerId: bot.id, value: { mode: "hokm", trump: bestSuit } };
      if (sunPoints >= 24) return { type: "baloot-bid", playerId: bot.id, value: { mode: "sun" } };
      return { type: "baloot-pass", playerId: bot.id };
    }
    const suitPower = hand
      .filter((card) => card.suit === bestSuit)
      .reduce((sum, card) => sum + balootCardPoints(card, "hokm", bestSuit), 0);
    if (bestSuitCount >= 3 && suitPower >= 24) {
      return { type: "baloot-bid", playerId: bot.id, value: { mode: "hokm", trump: bestSuit } };
    }
    if (sunPoints >= 28) return { type: "baloot-bid", playerId: bot.id, value: { mode: "sun" } };
    return { type: "baloot-pass", playerId: bot.id };
  }

  if (data.stage !== "playing" || !hand.length) return null;
  const contract = data.contract as { mode: "sun" | "hokm"; trump: BalootSuit | null };
  const leadSuit = data.trick[0]?.card?.suit as BalootSuit | undefined;
  const legal = leadSuit && hand.some((card) => card.suit === leadSuit)
    ? hand.filter((card) => card.suit === leadSuit)
    : hand.slice();
  if (!legal.length) return null;
  let card: BalootCard;
  if (difficulty === "easy") {
    card = randomItem(legal)!;
  } else if (!data.trick.length) {
    card = legal.slice().sort((a, b) =>
      difficulty === "hard"
        ? balootCardPoints(b, contract.mode, contract.trump) - balootCardPoints(a, contract.mode, contract.trump)
        : balootCardPoints(a, contract.mode, contract.trump) - balootCardPoints(b, contract.mode, contract.trump),
    )[0];
  } else {
    const trickLead = data.trick[0].card.suit as BalootSuit;
    const currentBest = data.trick.reduce((best: any, play: any) =>
      balootCardStrength(play.card, trickLead, contract.mode, contract.trump) >
      balootCardStrength(best.card, trickLead, contract.mode, contract.trump)
        ? play
        : best,
    );
    const botIndex = players.findIndex((player) => player.id === bot.id);
    const winnerIndex = players.findIndex((player) => player.id === currentBest.playerId);
    const lowest = legal.slice().sort((a, b) => balootCardPoints(a, contract.mode, contract.trump) - balootCardPoints(b, contract.mode, contract.trump));
    if (difficulty === "hard" && botIndex % 2 === winnerIndex % 2) {
      card = lowest[0];
    } else if (difficulty === "hard") {
      const bestStrength = balootCardStrength(currentBest.card, trickLead, contract.mode, contract.trump);
      const winners = lowest.filter((candidate) => balootCardStrength(candidate, trickLead, contract.mode, contract.trump) > bestStrength);
      card = winners[0] ?? lowest[0];
    } else {
      card = lowest[0];
    }
  }
  return { type: "baloot-play", playerId: bot.id, value: card.id };
}

function chooseBotAction(state: RoomState, players: Player[]): RoomAction | null {
  if (state.phase !== "playing") return null;
  const bots = players.filter((player) => player.isBot);
  if (!bots.length) return null;
  const data = state.data;

  if (state.game === "uno") {
    const active = players[data.turnIndex % Math.max(players.length, 1)];
    return active?.isBot ? unoBotAction(state, active, players) : null;
  }
  if (state.game === "saudi-deal") {
    const active = players[data.turnIndex % Math.max(players.length, 1)];
    return active?.isBot ? dealBotAction(state, active, players) : null;
  }
  if (state.game === "baloot") {
    const active = data.stage === "bidding" ? players[data.bidTurnIndex] : players[data.turnIndex];
    return active?.isBot ? balootBotAction(state, active, players) : null;
  }
  if (state.game === "trivia" && !data.revealed) {
    const bot = bots.find((player) => data.answers[player.id] == null);
    if (!bot) return null;
    const question = TRIVIA_QUESTIONS[data.questionIndex % TRIVIA_QUESTIONS.length];
    const chance = botDifficulty(bot) === "easy" ? 0.35 : botDifficulty(bot) === "medium" ? 0.68 : 0.92;
    const wrong = question.options.map((_, index) => index).filter((index) => index !== question.correct);
    const answer = Math.random() < chance ? question.correct : randomItem(wrong)!;
    return { type: "answer", playerId: bot.id, value: answer };
  }
  if (state.game === "judge" && !data.revealed) {
    const bot = bots.find((player) => data.votes[player.id] == null);
    if (!bot) return null;
    const target = randomItem(players.filter((player) => player.id !== bot.id)) ?? players[0];
    return target ? { type: "vote", playerId: bot.id, value: target.id } : null;
  }
  if (state.game === "auction" && !data.revealed) {
    const bot = bots.find((player) => data.bids[player.id] == null);
    if (!bot) return null;
    const base = botDifficulty(bot) === "easy" ? 3 : botDifficulty(bot) === "medium" ? 6 : 9;
    return { type: "bid", playerId: bot.id, value: Math.max(1, base + Math.floor(Math.random() * 5) - 2) };
  }
  if (state.game === "challenge30") {
    const active = players[data.activeIndex % Math.max(players.length, 1)];
    if (!active?.isBot) return null;
    if (data.finished) return { type: "next", playerId: active.id };
    if (Date.now() >= data.endsAt) return { type: "end-turn", playerId: active.id };
    const correctChance = botDifficulty(active) === "easy" ? 0.45 : botDifficulty(active) === "medium" ? 0.72 : 0.9;
    return { type: Math.random() < correctChance ? "correct" : "skip", playerId: active.id };
  }
  if (state.game === "word-duel") {
    const active = players[data.turnIndex % Math.max(players.length, 1)];
    if (!active?.isBot) return null;
    const options = BOT_WORDS[data.currentLetter] ?? [`${data.currentLetter}لام`];
    const used = new Set((data.words ?? []).map((item: { word: string }) => item.word));
    const word = options.find((item) => !used.has(item)) ?? `${data.currentLetter}${Math.floor(Math.random() * 99)}ار`;
    return { type: "word", playerId: active.id, value: word };
  }
  return null;
}

function botThinkDelay(bot: Player | undefined) {
  if (!bot) return 850;
  if (botDifficulty(bot) === "easy") return 1250;
  if (botDifficulty(bot) === "hard") return 520;
  return 820;
}

function readDeviceId() {
  if (typeof window === "undefined") return makeGuestId();
  const saved = window.localStorage.getItem("alsaif-game-device-id");
  if (saved) return saved;
  const id = makeGuestId();
  window.localStorage.setItem("alsaif-game-device-id", id);
  return id;
}

export function GameRoomsHub() {
  const [me, setMe] = useState<Player>(() => ({
    id: readDeviceId(),
    name: "عضو العائلة",
    avatarUrl: null,
    ready: false,
    joinedAt: Date.now(),
  }));
  const [booting, setBooting] = useState(true);
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [hostId, setHostId] = useState<string | null>(null);
  const [state, setState] = useState<RoomState>(() => lobbyState());
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(Date.now());

  const channelRef = useRef<any>(null);
  const meRef = useRef(me);
  const playersRef = useRef(players);
  const stateRef = useRef(state);
  const hostRef = useRef(hostId);
  const roomRef = useRef(roomCode);
  const readyRef = useRef(ready);
  const receivedSnapshotRef = useRef(false);
  const reconnectAttemptedRef = useRef(false);
  const electionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const joinTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const packetHandlerRef = useRef<(packet: RoomPacket) => void>(() => undefined);

  useEffect(() => {
    meRef.current = me;
  }, [me]);
  useEffect(() => {
    playersRef.current = players;
  }, [players]);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    hostRef.current = hostId;
  }, [hostId]);
  useEffect(() => {
    roomRef.current = roomCode;
  }, [roomCode]);
  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user || !active) {
        if (active) setBooting(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("arabic_name, full_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (!active) return;
      const name = profile?.arabic_name?.trim() || profile?.full_name?.trim() || "عضو العائلة";
      setMe({
        id: user.id,
        name,
        avatarUrl: profile?.avatar_url ?? null,
        ready: false,
        joinedAt: Date.now(),
      });
      setBooting(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (state.game !== "challenge30" || state.phase !== "playing" || state.data.finished) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [state.game, state.phase, state.data.finished]);

  const clearJoinTimers = useCallback(() => {
    joinTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    joinTimersRef.current = [];
    if (electionTimerRef.current) window.clearTimeout(electionTimerRef.current);
    electionTimerRef.current = null;
  }, []);

  const disconnectChannel = useCallback(async () => {
    clearJoinTimers();
    const channel = channelRef.current;
    channelRef.current = null;
    if (channel) await supabase.removeChannel(channel);
  }, [clearJoinTimers]);

  const sendPacket = useCallback(async (packet: RoomPacket) => {
    const channel = channelRef.current;
    if (!channel) return;
    await channel.send({ type: "broadcast", event: "room", payload: packet });
  }, []);

  const publishSnapshot = useCallback(
    async (nextState: RoomState, nextHostId = hostRef.current) => {
      if (!nextHostId) return;
      await sendPacket({
        kind: "snapshot",
        senderId: meRef.current.id,
        hostId: nextHostId,
        state: nextState,
      });
    },
    [sendPacket],
  );

  const trackPresence = useCallback(async (nextReady: boolean, nextIsHost = hostRef.current === meRef.current.id) => {
    const channel = channelRef.current;
    if (!channel) return;
    await channel.track({
      id: meRef.current.id,
      name: meRef.current.name,
      avatarUrl: meRef.current.avatarUrl,
      ready: nextReady,
      joinedAt: meRef.current.joinedAt,
      isHost: nextIsHost,
    });
  }, []);

  const resetRoomView = useCallback(() => {
    setRoomCode("");
    setPlayers([]);
    setHostId(null);
    setState(lobbyState());
    setConnected(false);
    setConnecting(false);
    setReady(false);
    receivedSnapshotRef.current = false;
    if (typeof window !== "undefined") window.localStorage.removeItem(SESSION_KEY);
  }, []);

  const leaveRoom = useCallback(
    async (announce = true) => {
      const currentHost = hostRef.current;
      const currentPlayers = playersRef.current;
      if (announce && currentHost === meRef.current.id) {
        const successor = currentPlayers
          .filter((player) => player.id !== meRef.current.id)
          .sort((a, b) => a.joinedAt - b.joinedAt)[0];
        if (successor) {
          await publishSnapshot(stateRef.current, successor.id);
        } else {
          await sendPacket({ kind: "room-closed", senderId: meRef.current.id });
        }
      }
      await disconnectChannel();
      resetRoomView();
    },
    [disconnectChannel, publishSnapshot, resetRoomView, sendPacket],
  );

  const hostApply = useCallback(
    async (action: RoomAction) => {
      if (hostRef.current !== meRef.current.id) return;
      const participants = [...playersRef.current, ...(stateRef.current.bots ?? [])];
      const next = applyRoomAction(stateRef.current, action, participants);
      if (next === stateRef.current) return;
      stateRef.current = next;
      setState(next);
      await publishSnapshot(next, meRef.current.id);
    },
    [publishSnapshot],
  );

  const dispatch = useCallback(
    async (type: string, value?: any) => {
      const action: RoomAction = { type, value, playerId: meRef.current.id };
      if (hostRef.current === meRef.current.id) {
        await hostApply(action);
      } else {
        await sendPacket({ kind: "action", senderId: meRef.current.id, action });
      }
    },
    [hostApply, sendPacket],
  );

  packetHandlerRef.current = (packet) => {
    if (!packet || packet.senderId === meRef.current.id) return;
    if (packet.kind === "request-state") {
      if (hostRef.current === meRef.current.id) void publishSnapshot(stateRef.current, meRef.current.id);
      return;
    }
    if (packet.kind === "snapshot") {
      receivedSnapshotRef.current = true;
      hostRef.current = packet.hostId;
      stateRef.current = packet.state;
      setHostId(packet.hostId);
      setState(packet.state);
      if (packet.hostId === meRef.current.id) void trackPresence(readyRef.current, true);
      return;
    }
    if (packet.kind === "action") {
      if (hostRef.current === meRef.current.id) void hostApply(packet.action);
      return;
    }
    if (packet.kind === "room-closed") {
      toast.info("أغلق المضيف الغرفة");
      void leaveRoom(false);
    }
  };

  const connectRoom = useCallback(
    async (
      requestedCode: string,
      mode: "create" | "join" | "restore",
      restored?: { state?: RoomState; hostId?: string; ready?: boolean },
    ) => {
      const code = cleanCode(requestedCode);
      if (code.length !== 6 || channelRef.current) return;
      setConnecting(true);
      receivedSnapshotRef.current = mode === "create" || Boolean(restored?.state);

      const startingState = restored?.state ?? lobbyState();
      const startingHost = mode === "create" ? meRef.current.id : (restored?.hostId ?? null);
      const startingReady = mode === "create" ? true : Boolean(restored?.ready);
      stateRef.current = startingState;
      hostRef.current = startingHost;
      roomRef.current = code;
      readyRef.current = startingReady;
      setState(startingState);
      setHostId(startingHost);
      setRoomCode(code);
      setReady(startingReady);

      const channel = supabase.channel(`alsaif-game-room:${code}`, {
        config: { broadcast: { self: false }, presence: { key: meRef.current.id } },
      });
      channelRef.current = channel;

      channel
        .on("broadcast", { event: "room" }, ({ payload }: { payload: RoomPacket }) => {
          packetHandlerRef.current(payload);
        })
        .on("presence", { event: "sync" }, () => {
          const raw = channel.presenceState() as Record<string, Player[]>;
          const unique = new Map<string, Player>();
          Object.values(raw)
            .flat()
            .forEach((presence: any) => {
              if (!presence?.id) return;
              unique.set(presence.id, {
                id: presence.id,
                name: presence.name || "عضو العائلة",
                avatarUrl: presence.avatarUrl ?? null,
                ready: Boolean(presence.ready),
                joinedAt: Number(presence.joinedAt) || Date.now(),
                isHost: Boolean(presence.isHost),
              });
            });
          const nextPlayers = [...unique.values()].sort((a, b) => a.joinedAt - b.joinedAt);
          playersRef.current = nextPlayers;
          setPlayers(nextPlayers);

          const announcedHost = nextPlayers.find((player) => player.isHost)?.id;
          if (!hostRef.current && announcedHost) {
            hostRef.current = announcedHost;
            setHostId(announcedHost);
          }

          const knownHost = hostRef.current;
          if (
            knownHost &&
            !nextPlayers.some((player) => player.id === knownHost) &&
            nextPlayers.length &&
            receivedSnapshotRef.current &&
            !electionTimerRef.current
          ) {
            electionTimerRef.current = window.setTimeout(() => {
              electionTimerRef.current = null;
              const remaining = playersRef.current.slice().sort((a, b) => a.joinedAt - b.joinedAt);
              if (remaining.some((player) => player.id === hostRef.current)) return;
              const successor = remaining[0];
              if (!successor) return;
              hostRef.current = successor.id;
              setHostId(successor.id);
              if (successor.id === meRef.current.id) {
                toast.info("أصبحت مضيف الغرفة بعد خروج المضيف السابق");
                void trackPresence(readyRef.current, true);
                void publishSnapshot(stateRef.current, successor.id);
              }
            }, 1200);
          }
        })
        .subscribe(async (status: string) => {
          if (status === "SUBSCRIBED") {
            setConnecting(false);
            setConnected(true);
            await trackPresence(startingReady, startingHost === meRef.current.id);
            if (mode !== "create") {
              await sendPacket({ kind: "request-state", senderId: meRef.current.id });
              joinTimersRef.current.push(
                window.setTimeout(() => {
                  void sendPacket({ kind: "request-state", senderId: meRef.current.id });
                }, 1800),
              );
              joinTimersRef.current.push(
                window.setTimeout(() => {
                  if (!receivedSnapshotRef.current) {
                    toast.error("لم نجد غرفة نشطة بهذا الرمز");
                    void leaveRoom(false);
                  }
                }, 6500),
              );
            } else {
              await publishSnapshot(startingState, meRef.current.id);
            }
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setConnecting(false);
            setConnected(false);
            toast.error("تعذر الاتصال بالغرفة، تحقق من الإنترنت وحاول مجددًا");
          }
        });
    },
    [leaveRoom, publishSnapshot, sendPacket, trackPresence],
  );

  useEffect(() => {
    if (booting || reconnectAttemptedRef.current || typeof window === "undefined") return;
    reconnectAttemptedRef.current = true;
    try {
      const saved = JSON.parse(window.localStorage.getItem(SESSION_KEY) || "null");
      const fresh = saved?.savedAt && Date.now() - saved.savedAt < 8 * 60 * 60 * 1000;
      if (fresh && cleanCode(saved.code).length === 6) {
        void connectRoom(saved.code, "restore", {
          state: saved.state,
          hostId: saved.hostId,
          ready: saved.ready,
        });
      } else {
        window.localStorage.removeItem(SESSION_KEY);
      }
    } catch {
      window.localStorage.removeItem(SESSION_KEY);
    }
  }, [booting, connectRoom]);

  useEffect(() => {
    if (!roomCode || typeof window === "undefined") return;
    window.localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ code: roomCode, state, hostId, ready, savedAt: Date.now() }),
    );
  }, [roomCode, state, hostId, ready]);

  useEffect(() => {
    if (!connected || hostId !== me.id || state.phase !== "playing") return;
    const currentPlayers = [...players, ...(state.bots ?? [])];
    const action = chooseBotAction(state, currentPlayers);
    if (!action) return;
    const bot = currentPlayers.find((player) => player.id === action.playerId && player.isBot);
    const timer = window.setTimeout(() => {
      void hostApply(action);
    }, botThinkDelay(bot));
    return () => window.clearTimeout(timer);
  }, [connected, hostId, me.id, players, state, hostApply]);

  useEffect(() => () => {
    const channel = channelRef.current;
    if (channel) void supabase.removeChannel(channel);
  }, []);

  const toggleReady = async () => {
    const next = !ready;
    setReady(next);
    readyRef.current = next;
    await trackPresence(next);
  };

  const shareRoom = async () => {
    const text = `انضم لغرفة ألعاب السيف بالرمز: ${roomCode}`;
    try {
      if (navigator.share) await navigator.share({ title: "غرفة ألعاب السيف", text });
      else {
        await navigator.clipboard.writeText(roomCode);
        toast.success("تم نسخ رمز الغرفة");
      }
    } catch (error: any) {
      if (error?.name !== "AbortError") toast.error("تعذرت المشاركة");
    }
  };

  const isHost = hostId === me.id;
  const selectedMeta = gameMeta(state.game);
  const participants = useMemo(() => [...players, ...(state.bots ?? [])], [players, state.bots]);
  const minimumReached = selectedMeta.exactPlayers
    ? participants.length === selectedMeta.exactPlayers
    : participants.length >= selectedMeta.minPlayers;
  const allReady = minimumReached && participants.every((player) => player.ready);

  if (booting) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="size-9 animate-spin text-gold-primary" />
      </div>
    );
  }

  if (!roomCode) {
    return (
      <RoomEntry
        me={me}
        joinCode={joinCode}
        setJoinCode={setJoinCode}
        connecting={connecting}
        onCreate={() => void connectRoom(makeRoomCode(), "create")}
        onJoin={() => void connectRoom(joinCode, "join")}
      />
    );
  }

  return (
    <section className="mx-auto w-full max-w-6xl space-y-5 px-3 sm:px-5" dir="rtl">
      <RoomTopBar
        roomCode={roomCode}
        connected={connected}
        isHost={isHost}
        playersCount={participants.length}
        onShare={shareRoom}
        onLeave={() => void leaveRoom()}
      />

      {state.phase === "lobby" ? (
        <Lobby
          state={state}
          players={participants}
          me={me}
          isHost={isHost}
          ready={ready}
          allReady={allReady}
          minimumReached={minimumReached}
          onReady={() => void toggleReady()}
          onSelectGame={(game) => void dispatch("set-game", game)}
          onStart={() => void dispatch("start")}
          onAddBot={(difficulty) => void dispatch("add-bot", difficulty)}
          onFillBots={(difficulty) => void dispatch("fill-bots", difficulty)}
          onRemoveBot={(botId) => void dispatch("remove-bot", botId)}
          onBotDifficulty={(botId, difficulty) => void dispatch("set-bot-difficulty", { botId, difficulty })}
        />
      ) : state.phase === "results" ? (
        <Results
          players={participants}
          scores={state.scores}
          isHost={isHost}
          onLobby={() => void dispatch("lobby")}
        />
      ) : (
        <GameBoard
          state={state}
          players={participants}
          me={me}
          isHost={isHost}
          now={now}
          dispatch={dispatch}
        />
      )}
    </section>
  );
}

function Surface({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[28px] border border-border/60 bg-card shadow-xl shadow-black/5 sm:rounded-[36px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function RoomEntry({
  me,
  joinCode,
  setJoinCode,
  connecting,
  onCreate,
  onJoin,
}: {
  me: Player;
  joinCode: string;
  setJoinCode: (value: string) => void;
  connecting: boolean;
  onCreate: () => void;
  onJoin: () => void;
}) {
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5 px-3 sm:px-5 lg:grid-cols-[1.05fr_.95fr]" dir="rtl">
      <Surface className="relative overflow-hidden bg-gradient-to-br from-[#073f34] via-[#075744] to-[#0a241e] p-6 text-white sm:p-10">
        <div className="absolute -left-20 -top-20 size-72 rounded-full bg-gold-primary/15 blur-3xl" />
        <div className="relative space-y-7">
          <div className="flex items-center gap-4">
            <div className="flex size-16 items-center justify-center rounded-3xl border border-white/15 bg-white/10">
              <Users className="size-8 text-gold-primary" />
            </div>
            <div>
              <p className="text-xs font-black tracking-[.22em] text-gold-primary">ألعاب جماعية مباشرة</p>
              <h3 className="mt-1 text-3xl font-black">غرف ألعاب السيف</h3>
            </div>
          </div>

          <p className="max-w-xl text-base font-bold leading-8 text-white/75 sm:text-lg">
            أنشئ غرفة وشارك رمزها. كل شخص يدخل من جواله، وتتحرك اللعبة والنتائج عند الجميع في نفس اللحظة.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              [Wifi, "مزامنة مباشرة"],
              [ShieldCheck, "دخول بحساب العائلة"],
              [Users, "حتى 12 لاعبًا"],
            ].map(([Icon, label]) => {
              const FeatureIcon = Icon as LucideIcon;
              return (
                <div key={label as string} className="flex items-center gap-2 rounded-2xl bg-white/8 px-4 py-3">
                  <FeatureIcon className="size-4 text-gold-primary" />
                  <span className="text-xs font-black">{label as string}</span>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            disabled={connecting}
            onClick={onCreate}
            className="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-gold-primary px-6 text-lg font-black text-[#10251e] shadow-xl transition active:scale-[.98] disabled:opacity-60"
          >
            {connecting ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
            إنشاء غرفة جديدة
          </button>
        </div>
      </Surface>

      <Surface className="p-6 sm:p-9">
        <div className="flex h-full flex-col justify-center gap-6">
          <div>
            <p className="text-xs font-black text-gold-primary">مرحبًا {me.name}</p>
            <h3 className="mt-2 text-2xl font-black text-primary">عندك رمز غرفة؟</h3>
            <p className="mt-2 text-sm font-bold leading-7 text-muted-foreground">
              أدخل الأرقام الستة التي أرسلها مضيف اللعبة.
            </p>
          </div>

          <label className="space-y-2">
            <span className="text-xs font-black text-muted-foreground">رمز الغرفة</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={joinCode}
              onChange={(event) => setJoinCode(cleanCode(event.target.value))}
              onKeyDown={(event) => {
                if (event.key === "Enter" && joinCode.length === 6) onJoin();
              }}
              placeholder="••••••"
              className="h-20 w-full rounded-3xl border-2 border-border bg-muted/35 px-5 text-center text-4xl font-black tracking-[.28em] text-primary outline-none transition focus:border-gold-primary"
              dir="ltr"
            />
          </label>

          <button
            type="button"
            disabled={connecting || joinCode.length !== 6}
            onClick={onJoin}
            className="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-primary px-6 text-lg font-black text-primary-foreground transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-35"
          >
            {connecting ? <Loader2 className="size-5 animate-spin" /> : <LogInIcon />}
            دخول الغرفة
          </button>
        </div>
      </Surface>
    </div>
  );
}

function LogInIcon() {
  return <ArrowRight className="size-5 rotate-180" />;
}

function RoomTopBar({
  roomCode,
  connected,
  isHost,
  playersCount,
  onShare,
  onLeave,
}: {
  roomCode: string;
  connected: boolean;
  isHost: boolean;
  playersCount: number;
  onShare: () => void;
  onLeave: () => void;
}) {
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      toast.success("تم نسخ رمز الغرفة");
    } catch {
      toast.error("تعذر نسخ الرمز");
    }
  };

  return (
    <Surface className="sticky top-2 z-20 overflow-hidden bg-card/95 p-3 backdrop-blur-xl sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onLeave}
            aria-label="مغادرة الغرفة"
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground transition hover:text-destructive"
          >
            <LogOut className="size-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              {connected ? <Wifi className="size-4 text-emerald-500" /> : <WifiOff className="size-4 text-rose-500" />}
              <span className="text-xs font-black text-muted-foreground">
                {connected ? "متصل مباشر" : "جاري الاتصال"} · {playersCount} لاعبين
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xl font-black tracking-[.18em] text-primary" dir="ltr">{roomCode}</span>
              {isHost && (
                <span className="rounded-full bg-gold-primary/15 px-2 py-1 text-[10px] font-black text-gold-primary">المضيف</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={copyCode}
            className="flex min-h-11 items-center gap-2 rounded-2xl border border-border bg-muted/50 px-3 text-xs font-black text-primary"
          >
            <Clipboard className="size-4" />
            <span className="hidden sm:inline">نسخ الرمز</span>
          </button>
          <button
            type="button"
            onClick={onShare}
            className="flex min-h-11 items-center gap-2 rounded-2xl bg-gold-primary px-4 text-xs font-black text-[#10251e]"
          >
            <Share2 className="size-4" /> مشاركة
          </button>
        </div>
      </div>
    </Surface>
  );
}

function Lobby({
  state,
  players,
  me,
  isHost,
  ready,
  allReady,
  minimumReached,
  onReady,
  onSelectGame,
  onStart,
  onAddBot,
  onFillBots,
  onRemoveBot,
  onBotDifficulty,
}: {
  state: RoomState;
  players: Player[];
  me: Player;
  isHost: boolean;
  ready: boolean;
  allReady: boolean;
  minimumReached: boolean;
  onReady: () => void;
  onSelectGame: (game: GameKey) => void;
  onStart: () => void;
  onAddBot: (difficulty: BotDifficulty) => void;
  onFillBots: (difficulty: BotDifficulty) => void;
  onRemoveBot: (botId: string) => void;
  onBotDifficulty: (botId: string, difficulty: BotDifficulty) => void;
}) {
  const selected = gameMeta(state.game);
  const SelectedIcon = selected.icon;
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>("medium");
  const roomLimit = selected.maxPlayers ?? 12;
  const targetPlayers = selected.exactPlayers ?? selected.minPlayers;
  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
      <Surface className="p-5 sm:p-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black text-gold-primary">اختر اللعبة</p>
            <h3 className="mt-1 text-2xl font-black text-primary">ما الذي سنلعبه؟</h3>
          </div>
          {!isHost && <span className="text-xs font-bold text-muted-foreground">الاختيار عند المضيف</span>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {GAMES.map((game) => {
            const Icon = game.icon;
            const active = game.id === state.game;
            return (
              <button
                key={game.id}
                type="button"
                disabled={!isHost}
                onClick={() => onSelectGame(game.id)}
                className={cn(
                  "relative min-h-32 rounded-3xl border-2 p-4 text-right transition",
                  active
                    ? "border-gold-primary bg-gold-primary/10 shadow-lg shadow-gold-primary/10"
                    : "border-border/60 bg-muted/25 hover:border-gold-primary/40",
                  !isHost && "cursor-default",
                )}
              >
                {active && (
                  <span className="absolute left-3 top-3 flex size-7 items-center justify-center rounded-full bg-gold-primary text-[#10251e]">
                    <Check className="size-4" strokeWidth={3} />
                  </span>
                )}
                <Icon className={cn("size-7", active ? "text-gold-primary" : "text-primary")} />
                <p className="mt-3 text-base font-black text-primary">{game.label}</p>
                <p className="mt-1 text-[11px] font-bold leading-5 text-muted-foreground">{game.short}</p>
              </button>
            );
          })}
        </div>
      </Surface>

      <div className="space-y-5">
        <Surface className="p-5 sm:p-7">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-gold-primary">الموجودون الآن</p>
              <h3 className="mt-1 text-xl font-black text-primary">{players.length} لاعبين</h3>
            </div>
            <Users className="size-7 text-primary" />
          </div>
          <div className="mt-5 space-y-2">
            {players.map((player) => (
              <div key={player.id} className="flex items-center gap-3 rounded-2xl bg-muted/35 p-3">
                <PlayerAvatar player={player} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-primary">
                    {player.name} {player.id === me.id ? "(أنت)" : ""}
                  </p>
                  {player.isBot ? (
                    <select
                      value={player.difficulty ?? "medium"}
                      disabled={!isHost}
                      onChange={(event) => onBotDifficulty(player.id, event.target.value as BotDifficulty)}
                      className="mt-1 rounded-lg border border-border bg-card px-2 py-1 text-[11px] font-black text-primary outline-none"
                    >
                      <option value="easy">سهل</option>
                      <option value="medium">متوسط</option>
                      <option value="hard">صعب</option>
                    </select>
                  ) : (
                    <p className={cn("text-[11px] font-bold", player.ready ? "text-emerald-600" : "text-muted-foreground")}>
                      {player.ready ? "جاهز" : "بانتظار الجاهزية"}
                    </p>
                  )}
                </div>
                {player.id === (players.find((item) => item.isHost)?.id ?? "") || player.isHost ? (
                  <Crown className="size-5 text-gold-primary" />
                ) : player.isBot && isHost ? (
                  <button type="button" onClick={() => onRemoveBot(player.id)} aria-label={`حذف ${player.name}`} className="flex size-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600">
                    <Trash2 className="size-4" />
                  </button>
                ) : player.ready ? (
                  <Check className="size-5 text-emerald-500" />
                ) : null}
              </div>
            ))}
          </div>

          {isHost && (
            <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
              <div className="grid grid-cols-3 gap-2">
                {(["easy", "medium", "hard"] as BotDifficulty[]).map((difficulty) => (
                  <button
                    key={difficulty}
                    type="button"
                    onClick={() => setBotDifficulty(difficulty)}
                    className={cn(
                      "rounded-xl px-2 py-2 text-[11px] font-black",
                      botDifficulty === difficulty ? "bg-gold-primary text-[#10251e]" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {difficulty === "easy" ? "سهل" : difficulty === "medium" ? "متوسط" : "صعب"}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={players.length >= roomLimit}
                  onClick={() => onAddBot(botDifficulty)}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/8 text-xs font-black text-primary disabled:opacity-35"
                >
                  <Bot className="size-4" /> إضافة بوت
                </button>
                <button
                  type="button"
                  disabled={players.length >= targetPlayers}
                  onClick={() => onFillBots(botDifficulty)}
                  className="min-h-11 rounded-xl bg-primary px-3 text-xs font-black text-primary-foreground disabled:opacity-35"
                >
                  إكمال المقاعد
                </button>
              </div>
              <p className="text-center text-[11px] font-bold text-muted-foreground">تقدر تبدأ وحدك، والبوتات جاهزة تلقائيًا</p>
            </div>
          )}
        </Surface>

        <Surface className="overflow-hidden p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-gold-primary/15">
              <SelectedIcon className="size-6 text-gold-primary" />
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground">اللعبة المختارة</p>
              <p className="text-lg font-black text-primary">{selected.label}</p>
            </div>
          </div>

          {!isHost && (
            <button
              type="button"
              onClick={onReady}
              className={cn(
                "mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-black transition active:scale-[.98]",
                ready ? "bg-emerald-500 text-white" : "bg-primary text-primary-foreground",
              )}
            >
              <Check className="size-5" /> {ready ? "أنا جاهز" : "اضغط عندما تكون جاهزًا"}
            </button>
          )}

          {isHost && (
            <button
              type="button"
              disabled={!allReady}
              onClick={onStart}
              className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-black text-primary-foreground transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Play className="size-5 fill-current" /> بدء اللعبة عند الجميع
            </button>
          )}
          <p className="mt-3 text-center text-[11px] font-bold text-muted-foreground">
            {!minimumReached
              ? selected.exactPlayers
                ? `هذه اللعبة تحتاج ${selected.exactPlayers} لاعبين بالضبط`
                : `تحتاج اللعبة إلى ${selected.minPlayers} لاعبين على الأقل`
              : allReady
                ? "الكل جاهز — يمكن البدء"
                : "بانتظار جاهزية جميع اللاعبين"}
          </p>
        </Surface>
      </div>
    </div>
  );
}

function PlayerAvatar({ player, size = "md" }: { player: Player; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "sm" ? "size-8 text-xs" : size === "lg" ? "size-16 text-xl" : "size-11 text-sm";
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [player.avatarUrl]);

  if (player.isBot) {
    return (
      <span className={cn(sizeClass, "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold-primary to-amber-700 text-[#10251e] ring-2 ring-gold-primary/35")}>
        <Bot className={size === "lg" ? "size-8" : size === "sm" ? "size-4" : "size-5"} />
      </span>
    );
  }
  return player.avatarUrl && !imageFailed ? (
    <img
      src={player.avatarUrl}
      alt=""
      onError={() => setImageFailed(true)}
      className={cn(sizeClass, "shrink-0 rounded-full object-cover ring-2 ring-gold-primary/35")}
    />
  ) : (
    <span className={cn(sizeClass, "flex shrink-0 items-center justify-center rounded-full bg-primary font-black text-primary-foreground ring-2 ring-gold-primary/35")}>
      {player.name.slice(0, 1)}
    </span>
  );
}

function Results({
  players,
  scores,
  isHost,
  onLobby,
}: {
  players: Player[];
  scores: Record<string, number>;
  isHost: boolean;
  onLobby: () => void;
}) {
  const ranked = players.slice().sort((a, b) => scoreFor(scores, b.id) - scoreFor(scores, a.id));
  return (
    <Surface className="mx-auto max-w-2xl overflow-hidden p-6 text-center sm:p-10">
      <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-gold-primary/15">
        <Trophy className="size-10 text-gold-primary" />
      </div>
      <h3 className="mt-4 text-3xl font-black text-primary">النتيجة النهائية</h3>
      <div className="mt-7 space-y-3 text-right">
        {ranked.map((player, index) => (
          <div key={player.id} className={cn("flex items-center gap-3 rounded-3xl p-4", index === 0 ? "bg-gold-primary/15" : "bg-muted/35")}>
            <span className="flex size-9 items-center justify-center rounded-full bg-card text-sm font-black text-primary">{index + 1}</span>
            <PlayerAvatar player={player} />
            <span className="min-w-0 flex-1 truncate font-black text-primary">{player.name}</span>
            <span className="text-2xl font-black text-gold-primary">{scoreFor(scores, player.id)}</span>
          </div>
        ))}
      </div>
      {isHost ? (
        <button type="button" onClick={onLobby} className="mt-7 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary font-black text-primary-foreground">
          <RefreshCcw className="size-5" /> العودة للغرفة
        </button>
      ) : (
        <p className="mt-7 text-sm font-bold text-muted-foreground">بانتظار المضيف لبدء جولة جديدة</p>
      )}
    </Surface>
  );
}

function GameBoard({
  state,
  players,
  me,
  isHost,
  now,
  dispatch,
}: {
  state: RoomState;
  players: Player[];
  me: Player;
  isHost: boolean;
  now: number;
  dispatch: (type: string, value?: any) => Promise<void>;
}) {
  const meta = gameMeta(state.game);
  const GameIcon = meta.icon;
  const logoUrl = useSiteLogo();
  const [gameMode, setGameMode] = useState(false);
  const gameModeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!gameMode) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";

    const leaveOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGameMode(false);
    };
    const syncFullscreenExit = () => {
      const webkitDocument = document as Document & { webkitFullscreenElement?: Element | null };
      if (!document.fullscreenElement && !webkitDocument.webkitFullscreenElement) setGameMode(false);
    };

    window.addEventListener("keydown", leaveOnEscape);
    document.addEventListener("fullscreenchange", syncFullscreenExit);
    document.addEventListener("webkitfullscreenchange", syncFullscreenExit);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
      window.removeEventListener("keydown", leaveOnEscape);
      document.removeEventListener("fullscreenchange", syncFullscreenExit);
      document.removeEventListener("webkitfullscreenchange", syncFullscreenExit);
    };
  }, [gameMode]);

  const enterGameMode = async () => {
    setGameMode(true);
    const element = gameModeRef.current as (HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> | void }) | null;
    try {
      if (element?.requestFullscreen) await element.requestFullscreen();
      else await element?.webkitRequestFullscreen?.();
    } catch {
      // iOS browsers may reject the native API; the fixed 100dvh game shell remains active.
    }
  };

  const leaveGameMode = async () => {
    setGameMode(false);
    const webkitDocument = document as Document & {
      webkitExitFullscreen?: () => Promise<void> | void;
      webkitFullscreenElement?: Element | null;
    };
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (webkitDocument.webkitFullscreenElement) await webkitDocument.webkitExitFullscreen?.();
    } catch {
      // The visual game shell is closed even if the browser owns fullscreen state.
    }
  };

  return (
    <div
      ref={gameModeRef}
      className={cn(
        "grid gap-5 lg:grid-cols-[1fr_260px]",
        gameMode && "fixed inset-0 z-[9999] block h-screen h-[100dvh] w-screen overflow-hidden bg-[#031d18]",
      )}
    >
      <Surface className={cn("min-h-[520px] overflow-hidden p-5 sm:p-8", gameMode && "flex h-full min-h-0 flex-col rounded-none border-0 bg-[#031d18] p-0 shadow-none")}>
        <div
          className={cn(
            "mb-7 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-5",
            gameMode && "relative mb-0 min-h-[82px] shrink-0 border-white/10 bg-[radial-gradient(circle_at_50%_0%,#0b5a48_0%,#052d26_58%,#031f1a_100%)] px-3 pb-2 text-white shadow-lg",
          )}
          style={gameMode ? { paddingTop: "max(.5rem, env(safe-area-inset-top))" } : undefined}
        >
          {gameMode ? (
            <>
              <div className="pointer-events-none absolute inset-x-20 bottom-2 top-2 flex items-center justify-center gap-2 text-center">
                <GameIcon className="size-7 shrink-0 text-[#e8c66f] drop-shadow" />
                <div>
                  <h3 className="text-[1.35rem] font-black leading-none text-[#edcf7d]">{meta.label}</h3>
                  <p className="mt-1 text-[11px] font-bold text-white/50">الجولة {state.round + 1}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void leaveGameMode()}
                className="relative z-10 flex min-h-11 items-center gap-2 rounded-full border border-[#e8c66f]/25 bg-white/10 px-4 text-sm font-black text-white shadow"
                aria-label="إغلاق وضع اللعبة"
              >
                <Minimize2 className="size-4" /> رجوع
              </button>
              <span aria-hidden className="relative z-10 flex size-11 items-center justify-center rounded-full border border-[#e8c66f]/25 bg-[#e8c66f]/10">
                <Users className="size-5 text-[#e8c66f]" />
                <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-[#e8c66f] text-[10px] font-black text-[#06352c]">{players.length}</span>
              </span>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-gold-primary/15">
                  <GameIcon className="size-6 text-gold-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground">الجولة {state.round + 1}</p>
                  <h3 className="text-xl font-black text-primary">{meta.label}</h3>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void enterGameMode()}
                  className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-3 text-xs font-black text-primary-foreground shadow lg:hidden"
                >
                  <Maximize2 className="size-4" /> وضع اللعبة
                </button>
                {isHost && (
                  <button type="button" onClick={() => void dispatch("finish")} className="rounded-xl bg-muted px-4 py-2 text-xs font-black text-muted-foreground">
                    إنهاء اللعبة
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <div
          className={cn(gameMode && "min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[radial-gradient(circle_at_50%_12%,rgba(23,102,80,.32),transparent_42%),linear-gradient(#031d18,#021713)] px-2 py-2 sm:px-4")}
          style={gameMode ? { paddingBottom: "max(.75rem, env(safe-area-inset-bottom))" } : undefined}
        >
          {state.game === "uno" && <UnoRoom state={state} players={players} me={me} logoUrl={logoUrl} immersive={gameMode} dispatch={dispatch} />}
          {state.game === "saudi-deal" && <SaudiDealRoom state={state} players={players} me={me} logoUrl={logoUrl} immersive={gameMode} dispatch={dispatch} />}
          {state.game === "trivia" && <TriviaGame state={state} players={players} me={me} isHost={isHost} dispatch={dispatch} />}
          {state.game === "judge" && <JudgeGame state={state} players={players} me={me} isHost={isHost} dispatch={dispatch} />}
          {state.game === "challenge30" && <ChallengeGame state={state} players={players} me={me} isHost={isHost} now={now} dispatch={dispatch} />}
          {state.game === "auction" && <AuctionRoom state={state} players={players} me={me} isHost={isHost} dispatch={dispatch} />}
          {state.game === "word-duel" && <WordDuelRoom state={state} players={players} me={me} dispatch={dispatch} />}
          {state.game === "wheel" && <WheelRoom state={state} players={players} isHost={isHost} dispatch={dispatch} />}
          {state.game === "baloot" && <BalootRoom state={state} players={players} me={me} isHost={isHost} logoUrl={logoUrl} immersive={gameMode} dispatch={dispatch} />}
        </div>
      </Surface>

      {!gameMode && <ScoreRail players={players} scores={state.scores} hostId={players.find((player) => player.isHost)?.id} />}
    </div>
  );
}

function ScoreRail({ players, scores, hostId }: { players: Player[]; scores: Record<string, number>; hostId?: string }) {
  const ranked = players.slice().sort((a, b) => scoreFor(scores, b.id) - scoreFor(scores, a.id));
  return (
    <Surface className="h-fit p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Medal className="size-5 text-gold-primary" />
        <h4 className="font-black text-primary">اللاعبون والنتائج</h4>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {ranked.map((player, index) => (
          <div key={player.id} className="flex items-center gap-2 rounded-2xl bg-muted/35 p-2.5">
            <span className="w-5 text-center text-xs font-black text-muted-foreground">{index + 1}</span>
            <PlayerAvatar player={player} size="sm" />
            <span className="min-w-0 flex-1 truncate text-xs font-black text-primary">{player.name}</span>
            {player.id === hostId && <Crown className="size-3.5 text-gold-primary" />}
            <span className="rounded-xl bg-card px-2 py-1 text-xs font-black text-gold-primary">{scoreFor(scores, player.id)}</span>
          </div>
        ))}
      </div>
    </Surface>
  );
}

function PrimaryAction({
  children,
  onClick,
  disabled,
  tone = "primary",
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "primary" | "gold" | "muted" | "success" | "danger";
}) {
  const tones = {
    primary: "bg-primary text-primary-foreground",
    gold: "bg-gold-primary text-[#10251e]",
    muted: "bg-muted text-muted-foreground",
    success: "bg-emerald-600 text-white",
    danger: "bg-rose-600 text-white",
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-35",
        tones[tone],
      )}
    >
      {children}
    </button>
  );
}

function orderPlayersAroundMe(players: Player[], meId: string) {
  const myIndex = players.findIndex((player) => player.id === meId);
  if (myIndex <= 0) return players;
  return [...players.slice(myIndex), ...players.slice(0, myIndex)];
}

function GameTableSurface({
  children,
  className,
  trim = "gold",
}: {
  children: ReactNode;
  className?: string;
  trim?: "gold" | "uno" | "ivory";
}) {
  const trimClass = trim === "uno"
    ? "from-rose-600 via-amber-400 to-blue-700"
    : trim === "ivory"
      ? "from-[#f5e6bd] via-[#76502b] to-[#e2c17d]"
      : "from-[#d9b568] via-[#68401f] to-[#bd8b3e]";
  const heritageTable = trim === "gold";
  return (
    <div
      className={cn(
        "rounded-[48%] bg-gradient-to-br p-[6px] shadow-[0_34px_70px_-30px_rgba(0,0,0,.95)] sm:rounded-[38px] sm:p-[7px]",
        heritageTable && "p-[9px] sm:p-[10px]",
        trimClass,
      )}
      style={heritageTable ? {
        backgroundImage: "repeating-linear-gradient(112deg,#2d170b 0 9px,#7a4b25 9px 17px,#3b2110 17px 24px,#a46d35 24px 30px)",
      } : undefined}
    >
      <div className="rounded-[47%] bg-gradient-to-br from-[#f2d58b] via-[#8f602f] to-[#e6c06a] p-[2px] sm:rounded-[32px]">
        <div
          className={cn("relative isolate overflow-hidden rounded-[46%] border border-[#f2d999]/45 bg-[#073d32] text-white sm:rounded-[29px]", className)}
          style={{
            backgroundImage:
              "radial-gradient(circle at 50% 44%, rgba(19,112,84,.35), transparent 48%), linear-gradient(135deg, rgba(236,207,124,.035) 25%, transparent 25%, transparent 50%, rgba(236,207,124,.035) 50%, rgba(236,207,124,.035) 75%, transparent 75%, transparent)",
            backgroundSize: "auto, 28px 28px",
          }}
        >
          <div aria-hidden className="pointer-events-none absolute inset-3 rounded-[44%] border border-[#e5c878]/28 sm:rounded-[23px]" />
          <div aria-hidden className="pointer-events-none absolute inset-5 rounded-[43%] border border-[#e5c878]/10 sm:rounded-[20px]" />
          {children}
        </div>
      </div>
    </div>
  );
}

function TableBrandSeal({
  logoUrl,
  className,
}: {
  logoUrl: string | null;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none flex size-28 shrink-0 items-center justify-center rounded-full border-2 border-[#d8b663]/70 bg-[#f8f3e6]/95 p-2 shadow-[0_12px_32px_-18px_rgba(0,0,0,.9)] sm:size-36",
        className,
      )}
    >
      {logoUrl ? (
        <img src={logoUrl} alt="" className="size-full object-contain" />
      ) : (
        <span className="flex size-full items-center justify-center rounded-full border border-[#b9954d] text-center text-base font-black text-[#0b4d3f] sm:text-xl">
          السيف
        </span>
      )}
    </div>
  );
}

function TablePlayerSeat({
  player,
  active,
  detail,
  children,
  className,
}: {
  player: Player;
  active: boolean;
  detail?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl border bg-[#031f1a]/88 p-2 text-center shadow-[0_10px_22px_-14px_rgba(0,0,0,.95)] backdrop-blur-sm transition sm:p-3",
        active ? "border-[#e1bd66] ring-2 ring-[#e1bd66]/25" : "border-white/15",
        className,
      )}
    >
      <div className="flex min-w-0 items-center justify-center gap-1.5">
        <PlayerAvatar player={player} size="sm" />
        <p className="min-w-0 truncate text-xs font-black text-white sm:text-sm">{player.name}</p>
        {player.isBot && <Bot className="size-3.5 shrink-0 text-[#e1bd66]" />}
      </div>
      {detail && <div className="mt-1 text-[11px] font-bold text-white/65 sm:text-xs">{detail}</div>}
      {children}
    </div>
  );
}

function BrandedCardBack({
  label = "السيف",
  count,
  compact = false,
  className,
}: {
  label?: string;
  count?: number;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border-[3px] border-[#f6e8c2] bg-gradient-to-br from-[#0d5c4a] via-[#052d26] to-[#0a4c3e] p-1 text-[#f0d184] shadow-xl",
        compact ? "h-20 w-14" : "h-28 w-[76px] sm:h-32 sm:w-[86px]",
        className,
      )}
    >
      <span aria-hidden className="absolute inset-1 rounded-lg border border-[#d6b45f]/65" />
      <span aria-hidden className="absolute inset-2 rotate-45 rounded-lg border border-[#d6b45f]/20" />
      <span className="relative text-center text-xs font-black leading-4 sm:text-sm">{label}</span>
      {count != null && <span className="absolute bottom-1.5 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-black text-white">{count}</span>}
    </div>
  );
}

function CardHandTray({
  children,
  className,
  immersive = false,
}: {
  children: ReactNode;
  className?: string;
  immersive?: boolean;
}) {
  return (
    <div className={cn("rounded-[32px] bg-gradient-to-br from-[#b58a43] via-[#5d381d] to-[#9d6d30] p-1.5 shadow-[0_18px_40px_-28px_rgba(0,0,0,.85)]", immersive && "sticky bottom-0 z-30 rounded-b-none")}>
      <div className={cn("flex min-h-48 gap-2 overflow-x-auto rounded-[26px] border border-[#e7cb8e]/30 bg-[#07382f] p-4 pb-5", className)}>
        {children}
      </div>
    </div>
  );
}

function unoValueLabel(value: string) {
  if (value === "skip") return "تخطي";
  if (value === "reverse") return "عكس";
  if (value === "draw2") return "+2";
  if (value === "wild") return "اختيار لون";
  if (value === "wild4") return "+4";
  return value;
}

function UnoCardFace({
  card,
  small = false,
  active = true,
  onClick,
}: {
  card: UnoCard;
  small?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const colorClass: Record<UnoColor, string> = {
    red: "from-rose-500 to-red-700",
    blue: "from-blue-500 to-blue-800",
    green: "from-emerald-500 to-green-800",
    yellow: "from-amber-300 to-amber-500 text-[#2b2513]",
    wild: "from-slate-900 via-[#183a32] to-black",
  };
  const content = (
    <>
      <span className="absolute right-2 top-1.5 text-xs font-black">{unoValueLabel(card.value)}</span>
      <span className="flex aspect-[.72] w-[70%] rotate-12 items-center justify-center rounded-[50%] bg-white/90 text-center text-xl font-black text-slate-900 shadow-inner sm:text-2xl">
        {unoValueLabel(card.value)}
      </span>
      <span className="absolute bottom-1.5 left-2 rotate-180 text-xs font-black">{unoValueLabel(card.value)}</span>
    </>
  );
  const className = cn(
    "relative flex shrink-0 select-none items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-gradient-to-br font-black text-white shadow-xl",
    colorClass[card.color],
    small ? "h-24 w-16" : "h-36 w-24 sm:h-44 sm:w-28",
    !active && "opacity-35 grayscale-[.35]",
  );
  if (!onClick) return <div className={className}>{content}</div>;
  return (
    <button type="button" disabled={!active} onClick={onClick} className={cn(className, active && "transition hover:-translate-y-2 active:scale-95")}>
      {content}
    </button>
  );
}

function UnoRoom({
  state,
  players,
  me,
  logoUrl,
  immersive,
  dispatch,
}: {
  state: RoomState;
  players: Player[];
  me: Player;
  logoUrl: string | null;
  immersive: boolean;
  dispatch: (type: string, value?: any) => Promise<void>;
}) {
  const data = state.data;
  const hand = (data.hands[me.id] ?? []) as UnoCard[];
  const active = players[data.turnIndex % Math.max(players.length, 1)];
  const amActive = active?.id === me.id;
  const top = data.discard[data.discard.length - 1] as UnoCard;
  const [choosingWild, setChoosingWild] = useState<UnoCard | null>(null);
  const colorClass: Record<string, string> = {
    red: "bg-red-600",
    blue: "bg-blue-600",
    green: "bg-emerald-600",
    yellow: "bg-amber-400 text-slate-900",
  };
  const opponents = players.filter((player) => player.id !== me.id);

  const play = (card: UnoCard) => {
    if (card.color === "wild") {
      setChoosingWild(card);
      return;
    }
    void dispatch("uno-play", { cardId: card.id });
  };

  return (
    <div className={cn("space-y-6", immersive && "space-y-3")}>
      <GameTableSurface trim="uno" className={cn("min-h-[480px] sm:min-h-[590px]", immersive && "h-[54dvh] min-h-[440px] max-h-[540px]")}>
        <div className={cn("relative z-10 flex min-h-[480px] flex-col justify-between px-7 py-4 sm:min-h-[590px] sm:p-5", immersive && "h-full min-h-0")}>
          <div className="flex min-h-[92px] gap-2 overflow-x-auto pb-1">
            {opponents.map((player) => {
              const cardCount = data.hands[player.id]?.length ?? 0;
              return (
                <TablePlayerSeat
                  key={player.id}
                  player={player}
                  active={active?.id === player.id}
                  detail={`${cardCount} أوراق`}
                  className="min-w-[112px] flex-1 sm:min-w-[132px]"
                >
                  <div className="mt-1.5 flex justify-center -space-x-2 space-x-reverse">
                    {Array.from({ length: Math.min(cardCount, 4) }).map((_, index) => (
                      <BrandedCardBack key={index} label="" compact className="h-8 w-5 rounded-md border-2 p-0 shadow" />
                    ))}
                  </div>
                  {data.unoCalled[player.id] && <span className="mt-1 inline-block rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-black text-white">أونو!</span>}
                </TablePlayerSeat>
              );
            })}
          </div>

          <div className="grid flex-1 grid-cols-[minmax(68px,1fr)_auto_minmax(68px,1fr)] items-center gap-2 py-3 sm:grid-cols-[1fr_auto_1fr] sm:gap-5">
            <div className="text-center sm:text-right">
              <p className="text-[11px] font-black text-[#edcc7c] sm:text-sm">الدور الآن</p>
              <p className="mt-1 truncate text-sm font-black sm:text-xl">{active?.name ?? "—"}</p>
              <div className="mt-2 flex items-center justify-center gap-1.5 sm:justify-start">
                <span className={cn("size-3.5 shrink-0 rounded-full ring-2 ring-white/25", colorClass[data.currentColor])} />
                <span className="text-[10px] font-bold text-white/65 sm:text-sm">
                  {UNO_COLOR_LABELS[data.currentColor as Exclude<UnoColor, "wild">] ?? data.currentColor}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3">
              <TableBrandSeal logoUrl={logoUrl} className="size-24 sm:size-32" />
              <div className="flex items-end justify-center gap-2 sm:gap-3">
                <button
                  type="button"
                  aria-label="سحب ورقة من رزمة أونو"
                  disabled={!amActive || Boolean(data.drawnCardId)}
                  onClick={() => void dispatch("uno-draw")}
                  className="transition enabled:hover:-translate-y-1 enabled:active:scale-95 disabled:opacity-45"
                >
                  <BrandedCardBack label="أونو" count={data.drawPile.length} compact className="h-24 w-16 sm:h-28 sm:w-[76px]" />
                </button>
                <UnoCardFace card={top} small />
              </div>
            </div>

            <div className="text-center sm:text-left">
              <p className="text-[10px] font-bold text-white/55 sm:text-xs">اتجاه اللعب</p>
              <p className="mt-1 text-2xl font-black text-[#edcc7c] sm:text-4xl">{data.direction === 1 ? "↺" : "↻"}</p>
              <p className="mt-1 text-[10px] font-bold leading-4 text-white/60 sm:text-xs">{data.direction === 1 ? "المعتاد" : "معكوس"}</p>
            </div>
          </div>

          <TablePlayerSeat
            player={me}
            active={amActive}
            detail={`يدك · ${hand.length} أوراق`}
            className="mx-auto w-full max-w-[220px] border-[#dfbd6a]/40"
          />
        </div>
      </GameTableSurface>

      {choosingWild && (
        <div className="rounded-3xl border-2 border-gold-primary bg-gold-primary/8 p-5 text-center">
          <p className="mb-4 font-black text-primary">اختر اللون الذي سيكمل عليه اللعب</p>
          <div className="grid grid-cols-4 gap-2">
            {UNO_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => {
                  void dispatch("uno-play", { cardId: choosingWild.id, color });
                  setChoosingWild(null);
                }}
                className={cn("h-14 rounded-2xl text-xs font-black text-white", colorClass[color])}
              >
                {UNO_COLOR_LABELS[color]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-muted-foreground">أوراقك الخاصة</p>
            <p className="font-black text-primary">{hand.length} أوراق</p>
          </div>
          {amActive && hand.length <= 2 && !data.unoCalled[me.id] && (
            <button type="button" onClick={() => void dispatch("uno-call")} className="rounded-full bg-rose-600 px-5 py-2 text-sm font-black text-white shadow-lg">
              أونو!
            </button>
          )}
        </div>
        <CardHandTray immersive={immersive}>
          {hand.map((card) => {
            const playable = amActive && unoPlayable(card, data, hand) && (!data.drawnCardId || data.drawnCardId === card.id);
            return <UnoCardFace key={card.id} card={card} active={playable} onClick={() => play(card)} />;
          })}
        </CardHandTray>
      </div>

      {amActive && data.drawnCardId && (
        <PrimaryAction onClick={() => void dispatch("uno-pass")} tone="muted">تمرير الدور بدون لعب الورقة</PrimaryAction>
      )}
      {!amActive && <p className="text-center text-sm font-bold text-muted-foreground">بانتظار {active?.name} — ستتحدث الطاولة عندك تلقائيًا</p>}
    </div>
  );
}

function dealGroup(card: DealCard) {
  return DEAL_GROUPS.find((group) => group.id === card.group);
}

function dealGroupIcon(groupId?: string): LucideIcon {
  if (groupId === "najd") return Landmark;
  if (groupId === "hijaz") return Building2;
  if (groupId === "sharqiya") return Waves;
  if (groupId === "shamal") return Mountain;
  if (groupId === "janoub") return Trees;
  if (groupId === "wasat") return Building2;
  if (groupId === "sahil") return Waves;
  if (groupId === "wadi") return Mountain;
  return MapPin;
}

function DealCardFace({ card, compact = false }: { card: DealCard; compact?: boolean }) {
  const group = dealGroup(card);
  const PropertyIcon = dealGroupIcon(card.group);
  const ActionIcon = card.action === "draw2" ? Sparkles : card.action === "rent" ? Banknote : Gavel;

  if (card.type === "property") {
    return (
      <div
        className={cn(
          "relative flex shrink-0 flex-col overflow-hidden rounded-2xl border-[3px] border-[#fffaf0] bg-[#fbf5e8] text-[#123b32] shadow-xl",
          compact ? "h-28 w-[72px]" : "h-44 w-32 sm:h-48 sm:w-36",
        )}
      >
        <div className={cn("flex items-center justify-between gap-1 px-2 text-white", compact ? "h-7" : "h-10 px-3")} style={{ backgroundColor: group?.color ?? "#49645b" }}>
          <span className={cn("truncate font-black", compact ? "text-[9px]" : "text-xs")}>{group?.label ?? "مدينة"}</span>
          <MapPin className={compact ? "size-3" : "size-4"} />
        </div>
        <div
          className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-1 text-center"
          style={{
            backgroundImage: `linear-gradient(145deg, ${group?.color ?? "#49645b"}16, transparent 58%)`,
          }}
        >
          <PropertyIcon className={cn("mb-1", compact ? "size-6" : "size-11")} style={{ color: group?.color ?? "#49645b" }} />
          <span className={cn("font-black leading-tight", compact ? "text-[10px]" : "text-sm sm:text-base")}>{card.label}</span>
          {!compact && <span className="mt-1 text-[10px] font-bold text-[#123b32]/55">ملكية سعودية</span>}
        </div>
        <div className={cn("flex items-center justify-between border-t border-[#173f35]/10 px-2 font-black", compact ? "h-6 text-[9px]" : "h-8 px-3 text-[11px]")}>
          <span>سعودي ديل</span>
          <span style={{ color: group?.color }}>{card.value}م</span>
        </div>
      </div>
    );
  }

  const isMoney = card.type === "money";
  const FeatureIcon = isMoney ? Banknote : ActionIcon;
  return (
    <div
      className={cn(
        "relative flex shrink-0 flex-col overflow-hidden rounded-2xl border-[3px] border-[#fff5d9] p-2 text-white shadow-xl",
        isMoney ? "bg-gradient-to-br from-[#0f6b54] via-[#073c32] to-[#04251f]" : "bg-gradient-to-br from-[#a7702d] via-[#744313] to-[#321d0b]",
        compact ? "h-28 w-[72px]" : "h-44 w-32 sm:h-48 sm:w-36",
      )}
    >
      <span aria-hidden className="absolute inset-1 rounded-xl border border-[#f3d58d]/35" />
      <span className={cn("relative font-black text-white/70", compact ? "text-[9px]" : "text-xs")}>
        {isMoney ? "بنك السيف" : "بطاقة حركة"}
      </span>
      <FeatureIcon className={cn("relative mx-auto mt-auto text-[#f0cf78]", compact ? "size-7" : "size-12")} />
      <span className={cn("relative mt-2 text-center font-black leading-tight", compact ? "text-[10px]" : "text-sm sm:text-base")}>{card.label}</span>
      <span className={cn("relative mt-auto self-end rounded-full bg-black/25 px-2 py-1 font-black", compact ? "text-[9px]" : "text-[11px]")}>{card.value}م</span>
    </div>
  );
}

function PlayerDealSeat({
  player,
  data,
  highlight,
  className,
}: {
  player: Player;
  data: any;
  highlight: boolean;
  className?: string;
}) {
  const properties = (data.properties[player.id] ?? []) as DealCard[];
  const bank = (data.banks[player.id] ?? []) as DealCard[];
  const sets = completedDealSets(properties);
  return (
    <TablePlayerSeat
      player={player}
      active={highlight}
      detail={`${data.hands[player.id]?.length ?? 0} ورق · ${sets}/3`}
      className={cn("w-full", className)}
    >
      <div className="mt-1 flex h-5 items-end justify-center -space-x-1.5 space-x-reverse overflow-hidden sm:mt-2 sm:h-8 sm:-space-x-2">
        {properties.slice(0, 7).map((property) => (
          <span
            key={property.id}
            title={property.label}
            className="h-5 w-4 shrink-0 rounded-t border border-white/70 shadow sm:h-7 sm:w-5"
            style={{ backgroundColor: dealGroup(property)?.color ?? "#49645b" }}
          />
        ))}
        {!properties.length && <span className="self-center text-[10px] font-bold text-white/40">لا توجد أملاك</span>}
      </div>
      <div className="mt-2 hidden items-center justify-between gap-1 border-t border-white/10 pt-1.5 text-[11px] font-black text-white/70 sm:flex">
        <span>{sets}/3 مجموعات</span>
        <span className="text-[#edcc7c]">{bank.reduce((sum, card) => sum + card.value, 0)}م</span>
      </div>
    </TablePlayerSeat>
  );
}

function DealImmersiveSeat({
  player,
  data,
  active,
  position,
}: {
  player: Player;
  data: any;
  active: boolean;
  position: "top" | "right" | "bottom" | "left";
}) {
  const cardCount = data.hands[player.id]?.length ?? 0;
  const positionClass = {
    top: "left-1/2 top-3 -translate-x-1/2",
    right: "right-0.5 top-1/2 -translate-y-1/2",
    bottom: "bottom-3 left-1/2 -translate-x-1/2",
    left: "left-0.5 top-1/2 -translate-y-1/2",
  }[position];

  const identity = (
    <div className="flex flex-col items-center">
      <div className={cn("rounded-full border-2 bg-[#062d26] p-1 shadow-xl transition", active ? "border-[#f3cf72] shadow-[0_0_22px_rgba(240,196,91,.75)]" : "border-[#d3b768]/70")}>
        <PlayerAvatar player={player} />
      </div>
      <div className={cn("-mt-1 flex min-w-[72px] max-w-[92px] items-center justify-center gap-1 rounded-full border px-2.5 py-1 text-center text-[11px] font-black shadow-lg", active ? "border-[#f3cf72] bg-[#0a4c3e] text-[#f5d47c]" : "border-[#d3b768]/70 bg-[#06352c] text-white")}>
        <span className="truncate">{player.name.split(" ")[0]}</span>
        {player.isBot && <Bot className="size-3 shrink-0 text-[#edcc7c]" />}
      </div>
    </div>
  );

  const cards = (
    <div className="relative h-10 w-20" aria-label={`${cardCount} أوراق`}>
      {Array.from({ length: Math.min(cardCount, 5) }).map((_, index, visibleCards) => {
        const middle = (visibleCards.length - 1) / 2;
        const offset = (index - middle) * 8;
        const angle = (index - middle) * 7;
        return (
          <span
            key={index}
            aria-hidden
            className="absolute bottom-0 left-1/2 flex h-9 w-6 origin-bottom items-center justify-center rounded border-2 border-[#f5e5b9] bg-gradient-to-br from-[#0d5c4a] via-[#052d26] to-[#0a4c3e] text-[7px] font-black text-[#e7ca79] shadow-md"
            style={{ transform: `translateX(calc(-50% + ${offset}px)) rotate(${angle}deg)` }}
          >
            س
          </span>
        );
      })}
    </div>
  );

  return (
    <div className={cn("absolute z-30 flex w-24 flex-col items-center", positionClass)}>
      {position === "bottom" ? <>{cards}{identity}</> : <>{identity}{cards}</>}
    </div>
  );
}

function SaudiDealRoom({
  state,
  players,
  me,
  logoUrl,
  immersive,
  dispatch,
}: {
  state: RoomState;
  players: Player[];
  me: Player;
  logoUrl: string | null;
  immersive: boolean;
  dispatch: (type: string, value?: any) => Promise<void>;
}) {
  const data = state.data;
  const active = players[data.turnIndex % Math.max(players.length, 1)];
  const amActive = active?.id === me.id;
  const hand = (data.hands[me.id] ?? []) as DealCard[];
  const seatedPlayers = useMemo(() => orderPlayersAroundMe(players, me.id), [players, me.id]);
  const lastDiscard = data.discard[data.discard.length - 1] as DealCard | undefined;
  const [pendingAction, setPendingAction] = useState<DealCard | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const selectedCard = hand.find((card) => card.id === selectedCardId) ?? null;

  useEffect(() => setPendingAction(null), [data.turnIndex]);
  useEffect(() => {
    if (selectedCardId && !hand.some((card) => card.id === selectedCardId)) {
      setSelectedCardId(null);
      return;
    }
    if (!selectedCardId && hand.length && amActive && !data.needsDraw) setSelectedCardId(hand[0].id);
  }, [hand, selectedCardId, amActive, data.needsDraw]);

  const useAction = (card: DealCard) => {
    if (card.action === "draw2") {
      void dispatch("deal-action", { cardId: card.id });
      return;
    }
    setPendingAction(card);
  };

  const seatPositions = [
    "col-start-2 row-start-3 self-end justify-self-center",
    "col-start-1 row-start-2 self-center justify-self-start",
    "col-start-2 row-start-1 self-start justify-self-center",
    "col-start-3 row-start-2 self-center justify-self-end",
  ];

  return (
    <div className={cn("space-y-5", immersive && "space-y-3")}>
      <div className={cn("grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-[#dbc58d] bg-[#f7efdc] px-3 py-2.5 text-[#173e34] shadow-sm sm:px-5 sm:py-3", immersive && "sticky top-0 z-40 rounded-[24px] px-4 shadow-[0_12px_28px_-20px_rgba(0,0,0,.9)]")}>
        <div className="flex min-w-0 items-center gap-2.5">
          {active && <PlayerAvatar player={active} size="sm" />}
          <div className="min-w-0">
            <p className="truncate text-sm font-black sm:text-base">الدور عند {active?.name?.split(" ")[0] ?? "—"}</p>
            <p className="truncate text-xs font-bold text-[#173e34]/55">{data.lastAction}</p>
          </div>
        </div>
        <div className="rounded-xl bg-[#0b5b47] px-3 py-2 text-center text-white">
          <p className="text-[10px] font-bold text-white/60">{data.needsDraw ? "الخطوة التالية" : "المتبقي"}</p>
          <p className="text-sm font-black text-[#efd07d]">
            {data.needsDraw
              ? "اسحب أوراقك"
              : data.actionsLeft === 2
                ? "حركتان متبقيتان"
                : data.actionsLeft === 1
                  ? "حركة متبقية"
                  : "انتهت الحركات"}
          </p>
        </div>
      </div>

      {immersive ? (
        <GameTableSurface className="h-[62dvh] min-h-[510px] max-h-[700px]">
          <div className="relative z-10 h-full min-h-0 w-full">
            {seatedPlayers.slice(0, 4).map((player, index) => (
              <DealImmersiveSeat
                key={player.id}
                player={player}
                data={data}
                active={active?.id === player.id}
                position={(["bottom", "left", "top", "right"] as const)[index]}
              />
            ))}

            <div className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3">
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  aria-label={`سحب ${hand.length ? 2 : 5} أوراق من رزمة سعودي ديل`}
                  disabled={!amActive || !data.needsDraw}
                  onClick={() => void dispatch("deal-draw")}
                  className="transition enabled:hover:-translate-y-1 enabled:active:scale-95 disabled:opacity-65"
                >
                  <BrandedCardBack label={amActive && data.needsDraw ? "اسحب" : "السيف"} count={data.drawPile.length} compact className="h-[72px] w-12 rounded-lg" />
                </button>

                <div className="rounded-full border border-[#f0d17a]/55 bg-[#06392f]/90 p-1.5 shadow-[0_0_28px_rgba(224,187,92,.2)]">
                  <TableBrandSeal logoUrl={logoUrl} className="size-[74px] border-[3px] sm:size-24" />
                </div>

                {lastDiscard ? (
                  <div className="h-[72px] w-12 overflow-hidden rounded-lg">
                    <div className="origin-top-left scale-[.65]"><DealCardFace card={lastDiscard} compact /></div>
                  </div>
                ) : (
                  <div className="flex h-[72px] w-12 items-center justify-center rounded-lg border-2 border-dashed border-white/25 text-center text-[8px] font-black leading-3 text-white/40">
                    الأوراق<br />الملعوبة
                  </div>
                )}
              </div>

              <p className="max-w-[270px] truncate rounded-full border border-white/5 bg-black/25 px-4 py-1.5 text-center text-[11px] font-bold text-white/65">{data.lastAction}</p>
            </div>
          </div>
        </GameTableSurface>
      ) : (
        <GameTableSurface className="min-h-[500px] sm:min-h-[680px]">
          <div className="relative z-10 grid min-h-[500px] grid-cols-[66px_minmax(120px,1fr)_66px] grid-rows-[94px_minmax(270px,1fr)_94px] gap-1 p-2 sm:min-h-[680px] sm:grid-cols-[150px_minmax(220px,1fr)_150px] sm:grid-rows-[138px_minmax(360px,1fr)_138px] sm:gap-3 sm:p-5">
            {seatedPlayers.slice(0, 4).map((player, index) => (
              <PlayerDealSeat
                key={player.id}
                player={player}
                data={data}
                highlight={active?.id === player.id}
                className={cn("relative z-20 max-w-[190px]", seatPositions[index])}
              />
            ))}

            <div className="relative z-10 col-span-3 col-start-1 row-start-2 flex flex-col items-center justify-center gap-2">
              <div className="relative h-[134px] w-[240px] sm:h-[190px] sm:w-[330px]">
                <TableBrandSeal logoUrl={logoUrl} className="absolute left-1/2 top-1/2 size-[82px] -translate-x-1/2 -translate-y-1/2 sm:size-32" />
                <button
                  type="button"
                  aria-label={`سحب ${hand.length ? 2 : 5} أوراق من رزمة سعودي ديل`}
                  disabled={!amActive || !data.needsDraw}
                  onClick={() => void dispatch("deal-draw")}
                  className="absolute right-0 top-1/2 -translate-y-1/2 transition enabled:hover:-translate-y-[54%] enabled:active:scale-95 disabled:opacity-55"
                >
                  <BrandedCardBack label={amActive && data.needsDraw ? "اسحب" : "سعودي ديل"} count={data.drawPile.length} compact className="h-24 w-16 sm:h-28 sm:w-[72px]" />
                </button>
                {lastDiscard ? (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2"><DealCardFace card={lastDiscard} compact /></div>
                ) : (
                  <div className="absolute left-0 top-1/2 flex h-24 w-16 -translate-y-1/2 items-center justify-center rounded-2xl border-2 border-dashed border-white/20 text-center text-[10px] font-black text-white/35 sm:h-28 sm:w-[72px]">
                    الأوراق<br />الملعوبة
                  </div>
                )}
              </div>

              <p className="max-w-[220px] truncate rounded-full bg-black/25 px-3 py-1 text-center text-[10px] font-bold text-white/60 sm:max-w-[300px] sm:text-xs">{data.lastAction}</p>
            </div>
          </div>
        </GameTableSurface>
      )}

      {pendingAction?.action === "rent" && (
        <div className="rounded-3xl border-2 border-gold-primary bg-gold-primary/8 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-black text-primary">من سيدفع الإيجار؟</p>
              <p className="text-xs font-bold text-muted-foreground">قيمة الإيجار تعتمد على أكبر مجموعة لديك</p>
            </div>
            <button type="button" onClick={() => setPendingAction(null)} className="text-xs font-black text-muted-foreground">إلغاء</button>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {players.filter((player) => player.id !== me.id).map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => {
                  void dispatch("deal-action", { cardId: pendingAction.id, targetId: player.id });
                  setPendingAction(null);
                }}
                className="flex items-center gap-2 rounded-2xl bg-card p-3 text-right font-black text-primary shadow"
              >
                <PlayerAvatar player={player} size="sm" /> {player.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {pendingAction?.action === "steal" && (
        <div className="rounded-3xl border-2 border-gold-primary bg-gold-primary/8 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-black text-primary">اختر أرضًا للاستحواذ</p>
              <p className="text-xs font-bold text-muted-foreground">لا يمكن أخذ أرض من مجموعة مكتملة</p>
            </div>
            <button type="button" onClick={() => setPendingAction(null)} className="text-xs font-black text-muted-foreground">إلغاء</button>
          </div>
          <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
            {players.filter((player) => player.id !== me.id).flatMap((player) =>
              ((data.properties[player.id] ?? []) as DealCard[]).map((property) => (
                <button
                  key={property.id}
                  type="button"
                  onClick={() => {
                    void dispatch("deal-action", { cardId: pendingAction.id, targetId: player.id, propertyId: property.id });
                    setPendingAction(null);
                  }}
                  className="space-y-2"
                >
                  <DealCardFace card={property} compact />
                  <span className="block max-w-20 truncate text-[10px] font-black text-primary">من {player.name}</span>
                </button>
              )),
            )}
          </div>
        </div>
      )}

      <div className={cn(immersive && "sticky bottom-0 z-30 -mx-2 rounded-t-[30px] border-t border-[#dfbd66]/20 bg-[#031d18]/96 p-2 pt-3 shadow-[0_-24px_48px_-26px_rgba(0,0,0,.95)] backdrop-blur-xl")}>
        {hand.length > 7 && <p className="mb-3 rounded-xl bg-rose-500/10 p-3 text-center text-xs font-black text-rose-700">يجب التخلص من {hand.length - 7} أوراق قبل إنهاء الدور</p>}

        {selectedCard && amActive && !data.needsDraw && (data.actionsLeft > 0 || hand.length > 7) && (
          <div className={cn("mb-3 grid grid-cols-2 gap-2", immersive && "rounded-[24px] bg-[#0a372f]/70 p-1.5")}>
            {selectedCard.type === "property" && data.actionsLeft > 0 && (
              <button
                type="button"
                onClick={() => void dispatch("deal-property", { cardId: selectedCard.id })}
                className={cn("col-span-2 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gold-primary px-4 text-sm font-black text-[#10251e] shadow", immersive && "min-h-14 rounded-[20px] bg-gradient-to-b from-[#f5d982] to-[#cda44b] text-base shadow-[0_10px_28px_-14px_rgba(238,196,94,.85)]")}
              >
                <MapPin className="size-5" /> إضافة للمجموعة
              </button>
            )}
            {selectedCard.type === "money" && data.actionsLeft > 0 && (
              <button
                type="button"
                onClick={() => void dispatch("deal-bank", { cardId: selectedCard.id })}
                className={cn("col-span-2 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-black text-white shadow", immersive && "min-h-14 rounded-[20px] border border-[#e8c86e]/50 bg-[#0a4d40] text-base")}
              >
                <Banknote className="size-5" /> إيداع بالبنك
              </button>
            )}
            {selectedCard.type === "action" && data.actionsLeft > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => useAction(selectedCard)}
                  className={cn("flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gold-primary px-3 text-sm font-black text-[#10251e] shadow", immersive && "min-h-14 rounded-[20px] bg-gradient-to-b from-[#f5d982] to-[#cda44b] text-base")}
                >
                  <Sparkles className="size-5" /> استخدام البطاقة
                </button>
                <button
                  type="button"
                  onClick={() => void dispatch("deal-bank", { cardId: selectedCard.id })}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-600 px-3 text-sm font-black text-white"
                >
                  <Banknote className="size-5" /> إيداع بالبنك
                </button>
              </>
            )}
            {hand.length > 7 && (
              <button
                type="button"
                onClick={() => void dispatch("deal-discard", selectedCard.id)}
                className="col-span-2 min-h-11 rounded-2xl bg-rose-600 px-4 text-sm font-black text-white"
              >
                التخلص من البطاقة
              </button>
            )}
          </div>
        )}

        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
          <div>
            <p className={cn("text-xs font-bold text-muted-foreground", immersive && "text-[#d6bd7b]/60")}>أوراقك الخاصة</p>
            <p className={cn("font-black text-primary", immersive && "text-lg text-white")}>{hand.length} أوراق</p>
          </div>
          {amActive && !data.needsDraw && (
            <button
              type="button"
              disabled={hand.length > 7}
              onClick={() => void dispatch("deal-end")}
              className={cn("rounded-2xl bg-primary px-5 py-3 text-sm font-black text-primary-foreground disabled:opacity-35", immersive && "border border-[#e1bd66]/30 bg-white/10 text-white")}
            >
              إنهاء دوري
            </button>
          )}
        </div>

        {amActive && !data.needsDraw && data.actionsLeft > 0 && !selectedCard && (
          <p className={cn("mb-3 text-center text-xs font-bold text-muted-foreground", immersive && "text-white/55")}>اختر بطاقة من يدك لتظهر الحركة المناسبة</p>
        )}

        <CardHandTray className={cn("min-h-60 gap-3 pt-5", immersive && "min-h-[220px] max-h-[36dvh] gap-0 overflow-y-hidden px-3 pb-3 pt-8")}>
          {hand.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => setSelectedCardId(card.id)}
              aria-pressed={selectedCardId === card.id}
              className={cn(
                "w-32 shrink-0 rounded-2xl text-right transition sm:w-36",
                immersive && "-ml-5 w-28 first:ml-0 sm:w-32",
                selectedCardId === card.id ? "-translate-y-3 ring-4 ring-[#f0cd72] ring-offset-2 ring-offset-[#07382f]" : "opacity-90 hover:-translate-y-1 hover:opacity-100",
              )}
            >
              <DealCardFace card={card} />
            </button>
          ))}
        </CardHandTray>
      </div>

      {!amActive && <p className="text-center text-sm font-bold text-muted-foreground">بانتظار حركة {active?.name}</p>}
    </div>
  );
}

function TriviaGame({
  state,
  players,
  me,
  isHost,
  dispatch,
}: {
  state: RoomState;
  players: Player[];
  me: Player;
  isHost: boolean;
  dispatch: (type: string, value?: any) => Promise<void>;
}) {
  const data = state.data;
  const question = TRIVIA_QUESTIONS[data.questionIndex % TRIVIA_QUESTIONS.length];
  const myAnswer = data.answers[me.id] as number | undefined;
  const answerCount = Object.keys(data.answers).length;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-[30px] bg-gradient-to-br from-primary to-[#0a493a] p-6 text-center text-white sm:p-9">
        <p className="text-xs font-black text-gold-primary">سؤال {state.round + 1}</p>
        <h4 className="mt-3 text-2xl font-black leading-relaxed sm:text-3xl">{question.q}</h4>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {question.options.map((option, index) => {
          const selected = myAnswer === index;
          const correct = data.revealed && question.correct === index;
          const wrong = data.revealed && selected && question.correct !== index;
          return (
            <button
              key={option}
              type="button"
              disabled={myAnswer != null || data.revealed}
              onClick={() => void dispatch("answer", index)}
              className={cn(
                "min-h-20 rounded-3xl border-2 px-5 text-right text-base font-black transition",
                selected ? "border-gold-primary bg-gold-primary/15" : "border-border bg-muted/25",
                correct && "border-emerald-500 bg-emerald-500/15 text-emerald-700",
                wrong && "border-rose-500 bg-rose-500/10 text-rose-700",
              )}
            >
              <span className="ml-3 inline-flex size-8 items-center justify-center rounded-full bg-card text-xs">
                {index + 1}
              </span>
              {option}
            </button>
          );
        })}
      </div>

      <p className="text-center text-sm font-bold text-muted-foreground">
        {data.revealed
          ? `الإجابة الصحيحة: ${question.options[question.correct]}`
          : myAnswer != null
            ? "تم تثبيت إجابتك — بانتظار بقية اللاعبين"
            : `أجاب ${answerCount} من ${players.length}`}
      </p>

      {isHost && !data.revealed && (
        <PrimaryAction onClick={() => void dispatch("reveal")} disabled={answerCount === 0} tone="gold">
          <Check className="size-5" /> كشف الإجابات للجميع
        </PrimaryAction>
      )}
      {isHost && data.revealed && (
        <PrimaryAction onClick={() => void dispatch("next")}>
          السؤال التالي <ChevronLeft className="size-5" />
        </PrimaryAction>
      )}
    </div>
  );
}

function JudgeGame({
  state,
  players,
  me,
  isHost,
  dispatch,
}: {
  state: RoomState;
  players: Player[];
  me: Player;
  isHost: boolean;
  dispatch: (type: string, value?: any) => Promise<void>;
}) {
  const data = state.data;
  const myVote = data.votes[me.id] as string | undefined;
  const counts = Object.values(data.votes as Record<string, string>).reduce<Record<string, number>>((acc, id) => {
    acc[id] = (acc[id] ?? 0) + 1;
    return acc;
  }, {});
  const highest = Math.max(0, ...Object.values(counts));
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-[30px] bg-gradient-to-br from-[#6b4a12] to-[#1f180c] p-7 text-center text-white sm:p-10">
        <Gavel className="mx-auto size-9 text-gold-primary" />
        <p className="mt-3 text-xs font-black text-gold-primary">صوّت بسرية من جوالك</p>
        <h4 className="mt-3 text-2xl font-black leading-relaxed">{JUDGE_SCENARIOS[data.scenarioIndex % JUDGE_SCENARIOS.length]}</h4>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {players.map((player) => {
          const selected = myVote === player.id;
          const winner = data.revealed && highest > 0 && counts[player.id] === highest;
          return (
            <button
              key={player.id}
              type="button"
              disabled={myVote != null || data.revealed}
              onClick={() => void dispatch("vote", player.id)}
              className={cn(
                "flex min-h-20 items-center gap-3 rounded-3xl border-2 p-4 text-right transition",
                selected ? "border-gold-primary bg-gold-primary/10" : "border-border bg-muted/25",
                winner && "border-emerald-500 bg-emerald-500/15",
              )}
            >
              <PlayerAvatar player={player} />
              <span className="min-w-0 flex-1 truncate font-black text-primary">{player.name}</span>
              {data.revealed && <span className="text-xl font-black text-gold-primary">{counts[player.id] ?? 0}</span>}
            </button>
          );
        })}
      </div>

      <p className="text-center text-sm font-bold text-muted-foreground">
        {data.revealed ? "ظهرت نتيجة التصويت للجميع" : myVote ? "تم تسجيل صوتك بسرية" : "اختر شخصًا واحدًا"}
      </p>
      {isHost && !data.revealed && (
        <PrimaryAction onClick={() => void dispatch("reveal")} disabled={!Object.keys(data.votes).length} tone="gold">
          كشف نتيجة التصويت
        </PrimaryAction>
      )}
      {isHost && data.revealed && (
        <PrimaryAction onClick={() => void dispatch("next")}>موقف جديد <ChevronLeft className="size-5" /></PrimaryAction>
      )}
    </div>
  );
}

function ChallengeGame({
  state,
  players,
  me,
  isHost,
  now,
  dispatch,
}: {
  state: RoomState;
  players: Player[];
  me: Player;
  isHost: boolean;
  now: number;
  dispatch: (type: string, value?: any) => Promise<void>;
}) {
  const data = state.data;
  const active = players[data.activeIndex % Math.max(players.length, 1)];
  const seconds = Math.max(0, Math.ceil((data.endsAt - now) / 1000));
  const amActive = active?.id === me.id;

  useEffect(() => {
    if (seconds === 0 && amActive && !data.finished) void dispatch("end-turn");
  }, [seconds, amActive, data.finished, dispatch]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 text-center">
      <div className="flex items-center justify-center gap-3">
        {active && <PlayerAvatar player={active} size="lg" />}
        <div className="text-right">
          <p className="text-xs font-bold text-muted-foreground">صاحب الدور</p>
          <p className="text-xl font-black text-primary">{active?.name ?? "—"}</p>
        </div>
      </div>

      <div className={cn("rounded-[36px] border-2 p-7 sm:p-12", seconds <= 5 ? "border-rose-500 bg-rose-500/5" : "border-gold-primary bg-gold-primary/5")}>
        <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-primary text-3xl font-black text-primary-foreground">{seconds}</div>
        {amActive ? (
          <>
            <p className="mt-6 text-xs font-black text-muted-foreground">اشرح الكلمة من دون أن تقولها</p>
            <h4 className="mt-2 text-3xl font-black text-primary sm:text-5xl">
              {data.finished ? "انتهى الوقت" : CHALLENGE_WORDS[data.wordIndex % CHALLENGE_WORDS.length]}
            </h4>
          </>
        ) : (
          <>
            <Users className="mx-auto mt-6 size-10 text-gold-primary" />
            <h4 className="mt-2 text-2xl font-black text-primary">خمّن الكلمة من شرح {active?.name}</h4>
            <p className="mt-2 text-sm font-bold text-muted-foreground">الكلمة ظاهرة في جوال صاحب الدور فقط</p>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-emerald-500/10 p-4">
          <p className="text-xs font-bold text-muted-foreground">صحيح</p>
          <p className="text-3xl font-black text-emerald-600">{data.correct}</p>
        </div>
        <div className="rounded-2xl bg-muted p-4">
          <p className="text-xs font-bold text-muted-foreground">تخطي</p>
          <p className="text-3xl font-black text-primary">{data.skips}</p>
        </div>
      </div>

      {amActive && !data.finished && seconds > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <PrimaryAction onClick={() => void dispatch("correct")} tone="success"><Check className="size-5" /> صحيحة</PrimaryAction>
          <PrimaryAction onClick={() => void dispatch("skip")} tone="muted">تخطي</PrimaryAction>
        </div>
      )}
      {isHost && data.finished && (
        <PrimaryAction onClick={() => void dispatch("next")}>دور اللاعب التالي <ChevronLeft className="size-5" /></PrimaryAction>
      )}
      {!amActive && !data.finished && <p className="text-sm font-bold text-muted-foreground">التحكم الآن من جوال صاحب الدور</p>}
    </div>
  );
}

function AuctionRoom({
  state,
  players,
  me,
  isHost,
  dispatch,
}: {
  state: RoomState;
  players: Player[];
  me: Player;
  isHost: boolean;
  dispatch: (type: string, value?: any) => Promise<void>;
}) {
  const data = state.data;
  const [bid, setBid] = useState("");
  const myBid = data.bids[me.id] as number | undefined;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-[30px] bg-gradient-to-br from-primary to-[#132e27] p-7 text-center text-white sm:p-10">
        <Gavel className="mx-auto size-10 text-gold-primary" />
        <p className="mt-3 text-xs font-black text-gold-primary">قدّم أعلى مزايدة تستطيع تنفيذها</p>
        <h4 className="mt-3 text-2xl font-black leading-relaxed">{AUCTION_PROMPTS[data.promptIndex % AUCTION_PROMPTS.length]}</h4>
      </div>

      {!data.revealed && myBid == null ? (
        <div className="mx-auto flex max-w-md gap-3" dir="ltr">
          <button
            type="button"
            disabled={!bid}
            onClick={() => void dispatch("bid", Number(bid))}
            className="min-w-28 rounded-2xl bg-gold-primary px-5 font-black text-[#10251e] disabled:opacity-35"
          >
            إرسال
          </button>
          <input
            type="number"
            min={0}
            max={999}
            value={bid}
            onChange={(event) => setBid(event.target.value)}
            placeholder="مزايدتك"
            className="h-16 min-w-0 flex-1 rounded-2xl border-2 border-border bg-muted/30 px-5 text-center text-2xl font-black text-primary outline-none focus:border-gold-primary"
          />
        </div>
      ) : !data.revealed ? (
        <p className="text-center text-lg font-black text-emerald-600">تم إرسال مزايدتك: {myBid}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {players.map((player) => (
          <button
            key={player.id}
            type="button"
            disabled={!isHost || !data.revealed || Boolean(data.winnerId)}
            onClick={() => void dispatch("award", player.id)}
            className={cn(
              "flex min-h-20 items-center gap-3 rounded-3xl border-2 p-4 text-right",
              data.winnerId === player.id ? "border-gold-primary bg-gold-primary/15" : "border-border bg-muted/25",
            )}
          >
            <PlayerAvatar player={player} />
            <span className="min-w-0 flex-1 truncate font-black text-primary">{player.name}</span>
            <span className="text-2xl font-black text-gold-primary">{data.revealed ? (data.bids[player.id] ?? "—") : data.bids[player.id] != null ? "✓" : "…"}</span>
          </button>
        ))}
      </div>

      {isHost && !data.revealed && (
        <PrimaryAction onClick={() => void dispatch("reveal")} disabled={!Object.keys(data.bids).length} tone="gold">كشف جميع المزايدات</PrimaryAction>
      )}
      {isHost && data.revealed && !data.winnerId && <p className="text-center text-sm font-bold text-muted-foreground">اضغط اسم الفائز لمنحه النقطة</p>}
      {isHost && data.winnerId && (
        <PrimaryAction onClick={() => void dispatch("next")}>مزاد جديد <ChevronLeft className="size-5" /></PrimaryAction>
      )}
    </div>
  );
}

function WordDuelRoom({
  state,
  players,
  me,
  dispatch,
}: {
  state: RoomState;
  players: Player[];
  me: Player;
  dispatch: (type: string, value?: any) => Promise<void>;
}) {
  const data = state.data;
  const active = players[data.turnIndex % Math.max(players.length, 1)];
  const amActive = active?.id === me.id;
  const [word, setWord] = useState("");
  const valid = word.trim().length >= 2 && word.trim().startsWith(data.currentLetter);

  useEffect(() => setWord(""), [data.turnIndex]);

  const submit = () => {
    if (!valid) return;
    void dispatch("word", word.trim());
    setWord("");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 text-center">
      <div className="flex items-center justify-center gap-3">
        {active && <PlayerAvatar player={active} size="lg" />}
        <div className="text-right">
          <p className="text-xs font-bold text-muted-foreground">الدور الآن عند</p>
          <p className="text-xl font-black text-primary">{active?.name ?? "—"}</p>
        </div>
      </div>

      <div className="rounded-[36px] bg-gradient-to-br from-[#0b4f3e] to-[#081f1a] p-8 text-white sm:p-12">
        <p className="text-sm font-black text-gold-primary">اكتب كلمة تبدأ بحرف</p>
        <p className="mt-3 text-8xl font-black text-white">{data.currentLetter}</p>
      </div>

      {amActive ? (
        <div className="space-y-3">
          <div className="flex gap-3" dir="rtl">
            <input
              value={word}
              onChange={(event) => setWord(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && submit()}
              placeholder={`كلمة تبدأ بـ ${data.currentLetter}`}
              autoFocus
              className="h-16 min-w-0 flex-1 rounded-2xl border-2 border-border bg-muted/30 px-5 text-lg font-black text-primary outline-none focus:border-gold-primary"
            />
            <button
              type="button"
              disabled={!valid}
              onClick={submit}
              className="min-w-24 rounded-2xl bg-primary px-5 font-black text-primary-foreground disabled:opacity-35"
            >
              إرسال
            </button>
          </div>
          <button type="button" onClick={() => void dispatch("skip")} className="text-xs font-black text-muted-foreground underline underline-offset-4">
            لا أعرف — تخطي الدور
          </button>
        </div>
      ) : (
        <p className="rounded-2xl bg-muted/40 p-4 text-sm font-bold text-muted-foreground">بانتظار كلمة {active?.name}</p>
      )}

      {data.words.length > 0 && (
        <div className="text-right">
          <p className="mb-3 text-xs font-black text-muted-foreground">آخر الكلمات</p>
          <div className="flex flex-wrap gap-2">
            {data.words.slice(-10).reverse().map((item: { playerId: string; word: string }, index: number) => (
              <span key={`${item.playerId}-${item.word}-${index}`} className="rounded-full bg-gold-primary/12 px-4 py-2 text-sm font-black text-primary">
                {item.word}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WheelRoom({
  state,
  players,
  isHost,
  dispatch,
}: {
  state: RoomState;
  players: Player[];
  isHost: boolean;
  dispatch: (type: string, value?: any) => Promise<void>;
}) {
  const winner = players.find((player) => player.id === state.data.winnerId);
  const rotation = (state.data.spin ?? 0) * 1080 + ((state.data.spin ?? 0) * 137) % 360;
  return (
    <div className="mx-auto max-w-2xl space-y-7 text-center">
      <div className="relative mx-auto size-64 sm:size-80">
        <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 border-x-[14px] border-t-[24px] border-x-transparent border-t-gold-primary" />
        <div
          className="flex size-full items-center justify-center rounded-full border-[12px] border-primary bg-[conic-gradient(from_45deg,#d4af37,#0b5b47,#ead38a,#073f34,#d4af37)] shadow-2xl transition-transform duration-[1800ms] ease-out"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <div className="flex size-24 items-center justify-center rounded-full border-4 border-gold-primary bg-card shadow-xl">
            <RotateCw className="size-10 text-primary" />
          </div>
        </div>
      </div>

      {winner ? (
        <div className="rounded-3xl bg-gold-primary/15 p-6">
          <PlayerAvatar player={winner} size="lg" />
          <p className="mt-3 text-xs font-black text-gold-primary">وقع الاختيار على</p>
          <h4 className="mt-1 text-3xl font-black text-primary">{winner.name}</h4>
        </div>
      ) : (
        <p className="text-sm font-bold text-muted-foreground">القرعة تشمل كل الموجودين في الغرفة</p>
      )}

      {isHost ? (
        <PrimaryAction onClick={() => void dispatch("spin")} tone="gold">
          <RotateCw className="size-5" /> {winner ? "إعادة القرعة" : "تشغيل القرعة عند الجميع"}
        </PrimaryAction>
      ) : (
        <p className="text-sm font-bold text-muted-foreground">بانتظار المضيف لتشغيل القرعة</p>
      )}
    </div>
  );
}

function BalootCardFace({
  card,
  compact = false,
  mini = false,
  active = true,
  onClick,
}: {
  card: BalootCard;
  compact?: boolean;
  mini?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const red = card.suit === "hearts" || card.suit === "diamonds";
  const content = (
    <>
      <span className={cn("absolute right-2 top-1 font-black", mini ? "text-sm" : "text-lg")}>{card.rank}</span>
      <span className={cn("font-serif", mini ? "text-2xl" : compact ? "text-3xl" : "text-5xl sm:text-6xl")}>{BALOOT_SUIT_LABEL[card.suit]}</span>
      <span className={cn("absolute bottom-1 left-2 rotate-180 font-black", mini ? "text-sm" : "text-lg")}>{card.rank}</span>
    </>
  );
  const className = cn(
    "relative flex shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-lg",
    red ? "text-red-600" : "text-slate-950",
    mini ? "h-16 w-11" : compact ? "h-24 w-16" : "h-36 w-24 sm:h-44 sm:w-28",
    !active && "opacity-35",
  );
  if (!onClick) return <div className={className}>{content}</div>;
  return (
    <button type="button" disabled={!active} onClick={onClick} className={cn(className, active && "transition hover:-translate-y-2 active:scale-95")}>
      {content}
    </button>
  );
}

function BalootTeams({ players, data }: { players: Player[]; data: any }) {
  const first = players.filter((_, index) => index % 2 === 0);
  const second = players.filter((_, index) => index % 2 === 1);
  return (
    <div className="grid grid-cols-2 gap-3">
      {[first, second].map((team, index) => (
        <div key={index} className={cn("rounded-3xl border-2 p-4 text-center", index === 0 ? "border-emerald-500/30 bg-emerald-500/8" : "border-rose-500/30 bg-rose-500/8")}>
          <p className={cn("text-xs font-black", index === 0 ? "text-emerald-600" : "text-rose-600")}>الفريق {index === 0 ? "الأول" : "الثاني"}</p>
          <p className="mt-1 truncate text-xs font-bold text-muted-foreground">{team.map((player) => player.name).join(" + ")}</p>
          <p className="mt-2 text-4xl font-black text-primary">{data.matchScore?.[index] ?? 0}</p>
          <p className="text-[10px] font-bold text-muted-foreground">من 152</p>
        </div>
      ))}
    </div>
  );
}

function BalootTableSeat({
  player,
  players,
  data,
  active,
  className,
}: {
  player: Player;
  players: Player[];
  data: any;
  active: boolean;
  className?: string;
}) {
  const cardCount = data.hands[player.id]?.length ?? 0;
  const teamIndex = Math.max(0, players.findIndex((item) => item.id === player.id)) % 2;
  return (
    <TablePlayerSeat
      player={player}
      active={active}
      detail={`الفريق ${teamIndex === 0 ? "الأول" : "الثاني"} · ${cardCount} أوراق`}
      className={cn("w-full", className)}
    >
      <div className="mt-2 flex justify-center -space-x-2 space-x-reverse">
        {Array.from({ length: Math.min(cardCount, 4) }).map((_, index) => (
          <BrandedCardBack key={index} label="" compact className="h-8 w-5 rounded-md border-2 p-0 shadow" />
        ))}
      </div>
    </TablePlayerSeat>
  );
}

function BalootRoom({
  state,
  players,
  me,
  isHost,
  logoUrl,
  immersive,
  dispatch,
}: {
  state: RoomState;
  players: Player[];
  me: Player;
  isHost: boolean;
  logoUrl: string | null;
  immersive: boolean;
  dispatch: (type: string, value?: any) => Promise<void>;
}) {
  const data = state.data;
  const hand = (data.hands[me.id] ?? []) as BalootCard[];
  const bidder = players[data.bidTurnIndex];
  const active = players[data.turnIndex];
  const contract = data.contract as { mode: "sun" | "hokm"; trump: BalootSuit | null; buyerId: string } | null;
  const seatedPlayers = useMemo(() => orderPlayersAroundMe(players, me.id), [players, me.id]);
  const seatPositions = [
    "col-start-2 row-start-3 self-end justify-self-center",
    "col-start-1 row-start-2 self-center justify-self-start",
    "col-start-2 row-start-1 self-start justify-self-center",
    "col-start-3 row-start-2 self-center justify-self-end",
  ];

  if (data.stage === "bidding") {
    const myBid = bidder?.id === me.id;
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <BalootTeams players={players} data={data} />
        <GameTableSurface trim="ivory" className={cn("min-h-[500px] sm:min-h-[650px]", immersive && "h-[50dvh] min-h-[350px] max-h-[480px] sm:min-h-[440px] sm:max-h-[580px]")}>
          <div className={cn("relative z-10 grid min-h-[500px] grid-cols-[66px_minmax(120px,1fr)_66px] grid-rows-[94px_minmax(270px,1fr)_94px] gap-1 p-2 sm:min-h-[650px] sm:grid-cols-[150px_minmax(220px,1fr)_150px] sm:grid-rows-[136px_minmax(330px,1fr)_136px] sm:gap-3 sm:p-5", immersive && "h-full min-h-0 grid-rows-[72px_minmax(200px,1fr)_72px] sm:min-h-0 sm:grid-rows-[94px_minmax(250px,1fr)_94px]")}>
            {seatedPlayers.slice(0, 4).map((player, index) => (
              <BalootTableSeat
                key={player.id}
                player={player}
                players={players}
                data={data}
                active={bidder?.id === player.id}
                className={cn("relative z-20 max-w-[190px]", seatPositions[index])}
              />
            ))}

            <div className="relative z-10 col-span-3 col-start-1 row-start-2 flex flex-col items-center justify-center gap-3 text-center">
              <div className="rounded-full border border-[#edcc7c]/35 bg-black/25 px-4 py-2 backdrop-blur-sm">
                <p className="text-[11px] font-black text-[#f0d184] sm:text-sm">المشترى · اللفة {data.biddingRound === 1 ? "الأولى" : "الثانية"}</p>
                <p className="mt-0.5 text-[10px] font-bold text-white/60 sm:text-xs">الشراء عند {bidder?.name ?? "—"}</p>
              </div>
              <div className="flex items-center justify-center gap-4">
                <TableBrandSeal logoUrl={logoUrl} className="size-24 sm:size-36" />
                <div className="space-y-1">
                  <BalootCardFace card={data.buyCard} compact />
                  <span className="block text-[10px] font-black text-white/55">ورقة الشراء</span>
                </div>
              </div>
              <p className="max-w-[230px] text-[11px] font-bold leading-5 text-white/65 sm:text-sm">
                {data.biddingRound === 1 ? "صن أو حكم بنوع المشترى" : "صن أو حكم ثانٍ بنوع مختلف"}
              </p>
            </div>
          </div>
        </GameTableSurface>

        {myBid ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <PrimaryAction onClick={() => void dispatch("baloot-bid", { mode: "sun" })} tone="gold">صن</PrimaryAction>
              {data.biddingRound === 1 && (
                <PrimaryAction onClick={() => void dispatch("baloot-bid", { mode: "hokm" })}>
                  حكم {BALOOT_SUIT_LABEL[data.buyCard.suit as BalootSuit]}
                </PrimaryAction>
              )}
            </div>
            {data.biddingRound === 2 && (
              <div className="grid grid-cols-4 gap-2">
                {BALOOT_SUITS.filter((suit) => suit !== data.buyCard.suit).map((suit) => (
                  <button
                    key={suit}
                    type="button"
                    onClick={() => void dispatch("baloot-bid", { mode: "hokm", trump: suit })}
                    className={cn("h-14 rounded-2xl bg-card text-3xl font-black shadow", suit === "hearts" || suit === "diamonds" ? "text-red-600" : "text-slate-950")}
                  >
                    {BALOOT_SUIT_LABEL[suit]}
                  </button>
                ))}
              </div>
            )}
            <PrimaryAction onClick={() => void dispatch("baloot-pass")} tone="muted">{data.biddingRound === 1 ? "بس" : "ولا"}</PrimaryAction>
          </div>
        ) : (
          <p className="text-center text-sm font-bold text-muted-foreground">بانتظار قرار {bidder?.name}</p>
        )}

        <div>
          <p className="mb-3 text-xs font-black text-muted-foreground">أوراقك الخاصة قبل الشراء</p>
          <CardHandTray immersive={immersive}>
            {hand.map((card) => <BalootCardFace key={card.id} card={card} />)}
          </CardHandTray>
        </div>
      </div>
    );
  }

  if (data.stage === "round-end") {
    const buyer = players.find((player) => player.id === contract?.buyerId);
    return (
      <div className="mx-auto max-w-2xl space-y-6 text-center">
        <BalootTeams players={players} data={data} />
        <div className="rounded-[34px] bg-gold-primary/12 p-7">
          <Trophy className="mx-auto size-10 text-gold-primary" />
          <h4 className="mt-3 text-2xl font-black text-primary">انتهت الجولة</h4>
          <p className="mt-2 text-sm font-bold text-muted-foreground">
            شراء {buyer?.name} · {contract?.mode === "sun" ? "صن" : `حكم ${contract?.trump ? BALOOT_SUIT_LABEL[contract.trump] : ""}`}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-card p-4"><p className="text-xs font-bold text-muted-foreground">الفريق الأول</p><p className="text-4xl font-black text-emerald-600">+{data.roundPoints?.[0] ?? 0}</p></div>
            <div className="rounded-2xl bg-card p-4"><p className="text-xs font-bold text-muted-foreground">الفريق الثاني</p><p className="text-4xl font-black text-rose-600">+{data.roundPoints?.[1] ?? 0}</p></div>
          </div>
          <p className="mt-4 text-xs font-bold text-muted-foreground">الأكلات: {data.teamTricks[0]} للفريق الأول · {data.teamTricks[1]} للفريق الثاني</p>
        </div>
        {isHost ? (
          <PrimaryAction onClick={() => void dispatch("baloot-next-round")} tone="gold"><RefreshCcw className="size-5" /> توزيع الجولة التالية</PrimaryAction>
        ) : (
          <p className="text-sm font-bold text-muted-foreground">بانتظار المضيف للتوزيع التالي</p>
        )}
      </div>
    );
  }

  const leadSuit = data.trick[0]?.card?.suit as BalootSuit | undefined;
  const mustFollow = leadSuit && hand.some((card) => card.suit === leadSuit);
  const myTurn = active?.id === me.id;
  return (
    <div className={cn("space-y-6", immersive && "space-y-3")}>
      <BalootTeams players={players} data={data} />

      <GameTableSurface trim="ivory" className={cn("min-h-[520px] sm:min-h-[700px]", immersive && "h-[52dvh] min-h-[370px] max-h-[500px] sm:min-h-[460px] sm:max-h-[600px]")}>
        <div className={cn("relative z-10 grid min-h-[520px] grid-cols-[66px_minmax(120px,1fr)_66px] grid-rows-[94px_minmax(290px,1fr)_94px] gap-1 p-2 sm:min-h-[700px] sm:grid-cols-[150px_minmax(220px,1fr)_150px] sm:grid-rows-[136px_minmax(380px,1fr)_136px] sm:gap-3 sm:p-5", immersive && "h-full min-h-0 grid-rows-[72px_minmax(220px,1fr)_72px] sm:min-h-0 sm:grid-rows-[94px_minmax(270px,1fr)_94px]")}>
          {seatedPlayers.slice(0, 4).map((player, index) => (
            <BalootTableSeat
              key={player.id}
              player={player}
              players={players}
              data={data}
              active={active?.id === player.id}
              className={cn("relative z-20 max-w-[190px]", seatPositions[index])}
            />
          ))}

          <div className="relative z-10 col-span-3 col-start-1 row-start-2 flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-[#edcc7c]/35 bg-black/25 px-3 py-1.5 text-[10px] font-black backdrop-blur-sm sm:px-5 sm:py-2 sm:text-sm">
              <span className="text-[#f0d184]">{contract?.mode === "sun" ? "صن" : `حكم ${contract?.trump ? BALOOT_SUIT_LABEL[contract.trump] : ""}`}</span>
              <span className="text-white/25">•</span>
              <span className="max-w-28 truncate text-white/75 sm:max-w-none">الدور عند {active?.name ?? "—"}</span>
            </div>

            <div className={cn("relative h-[278px] w-[214px] sm:h-[310px] sm:w-[280px]", immersive && "h-[198px] w-[180px] sm:h-[230px] sm:w-[230px]")}>
              <TableBrandSeal logoUrl={logoUrl} className={cn("absolute left-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 sm:size-36", immersive && "size-16 sm:size-24")} />
              {data.trick.map((play: { playerId: string; card: BalootCard }, index: number) => {
                const player = players.find((item) => item.id === play.playerId);
                const trickPositions = [
                  "left-1/2 top-0 -translate-x-1/2",
                  "right-0 top-1/2 -translate-y-1/2",
                  "bottom-0 left-1/2 -translate-x-1/2",
                  "left-0 top-1/2 -translate-y-1/2",
                ];
                return (
                  <div key={play.playerId} className={cn("absolute space-y-0.5 text-center", trickPositions[index])}>
                    <BalootCardFace card={play.card} compact mini={immersive} />
                    <p className="max-w-16 truncate text-[9px] font-black text-white/70">{player?.name}</p>
                  </div>
                );
              })}
              {!data.trick.length && (
                <p className="absolute inset-x-0 bottom-4 text-center text-[11px] font-bold text-white/45 sm:text-sm">الفائز بالأكلة السابقة يبدأ</p>
              )}
            </div>

            <div className="flex gap-2 text-[10px] font-black text-white/70 sm:text-xs">
              <span className="rounded-full bg-white/10 px-3 py-1">أكلات 1: {data.teamTricks[0]}</span>
              <span className="rounded-full bg-white/10 px-3 py-1">أكلات 2: {data.teamTricks[1]}</span>
            </div>
          </div>
        </div>
      </GameTableSurface>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <div><p className="text-xs font-bold text-muted-foreground">أوراقك الخاصة</p><p className="font-black text-primary">{hand.length} أوراق</p></div>
          {myTurn && mustFollow && <span className="rounded-full bg-gold-primary/15 px-3 py-1 text-[11px] font-black text-gold-primary">الزم النوع {BALOOT_SUIT_LABEL[leadSuit!]}</span>}
        </div>
        <CardHandTray immersive={immersive}>
          {hand.map((card) => {
            const legal = myTurn && (!mustFollow || card.suit === leadSuit);
            return <BalootCardFace key={card.id} card={card} active={legal} onClick={() => void dispatch("baloot-play", card.id)} />;
          })}
        </CardHandTray>
      </div>

      {!myTurn && <p className="text-center text-sm font-bold text-muted-foreground">بانتظار رمية {active?.name}</p>}
    </div>
  );
}
