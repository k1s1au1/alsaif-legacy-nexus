import {
  useEffect,
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

export type MillionaireSpaceKind =
  "start" | "city" | "chance" | "island" | "travel" | "festival" | "tourism";

export type MillionaireSpace = {
  name: string;
  kind: MillionaireSpaceKind;
  price: number;
  rent: number;
  side: 0 | 1 | 2 | 3;
  group?: string;
  color: string;
  landmark?: string;
  build?: readonly [number, number, number, number];
};

export const MILLIONAIRE_BOARD: readonly MillionaireSpace[] = [
  { name: "الانطلاق", kind: "start", price: 0, rent: 0, side: 0, color: "#dfb94f" },
  {
    name: "الدرعية",
    kind: "city",
    price: 220,
    rent: 42,
    side: 0,
    group: "najd",
    color: "#b87936",
    landmark: "حي الطريف",
    build: [90, 150, 230, 360],
  },
  {
    name: "الرياض",
    kind: "city",
    price: 300,
    rent: 58,
    side: 0,
    group: "najd",
    color: "#b87936",
    landmark: "برج المملكة",
    build: [120, 190, 280, 420],
  },
  { name: "بطاقة فرصة", kind: "chance", price: 0, rent: 0, side: 0, color: "#a96ad4" },
  {
    name: "القصيم",
    kind: "city",
    price: 250,
    rent: 48,
    side: 0,
    group: "central",
    color: "#d29d25",
    landmark: "برج بريدة",
    build: [100, 160, 240, 380],
  },
  {
    name: "حائل",
    kind: "city",
    price: 270,
    rent: 52,
    side: 0,
    group: "central",
    color: "#d29d25",
    landmark: "قلعة عيرف",
    build: [110, 170, 260, 400],
  },
  { name: "الجزيرة", kind: "island", price: 0, rent: 0, side: 0, color: "#668a73" },
  {
    name: "تبوك",
    kind: "city",
    price: 320,
    rent: 62,
    side: 1,
    group: "north",
    color: "#5f7fd2",
    landmark: "قلعة تبوك",
    build: [130, 200, 300, 450],
  },
  {
    name: "العلا",
    kind: "tourism",
    price: 420,
    rent: 110,
    side: 1,
    group: "tourism",
    color: "#7e5fc5",
    landmark: "قصر الفريد",
  },
  {
    name: "سكاكا",
    kind: "city",
    price: 340,
    rent: 66,
    side: 1,
    group: "north",
    color: "#5f7fd2",
    landmark: "قلعة زعبل",
    build: [140, 210, 320, 470],
  },
  { name: "بطاقة فرصة", kind: "chance", price: 0, rent: 0, side: 1, color: "#a96ad4" },
  {
    name: "نيوم",
    kind: "city",
    price: 500,
    rent: 96,
    side: 1,
    group: "north",
    color: "#5f7fd2",
    landmark: "ذا لاين",
    build: [190, 290, 430, 620],
  },
  { name: "جولة المملكة", kind: "travel", price: 0, rent: 0, side: 1, color: "#3196a7" },
  {
    name: "جدة",
    kind: "city",
    price: 390,
    rent: 76,
    side: 2,
    group: "west",
    color: "#2e9ab2",
    landmark: "واجهة جدة",
    build: [150, 240, 360, 520],
  },
  {
    name: "مكة",
    kind: "tourism",
    price: 520,
    rent: 140,
    side: 2,
    group: "tourism",
    color: "#b34f5a",
    landmark: "بوابة مكة",
  },
  {
    name: "الطائف",
    kind: "city",
    price: 350,
    rent: 68,
    side: 2,
    group: "west",
    color: "#2e9ab2",
    landmark: "قصر شبرا",
    build: [140, 220, 330, 490],
  },
  { name: "بطاقة فرصة", kind: "chance", price: 0, rent: 0, side: 2, color: "#a96ad4" },
  {
    name: "المدينة",
    kind: "tourism",
    price: 480,
    rent: 128,
    side: 2,
    group: "tourism",
    color: "#b34f5a",
    landmark: "محطة الحجاز",
  },
  { name: "مهرجان المملكة", kind: "festival", price: 0, rent: 0, side: 2, color: "#df9b23" },
  {
    name: "أبها",
    kind: "city",
    price: 360,
    rent: 70,
    side: 3,
    group: "south",
    color: "#4d9c62",
    landmark: "قرية المفتاحة",
    build: [140, 220, 340, 500],
  },
  {
    name: "جازان",
    kind: "city",
    price: 330,
    rent: 64,
    side: 3,
    group: "south",
    color: "#4d9c62",
    landmark: "قلعة الدوسرية",
    build: [130, 210, 310, 470],
  },
  { name: "بطاقة فرصة", kind: "chance", price: 0, rent: 0, side: 3, color: "#a96ad4" },
  {
    name: "الخبر",
    kind: "city",
    price: 410,
    rent: 80,
    side: 3,
    group: "east",
    color: "#d06c52",
    landmark: "برج الماء",
    build: [160, 250, 370, 540],
  },
  {
    name: "الدمام",
    kind: "city",
    price: 440,
    rent: 86,
    side: 3,
    group: "east",
    color: "#d06c52",
    landmark: "جزيرة المرجان",
    build: [170, 260, 390, 560],
  },
] as const;

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
  const [turnSeconds, setTurnSeconds] = useState(45);
  const [movingPlayers, setMovingPlayers] = useState<Record<string, boolean>>({});
  const [visualPositions, setVisualPositions] = useState<Record<string, number>>(() =>
    Object.fromEntries(players.map((player) => [player.id, Number(data.positions?.[player.id] ?? 0)])),
  );
  const visualPositionsRef = useRef(visualPositions);
  const movementTimers = useRef<number[]>([]);
  const activeIndex = Number(data.turnIndex ?? 0) % Math.max(players.length, 1);
  const activePlayer = players[activeIndex];
  const isMyTurn = activePlayer?.id === me.id && !data.bankrupt?.[me.id];
  const dice = (data.dice ?? [1, 1]) as [number, number];
  const currentPosition = Number(data.positions?.[activePlayer?.id] ?? 0);
  const currentSpace = MILLIONAIRE_BOARD[currentPosition] ?? MILLIONAIRE_BOARD[0];
  const currentProperty = propertyAt(data, currentPosition);
  const currentOwner = players.find((player) => player.id === currentProperty?.ownerId);
  const displayPlayers = useMemo(() => players.slice(0, 4), [players]);
  const myProperties = MILLIONAIRE_BOARD.map((space, index) => ({
    space,
    index,
    property: propertyAt(data, index),
  })).filter((item) => item.property?.ownerId === me.id);
  const pending = data.pending ?? null;
  const pendingSpaceIndex = Number(pending?.spaceIndex ?? -1);
  const pendingForMe = isMyTurn && pending?.playerId === me.id;
  const jailTurns = Number(data.jailTurns?.[me.id] ?? 0);
  const isDebt = pendingForMe && pending?.type === "debt";
  const inspectIndex = selectedSpace ?? currentPosition;
  const inspectSpace = MILLIONAIRE_BOARD[inspectIndex] ?? currentSpace;
  const inspectProperty = propertyAt(data, inspectIndex);
  const inspectOwner = players.find((player) => player.id === inspectProperty?.ownerId);
  const positionSignature = players
    .map((player) => `${player.id}:${Number(data.positions?.[player.id] ?? 0)}`)
    .join("|");
  const rankings = useMemo(
    () =>
      [...players]
        .map((player) => ({
          id: player.id,
          wealth: Number(data.cash?.[player.id] ?? 5000) + playerInvestment(data, player.id),
        }))
        .sort((a, b) => b.wealth - a.wealth),
    [players, data.cash, data.properties],
  );

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

    players.forEach((player) => {
      const target = Number(data.positions?.[player.id] ?? 0);
      const start = Number(visualPositionsRef.current[player.id] ?? target);
      if (start === target) return;

      const distance = (target - start + MILLIONAIRE_BOARD.length) % MILLIONAIRE_BOARD.length;
      const shouldAnimate = distance > 0 && distance <= 12 && player.id === activePlayer?.id;
      if (!shouldAnimate) {
        setVisualPositions((positions) => {
          const next = { ...positions, [player.id]: target };
          visualPositionsRef.current = next;
          return next;
        });
        return;
      }

      setMovingPlayers((moving) => ({ ...moving, [player.id]: true }));
      for (let step = 1; step <= distance; step += 1) {
        const timer = window.setTimeout(() => {
          const nextPosition = (start + step) % MILLIONAIRE_BOARD.length;
          setVisualPositions((positions) => {
            const next = { ...positions, [player.id]: nextPosition };
            visualPositionsRef.current = next;
            return next;
          });
          if (step === distance) {
            setMovingPlayers((moving) => ({ ...moving, [player.id]: false }));
          }
        }, step * 145);
        movementTimers.current.push(timer);
      }
    });

    return () => {
      movementTimers.current.forEach((timer) => window.clearTimeout(timer));
      movementTimers.current = [];
    };
  }, [positionSignature]);

  const rollDice = async () => {
    if (!isMyTurn || data.rolled || rolling || pending) return;
    setRolling(true);
    await new Promise((resolve) => window.setTimeout(resolve, 620));
    await dispatch("monopoly-roll");
    window.setTimeout(() => setRolling(false), 320);
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
            {isMyTurn ? "دورك الآن" : "دور " + firstName(activePlayer?.name ?? "اللاعب")}
          </strong>
        </span>
        <time dateTime={`PT${turnSeconds}S`}>00:{String(turnSeconds).padStart(2, "0")}</time>
      </div>

      <nav className="millionaire-game__tools" aria-label="أدوات اللعبة">
        <button type="button" onClick={onGuide} aria-label="طريقة اللعب">
          <BookOpen />
        </button>
        <button type="button" onClick={() => setShowAssets(true)} aria-label="إدارة أملاكي">
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
          const rank = Math.max(1, rankings.findIndex((item) => item.id === player.id) + 1);
          return (
            <article
              key={player.id}
              className={cn(
                "millionaire-player",
                "millionaire-player--" + (index + 1),
                active && "is-active",
                player.id === me.id && "is-me",
                bankrupt && "is-bankrupt",
              )}
              style={{ "--player-color": PLAYER_COLORS[index] } as CSSProperties}
            >
              <div className="millionaire-player__portrait">
                <PlayerPortrait player={player} />
              </div>
              <div className="millionaire-player__copy">
                <p>
                  {player.isHost && <Crown aria-label="المضيف" />}
                  <strong>{firstName(player.name)}</strong>
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
                <small className="millionaire-player__owned">
                  <Landmark /> {ownedCount} أملاك{" "}
                  {Number(data.jailTurns?.[player.id] ?? 0) > 0 && "· في الجزيرة"}
                </small>
              </div>
              <b className="millionaire-player__rank">{rank}</b>
              {bankrupt && <mark>مفلس</mark>}
            </article>
          );
        })}
      </div>

      <div className="millionaire-board-scene">
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
                  data.festival?.spaceIndex === index && "is-festival",
                )}
                style={
                  {
                    gridRow: row,
                    gridColumn: column,
                    "--space-color": space.color,
                    "--owner-color": ownerIndex >= 0 ? PLAYER_COLORS[ownerIndex] : "transparent",
                  } as CSSProperties
                }
              >
                <i className="millionaire-space__band" aria-hidden="true" />
                <span className="millionaire-space__content">
                  <span className="millionaire-space__icon">{spaceIcon(space.kind)}</span>
                  <strong>{space.name}</strong>
                  {ownable && <small>{formatCash(space.price)}</small>}
                </span>
                {property && (
                  <>
                    <span
                      className="millionaire-space__owner"
                      title={"ملك " + (players[ownerIndex]?.name ?? "لاعب")}
                    />
                  </>
                )}
                {ownable && (
                  <CityModel
                    space={space}
                    level={property?.level ?? 0}
                    ownerColor={ownerIndex >= 0 ? PLAYER_COLORS[ownerIndex] : space.color}
                  />
                )}
                {occupants.length > 0 && (
                  <span
                    className="millionaire-space__tokens"
                    aria-label={occupants.length + " لاعبين في " + space.name}
                  >
                    {occupants.map((player) => {
                      const playerIndex = Math.max(
                        0,
                        players.findIndex((item) => item.id === player.id),
                      );
                      return (
                        <i
                          key={player.id}
                          className={cn(movingPlayers[player.id] && "is-moving")}
                          style={
                            {
                              "--token-color": PLAYER_COLORS[playerIndex % PLAYER_COLORS.length],
                            } as CSSProperties
                          }
                        >
                          {firstName(player.name).slice(0, 1)}
                        </i>
                      );
                    })}
                  </span>
                )}
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
            <span>{firstName(activePlayer?.name ?? "اللاعب")}</span>
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
                disabled={!isMyTurn || rolling || Boolean(pending)}
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
              onClick={() => void dispatch("monopoly-end")}
            >
              {data.extraTurn ? "ارمِ مرة أخرى" : "إنهاء الدور"}
            </button>
          ) : (
            <div className="millionaire-game__waiting">
              {pending
                ? "بانتظار قرار " + firstName(activePlayer?.name ?? "اللاعب")
                : "يتم تنفيذ الحركة"}
            </div>
          )}
        </div>
      </div>

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
              ? "ملك " + firstName(inspectOwner.name)
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
          {isMyTurn ? "دورك الآن" : "الدور عند " + firstName(activePlayer?.name ?? "اللاعب")}
        </strong>
        <p>{data.lastAction ?? "بدأت رحلة المليونير"}</p>
      </footer>

      {pendingForMe && (
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
          aria-label="إدارة أملاكي"
          onClick={() => setShowAssets(false)}
        >
          <div onClick={(event) => event.stopPropagation()}>
            <header>
              <span>
                <WalletCards />
              </span>
              <div>
                <small>المحفظة</small>
                <strong>أملاكي واستثماراتي</strong>
              </div>
              <button type="button" onClick={() => setShowAssets(false)}>
                <X />
              </button>
            </header>
            <div className="millionaire-assets__summary">
              <p>
                <CircleDollarSign />
                <span>
                  السيولة<strong>{formatCash(data.cash?.[me.id] ?? 0)}</strong>
                </span>
              </p>
              <p>
                <Building2 />
                <span>
                  عدد المواقع<strong>{myProperties.length}</strong>
                </span>
              </p>
              <p>
                <TicketCheck />
                <span>
                  بطاقات الخروج<strong>{Number(data.escapeCards?.[me.id] ?? 0)}</strong>
                </span>
              </p>
            </div>
            <section>
              {myProperties.length ? (
                myProperties.map(({ space, index, property }) => (
                  <article key={index}>
                    <i style={{ background: space.color }} />
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
                    <button
                      type="button"
                      disabled={Boolean(pending)}
                      onClick={() => void dispatch("monopoly-sell", { spaceIndex: index })}
                    >
                      <Hammer /> بيع
                    </button>
                  </article>
                ))
              ) : (
                <p className="millionaire-assets__empty">لم تشترِ أي موقع بعد.</p>
              )}
            </section>
          </div>
        </div>
      )}
    </section>
  );
}
