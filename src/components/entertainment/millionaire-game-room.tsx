import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  BookOpen,
  Building2,
  CircleDollarSign,
  Coffee,
  Crown,
  Gift,
  Landmark,
  LockKeyhole,
  LogOut,
  MessageCircle,
  RotateCw,
  Settings2,
  Sparkles,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import "./millionaire-game-room.css";

export const MILLIONAIRE_BOARD = [
  { name: "الانطلاق", kind: "start", price: 0, rent: 0 },
  { name: "الدرعية", kind: "property", price: 60, rent: 8 },
  { name: "صندوق المجلس", kind: "chance", price: 0, rent: 0 },
  { name: "العلا", kind: "property", price: 80, rent: 10 },
  { name: "ضريبة الخدمات", kind: "tax", price: 0, rent: 40 },
  { name: "جدة التاريخية", kind: "property", price: 120, rent: 16 },
  { name: "استراحة", kind: "rest", price: 0, rent: 0 },
  { name: "أبها", kind: "property", price: 140, rent: 18 },
  { name: "بطاقة حظ", kind: "chance", price: 0, rent: 0 },
  { name: "الخبر", kind: "property", price: 160, rent: 22 },
  { name: "الرياض", kind: "property", price: 200, rent: 28 },
  { name: "إلى التوقيف", kind: "go-jail", price: 0, rent: 0 },
  { name: "القصيم", kind: "property", price: 220, rent: 32 },
  { name: "صندوق المجلس", kind: "chance", price: 0, rent: 0 },
  { name: "الطائف", kind: "property", price: 240, rent: 36 },
  { name: "نيوم", kind: "property", price: 300, rent: 48 },
] as const;

type PlayerLike = {
  id: string;
  name: string;
  avatarUrl: string | null;
  isHost?: boolean;
  isBot?: boolean;
};

type RoomStateLike = {
  data: Record<string, any>;
};

type MillionaireGameRoomProps = {
  state: RoomStateLike;
  players: PlayerLike[];
  me: PlayerLike;
  immersive: boolean;
  dispatch: (type: string, value?: any) => Promise<void>;
  onExit: () => void;
  onGuide: () => void;
  onSettings: () => void;
};

const PLAYER_COLORS = ["#52df55", "#f4434d", "#3b9dff", "#e7ae28"];
const PROPERTY_COLORS = [
  "#d9aa34",
  "#be6a55",
  "#268bd2",
  "#b39242",
  "#c85b62",
  "#2b9c6e",
  "#d39f31",
  "#617de8",
  "#8557c9",
  "#2c99b7",
  "#8ec13f",
  "#c57d3b",
  "#789c39",
  "#b7934a",
  "#499a73",
  "#66a8bb",
];
const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
const BOARD_PLACEMENTS = [
  [5, 1], [5, 2], [5, 3], [5, 4], [5, 5],
  [4, 5], [3, 5], [2, 5],
  [1, 5], [1, 4], [1, 3], [1, 2], [1, 1],
  [2, 1], [3, 1], [4, 1],
] as const;

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "لاعب";
}

function formatCash(value: number) {
  const safe = Math.max(0, Math.round(Number(value) || 0));
  if (safe >= 1000) {
    const millions = Math.floor(safe / 1000);
    const remainder = safe % 1000;
    return remainder ? `${millions}M${String(remainder).padStart(3, "0")}` : `${millions}M`;
  }
  return `${safe}K`;
}

function spaceIcon(kind: string): ReactNode {
  if (kind === "start") return <Trophy />;
  if (kind === "chance") return <Gift />;
  if (kind === "tax") return <CircleDollarSign />;
  if (kind === "rest") return <Coffee />;
  if (kind === "go-jail") return <LockKeyhole />;
  return <Building2 />;
}

function PlayerPortrait({ player }: { player: PlayerLike }) {
  if (player.avatarUrl) return <img src={player.avatarUrl} alt="" referrerPolicy="no-referrer" />;
  return <span>{player.isBot ? "ب" : firstName(player.name).slice(0, 1)}</span>;
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
  const activeIndex = Number(data.turnIndex ?? 0) % Math.max(players.length, 1);
  const activePlayer = players[activeIndex];
  const isMyTurn = activePlayer?.id === me.id && !data.bankrupt?.[me.id];
  const dice = (data.dice ?? [1, 1]) as [number, number];
  const myPosition = Number(data.positions?.[me.id] ?? 0);
  const currentPosition = Number(data.positions?.[activePlayer?.id] ?? 0);
  const currentSpace = MILLIONAIRE_BOARD[currentPosition] ?? MILLIONAIRE_BOARD[0];
  const currentOwnerId = data.properties?.[currentPosition] as string | undefined;
  const currentOwner = players.find((player) => player.id === currentOwnerId);
  const displayPlayers = useMemo(() => players.slice(0, 4), [players]);

  const rollDice = async () => {
    if (!isMyTurn || data.rolled || rolling) return;
    setRolling(true);
    await new Promise((resolve) => window.setTimeout(resolve, 520));
    await dispatch("monopoly-roll");
    window.setTimeout(() => setRolling(false), 260);
  };

  return (
    <section className={cn("millionaire-game", immersive && "is-immersive")} dir="rtl" aria-label="رحلة المليونير">
      <div className="millionaire-game__atmosphere" aria-hidden="true" />
      <div className="millionaire-game__portrait-lock">
        <span><RotateCw /></span>
        <strong>لف الجهاز للوضع الأفقي</strong>
        <p>رحلة المليونير مصممة كطاولة حقيقية وتظهر كاملة في الوضع الأفقي.</p>
      </div>

      <header className="millionaire-game__brand">
        <span className="millionaire-game__brand-mark"><Sparkles /></span>
        <div><small>مجلس السيف</small><strong>رحلة المليونير</strong></div>
      </header>

      <nav className="millionaire-game__tools" aria-label="أدوات اللعبة">
        <button type="button" onClick={onGuide} aria-label="طريقة اللعب"><BookOpen /></button>
        <button type="button" onClick={onSettings} aria-label="إعدادات اللعب"><Settings2 /></button>
        <button type="button" className="millionaire-game__chat" aria-label="رسائل سريعة"><MessageCircle /></button>
        <button type="button" onClick={onExit} aria-label="الخروج من وضع اللعبة"><LogOut /></button>
      </nav>

      <div className="millionaire-game__players" aria-label="اللاعبون">
        {displayPlayers.map((player, index) => {
          const active = player.id === activePlayer?.id;
          const bankrupt = Boolean(data.bankrupt?.[player.id]);
          return (
            <article
              key={player.id}
              className={cn(
                "millionaire-player",
                `millionaire-player--${index + 1}`,
                active && "is-active",
                player.id === me.id && "is-me",
                bankrupt && "is-bankrupt",
              )}
              style={{ "--player-color": PLAYER_COLORS[index] } as CSSProperties}
            >
              <div className="millionaire-player__portrait"><PlayerPortrait player={player} /></div>
              <div className="millionaire-player__copy">
                <p>{player.isHost && <Crown aria-label="المضيف" />}<strong>{firstName(player.name)}</strong>{player.id === me.id && <em>أنت</em>}</p>
                <span><CircleDollarSign /> {formatCash(data.cash?.[player.id] ?? 1500)}</span>
              </div>
              <b>{index + 1}</b>
            </article>
          );
        })}
      </div>

      <div className="millionaire-board-scene">
        <div className="millionaire-board" role="grid" aria-label="لوحة رحلة المليونير">
          <div className="millionaire-board__rim" aria-hidden="true" />
          {MILLIONAIRE_BOARD.map((space, index) => {
            const [row, column] = BOARD_PLACEMENTS[index];
            const ownerId = data.properties?.[index] as string | undefined;
            const ownerIndex = players.findIndex((player) => player.id === ownerId);
            const occupants = players.filter((player) => Number(data.positions?.[player.id] ?? 0) === index && !data.bankrupt?.[player.id]);
            const property = space.kind === "property";
            return (
              <div
                key={`${space.name}-${index}`}
                role="gridcell"
                className={cn(
                  "millionaire-space",
                  `millionaire-space--${space.kind}`,
                  index === currentPosition && "is-current",
                  index === myPosition && "has-me",
                )}
                style={{
                  gridRow: row,
                  gridColumn: column,
                  "--space-color": PROPERTY_COLORS[index],
                  "--owner-color": ownerIndex >= 0 ? PLAYER_COLORS[ownerIndex] : "transparent",
                } as CSSProperties}
              >
                <i className="millionaire-space__band" aria-hidden="true" />
                <span className="millionaire-space__icon">{spaceIcon(space.kind)}</span>
                <strong>{space.name}</strong>
                {property && <small>{space.price}K</small>}
                {ownerId && <span className="millionaire-space__owner" title={`مملوك لـ ${players[ownerIndex]?.name ?? "لاعب"}`} />}
                {occupants.length > 0 && (
                  <span className="millionaire-space__tokens" aria-label={`${occupants.length} لاعبين في ${space.name}`}>
                    {occupants.map((player) => {
                      const playerIndex = Math.max(0, players.findIndex((item) => item.id === player.id));
                      return <i key={player.id} style={{ "--token-color": PLAYER_COLORS[playerIndex % PLAYER_COLORS.length] } as CSSProperties}>{firstName(player.name).slice(0, 1)}</i>;
                    })}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="millionaire-game__center">
        <div className="millionaire-game__crest"><Landmark /></div>
        <p>رحلة</p>
        <h2>المليونير</h2>
        <div className={cn("millionaire-dice", rolling && "is-rolling")} aria-label={`النرد ${dice[0]} و${dice[1]}`}>
          <span>{DICE_FACES[Math.max(0, dice[0] - 1)]}</span>
          <span>{DICE_FACES[Math.max(0, dice[1] - 1)]}</span>
        </div>

        {!data.rolled ? (
          <button type="button" className="millionaire-game__roll" disabled={!isMyTurn || rolling} onClick={() => void rollDice()}>
            {rolling ? "النرد يتحرك…" : isMyTurn ? "ارمِ النرد" : `الدور عند ${firstName(activePlayer?.name ?? "اللاعب")}`}
          </button>
        ) : isMyTurn ? (
          <div className="millionaire-game__turn-actions">
            {data.canBuy && (
              <button type="button" className="is-buy" onClick={() => void dispatch("monopoly-buy")}>
                اشترِ {currentSpace.name}<small>{currentSpace.price}K</small>
              </button>
            )}
            <button type="button" className="is-end" onClick={() => void dispatch("monopoly-end")}>إنهاء الدور</button>
          </div>
        ) : (
          <div className="millionaire-game__waiting">بانتظار قرار {firstName(activePlayer?.name ?? "اللاعب")}</div>
        )}
      </div>

      <aside className="millionaire-game__property-card" aria-live="polite">
        <span style={{ "--space-color": PROPERTY_COLORS[currentPosition] } as CSSProperties}>{spaceIcon(currentSpace.kind)}</span>
        <div>
          <small>{currentOwner ? `ملك ${firstName(currentOwner.name)}` : currentSpace.kind === "property" ? "متاح للشراء" : "محطة الرحلة"}</small>
          <strong>{currentSpace.name}</strong>
          {currentSpace.kind === "property" && <p>السعر {currentSpace.price}K · الإيجار {currentSpace.rent}K</p>}
        </div>
      </aside>

      <footer className="millionaire-game__ticker">
        <span className="millionaire-game__status-dot" />
        <strong>{activePlayer?.id === me.id ? "دورك الآن" : `الدور عند ${firstName(activePlayer?.name ?? "اللاعب")}`}</strong>
        <p>{data.lastAction ?? "بدأت رحلة المليونير"}</p>
      </footer>
    </section>
  );
}
