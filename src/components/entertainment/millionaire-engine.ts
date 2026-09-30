import { MILLIONAIRE_BOARD as MONOPOLY_BOARD } from "./millionaire-board";

export type MillionairePlayer = {
  id: string;
  name: string;
  isBot?: boolean;
  difficulty?: "easy" | "medium" | "hard";
};

export type MillionaireAction = { type: string; playerId: string; value?: any };
export type MonopolyState = {
  phase: "lobby" | "playing" | "results";
  scores: Record<string, number>;
  data: Record<string, any>;
};
type Player = MillionairePlayer;
type RoomAction = MillionaireAction;

function copyData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function scoreFor(scores: Record<string, number>, id: string) {
  return scores[id] ?? 0;
}

function botDifficulty(bot: Player) {
  return bot.difficulty ?? "medium";
}

export function initialMonopolyData(players: Player[], starterIndex = 0) {
  return {
    turnIndex: starterIndex,
    positions: Object.fromEntries(players.map((player) => [player.id, 0])),
    cash: Object.fromEntries(players.map((player) => [player.id, 5000])),
    properties: {} as Record<number, { ownerId: string; level: number; invested: number }>,
    bankrupt: {} as Record<string, boolean>,
    jailTurns: {} as Record<string, number>,
    escapeCards: {} as Record<string, number>,
    dice: null as [number, number] | null,
    rolled: false,
    doublesStreak: 0,
    extraTurn: false,
    pending: null,
    festival: null,
    turnNumber: 1,
    winnerId: null as string | null,
    victoryType: null,
    actionLog: ["بدأت رحلة المليونير"],
    lastAction: "بدأت رحلة المليونير · لكل لاعب 5M",
  };
}


function nextMonopolyPlayer(current: number, players: Player[], bankrupt: Record<string, boolean>) {
  for (let offset = 1; offset <= players.length; offset += 1) {
    const index = (current + offset) % players.length;
    if (!bankrupt[players[index]?.id]) return index;
  }
  return current;
}

function advanceMonopolyTurn(data: any, players: Player[]) {
  data.turnIndex = nextMonopolyPlayer(data.turnIndex, players, data.bankrupt);
  data.rolled = false;
  data.dice = null;
  data.extraTurn = false;
  data.doublesStreak = 0;
  data.turnNumber = Number(data.turnNumber ?? 1) + 1;
  if (data.festival && data.turnNumber > data.festival.untilTurn) data.festival = null;
  monopolyMessage(data, "الدور عند " + (players[data.turnIndex]?.name ?? "اللاعب التالي"));
}

type MonopolyPropertyState = {
  ownerId: string;
  level: number;
  invested: number;
};

const MONOPOLY_START_BONUS = 300;
const MONOPOLY_STARTING_CASH = 5000;
const MONOPOLY_ISLAND_INDEX = 6;
const MONOPOLY_ISLAND_FEE = 150;
const MONOPOLY_TOLL_MULTIPLIERS = [0, 1, 2.2, 4, 7, 11];

function monopolyProperty(data: any, index: number): MonopolyPropertyState | null {
  const property = data.properties?.[index];
  if (!property) return null;
  if (typeof property === "string") {
    const space = MONOPOLY_BOARD[index];
    return { ownerId: property, level: 1, invested: space?.price ?? 0 };
  }
  return property as MonopolyPropertyState;
}

function monopolyOwnable(index: number) {
  const space = MONOPOLY_BOARD[index];
  return space?.kind === "city" || space?.kind === "tourism";
}

function monopolyStructureTotal(index: number, targetLevel: number) {
  const space = MONOPOLY_BOARD[index];
  if (!space || !monopolyOwnable(index)) return 0;
  if (space.kind === "tourism") return space.price;
  let total = space.price;
  const build = space.build ?? [0, 0, 0, 0];
  for (let level = 1; level < targetLevel; level += 1) total += build[level - 1] ?? 0;
  return total;
}

function monopolyUpgradeCost(index: number, currentLevel: number, targetLevel: number) {
  return Math.max(0, monopolyStructureTotal(index, targetLevel) - monopolyStructureTotal(index, currentLevel));
}

function monopolyGroupComplete(data: any, ownerId: string, group?: string) {
  if (!group || group === "tourism") return false;
  const groupIndices = MONOPOLY_BOARD
    .map((space, index) => ({ space, index }))
    .filter(({ space }) => space.group === group)
    .map(({ index }) => index);
  return groupIndices.length > 0 && groupIndices.every((index) => monopolyProperty(data, index)?.ownerId === ownerId);
}

function monopolyToll(data: any, index: number) {
  const space = MONOPOLY_BOARD[index];
  const property = monopolyProperty(data, index);
  if (!space || !property) return 0;
  const level = space.kind === "tourism" ? 1 : Math.max(1, Math.min(4, property.level));
  let toll = space.rent * MONOPOLY_TOLL_MULTIPLIERS[level];
  if (monopolyGroupComplete(data, property.ownerId, space.group)) toll *= 2;
  if (data.festival?.spaceIndex === index && Number(data.turnNumber ?? 1) <= Number(data.festival.untilTurn ?? 0)) toll *= 2;
  return Math.max(1, Math.round(toll));
}

function monopolyMessage(data: any, message: string) {
  data.lastAction = message;
  data.actionLog = [message, ...(data.actionLog ?? [])].slice(0, 8);
}

function monopolyVictoryType(data: any, ownerId: string): "line" | "triple" | "tourism" | null {
  const tourism = MONOPOLY_BOARD
    .map((space, index) => ({ space, index }))
    .filter(({ space }) => space.kind === "tourism")
    .map(({ index }) => index);
  if (tourism.length && tourism.every((index) => monopolyProperty(data, index)?.ownerId === ownerId)) return "tourism";

  for (let side = 0; side < 4; side += 1) {
    const sideIndices = MONOPOLY_BOARD
      .map((space, index) => ({ space, index }))
      .filter(({ space, index }) => space.side === side && monopolyOwnable(index))
      .map(({ index }) => index);
    if (sideIndices.length >= 4 && sideIndices.every((index) => monopolyProperty(data, index)?.ownerId === ownerId)) return "line";
  }

  const groups = Array.from(new Set(MONOPOLY_BOARD.map((space) => space.group).filter((group) => group && group !== "tourism")));
  const completeGroups = groups.filter((group) => monopolyGroupComplete(data, ownerId, group));
  return completeGroups.length >= 3 ? "triple" : null;
}

function monopolyVictoryLabel(type: string | null) {
  if (type === "line") return "الاحتكار الخطي";
  if (type === "triple") return "الاحتكار الثلاثي";
  if (type === "tourism") return "الاحتكار السياحي";
  return "إفلاس المنافسين";
}

function finishMonopoly<State extends MonopolyState>(state: State, data: any, winnerId: string, victoryType: string): State {
  data.winnerId = winnerId;
  data.victoryType = victoryType;
  monopolyMessage(data, (victoryType === "bankruptcy" ? "آخر مستثمر في الرحلة" : monopolyVictoryLabel(victoryType)) + " حسم المباراة");
  return {
    ...state,
    phase: "results",
    scores: { ...state.scores, [winnerId]: scoreFor(state.scores, winnerId) + 1 },
    data,
  };
}

function checkMonopolyWinner<State extends MonopolyState>(state: State, data: any, players: Player[], ownerId?: string): State | null {
  if (ownerId) {
    const victory = monopolyVictoryType(data, ownerId);
    if (victory) return finishMonopoly(state, data, ownerId, victory);
  }
  const remaining = players.filter((player) => !data.bankrupt[player.id]);
  if (remaining.length === 1) return finishMonopoly(state, data, remaining[0].id, "bankruptcy");
  return null;
}

function chargeMonopolyPlayer(data: any, playerId: string, amount: number, creditorId: string | null, reason: string) {
  const due = Math.max(0, Math.round(amount));
  if (Number(data.cash[playerId] ?? 0) >= due) {
    data.cash[playerId] -= due;
    if (creditorId) data.cash[creditorId] = Number(data.cash[creditorId] ?? 0) + due;
    return true;
  }
  data.pending = { type: "debt", playerId, amount: due, creditorId, reason };
  monopolyMessage(data, reason + " · يجب تصفية أملاك أو إعلان الإفلاس");
  return false;
}

function resolveMonopolyChance(data: any, active: Player) {
  const card = Math.floor(Math.random() * 8);
  if (card === 0) {
    data.cash[active.id] += 300;
    monopolyMessage(data, active.name + " حصل على مكافأة استثمار 300K");
    return;
  }
  if (card === 1) {
    if (chargeMonopolyPlayer(data, active.id, 180, null, active.name + " دفع رسوم تطوير 180K")) {
      monopolyMessage(data, active.name + " دفع رسوم تطوير 180K");
    }
    return;
  }
  if (card === 2) {
    data.positions[active.id] = 0;
    data.cash[active.id] += MONOPOLY_START_BONUS;
    monopolyMessage(data, active.name + " عاد إلى الانطلاق وربح " + MONOPOLY_START_BONUS + "K");
    return;
  }
  if (card === 3) {
    data.pending = { type: "travel", playerId: active.id, source: "chance" };
    monopolyMessage(data, active.name + " ربح رحلة مجانية واختيار أي مدينة");
    return;
  }
  if (card === 4) {
    data.escapeCards[active.id] = Number(data.escapeCards[active.id] ?? 0) + 1;
    monopolyMessage(data, active.name + " حصل على بطاقة خروج من الجزيرة");
    return;
  }
  if (card === 5) {
    data.positions[active.id] = MONOPOLY_ISLAND_INDEX;
    data.jailTurns[active.id] = 3;
    data.extraTurn = false;
    monopolyMessage(data, active.name + " انتقل إلى الجزيرة لثلاث محاولات");
    return;
  }
  if (card === 6) {
    const owned = MONOPOLY_BOARD.some((_, index) => monopolyProperty(data, index)?.ownerId === active.id);
    if (owned) {
      data.pending = { type: "festival", playerId: active.id, source: "chance" };
      monopolyMessage(data, active.name + " يستطيع اختيار مدينة لمهرجان الرسوم المضاعفة");
    } else {
      data.cash[active.id] += 120;
      monopolyMessage(data, active.name + " استبدل المهرجان بمكافأة 120K");
    }
    return;
  }
  const maintenance = MONOPOLY_BOARD.reduce((sum, _, index) => {
    const property = monopolyProperty(data, index);
    return property?.ownerId === active.id ? sum + property.level * 35 : sum;
  }, 0);
  if (!maintenance) {
    data.cash[active.id] += 80;
    monopolyMessage(data, active.name + " ربح 80K لعدم وجود تكاليف صيانة");
  } else if (chargeMonopolyPlayer(data, active.id, maintenance, null, active.name + " عليه صيانة " + maintenance + "K")) {
    monopolyMessage(data, active.name + " دفع صيانة أملاكه " + maintenance + "K");
  }
}

function resolveMonopolyLanding(data: any, active: Player, players: Player[], position: number) {
  const space = MONOPOLY_BOARD[position];
  data.pending = null;
  if (!space) return;

  if (monopolyOwnable(position)) {
    const property = monopolyProperty(data, position);
    if (!property) {
      data.pending = { type: "buy", playerId: active.id, spaceIndex: position };
      monopolyMessage(data, active.name + " وصل إلى " + space.name + " ويستطيع الاستثمار فيها");
      return;
    }
    if (property.ownerId === active.id) {
      if (space.kind === "city" && property.level < 4) {
        data.pending = { type: "upgrade", playerId: active.id, spaceIndex: position, currentLevel: property.level };
        monopolyMessage(data, active.name + " عاد إلى " + space.name + " ويمكنه تطويرها");
      } else {
        monopolyMessage(data, active.name + " زار " + space.name + " المملوكة له");
      }
      return;
    }

    const toll = monopolyToll(data, position);
    const owner = players.find((player) => player.id === property.ownerId);
    const paid = chargeMonopolyPlayer(data, active.id, toll, property.ownerId, active.name + " عليه " + toll + "K رسوم زيارة " + space.name);
    if (!paid) return;
    monopolyMessage(data, active.name + " دفع " + toll + "K إلى " + (owner?.name ?? "صاحب " + space.name));
    const takeoverCost = Math.round(property.invested * 1.7 + toll);
    if (property.level < 4 && Number(data.cash[active.id] ?? 0) >= takeoverCost) {
      data.pending = { type: "takeover", playerId: active.id, spaceIndex: position, ownerId: property.ownerId, cost: takeoverCost };
    }
    return;
  }

  if (space.kind === "chance") {
    resolveMonopolyChance(data, active);
    return;
  }
  if (space.kind === "island") {
    data.jailTurns[active.id] = 3;
    data.extraTurn = false;
    monopolyMessage(data, active.name + " علق في الجزيرة ولديه ثلاث محاولات للخروج");
    return;
  }
  if (space.kind === "travel") {
    data.pending = { type: "travel", playerId: active.id, source: "board" };
    monopolyMessage(data, active.name + " وصل إلى جولة المملكة ويختار وجهته");
    return;
  }
  if (space.kind === "festival") {
    const owned = MONOPOLY_BOARD.some((_, index) => monopolyProperty(data, index)?.ownerId === active.id);
    if (owned) {
      data.pending = { type: "festival", playerId: active.id, source: "board" };
      monopolyMessage(data, active.name + " يختار موقعًا لمضاعفة رسومه");
    } else {
      data.cash[active.id] += 120;
      monopolyMessage(data, active.name + " حصل على دعم مهرجان 120K");
    }
    return;
  }
  monopolyMessage(data, active.name + " وصل إلى الانطلاق");
}

export function reduceMonopoly<State extends MonopolyState>(state: State, action: RoomAction, players: Player[]): State {
  if (state.phase !== "playing") return state;
  const data = copyData(state.data);
  data.turnIndex = Math.max(0, Number(data.turnIndex ?? 0)) % Math.max(players.length, 1);
  data.positions ??= Object.fromEntries(players.map((player) => [player.id, 0]));
  data.cash ??= Object.fromEntries(players.map((player) => [player.id, MONOPOLY_STARTING_CASH]));
  data.properties ??= {};
  data.bankrupt ??= {};
  data.jailTurns ??= {};
  data.escapeCards ??= {};
  data.actionLog ??= [];
  players.forEach((player) => {
    data.positions[player.id] ??= 0;
    data.cash[player.id] ??= MONOPOLY_STARTING_CASH;
    data.jailTurns[player.id] ??= 0;
    data.escapeCards[player.id] ??= 0;
  });
  const active = players[data.turnIndex];
  if (!active || active.id !== action.playerId || data.winnerId) return state;

  if (action.type === "monopoly-pay-jail" && !data.rolled && Number(data.jailTurns[active.id] ?? 0) > 0) {
    if (Number(data.cash[active.id] ?? 0) < MONOPOLY_ISLAND_FEE) return state;
    data.cash[active.id] -= MONOPOLY_ISLAND_FEE;
    data.jailTurns[active.id] = 0;
    monopolyMessage(data, active.name + " دفع " + MONOPOLY_ISLAND_FEE + "K وخرج من الجزيرة");
    return { ...state, data };
  }

  if (action.type === "monopoly-use-pass" && !data.rolled && Number(data.jailTurns[active.id] ?? 0) > 0) {
    if (Number(data.escapeCards[active.id] ?? 0) < 1) return state;
    data.escapeCards[active.id] -= 1;
    data.jailTurns[active.id] = 0;
    monopolyMessage(data, active.name + " استخدم بطاقة الخروج من الجزيرة");
    return { ...state, data };
  }

  if (action.type === "monopoly-roll" && !data.rolled && !data.pending) {
    const dice: [number, number] = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    const double = dice[0] === dice[1];
    data.dice = dice;
    data.rolled = true;

    if (Number(data.jailTurns[active.id] ?? 0) > 0) {
      if (double) {
        data.jailTurns[active.id] = 0;
        data.doublesStreak = 0;
        data.extraTurn = false;
        monopolyMessage(data, active.name + " رمى نردًا مزدوجًا وخرج من الجزيرة");
      } else {
        data.jailTurns[active.id] -= 1;
        data.doublesStreak = 0;
        data.extraTurn = false;
        if (data.jailTurns[active.id] > 0) {
          monopolyMessage(data, active.name + " لم يرمِ نردًا مزدوجًا وبقيت " + data.jailTurns[active.id] + " محاولة");
          return { ...state, data };
        }
        if (!chargeMonopolyPlayer(data, active.id, MONOPOLY_ISLAND_FEE, null, active.name + " أكمل ثلاث محاولات وعليه رسوم خروج " + MONOPOLY_ISLAND_FEE + "K")) {
          return { ...state, data };
        }
        monopolyMessage(data, active.name + " دفع رسوم الخروج بعد المحاولة الثالثة");
      }
    } else {
      data.doublesStreak = double ? Number(data.doublesStreak ?? 0) + 1 : 0;
      data.extraTurn = double;
      if (data.doublesStreak >= 3) {
        data.positions[active.id] = MONOPOLY_ISLAND_INDEX;
        data.jailTurns[active.id] = 3;
        data.doublesStreak = 0;
        data.extraTurn = false;
        monopolyMessage(data, active.name + " رمى نردًا مزدوجًا ثلاث مرات وانتقل إلى الجزيرة");
        return { ...state, data };
      }
    }

    const oldPosition = Number(data.positions[active.id] ?? 0);
    const rawPosition = oldPosition + dice[0] + dice[1];
    const position = rawPosition % MONOPOLY_BOARD.length;
    if (rawPosition >= MONOPOLY_BOARD.length) {
      data.cash[active.id] += MONOPOLY_START_BONUS;
      monopolyMessage(data, active.name + " مر بالانطلاق وربح " + MONOPOLY_START_BONUS + "K");
    }
    data.positions[active.id] = position;
    resolveMonopolyLanding(data, active, players, position);
    return { ...state, data };
  }

  if (action.type === "monopoly-buy" && data.rolled && data.pending?.type === "buy" && data.pending.playerId === active.id) {
    const index = Number(data.pending.spaceIndex);
    const space = MONOPOLY_BOARD[index];
    const level = Number(action.value?.level ?? 1);
    if (!Number.isInteger(level) || level < 1 || level > (space?.kind === "tourism" ? 1 : 3)) return state;
    const cost = monopolyStructureTotal(index, level);
    if (!space || !monopolyOwnable(index) || monopolyProperty(data, index) || Number(data.cash[active.id] ?? 0) < cost) return state;
    data.cash[active.id] -= cost;
    data.properties[index] = { ownerId: active.id, level, invested: cost };
    data.pending = null;
    const buildLabel = level === 1 ? "فيلا" : level === 2 ? "مبنى" : "فندق";
    monopolyMessage(data, active.name + " استثمر في " + space.name + " وبنى " + buildLabel);
    return checkMonopolyWinner(state, data, players, active.id) ?? { ...state, data };
  }

  if (action.type === "monopoly-upgrade" && data.rolled && data.pending?.type === "upgrade" && data.pending.playerId === active.id) {
    const index = Number(data.pending.spaceIndex);
    const property = monopolyProperty(data, index);
    const space = MONOPOLY_BOARD[index];
    const targetLevel = Number(action.value?.level ?? 2);
    if (!Number.isInteger(targetLevel) || targetLevel < 1 || targetLevel > 4) return state;
    const cost = monopolyUpgradeCost(index, Number(property?.level ?? 1), targetLevel);
    if (!space || space.kind !== "city" || !property || property.ownerId !== active.id || property.level >= targetLevel || Number(data.cash[active.id] ?? 0) < cost) return state;
    data.cash[active.id] -= cost;
    data.properties[index] = { ...property, level: targetLevel, invested: property.invested + cost };
    data.pending = null;
    monopolyMessage(data, active.name + " طوّر " + space.name + (targetLevel === 4 ? " إلى مَعْلم " + (space.landmark ?? "") : " إلى المستوى " + targetLevel));
    return { ...state, data };
  }

  if (action.type === "monopoly-takeover" && data.rolled && data.pending?.type === "takeover" && data.pending.playerId === active.id) {
    const index = Number(data.pending.spaceIndex);
    const property = monopolyProperty(data, index);
    const cost = Number(data.pending.cost ?? 0);
    if (!property || property.ownerId === active.id || property.level >= 4 || Number(data.cash[active.id] ?? 0) < cost) return state;
    data.cash[active.id] -= cost;
    data.cash[property.ownerId] = Number(data.cash[property.ownerId] ?? 0) + cost;
    data.properties[index] = { ...property, ownerId: active.id };
    data.pending = null;
    monopolyMessage(data, active.name + " استحوذ على " + MONOPOLY_BOARD[index].name + " مقابل " + cost + "K");
    return checkMonopolyWinner(state, data, players, active.id) ?? { ...state, data };
  }

  if (action.type === "monopoly-travel" && data.rolled && data.pending?.type === "travel" && data.pending.playerId === active.id) {
    const index = Number(action.value?.spaceIndex);
    if (!monopolyOwnable(index)) return state;
    data.positions[active.id] = index;
    data.pending = null;
    monopolyMessage(data, active.name + " سافر إلى " + MONOPOLY_BOARD[index].name);
    resolveMonopolyLanding(data, active, players, index);
    return { ...state, data };
  }

  if (action.type === "monopoly-festival" && data.rolled && data.pending?.type === "festival" && data.pending.playerId === active.id) {
    const index = Number(action.value?.spaceIndex);
    if (monopolyProperty(data, index)?.ownerId !== active.id) return state;
    data.festival = { spaceIndex: index, ownerId: active.id, untilTurn: Number(data.turnNumber ?? 1) + players.length };
    data.pending = null;
    monopolyMessage(data, "مهرجان " + MONOPOLY_BOARD[index].name + " يضاعف رسومها لدورة كاملة");
    return { ...state, data };
  }

  if (action.type === "monopoly-decline" && data.rolled && data.pending?.playerId === active.id && data.pending.type !== "debt") {
    const type = data.pending.type;
    data.pending = null;
    monopolyMessage(data, active.name + (type === "travel" ? " بقي في محطة السفر" : type === "festival" ? " تجاوز اختيار المهرجان" : " تجاوز فرصة الاستثمار"));
    return { ...state, data };
  }

  if (action.type === "monopoly-sell") {
    const index = Number(action.value?.spaceIndex);
    const property = monopolyProperty(data, index);
    if (!property || property.ownerId !== active.id) return state;
    const value = Math.max(1, Math.round(property.invested * .7));
    data.cash[active.id] += value;
    delete data.properties[index];
    monopolyMessage(data, active.name + " باع " + MONOPOLY_BOARD[index].name + " للبنك مقابل " + value + "K");
    return { ...state, data };
  }

  if (action.type === "monopoly-pay-debt" && data.pending?.type === "debt" && data.pending.playerId === active.id) {
    const amount = Number(data.pending.amount ?? 0);
    if (Number(data.cash[active.id] ?? 0) < amount) return state;
    data.cash[active.id] -= amount;
    if (data.pending.creditorId) data.cash[data.pending.creditorId] = Number(data.cash[data.pending.creditorId] ?? 0) + amount;
    const reason = String(data.pending.reason ?? "الالتزام");
    data.pending = null;
    monopolyMessage(data, active.name + " سدّد " + amount + "K عن " + reason);
    return { ...state, data };
  }

  if (action.type === "monopoly-bankrupt" && data.pending?.type === "debt" && data.pending.playerId === active.id) {
    const creditorId = data.pending.creditorId as string | null;
    if (creditorId) data.cash[creditorId] = Number(data.cash[creditorId] ?? 0) + Number(data.cash[active.id] ?? 0);
    data.cash[active.id] = 0;
    Object.keys(data.properties).forEach((key) => {
      const index = Number(key);
      const property = monopolyProperty(data, index);
      if (property?.ownerId !== active.id) return;
      if (creditorId) data.properties[index] = { ...property, ownerId: creditorId };
      else delete data.properties[index];
    });
    data.bankrupt[active.id] = true;
    data.pending = null;
    data.extraTurn = false;
    monopolyMessage(data, active.name + " أعلن الإفلاس وخرج من الرحلة");
    const winner = checkMonopolyWinner(state, data, players, creditorId ?? undefined);
    if (winner) return winner;
    advanceMonopolyTurn(data, players);
    return { ...state, data };
  }

  if (action.type === "monopoly-end" && data.rolled && !data.pending) {
    if (data.extraTurn && !data.bankrupt[active.id]) {
      data.extraTurn = false;
      data.rolled = false;
      data.dice = null;
      data.turnNumber = Number(data.turnNumber ?? 1) + 1;
      monopolyMessage(data, active.name + " حصل على رمية إضافية");
      return { ...state, data };
    }
    advanceMonopolyTurn(data, players);
    return { ...state, data };
  }
  return state;
}


export function chooseMillionaireBotAction(state: MonopolyState, players: Player[]): RoomAction | null {
  if (state.phase !== "playing") return null;
  const data = state.data;
  const active = players[data.turnIndex];
  if (!active?.isBot) return null;
  const pending = data.pending;
  if (pending?.playerId === active.id) {
    if (pending.type === "debt") {
      if (Number(data.cash[active.id] ?? 0) >= Number(pending.amount ?? 0)) return { type: "monopoly-pay-debt", playerId: active.id };
      const sellable = MONOPOLY_BOARD
        .map((_, index) => ({ index, property: monopolyProperty(data, index) }))
        .filter(({ property }) => property?.ownerId === active.id)
        .sort((a, b) => Number(a.property?.invested ?? 0) - Number(b.property?.invested ?? 0));
      if (sellable.length) return { type: "monopoly-sell", playerId: active.id, value: { spaceIndex: sellable[0].index } };
      return { type: "monopoly-bankrupt", playerId: active.id };
    }
    if (pending.type === "buy") {
      const index = Number(pending.spaceIndex);
      const space = MONOPOLY_BOARD[index];
      const reserve = botDifficulty(active) === "hard" ? 500 : botDifficulty(active) === "medium" ? 750 : 1000;
      const affordable = [3, 2, 1].find((level) => monopolyStructureTotal(index, space.kind === "tourism" ? 1 : level) + reserve <= Number(data.cash[active.id] ?? 0));
      return affordable ? { type: "monopoly-buy", playerId: active.id, value: { level: space.kind === "tourism" ? 1 : affordable } } : { type: "monopoly-decline", playerId: active.id };
    }
    if (pending.type === "upgrade") {
      const index = Number(pending.spaceIndex);
      const property = monopolyProperty(data, index);
      const target = Math.min(4, Number(property?.level ?? 1) + 1);
      const cost = monopolyUpgradeCost(index, Number(property?.level ?? 1), target);
      return Number(data.cash[active.id] ?? 0) > cost + 650
        ? { type: "monopoly-upgrade", playerId: active.id, value: { level: target } }
        : { type: "monopoly-decline", playerId: active.id };
    }
    if (pending.type === "takeover") {
      const take = botDifficulty(active) === "hard" && Number(data.cash[active.id] ?? 0) > Number(pending.cost ?? 0) + 600;
      return { type: take ? "monopoly-takeover" : "monopoly-decline", playerId: active.id };
    }
    if (pending.type === "travel") {
      const targets = MONOPOLY_BOARD
        .map((space, index) => ({ space, index, property: monopolyProperty(data, index) }))
        .filter(({ index }) => monopolyOwnable(index))
        .sort((a, b) => {
          const scoreA = !a.property ? a.space.price : a.property.ownerId === active.id ? -a.space.price : a.space.rent * 4;
          const scoreB = !b.property ? b.space.price : b.property.ownerId === active.id ? -b.space.price : b.space.rent * 4;
          return scoreB - scoreA;
        });
      return targets[0] ? { type: "monopoly-travel", playerId: active.id, value: { spaceIndex: targets[0].index } } : { type: "monopoly-decline", playerId: active.id };
    }
    if (pending.type === "festival") {
      const owned = MONOPOLY_BOARD
        .map((_, index) => ({ index, property: monopolyProperty(data, index), toll: monopolyToll(data, index) }))
        .filter(({ property }) => property?.ownerId === active.id)
        .sort((a, b) => b.toll - a.toll);
      return owned[0] ? { type: "monopoly-festival", playerId: active.id, value: { spaceIndex: owned[0].index } } : { type: "monopoly-decline", playerId: active.id };
    }
  }
  if (!data.rolled && Number(data.jailTurns?.[active.id] ?? 0) > 0 && Number(data.cash[active.id] ?? 0) > 1200) {
    return { type: "monopoly-pay-jail", playerId: active.id };
  }
  if (!data.rolled) return { type: "monopoly-roll", playerId: active.id };
  return { type: "monopoly-end", playerId: active.id };
}
