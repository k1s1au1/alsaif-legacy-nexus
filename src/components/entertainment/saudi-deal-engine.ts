export type DealCard = {
  id: string;
  type: "property" | "money" | "action";
  label: string;
  value: number;
  group?: string;
  action?:
    | "draw2"
    | "rent"
    | "steal"
    | "forced_swap"
    | "deal_breaker"
    | "debt"
    | "birthday"
    | "double_rent"
    | "just_say_no";
};
export type DealPlayer = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  joinedAt?: number;
  isBot?: boolean;
  connected?: boolean;
};
export type DealAction = {
  type: string;
  playerId: string;
  value?: Record<string, unknown> | string;
};
export type DealTransfer = {
  fromId: string;
  toId: string;
  kind: "bank" | "property";
  cards: DealCard[];
  amount: number;
};
export type DealEvent = {
  sequence: number;
  type: string;
  playerId: string;
  at: number;
  transfers: DealTransfer[];
  blockedIds: string[];
  completedGroups: string[];
  card?: DealCard;
  drawnCount?: number;
  discardedCount?: number;
};
export type DealData = {
  roster: DealPlayer[];
  hands: Record<string, DealCard[]>;
  banks: Record<string, DealCard[]>;
  properties: Record<string, DealCard[]>;
  drawPile: DealCard[];
  discard: DealCard[];
  turnIndex: number;
  starterIndex: number;
  needsDraw: boolean;
  actionsLeft: number;
  endingTurn: boolean;
  rentMultiplier: number;
  winnerId: string | null;
  lastAction: string;
  turnSequence: number;
  turnStartedAt: number;
  turnDeadline: number;
  eventSequence: number;
  event: DealEvent | null;
};
type DealState = {
  phase: "lobby" | "playing" | "results";
  round: number;
  scores: Record<string, number>;
  data: Record<string, unknown>;
};
export const DEAL_TURN_MS = 90_000;
export const DEAL_HAND_LIMIT = 7;
function shuffle<T>(items: T[]): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export const DEAL_GROUPS = [
  { id: "najd", label: "نجد", color: "#a66a1f", size: 2, cities: ["الدرعية", "الرياض"] },
  {
    id: "hijaz",
    label: "الحجاز",
    color: "#245a9b",
    size: 3,
    cities: ["مكة المكرمة", "المدينة المنورة", "جدة"],
  },
  {
    id: "sharqiya",
    label: "الشرقية",
    color: "#087f8c",
    size: 3,
    cities: ["الأحساء", "الدمام", "الخبر"],
  },
  { id: "shamal", label: "الشمال", color: "#7650a8", size: 2, cities: ["العلا", "تبوك"] },
  { id: "janoub", label: "الجنوب", color: "#397b45", size: 3, cities: ["أبها", "جازان", "الباحة"] },
  { id: "wasat", label: "الوسطى", color: "#a8443c", size: 3, cities: ["القصيم", "شقراء", "الخرج"] },
  { id: "sahil", label: "الساحل", color: "#c1652d", size: 2, cities: ["ينبع", "أملج"] },
  { id: "wadi", label: "الوادي", color: "#52636e", size: 2, cities: ["نجران", "وادي الدواسر"] },
] as const;

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
    cards.push({
      id: `deal-${id++}`,
      type: "action",
      label: "فرصة استثمار",
      value: 1,
      action: "draw2",
    });
  }
  for (let index = 0; index < 8; index += 1) {
    cards.push({
      id: `deal-${id++}`,
      type: "action",
      label: "تحصيل إيجار",
      value: 2,
      action: "rent",
    });
  }
  for (let index = 0; index < 5; index += 1) {
    cards.push({
      id: `deal-${id++}`,
      type: "action",
      label: "استحواذ على أرض",
      value: 3,
      action: "steal",
    });
  }
  for (let index = 0; index < 3; index += 1) {
    cards.push({
      id: `deal-${id++}`,
      type: "action",
      label: "صفقة تبادل",
      value: 3,
      action: "forced_swap",
    });
  }
  for (let index = 0; index < 2; index += 1) {
    cards.push({
      id: `deal-${id++}`,
      type: "action",
      label: "كسر الصفقة",
      value: 5,
      action: "deal_breaker",
    });
  }
  for (let index = 0; index < 3; index += 1) {
    cards.push({
      id: `deal-${id++}`,
      type: "action",
      label: "تحصيل دين",
      value: 3,
      action: "debt",
    });
  }
  for (let index = 0; index < 3; index += 1) {
    cards.push({
      id: `deal-${id++}`,
      type: "action",
      label: "العيدية",
      value: 2,
      action: "birthday",
    });
  }
  for (let index = 0; index < 2; index += 1) {
    cards.push({
      id: `deal-${id++}`,
      type: "action",
      label: "إيجار مضاعف",
      value: 1,
      action: "double_rent",
    });
  }
  for (let index = 0; index < 3; index += 1) {
    cards.push({
      id: `deal-${id++}`,
      type: "action",
      label: "مرفوض!",
      value: 4,
      action: "just_say_no",
    });
  }
  return shuffle(cards);
}

export function getDealParticipants<T extends DealPlayer>(
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
export function dealGroup(card: DealCard) {
  return DEAL_GROUPS.find((g) => g.id === card.group);
}
export function completedDealSets(cards: DealCard[]) {
  return DEAL_GROUPS.filter((g) => cards.filter((c) => c.group === g.id).length >= g.size).length;
}
export function isProtectedDealProperty(properties: DealCard[], card: DealCard) {
  const group = dealGroup(card);
  return Boolean(group && properties.filter((c) => c.group === group.id).length >= group.size);
}
export function dealBankTotal(cards: DealCard[]) {
  return cards.reduce((sum, c) => sum + c.value, 0);
}
export function dealRent(data: DealData, id: string) {
  const properties = data.properties[id] as DealCard[];
  const largest = Math.max(
    0,
    ...DEAL_GROUPS.map((g) => properties.filter((c) => c.group === g.id).length),
  );
  return Math.max(1, Math.min(5, largest)) * (data.rentMultiplier ?? 1);
}
export function legalDealProperties(
  data: DealData,
  targetId: string,
  action: DealCard["action"],
): DealCard[] {
  const properties = (data.properties[targetId] ?? []) as DealCard[];
  return properties.filter((p) =>
    action === "deal_breaker"
      ? isProtectedDealProperty(properties, p)
      : !isProtectedDealProperty(properties, p),
  );
}
function beginTurn(data: DealData, now: number) {
  data.turnSequence = Number(data.turnSequence ?? 0) + 1;
  data.turnStartedAt = now;
  data.turnDeadline = now + DEAL_TURN_MS;
}
function advance(data: DealData, players: DealPlayer[], now: number) {
  data.turnIndex = (data.turnIndex + 1) % players.length;
  data.actionsLeft = 3;
  data.needsDraw = true;
  data.endingTurn = false;
  data.rentMultiplier = 1;
  beginTurn(data, now);
}
export function initialDealData(
  players: DealPlayer[],
  starterIndex = 0,
  now = Date.now(),
): DealData {
  const deck = buildDealDeck();
  const hands: Record<string, DealCard[]> = {},
    banks: Record<string, DealCard[]> = {},
    properties: Record<string, DealCard[]> = {};
  for (const player of players) {
    hands[player.id] = deck.splice(0, 5);
    banks[player.id] = [];
    properties[player.id] = [];
  }
  return {
    roster: players.map((p) => ({ ...p })),
    hands,
    banks,
    properties,
    drawPile: deck,
    discard: [],
    turnIndex: starterIndex,
    starterIndex,
    needsDraw: true,
    actionsLeft: 3,
    endingTurn: false,
    rentMultiplier: 1,
    winnerId: null,
    lastAction: "تم توزيع خمس أوراق لكل لاعب",
    turnSequence: 1,
    turnStartedAt: now,
    turnDeadline: now + DEAL_TURN_MS,
    eventSequence: 0,
    event: null,
  };
}
export function rematchDeal<T extends DealState>(
  state: T,
  players: DealPlayer[],
  now = Date.now(),
): T {
  if (state.phase !== "results" || !players.length) return state;
  players = getDealParticipants(state.data, players);
  return {
    ...state,
    phase: "playing",
    round: state.round + 1,
    data: initialDealData(
      players,
      (Number(state.data.starterIndex ?? 0) + 1) % players.length,
      now,
    ),
  };
}
function takeCards(data: DealData, count: number): DealCard[] {
  const cards: DealCard[] = [];
  for (let i = 0; i < count; i++) {
    if (!data.drawPile.length && data.discard.length) {
      data.drawPile = shuffle(data.discard);
      data.discard = [];
    }
    const card = data.drawPile.shift();
    if (card) cards.push(card);
  }
  return cards;
}
function record(
  data: DealData,
  action: DealAction,
  now: number,
  details: Pick<Partial<DealEvent>, "card" | "drawnCount" | "discardedCount"> = {},
) {
  data.eventSequence = Number(data.eventSequence ?? 0) + 1;
  data.event = {
    sequence: data.eventSequence,
    type: action.type,
    playerId: action.playerId,
    at: now,
    transfers: [],
    blockedIds: [],
    completedGroups: [],
    ...details,
  };
}
function block(data: DealData, id: string): boolean {
  const hand = data.hands[id] as DealCard[];
  const index = hand.findIndex((c) => c.action === "just_say_no");
  if (index < 0) return false;
  const [card] = hand.splice(index, 1);
  data.discard.push(card);
  data.event!.blockedIds.push(id);
  return true;
}
function addTransfer(
  data: DealData,
  fromId: string,
  toId: string,
  kind: "bank" | "property",
  cards: DealCard[],
) {
  if (cards.length)
    data.event!.transfers.push({
      fromId,
      toId,
      kind,
      cards: cards.map((c) => ({ ...c })),
      amount: dealBankTotal(cards),
    });
}
function payment(data: DealData, receiverId: string, payerId: string, amount: number) {
  if (block(data, payerId)) return { blocked: true, amount: 0 };
  const bank = data.banks[payerId] as DealCard[],
    properties = data.properties[payerId] as DealCard[];
  const bankPaid: DealCard[] = [],
    landPaid: DealCard[] = [];
  let total = 0;
  while (bank.length && total < amount) {
    const c = bank.shift()!;
    bankPaid.push(c);
    total += c.value;
  }
  while (properties.length && total < amount) {
    const c = properties.pop()!;
    landPaid.push(c);
    total += c.value;
  }
  data.banks[receiverId].push(...bankPaid);
  data.properties[receiverId].push(...landPaid);
  addTransfer(data, payerId, receiverId, "bank", bankPaid);
  addTransfer(data, payerId, receiverId, "property", landPaid);
  return { blocked: false, amount: total };
}
function completedIds(data: DealData, id: string) {
  return DEAL_GROUPS.filter(
    (g) => (data.properties[id] as DealCard[]).filter((c) => c.group === g.id).length >= g.size,
  ).map((g) => g.id);
}
function finish<T extends DealState>(
  state: T,
  data: DealData,
  id: string,
  players: DealPlayer[],
  now: number,
  before: string[],
): T {
  const complete = completedIds(data, id);
  data.event!.completedGroups = complete.filter((group) => !before.includes(group));
  if (complete.length >= 3) {
    data.winnerId = id;
    data.lastAction = `${players.find((p) => p.id === id)?.name} أكمل ثلاث مجموعات وفاز بالجولة`;
    return {
      ...state,
      phase: "results",
      scores: { ...state.scores, [id]: (state.scores[id] ?? 0) + 1 },
      data,
    };
  }
  data.actionsLeft -= 1;
  if (data.actionsLeft <= 0) {
    data.endingTurn = true;
    if (data.hands[id].length <= DEAL_HAND_LIMIT) advance(data, players, now);
  }
  return { ...state, data };
}
function expire<T extends DealState>(
  state: T,
  data: DealData,
  active: DealPlayer,
  players: DealPlayer[],
  now: number,
): T {
  const hand = data.hands[active.id] as DealCard[];
  const excess = Math.max(0, hand.length - DEAL_HAND_LIMIT);
  // Keep the original hand order: on expiry discard the newest excess cards.
  if (excess) data.discard.push(...hand.splice(DEAL_HAND_LIMIT));
  data.lastAction = `انتهى وقت ${active.name} — انتقل الدور${excess ? ` ورُميت ${excess} أوراق زائدة` : ""}`;
  record(data, { type: "deal-timeout", playerId: active.id }, now, { discardedCount: excess });
  advance(data, players, now);
  return { ...state, data };
}
export function reduceDeal<T extends DealState>(
  state: T,
  action: DealAction,
  players: DealPlayer[],
  now = Date.now(),
): T {
  if (state.phase !== "playing" || !players.length) return state;
  const value = typeof action.value === "object" && action.value ? action.value : {};
  players = getDealParticipants(state.data, players);
  const active = players[Number(state.data.turnIndex ?? 0) % players.length];
  if (!active || active.id !== action.playerId || state.data.winnerId) return state;
  if (value.turnSequence != null && value.turnSequence !== state.data.turnSequence) return state;
  if (value.round != null && value.round !== state.round) return state;
  const data = JSON.parse(JSON.stringify(state.data)) as DealData;
  data.endingTurn ??= false;
  if (action.type === "deal-clock") {
    if (data.turnDeadline) return state;
    data.roster ??= players.map((p) => ({ ...p }));
    beginTurn(data, now);
    return { ...state, data };
  }
  const expired = Number.isFinite(data.turnDeadline) && now >= data.turnDeadline;
  if (action.type === "deal-timeout" && (!expired || value.deadline !== data.turnDeadline))
    return state;
  if (
    expired &&
    [
      "deal-timeout",
      "deal-draw",
      "deal-discard",
      "deal-end",
      "deal-bank",
      "deal-property",
      "deal-action",
    ].includes(action.type)
  )
    return expire(state, data, active, players, now);
  const hand = data.hands[active.id] as DealCard[];
  if (action.type === "deal-draw" && data.needsDraw) {
    const cards = takeCards(data, hand.length ? 2 : 5);
    hand.push(...cards);
    data.needsDraw = false;
    data.lastAction = `${active.name} سحب ${cards.length} أوراق`;
    record(data, action, now, { drawnCount: cards.length });
    return { ...state, data };
  }
  if (action.type === "deal-discard" && hand.length > DEAL_HAND_LIMIT && !data.needsDraw) {
    const index = hand.findIndex((c) => c.id === (value.cardId ?? action.value));
    if (index < 0) return state;
    const [card] = hand.splice(index, 1);
    data.discard.push(card);
    data.lastAction = `${active.name} رمى ${card.label} من الأوراق الزائدة`;
    record(data, action, now, { card });
    if (data.endingTurn && hand.length <= DEAL_HAND_LIMIT) advance(data, players, now);
    return { ...state, data };
  }
  if (action.type === "deal-end" && !data.needsDraw) {
    data.endingTurn = true;
    data.actionsLeft = 0;
    data.lastAction = `أنهى ${active.name} حركاته`;
    record(data, action, now);
    if (hand.length <= DEAL_HAND_LIMIT) advance(data, players, now);
    else data.lastAction = `${active.name} يختار الأوراق الزائدة لرميها`;
    return { ...state, data };
  }
  if (data.needsDraw || data.endingTurn || data.actionsLeft <= 0) return state;
  const index = hand.findIndex((c) => c.id === value.cardId);
  if (index < 0) return state;
  const card = hand[index],
    before = completedIds(data, active.id);
  if (action.type === "deal-bank" && (card.type === "money" || card.type === "action")) {
    hand.splice(index, 1);
    data.banks[active.id].push(card);
    data.lastAction = `${active.name} أودع ${card.value} مليون`;
    record(data, action, now, { card });
    return finish(state, data, active.id, players, now, before);
  }
  if (action.type === "deal-property" && card.type === "property") {
    hand.splice(index, 1);
    data.properties[active.id].push(card);
    data.lastAction = `${active.name} أضاف ${card.label} إلى أراضيه`;
    record(data, action, now, { card });
    return finish(state, data, active.id, players, now, before);
  }
  if (
    action.type !== "deal-action" ||
    card.type !== "action" ||
    !card.action ||
    ![
      "draw2",
      "rent",
      "debt",
      "steal",
      "forced_swap",
      "deal_breaker",
      "birthday",
      "double_rent",
    ].includes(card.action)
  )
    return state;
  const targetId = value.targetId as string | undefined;
  const noTarget = ["draw2", "birthday", "double_rent"];
  if (
    !noTarget.includes(card.action ?? "") &&
    (!targetId || targetId === active.id || !players.some((p) => p.id === targetId))
  )
    return state;
  const target = players.find((p) => p.id === targetId);
  const targetProperties = (data.properties[targetId ?? ""] ?? []) as DealCard[];
  const property = targetProperties.find((c) => c.id === value.propertyId);
  const ownProperties = data.properties[active.id] as DealCard[];
  const offered = value.ownPropertyId
    ? ownProperties.find((c) => c.id === value.ownPropertyId)
    : ownProperties.find((c) => !isProtectedDealProperty(ownProperties, c));
  const requested = DEAL_GROUPS.find(
    (g) =>
      g.id === value.group && targetProperties.filter((c) => c.group === g.id).length >= g.size,
  );
  if (card.action === "steal" && (!property || isProtectedDealProperty(targetProperties, property)))
    return state;
  if (
    card.action === "forced_swap" &&
    (!property ||
      isProtectedDealProperty(targetProperties, property) ||
      !offered ||
      isProtectedDealProperty(ownProperties, offered))
  )
    return state;
  if (card.action === "deal_breaker" && !requested) return state;
  hand.splice(index, 1);
  data.discard.push(card);
  record(data, action, now, { card });
  if (card.action === "draw2") {
    const cards = takeCards(data, 2);
    hand.push(...cards);
    data.event!.drawnCount = cards.length;
    data.lastAction = `${active.name} استخدم فرصة استثمار وسحب ${cards.length} أوراق`;
  }
  if (card.action === "rent" && targetId) {
    const amount = dealRent(data, active.id),
      paid = payment(data, active.id, targetId, amount);
    data.rentMultiplier = 1;
    data.lastAction = paid.blocked
      ? `${target?.name} رفض بطاقة الإيجار`
      : `${active.name} حصّل ${paid.amount} مليون من ${target?.name}`;
  }
  if (card.action === "debt" && targetId) {
    const paid = payment(data, active.id, targetId, 5);
    data.lastAction = paid.blocked
      ? `${target?.name} رفض تحصيل الدين`
      : `${active.name} حصّل دينًا بقيمة ${paid.amount} مليون من ${target?.name}`;
  }
  if (card.action === "steal" && targetId && property) {
    if (block(data, targetId)) data.lastAction = `${target?.name} رفض الاستحواذ`;
    else {
      targetProperties.splice(
        targetProperties.findIndex((c) => c.id === property.id),
        1,
      );
      ownProperties.push(property);
      addTransfer(data, targetId, active.id, "property", [property]);
      data.lastAction = `${active.name} استحوذ على ${property.label} من ${target?.name}`;
    }
  }
  if (card.action === "forced_swap" && targetId && property && offered) {
    if (block(data, targetId)) data.lastAction = `${target?.name} رفض صفقة التبادل`;
    else {
      targetProperties.splice(
        targetProperties.findIndex((c) => c.id === property.id),
        1,
      );
      ownProperties.splice(
        ownProperties.findIndex((c) => c.id === offered.id),
        1,
      );
      targetProperties.push(offered);
      ownProperties.push(property);
      addTransfer(data, targetId, active.id, "property", [property]);
      addTransfer(data, active.id, targetId, "property", [offered]);
      data.lastAction = `${active.name} بادل ${offered.label} مع ${property.label} عند ${target?.name}`;
    }
  }
  if (card.action === "deal_breaker" && targetId && requested) {
    if (block(data, targetId)) data.lastAction = `${target?.name} رفض كسر الصفقة`;
    else {
      const captured = targetProperties.filter((c) => c.group === requested.id);
      data.properties[targetId] = targetProperties.filter((c) => c.group !== requested.id);
      ownProperties.push(...captured);
      addTransfer(data, targetId, active.id, "property", captured);
      data.lastAction = `${active.name} استحوذ على مجموعة ${requested.label} من ${target?.name}`;
    }
  }
  if (card.action === "birthday") {
    let total = 0;
    for (const payer of players.filter((p) => p.id !== active.id))
      total += payment(data, active.id, payer.id, 2).amount;
    data.lastAction = `${active.name} جمع عيدية بقيمة ${total} مليون`;
  }
  if (card.action === "double_rent") {
    data.rentMultiplier = 2;
    data.lastAction = `${active.name} فعّل الإيجار المضاعف`;
  }
  return finish(state, data, active.id, players, now, before);
}
