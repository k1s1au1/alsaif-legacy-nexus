import { useMemo, useState, type CSSProperties } from "react";
import {
  ArrowLeftRight,
  BookOpen,
  Bot,
  ChevronLeft,
  Layers3,
  LogOut,
  MessageCircle,
  Palette,
  Send,
  Settings2,
  ShieldCheck,
  SmilePlus,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import "./uno-game-room.css";

type UnoColor = "red" | "blue" | "green" | "yellow" | "wild";

type UnoCard = {
  id: string;
  color: UnoColor;
  value: string;
};

type UnoPlayer = {
  id: string;
  name: string;
  avatarUrl: string | null;
  isHost?: boolean;
  isBot?: boolean;
};

type UnoRoomState = {
  round: number;
  data: Record<string, any>;
};

type UnoGameRoomProps = {
  state: UnoRoomState;
  players: UnoPlayer[];
  me: UnoPlayer;
  immersive: boolean;
  dispatch: (type: string, value?: any) => Promise<void>;
  onExit: () => void;
  onGuide: () => void;
  onSettings: () => void;
  isHost: boolean;
  onFinish: () => void;
};

const UNO_COLORS: Exclude<UnoColor, "wild">[] = ["red", "blue", "green", "yellow"];

const COLOR_LABELS: Record<Exclude<UnoColor, "wild">, string> = {
  red: "أحمر",
  blue: "أزرق",
  green: "أخضر",
  yellow: "أصفر",
};

const COLOR_HEX: Record<Exclude<UnoColor, "wild">, string> = {
  red: "#df3043",
  blue: "#1883d8",
  green: "#18a66a",
  yellow: "#f3b825",
};

const MODE_LABELS: Record<string, string> = {
  classic: "كلاسيك",
  flip: "فليب",
  "no-mercy": "بلا رحمة",
};

const QUICK_MESSAGES = ["لعب جميل 👏", "دورك الآن", "يا سلام! ✨"];
const QUICK_REACTIONS = ["👏", "🔥", "😂", "😮"];

function cardLabel(value: string) {
  if (value === "skip") return "تخطي";
  if (value === "reverse") return "عكس";
  if (value === "draw2") return "+2";
  if (value === "wild") return "لون";
  if (value === "wild4" || value === "draw4") return "+4";
  if (value === "draw5") return "+5";
  if (value === "draw6") return "+6";
  if (value === "draw10") return "+10";
  if (value === "flip") return "قلب";
  if (value === "skipAll") return "الكل";
  if (value === "discardAll") return "تخلّص";
  return value;
}

function cardSymbol(value: string) {
  if (value === "skip") return "⊘";
  if (value === "reverse") return "↻";
  if (value === "wild") return "✦";
  if (value === "flip") return "↕";
  if (value === "skipAll") return "⊘⊘";
  if (value === "discardAll") return "⇣";
  return cardLabel(value);
}

function isPlayable(card: UnoCard, data: Record<string, any>, hand: UnoCard[]) {
  const top = data.discard?.[data.discard.length - 1] as UnoCard | undefined;
  if (!top) return true;
  if ((data.pendingDraw ?? 0) > 0) {
    return ["draw2", "draw4", "wild4", "draw5", "draw6", "draw10"].includes(card.value);
  }
  if (card.value === "wild4") {
    return !hand.some((item) => item.id !== card.id && item.color === data.currentColor);
  }
  return card.color === "wild" || card.color === data.currentColor || card.value === top.value;
}

function orderedAroundMe(players: UnoPlayer[], meId: string) {
  const myIndex = players.findIndex((player) => player.id === meId);
  if (myIndex <= 0) return players;
  return [...players.slice(myIndex), ...players.slice(0, myIndex)];
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

function shortName(name: string) {
  return name.trim().split(/\s+/)[0] || "لاعب";
}

function PlayerAvatar({ player }: { player: UnoPlayer }) {
  return (
    <span className="uno-player-avatar" aria-hidden>
      {player.avatarUrl ? <img src={player.avatarUrl} alt="" /> : <span>{initials(player.name)}</span>}
      {player.isBot && <Bot className="uno-player-avatar__bot" />}
    </span>
  );
}

function CardBack({ index = 0 }: { index?: number }) {
  return (
    <span className="uno-card-back" style={{ "--back-index": index } as CSSProperties}>
      <span className="uno-card-back__frame"><Sparkles /></span>
    </span>
  );
}

function OpponentSeat({
  player,
  count,
  active,
  unoCalled,
  position,
}: {
  player: UnoPlayer;
  count: number;
  active: boolean;
  unoCalled: boolean;
  position: "left" | "top" | "right" | "rail";
}) {
  const visibleCards = Math.min(5, Math.max(1, count));
  return (
    <section className={cn("uno-opponent", `uno-opponent--${position}`, active && "is-active")} aria-label={`${player.name}، ${count} أوراق`}>
      <div className="uno-opponent__cards" aria-hidden>
        {Array.from({ length: visibleCards }).map((_, index) => <CardBack key={index} index={index} />)}
      </div>
      <div className="uno-opponent__identity">
        <PlayerAvatar player={player} />
        <span className="uno-opponent__copy">
          <strong>{shortName(player.name)}</strong>
          <small>{count} {count === 1 ? "ورقة" : "أوراق"}</small>
        </span>
        {player.isHost && <ShieldCheck className="uno-opponent__host" aria-label="مضيف الغرفة" />}
      </div>
      {unoCalled && <span className="uno-opponent__uno">أونو!</span>}
      {active && <span className="uno-opponent__turn">يلعب الآن</span>}
    </section>
  );
}

function UnoCardFace({
  card,
  playable = true,
  compact = false,
  selected = false,
  onClick,
}: {
  card: UnoCard;
  playable?: boolean;
  compact?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="uno-playing-card__corner uno-playing-card__corner--top">{cardLabel(card.value)}</span>
      <span className="uno-playing-card__oval"><b>{cardSymbol(card.value)}</b></span>
      <span className="uno-playing-card__corner uno-playing-card__corner--bottom">{cardLabel(card.value)}</span>
    </>
  );
  const style = card.color === "wild"
    ? undefined
    : ({ "--card-color": COLOR_HEX[card.color] } as CSSProperties);
  const className = cn(
    "uno-playing-card",
    `uno-playing-card--${card.color}`,
    compact && "is-compact",
    playable ? "is-playable" : "is-locked",
    selected && "is-selected",
  );

  if (!onClick) return <span className={className} style={style}>{content}</span>;
  return (
    <button type="button" className={className} style={style} disabled={!playable} onClick={onClick} aria-label={`العب بطاقة ${cardLabel(card.value)}`}>
      {content}
    </button>
  );
}

export function UnoGameRoom({
  state,
  players,
  me,
  immersive,
  dispatch,
  onExit,
  onGuide,
  onSettings,
  isHost,
  onFinish,
}: UnoGameRoomProps) {
  const data = state.data;
  const hand = (data.hands?.[me.id] ?? []) as UnoCard[];
  const activeIndex = Number(data.turnIndex ?? 0) % Math.max(players.length, 1);
  const active = players[activeIndex];
  const amActive = active?.id === me.id;
  const top = data.discard?.[data.discard.length - 1] as UnoCard | undefined;
  const ordered = useMemo(() => orderedAroundMe(players, me.id), [players, me.id]);
  const opponents = useMemo(() => ordered.filter((player) => player.id !== me.id), [ordered, me.id]);
  const [wildCard, setWildCard] = useState<UnoCard | null>(null);
  const [quickPanel, setQuickPanel] = useState<"message" | "reaction" | null>(null);
  const [floatingReaction, setFloatingReaction] = useState<string | null>(null);

  const positionedOpponents = useMemo(() => {
    if (opponents.length === 1) return [{ player: opponents[0], position: "top" as const }];
    if (opponents.length === 2) return [
      { player: opponents[0], position: "right" as const },
      { player: opponents[1], position: "left" as const },
    ];
    return [
      { player: opponents[0], position: "right" as const },
      { player: opponents[1], position: "top" as const },
      { player: opponents[2], position: "left" as const },
    ];
  }, [opponents]);

  const useOpponentRail = opponents.length > 3;
  const hasPlayable = hand.some((card) => isPlayable(card, data, hand) && (!data.drawnCardId || data.drawnCardId === card.id));
  const canDraw = amActive && !data.drawnCardId;
  const canPass = amActive && Boolean(data.drawnCardId);
  const canCallUno = amActive && hand.length <= 2 && !data.unoCalled?.[me.id];
  const currentColor = UNO_COLORS.includes(data.currentColor) ? data.currentColor as Exclude<UnoColor, "wild"> : "green";
  const modeLabel = MODE_LABELS[data.mode ?? "classic"] ?? "كلاسيك";
  const directionLabel = data.direction === -1 ? "مع عقارب الساعة" : "عكس عقارب الساعة";

  const playCard = (card: UnoCard) => {
    if (card.color === "wild") {
      setWildCard(card);
      return;
    }
    void dispatch("uno-play", { cardId: card.id });
  };

  const showLocalReaction = (value: string) => {
    setFloatingReaction(value);
    setQuickPanel(null);
    window.setTimeout(() => setFloatingReaction(null), 2400);
  };

  return (
    <main className={cn("uno-game-room", immersive ? "is-immersive" : "is-embedded")} dir="rtl">
      <header className="uno-hud">
        <div className="uno-hud__brand">
          <span className="uno-hud__mark"><Layers3 /></span>
          <span><small>مجلس السيف</small><strong>أونو العائلة</strong></span>
          <em>{modeLabel}</em>
        </div>

        <div className={cn("uno-turn-pill", amActive && "is-mine")}>
          <span className="uno-turn-pill__pulse" />
          <span><small>الجولة {state.round + 1}</small><strong>{amActive ? "دورك الآن" : `الدور عند ${shortName(active?.name ?? "اللاعب")}`}</strong></span>
        </div>

        <div className="uno-hud__actions">
          {isHost && <button type="button" onClick={onFinish} aria-label="إنهاء اللعبة"><Trophy /><span>إنهاء</span></button>}
          <button type="button" onClick={onGuide} aria-label="طريقة اللعب"><BookOpen /></button>
          <button type="button" onClick={onSettings} aria-label="إعدادات اللعب"><Settings2 /></button>
          <button type="button" onClick={onExit} aria-label="العودة من اللعبة"><LogOut /></button>
        </div>
      </header>

      <section className="uno-arena">
        <div className="uno-arena__glow" />
        <div className="uno-table">
          <div className="uno-table__inlay" />
          <div className="uno-table__monogram" aria-hidden><span>س</span></div>

          {useOpponentRail ? (
            <div className="uno-opponents-rail">
              {opponents.map((player) => (
                <OpponentSeat
                  key={player.id}
                  player={player}
                  count={data.hands?.[player.id]?.length ?? 0}
                  active={active?.id === player.id}
                  unoCalled={Boolean(data.unoCalled?.[player.id])}
                  position="rail"
                />
              ))}
            </div>
          ) : positionedOpponents.map(({ player, position }) => (
            <OpponentSeat
              key={player.id}
              player={player}
              count={data.hands?.[player.id]?.length ?? 0}
              active={active?.id === player.id}
              unoCalled={Boolean(data.unoCalled?.[player.id])}
              position={position}
            />
          ))}

          <div className="uno-table-center">
            <div className={cn("uno-direction-ring", data.direction === -1 && "is-reversed")} aria-label={directionLabel}>
              <ArrowLeftRight />
            </div>
            <div className="uno-decks">
              <button type="button" className="uno-draw-stack" disabled={!canDraw} onClick={() => void dispatch("uno-draw")} aria-label="سحب ورقة">
                <CardBack index={2} />
                <CardBack index={1} />
                <CardBack index={0} />
                <span className="uno-draw-stack__count">{data.drawPile?.length ?? 0}</span>
              </button>
              <div className="uno-discard" aria-label="آخر بطاقة لعبت">
                {top ? <UnoCardFace card={top} compact /> : <span className="uno-discard__empty">—</span>}
              </div>
            </div>
            <div className="uno-color-status">
              <span style={{ background: COLOR_HEX[currentColor] }} />
              <p><small>اللون الحالي</small><strong>{COLOR_LABELS[currentColor]}</strong></p>
            </div>
            {(data.pendingDraw ?? 0) > 0 && <div className="uno-draw-warning">تحدّي سحب +{data.pendingDraw}</div>}
          </div>

          <aside className="uno-action-rail" aria-label="إجراءات اللعب">
            <button type="button" className="uno-action uno-action--draw" disabled={!canDraw} onClick={() => void dispatch("uno-draw")}>
              <Layers3 /><span>اسحب</span>
            </button>
            <div className="uno-action uno-action--color" aria-label={`اللون الحالي ${COLOR_LABELS[currentColor]}`}>
              <Palette /><span>اللون</span><i style={{ background: COLOR_HEX[currentColor] }} />
            </div>
            {canPass && (
              <button type="button" className="uno-action uno-action--pass" onClick={() => void dispatch("uno-pass")}>
                <ChevronLeft /><span>مرّر</span>
              </button>
            )}
            <button type="button" className="uno-action uno-action--uno" disabled={!canCallUno} onClick={() => void dispatch("uno-call")}>
              <Sparkles /><span>أونو!</span>
            </button>
          </aside>

          <div className="uno-social-actions">
            <button type="button" onClick={() => setQuickPanel((value) => value === "message" ? null : "message")} aria-label="رسالة سريعة"><MessageCircle /></button>
            <button type="button" onClick={() => setQuickPanel((value) => value === "reaction" ? null : "reaction")} aria-label="تفاعل سريع"><SmilePlus /></button>
          </div>

          {quickPanel && (
            <div className="uno-quick-panel">
              <button type="button" className="uno-quick-panel__close" onClick={() => setQuickPanel(null)} aria-label="إغلاق"><X /></button>
              {(quickPanel === "message" ? QUICK_MESSAGES : QUICK_REACTIONS).map((value) => (
                <button type="button" key={value} onClick={() => showLocalReaction(value)}>{value}{quickPanel === "message" && <Send />}</button>
              ))}
            </div>
          )}

          {floatingReaction && <div className="uno-floating-reaction" role="status">{floatingReaction}</div>}

          <div className="uno-table-message" aria-live="polite">
            <span className={cn("uno-table-message__dot", amActive && "is-live")} />
            <p>{data.lastAction || (amActive ? "اختر بطاقة مناسبة" : "بانتظار اللاعب")}</p>
            {amActive && !hasPlayable && !data.drawnCardId && <strong>لا توجد بطاقة مناسبة — اسحب بطاقة</strong>}
          </div>
        </div>
      </section>

      <section className="uno-hand-zone" aria-label="بطاقاتك">
        <div className="uno-hand-zone__identity">
          <PlayerAvatar player={me} />
          <span><small>أوراقك</small><strong>{hand.length} {hand.length === 1 ? "ورقة" : "أوراق"}</strong></span>
          {data.unoCalled?.[me.id] && <em>أونو!</em>}
        </div>
        <div className="uno-hand-scroll">
          <div className="uno-hand">
            {hand.map((card) => {
              const playable = amActive && isPlayable(card, data, hand) && (!data.drawnCardId || data.drawnCardId === card.id);
              return (
                <UnoCardFace
                  key={card.id}
                  card={card}
                  playable={playable}
                  selected={data.drawnCardId === card.id}
                  onClick={() => playCard(card)}
                />
              );
            })}
          </div>
        </div>
      </section>

      {wildCard && (
        <div className="uno-color-picker" role="dialog" aria-modal="true" aria-label="اختر اللون التالي" onClick={() => setWildCard(null)}>
          <div className="uno-color-picker__panel" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="uno-color-picker__close" onClick={() => setWildCard(null)} aria-label="إغلاق"><X /></button>
            <span className="uno-color-picker__icon"><Palette /></span>
            <p>اختر اللون التالي</p>
            <small>سيصبح هذا اللون الفعّال بعد لعب البطاقة</small>
            <div className="uno-color-picker__choices">
              {UNO_COLORS.map((color) => (
                <button
                  type="button"
                  key={color}
                  style={{ "--choice-color": COLOR_HEX[color] } as CSSProperties}
                  onClick={() => {
                    void dispatch("uno-play", { cardId: wildCard.id, color });
                    setWildCard(null);
                  }}
                >
                  <span />{COLOR_LABELS[color]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
