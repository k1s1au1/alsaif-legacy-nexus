export type BalootSuit = "spades" | "hearts" | "diamonds" | "clubs";
export type BalootCard = {
  id: string;
  suit: BalootSuit;
  rank: "7" | "8" | "9" | "J" | "Q" | "K" | "10" | "A";
};
export type BalootPlayer = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  joinedAt?: number;
  isBot?: boolean;
  connected?: boolean;
};
type Pair = [number, number];
export type BalootContract = {
  mode: "sun" | "hokm";
  trump: BalootSuit | null;
  buyerId: string;
  buyerIndex: number;
};
export type BalootPlay = { playerId: string; card: BalootCard };
export type BalootTrick = {
  sequence: number;
  plays: BalootPlay[];
  winnerId: string;
  winningTeam: number;
  points: number;
  at: number;
};
export type BalootRoundSummary = {
  rawPoints: Pair;
  beforePenalty: Pair;
  awardedPoints: Pair;
  buyerTeam: number;
  buyerSucceeded: boolean;
  lastTrickTeam: number;
};
export type BalootData = {
  roster: BalootPlayer[];
  stage: "bidding" | "playing" | "round-end";
  hands: Record<string, BalootCard[]>;
  drawPile: BalootCard[];
  buyCard: BalootCard;
  dealerIndex: number;
  bidTurnIndex: number;
  biddingRound: number;
  passes: number;
  contract: BalootContract | null;
  trick: BalootPlay[];
  leaderIndex: number;
  turnIndex: number;
  teamTricks: Pair;
  rawPoints: Pair;
  matchScore: Pair;
  roundPoints: Pair | null;
  roundSummary: BalootRoundSummary | null;
  lastTrick: BalootTrick | null;
  lastTrickWinnerId: string | null;
  pendingTrick: { winnerIndex: number; resolveAt: number } | null;
  sessionWins: Pair;
  matchNumber: number;
  matchRound: number;
  matchWinnerTeam: number | null;
  lastAction: string;
  turnSequence: number;
  turnStartedAt: number;
  turnDeadline: number | null;
  eventSequence: number;
  event: { sequence: number; type: string; playerId: string; card?: BalootCard; at: number } | null;
};
type State = {
  phase: "lobby" | "playing" | "results";
  round: number;
  scores: Record<string, number>;
  data: Record<string, unknown>;
};
type Action = { type: string; playerId: string; value?: unknown };
export const BALOOT_PLAY_MS = 30_000;
export const BALOOT_BID_MS = 45_000;
export const BALOOT_COLLECT_MS = 1_400;
export const BALOOT_SUITS: BalootSuit[] = ["spades", "hearts", "diamonds", "clubs"];
export const BALOOT_SUIT_LABEL: Record<BalootSuit, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};
const RANKS: BalootCard["rank"][] = ["7", "8", "9", "J", "Q", "K", "10", "A"];
const TRUMP_RANKS: BalootCard["rank"][] = ["7", "8", "Q", "K", "10", "A", "9", "J"];
const next = (i: number) => (i + 1) % 4;

export function getBalootParticipants<T extends BalootPlayer>(
  data: Record<string, unknown>,
  live: T[],
): T[] {
  if (!Array.isArray(data.roster) || !data.roster.length) return live;
  return data.roster.map((saved: T) => ({
    ...saved,
    ...live.find((p) => p.id === saved.id),
    joinedAt: saved.joinedAt,
    connected: Boolean(saved.isBot || live.some((p) => p.id === saved.id)),
  }));
}
function beginTurn(data: BalootData, now: number) {
  data.turnSequence = Number(data.turnSequence ?? 0) + 1;
  data.turnStartedAt = now;
  data.turnDeadline = now + (data.stage === "bidding" ? BALOOT_BID_MS : BALOOT_PLAY_MS);
}
export function initialBalootData(
  players: BalootPlayer[],
  matchScore: Pair = [0, 0],
  dealerIndex = 3,
  now = Date.now(),
): BalootData {
  const deck = BALOOT_SUITS.flatMap((suit, i) =>
    RANKS.map((rank, j) => ({ id: `baloot-${i * 8 + j}`, suit, rank })),
  );
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const hands: Record<string, BalootCard[]> = {};
  players.forEach((p) => {
    hands[p.id] = deck.splice(0, 5);
  });
  return {
    roster: players.map((p) => ({ ...p })),
    stage: "bidding",
    hands,
    drawPile: deck.slice(1),
    buyCard: deck[0],
    dealerIndex,
    bidTurnIndex: next(dealerIndex),
    biddingRound: 1,
    passes: 0,
    contract: null,
    trick: [],
    leaderIndex: 0,
    turnIndex: 0,
    teamTricks: [0, 0],
    rawPoints: [0, 0],
    matchScore: [...matchScore],
    roundPoints: null,
    roundSummary: null,
    lastTrick: null,
    lastTrickWinnerId: null,
    pendingTrick: null,
    sessionWins: [0, 0],
    matchNumber: 1,
    matchRound: 1,
    matchWinnerTeam: null,
    lastAction: "تم توزيع خمس أوراق لكل لاعب، وبدأ الشراء",
    turnSequence: 1,
    turnStartedAt: now,
    turnDeadline: now + BALOOT_BID_MS,
    eventSequence: 0,
    event: null,
  };
}
export function balootCardStrength(
  card: BalootCard,
  lead: BalootSuit,
  mode: "sun" | "hokm",
  trump: BalootSuit | null,
) {
  if (mode === "hokm" && card.suit === trump) return 200 + TRUMP_RANKS.indexOf(card.rank);
  return card.suit === lead ? 100 + RANKS.indexOf(card.rank) : 0;
}
export function balootCardPoints(card: BalootCard, mode: "sun" | "hokm", trump: BalootSuit | null) {
  if (mode === "hokm" && card.suit === trump)
    return { J: 20, "9": 14, A: 11, "10": 10, K: 4, Q: 3, "8": 0, "7": 0 }[card.rank];
  return { A: 11, "10": 10, K: 4, Q: 3, J: 2, "9": 0, "8": 0, "7": 0 }[card.rank];
}
export function legalBalootCards(data: BalootData, id: string): BalootCard[] {
  if (data.stage !== "playing" || data.pendingTrick) return [];
  const hand = data.hands[id] ?? [],
    lead = data.trick[0]?.card.suit;
  return lead && hand.some((c) => c.suit === lead)
    ? hand.filter((c) => c.suit === lead)
    : hand.slice();
}
export function sortBalootHand(hand: BalootCard[], contract: BalootContract | null, sorted = true) {
  if (!sorted) return hand.slice();
  const suits = contract?.trump
    ? [contract.trump, ...BALOOT_SUITS.filter((s) => s !== contract.trump)]
    : BALOOT_SUITS;
  return hand.slice().sort((a, b) => {
    const suit = suits.indexOf(a.suit) - suits.indexOf(b.suit);
    const ranks = contract?.mode === "hokm" && a.suit === contract.trump ? TRUMP_RANKS : RANKS;
    return suit || ranks.indexOf(b.rank) - ranks.indexOf(a.rank);
  });
}
function record(data: BalootData, type: string, playerId: string, now: number, card?: BalootCard) {
  data.eventSequence = Number(data.eventSequence ?? 0) + 1;
  data.event = { sequence: data.eventSequence, type, playerId, at: now, ...(card ? { card } : {}) };
}
function newDeal(data: BalootData, players: BalootPlayer[], now: number, advanceRound: boolean) {
  const fresh = initialBalootData(players, data.matchScore, next(data.dealerIndex), now);
  fresh.sessionWins = data.sessionWins ?? [0, 0];
  fresh.matchNumber = data.matchNumber ?? 1;
  fresh.matchRound = (data.matchRound ?? 1) + (advanceRound ? 1 : 0);
  fresh.turnSequence = Number(data.turnSequence ?? 0) + 1;
  fresh.eventSequence = Number(data.eventSequence ?? 0) + 1;
  fresh.lastAction = advanceRound
    ? "بدأ توزيع الجولة التالية"
    : "الجميع قال ولا، أُعيد توزيع الورق";
  return fresh;
}
function pass(
  data: BalootData,
  players: BalootPlayer[],
  now: number,
  timeout: boolean,
): BalootData {
  const bidder = players[data.bidTurnIndex];
  const word = data.biddingRound === 1 ? "بس" : "ولا";
  data.lastAction = timeout
    ? `انتهى وقت ${bidder.name} — ${word} تلقائيًا`
    : `${bidder.name} قال ${word}`;
  record(data, timeout ? "baloot-timeout" : "baloot-pass", bidder.id, now);
  data.passes++;
  if (data.passes >= 4) {
    if (data.biddingRound === 2) return newDeal(data, players, now, false);
    data.biddingRound = 2;
    data.passes = 0;
    data.bidTurnIndex = next(data.dealerIndex);
  } else data.bidTurnIndex = next(data.bidTurnIndex);
  beginTurn(data, now);
  return data;
}
function finishRound<T extends State>(
  state: T,
  data: BalootData,
  players: BalootPlayer[],
  lastTrickTeam: number,
): T {
  data.rawPoints[lastTrickTeam] += 10;
  const contract = data.contract!;
  const total = contract.mode === "sun" ? 26 : 16;
  const zero = Math.max(
    0,
    Math.min(total, Math.round(data.rawPoints[0] / (contract.mode === "sun" ? 5 : 10))),
  );
  const beforePenalty: Pair = [zero, total - zero];
  const buyerTeam = contract.buyerIndex % 2;
  const buyerSucceeded = beforePenalty[buyerTeam] > beforePenalty[1 - buyerTeam];
  const awardedPoints: Pair = buyerSucceeded
    ? (beforePenalty.slice() as Pair)
    : buyerTeam === 0
      ? [0, total]
      : [total, 0];
  data.roundSummary = {
    rawPoints: [...data.rawPoints],
    beforePenalty,
    awardedPoints,
    buyerTeam,
    buyerSucceeded,
    lastTrickTeam,
  };
  data.roundPoints = awardedPoints;
  data.matchScore = [data.matchScore[0] + awardedPoints[0], data.matchScore[1] + awardedPoints[1]];
  data.stage = "round-end";
  data.turnDeadline = null;
  data.lastAction = `${buyerSucceeded ? "نجح" : "خسر"} المشترى — انتهت الجولة ${awardedPoints[0]} - ${awardedPoints[1]}`;
  const scores = { ...state.scores };
  players.forEach((p, i) => {
    scores[p.id] = data.matchScore[i % 2];
  });
  const finished = data.matchScore.some((n) => n >= 152);
  if (finished) {
    data.matchWinnerTeam = data.matchScore[0] > data.matchScore[1] ? 0 : 1;
    data.sessionWins[data.matchWinnerTeam]++;
  }
  return {
    ...state,
    scores,
    phase: finished ? "results" : state.phase,
    data: data as unknown as Record<string, unknown>,
  };
}
export function rematchBaloot<T extends State>(
  state: T,
  players: BalootPlayer[],
  now = Date.now(),
): T {
  if (state.phase !== "results") return state;
  players = getBalootParticipants(state.data, players);
  if (players.length !== 4) return state;
  const previous = state.data as unknown as BalootData;
  const data = initialBalootData(players, [0, 0], next(previous.dealerIndex), now);
  data.sessionWins = [...(previous.sessionWins ?? [0, 0])];
  data.matchNumber = Number(previous.matchNumber ?? 1) + 1;
  data.turnSequence = Number(previous.turnSequence ?? 0) + 1;
  data.eventSequence = Number(previous.eventSequence ?? 0) + 1;
  return {
    ...state,
    phase: "playing",
    round: state.round + 1,
    scores: Object.fromEntries(players.map((p) => [p.id, 0])),
    data: data as unknown as Record<string, unknown>,
  };
}
export function reduceBaloot<T extends State>(
  state: T,
  action: Action,
  players: BalootPlayer[],
  now = Date.now(),
): T {
  if (state.phase !== "playing") return state;
  players = getBalootParticipants(state.data, players);
  if (players.length !== 4) return state;
  const value =
    typeof action.value === "object" && action.value
      ? (action.value as Record<string, unknown>)
      : {};
  if (value.turnSequence != null && value.turnSequence !== state.data.turnSequence) return state;
  if (value.round != null && value.round !== state.round) return state;
  const data = JSON.parse(JSON.stringify(state.data)) as BalootData;
  data.roster ??= players.map((p) => ({ ...p }));
  data.sessionWins ??= [0, 0];
  data.pendingTrick ??= null;
  if (action.type === "baloot-next-round" && data.stage === "round-end")
    return {
      ...state,
      round: state.round + 1,
      data: newDeal(data, players, now, true) as unknown as Record<string, unknown>,
    };
  if (data.stage === "round-end") return state;
  if (action.type === "baloot-collect") {
    if (
      !data.pendingTrick ||
      !data.lastTrick ||
      now < data.pendingTrick.resolveAt ||
      value.resolveAt !== data.pendingTrick.resolveAt ||
      value.trickSequence !== data.lastTrick.sequence
    )
      return state;
    const winnerIndex = data.pendingTrick.winnerIndex;
    data.pendingTrick = null;
    data.trick = [];
    if (players.every((p) => !data.hands[p.id]?.length))
      return finishRound(state, data, players, winnerIndex % 2);
    data.leaderIndex = winnerIndex;
    data.turnIndex = winnerIndex;
    beginTurn(data, now);
    return { ...state, data: data as unknown as Record<string, unknown> };
  }
  if (data.pendingTrick) return state;
  const active = players[data.stage === "bidding" ? data.bidTurnIndex : data.turnIndex];
  if (!active || active.id !== action.playerId) return state;
  if (action.type === "baloot-clock") {
    if (data.turnDeadline) return state;
    beginTurn(data, now);
    return { ...state, data: data as unknown as Record<string, unknown> };
  }
  const expired = data.turnDeadline != null && now >= data.turnDeadline;
  if (action.type === "baloot-timeout" && (!expired || value.deadline !== data.turnDeadline))
    return state;
  if (!["baloot-timeout", "baloot-pass", "baloot-bid", "baloot-play"].includes(action.type))
    return state;
  if (data.stage === "bidding") {
    if (expired || action.type === "baloot-pass")
      return {
        ...state,
        data: pass(data, players, now, expired) as unknown as Record<string, unknown>,
      };
    if (action.type !== "baloot-bid") return state;
    const mode = value.mode;
    if (mode !== "sun" && mode !== "hokm") return state;
    const trump =
      mode === "sun"
        ? null
        : data.biddingRound === 1
          ? data.buyCard.suit
          : (value.trump as BalootSuit);
    if (
      mode === "hokm" &&
      (!BALOOT_SUITS.includes(trump!) || (data.biddingRound === 2 && trump === data.buyCard.suit))
    )
      return state;
    players.forEach((p, i) => {
      if (i === data.bidTurnIndex) data.hands[p.id].push(data.buyCard);
      data.hands[p.id].push(...data.drawPile.splice(0, i === data.bidTurnIndex ? 2 : 3));
    });
    data.contract = { mode, trump, buyerId: active.id, buyerIndex: data.bidTurnIndex };
    data.stage = "playing";
    data.leaderIndex = data.bidTurnIndex;
    data.turnIndex = data.bidTurnIndex;
    data.lastAction = `${active.name} اشترى ${mode === "sun" ? "صن" : `حكم ${BALOOT_SUIT_LABEL[trump!]}`}`;
    record(data, "baloot-bid", active.id, now);
    beginTurn(data, now);
    return { ...state, data: data as unknown as Record<string, unknown> };
  }
  if (action.type !== "baloot-play" && !expired) return state;
  const legal = legalBalootCards(data, active.id);
  const contract = data.contract;
  if (!legal.length || !contract) return state;
  const card = expired
    ? legal
        .slice()
        .sort(
          (a, b) =>
            balootCardPoints(a, contract.mode, contract.trump) -
              balootCardPoints(b, contract.mode, contract.trump) ||
            balootCardStrength(a, a.suit, contract.mode, contract.trump) -
              balootCardStrength(b, b.suit, contract.mode, contract.trump),
        )[0]
    : legal.find((c) => c.id === (value.cardId ?? action.value));
  if (!card) return state;
  data.hands[active.id].splice(
    data.hands[active.id].findIndex((c) => c.id === card.id),
    1,
  );
  data.trick.push({ playerId: active.id, card });
  data.lastAction = `${expired ? `انتهى وقت ${active.name} — لعب تلقائيًا` : `${active.name} لعب`} ${card.rank} ${BALOOT_SUIT_LABEL[card.suit]}`;
  record(data, expired ? "baloot-timeout" : "baloot-play", active.id, now, card);
  if (data.trick.length < 4) {
    data.turnIndex = next(data.turnIndex);
    beginTurn(data, now);
  } else {
    const lead = data.trick[0].card.suit;
    const winner = data.trick.reduce((best, play) =>
      balootCardStrength(play.card, lead, contract.mode, contract.trump) >
      balootCardStrength(best.card, lead, contract.mode, contract.trump)
        ? play
        : best,
    );
    const winnerIndex = players.findIndex((p) => p.id === winner.playerId),
      team = winnerIndex % 2;
    const points = data.trick.reduce(
      (sum, p) => sum + balootCardPoints(p.card, contract.mode, contract.trump),
      0,
    );
    data.rawPoints[team] += points;
    data.teamTricks[team]++;
    data.lastTrick = {
      sequence: (data.lastTrick?.sequence ?? 0) + 1,
      plays: data.trick.map((p) => ({ ...p, card: { ...p.card } })),
      winnerId: winner.playerId,
      winningTeam: team,
      points,
      at: now,
    };
    data.lastTrickWinnerId = winner.playerId;
    data.lastAction = `${players[winnerIndex].name} أخذ الأكلة`;
    data.pendingTrick = { winnerIndex, resolveAt: now + BALOOT_COLLECT_MS };
    data.turnDeadline = null;
    data.turnSequence++;
  }
  return { ...state, data: data as unknown as Record<string, unknown> };
}
