import { MILLIONAIRE_BOARD } from "./millionaire-board";
import type { MillionaireMovement } from "./millionaire-engine";

export const MILLIONAIRE_COLORS = ["#29b775", "#369ce3", "#dd535c", "#e0ac37"] as const;
export const MILLIONAIRE_LEVELS = ["أرض", "فيلا", "مبنى", "فندق", "مَعْلم"] as const;
export const MILLIONAIRE_TIMING = {
  roll: 1150,
  step: 190,
  chance: 2400,
  arrival: 700,
  build: 950,
} as const;

export type MillionaireProperty = { ownerId: string; level: number; invested: number };
export type MillionaireRoll = { sequence: number; playerId: string; dice: [number, number] };
export type MillionaireChance = {
  sequence: number;
  rollSequence: number;
  playerId: string;
  card: number;
  title: string;
  description: string;
};
export type MillionairePlayerView = {
  id: string;
  name: string;
  avatarUrl: string | null;
  isHost?: boolean;
  isBot?: boolean;
};
export type MillionairePending = {
  type: "buy" | "upgrade" | "takeover" | "travel" | "festival" | "debt";
  playerId?: string;
  spaceIndex?: number;
  currentLevel?: number;
  ownerId?: string;
  cost?: number;
  amount?: number;
  creditorId?: string | null;
  reason?: string;
};
export type MillionaireData = {
  turnIndex?: number;
  turnNumber?: number;
  positions?: Record<string, number>;
  cash?: Record<string, number>;
  properties?: Record<string, MillionaireProperty | string>;
  bankrupt?: Record<string, boolean>;
  jailTurns?: Record<string, number>;
  escapeCards?: Record<string, number>;
  dice?: [number, number] | null;
  roll?: MillionaireRoll | null;
  chance?: MillionaireChance | null;
  movement?: MillionaireMovement | null;
  presentationUntil?: number;
  rolled?: boolean;
  extraTurn?: boolean;
  pending?: MillionairePending | null;
  festival?: { spaceIndex: number; ownerId: string; untilTurn: number } | null;
  lastAction?: string;
  actionLog?: string[];
  winnerId?: string | null;
  victoryType?: string | null;
};

const CELLS = [
  [6, 6],
  [6, 5],
  [6, 4],
  [6, 3],
  [6, 2],
  [6, 1],
  [6, 0],
  [5, 0],
  [4, 0],
  [3, 0],
  [2, 0],
  [1, 0],
  [0, 0],
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [0, 5],
  [0, 6],
  [1, 6],
  [2, 6],
  [3, 6],
  [4, 6],
  [5, 6],
] as const;

/** Transform only the view. Network positions and property indices stay canonical. */
export function millionaireCell(index: number, viewerSeat: number): [number, number] {
  let [row, column]: [number, number] = [...(CELLS[index] ?? CELLS[0])];
  const turns = ((viewerSeat % 4) + 4) % 4;
  for (let turn = 0; turn < turns; turn += 1) [row, column] = [6 - column, row];
  return [row, column];
}

export function millionairePoint(index: number, viewerSeat: number) {
  const [row, column] = millionaireCell(index, viewerSeat);
  return { x: ((column + 0.5) * 100) / 7, y: ((row + 0.43) * 100) / 7 };
}

export function millionaireThrowSeat(playerSeat: number, viewerSeat: number) {
  return (((playerSeat - viewerSeat) % 4) + 4) % 4;
}

export function millionairePropertyAt(
  data: { properties?: Record<string, MillionaireProperty | string> },
  index: number,
): MillionaireProperty | null {
  const property = data.properties?.[index];
  if (!property) return null;
  return typeof property === "string"
    ? { ownerId: property, level: 1, invested: MILLIONAIRE_BOARD[index]?.price ?? 0 }
    : property;
}

export function millionaireCash(value: number) {
  const safe = Math.max(0, Math.round(Number(value) || 0));
  return safe >= 1000 ? `${Number((safe / 1000).toFixed(3))}M` : `${safe}K`;
}

export function millionaireInvestment(
  data: { properties?: Record<string, MillionaireProperty | string> },
  playerId: string,
) {
  return MILLIONAIRE_BOARD.reduce((total, _, index) => {
    const property = millionairePropertyAt(data, index);
    return total + (property?.ownerId === playerId ? property.invested : 0);
  }, 0);
}

export function millionaireRollDuration(steps: number, chance = false) {
  return (
    MILLIONAIRE_TIMING.roll +
    steps * MILLIONAIRE_TIMING.step +
    (chance ? MILLIONAIRE_TIMING.chance : 0) +
    MILLIONAIRE_TIMING.arrival
  );
}

export function millionaireBotDelay(data: Record<string, any>, thinkDelay: number) {
  return Math.max(thinkDelay, Number(data.presentationUntil ?? 0) - Date.now() + 250);
}
