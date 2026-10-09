import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ArrowDownUp,
  BookOpen,
  Bot,
  Check,
  ChevronLeft,
  Clock3,
  LogOut,
  RotateCcw,
  Settings2,
  Trophy,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { playGameSfx } from "@/lib/game-sfx";
import { UNO_COLORS, UNO_TURN_MS, sortUnoHand, unoPlayable, type UnoCard } from "./uno-engine";
import "./uno-game-room.css";

type UnoPlayer = {
  id: string;
  name: string;
  avatarUrl: string | null;
  isHost?: boolean;
  isBot?: boolean;
  connected?: boolean;
};
type UnoRoomState = { round: number; scores?: Record<string, number>; data: Record<string, any> };
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
  connected?: boolean;
  clockOffset?: number;
  sound?: boolean;
  reducedMotion?: boolean;
  onToggleSound?: () => void;
};
const COLORS = { red: "#df3043", blue: "#1683da", green: "#209d55", yellow: "#efbb18" };
const LABELS = { red: "أحمر", blue: "أزرق", green: "أخضر", yellow: "أصفر" };
const MODES: Record<string, string> = { classic: "كلاسيك", flip: "فليب", "no-mercy": "بلا رحمة" };
const SORT_LABELS = { color: "حسب اللون", value: "حسب الرقم", original: "ترتيب السحب" };
type SortOrder = keyof typeof SORT_LABELS;
const labels: Record<string, string> = {
  skip: "تخطي",
  reverse: "عكس الاتجاه",
  draw2: "+2",
  wild: "اختيار اللون",
  wild4: "+4",
  draw4: "+4",
  draw5: "+5",
  draw6: "+6",
  draw10: "+10",
  flip: "قلب",
  skipAll: "تخطي الجميع",
  discardAll: "تخلّص من اللون",
};
function label(value: string) {
  return labels[value] ?? value;
}
function corner(value: string) {
  return (
    (
      { reverse: "⇄", skip: "⊘", skipAll: "⊘", flip: "↕", discardAll: "⇣", wild: "✦" } as Record<
        string,
        string
      >
    )[value] ?? label(value)
  );
}
function symbol(value: string) {
  return (
    (
      { skip: "⊘", reverse: "⇄", wild: "", flip: "↕", skipAll: "⊘", discardAll: "⇣" } as Record<
        string,
        string
      >
    )[value] ?? label(value)
  );
}
function name(player?: UnoPlayer) {
  return player?.name.trim().split(/\s+/)[0] || "اللاعب";
}
function Avatar({ player }: { player: UnoPlayer }) {
  return (
    <span className="uno-avatar">
      {player.avatarUrl ? <img src={player.avatarUrl} alt="" /> : <span>{name(player)[0]}</span>}
      {player.isBot && <Bot className="uno-avatar__bot" />}
    </span>
  );
}
function CardBack({ style }: { style?: CSSProperties }) {
  return (
    <span className="uno-back" style={style} aria-hidden>
      <b>UNO</b>
    </span>
  );
}
function Face({
  card,
  compact,
  selected,
  playable,
  index = 0,
  total = 1,
  onSelect,
}: {
  card: UnoCard;
  compact?: boolean;
  selected?: boolean;
  playable?: boolean;
  index?: number;
  total?: number;
  onSelect?: () => void;
}) {
  const style = {
    "--card-color": card.color === "wild" ? "#191919" : COLORS[card.color],
    "--fan-angle": `${Math.max(-8, Math.min(8, (index - (total - 1) / 2) * 2))}deg`,
    "--card-index": index,
  } as CSSProperties;
  const body = (
    <>
      <span className="uno-card__corner">{corner(card.value)}</span>
      <span className="uno-card__oval">
        {card.color === "wild" ? (
          <span className="uno-wild-mark">
            <i />
            <i />
            <i />
            <i />
          </span>
        ) : (
          <b className={card.value.length > 1 ? "is-symbol" : undefined}>{symbol(card.value)}</b>
        )}
      </span>
      {card.color === "wild" && card.value !== "wild" && (
        <strong className="uno-card__wild-value">{label(card.value)}</strong>
      )}
      <span className="uno-card__corner uno-card__corner--bottom">{corner(card.value)}</span>
    </>
  );
  const className = cn(
    "uno-card",
    compact && "is-compact",
    selected && "is-selected",
    playable && "is-playable",
    card.color === "wild" && "is-wild",
  );
  return onSelect ? (
    <button
      type="button"
      className={className}
      style={style}
      onClick={onSelect}
      aria-pressed={Boolean(selected)}
      aria-label={`بطاقة ${card.color === "wild" ? "حرة" : LABELS[card.color]} ${label(card.value)}${playable ? "، قابلة للعب" : ""}`}
    >
      {body}
    </button>
  ) : (
    <span className={className} style={style}>
      {body}
    </span>
  );
}
function TimerRing({ seconds, urgent }: { seconds: number; urgent?: boolean }) {
  return (
    <span
      className={cn("uno-timer", urgent && "is-urgent")}
      role="timer"
      aria-label={`باقي ${seconds} ثانية للدور`}
    >
      <svg viewBox="0 0 60 60" aria-hidden>
        <circle cx="30" cy="30" r="25" />
        <circle
          cx="30"
          cy="30"
          r="25"
          pathLength="100"
          strokeDasharray={`${(seconds / 30) * 100} 100`}
        />
      </svg>
      <b>{seconds}</b>
    </span>
  );
}
function Seat({
  player,
  count,
  position,
  active,
  called,
  seconds,
  style,
}: {
  player: UnoPlayer;
  count: number;
  position: string;
  active: boolean;
  called: boolean;
  seconds: number;
  style?: CSSProperties;
}) {
  const size = Math.min(count, 7);
  return (
    <section
      className={cn(
        "uno-seat",
        `uno-seat--${position}`,
        active && "is-active",
        player.connected === false && "is-offline",
      )}
      aria-label={`${player.name}، ${count} أوراق`}
      style={style}
    >
      <div className="uno-seat__identity">
        <Avatar player={player} />
        <strong>{name(player)}</strong>
        <b className="uno-count">{count}</b>
        {active && <TimerRing seconds={seconds} urgent={seconds <= 5} />}{" "}
        {player.connected === false && <WifiOff size={14} aria-label="بانتظار إعادة الاتصال" />}
      </div>
      <div className="uno-seat__cards" aria-hidden>
        {Array.from({ length: size }, (_, i) => (
          <CardBack
            key={i}
            style={{ "--back-angle": `${(i - (size - 1) / 2) * 5}deg` } as CSSProperties}
          />
        ))}
      </div>
      {called && <span className="uno-seat__called">UNO!</span>}
    </section>
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
  connected = true,
  clockOffset = 0,
  sound = false,
  reducedMotion = false,
  onToggleSound,
}: UnoGameRoomProps) {
  const data = state.data;
  const hand = (data.hands?.[me.id] ?? []) as UnoCard[];
  const active = players[Number(data.turnIndex ?? 0) % Math.max(players.length, 1)];
  const myTurn = active?.id === me.id;
  const [now, setNow] = useState(Date.now());
  const [selected, setSelected] = useState<string | null>(null);
  const [wild, setWild] = useState<UnoCard | null>(null);
  const [sort, setSort] = useState<SortOrder>(() => {
    try {
      const saved = localStorage.getItem("alsaif-uno-card-order") as SortOrder;
      return ["color", "value", "original"].includes(saved) ? saved : "color";
    } catch {
      return "color";
    }
  });
  const [sortOpen, setSortOpen] = useState(false);
  const [motion, setMotion] = useState<any>(null);
  const seenEvent = useRef("");
  const lastTick = useRef("");
  const orderedHand = useMemo(() => sortUnoHand(hand, sort), [hand, sort]);
  const myIndex = Math.max(
    0,
    players.findIndex((player) => player.id === me.id),
  );
  const opponents = [...players.slice(myIndex + 1), ...players.slice(0, myIndex)];
  const positioned =
    opponents.length === 1
      ? [{ player: opponents[0], position: "top" }]
      : opponents.map((player, index) => ({
          player,
          position:
            opponents.length === 2
              ? index === 0
                ? "right"
                : "left"
              : index === 0
                ? "right"
                : index === 1
                  ? "top"
                  : index === 2
                    ? "left"
                    : "rail",
        }));
  const seconds = Math.max(
    0,
    Math.min(
      30,
      Math.ceil((Number(data.turnDeadline ?? now + UNO_TURN_MS) - (now + clockOffset)) / 1000),
    ),
  );
  const canAct = myTurn && connected && seconds > 0;
  const playable = (card: UnoCard) =>
    canAct && unoPlayable(card, data, hand) && (!data.drawnCardId || data.drawnCardId === card.id);
  const selectedCard = hand.find((card) => card.id === selected);
  const canDraw = canAct && !data.drawnCardId;
  const color = UNO_COLORS.includes(data.currentColor)
    ? (data.currentColor as keyof typeof COLORS)
    : "green";
  const top = data.discard?.at(-1) as UnoCard | undefined;
  const eventSettings = useRef({ event: data.event, clockOffset, sound, reducedMotion });
  eventSettings.current = { event: data.event, clockOffset, sound, reducedMotion };

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => {
    setSelected(null);
    setWild(null);
  }, [data.turnSequence, me.id, state.round]);
  useEffect(() => {
    if (!canAct) setWild(null);
  }, [canAct]);
  useEffect(() => {
    const key = `${data.turnSequence}:${seconds}`;
    if (sound && myTurn && seconds > 0 && seconds <= 5 && lastTick.current !== key) {
      lastTick.current = key;
      playGameSfx("tick");
    }
  }, [seconds, sound, myTurn, data.turnSequence]);
  useEffect(() => {
    const { event, clockOffset, sound, reducedMotion } = eventSettings.current;
    const key = `${state.round}:${event?.sequence}`;
    setMotion(null);
    if (!event || seenEvent.current === key || Date.now() + clockOffset - event.at > 2500) return;
    seenEvent.current = key;
    if (sound)
      playGameSfx(event.type === "uno-play" ? "play" : event.type === "uno-draw" ? "draw" : "move");
    if (reducedMotion) return;
    setMotion(event);
    const timeout = window.setTimeout(() => setMotion(null), 1100);
    return () => window.clearTimeout(timeout);
  }, [data.event?.sequence, state.round]);
  useEffect(() => {
    if (reducedMotion) setMotion(null);
  }, [reducedMotion]);
  const chooseSort = (value: SortOrder) => {
    setSort(value);
    setSortOpen(false);
    try {
      localStorage.setItem("alsaif-uno-card-order", value);
    } catch {
      /* Preference is optional. */
    }
  };
  const play = () => {
    if (!selectedCard || !playable(selectedCard)) return;
    if (selectedCard.color === "wild") setWild(selectedCard);
    else {
      void dispatch("uno-play", { cardId: selectedCard.id });
      setSelected(null);
    }
  };
  const relative = (id: string) => {
    const seat =
      (players.findIndex((player) => player.id === id) - myIndex + players.length) %
      Math.max(1, players.length);
    return seat === 0
      ? "bottom"
      : players.length === 2
        ? "top"
        : seat === 1
          ? "right"
          : seat === 2 && players.length > 3
            ? "top"
            : "left";
  };
  const flightStyle = (id: string) => {
    const coords = {
      bottom: ["0px", "32vh"],
      top: ["0px", "-24vh"],
      right: ["36vw", "0px"],
      left: ["-36vw", "0px"],
    };
    const c = coords[relative(id) as keyof typeof coords];
    return { "--flight-x": c[0], "--flight-y": c[1] } as CSSProperties;
  };

  return (
    <main
      className={cn(
        "uno-game-room",
        immersive ? "is-immersive" : "is-embedded",
        reducedMotion && "is-reduced-motion",
        players.length > 6 && "has-many-players",
      )}
      dir="rtl"
    >
      <header className="uno-hud">
        <strong className="uno-title">
          أونو <small>{MODES[data.mode ?? "classic"] ?? "كلاسيك"}</small>
        </strong>
        <div className="uno-clock-pill">
          <Clock3 />
          <b>وقت الدور ٣٠ ثانية</b>
          <span>الجولة {state.round + 1}</span>
        </div>
        <nav className="uno-hud__actions" aria-label="خيارات اللعبة">
          <button onClick={onToggleSound} aria-label={sound ? "كتم الصوت" : "تشغيل الصوت"}>
            {sound ? <Volume2 /> : <VolumeX />}
          </button>
          <button onClick={onGuide} aria-label="طريقة اللعب">
            <BookOpen />
          </button>
          <button onClick={onSettings} aria-label="الإعدادات">
            <Settings2 />
          </button>
          {isHost && (
            <button onClick={onFinish} aria-label="إنهاء اللعبة">
              <Trophy />
            </button>
          )}
          <button onClick={onExit} aria-label="العودة من اللعبة">
            <LogOut />
          </button>
        </nav>
      </header>
      <section className="uno-table" aria-label="طاولة أونو">
        <div className="uno-stage">
          {positioned.map(({ player, position }, index) => (
            <Seat
              key={player.id}
              player={player}
              count={data.hands?.[player.id]?.length ?? 0}
              active={active?.id === player.id}
              called={Boolean(data.unoCalled?.[player.id])}
              position={position}
              seconds={seconds}
              style={
                position === "rail"
                  ? ({
                      "--seat-x": `${[26, 74, 10, 90, 8, 92][index - 3]}%`,
                      "--seat-y": `${[4, 4, 65, 65, 4, 4][index - 3]}%`,
                    } as CSSProperties)
                  : undefined
              }
            />
          ))}
          <div className="uno-center">
            <div className="uno-piles">
              <div className="uno-draw-area">
                <button
                  type="button"
                  className="uno-draw-pile"
                  disabled={!canDraw}
                  onClick={() => void dispatch("uno-draw")}
                  aria-label="سحب ورقة"
                >
                  <CardBack />
                  <CardBack />
                  <CardBack />
                </button>
                <button
                  type="button"
                  className="uno-draw-button"
                  disabled={!canDraw}
                  onClick={() => void dispatch("uno-draw")}
                >
                  اسحب
                </button>
              </div>
              <div className="uno-discard" aria-label="الورقة الحالية">
                {top && <Face card={top} compact />}
              </div>
            </div>
            <span
              className="uno-current-color"
              style={{ background: COLORS[color] }}
              aria-label={`اللون الحالي ${LABELS[color]}`}
            />
            <svg
              className={cn("uno-direction", data.direction === 1 && "is-reversed")}
              viewBox="0 0 70 90"
              aria-label={data.direction === -1 ? "مع عقارب الساعة" : "عكس عقارب الساعة"}
            >
              <path d="M12 10 C65 15 63 65 29 73" />
              <path d="M35 54 L29 73 L49 73" />
            </svg>
            {data.pendingDraw > 0 && (
              <span className="uno-pending-draw">اسحب +{data.pendingDraw}</span>
            )}
          </div>
          {motion?.type === "uno-play" && motion.card && (
            <div
              className="uno-flight uno-flight--play"
              key={`play-${motion.sequence}`}
              style={flightStyle(motion.playerId)}
              aria-hidden
            >
              <Face card={motion.card} compact />
            </div>
          )}
          {motion?.targetId && (
            <div
              className={cn(
                "uno-flight uno-flight--draw",
                motion.type === "uno-play" && "is-delayed",
              )}
              key={`draw-${motion.sequence}`}
              style={flightStyle(motion.targetId)}
              aria-hidden
            >
              <CardBack />
              {motion.count > 1 && <b>+{motion.count}</b>}
            </div>
          )}
          {motion?.card &&
            [
              "reverse",
              "skip",
              "flip",
              "skipAll",
              "draw2",
              "wild4",
              "draw4",
              "draw5",
              "draw6",
              "draw10",
            ].includes(motion.card.value) && (
              <span className="uno-special-effect" key={`special-${motion.sequence}`} aria-hidden>
                {symbol(motion.card.value)}
              </span>
            )}
          <div className="uno-last-action" role="status">
            <span />
            {data.lastAction || "تم توزيع الأوراق"}
          </div>
          {!connected && (
            <div className="uno-connection" role="status">
              <WifiOff />
              إعادة الاتصال… أوراقك ومقعدك محفوظان
            </div>
          )}
        </div>
        <footer className="uno-hand-zone" aria-label="أوراقك">
          <div className={cn("uno-me", myTurn && "is-active")}>
            <div className="uno-me__portrait">
              <Avatar player={me} />
              {myTurn && <TimerRing seconds={seconds} urgent={seconds <= 5} />}
            </div>
            <strong>{name(me)}</strong>
            <small className={myTurn ? "is-mine" : ""}>{myTurn ? "دورك" : "بانتظار دورك"}</small>
            <span>{hand.length} أوراق</span>
          </div>
          <div className="uno-hand-container">
            <div className="uno-sort">
              <button
                type="button"
                onClick={() => setSortOpen((value) => !value)}
                aria-expanded={sortOpen}
              >
                <ArrowDownUp />
                {SORT_LABELS[sort]}
              </button>
              {sortOpen && (
                <div className="uno-sort__menu">
                  {(Object.keys(SORT_LABELS) as SortOrder[]).map((order) => (
                    <button type="button" key={order} onClick={() => chooseSort(order)}>
                      {SORT_LABELS[order]}
                      {sort === order && <Check size={14} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="uno-hand-scroll">
              <div className="uno-hand">
                {orderedHand.map((card, index) => (
                  <Face
                    key={card.id}
                    card={card}
                    index={index}
                    total={hand.length}
                    playable={playable(card)}
                    selected={selected === card.id || data.drawnCardId === card.id}
                    onSelect={() => {
                      if (!playable(card)) return;
                      if (selected === card.id) {
                        if (card.color === "wild") setWild(card);
                        else {
                          void dispatch("uno-play", { cardId: card.id });
                          setSelected(null);
                        }
                      } else setSelected(card.id);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="uno-controls">
            <button
              type="button"
              className="uno-play-button"
              disabled={!selectedCard || !playable(selectedCard)}
              onClick={play}
            >
              <span>▶</span>العب
            </button>
            {canAct && data.drawnCardId && (
              <button
                type="button"
                className="uno-pass-button"
                onClick={() => void dispatch("uno-pass")}
              >
                <ChevronLeft />
                مرّر
              </button>
            )}
            <button
              type="button"
              className="uno-call-button"
              disabled={!canAct || hand.length > 2 || Boolean(data.unoCalled?.[me.id])}
              onClick={() => void dispatch("uno-call")}
            >
              UNO!
            </button>
          </div>
        </footer>
      </section>
      {wild && (
        <div
          className="uno-color-picker"
          role="dialog"
          aria-modal="true"
          aria-label="اختر اللون"
          onClick={() => setWild(null)}
        >
          <div className="uno-color-picker__panel" onClick={(event) => event.stopPropagation()}>
            <button className="uno-close" onClick={() => setWild(null)} aria-label="إغلاق">
              <X />
            </button>
            <h2>اختر اللون</h2>
            <p>باقي {seconds} ثانية من دورك</p>
            <div>
              {UNO_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  style={{ background: COLORS[c] }}
                  onClick={() => {
                    if (canAct) void dispatch("uno-play", { cardId: wild.id, color: c });
                    setWild(null);
                    setSelected(null);
                  }}
                >
                  {LABELS[c]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export function UnoResults({
  state,
  players,
  isHost,
  onRematch,
  onLobby,
}: {
  state: UnoRoomState;
  players: UnoPlayer[];
  isHost: boolean;
  onRematch: () => void;
  onLobby: () => void;
}) {
  const winner = players.find((player) => player.id === state.data.winnerId);
  return (
    <section className="uno-results" dir="rtl">
      <Trophy className="uno-results__trophy" />
      <small>الجولة {state.round + 1}</small>
      <h2>{winner ? `${name(winner)} فاز بالجولة!` : "انتهت الجولة"}</h2>
      <p>انتصارات الجلسة</p>
      <div className="uno-standings">
        {players
          .slice()
          .sort((a, b) => (state.scores?.[b.id] ?? 0) - (state.scores?.[a.id] ?? 0))
          .map((player) => (
            <div key={player.id}>
              <Avatar player={player} />
              <strong>{player.name}</strong>
              <b>{state.scores?.[player.id] ?? 0}</b>
            </div>
          ))}
      </div>
      {isHost ? (
        <div className="uno-results__actions">
          <button className="uno-play-button" onClick={onRematch}>
            <RotateCcw />
            جولة جديدة بنفس اللاعبين
          </button>
          <button className="uno-pass-button" onClick={onLobby}>
            <LogOut />
            العودة للغرفة
          </button>
        </div>
      ) : (
        <p>بانتظار المضيف لبدء الجولة التالية</p>
      )}
    </section>
  );
}
