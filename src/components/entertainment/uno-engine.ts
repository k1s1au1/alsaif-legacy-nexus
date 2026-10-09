export type UnoColor = "red" | "blue" | "green" | "yellow" | "wild";
export type UnoMode = "classic" | "flip" | "no-mercy";
export type UnoCard = { id: string; color: UnoColor; value: string };
export type UnoParticipant = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  isBot?: boolean;
  joinedAt?: number;
};
export type UnoAction = { type: string; playerId: string; value?: any };
type UnoState = {
  phase: "lobby" | "playing" | "results";
  round: number;
  scores: Record<string, number>;
  data: Record<string, any>;
};
export const UNO_TURN_MS = 30_000;
export const UNO_COLORS: Exclude<UnoColor, "wild">[] = ["red", "blue", "green", "yellow"];
const COLOR_LABELS = { red: "الأحمر", blue: "الأزرق", green: "الأخضر", yellow: "الأصفر" };
function shuffle<T>(items: T[]): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function copyData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
function wrappedIndex(index: number, length: number) {
  return length ? ((index % length) + length) % length : 0;
}
function scoreFor(scores: Record<string, number>, id: string) {
  return scores[id] ?? 0;
}
function unoValueLabel(value: string) {
  return (
    (
      {
        skip: "تخطي",
        reverse: "عكس الاتجاه",
        draw2: "+2",
        wild: "تغيير اللون",
        wild4: "+4",
        draw4: "+4",
        draw5: "+5",
        draw6: "+6",
        draw10: "+10",
        flip: "قلب",
        skipAll: "تخطي الجميع",
        discardAll: "التخلص من اللون",
      } as Record<string, string>
    )[value] ?? value
  );
}
export function getUnoParticipants<T extends UnoParticipant>(
  data: Record<string, any>,
  live: T[],
): T[] {
  if (!Array.isArray(data.roster) || !data.roster.length) return live;
  return data.roster.map((saved: T) => {
    const current = live.find((player) => player.id === saved.id);
    return {
      ...saved,
      ...current,
      joinedAt: saved.joinedAt,
      connected: Boolean(saved.isBot || current),
    };
  });
}
export function sortUnoHand(hand: UnoCard[], order: "color" | "value" | "original") {
  const colorRank = (color: UnoColor) => [...UNO_COLORS, "wild"].indexOf(color);
  const valueRank = (value: string) =>
    /^\d+$/.test(value)
      ? Number(value)
      : 10 +
        [
          "skip",
          "reverse",
          "draw2",
          "flip",
          "draw4",
          "draw5",
          "skipAll",
          "discardAll",
          "wild",
          "wild4",
          "draw6",
          "draw10",
        ].indexOf(value);
  return order === "original"
    ? hand.slice()
    : hand
        .slice()
        .sort((a, b) =>
          order === "color"
            ? colorRank(a.color) - colorRank(b.color) || valueRank(a.value) - valueRank(b.value)
            : valueRank(a.value) - valueRank(b.value) || colorRank(a.color) - colorRank(b.color),
        );
}
function beginTurn(data: any, now: number) {
  data.turnSequence = Number(data.turnSequence ?? 0) + 1;
  data.turnStartedAt = now;
  data.turnDeadline = now + UNO_TURN_MS;
}
function recordEvent(data: any, action: UnoAction, now: number, details: Record<string, any> = {}) {
  data.eventSequence = Number(data.eventSequence ?? 0) + 1;
  data.event = {
    sequence: data.eventSequence,
    type: action.type,
    playerId: action.playerId,
    at: now,
    ...details,
  };
}
export function rematchUno<T extends UnoState>(
  state: T,
  players: UnoParticipant[],
  now = Date.now(),
): T {
  if (state.phase !== "results" || !players.length) return state;
  const starter = (Number(state.data.starterIndex ?? 0) + 1) % players.length;
  return {
    ...state,
    phase: "playing",
    round: state.round + 1,
    data: {
      ...initialUnoData(players, starter, state.data.mode ?? "classic", now),
      starterIndex: starter,
    },
  };
}
function buildUnoDeck(mode: UnoMode = "classic"): UnoCard[] {
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
  if (mode === "flip") {
    UNO_COLORS.forEach((color) => {
      for (let index = 0; index < 2; index += 1)
        cards.push({ id: `uno-${id++}`, color, value: "flip" });
      cards.push({ id: `uno-${id++}`, color, value: "draw5" });
      cards.push({ id: `uno-${id++}`, color, value: "skipAll" });
    });
  }
  if (mode === "no-mercy") {
    UNO_COLORS.forEach((color) => {
      cards.push({ id: `uno-${id++}`, color, value: "draw4" });
      cards.push({ id: `uno-${id++}`, color, value: "discardAll" });
      cards.push({ id: `uno-${id++}`, color, value: "skipAll" });
    });
    for (let index = 0; index < 4; index += 1) {
      cards.push({ id: `uno-${id++}`, color: "wild", value: index < 2 ? "draw6" : "draw10" });
    }
  }
  return shuffle(cards);
}

export function initialUnoData(
  players: UnoParticipant[],
  starterIndex = 0,
  mode: UnoMode = "classic",
  now = Date.now(),
) {
  const deck = buildUnoDeck(mode);
  const hands: Record<string, UnoCard[]> = {};
  players.forEach((player) => {
    hands[player.id] = deck.splice(0, 7);
  });
  let firstIndex = deck.findIndex((card) => card.color !== "wild");
  if (firstIndex < 0) firstIndex = 0;
  const [first] = deck.splice(firstIndex, 1);
  return {
    roster: players.map((player) => ({ ...player })),
    turnSequence: 1,
    turnStartedAt: now,
    turnDeadline: now + UNO_TURN_MS,
    eventSequence: 0,
    event: null,
    hands,
    drawPile: deck,
    discard: [first],
    currentColor: first.color,
    turnIndex: starterIndex,
    direction: 1,
    drawnCardId: null,
    unoCalled: {},
    winnerId: null,
    mode,
    side: "light",
    pendingDraw: 0,
    lastAction: "تم توزيع 7 أوراق لكل لاعب",
  };
}

function unoAdvance(index: number, direction: number, steps: number, players: UnoParticipant[]) {
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

export function unoPlayable(card: UnoCard, data: any, hand: UnoCard[]) {
  const top = data.discard[data.discard.length - 1] as UnoCard;
  if ((data.pendingDraw ?? 0) > 0)
    return ["draw2", "draw4", "wild4", "draw5", "draw6", "draw10"].includes(card.value);
  if (card.value === "wild4") {
    return !hand.some((item) => item.id !== card.id && item.color === data.currentColor);
  }
  return card.color === "wild" || card.color === data.currentColor || card.value === top.value;
}

export function reduceUno<T extends UnoState>(
  state: T,
  action: UnoAction,
  players: UnoParticipant[],
  now = Date.now(),
): T {
  if (state.phase !== "playing" || !players.length) return state;
  players = getUnoParticipants(state.data, players);
  const data = copyData(state.data);
  const active = players[data.turnIndex % Math.max(players.length, 1)];
  if (active?.id !== action.playerId || data.winnerId) return state;
  if (action.value?.turnSequence != null && action.value.turnSequence !== data.turnSequence)
    return state;
  if (action.type === "uno-clock") {
    if (data.turnDeadline) return state;
    data.roster ??= players.map((player) => ({ ...player }));
    beginTurn(data, now);
    return { ...state, data };
  }
  const expired = Number.isFinite(data.turnDeadline) && now >= data.turnDeadline;
  if (action.type === "uno-timeout" && (!expired || action.value?.deadline !== data.turnDeadline))
    return state;
  if (
    expired &&
    ["uno-timeout", "uno-play", "uno-draw", "uno-pass", "uno-call"].includes(action.type)
  ) {
    data.drawnCardId = null;
    data.unoCalled[action.playerId] = false;
    data.turnIndex = unoAdvance(data.turnIndex, data.direction, 1, players);
    data.lastAction = `انتهى وقت ${active.name} — انتقل الدور`;
    recordEvent(data, { ...action, type: "uno-timeout" }, now);
    beginTurn(data, now);
    return { ...state, data };
  }
  const hand = (data.hands[action.playerId] ?? []) as UnoCard[];

  if (action.type === "uno-call" && hand.length <= 2 && !data.unoCalled[action.playerId]) {
    data.unoCalled[action.playerId] = true;
    data.lastAction = `${active.name} أعلن أونو!`;
    recordEvent(data, action, now);
    return { ...state, data };
  }

  if (action.type === "uno-draw") {
    if (data.drawnCardId) return state;
    const drawCount = Math.max(1, Number(data.pendingDraw ?? 0));
    const cards = takeUnoCards(data, drawCount);
    const card = cards[0];
    if (!card) return state;
    hand.push(...cards);
    data.hands[action.playerId] = hand;
    data.pendingDraw = 0;
    if (drawCount > 1) {
      data.drawnCardId = null;
      data.turnIndex = unoAdvance(data.turnIndex, data.direction, 1, players);
      data.lastAction = `${active.name} سحب ${drawCount} أوراق`;
      beginTurn(data, now);
    } else {
      data.drawnCardId = card.id;
      data.lastAction = `${active.name} سحب ورقة`;
    }
    recordEvent(data, action, now, { count: cards.length, targetId: active.id });
    return { ...state, data };
  }

  if (action.type === "uno-pass" && data.drawnCardId) {
    data.drawnCardId = null;
    data.unoCalled[action.playerId] = false;
    data.turnIndex = unoAdvance(data.turnIndex, data.direction, 1, players);
    data.lastAction = `${active.name} مرّر الدور`;
    recordEvent(data, action, now);
    beginTurn(data, now);
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
  data.lastAction =
    card.color === "wild"
      ? `${active.name} غيّر اللون إلى ${COLOR_LABELS[data.currentColor as keyof typeof COLOR_LABELS]}`
      : card.value === "reverse"
        ? `${active.name} عكس اتجاه اللعب`
        : card.value === "skip"
          ? `${active.name} تخطّى اللاعب التالي`
          : `${active.name} لعب ${unoValueLabel(card.value)}`;
  recordEvent(data, action, now, { card });

  if (hand.length === 0) {
    data.winnerId = action.playerId;
    data.lastAction = `${active.name} أنهى أوراقه وفاز بالجولة`;
    const scores = {
      ...state.scores,
      [action.playerId]: scoreFor(state.scores, action.playerId) + 1,
    };
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
  if (card.value === "flip") {
    data.side = data.side === "dark" ? "light" : "dark";
    data.direction *= -1;
    direction = data.direction;
    data.lastAction = `${active.name} قلب جهة اللعب`;
  }
  if (card.value === "skipAll") steps = players.length;
  if (card.value === "discardAll") {
    const sameColor = hand.filter((item) => item.color === card.color);
    data.hands[action.playerId] = hand.filter((item) => item.color !== card.color);
    data.discard.push(...sameColor);
    data.lastAction = `${active.name} تخلص من أوراق اللون نفسه`;
  }
  const drawValues: Record<string, number> = {
    draw2: 2,
    wild4: 4,
    draw4: 4,
    draw5: 5,
    draw6: 6,
    draw10: 10,
  };
  if (drawValues[card.value]) {
    const targetIndex = unoAdvance(data.turnIndex, direction, 1, players);
    const target = players[targetIndex];
    if (target) {
      if ((data.mode ?? "classic") === "no-mercy") {
        data.pendingDraw = Number(data.pendingDraw ?? 0) + drawValues[card.value];
        steps = 1;
      } else {
        const targetHand = (data.hands[target.id] ?? []) as UnoCard[];
        targetHand.push(...takeUnoCards(data, drawValues[card.value]));
        data.hands[target.id] = targetHand;
        data.event.targetId = target.id;
        data.event.count = drawValues[card.value];
        steps = 2;
      }
    }
  }
  if ((data.hands[action.playerId] as UnoCard[]).length === 0) {
    data.winnerId = action.playerId;
    data.lastAction = `${active.name} أنهى أوراقه وفاز بالجولة`;
    const scores = {
      ...state.scores,
      [action.playerId]: scoreFor(state.scores, action.playerId) + 1,
    };
    return { ...state, phase: "results", scores, data };
  }
  data.turnIndex = unoAdvance(data.turnIndex, direction, steps, players);
  beginTurn(data, now);
  return { ...state, data };
}
