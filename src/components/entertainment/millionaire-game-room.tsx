import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  BookOpen,
  Building2,
  Castle,
  CircleDollarSign,
  Coins,
  Crown,
  Gift,
  Hammer,
  Landmark,
  LockKeyhole,
  LogOut,
  MapPin,
  MessageCircle,
  Navigation,
  Plane,
  RotateCw,
  Settings2,
  Sparkles,
  TicketCheck,
  Trophy,
  WalletCards,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import "./millionaire-game-room.css";
import type { MillionaireMovement } from "./millionaire-engine";

import { MILLIONAIRE_BOARD, type MillionaireSpace, type MillionaireSpaceKind } from "./millionaire-board";
export { MILLIONAIRE_BOARD } from "./millionaire-board";
export type { MillionaireSpace, MillionaireSpaceKind } from "./millionaire-board";

type PlayerLike = {
  id: string;
  name: string;
  avatarUrl: string | null;
  isHost?: boolean;
  isBot?: boolean;
};

type PropertyState = {
  ownerId: string;
  level: number;
  invested: number;
};

type PendingState = {
  type: "buy" | "upgrade" | "takeover" | "travel" | "festival" | "debt";
  playerId?: string;
  spaceIndex?: number;
  currentLevel?: number;
  ownerId?: string;
  cost?: number;
  amount?: number;
  creditorId?: string | null;
  reason?: string;
  source?: string;
};

type MillionaireData = {
  turnIndex?: number;
  turnNumber?: number;
  positions?: Record<string, number>;
  cash?: Record<string, number>;
  properties?: Record<string | number, PropertyState | string>;
  bankrupt?: Record<string, boolean>;
  jailTurns?: Record<string, number>;
  escapeCards?: Record<string, number>;
  dice?: [number, number] | null;
  movement?: MillionaireMovement | null;
  rolled?: boolean;
  extraTurn?: boolean;
  pending?: PendingState | null;
  festival?: { spaceIndex: number; ownerId: string; untilTurn: number } | null;
  lastAction?: string;
  actionLog?: string[];
};

type RoomStateLike = { data: MillionaireData };

type MillionaireGameRoomProps = {
  state: RoomStateLike;
  players: PlayerLike[];
  me: PlayerLike;
  immersive: boolean;
  dispatch: (type: string, value?: unknown) => Promise<void>;
  onExit: () => void;
  onGuide: () => void;
  onSettings: () => void;
};

const PLAYER_COLORS = ["#52df72", "#f2525c", "#42a4ff", "#f1b834"];
const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
const LEVEL_LABELS = ["أرض", "فيلا", "مبنى", "فندق", "مَعْلم"];
const BOARD_PLACEMENTS = [
  [7, 7],
  [7, 6],
  [7, 5],
  [7, 4],
  [7, 3],
  [7, 2],
  [7, 1],
  [6, 1],
  [5, 1],
  [4, 1],
  [3, 1],
  [2, 1],
  [1, 1],
  [1, 2],
  [1, 3],
  [1, 4],
  [1, 5],
  [1, 6],
  [1, 7],
  [2, 7],
  [3, 7],
  [4, 7],
  [5, 7],
  [6, 7],
] as const;

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "لاعب";
}

function playerLabel(player: PlayerLike, players: PlayerLike[]) {
  const name = firstName(player.name);
  return players.filter((item) => firstName(item.name) === name).length > 1
    ? `${name} ${players.findIndex((item) => item.id === player.id) + 1}`
    : name;
}

function formatCash(value: number) {
  const safe = Math.max(0, Math.round(Number(value) || 0));
  if (safe >= 1000) {
    const millions = Math.floor(safe / 1000);
    const remainder = safe % 1000;
    return remainder ? millions + "M" + String(remainder).padStart(3, "0") : millions + "M";
  }
  return safe + "K";
}

function propertyAt(data: MillionaireData, index: number): PropertyState | null {
  const property = data.properties?.[index];
  if (!property) return null;
  if (typeof property === "string") {
    const space = MILLIONAIRE_BOARD[index];
    return { ownerId: property, level: 1, invested: space?.price ?? 0 };
  }
  return property as PropertyState;
}

function structureTotal(space: MillionaireSpace, targetLevel: number) {
  if (space.kind === "tourism") return space.price;
  const build = space.build ?? [0, 0, 0, 0];
  let total = space.price;
  for (let level = 1; level < targetLevel; level += 1) total += build[level - 1] ?? 0;
  return total;
}

function upgradeCost(space: MillionaireSpace, currentLevel: number, targetLevel: number) {
  if (space.kind !== "city") return 0;
  return Math.max(0, structureTotal(space, targetLevel) - structureTotal(space, currentLevel));
}

function spaceIcon(kind: MillionaireSpaceKind): ReactNode {
  if (kind === "start") return <Trophy />;
  if (kind === "chance") return <Gift />;
  if (kind === "island") return <LockKeyhole />;
  if (kind === "travel") return <Plane />;
  if (kind === "festival") return <Sparkles />;
  if (kind === "tourism") return <Castle />;
  return <Building2 />;
}

function PlayerPortrait({ player }: { player: PlayerLike }) {
  if (player.avatarUrl) return <img src={player.avatarUrl} alt="" referrerPolicy="no-referrer" />;
  return <span>{player.isBot ? "ب" : firstName(player.name).slice(0, 1)}</span>;
}

function MiniBuildings({ level, landmark }: { level: number; landmark?: boolean }) {
  if (!level) return null;
  return (
    <span
      className={cn("millionaire-mini-buildings", landmark && "is-landmark")}
      aria-label={LEVEL_LABELS[Math.min(level, 4)]}
    >
      {Array.from({ length: Math.min(level, 4) }, (_, index) => (
        <i key={index} />
      ))}
    </span>
  );
}

function CityModel({
  space,
  level,
  ownerColor,
}: {
  space: MillionaireSpace;
  level: number;
  ownerColor: string;
}) {
  if (level <= 0) return null;
  const visibleLevel = Math.max(1, Math.min(level || 1, 4));
  return (
    <span
      className={cn(
        "millionaire-city-model",
        level > 0 && "is-owned",
        level >= 4 && "is-landmark",
      )}
      style={{ "--model-color": ownerColor } as CSSProperties}
      aria-hidden="true"
    >
      <span className="millionaire-city-model__plot" />
      <i className="millionaire-city-model__building millionaire-city-model__building--1" />
      {visibleLevel >= 2 && (
        <i className="millionaire-city-model__building millionaire-city-model__building--2" />
      )}
      {visibleLevel >= 3 && (
        <i className="millionaire-city-model__building millionaire-city-model__building--3" />
      )}
      {visibleLevel >= 4 && (
        <i className="millionaire-city-model__building millionaire-city-model__building--4" />
      )}
      {level > 0 && <em>{space.landmark}</em>}
    </span>
  );
}

function playerInvestment(data: MillionaireData, playerId: string) {
  return MILLIONAIRE_BOARD.reduce((total, _, index) => {
    const property = propertyAt(data, index);
    return property?.ownerId === playerId ? total + Number(property.invested ?? 0) : total;
  }, 0);
}

export function MillionaireGameRoom({
  state,
  players,
  me,
  immersive,
  dispatch,
  onExit,
  onGuide,
  onSettings,
}: MillionaireGameRoomProps) {
  const data = state.data ?? {};
  const [rolling, setRolling] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState<number | null>(null);
  const [showAssets, setShowAssets] = useState(false);
  const [assetsPlayerId, setAssetsPlayerId] = useState(me.id);
  const [focusedPlayerId, setFocusedPlayerId] = useState(me.id);
  const [turnSeconds, setTurnSeconds] = useState(45);
  const [movingPlayers, setMovingPlayers] = useState<Record<string, boolean>>({});
  const [visualPositions, setVisualPositions] = useState<Record<string, number>>(() =>
    Object.fromEntries(players.map((player) => [player.id, Number(data.positions?.[player.id] ?? 0)])),
  );
  const visualPositionsRef = useRef(visualPositions);
  const movementTimers = useRef<number[]>([]);
  const sceneRef = useRef<HTMLDivElement>(null);
  const spaceAnchors = useRef<Array<HTMLSpanElement | null>>([]);
  const [boardLayout, setBoardLayout] = useState({ width: 1, height: 1, points: [] as Array<{ x: number; y: number }> });
  const [journey, setJourney] = useState<MillionaireMovement | null>(data.movement ?? null);
  const [journeyStep, setJourneyStep] = useState(data.movement?.steps.length ?? 0);
  const movementSignature = data.movement ? JSON.stringify(data.movement) : "";
  const lastMovementSignature = useRef(movementSignature);
  const activeIndex = Number(data.turnIndex ?? 0) % Math.max(players.length, 1);
  const activePlayer = players[activeIndex];
  const activePlayerLabel = activePlayer ? playerLabel(activePlayer, players) : "اللاعب";
  const isMyTurn = activePlayer?.id === me.id && !data.bankrupt?.[me.id];
  const dice = (data.dice ?? [1, 1]) as [number, number];
  const currentPosition = Number(visualPositions[activePlayer?.id] ?? data.positions?.[activePlayer?.id] ?? 0);
  const currentSpace = MILLIONAIRE_BOARD[currentPosition] ?? MILLIONAIRE_BOARD[0];
  const displayPlayers = useMemo(() => players.slice(0, 4), [players]);
  const myProperties = MILLIONAIRE_BOARD.map((space, index) => ({
    space,
    index,
    property: propertyAt(data, index),
  })).filter((item) => item.property?.ownerId === me.id);
  const pending = data.pending ?? null;
  const pendingSpaceIndex = Number(pending?.spaceIndex ?? -1);
  const pendingForMe = isMyTurn && pending?.playerId === me.id;
  const boardMoving = Object.values(movingPlayers).some(Boolean) || movementSignature !== lastMovementSignature.current;
  const jailTurns = Number(data.jailTurns?.[me.id] ?? 0);
  const isDebt = pendingForMe && pending?.type === "debt";
  const inspectIndex = selectedSpace ?? currentPosition;
  const inspectSpace = MILLIONAIRE_BOARD[inspectIndex] ?? currentSpace;
  const inspectProperty = propertyAt(data, inspectIndex);
  const inspectOwner = players.find((player) => player.id === inspectProperty?.ownerId);
  const positionSignature = players
    .map((player) => `${player.id}:${Number(data.positions?.[player.id] ?? 0)}`)
    .join("|");
  const assetsPlayer = players.find((player) => player.id === assetsPlayerId) ?? me;
  const visibleAssets = MILLIONAIRE_BOARD.map((space, index) => ({ space, index, property: propertyAt(data, index) }))
    .filter((item) => item.property?.ownerId === assetsPlayer.id);
  const journeyPlayer = players.find((player) => player.id === journey?.playerId);
  const journeyColor = PLAYER_COLORS[Math.max(0, players.findIndex((player) => player.id === journey?.playerId)) % PLAYER_COLORS.length];
  const myPosition = Number(visualPositions[me.id] ?? data.positions?.[me.id] ?? 0);
  const journeyRoute = journey ? [journey.from, ...journey.steps] : [];
  const jumpFrom = journeyRoute[journeyRoute.length - 1];
  const hasJump = Boolean(journey && jumpFrom !== journey.to);
  const tokenPlacements = displayPlayers.flatMap((player, index) => {
    if (data.bankrupt?.[player.id]) return [];
    const position = Number(visualPositions[player.id] ?? data.positions?.[player.id] ?? 0);
    const point = boardLayout.points[position];
    if (!point) return [];
    const occupants = displayPlayers.filter((item) => !data.bankrupt?.[item.id] && Number(visualPositions[item.id] ?? data.positions?.[item.id] ?? 0) === position);
    const slot = occupants.findIndex((item) => item.id === player.id);
    return [{
      player, index, position, point, shared: occupants.length > 1,
      x: point.x + (occupants.length > 1 ? slot % 2 === 0 ? -35 : 35 : 0),
      y: point.y + (occupants.length > 1 ? Math.floor(slot / 2) * -(boardLayout.width > 500 ? 68 : 52) : 0),
    }];
  });

  useLayoutEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const measure = () => {
      const bounds = scene.getBoundingClientRect();
      setBoardLayout({
        width: bounds.width || 1,
        height: bounds.height || 1,
        points: spaceAnchors.current.map((anchor) => {
          const point = anchor?.getBoundingClientRect();
          return { x: (point?.left ?? bounds.left) - bounds.left, y: (point?.top ?? bounds.top) - bounds.top };
        }),
      });
    };
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(scene);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, []);

  useEffect(() => {
    setTurnSeconds(45);
    const timer = window.setInterval(() => {
      setTurnSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activePlayer?.id, data.turnNumber]);

  useEffect(() => {
    movementTimers.current.forEach((timer) => window.clearTimeout(timer));
    movementTimers.current = [];
    const movement = data.movement;
    const isNewMovement = Boolean(movement && movementSignature !== lastMovementSignature.current);
    lastMovementSignature.current = movementSignature;
    setMovingPlayers({});
    const positions = Object.fromEntries(players.map((player) => [player.id, Number(data.positions?.[player.id] ?? 0)]));
    if (!isNewMovement || !movement) {
      visualPositionsRef.current = positions;
      setVisualPositions(positions);
      if (!movement) { setJourney(null); setJourneyStep(0); }
      return;
    }

    setJourney(movement);
    setJourneyStep(0);
    positions[movement.playerId] = movement.from;
    visualPositionsRef.current = positions;
    setVisualPositions(positions);
    const route = [...movement.steps];
    if (route[route.length - 1] !== movement.to) route.push(movement.to);
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reducedMotion || route.length === 0) {
      const next = { ...positions, [movement.playerId]: movement.to };
      visualPositionsRef.current = next;
      setVisualPositions(next);
      setJourneyStep(movement.steps.length);
      return;
    }
    setMovingPlayers({ [movement.playerId]: true });
    route.forEach((position, index) => {
      movementTimers.current.push(window.setTimeout(() => {
        const next = { ...visualPositionsRef.current, [movement.playerId]: position };
        visualPositionsRef.current = next;
        setVisualPositions(next);
        setJourneyStep(Math.min(index + 1, movement.steps.length));
        if (index === route.length - 1) setMovingPlayers({});
      }, (index + 1) * 260));
    });

    return () => {
      movementTimers.current.forEach((timer) => window.clearTimeout(timer));
      movementTimers.current = [];
    };
  }, [positionSignature, movementSignature]);

  const rollDice = async () => {
    if (!isMyTurn || data.rolled || rolling || pending || boardMoving) return;
    setRolling(true);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 620));
      await dispatch("monopoly-roll");
    } finally { setRolling(false); }
  };

  const levelOptions =
    pendingForMe && (pending?.type === "buy" || pending?.type === "upgrade")
      ? [1, 2, 3, 4].filter((level) => {
          const space = MILLIONAIRE_BOARD[pendingSpaceIndex];
          if (!space || space.kind === "tourism") return level === 1;
          if (pending.type === "buy" && level === 4) return false;
          const currentLevel = pending.type === "upgrade" ? Number(pending.currentLevel ?? 1) : 0;
          if (level <= currentLevel) return false;
          const cost =
            pending.type === "buy"
              ? structureTotal(space, level)
              : upgradeCost(space, currentLevel, level);
          return cost <= Number(data.cash?.[me.id] ?? 0);
        })
      : [];

  return (
    <section
      className={cn("millionaire-game", immersive && "is-immersive")}
      dir="rtl"
      aria-label="رحلة المليونير"
      data-moving={boardMoving}
    >
      <div className="millionaire-game__atmosphere" aria-hidden="true" />
      <div className="millionaire-game__portrait-lock">
        <span>
          <RotateCw />
        </span>
        <strong>لف الجهاز للوضع الأفقي</strong>
        <p>اللوحة الكاملة وأملاك اللاعبين تظهر في الوضع الأفقي.</p>
      </div>

      <header className="millionaire-game__brand">
        <span className="millionaire-game__brand-mark">
          <Sparkles />
        </span>
        <div>
          <small>مجلس السيف</small>
          <strong>رحلة المليونير</strong>
        </div>
      </header>

      <div className="millionaire-game__round">
        <span>
          <small>الجولة {Number(data.turnNumber ?? 1)}</small>
          <strong>
            {isMyTurn ? "دورك الآن" : "دور " + activePlayerLabel}
          </strong>
        </span>
        <time dateTime={`PT${turnSeconds}S`}>00:{String(turnSeconds).padStart(2, "0")}</time>
      </div>

      <nav className="millionaire-game__tools" aria-label="أدوات اللعبة">
        <button type="button" onClick={onGuide} aria-label="طريقة اللعب">
          <BookOpen />
        </button>
        <button type="button" onClick={() => { setAssetsPlayerId(me.id); setShowAssets(true); }} aria-label="إدارة أملاكي">
          <WalletCards />
        </button>
        <button type="button" onClick={onSettings} aria-label="إعدادات اللعب">
          <Settings2 />
        </button>
        <button type="button" className="millionaire-game__chat" aria-label="رسائل سريعة">
          <MessageCircle />
        </button>
        <button type="button" onClick={onExit} aria-label="الخروج من وضع اللعبة">
          <LogOut />
        </button>
      </nav>

      <div className="millionaire-game__players" aria-label="اللاعبون">
        {displayPlayers.map((player, index) => {
          const active = player.id === activePlayer?.id;
          const bankrupt = Boolean(data.bankrupt?.[player.id]);
          const ownedCount = MILLIONAIRE_BOARD.filter(
            (_, propertyIndex) => propertyAt(data, propertyIndex)?.ownerId === player.id,
          ).length;
          const cash = Number(data.cash?.[player.id] ?? 5000);
          const totalWealth = cash + playerInvestment(data, player.id);
          const position = Number(visualPositions[player.id] ?? data.positions?.[player.id] ?? 0);
          return (
            <article
              key={player.id}
              className={cn(
                "millionaire-player",
                "millionaire-player--" + (index + 1),
                active && "is-active",
                player.id === me.id && "is-me",
                player.id === focusedPlayerId && "is-focused",
                bankrupt && "is-bankrupt",
              )}
              style={{ "--player-color": PLAYER_COLORS[index] } as CSSProperties}
              data-player-id={player.id}
            >
              <div className="millionaire-player__portrait">
                <PlayerPortrait player={player} />
              </div>
              <div className="millionaire-player__copy">
                <p>
                  {player.isHost && <Crown aria-label="المضيف" />}
                  <strong>{playerLabel(player, players)}</strong>
                  {player.id === me.id && <em>أنت</em>}
                </p>
                <div className="millionaire-player__stats">
                  <span>
                    <small>الكاش</small>
                    <strong>{formatCash(cash)}</strong>
                  </span>
                  <span>
                    <small>المجموع</small>
                    <strong>{formatCash(totalWealth)}</strong>
                  </span>
                </div>
                <button
                  className="millionaire-player__location"
                  type="button"
                  disabled={bankrupt}
                  onClick={() => { setFocusedPlayerId(player.id); setSelectedSpace(position); }}
                  aria-label={"إظهار موقع " + playerLabel(player, players) + " في " + MILLIONAIRE_BOARD[position]?.name}
                >
                  <MapPin />
                  <span>{player.id === me.id ? "موقعك: " : "الموقع: "}<strong>{MILLIONAIRE_BOARD[position]?.name}</strong></span>
                </button>
                <button
                  className="millionaire-player__owned"
                  type="button"
                  onClick={() => { setAssetsPlayerId(player.id); setFocusedPlayerId(player.id); setShowAssets(true); }}
                  aria-label={"عرض أملاك " + playerLabel(player, players)}
                >
                  <Landmark /> {ownedCount} أملاك · عرض
                  {Number(data.jailTurns?.[player.id] ?? 0) > 0 && " · في الجزيرة"}
                </button>
              </div>
              <b className="millionaire-player__number" aria-label={"رقم القطعة " + (index + 1)}>{index + 1}</b>
              {bankrupt && <mark>مفلس</mark>}
            </article>
          );
        })}
      </div>

      <div className="millionaire-board-scene" ref={sceneRef}>
        <div className="millionaire-board" role="grid" aria-label="لوحة رحلة المليونير">
          <div className="millionaire-board__rim" aria-hidden="true" />
          <div className="millionaire-board__map" aria-hidden="true">
            <MapPin />
            <span>المملكة</span>
          </div>
          {MILLIONAIRE_BOARD.map((space, index) => {
            const [row, column] = BOARD_PLACEMENTS[index];
            const property = propertyAt(data, index);
            const ownerIndex = players.findIndex((player) => player.id === property?.ownerId);
            const occupants = players.filter(
              (player) =>
                Number(visualPositions[player.id] ?? data.positions?.[player.id] ?? 0) === index &&
                !data.bankrupt?.[player.id],
            );
            const ownable = space.kind === "city" || space.kind === "tourism";
            return (
              <button
                type="button"
                key={space.name + "-" + index}
                role="gridcell"
                onClick={() => setSelectedSpace(index)}
                className={cn(
                  "millionaire-space",
                  "millionaire-space--" + space.kind,
                  "millionaire-space--side-" + space.side,
                  index === currentPosition && "is-current",
                  occupants.some((player) => player.id === focusedPlayerId) && "is-focused-position",
                  property && "is-owned",
                  property?.ownerId === me.id && "is-my-property",
                  property?.ownerId === focusedPlayerId && "is-focused-property",
                  journey?.steps.includes(index) && "is-on-path",
                  journey?.from === index && "is-origin",
                  journey?.to === index && "is-destination",
                  data.festival?.spaceIndex === index && "is-festival",
                )}
                style={
                  {
                    gridRow: row,
                    gridColumn: column,
                    "--space-color": space.color,
                    "--owner-color": ownerIndex >= 0 ? PLAYER_COLORS[ownerIndex] : "transparent",
                    "--path-color": journeyColor,
                  } as CSSProperties
                }
                aria-label={space.name + ". " + (property ? "ملك " + (players[ownerIndex] ? playerLabel(players[ownerIndex], players) : "لاعب") : ownable ? "متاح للشراء" : "محطة خاصة") + (occupants.length ? ". يقف هنا " + occupants.map((player) => playerLabel(player, players)).join("، ") : "")}
                data-space-index={index}
                data-owner-id={property?.ownerId ?? ""}
              >
                <i className="millionaire-space__band" aria-hidden="true" />
                <span ref={(element) => { spaceAnchors.current[index] = element; }} className="millionaire-space__anchor" aria-hidden="true" />
                <span className="millionaire-space__content" aria-hidden="true">
                  <span className="millionaire-space__icon">{spaceIcon(space.kind)}</span>
                  <strong>{space.name}</strong>
                  {ownable && <small>{formatCash(space.price)}</small>}
                </span>
                {property && (
                  <span className="millionaire-space__owner" aria-hidden="true">
                    {ownerIndex + 1}
                  </span>
                )}
                {ownable && (
                  <CityModel
                    space={space}
                    level={property?.level ?? 0}
                    ownerColor={ownerIndex >= 0 ? PLAYER_COLORS[ownerIndex] : space.color}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="millionaire-board__overlays">
          <svg className="millionaire-token-links" viewBox={`0 0 ${boardLayout.width} ${boardLayout.height}`} aria-hidden="true">
            {tokenPlacements.filter((item) => item.shared).map(({ player, index, point, x, y }) => <line key={player.id} x1={point.x} y1={point.y} x2={x} y2={y} style={{ "--token-color": PLAYER_COLORS[index] } as CSSProperties} />)}
          </svg>
          {journey && boardLayout.points.length === MILLIONAIRE_BOARD.length && (
            <svg className="millionaire-route" viewBox={`0 0 ${boardLayout.width} ${boardLayout.height}`} aria-hidden="true">
              <polyline className="millionaire-route__line" points={journeyRoute.map((index) => `${boardLayout.points[index].x},${boardLayout.points[index].y}`).join(" ")} style={{ "--path-color": journeyColor } as CSSProperties} />
              {hasJump && <line className="millionaire-route__jump" x1={boardLayout.points[jumpFrom].x} y1={boardLayout.points[jumpFrom].y} x2={boardLayout.points[journey.to].x} y2={boardLayout.points[journey.to].y} />}
              {journey.steps.map((index, step) => (
                <g key={step} className={cn("millionaire-route__step", step < journeyStep && "is-complete")} transform={`translate(${boardLayout.points[index].x}, ${boardLayout.points[index].y})`}>
                  <circle r="10" />
                  <text textAnchor="middle" dominantBaseline="central">{step + 1}</text>
                </g>
              ))}
            </svg>
          )}

          {MILLIONAIRE_BOARD.map((space, index) => {
            const point = boardLayout.points[index];
            if (!point) return null;
            const property = propertyAt(data, index);
            const ownerIndex = players.findIndex((player) => player.id === property?.ownerId);
            const owner = players[ownerIndex];
            const ownable = space.kind === "city" || space.kind === "tourism";
            return (
              <span key={index} className={cn("millionaire-space-label", property && "is-owned", property?.ownerId === me.id && "is-mine")} style={{ left: point.x, top: point.y, "--owner-color": PLAYER_COLORS[ownerIndex] } as CSSProperties} aria-hidden="true">
                <strong>{space.name}</strong>
                {ownable && <small>{owner ? owner.id === me.id ? "أرضك" : playerLabel(owner, players) : "للبيع"}</small>}
              </span>
            );
          })}

          {tokenPlacements.map(({ player, index, position, x, y }) => {
            return (
              <button
                key={player.id}
                type="button"
                className={cn("millionaire-token", player.id === me.id && "is-me", player.id === focusedPlayerId && "is-focused", movingPlayers[player.id] && "is-moving")}
                style={{ left: x, top: y, "--token-color": PLAYER_COLORS[index] } as CSSProperties}
                onClick={() => { setFocusedPlayerId(player.id); setSelectedSpace(position); }}
                aria-label={(player.id === me.id ? "قطعتك: " : "قطعة ") + playerLabel(player, players) + "، الموقع " + MILLIONAIRE_BOARD[position].name}
                data-player-id={player.id}
                data-position={position}
              >
                <span className="millionaire-token__pawn"><b>{index + 1}</b></span>
                <strong>{player.id === me.id ? "أنت" : playerLabel(player, players)}</strong>
              </button>
            );
          })}
        </div>

        <div className="millionaire-game__center">
          <div className="millionaire-game__crest">
            <Landmark />
          </div>
          <p>رحلة</p>
          <h2>المليونير</h2>
          <div className="millionaire-game__center-stats">
            <span>الجولة {Number(data.turnNumber ?? 1)}</span>
            <i />
            <span>{activePlayerLabel}</span>
          </div>
          <div
            className={cn("millionaire-dice", rolling && "is-rolling")}
            aria-label={"النرد " + dice[0] + " و" + dice[1]}
          >
            <span>{DICE_FACES[Math.max(0, dice[0] - 1)]}</span>
            <span>{DICE_FACES[Math.max(0, dice[1] - 1)]}</span>
          </div>

          {!data.rolled ? (
            <>
              {isMyTurn && jailTurns > 0 && (
                <div className="millionaire-game__jail-actions">
                  <button
                    type="button"
                    disabled={Number(data.cash?.[me.id] ?? 0) < 150}
                    onClick={() => void dispatch("monopoly-pay-jail")}
                  >
                    ادفع 150K
                  </button>
                  {Number(data.escapeCards?.[me.id] ?? 0) > 0 && (
                    <button type="button" onClick={() => void dispatch("monopoly-use-pass")}>
                      استخدم بطاقة خروج
                    </button>
                  )}
                </div>
              )}
              <button
                type="button"
                className="millionaire-game__roll"
                disabled={!isMyTurn || rolling || Boolean(pending) || boardMoving}
                onClick={() => void rollDice()}
              >
                {rolling
                  ? "النرد يتحرك…"
                  : isMyTurn
                    ? jailTurns > 0
                      ? "حاول الخروج بالنرد"
                      : "ارمِ النرد"
                    : "انتظر دورك"}
              </button>
            </>
          ) : isMyTurn && !pending ? (
            <button
              type="button"
              className="millionaire-game__end"
              disabled={boardMoving}
              onClick={() => void dispatch("monopoly-end")}
            >
              {data.extraTurn ? "ارمِ مرة أخرى" : "إنهاء الدور"}
            </button>
          ) : (
            <div className="millionaire-game__waiting">
              {boardMoving ? "يتحرك خانة بخانة…" : pending
                ? "بانتظار قرار " + activePlayerLabel
                : "يتم تنفيذ الحركة"}
            </div>
          )}
        </div>
      </div>

      <aside className="millionaire-navigation" aria-label="الموقع ومسار الحركة">
        <div className="millionaire-navigation__location" style={{ "--my-color": PLAYER_COLORS[Math.max(0, players.findIndex((player) => player.id === me.id))] } as CSSProperties}><MapPin /><span>موقعك الآن: <strong>{MILLIONAIRE_BOARD[myPosition]?.name}</strong></span></div>
        {journey && journeyPlayer && (
          <div className="millionaire-navigation__journey">
            <p role="status">{movingPlayers[journey.playerId] ? playerLabel(journeyPlayer, players) + " يتحرك إلى " : "آخر حركة: " + playerLabel(journeyPlayer, players) + " وصل إلى "}{MILLIONAIRE_BOARD[journey.to]?.name}</p>
            <span>{MILLIONAIRE_BOARD[journey.from]?.name} ← {MILLIONAIRE_BOARD[journey.to]?.name} · {journey.steps.length ? `${journeyStep} / ${journey.steps.length} خطوات${hasJump ? " · انتقال ببطاقة" : ""}` : journey.source === "travel" ? "سفر مباشر" : "انتقال إلى الجزيرة"}</span>
          </div>
        )}
      </aside>

      {selectedSpace !== null && (
        <aside className="millionaire-game__property-card" aria-live="polite">
        <button
          type="button"
          aria-label="إغلاق تفاصيل المحطة"
          onClick={() => setSelectedSpace(null)}
        >
          <X />
        </button>
        <span style={{ "--space-color": inspectSpace.color } as CSSProperties}>
          {spaceIcon(inspectSpace.kind)}
        </span>
        <div>
          <small>
            {inspectOwner
              ? inspectOwner.id === me.id ? "أرضك" : "ملك " + playerLabel(inspectOwner, players)
              : inspectSpace.kind === "city" || inspectSpace.kind === "tourism"
                ? "متاح للشراء"
                : "محطة خاصة"}
          </small>
          <strong>{inspectSpace.name}</strong>
          {(inspectSpace.kind === "city" || inspectSpace.kind === "tourism") && (
            <p>
              السعر {formatCash(inspectSpace.price)} · الرسوم الأساسية{" "}
              {formatCash(inspectSpace.rent)}{" "}
              {inspectProperty && "· " + LEVEL_LABELS[Math.min(inspectProperty.level, 4)]}
            </p>
          )}
        </div>
        </aside>
      )}

      <footer className="millionaire-game__ticker">
        <span className="millionaire-game__status-dot" />
        <strong>
          {isMyTurn ? "دورك الآن" : "الدور عند " + activePlayerLabel}
        </strong>
        <p>{data.lastAction ?? "بدأت رحلة المليونير"}</p>
      </footer>

      {pendingForMe && !boardMoving && !rolling && (
        <div
          className="millionaire-decision"
          role="dialog"
          aria-modal="true"
          aria-label="قرار الدور"
        >
          <div className="millionaire-decision__head">
            <span>
              {pending.type === "debt" ? (
                <Coins />
              ) : pending.type === "travel" ? (
                <Navigation />
              ) : pending.type === "festival" ? (
                <Sparkles />
              ) : (
                <Building2 />
              )}
            </span>
            <div>
              <small>قرارك الآن</small>
              <strong>
                {pending.type === "buy" &&
                  "استثمر في " + MILLIONAIRE_BOARD[pendingSpaceIndex]?.name}
                {pending.type === "upgrade" && "طوّر " + MILLIONAIRE_BOARD[pendingSpaceIndex]?.name}
                {pending.type === "takeover" &&
                  "استحوذ على " + MILLIONAIRE_BOARD[pendingSpaceIndex]?.name}
                {pending.type === "travel" && "اختر وجهة السفر"}
                {pending.type === "festival" && "اختر مدينة المهرجان"}
                {pending.type === "debt" && "سدّد الالتزام المالي"}
              </strong>
            </div>
          </div>

          {(pending.type === "buy" || pending.type === "upgrade") && (
            <div className="millionaire-decision__levels">
              {levelOptions.map((level) => {
                const space = MILLIONAIRE_BOARD[pendingSpaceIndex];
                const currentLevel =
                  pending.type === "upgrade" ? Number(pending.currentLevel ?? 1) : 0;
                const cost =
                  pending.type === "buy"
                    ? structureTotal(space, level)
                    : upgradeCost(space, currentLevel, level);
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() =>
                      void dispatch(pending.type === "buy" ? "monopoly-buy" : "monopoly-upgrade", {
                        level,
                      })
                    }
                  >
                    <MiniBuildings level={level} landmark={level === 4} />
                    <strong>{LEVEL_LABELS[level]}</strong>
                    <small>{formatCash(cost)}</small>
                  </button>
                );
              })}
            </div>
          )}

          {pending.type === "takeover" && (
            <div className="millionaire-decision__confirm">
              <p>دفعت رسوم الزيارة. تستطيع ضم الموقع قبل أن يتحول إلى مَعْلم.</p>
              <button type="button" onClick={() => void dispatch("monopoly-takeover")}>
                استحواذ مقابل {formatCash(Number(pending.cost ?? 0))}
              </button>
            </div>
          )}

          {(pending.type === "travel" || pending.type === "festival") && (
            <div className="millionaire-decision__destinations">
              {MILLIONAIRE_BOARD.map((space, index) => {
                const property = propertyAt(data, index);
                const allowed =
                  pending.type === "travel"
                    ? space.kind === "city" || space.kind === "tourism"
                    : property?.ownerId === me.id;
                if (!allowed) return null;
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() =>
                      void dispatch(
                        pending.type === "travel" ? "monopoly-travel" : "monopoly-festival",
                        { spaceIndex: index },
                      )
                    }
                  >
                    <i style={{ background: space.color }} />
                    <span>
                      {space.name}
                      <small>
                        {property ? LEVEL_LABELS[Math.min(property.level, 4)] : "متاحة"}
                      </small>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {isDebt && (
            <div className="millionaire-decision__debt">
              <p>
                المطلوب: <strong>{formatCash(Number(pending.amount ?? 0))}</strong> · رصيدك:{" "}
                <strong>{formatCash(data.cash?.[me.id] ?? 0)}</strong>
              </p>
              {Number(data.cash?.[me.id] ?? 0) >= Number(pending.amount ?? 0) && (
                <button
                  type="button"
                  className="is-pay"
                  onClick={() => void dispatch("monopoly-pay-debt")}
                >
                  سداد كامل
                </button>
              )}
              <div>
                {myProperties.map(({ space, index, property }) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => void dispatch("monopoly-sell", { spaceIndex: index })}
                  >
                    بيع {space.name}
                    <small>
                      +{formatCash(Math.round(Number(property?.invested ?? space.price) * 0.7))}
                    </small>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="is-bankrupt"
                onClick={() => void dispatch("monopoly-bankrupt")}
              >
                إعلان الإفلاس
              </button>
            </div>
          )}

          {!isDebt && (
            <button
              type="button"
              className="millionaire-decision__decline"
              onClick={() => void dispatch("monopoly-decline")}
            >
              {pending.type === "travel"
                ? "البقاء في محطة السفر"
                : pending.type === "festival"
                  ? "تجاوز المهرجان"
                  : "تجاوز القرار"}
            </button>
          )}
        </div>
      )}

      {showAssets && (
        <div
          className="millionaire-assets"
          role="dialog"
          aria-modal="true"
          aria-label={assetsPlayer.id === me.id ? "إدارة أملاكي" : "أملاك " + playerLabel(assetsPlayer, players)}
          onClick={() => setShowAssets(false)}
        >
          <div onClick={(event) => event.stopPropagation()}>
            <header>
              <span>
                <WalletCards />
              </span>
              <div>
                <small>المحفظة</small>
                <strong>{assetsPlayer.id === me.id ? "أملاكي واستثماراتي" : "أملاك " + playerLabel(assetsPlayer, players)}</strong>
              </div>
              <button type="button" aria-label="إغلاق الأملاك" onClick={() => setShowAssets(false)}>
                <X />
              </button>
            </header>
            <nav className="millionaire-assets__players" aria-label="أملاك اللاعبين">
              {displayPlayers.map((player, index) => (
                <button key={player.id} type="button" aria-pressed={assetsPlayer.id === player.id} style={{ "--player-color": PLAYER_COLORS[index] } as CSSProperties} onClick={() => setAssetsPlayerId(player.id)}>
                  {index + 1} · {player.id === me.id ? "أنت" : playerLabel(player, players)}
                </button>
              ))}
            </nav>
            <div className="millionaire-assets__summary">
              <p>
                <CircleDollarSign />
                <span>
                  السيولة<strong>{formatCash(data.cash?.[assetsPlayer.id] ?? 0)}</strong>
                </span>
              </p>
              <p>
                <Building2 />
                <span>
                  عدد المواقع<strong>{visibleAssets.length}</strong>
                </span>
              </p>
              <p>
                <TicketCheck />
                <span>
                  بطاقات الخروج<strong>{Number(data.escapeCards?.[assetsPlayer.id] ?? 0)}</strong>
                </span>
              </p>
            </div>
            <section>
              {visibleAssets.length ? (
                visibleAssets.map(({ space, index, property }) => (
                  <article key={index}>
                    <i style={{ background: PLAYER_COLORS[Math.max(0, players.findIndex((player) => player.id === assetsPlayer.id))] }} />
                    <span>
                      <strong>{space.name}</strong>
                      <small>
                        {LEVEL_LABELS[Math.min(property?.level ?? 1, 4)]} · استثمار{" "}
                        {formatCash(property?.invested ?? space.price)}
                      </small>
                    </span>
                    <MiniBuildings
                      level={property?.level ?? 1}
                      landmark={(property?.level ?? 1) >= 4}
                    />
                    {assetsPlayer.id === me.id && <button
                      type="button"
                      disabled={!isMyTurn || Boolean(pending) || boardMoving}
                      onClick={() => void dispatch("monopoly-sell", { spaceIndex: index })}
                    >
                      <Hammer /> بيع
                    </button>}
                  </article>
                ))
              ) : (
                <p className="millionaire-assets__empty">{assetsPlayer.id === me.id ? "لم تشترِ أي موقع بعد." : "لم يشترِ " + playerLabel(assetsPlayer, players) + " أي موقع بعد."}</p>
              )}
            </section>
            <button className="millionaire-assets__show-board" type="button" onClick={() => { setFocusedPlayerId(assetsPlayer.id); setSelectedSpace(null); setShowAssets(false); }}>
              {assetsPlayer.id === me.id ? "إظهار أملاكي على اللوح" : "إظهار أملاك " + playerLabel(assetsPlayer, players) + " على اللوح"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
