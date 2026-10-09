import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Banknote,
  BookOpen,
  Bot,
  Building2,
  Check,
  ChevronLeft,
  Clipboard,
  Crown,
  Eye,
  Gift,
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
  Settings2,
  Share2,
  ShieldCheck,
  Smartphone,
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
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { TRIVIA_QUESTIONS } from "@/data/trivia-questions";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { cn } from "@/lib/utils";
import { playGameSfx, type GameSfx } from "@/lib/game-sfx";
import "./games-arena.css";
import { MillionaireGameRoom } from "./millionaire-game-room";
import { MillionaireResults } from "./millionaire-results";
import { millionaireBotDelay } from "./millionaire-presentation";
import { initialMonopolyData, reduceMonopoly, chooseMillionaireBotAction } from "./millionaire-engine";
import { SaudiDealGameRoom, SaudiDealResults } from "./saudi-deal-game-room";
import { DEAL_GROUPS, initialDealData, reduceDeal, rematchDeal, getDealParticipants, isProtectedDealProperty, type DealCard } from "./saudi-deal-engine";
import { UnoGameRoom, UnoResults } from "./uno-game-room";
import { initialUnoData, reduceUno, unoPlayable, getUnoParticipants, rematchUno } from "./uno-engine";

type GameKey =
  | "uno"
  | "saudi-deal"
  | "word-duel"
  | "baloot"
  | "challenge30"
  | "auction"
  | "judge"
  | "trivia"
  | "monopoly";

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
  gameOptions?: { unoMode?: UnoMode };
};

type RoomAction = {
  type: string;
  playerId: string;
  value?: any;
};

type RoomPacket =
  | { kind: "request-state"; senderId: string }
  | { kind: "snapshot"; senderId: string; hostId: string; state: RoomState; sentAt?: number }
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
    label: "من أنا؟",
    short: "اكشف الشخصية أو المكان من التلميحات المتدرجة قبل الآخرين.",
    icon: Eye,
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
  {
    id: "monopoly",
    label: "رحلة المليونير",
    short: "سافر بين مدن المملكة، ابنِ المعالم، استحوذ على المواقع، واحسم أحد أنواع الاحتكار.",
    icon: Landmark,
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
  "من أكثر شخص يحوّل أي موقف إلى قصة مضحكة؟",
  "من يعرف الطريق حتى من دون خريطة؟",
  "من أكثر شخص يتذكر تفاصيل المناسبات القديمة؟",
  "من يصلح أن يكون حكمًا في خلاف ودي؟",
  "من يختار أفضل مكان لاجتماع العائلة؟",
  "من أكثر شخص يبادر بالسؤال عن الجميع؟",
  "من يستطيع تجهيز رحلة مفاجئة بأسرع وقت؟",
  "من أكثر شخص يلتزم بوعده مهما تأخر الوقت؟",
  "من سيكون أفضل مقدم لفعالية عائلية؟",
  "من أكثر شخص يكتشف المقالب قبل وقوعها؟",
];

const WHO_AM_I_CARDS = [
  { answer: "النخلة", clues: ["أعيش طويلًا", "أتحمل الحر", "ثمري حاضر في الضيافة"] },
  { answer: "الرياض", clues: ["أنا مدينة كبيرة", "في وسط المملكة", "أنا عاصمة السعودية"] },
  { answer: "الصقر", clues: ["سريع النظر", "أحلّق عاليًا", "رمز عربي أصيل"] },
  { answer: "الدلة", clues: ["لي فم طويل", "أرافق المجالس", "أحمل القهوة العربية"] },
  { answer: "الدرعية", clues: ["لي بيوت طينية", "أحكي تاريخ الدولة", "أقع قرب الرياض"] },
  { answer: "البشت", clues: ["أرتدى فوق الثوب", "أظهر في المناسبات", "عباءة رجالية فاخرة"] },
  { answer: "العرضة", clues: ["لي إيقاع وسيوف", "أؤدى في الاحتفالات", "رقصة وطنية سعودية"] },
  { answer: "الكعبة", clues: ["أتجه إليّ في الصلاة", "أكسى بالسواد", "أقع في مكة المكرمة"] },
  { answer: "البحر الأحمر", clues: ["مياهي مالحة", "غرب المملكة", "اسمي يحمل لونًا"] },
  { answer: "جبل طويق", clues: ["أنا مرتفع طويل", "أحيط بنجد", "شبهت بي همة السعوديين"] },
];

const LETTERS = ["ا", "ب", "ت", "ج", "ح", "د", "ر", "س", "ع", "ف", "ق", "ك", "م", "ن", "هـ", "و"];
const SESSION_KEY = "alsaif-live-game-room-v1";
function timedTableGame(game: GameKey) { return game === "uno" || game === "saudi-deal"; }
function roomParticipants(state: RoomState, live: Player[]): Player[] {
  if (state.phase === "lobby") return live;
  if (state.game === "uno") return getUnoParticipants(state.data, live);
  if (state.game === "saudi-deal") return getDealParticipants(state.data, live);
  return live;
}

type UnoColor = "red" | "blue" | "green" | "yellow" | "wild";
type UnoMode = "classic" | "flip" | "no-mercy";
type UnoCard = {
  id: string;
  color: UnoColor;
  value: string;
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
    lastAction: "بدأت المزايدة على ورقة الشراء",
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

function initialGameData(game: GameKey, players: Player[], round = 0, starterIndex = 0, options?: RoomState["gameOptions"]): Record<string, any> {
  switch (game) {
    case "uno":
      return initialUnoData(players, starterIndex, options?.unoMode ?? "classic");
    case "saudi-deal":
      return initialDealData(players, starterIndex);
    case "trivia":
      return { questionIndex: round % TRIVIA_QUESTIONS.length, answers: {}, revealed: false, activeIndex: starterIndex };
    case "judge":
      return { scenarioIndex: Math.floor(Math.random() * JUDGE_SCENARIOS.length), votes: {}, revealed: false, activeIndex: starterIndex };
    case "challenge30":
      return {
        activeIndex: starterIndex,
        wordIndex: Math.floor(Math.random() * CHALLENGE_WORDS.length),
        correct: 0,
        skips: 0,
        endsAt: Date.now() + 30000,
        finished: false,
      };
    case "auction":
      return { cardIndex: round % WHO_AM_I_CARDS.length, clueIndex: 0, guesses: {}, solvedBy: null, revealed: false, activeIndex: starterIndex };
    case "word-duel":
      return {
        currentLetter: LETTERS[Math.floor(Math.random() * LETTERS.length)],
        turnIndex: starterIndex,
        words: [],
      };
    case "baloot":
      return initialBalootData(players, [0, 0], wrappedIndex(starterIndex - 1, players.length));
    case "monopoly":
      return initialMonopolyData(players, starterIndex);
  }
}

function lobbyState(game: GameKey = "trivia", gameOptions: RoomState["gameOptions"] = { unoMode: "classic" }): RoomState {
  return { phase: "lobby", game, round: 0, scores: {}, data: {}, bots: [], gameOptions };
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

function startState(previous: RoomState, players: Player[], now = Date.now()): RoomState {
  const scores = { ...previous.scores };
  players.forEach((player) => {
    if (scores[player.id] == null) scores[player.id] = 0;
  });
  const starterIndex = Math.floor(Math.random() * Math.max(players.length, 1));
  const starter = players[starterIndex];
  return {
    ...previous,
    phase: "playing",
    round: 0,
    scores,
    data: {
      ...(previous.game === "uno"
        ? initialUnoData(players, starterIndex, previous.gameOptions?.unoMode ?? "classic", now)
        : previous.game === "saudi-deal" ? initialDealData(players, starterIndex, now) : initialGameData(previous.game, players, 0, starterIndex, previous.gameOptions)),
      starterId: starter?.id ?? null,
      starterName: starter?.name ?? "اللاعب الأول",
      starterIndex,
      startingDrawAt: Date.now(),
    },
  };
}

function wrappedIndex(index: number, length: number) {
  if (!length) return 0;
  return ((index % length) + length) % length;
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
  data.lastAction = `${players[buyerIndex].name} اشترى ${mode === "sun" ? "صن" : `حكم ${trump ? BALOOT_SUIT_LABEL[trump] : ""}`}`;
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
      data.lastAction = `${bidder.name} قال ${data.biddingRound === 1 ? "بس" : "ولا"}`;
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
  data.lastAction = `${active.name} لعب ${card.rank} ${BALOOT_SUIT_LABEL[card.suit]}`;
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
  data.lastAction = `${players[winnerIndex].name} أخذ الأكلة`;

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
  data.lastAction = `انتهت الجولة بنتيجة ${roundPoints[0]} - ${roundPoints[1]}`;

  const scores = { ...state.scores };
  players.forEach((player, index) => {
    scores[player.id] = data.matchScore[index % 2];
  });
  const matchFinished = data.matchScore[0] >= 152 || data.matchScore[1] >= 152;
  return { ...state, phase: matchFinished ? "results" : state.phase, scores, data };
}


function applyRoomAction(state: RoomState, action: RoomAction, players: Player[], now = Date.now()): RoomState {
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
    return { ...lobbyState(action.value as GameKey, state.gameOptions), bots };
  }
  if (action.type === "set-uno-mode" && state.phase === "lobby" && state.game === "uno") {
    const mode = action.value as UnoMode;
    if (!["classic", "flip", "no-mercy"].includes(mode)) return state;
    return { ...state, gameOptions: { ...state.gameOptions, unoMode: mode } };
  }
  if (action.type === "start" && state.phase === "lobby") return startState(state, players, now);
  if (action.type === "lobby") return { ...lobbyState(state.game, state.gameOptions), bots };
  if (action.type === "uno-rematch" && state.game === "uno") return rematchUno(state, players, now);
  if (action.type === "deal-rematch" && state.game === "saudi-deal") return rematchDeal(state, players, now);
  if (action.type === "finish") return { ...state, phase: "results" };
  if (state.phase !== "playing") return state;

  if (state.game === "uno") return reduceUno(state, action, players, now);
  if (state.game === "saudi-deal") return reduceDeal(state, action, players, now);
  if (state.game === "baloot") return reduceBaloot(state, action, players);
  if (state.game === "monopoly") return reduceMonopoly(state, action, players);

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
    const card = WHO_AM_I_CARDS[data.cardIndex % WHO_AM_I_CARDS.length];
    if (action.type === "guess" && !data.revealed && !data.solvedBy) {
      const guess = String(action.value ?? "").trim().slice(0, 60);
      if (!guess || data.guesses[action.playerId]) return state;
      const normalized = (value: string) => value.replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/\s+/g, "").toLowerCase();
      const correct = normalized(guess) === normalized(card.answer);
      if (correct) scores[action.playerId] = scoreFor(scores, action.playerId) + Math.max(1, 3 - data.clueIndex);
      return { ...state, scores, data: { ...data, guesses: { ...data.guesses, [action.playerId]: guess }, solvedBy: correct ? action.playerId : null, revealed: correct } };
    }
    if (action.type === "next-clue" && !data.revealed) return { ...state, data: { ...data, guesses: {}, clueIndex: Math.min(card.clues.length - 1, data.clueIndex + 1) } };
    if (action.type === "reveal") return { ...state, data: { ...data, revealed: true } };
    if (action.type === "next") {
      const round = state.round + 1;
      return { ...state, round, data: initialGameData("auction", players, round) };
    }
  }

  if (state.game === "word-duel") {
    const active = players[data.turnIndex % Math.max(players.length, 1)];
    if (action.type === "word" && active?.id === action.playerId) {
      const word = String(action.value ?? "").trim();
      if (word.length < 2 || !word.startsWith(data.currentLetter) || data.words.some((item: { word: string }) => item.word === word)) return state;
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
  const valueScore: Record<string, number> = { draw10: 15, draw6: 13, draw5: 12, wild4: 11, draw4: 10, draw2: 9, skipAll: 8, discardAll: 8, flip: 7, skip: 6, reverse: 5, wild: 4 };
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
    return { type: "deal-discard", playerId: bot.id, value: { cardId: card.id } };
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
  if (card.action === "forced_swap") {
    const ownProperties = (data.properties[bot.id] ?? []) as DealCard[];
    const canOffer = ownProperties.some((property) => !isProtectedDealProperty(ownProperties, property));
    const choices = opponents.flatMap((target) =>
      ((data.properties[target.id] ?? []) as DealCard[])
        .filter((property) => !isProtectedDealProperty(data.properties[target.id] ?? [], property))
        .map((property) => ({ target, property })),
    );
    const choice = canOffer ? randomItem(choices) : undefined;
    if (choice) return { type: "deal-action", playerId: bot.id, value: { cardId: card.id, targetId: choice.target.id, propertyId: choice.property.id } };
  }
  if (card.action === "deal_breaker") {
    const choices = opponents.flatMap((target) => DEAL_GROUPS
      .filter((group) => ((data.properties[target.id] ?? []) as DealCard[]).filter((property) => property.group === group.id).length >= group.size)
      .map((group) => ({ target, group })),
    );
    const choice = randomItem(choices);
    if (choice) return { type: "deal-action", playerId: bot.id, value: { cardId: card.id, targetId: choice.target.id, group: choice.group.id } };
  }
  if (card.action === "debt") {
    const target = opponents.slice().sort((a, b) => dealTargetWealth(data, b.id) - dealTargetWealth(data, a.id))[0];
    if (target && dealTargetWealth(data, target.id) > 0) return { type: "deal-action", playerId: bot.id, value: { cardId: card.id, targetId: target.id } };
  }
  if (card.action === "birthday" || card.action === "double_rent") {
    return { type: "deal-action", playerId: bot.id, value: { cardId: card.id } };
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
  if (state.game === "monopoly") return chooseMillionaireBotAction(state, players);
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
    const bot = bots.find((player) => data.guesses[player.id] == null);
    if (!bot) return null;
    const card = WHO_AM_I_CARDS[data.cardIndex % WHO_AM_I_CARDS.length];
    const chance = botDifficulty(bot) === "easy" ? 0.2 : botDifficulty(bot) === "medium" ? 0.45 : 0.72;
    return { type: "guess", playerId: bot.id, value: Math.random() < chance ? card.answer : "لا أعرف" };
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
  const [clockOffset, setClockOffset] = useState(0);
  const lastSnapshotAtRef = useRef(0);
  const clockOffsetRef = useRef(0);

  const channelRef = useRef<any>(null);
  const meRef = useRef(me);
  const playersRef = useRef(players);
  const stateRef = useRef(state);
  const hostRef = useRef(hostId);
  const roomRef = useRef(roomCode);
  const readyRef = useRef(ready);
  const receivedSnapshotRef = useRef(false);
  const synchronizingRef = useRef(false);
  const reconnectAttemptedRef = useRef(false);
  const electionTimerRef = useRef<number | null>(null);
  const joinTimersRef = useRef<number[]>([]);
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
        sentAt: Date.now() + (timedTableGame(nextState.game) ? clockOffsetRef.current : 0),
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
      joinedAt: (
        timedTableGame(stateRef.current.game) && stateRef.current.phase !== "lobby"
          ? stateRef.current.data.roster?.find((player: Player) => player.id === meRef.current.id)?.joinedAt
          : undefined
      ) ?? meRef.current.joinedAt,
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
      if (hostRef.current !== meRef.current.id || synchronizingRef.current) return;
      const live = [...playersRef.current, ...(stateRef.current.bots ?? [])];
      const participants = roomParticipants(stateRef.current, live);
      if (["uno-rematch", "deal-rematch"].includes(action.type) && action.playerId !== meRef.current.id) return;
      const next = applyRoomAction(stateRef.current, action, participants, Date.now() + clockOffsetRef.current);
      if (next === stateRef.current) return;
      stateRef.current = next;
      setState(next);
      await publishSnapshot(next, meRef.current.id);
    },
    [publishSnapshot],
  );

  const dispatch = useCallback(
    async (type: string, value?: any) => {
      const action: RoomAction = {
        type,
        value: timedTableGame(stateRef.current.game) && (type.startsWith("uno-") || type.startsWith("deal-"))
          ? { ...value, turnSequence: stateRef.current.data.turnSequence, round: stateRef.current.round }
          : value,
        playerId: meRef.current.id,
      };
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
      if (hostRef.current === meRef.current.id && !synchronizingRef.current) {
        void publishSnapshot(stateRef.current, meRef.current.id);
      }
      return;
    }
    if (packet.kind === "snapshot") {
      receivedSnapshotRef.current = true;
      synchronizingRef.current = false;
      setConnected(true);
      lastSnapshotAtRef.current = Date.now();
      if (packet.sentAt && timedTableGame(packet.state.game)) {
        clockOffsetRef.current = packet.sentAt - Date.now();
        setClockOffset(clockOffsetRef.current);
      }
      hostRef.current = packet.hostId;
      stateRef.current = packet.state;
      setHostId(packet.hostId);
      setState(packet.state);
      if (packet.hostId === meRef.current.id) void trackPresence(readyRef.current, true);
      return;
    }
    if (packet.kind === "action") {
      if (timedTableGame(stateRef.current.game) && (
        packet.senderId !== packet.action.playerId ||
        ["uno-timeout", "uno-clock", "deal-timeout", "deal-clock"].includes(packet.action.type)
      )) return;
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
      restored?: { state?: RoomState; hostId?: string; ready?: boolean; clockOffset?: number },
    ) => {
      const code = cleanCode(requestedCode);
      if (code.length !== 6 || channelRef.current) return;
      setConnecting(true);
      clockOffsetRef.current = restored?.clockOffset ?? 0;
      setClockOffset(clockOffsetRef.current);
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
      let subscribedOnce = false;

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
                synchronizingRef.current = false;
                setConnected(true);
                toast.info("أصبحت مضيف الغرفة بعد خروج المضيف السابق");
                void trackPresence(readyRef.current, true);
                void publishSnapshot(stateRef.current, successor.id);
              }
            }, 1200);
          }
        })
        .subscribe(async (status: string) => {
          if (status === "SUBSCRIBED") {
            const firstSubscription = !subscribedOnce;
            subscribedOnce = true;
            const subscribedAt = Date.now();
            clearJoinTimers();
            setConnecting(false);
            synchronizingRef.current = mode !== "create" || !firstSubscription;
            setConnected(!synchronizingRef.current);
            await trackPresence(readyRef.current, hostRef.current === meRef.current.id);
            if (mode !== "create" || !firstSubscription) {
              await sendPacket({ kind: "request-state", senderId: meRef.current.id });
              joinTimersRef.current.push(
                window.setTimeout(() => {
                  if (
                    lastSnapshotAtRef.current < subscribedAt &&
                    hostRef.current === meRef.current.id &&
                    !playersRef.current.some((player) => player.isHost && player.id !== meRef.current.id)
                  ) {
                    synchronizingRef.current = false;
                    setConnected(true);
                    void publishSnapshot(stateRef.current, meRef.current.id);
                  } else void sendPacket({ kind: "request-state", senderId: meRef.current.id });
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
              await publishSnapshot(stateRef.current, meRef.current.id);
            }
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            synchronizingRef.current = true;
            setConnecting(false);
            setConnected(false);
          }
        });
    },
    [clearJoinTimers, leaveRoom, publishSnapshot, sendPacket, trackPresence],
  );

  useEffect(() => {
    if (booting || reconnectAttemptedRef.current || typeof window === "undefined") return;
    reconnectAttemptedRef.current = true;
    try {
      const saved = JSON.parse(window.localStorage.getItem(SESSION_KEY) || "null");
      const fresh = saved?.savedAt && Date.now() - saved.savedAt < 8 * 60 * 60 * 1000;
      if (fresh && (!saved.playerId || saved.playerId === meRef.current.id) && cleanCode(saved.code).length === 6) {
        void connectRoom(saved.code, "restore", {
          state: saved.state,
          hostId: saved.hostId,
          ready: saved.ready,
          clockOffset: saved.clockOffset,
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
      JSON.stringify({ code: roomCode, state, hostId, ready, playerId: me.id, clockOffset, savedAt: Date.now() }),
    );
  }, [roomCode, state, hostId, ready, me.id, clockOffset]);

  useEffect(() => {
    if (!connected || hostId !== me.id || state.phase !== "playing") return;
    const live = [...players, ...(state.bots ?? [])];
    const currentPlayers = roomParticipants(state, live);
    const action = chooseBotAction(state, currentPlayers);
    if (!action) return;
    if (timedTableGame(state.game)) action.value = { ...action.value, turnSequence: state.data.turnSequence, round: state.round };
    const bot = currentPlayers.find((player) => player.id === action.playerId && player.isBot);
    const timer = window.setTimeout(() => {
      void hostApply(action);
    }, state.game === "monopoly" ? millionaireBotDelay(state.data, botThinkDelay(bot)) : botThinkDelay(bot));
    return () => window.clearTimeout(timer);
  }, [connected, hostId, me.id, players, state, hostApply]);

  // Only the elected, connected host advances an expired turn. Sequence/deadline
  // guards in the reducer make old callbacks and delayed packets harmless.
  useEffect(() => {
    if (!connected || hostId !== me.id || !timedTableGame(state.game) || state.phase !== "playing") return;
    const tick = () => {
      const current = stateRef.current;
      const roster = roomParticipants(current, [...playersRef.current, ...(current.bots ?? [])]);
      const prefix = current.game === "uno" ? "uno" : "deal";
      const active = roster[Number(current.data.turnIndex ?? 0) % Math.max(1, roster.length)];
      if (!active) return;
      if (!current.data.turnDeadline) void hostApply({ type: `${prefix}-clock`, playerId: active.id });
      else if (Date.now() + clockOffsetRef.current >= current.data.turnDeadline) {
        void hostApply({
          type: `${prefix}-timeout`,
          playerId: active.id,
          value: { turnSequence: current.data.turnSequence, deadline: current.data.turnDeadline, round: current.round },
        });
      } else if (current.game === "saudi-deal" && current.data.needsDraw) {
        void hostApply({ type: "deal-draw", playerId: active.id, value: { turnSequence: current.data.turnSequence, round: current.round } });
      }
    };
    const interval = window.setInterval(tick, 250);
    tick();
    return () => window.clearInterval(interval);
  }, [connected, hostId, me.id, state.game, state.phase, hostApply]);

  useEffect(() => {
    const offline = () => {
      synchronizingRef.current = true;
      setConnected(false);
    };
    const refresh = () => {
      if (!channelRef.current || document.visibilityState === "hidden") return;
      if (channelRef.current.state === "joined") {
        if (!synchronizingRef.current) setConnected(true);
        void trackPresence(readyRef.current);
        void sendPacket({ kind: "request-state", senderId: meRef.current.id });
      }
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [sendPacket, trackPresence]);

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
  const participants = useMemo(() => {
    const live = [...players, ...(state.bots ?? [])];
    return roomParticipants(state, live);
  }, [players, state]);
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
          onSelectUnoMode={(mode) => void dispatch("set-uno-mode", mode)}
          onStart={() => void dispatch("start")}
          onAddBot={(difficulty) => void dispatch("add-bot", difficulty)}
          onFillBots={(difficulty) => void dispatch("fill-bots", difficulty)}
          onRemoveBot={(botId) => void dispatch("remove-bot", botId)}
          onBotDifficulty={(botId, difficulty) => void dispatch("set-bot-difficulty", { botId, difficulty })}
        />
      ) : state.phase === "results" ? (
        state.game === "uno" ? <UnoResults state={state} players={participants} isHost={isHost} onRematch={() => void dispatch("uno-rematch")} onLobby={() => void dispatch("lobby")} /> : state.game === "saudi-deal" ? <SaudiDealResults state={state} players={participants} isHost={isHost} onRematch={() => void dispatch("deal-rematch")} onLobby={() => void dispatch("lobby")} /> : state.game === "monopoly" ? <MillionaireResults data={state.data} players={participants} isHost={isHost} onLobby={() => void dispatch("lobby")} /> : <Results
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
          connected={connected}
          clockOffset={clockOffset}
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
    <div className="arena-room-entry mx-auto grid w-full max-w-6xl gap-5 px-3 sm:px-5 lg:grid-cols-[1.15fr_.85fr]" dir="rtl">
      <Surface className="arena-room-entry-main relative overflow-hidden p-6 text-white sm:p-10">
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

      <Surface className="arena-room-entry-join p-6 sm:p-9">
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
  onSelectUnoMode,
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
  onSelectUnoMode: (mode: UnoMode) => void;
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

        <Link
          to="/game-previews"
          className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-gold-primary/30 bg-gold-primary/10 px-4 py-3 transition hover:border-gold-primary/60 hover:bg-gold-primary/15"
        >
          <span>
            <span className="block text-xs font-black text-gold-primary">تصاميم جديدة قيد الاعتماد</span>
            <span className="mt-1 block text-sm font-black text-primary">شاهد معاينة الكِيرم ورحلة المليونير</span>
          </span>
          <ChevronLeft className="size-5 shrink-0 text-gold-primary" />
        </Link>

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
        {state.game === "uno" && (
          <div className="mt-5 rounded-2xl border border-border/70 bg-muted/25 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div><p className="text-sm font-black text-primary">طريقة أونو</p><p className="text-[11px] font-bold text-muted-foreground">يحددها المضيف قبل بدء الجولة</p></div>
              <Zap className="size-5 text-gold-primary" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([
                ["classic", "كلاسيك"],
                ["flip", "فليب"],
                ["no-mercy", "نو ميرسي"],
              ] as Array<[UnoMode, string]>).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  disabled={!isHost}
                  onClick={() => onSelectUnoMode(mode)}
                  className={cn("min-h-12 rounded-xl border px-2 text-xs font-black transition", (state.gameOptions?.unoMode ?? "classic") === mode ? "border-gold-primary bg-gold-primary text-primary" : "border-border bg-card text-muted-foreground", !isHost && "cursor-default")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
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

  // احتفال الفوز: نغمة انتصار مع مطر ذهبي.
  useEffect(() => {
    playGameTone("win");
  }, []);

  return (
    <Surface className="relative mx-auto max-w-2xl overflow-hidden p-6 text-center sm:p-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 26 }).map((_, index) => (
          <span
            key={index}
            className="arena-confetti"
            style={{
              left: `${(index * 3.9) % 100}%`,
              background: ["#efd078", "#0b5b47", "#d99a3f", "#f6efdf"][index % 4],
              animationDelay: `${(index % 9) * 0.12}s`,
              ["--arena-drift" as string]: `${(index % 2 === 0 ? 1 : -1) * (12 + (index % 5) * 9)}px`,
            }}
          />
        ))}
      </div>
      <div className="arena-trophy-pop relative mx-auto flex size-20 items-center justify-center rounded-full bg-gold-primary/15 shadow-[0_0_36px_rgba(240,205,120,.45)]">
        <Trophy className="size-10 text-gold-primary" />
      </div>
      <h3 className="relative mt-4 text-3xl font-black text-primary">النتيجة النهائية</h3>
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

type GameExperiencePreferences = {
  sound: boolean;
  haptics: boolean;
  reducedMotion: boolean;
};

const GAME_PREFERENCES_KEY = "alsaif-game-experience-v2";


function useGameExperiencePreferences() {
  const [preferences, setPreferences] = useState<GameExperiencePreferences>(() => {
    const fallback = { sound: true, haptics: true, reducedMotion: false };
    if (typeof window === "undefined") return fallback;
    try {
      return { ...fallback, ...JSON.parse(window.localStorage.getItem(GAME_PREFERENCES_KEY) ?? "{}") };
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(GAME_PREFERENCES_KEY, JSON.stringify(preferences));
    } catch {
      // Private browsing may block local storage; preferences still work for this session.
    }
  }, [preferences]);

  const toggle = (key: keyof GameExperiencePreferences) => {
    setPreferences((current) => ({ ...current, [key]: !current[key] }));
  };

  return { preferences, toggle };
}

/** يقرأ تفضيل الصوت المحفوظ حتى تعمل المؤثرات داخل البطاقات دون تمرير props. */
function soundEnabled() {
  if (typeof window === "undefined") return false;
  try {
    const saved = window.localStorage.getItem(GAME_PREFERENCES_KEY);
    if (!saved) return true;
    return JSON.parse(saved).sound !== false;
  } catch {
    return true;
  }
}

function playGameTone(kind: GameSfx) {
  if (!soundEnabled()) return;
  playGameSfx(kind);
}

const GAME_GUIDES: Partial<Record<GameKey, {
  goal: string;
  steps: string[];
  notes: string[];
}>> = {
  uno: {
    goal: "كن أول لاعب يتخلص من جميع أوراقه، وطابق اللون أو الرقم أو رمز الحركة.",
    steps: [
      "في دورك العب ورقة مناسبة، أو اسحب ورقة واحدة إذا لم تجد حركة مناسبة.",
      "التخطي يتجاوز اللاعب التالي، والعكس يغير اتجاه اللعب، و+2 و+4 تضيفان أوراقًا على اللاعب التالي.",
      "اضغط «أونو» عندما يبقى بيدك ورقتان قبل لعب إحداهما.",
    ],
    notes: ["لا يمكن لعب +4 إذا كان في يدك لون مطابق للون الحالي.", "أوراق الخصوم تبقى مقلوبة ويظهر عددها فقط."],
  },
  "saudi-deal": {
    goal: "اجمع ثلاث مجموعات أملاك سعودية مكتملة قبل بقية اللاعبين.",
    steps: [
      "تُسحب ورقتان تلقائيًا في بداية الدور، أو خمس إذا كانت يدك فارغة. لكل دور دقيقة ونصف تشمل جميع حركاتك.",
      "نفّذ حتى ثلاث حركات: ضع ملكية، أودع مالًا، أو استخدم بطاقة حركة. اختر الخصم والأرض قبل تأكيد الأكشن.",
      "اختر أي لاعب على الطاولة لعرض أملاكه وبنكه المكشوفين؛ أوراق اليد وحدها سرية.",
    ],
    notes: ["الحد الأعلى لليد سبع أوراق عند إنهاء الدور. إذا انتهت الـ٩٠ ثانية تُرمى الزيادة بدءًا من آخر الأوراق وينتقل الدور تلقائيًا.", "بعد اختيار ورقة اضغط زر المعلومات لشرحها. بطاقات مرفوض تصد الهجوم تلقائيًا وهي في اليد."],
  },
  baloot: {
    goal: "اكسب الأكلات وارفع نتيجة فريقك إلى 152 نقطة في نسخة البلوت داخل المجلس.",
    steps: [
      "تبدأ الجولة بالمشترى: صن، حكم، أو تمرير حسب لفة المزايدة.",
      "بعد الشراء يلزم اتباع نوع أول ورقة في الأكلة متى كان النوع موجودًا في يدك.",
      "الفائز بالأكلة يبدأ الأكلة التالية، وتحسب النتيجة للفريقين بعد انتهاء الأوراق.",
    ],
    notes: ["الفريقان متقابلان حول الطاولة.", "النوع المطلوب يظهر أعلى أوراقك عندما يحين دورك."],
  },
  monopoly: {
    goal: "احسم الرحلة بالاحتكار الخطي أو الثلاثي أو السياحي، أو كن آخر مستثمر بعد إفلاس المنافسين.",
    steps: [
      "ارمِ النرد وتحرك حول 24 محطة. النرد المزدوج يمنحك رمية إضافية، وثلاث رميات مزدوجة متتالية تنقلك إلى الجزيرة.",
      "عند شراء المدينة اختر مستوى الاستثمار: فيلا أو مبنى أو فندق، ثم طوّرها لاحقًا إلى مَعْلم. المَعْلم يمنع الاستحواذ ويرفع الرسوم لأعلى مستوى.",
      "عند زيارة ملك منافس تدفع الرسوم، وبعدها يمكنك الاستحواذ عليه إن لم يكن مَعْلمًا. امتلاك المجموعة كاملة يضاعف الرسوم.",
      "جولة المملكة تسمح باختيار أي مدينة، والمهرجان يضاعف رسوم موقع تملكه لدورة، وبطاقات الفرص تغيّر المال أو الحركة.",
      "إذا لم تكفِ السيولة لسداد دين، بع أملاكك للبنك بقيمة تصفية 70% أو أعلن الإفلاس؛ وتنتقل الأملاك للدائن.",
    ],
    notes: [
      "المرور بالانطلاق يمنح 300K، والخروج من الجزيرة يكون بنرد مزدوج أو 150K أو بطاقة خروج.",
      "الاحتكار الخطي: امتلاك جانب كامل. الثلاثي: إكمال ثلاث مجموعات. السياحي: امتلاك العلا ومكة والمدينة.",
      "العلم بلون اللاعب ورقمه يحدد المالك، وشكل المبنى يوضح التطوير. اضغط الأرض لعرض رسومها الحالية.",
      "لكل لاعب منظور من جهة جلوسه. تظهر رمية النرد والحركة والبطاقة نفسها للجميع، ويمكن كتم الصوت من الطاولة.",
    ],
  },
};

function GameGuideSheet({ game, onClose }: { game: GameKey; onClose: () => void }) {
  const meta = gameMeta(game);
  const guide = GAME_GUIDES[game] ?? {
    goal: meta.short,
    steps: ["اتبع تعليمات الدور الظاهرة داخل اللعبة.", "كل حركة تتزامن تلقائيًا مع بقية الموجودين في الغرفة."],
    notes: ["يمكن للمضيف إضافة بوتات وتجربة اللعبة منفردًا."],
  };
  const GuideIcon = meta.icon;
  return (
    <div className="fixed inset-0 z-[10050] flex items-end justify-center bg-black/70 p-2 backdrop-blur-md sm:items-center" onClick={onClose} dir="rtl">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`طريقة لعب ${meta.label}`}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[88dvh] w-full max-w-xl overflow-y-auto rounded-t-[34px] border border-[#e7c870]/35 bg-[#f8f1df] p-5 text-[#113c32] shadow-2xl sm:rounded-[34px] sm:p-7"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-[#0a5948] text-[#efd17f]"><GuideIcon className="size-6" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-[#9b702d]">دليل سريع</p>
            <h4 className="text-2xl font-black">طريقة لعب {meta.label}</h4>
          </div>
          <button type="button" onClick={onClose} aria-label="إغلاق الدليل" className="flex size-11 items-center justify-center rounded-full bg-[#113c32]/8"><X className="size-5" /></button>
        </div>

        <div className="mt-5 rounded-3xl bg-[#0a5948] p-5 text-white">
          <p className="text-xs font-black text-[#efd17f]">هدف اللعبة</p>
          <p className="mt-2 text-base font-black leading-7">{guide.goal}</p>
        </div>

        <ol className="mt-5 space-y-3">
          {guide.steps.map((step, index) => (
            <li key={step} className="flex gap-3 rounded-2xl border border-[#113c32]/10 bg-white/55 p-3.5 text-sm font-bold leading-6">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#d9b765] font-black text-[#123c32]">{index + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <div className="mt-5 rounded-2xl border border-[#b78d3e]/25 bg-[#ead8a7]/25 p-4">
          {guide.notes.map((note) => <p key={note} className="flex gap-2 text-xs font-bold leading-6"><Sparkles className="mt-1 size-4 shrink-0 text-[#a87729]" /> {note}</p>)}
        </div>
      </div>
    </div>
  );
}

function GameSettingsSheet({
  preferences,
  onToggle,
  onClose,
}: {
  preferences: GameExperiencePreferences;
  onToggle: (key: keyof GameExperiencePreferences) => void;
  onClose: () => void;
}) {
  const settings: Array<{
    key: keyof GameExperiencePreferences;
    title: string;
    description: string;
    icon: LucideIcon;
  }> = [
    { key: "sound", title: "مؤثرات اللعب", description: "نغمة قصيرة عند انتقال الدور أو حدوث حركة", icon: preferences.sound ? Volume2 : VolumeX },
    { key: "haptics", title: "اهتزاز الجوال", description: "تنبيه لمسي خفيف عندما يصل الدور إليك", icon: Smartphone },
    { key: "reducedMotion", title: "تقليل الحركة", description: "إيقاف حركات البطاقات والانتقالات السريعة", icon: Settings2 },
  ];
  return (
    <div className="fixed inset-0 z-[10050] flex items-end justify-center bg-black/70 p-2 backdrop-blur-md sm:items-center" onClick={onClose} dir="rtl">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="إعدادات تجربة اللعب"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-lg rounded-t-[34px] border border-[#e7c870]/35 bg-[#f8f1df] p-5 text-[#113c32] shadow-2xl sm:rounded-[34px] sm:p-7"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-[#0a5948] text-[#efd17f]"><Settings2 className="size-6" /></span>
          <div className="min-w-0 flex-1"><p className="text-xs font-black text-[#9b702d]">تخصيص الجهاز</p><h4 className="text-2xl font-black">إعدادات اللعب</h4></div>
          <button type="button" onClick={onClose} aria-label="إغلاق الإعدادات" className="flex size-11 items-center justify-center rounded-full bg-[#113c32]/8"><X className="size-5" /></button>
        </div>

        <div className="mt-5 space-y-3">
          {settings.map(({ key, title, description, icon: Icon }) => {
            const enabled = preferences[key];
            return (
              <button key={key} type="button" onClick={() => onToggle(key)} aria-pressed={enabled} className="flex min-h-20 w-full items-center gap-3 rounded-2xl border border-[#113c32]/10 bg-white/60 p-3.5 text-right">
                <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl", enabled ? "bg-[#0a5948] text-[#efd17f]" : "bg-[#113c32]/8 text-[#113c32]/45")}><Icon className="size-5" /></span>
                <span className="min-w-0 flex-1"><span className="block font-black">{title}</span><span className="mt-0.5 block text-xs font-bold text-[#113c32]/55">{description}</span></span>
                <span className={cn("relative h-7 w-12 shrink-0 rounded-full transition", enabled ? "bg-[#0a5948]" : "bg-[#113c32]/15")}><span className={cn("absolute top-1 size-5 rounded-full bg-white shadow transition", enabled ? "left-1" : "left-6")} /></span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GameBoard({
  state,
  players,
  me,
  isHost,
  now,
  connected = true,
  clockOffset = 0,
  dispatch,
}: {
  state: RoomState;
  players: Player[];
  me: Player;
  isHost: boolean;
  now: number;
  connected?: boolean;
  clockOffset?: number;
  dispatch: (type: string, value?: any) => Promise<void>;
}) {
  const meta = gameMeta(state.game);
  const GameIcon = meta.icon;
  const logoUrl = useSiteLogo();
  const [gameMode, setGameMode] = useState(() => timedTableGame(state.game) || state.game === "monopoly");
  const [portalReady, setPortalReady] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { preferences, toggle } = useGameExperiencePreferences();
  const gameModeRef = useRef<HTMLDivElement | null>(null);
  const feedbackRef = useRef<string | null>(null);
  const [showStartingDraw, setShowStartingDraw] = useState(() => Date.now() - Number(state.data.startingDrawAt ?? 0) < 3200);

  useEffect(() => setPortalReady(true), []);

  const landscapeGameActive = gameMode && (state.game === "uno" || state.game === "saudi-deal" || state.game === "monopoly");

  useEffect(() => {
    if (!landscapeGameActive) return;
    document.documentElement.dataset.gameLandscape = "true";
    window.dispatchEvent(new Event("alsaif:game-orientation-change"));
    const orientation = window.screen.orientation as unknown as { unlock?: () => void };
    try { orientation?.unlock?.(); } catch { /* The browser may own orientation state. */ }
    return () => {
      delete document.documentElement.dataset.gameLandscape;
      window.dispatchEvent(new Event("alsaif:game-orientation-change"));
    };
  }, [landscapeGameActive]);

  useEffect(() => {
    const elapsed = Date.now() - Number(state.data.startingDrawAt ?? 0);
    if (elapsed >= 3200) {
      setShowStartingDraw(false);
      return;
    }
    setShowStartingDraw(true);
    const timer = window.setTimeout(() => setShowStartingDraw(false), 3200 - Math.max(0, elapsed));
    return () => window.clearTimeout(timer);
  }, [state.data.startingDrawAt]);

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

  const activeIndex = state.data.stage === "bidding"
    ? state.data.bidTurnIndex
    : state.data.turnIndex ?? state.data.activeIndex ?? 0;
  const feedbackToken = `${state.game}:${state.round}:${state.data.stage ?? ""}:${activeIndex}:${state.data.lastAction ?? ""}:${state.data.trick?.length ?? 0}`;
  const dealHeaderStep = state.data.needsDraw
    ? "اسحب أوراقك"
    : state.data.actionsLeft === 2
      ? "حركتان متبقيتان"
      : state.data.actionsLeft === 1
        ? "حركة متبقية"
        : "انتهت الحركات";
  const dealActivePlayer = players[activeIndex % Math.max(players.length, 1)];
  const compactHeaderStatus = state.game === "saudi-deal"
    ? `${dealActivePlayer?.id === me.id ? "دورك الآن" : `الدور عند ${dealActivePlayer?.name?.split(" ")[0] ?? "—"}`} · ${dealHeaderStep}`
    : `الجولة ${state.round + 1} · ${players.length} لاعبين`;

  useEffect(() => {
    if (!gameMode) {
      feedbackRef.current = feedbackToken;
      return;
    }
    if (feedbackRef.current && feedbackRef.current !== feedbackToken) {
      const activePlayer = players[activeIndex % Math.max(players.length, 1)];
      const isMyTurn = activePlayer?.id === me.id;
      if (preferences.haptics && typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(isMyTurn ? [35, 30, 65] : 22);
      }
      if (preferences.sound && state.game !== "monopoly" && state.game !== "saudi-deal") playGameTone(isMyTurn ? "turn" : "move");
    }
    feedbackRef.current = feedbackToken;
  }, [activeIndex, feedbackToken, gameMode, me.id, players, preferences.haptics, preferences.sound, state.game]);

  const enterGameMode = async () => {
    setGameMode(true);
    const element = gameModeRef.current as (HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> | void }) | null;
    try {
      if (element?.requestFullscreen) await element.requestFullscreen();
      else await element?.webkitRequestFullscreen?.();
    } catch {
      // iOS browsers may reject the native API; the fixed 100dvh game shell remains active.
    }
    if (state.game === "saudi-deal" || state.game === "uno" || state.game === "monopoly") {
      const orientation = window.screen.orientation as unknown as { lock?: (value: string) => Promise<void> };
      try { await orientation?.lock?.("landscape"); } catch { /* iOS uses the rotate-device prompt below. */ }
    }
  };

  const leaveGameMode = async () => {
    setGameMode(false);
    if (state.game === "saudi-deal" || state.game === "uno" || state.game === "monopoly") {
      const orientation = window.screen.orientation as unknown as { unlock?: () => void };
      try { orientation?.unlock?.(); } catch { /* The operating system owns orientation state. */ }
    }
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

  const gameBoard = (
    <div
      ref={gameModeRef}
      className={cn(
        "grid gap-5 lg:grid-cols-[1fr_260px]",
        gameMode && "fixed inset-0 z-[9999] block !m-0 h-screen h-[100dvh] w-screen !max-w-none overflow-hidden bg-[#031d18] !transform-none",
        gameMode && state.game === "saudi-deal" && "bg-[#eee4d1]",
        gameMode && preferences.reducedMotion && "[&_*]:!animate-none [&_*]:!transition-none",
      )}
    >
      {gameMode && (state.game === "saudi-deal" || state.game === "uno") && (
        <div className="fixed inset-0 z-[10050] hidden flex-col items-center justify-center bg-[#021f19]/98 px-8 text-center text-white portrait:flex xl:hidden">
          <span className="flex size-20 items-center justify-center rounded-[26px] border border-[#e8c66f]/40 bg-[#0a5948] text-[#f0cf77] shadow-[0_0_40px_rgba(232,198,111,.2)]">
            <RotateCw className="size-10 animate-pulse" />
          </span>
          <h4 className="mt-6 text-2xl font-black text-[#f0cf77]">لف الجهاز للوضع الأفقي</h4>
          <p className="mt-2 max-w-sm text-sm font-bold leading-7 text-white/65">{state.game === "uno" ? "أونو العائلة مرتبة كطاولة حقيقية على الشاشة العريضة." : "سعودي ديل مرتبة للشاشة العريضة."} إذا لم تلتف الشاشة تلقائيًا، ألغِ قفل تدوير الجهاز ثم لفه.</p>
        </div>
      )}
      {showStartingDraw && !timedTableGame(state.game) && (
        <div className="arena-starting-draw" role="status" aria-live="polite">
          <div className="arena-starting-draw__halo" />
          <Crown className="arena-starting-draw__crown" />
          <p>قرعة بداية {meta.label}</p>
          <strong>{state.data.starterName}</strong>
          <span>يبدأ الجولة</span>
        </div>
      )}
      <Surface className={cn("min-h-[520px] overflow-hidden p-5 sm:p-8", gameMode && "flex h-full min-h-0 flex-col rounded-none border-0 bg-[#031d18] p-0 shadow-none", gameMode && (state.game === "saudi-deal" || state.game === "monopoly") && "bg-transparent", gameMode && state.game === "saudi-deal" && "!p-0")}>
        <div
          className={cn(
            "mb-7 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-5",
            gameMode && "relative mb-0 min-h-[82px] shrink-0 border-white/10 bg-[radial-gradient(circle_at_50%_0%,#0b5a48_0%,#052d26_58%,#031f1a_100%)] px-3 pb-2 text-white shadow-lg landscape:min-h-[58px] landscape:pb-1",
            gameMode && state.game === "saudi-deal" && "bg-none bg-[#032b24]/85 backdrop-blur-md",
            gameMode && (timedTableGame(state.game) || state.game === "monopoly") && "hidden",
          )}
          style={gameMode ? { paddingTop: "max(.5rem, env(safe-area-inset-top))" } : undefined}
        >
          {gameMode ? (
            <>
              <button
                type="button"
                onClick={() => void leaveGameMode()}
                className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full border border-[#e8c66f]/25 bg-white/10 text-white shadow sm:w-auto sm:px-4"
                aria-label="إغلاق وضع اللعبة"
              >
                <Minimize2 className="size-4" /><span className="mr-2 hidden text-sm font-black sm:inline">رجوع</span>
              </button>

              <div className="pointer-events-none flex min-w-0 flex-1 items-center justify-center gap-2 px-1 text-center">
                <GameIcon className="size-7 shrink-0 text-[#e8c66f] drop-shadow" />
                <div className="min-w-0">
                  <h3 className="text-[1.35rem] font-black leading-none text-[#edcf7d]">{meta.label}</h3>
                  <p className="mt-1 text-[10px] font-bold text-white/50">{compactHeaderStatus}</p>
                </div>
              </div>

              <div className="relative z-10 flex shrink-0 items-center gap-1.5">
                <button type="button" onClick={() => setShowGuide(true)} aria-label="طريقة اللعب" className="flex size-11 items-center justify-center rounded-full border border-[#e8c66f]/25 bg-[#e8c66f]/10 text-[#e8c66f] shadow"><BookOpen className="size-5" /></button>
                <button type="button" onClick={() => setShowSettings(true)} aria-label="إعدادات اللعب" className="flex size-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white shadow"><Settings2 className="size-5" /></button>
              </div>
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
                  className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-3 text-xs font-black text-primary-foreground shadow 2xl:hidden"
                >
                  <Maximize2 className="size-4" /> {state.game === "saudi-deal" || state.game === "uno" || state.game === "monopoly" ? "اللعب أفقيًا" : "وضع اللعبة"}
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
          className={cn(
            gameMode && "min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[radial-gradient(circle_at_50%_12%,rgba(23,102,80,.32),transparent_42%),linear-gradient(#031d18,#021713)] px-2 py-2 sm:px-4",
            gameMode && state.game === "saudi-deal" && "bg-none bg-transparent",
            gameMode && (timedTableGame(state.game) || state.game === "monopoly") && "overflow-hidden bg-none bg-transparent !p-0",
          )}
          style={gameMode && !timedTableGame(state.game) && state.game !== "monopoly" ? { paddingBottom: "max(.75rem, env(safe-area-inset-bottom))" } : undefined}
        >
          {state.game === "uno" && (
            <UnoGameRoom
              state={state}
              players={players}
              me={me}
              immersive={gameMode}
              dispatch={dispatch}
              onExit={() => void leaveGameMode()}
              onGuide={() => setShowGuide(true)}
              onSettings={() => setShowSettings(true)}
              isHost={isHost}
              onFinish={() => void dispatch("finish")}
              connected={connected}
              clockOffset={clockOffset}
              sound={preferences.sound}
              reducedMotion={preferences.reducedMotion}
              onToggleSound={() => toggle("sound")}
            />
          )}
          {state.game === "monopoly" && (
            <MillionaireGameRoom
              state={state}
              players={players}
              me={me}
              immersive={gameMode}
              dispatch={dispatch}
              onExit={() => void leaveGameMode()}
              onGuide={() => setShowGuide(true)}
              onSettings={() => setShowSettings(true)}
              sound={preferences.sound}
              reducedMotion={preferences.reducedMotion}
              onToggleSound={() => toggle("sound")}
            />
          )}
          {state.game === "saudi-deal" && <SaudiDealGameRoom state={state} players={players} me={me} logoUrl={logoUrl} immersive={gameMode} dispatch={dispatch} connected={connected} clockOffset={clockOffset} sound={preferences.sound} reducedMotion={preferences.reducedMotion} onToggleSound={() => toggle("sound")} onExit={() => void leaveGameMode()} onGuide={() => setShowGuide(true)} onSettings={() => setShowSettings(true)} isHost={isHost} onFinish={() => void dispatch("finish")} />}
          {state.game === "trivia" && <TriviaGame state={state} players={players} me={me} isHost={isHost} dispatch={dispatch} />}
          {state.game === "judge" && <JudgeGame state={state} players={players} me={me} isHost={isHost} dispatch={dispatch} />}
          {state.game === "challenge30" && <ChallengeGame state={state} players={players} me={me} isHost={isHost} now={now} dispatch={dispatch} />}
          {state.game === "auction" && <AuctionRoom state={state} players={players} me={me} isHost={isHost} dispatch={dispatch} />}
          {state.game === "word-duel" && <WordDuelRoom state={state} players={players} me={me} dispatch={dispatch} />}
          {state.game === "baloot" && <BalootRoom state={state} players={players} me={me} isHost={isHost} logoUrl={logoUrl} immersive={gameMode} dispatch={dispatch} />}
        </div>
      </Surface>

      {!gameMode && <ScoreRail players={players} scores={state.scores} hostId={players.find((player) => player.isHost)?.id} />}
      {showGuide && <GameGuideSheet game={state.game} onClose={() => setShowGuide(false)} />}
      {showSettings && <GameSettingsSheet preferences={preferences} onToggle={toggle} onClose={() => setShowSettings(false)} />}
    </div>
  );

  if (gameMode && portalReady && typeof document !== "undefined") {
    return createPortal(gameBoard, document.body);
  }
  return gameBoard;
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

function cardinalSeatPositions(count: number): Array<"top" | "right" | "bottom" | "left"> {
  if (count <= 2) return ["bottom", "top"];
  if (count === 3) return ["bottom", "left", "right"];
  return ["bottom", "left", "top", "right"];
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
    <div className="arena-majlis">
      {/* ضوء المجلس المعلّق فوق الطاولة */}
      <div aria-hidden className="arena-lamp" />
      {/* وسائد المجلس حول الطاولة */}
      <div aria-hidden className="arena-cushion left-1/2 top-0 h-3 w-32 -translate-x-1/2" />
      <div aria-hidden className="arena-cushion bottom-0 left-1/2 h-3 w-32 -translate-x-1/2" />
      <div aria-hidden className="arena-cushion left-0 top-1/2 h-28 w-3 -translate-y-1/2" />
      <div aria-hidden className="arena-cushion right-0 top-1/2 h-28 w-3 -translate-y-1/2" />
      {/* غبار ضوئي خفيف */}
      {[12, 34, 58, 76, 90].map((left, index) => (
        <span
          key={left}
          aria-hidden
          className="arena-dust"
          style={{ left: `${left}%`, bottom: "18%", animationDelay: `${index * 1.3}s` }}
        />
      ))}
      <div
        className={cn(
          "relative rounded-[48%] bg-gradient-to-br p-[6px] shadow-[0_34px_70px_-30px_rgba(0,0,0,.95)] sm:rounded-[38px] sm:p-[7px]",
          heritageTable && "p-[9px] sm:p-[10px]",
          trimClass,
        )}
        style={heritageTable ? {
          backgroundImage: "repeating-linear-gradient(112deg,#2d170b 0 9px,#7a4b25 9px 17px,#3b2110 17px 24px,#a46d35 24px 30px)",
        } : undefined}
      >
      <div className="rounded-[47%] bg-gradient-to-br from-[#f2d58b] via-[#8f602f] to-[#e6c06a] p-[2px] sm:rounded-[32px]">
        <div
          className={cn("relative isolate overflow-hidden rounded-[46%] border border-[#f2d999]/45 bg-[#073d32] text-white shadow-[inset_0_18px_35px_rgba(255,255,255,.025),inset_0_-28px_50px_rgba(0,0,0,.28)] sm:rounded-[29px]", className)}
          style={{
            backgroundImage:
              "radial-gradient(circle at 50% 44%, rgba(19,112,84,.35), transparent 48%), linear-gradient(135deg, rgba(236,207,124,.035) 25%, transparent 25%, transparent 50%, rgba(236,207,124,.035) 50%, rgba(236,207,124,.035) 75%, transparent 75%, transparent)",
            backgroundSize: "auto, 28px 28px",
          }}
        >
          <div aria-hidden className="pointer-events-none absolute inset-3 rounded-[44%] border border-[#e5c878]/28 sm:rounded-[23px]" />
          <div aria-hidden className="pointer-events-none absolute inset-5 rounded-[43%] border border-[#e5c878]/10 sm:rounded-[20px]" />
          <div aria-hidden className="pointer-events-none absolute inset-x-[22%] top-2 h-px bg-gradient-to-r from-transparent via-[#ffe5a1]/70 to-transparent" />
          <div aria-hidden className="pointer-events-none absolute inset-x-[22%] bottom-2 h-px bg-gradient-to-r from-transparent via-black/45 to-transparent" />
          {children}
        </div>
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

function CardinalPlayerSeat({
  player,
  active,
  position,
  cardCount,
  badge,
  team,
}: {
  player: Player;
  active: boolean;
  position: "top" | "right" | "bottom" | "left";
  cardCount: number;
  badge?: ReactNode;
  team?: 0 | 1;
}) {
  const positionClass = {
    top: "left-1/2 top-2 -translate-x-1/2",
    right: "right-0.5 top-1/2 -translate-y-1/2",
    bottom: "bottom-2 left-1/2 -translate-x-1/2",
    left: "left-0.5 top-1/2 -translate-y-1/2",
  }[position];
  const ringClass = team == null
    ? "border-[#dfbd68]"
    : team === 0
      ? "border-[#62caa9]"
      : "border-[#e4b958]";

  return (
    <div className={cn("absolute z-30 flex w-[92px] flex-col items-center text-center sm:w-[112px]", positionClass)}>
      <div className="relative h-9 w-[76px]" aria-label={`${cardCount} أوراق مقلوبة`}>
        {Array.from({ length: Math.min(cardCount, 5) }).map((_, index, visibleCards) => {
          const middle = (visibleCards.length - 1) / 2;
          return (
            <span
              key={index}
              aria-hidden
              className="absolute bottom-0 left-1/2 h-8 w-5 origin-bottom rounded border-2 border-[#f5e6bc] bg-[linear-gradient(145deg,#0c6551,#052d26_62%,#ba9145)] shadow-md"
              style={{ transform: `translateX(calc(-50% + ${(index - middle) * 8}px)) rotate(${(index - middle) * 8}deg)` }}
            />
          );
        })}
        <span className="absolute -right-0.5 -top-1 z-10 flex size-5 items-center justify-center rounded-full bg-[#efd078] text-[9px] font-black text-[#07382e] shadow">{cardCount}</span>
      </div>

      <div className={cn("relative rounded-full border-2 bg-[#062d26] p-1 shadow-xl transition", ringClass, active && "arena-turn-glow scale-105 ring-4 ring-[#efd078]/20")}>
        <PlayerAvatar player={player} size="sm" />
        {active && <span className="absolute -right-1 -top-1 size-3 animate-pulse rounded-full border-2 border-[#052d26] bg-emerald-400" />}
      </div>
      <div className={cn("-mt-1 flex min-w-[78px] max-w-[108px] items-center justify-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black shadow-lg backdrop-blur", active ? "border-[#efd078] bg-[#0d5c4a] text-[#f5d985]" : "border-white/15 bg-[#04251f]/92 text-white")}>
        <span className="truncate">{position === "bottom" ? "أنت" : player.name.split(" ")[0]}</span>
        {player.isBot && <Bot className="size-3 shrink-0 text-[#efd078]" />}
      </div>
      {badge && <div className="mt-1 rounded-full border border-white/10 bg-black/35 px-2 py-0.5 text-[9px] font-black text-[#efd078] shadow">{badge}</div>}
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
      <div className={cn("arena-tray flex min-h-48 gap-2 overflow-x-auto rounded-[26px] border border-[#e7cb8e]/30 bg-[#07382f] p-4 pb-5", className)}>
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
  if (value === "draw4") return "+4";
  if (value === "draw5") return "+5";
  if (value === "draw6") return "+6";
  if (value === "draw10") return "+10";
  if (value === "flip") return "قلب";
  if (value === "skipAll") return "تخطي الجميع";
  if (value === "discardAll") return "تخلص من اللون";
  return value;
}

function UnoCardFace({
  card,
  small = false,
  active = true,
  onClick,
  className,
}: {
  card: UnoCard;
  small?: boolean;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const colorClass: Record<UnoColor, string> = {
    red: "from-[#ff5b59] via-[#d71937] to-[#8d061e]",
    blue: "from-[#36a8ff] via-[#0962cc] to-[#07367c]",
    green: "from-[#35d48b] via-[#05905d] to-[#03543c]",
    yellow: "from-[#ffe46f] via-[#f4b928] to-[#d37b08] text-[#28200d]",
    wild: "from-[#171717] via-[#0e2c27] to-black",
  };
  const symbol = card.value === "skip"
    ? "⊘"
    : card.value === "reverse"
      ? "↻"
      : card.value === "wild"
        ? "✦"
        : unoValueLabel(card.value);
  const label = unoValueLabel(card.value);
  const content = (
    <>
      <span aria-hidden className="absolute inset-1 rounded-[10px] border border-white/35" />
      <span aria-hidden className="absolute -right-5 top-1/3 h-9 w-[135%] -rotate-[28deg] bg-white/12 blur-[1px]" />
      <span className={cn("absolute right-2 top-1.5 z-10 font-black drop-shadow", small ? "text-[10px]" : "text-xs")}>{label}</span>
      <span className={cn("relative flex w-[72%] -rotate-[18deg] items-center justify-center rounded-[50%] bg-white/92 text-center font-black text-slate-900 shadow-[inset_0_0_18px_rgba(0,0,0,.18),0_8px_18px_rgba(0,0,0,.18)]", small ? "aspect-[.72] text-2xl" : "aspect-[.68] text-4xl sm:text-5xl")}>
        <span className="rotate-[18deg]">{symbol}</span>
      </span>
      <span className={cn("absolute bottom-1.5 left-2 z-10 rotate-180 font-black drop-shadow", small ? "text-[10px]" : "text-xs")}>{label}</span>
    </>
  );
  const cardClassName = cn(
    "relative flex shrink-0 select-none items-center justify-center overflow-hidden rounded-[18px] border-[5px] border-[#fffdf5] bg-gradient-to-br font-black text-white shadow-[0_16px_28px_-14px_rgba(0,0,0,.9)]",
    colorClass[card.color],
    small ? "h-[98px] w-[66px] rounded-[14px] border-[4px]" : "h-[150px] w-[102px] sm:h-[178px] sm:w-[118px]",
    active ? "ring-2 ring-white/25" : "opacity-35 grayscale-[.35] saturate-50",
    className,
  );
  const style = card.color === "wild" ? {
    backgroundImage: "conic-gradient(from 28deg,#e11d48 0 25%,#f5c430 25% 50%,#16a36c 50% 75%,#1677d2 75%)",
  } : undefined;
  if (!onClick) return <div className={cn(cardClassName, "arena-card-drop")} style={style}>{content}</div>;
  return (
    <button
      type="button"
      disabled={!active}
      onClick={() => {
        playGameTone("play");
        onClick();
      }}
      aria-label={`لعب ${label}`}
      className={cn(cardClassName, active && "arena-card-hover active:scale-95")}
      style={style}
    >
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
  const modeLabel = data.mode === "flip" ? "فليب" : data.mode === "no-mercy" ? "نو ميرسي" : "كلاسيك";
  const [choosingWild, setChoosingWild] = useState<UnoCard | null>(null);
  const colorClass: Record<string, string> = {
    red: "bg-red-600",
    blue: "bg-blue-600",
    green: "bg-emerald-600",
    yellow: "bg-amber-400 text-slate-900",
  };
  const seatedPlayers = useMemo(() => orderPlayersAroundMe(players, me.id), [players, me.id]);
  const opponents = seatedPlayers.filter((player) => player.id !== me.id);
  const cardinalPositions = cardinalSeatPositions(seatedPlayers.length);

  const play = (card: UnoCard) => {
    if (card.color === "wild") {
      setChoosingWild(card);
      return;
    }
    void dispatch("uno-play", { cardId: card.id });
  };

  // السحب التلقائي في أونو: إذا لم توجد ورقة صالحة تسحب اللعبة نيابة عن اللاعب.
  const hasPlayableCard = hand.some((card) => unoPlayable(card, data, hand));
  useEffect(() => {
    if (!amActive || data.drawnCardId || hasPlayableCard) return;
    const timer = window.setTimeout(() => {
      playGameTone("draw");
      void dispatch("uno-draw");
    }, 650);
    return () => window.clearTimeout(timer);
  }, [amActive, data.drawnCardId, hasPlayableCard, data.turnIndex, dispatch]);



  return (
    <div className={cn("space-y-5", immersive && "space-y-3")}>
      <div className={cn("grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-[#dbc58d] bg-[#f7efdc] px-3 py-2.5 text-[#173e34] shadow-sm sm:px-5 sm:py-3", immersive && "sticky top-0 z-40 rounded-[24px] shadow-[0_12px_28px_-20px_rgba(0,0,0,.9)]")}>
        <div className="flex min-w-0 items-center gap-2.5">
          {active && <PlayerAvatar player={active} size="sm" />}
          <div className="min-w-0"><p className="truncate text-sm font-black sm:text-base">الدور عند {active?.name?.split(" ")[0] ?? "—"}</p><p className="truncate text-xs font-bold text-[#173e34]/55">أونو {modeLabel} · {data.lastAction}</p></div>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-[#0b5b47] px-3 py-2 text-white">
          <span className={cn("size-4 rounded-full border-2 border-white/35", colorClass[data.currentColor])} />
          <div><p className="text-[9px] font-bold text-white/55">اللون الحالي</p><p className="text-xs font-black text-[#efd07d]">{UNO_COLOR_LABELS[data.currentColor as Exclude<UnoColor, "wild">] ?? data.currentColor}</p></div>
        </div>
      </div>

      <GameTableSurface trim="uno" className={cn("min-h-[560px] sm:min-h-[660px]", immersive && "h-[60dvh] min-h-[500px] max-h-[700px]")}>
        <div className={cn("relative z-10 min-h-[560px] w-full sm:min-h-[660px]", immersive && "h-full min-h-0")}>
          {seatedPlayers.length <= 4 ? seatedPlayers.map((player, index) => (
            <CardinalPlayerSeat
              key={player.id}
              player={player}
              active={active?.id === player.id}
              position={cardinalPositions[index]}
              cardCount={data.hands[player.id]?.length ?? 0}
              badge={data.unoCalled[player.id] ? "أونو!" : undefined}
            />
          )) : (
            <>
              <CardinalPlayerSeat player={me} active={amActive} position="bottom" cardCount={hand.length} badge={data.unoCalled[me.id] ? "أونو!" : undefined} />
              <div className="absolute inset-x-3 top-3 z-30 flex gap-2 overflow-x-auto pb-2">
                {opponents.map((player) => (
                  <TablePlayerSeat key={player.id} player={player} active={active?.id === player.id} detail={`${data.hands[player.id]?.length ?? 0} أوراق`} className="min-w-[104px]" />
                ))}
              </div>
            </>
          )}

          <div className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
            <div className="relative flex h-[230px] w-[190px] items-center justify-center sm:h-[285px] sm:w-[245px]">
              <TableBrandSeal logoUrl={logoUrl} className="absolute left-1/2 top-1/2 size-20 -translate-x-1/2 -translate-y-1/2 opacity-90 sm:size-28" />
              <button type="button" aria-label="سحب ورقة من رزمة أونو" disabled={!amActive || Boolean(data.drawnCardId)} onClick={() => { playGameTone("draw"); void dispatch("uno-draw"); }} className="absolute right-0 top-1/2 -translate-y-1/2 transition enabled:hover:-translate-y-[54%] enabled:active:scale-95 disabled:opacity-55">
                <BrandedCardBack label={amActive ? "اسحب" : "أونو"} count={data.drawPile.length} compact className="h-[102px] w-[68px] sm:h-28 sm:w-[76px]" />
              </button>
              <div className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-3"><UnoCardFace card={top} small /></div>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-4 py-1.5 text-[10px] font-black text-white/70 shadow backdrop-blur-sm sm:text-xs">
              <span className="text-[#efd078]">{data.direction === 1 ? "↺" : "↻"}</span>
              <span>{data.direction === 1 ? "الاتجاه المعتاد" : "الاتجاه معكوس"}</span>
            </div>
            {(data.pendingDraw ?? 0) > 0 && (
              <div className="mt-2 animate-pulse rounded-full border border-rose-300/40 bg-rose-700/85 px-4 py-1.5 text-xs font-black text-white shadow-lg">
                اسحب {data.pendingDraw} أو ارمِ بطاقة سحب أقوى
              </div>
            )}
          </div>
        </div>
      </GameTableSurface>

      {choosingWild && (
        <div className="fixed inset-0 z-[10060] flex items-end justify-center bg-black/70 p-2 backdrop-blur-md sm:items-center" onClick={() => setChoosingWild(null)}>
          <div className="w-full max-w-md rounded-t-[32px] bg-[#f8f1df] p-5 text-center shadow-2xl sm:rounded-[32px]" onClick={(event) => event.stopPropagation()}>
          <p className="mb-4 text-lg font-black text-[#123c32]">اختر اللون التالي</p>
          <div className="grid grid-cols-2 gap-3">
            {UNO_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => {
                  void dispatch("uno-play", { cardId: choosingWild.id, color });
                  setChoosingWild(null);
                }}
                className={cn("h-16 rounded-2xl border-4 border-white/70 text-sm font-black text-white shadow-lg", colorClass[color])}
              >
                {UNO_COLOR_LABELS[color]}
              </button>
            ))}
          </div>
          </div>
        </div>
      )}

      <div className={cn(immersive && "sticky bottom-0 z-30 -mx-2 rounded-t-[30px] border-t border-[#dfbd66]/20 bg-[#031d18]/96 p-2 pt-3 shadow-[0_-24px_48px_-26px_rgba(0,0,0,.95)] backdrop-blur-xl")}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className={cn("text-xs font-bold text-muted-foreground", immersive && "text-[#d6bd7b]/60")}>أوراقك الخاصة</p>
            <p className={cn("font-black text-primary", immersive && "text-lg text-white")}>{hand.length} أوراق</p>
          </div>
          {amActive && hand.length <= 2 && !data.unoCalled[me.id] && (
            <button type="button" onClick={() => void dispatch("uno-call")} className="rounded-full bg-rose-600 px-5 py-2 text-sm font-black text-white shadow-lg">
              أونو!
            </button>
          )}
        </div>
        <CardHandTray immersive={immersive} className={cn(immersive && "min-h-[215px] gap-0 overflow-y-hidden px-3 pb-3 pt-8")}>
          {hand.map((card) => {
            const playable = amActive && unoPlayable(card, data, hand) && (!data.drawnCardId || data.drawnCardId === card.id);
            return <div key={card.id} className={cn("shrink-0", immersive && "-ml-7 first:ml-0 sm:-ml-5")}><UnoCardFace card={card} active={playable} onClick={() => play(card)} /></div>;
          })}
        </CardHandTray>

        {amActive && data.drawnCardId && (
          <div className="mt-2"><PrimaryAction onClick={() => void dispatch("uno-pass")} tone="muted">تمرير الدور بدون لعب الورقة</PrimaryAction></div>
        )}
      </div>
      {!amActive && <p className="text-center text-sm font-bold text-muted-foreground">بانتظار {active?.name} — ستتحدث الطاولة عندك تلقائيًا</p>}
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
  const voteTotal = Math.max(1, Object.keys(data.votes).length);
  return (
    <div className="arena-social-stage mx-auto max-w-4xl space-y-5">
      <div className="arena-judge-bench text-center">
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
                "relative flex min-h-20 items-center gap-3 overflow-hidden rounded-2xl border-2 p-4 text-right transition",
                selected ? "border-gold-primary bg-gold-primary/10" : "border-border bg-muted/25",
                winner && "border-emerald-500 bg-emerald-500/15",
              )}
            >
              {data.revealed && <span aria-hidden className="absolute inset-y-0 right-0 bg-gold-primary/12 transition-all duration-700" style={{ width: `${((counts[player.id] ?? 0) / voteTotal) * 100}%` }} />}
              <PlayerAvatar player={player} />
              <span className="relative min-w-0 flex-1 truncate font-black text-primary">{player.name}</span>
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
  const card = WHO_AM_I_CARDS[data.cardIndex % WHO_AM_I_CARDS.length];
  const [guess, setGuess] = useState("");
  const myGuess = data.guesses[me.id] as string | undefined;
  const solver = players.find((player) => player.id === data.solvedBy);
  useEffect(() => setGuess(""), [data.clueIndex, data.cardIndex]);
  return (
    <div className="arena-social-stage mx-auto max-w-4xl space-y-5">
      <div className="arena-who-card text-center">
        <Eye className="mx-auto size-10 text-gold-primary" />
        <p className="mt-3 text-xs font-black text-gold-primary">من أنا؟ · التلميح {data.clueIndex + 1} من {card.clues.length}</p>
        <h4 className="mt-4 text-2xl font-black leading-relaxed sm:text-4xl">{card.clues[data.clueIndex]}</h4>
        <div className="mx-auto mt-5 flex max-w-xs gap-2" dir="ltr">
          {card.clues.map((_, index) => <span key={index} className={cn("h-2 flex-1 rounded-full", index <= data.clueIndex ? "bg-gold-primary" : "bg-white/15")} />)}
        </div>
        {data.revealed && <div className="arena-answer-reveal mt-6"><span>الإجابة</span><strong>{card.answer}</strong>{solver && <small>اكتشفها {solver.name}</small>}</div>}
      </div>

      {!data.revealed && myGuess == null ? (
        <div className="mx-auto flex max-w-xl gap-3" dir="rtl">
          <input
            value={guess}
            maxLength={60}
            onChange={(event) => setGuess(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && guess.trim() && void dispatch("guess", guess)}
            placeholder="اكتب تخمينك هنا"
            className="h-16 min-w-0 flex-1 rounded-2xl border-2 border-border bg-card px-5 text-center text-lg font-black text-primary outline-none focus:border-gold-primary"
          />
          <button
            type="button"
            disabled={!guess.trim()}
            onClick={() => void dispatch("guess", guess)}
            className="min-w-28 rounded-2xl bg-gold-primary px-5 font-black text-[#10251e] disabled:opacity-35"
          >
            تخمين
          </button>
        </div>
      ) : !data.revealed ? (
        <p className="text-center text-base font-black text-emerald-600">تم إرسال تخمينك: {myGuess}</p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {players.map((player) => (
          <div key={player.id} className={cn("flex min-h-20 items-center gap-3 rounded-2xl border p-3", data.solvedBy === player.id ? "arena-turn-glow border-gold-primary bg-gold-primary/15" : "border-border bg-muted/25")}>
            <PlayerAvatar player={player} />
            <span className="min-w-0 flex-1 truncate font-black text-primary">{player.name}</span>
            <span className="font-black text-gold-primary">{data.guesses[player.id] != null ? "✓" : "…"}</span>
          </div>
        ))}
      </div>

      {isHost && !data.revealed && (
        <div className="grid gap-3 sm:grid-cols-2">
          <PrimaryAction onClick={() => void dispatch("next-clue")} disabled={data.clueIndex >= card.clues.length - 1} tone="gold">تلميح أوضح <ChevronLeft className="size-5" /></PrimaryAction>
          <PrimaryAction onClick={() => void dispatch("reveal")} tone="muted">كشف الإجابة</PrimaryAction>
        </div>
      )}
      {isHost && data.revealed && (
        <PrimaryAction onClick={() => void dispatch("next")}>بطاقة جديدة <ChevronLeft className="size-5" /></PrimaryAction>
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
    <div className="arena-social-stage mx-auto max-w-4xl space-y-5 text-center">
      <div className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-card/70 p-3">
        {active && <PlayerAvatar player={active} size="lg" />}
        <div className="text-right">
          <p className="text-xs font-bold text-muted-foreground">الدور الآن عند</p>
          <p className="text-xl font-black text-primary">{active?.name ?? "—"}</p>
        </div>
      </div>

      <div className="arena-letter-stage">
        <p className="text-sm font-black text-gold-primary">آخر حرف يبدأ التحدي التالي</p>
        <p className="arena-letter-glyph">{data.currentLetter}</p>
        <p className="text-xs font-bold text-white/55">لا تكرر كلمة ظهرت في السجل</p>
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
          <div className="arena-word-stream">
            {data.words.slice(-10).reverse().map((item: { playerId: string; word: string }, index: number) => (
              <div key={`${item.playerId}-${item.word}-${index}`} className="arena-word-chip"><span>{item.word}</span><small>{players.find((player) => player.id === item.playerId)?.name.split(" ")[0]}</small></div>
            ))}
          </div>
        </div>
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
      <span aria-hidden className="absolute inset-1 rounded-[9px] border border-[#b69145]/30" />
      <span className={cn("absolute right-2 top-1.5 flex flex-col items-center font-black leading-none", mini ? "text-xs" : "text-base")}><span>{card.rank}</span><span className={mini ? "text-xs" : "text-sm"}>{BALOOT_SUIT_LABEL[card.suit]}</span></span>
      <span aria-hidden className={cn("absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#b69145]/15 bg-[#fffdf7]/65", mini ? "size-8" : compact ? "size-12" : "size-16 sm:size-20")} />
      <span className={cn("relative font-serif drop-shadow-sm", mini ? "text-2xl" : compact ? "text-4xl" : "text-6xl sm:text-7xl")}>{BALOOT_SUIT_LABEL[card.suit]}</span>
      <span className={cn("absolute bottom-1.5 left-2 flex rotate-180 flex-col items-center font-black leading-none", mini ? "text-xs" : "text-base")}><span>{card.rank}</span><span className={mini ? "text-xs" : "text-sm"}>{BALOOT_SUIT_LABEL[card.suit]}</span></span>
    </>
  );
  const className = cn(
    "relative flex shrink-0 select-none items-center justify-center overflow-hidden rounded-[16px] border-[3px] border-[#fffdf5] bg-[radial-gradient(circle_at_45%_35%,#ffffff,#f6efdf_72%,#e6d4ad)] shadow-[0_16px_28px_-16px_rgba(0,0,0,.9)]",
    red ? "text-red-600" : "text-slate-950",
    mini ? "h-[70px] w-12 rounded-[11px] border-2" : compact ? "h-[106px] w-[72px]" : "h-[154px] w-[104px] sm:h-[184px] sm:w-[122px]",
    active ? "ring-2 ring-[#f0ce76]/35" : "opacity-35 saturate-50",
  );
  if (!onClick) return <div className={cn(className, "arena-card-drop")}>{content}</div>;
  return (
    <button
      type="button"
      disabled={!active}
      onClick={() => {
        playGameTone("play");
        onClick();
      }}
      aria-label={`لعب ${card.rank} ${BALOOT_SUIT_LABEL[card.suit]}`}
      className={cn(className, active && "arena-card-hover active:scale-95")}
    >
      {content}
    </button>
  );
}

function BalootTeams({ players, data, compact = false }: { players: Player[]; data: any; compact?: boolean }) {
  const first = players.filter((_, index) => index % 2 === 0);
  const second = players.filter((_, index) => index % 2 === 1);
  if (compact) {
    return (
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-[22px] border border-[#d8bc72]/30 bg-[#052d26]/95 p-2 text-white shadow-lg backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-emerald-400/10 px-3 py-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-lg font-black text-emerald-300">{data.matchScore?.[0] ?? 0}</span>
          <div className="min-w-0"><p className="text-[10px] font-black text-emerald-300">الفريق 1</p><p className="truncate text-[9px] font-bold text-white/55">{first.map((player) => player.name.split(" ")[0]).join(" + ")}</p></div>
        </div>
        <span className="text-xs font-black text-[#eacb78]">152</span>
        <div className="flex min-w-0 flex-row-reverse items-center gap-2 rounded-2xl bg-[#d7ac55]/10 px-3 py-2 text-left">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#d7ac55]/15 text-lg font-black text-[#edcb78]">{data.matchScore?.[1] ?? 0}</span>
          <div className="min-w-0"><p className="text-[10px] font-black text-[#edcb78]">الفريق 2</p><p className="truncate text-[9px] font-bold text-white/55">{second.map((player) => player.name.split(" ")[0]).join(" + ")}</p></div>
        </div>
      </div>
    );
  }
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

  if (data.stage === "bidding") {
    const myBid = bidder?.id === me.id;
    return (
      <div className={cn("mx-auto max-w-3xl space-y-5", immersive && "space-y-3")}>
        <BalootTeams players={players} data={data} compact={immersive} />
        <div className={cn("flex items-center gap-3 rounded-2xl border border-[#dbc58d] bg-[#f7efdc] px-4 py-3 text-[#173e34] shadow-sm", immersive && "sticky top-0 z-40 rounded-[24px]")}>
          {bidder && <PlayerAvatar player={bidder} size="sm" />}
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-black">المشترى عند {bidder?.name?.split(" ")[0] ?? "—"}</p><p className="truncate text-xs font-bold text-[#173e34]/55">{data.lastAction}</p></div>
          <span className="rounded-xl bg-[#0b5b47] px-3 py-2 text-center text-xs font-black text-[#efd07d]">اللفة {data.biddingRound === 1 ? "الأولى" : "الثانية"}</span>
        </div>

        <GameTableSurface trim="ivory" className={cn("min-h-[560px] sm:min-h-[680px]", immersive && "h-[58dvh] min-h-[500px] max-h-[680px]")}>
          <div className={cn("relative z-10 min-h-[560px] w-full sm:min-h-[680px]", immersive && "h-full min-h-0")}>
            {seatedPlayers.slice(0, 4).map((player, index) => (
              <CardinalPlayerSeat
                key={player.id}
                player={player}
                active={bidder?.id === player.id}
                position={(cardinalSeatPositions(4))[index]}
                cardCount={data.hands[player.id]?.length ?? 0}
                team={(Math.max(0, players.findIndex((item) => item.id === player.id)) % 2) as 0 | 1}
              />
            ))}

            <div className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 text-center">
              <div className="relative flex h-[235px] w-[190px] items-center justify-center sm:h-[290px] sm:w-[250px]">
                <TableBrandSeal logoUrl={logoUrl} className="absolute right-0 top-1/2 size-20 -translate-y-1/2 opacity-90 sm:size-28" />
                <div className="absolute left-0 top-1/2 -translate-y-1/2 space-y-1">
                  <BalootCardFace card={data.buyCard} compact />
                  <span className="block text-[10px] font-black text-white/55">ورقة الشراء</span>
                </div>
              </div>
              <div className="rounded-full border border-[#edcc7c]/35 bg-black/30 px-4 py-2 text-[10px] font-black text-white/70 backdrop-blur-sm sm:text-xs">
                {data.biddingRound === 1 ? "صن أو حكم بنوع المشترى" : "صن أو حكم بنوع مختلف"}
              </div>
            </div>
          </div>
        </GameTableSurface>

        <div className={cn(immersive && "sticky bottom-0 z-30 -mx-2 rounded-t-[30px] border-t border-[#dfbd66]/20 bg-[#031d18]/96 p-2 pt-3 shadow-[0_-24px_48px_-26px_rgba(0,0,0,.95)] backdrop-blur-xl")}>
          {myBid ? (
          <div className="mb-3 space-y-3">
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
          <p className={cn("mb-3 text-center text-sm font-bold text-muted-foreground", immersive && "text-white/55")}>بانتظار قرار {bidder?.name}</p>
        )}

          <p className={cn("mb-3 text-xs font-black text-muted-foreground", immersive && "text-[#d6bd7b]/65")}>أوراقك الخاصة قبل الشراء</p>
          <CardHandTray immersive={immersive} className={cn(immersive && "min-h-[215px] gap-0 overflow-y-hidden px-3 pb-3 pt-8")}>
            {hand.map((card) => <div key={card.id} className={cn("shrink-0", immersive && "-ml-7 first:ml-0 sm:-ml-5")}><BalootCardFace card={card} /></div>)}
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
    <div className={cn("space-y-5", immersive && "space-y-3")}>
      <BalootTeams players={players} data={data} compact={immersive} />
      <div className={cn("grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-[#dbc58d] bg-[#f7efdc] px-3 py-2.5 text-[#173e34] shadow-sm sm:px-5 sm:py-3", immersive && "sticky top-0 z-40 rounded-[24px]")}>
        <div className="flex min-w-0 items-center gap-2.5">
          {active && <PlayerAvatar player={active} size="sm" />}
          <div className="min-w-0"><p className="truncate text-sm font-black sm:text-base">الدور عند {active?.name?.split(" ")[0] ?? "—"}</p><p className="truncate text-xs font-bold text-[#173e34]/55">{data.lastAction}</p></div>
        </div>
        <div className="rounded-xl bg-[#0b5b47] px-3 py-2 text-center text-white"><p className="text-[9px] font-bold text-white/55">المشروع</p><p className="text-sm font-black text-[#efd07d]">{contract?.mode === "sun" ? "صن" : `حكم ${contract?.trump ? BALOOT_SUIT_LABEL[contract.trump] : ""}`}</p></div>
      </div>

      <GameTableSurface trim="ivory" className={cn("min-h-[580px] sm:min-h-[700px]", immersive && "h-[60dvh] min-h-[510px] max-h-[700px]")}>
        <div className={cn("relative z-10 min-h-[580px] w-full sm:min-h-[700px]", immersive && "h-full min-h-0")}>
          {seatedPlayers.slice(0, 4).map((player, index) => (
            <CardinalPlayerSeat
              key={player.id}
              player={player}
              active={active?.id === player.id}
              position={(cardinalSeatPositions(4))[index]}
              cardCount={data.hands[player.id]?.length ?? 0}
              team={(Math.max(0, players.findIndex((item) => item.id === player.id)) % 2) as 0 | 1}
              badge={`أكلات ${data.teamTricks[Math.max(0, players.findIndex((item) => item.id === player.id)) % 2]}`}
            />
          ))}

          <div className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
            <div className="relative h-[260px] w-[220px] sm:h-[310px] sm:w-[290px]">
              <TableBrandSeal logoUrl={logoUrl} className="absolute left-1/2 top-1/2 size-20 -translate-x-1/2 -translate-y-1/2 opacity-80 sm:size-28" />
              {data.trick.map((play: { playerId: string; card: BalootCard }) => {
                const player = players.find((item) => item.id === play.playerId);
                const seatIndex = Math.max(0, seatedPlayers.findIndex((item) => item.id === play.playerId));
                const trickPositions = [
                  "bottom-0 left-1/2 -translate-x-1/2",
                  "left-0 top-1/2 -translate-y-1/2",
                  "left-1/2 top-0 -translate-x-1/2",
                  "right-0 top-1/2 -translate-y-1/2",
                ];
                return (
                  <div key={play.playerId} className={cn("absolute space-y-0.5 text-center", trickPositions[seatIndex])}>
                    <BalootCardFace card={play.card} compact mini={immersive} />
                    <p className="max-w-16 truncate text-[9px] font-black text-white/70">{player?.name.split(" ")[0]}</p>
                  </div>
                );
              })}
              {!data.trick.length && <p className="absolute inset-x-4 top-1/2 -translate-y-1/2 text-center text-[11px] font-bold text-white/45 sm:text-sm">ارمِ ورقتك هنا<br />الفائز بالأكلة يبدأ التالية</p>}
            </div>
            <div className="flex gap-2 text-[10px] font-black text-white/70 sm:text-xs"><span className="rounded-full bg-emerald-400/10 px-3 py-1 text-emerald-200">فريق 1 · {data.teamTricks[0]} أكلات</span><span className="rounded-full bg-[#d8af58]/10 px-3 py-1 text-[#efd07d]">فريق 2 · {data.teamTricks[1]} أكلات</span></div>
          </div>
        </div>
      </GameTableSurface>

      <div className={cn(immersive && "sticky bottom-0 z-30 -mx-2 rounded-t-[30px] border-t border-[#dfbd66]/20 bg-[#031d18]/96 p-2 pt-3 shadow-[0_-24px_48px_-26px_rgba(0,0,0,.95)] backdrop-blur-xl")}>
        <div className="mb-3 flex items-center justify-between">
          <div><p className={cn("text-xs font-bold text-muted-foreground", immersive && "text-[#d6bd7b]/60")}>أوراقك الخاصة</p><p className={cn("font-black text-primary", immersive && "text-lg text-white")}>{hand.length} أوراق</p></div>
          {myTurn && mustFollow && <span className="rounded-full bg-gold-primary/15 px-3 py-1 text-[11px] font-black text-gold-primary">الزم النوع {BALOOT_SUIT_LABEL[leadSuit!]}</span>}
        </div>
        <CardHandTray immersive={immersive} className={cn(immersive && "min-h-[220px] gap-0 overflow-y-hidden px-3 pb-3 pt-8")}>
          {hand.map((card) => {
            const legal = myTurn && (!mustFollow || card.suit === leadSuit);
            return <div key={card.id} className={cn("shrink-0", immersive && "-ml-7 first:ml-0 sm:-ml-5")}><BalootCardFace card={card} active={legal} onClick={() => void dispatch("baloot-play", card.id)} /></div>;
          })}
        </CardHandTray>
      </div>

      {!myTurn && <p className="text-center text-sm font-bold text-muted-foreground">بانتظار رمية {active?.name}</p>}
    </div>
  );
}
