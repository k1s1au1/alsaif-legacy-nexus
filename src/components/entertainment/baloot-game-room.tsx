import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  ArrowDownUp,
  BookOpen,
  Bot,
  Check,
  Eye,
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
import {
  BALOOT_BID_MS,
  BALOOT_PLAY_MS,
  BALOOT_SUITS,
  BALOOT_SUIT_LABEL,
  legalBalootCards,
  sortBalootHand,
  type BalootCard,
  type BalootData,
  type BalootPlayer,
} from "./baloot-engine";
import "./baloot-game-room.css";

type State = { round: number; data: Record<string, unknown> };
type Props = {
  state: State;
  players: BalootPlayer[];
  me: BalootPlayer;
  logoUrl?: string | null;
  immersive: boolean;
  connected: boolean;
  clockOffset: number;
  sound: boolean;
  reducedMotion: boolean;
  isHost: boolean;
  dispatch: (type: string, value?: Record<string, unknown>) => Promise<void>;
  onExit: () => void;
  onGuide: () => void;
  onSettings: () => void;
  onToggleSound: () => void;
  onFinish: () => void;
};
type Seat = "bottom" | "left" | "top" | "right";
const SEATS: Seat[] = ["bottom", "left", "top", "right"];
const SEAT_POINT = { bottom: [10, 78], left: [7, 46], top: [50, 18], right: [93, 46] };
const TRICK_POINT = { bottom: [50, 54], left: [38, 46.25], top: [50, 40], right: [62, 46.25] };
const shortName = (p?: BalootPlayer) =>
  p?.name
    .trim()
    .replace(/^بوت\s+/, "")
    .split(/\s+/)[0] || "اللاعب";
const contractLabel = (data: BalootData) =>
  data.contract?.mode === "sun"
    ? "صن"
    : data.contract?.trump
      ? `حكم ${BALOOT_SUIT_LABEL[data.contract.trump]}`
      : "الشراء";
const teamOf = (players: BalootPlayer[], id: string) =>
  Math.max(
    0,
    players.findIndex((p) => p.id === id),
  ) % 2;
function Avatar({ player }: { player: BalootPlayer }) {
  return (
    <span className="baloot-avatar">
      {player.avatarUrl ? (
        <img src={player.avatarUrl} alt="" />
      ) : (
        <span>{shortName(player)[0]}</span>
      )}
      {player.isBot && <Bot aria-label="لاعب آلي" />}
    </span>
  );
}
export function BalootCardFace({ card }: { card: BalootCard }) {
  const suit = { spades: "S", hearts: "H", diamonds: "D", clubs: "C" }[card.suit];
  const href = `/assets/games/baloot-deck.svg#card-${suit}-${card.rank}`;
  const red = card.suit === "hearts" || card.suit === "diamonds";
  return (
    <span
      className={cn("baloot-card-face", red && "is-red")}
      role="img"
      aria-label={`${card.rank} ${BALOOT_SUIT_LABEL[card.suit]}`}
      dir="ltr"
    >
      <svg viewBox="-120 -168 240 336" preserveAspectRatio="none" aria-hidden="true">
        <use href={href} xlinkHref={href} x="-120" y="-168" width="240" height="336" />
      </svg>
      <span className="baloot-card-index" aria-hidden="true">
        <b>{card.rank}</b>
        <i>{BALOOT_SUIT_LABEL[card.suit]}</i>
      </span>
      <span className="baloot-card-index baloot-card-index--bottom" aria-hidden="true">
        <b>{card.rank}</b>
        <i>{BALOOT_SUIT_LABEL[card.suit]}</i>
      </span>
    </span>
  );
}
function Backs({ count, seat }: { count: number; seat: Seat }) {
  return (
    <div
      className={cn("baloot-backs", `baloot-backs--${seat}`)}
      aria-label={`${count} أوراق مخفية`}
    >
      {Array.from({ length: count }, (_, i) => (
        <span className="baloot-back" key={i} aria-hidden="true">
          <i>✦</i>
        </span>
      ))}
    </div>
  );
}
function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
      }
      if (event.key === "Tab") {
        const buttons = Array.from(
          ref.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [],
        );
        const first = buttons[0],
          last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", keyboard, true);
    return () => {
      window.removeEventListener("keydown", keyboard, true);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div className="baloot-sheet-backdrop" onClick={onClose}>
      <div
        className="baloot-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h3>{title}</h3>
          <button onClick={onClose} aria-label="إغلاق">
            <X />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
function RoundSummary({
  data,
  players,
  myTeam,
}: {
  data: BalootData;
  players: BalootPlayer[];
  myTeam: number;
}) {
  const summary = data.roundSummary,
    otherTeam = 1 - myTeam;
  const buyer = players.find((p) => p.id === data.contract?.buyerId);
  return (
    <>
      <p className="baloot-round-contract">
        المشتري: {shortName(buyer)} · {contractLabel(data)}
        {summary && (
          <strong className={summary.buyerSucceeded ? "is-success" : "is-failure"}>
            {summary.buyerSucceeded ? "نجح المشترى" : "خسر المشترى"}
          </strong>
        )}
      </p>
      <table className="baloot-score-table">
        <thead>
          <tr>
            <th>حساب الجولة</th>
            <th>لنا</th>
            <th>لهم</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>الأكلات</th>
            <td>{data.teamTricks[myTeam]}</td>
            <td>{data.teamTricks[otherTeam]}</td>
          </tr>
          <tr>
            <th>أبناط الورق</th>
            <td>{summary?.rawPoints[myTeam] ?? data.rawPoints[myTeam]}</td>
            <td>{summary?.rawPoints[otherTeam] ?? data.rawPoints[otherTeam]}</td>
          </tr>
          {summary && (
            <tr>
              <th>قبل حساب المشترى</th>
              <td>{summary.beforePenalty[myTeam]}</td>
              <td>{summary.beforePenalty[otherTeam]}</td>
            </tr>
          )}
          <tr className="baloot-score-award">
            <th>نقاط الجولة</th>
            <td>+{data.roundPoints?.[myTeam] ?? 0}</td>
            <td>+{data.roundPoints?.[otherTeam] ?? 0}</td>
          </tr>
          <tr>
            <th>المجموع</th>
            <td>{data.matchScore[myTeam]}</td>
            <td>{data.matchScore[otherTeam]}</td>
          </tr>
        </tbody>
      </table>
      {summary && (
        <p className="baloot-round-note">
          أبناط الورق تشمل ١٠ لآخر أكلة ({summary.lastTrickTeam === myTeam ? "لنا" : "لهم"}).{" "}
          {summary.buyerSucceeded
            ? "احتفظ كل فريق بنقاطه."
            : "انتقلت نقاط الجولة كاملة للفريق المقابل للمشتري."}
        </p>
      )}
    </>
  );
}
export function BalootGameRoom({
  state,
  players,
  me,
  logoUrl,
  immersive,
  connected,
  clockOffset,
  sound,
  reducedMotion,
  isHost,
  dispatch,
  onExit,
  onGuide,
  onSettings,
  onToggleSound,
  onFinish,
}: Props) {
  const data = state.data as unknown as BalootData;
  const [now, setNow] = useState(() => Date.now());
  const [selection, setSelection] = useState<{
    id: string;
    round: number;
    sequence: number;
  } | null>(null);
  const [showLastTrick, setShowLastTrick] = useState(false);
  const closeLastTrick = useCallback(() => setShowLastTrick(false), []);
  const [sorted, setSorted] = useState(() => {
    try {
      return (
        typeof window === "undefined" || localStorage.getItem("alsaif-baloot-sort") !== "original"
      );
    } catch {
      return true;
    }
  });
  const eventRef = useRef(data.eventSequence);
  const turnRef = useRef(data.turnSequence);
  const myIndex = Math.max(
      0,
      players.findIndex((p) => p.id === me.id),
    ),
    myTeam = myIndex % 2;
  const seated = Array.from({ length: 4 }, (_, i) => players[(myIndex + i) % 4]).filter(Boolean);
  const hand = useMemo(
    () => sortBalootHand(data.hands[me.id] ?? [], data.contract, sorted),
    [data.hands, data.contract, me.id, sorted],
  );
  const active = players[data.stage === "bidding" ? data.bidTurnIndex : data.turnIndex];
  const legal = legalBalootCards(data, me.id);
  const adjustedNow = now + clockOffset,
    remaining = Math.max(0, Math.ceil(((data.turnDeadline ?? adjustedNow) - adjustedNow) / 1000));
  const myTurn = active?.id === me.id && !data.pendingTrick && data.stage !== "round-end";
  const canAct = myTurn && connected && remaining > 0;
  const selected =
    selection?.round === state.round && selection.sequence === data.turnSequence
      ? hand.find((c) => c.id === selection.id)
      : undefined;
  const canPlay = canAct && selected && legal.some((c) => c.id === selected.id);
  const seconds = data.stage === "bidding" ? BALOOT_BID_MS / 1000 : BALOOT_PLAY_MS / 1000;
  const collecting = !!data.pendingTrick && adjustedNow >= data.pendingTrick.resolveAt - 450;
  const winnerSeat = SEATS[seated.findIndex((p) => p.id === data.lastTrickWinnerId)] ?? "bottom";
  const lead = data.trick[0]?.card.suit;
  const mustFollow = lead && hand.some((c) => c.suit === lead);
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(tick);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("alsaif-baloot-sort", sorted ? "suit" : "original");
    } catch {
      /* Session-only sorting remains available. */
    }
  }, [sorted]);
  useEffect(() => {
    if (
      eventRef.current !== data.eventSequence &&
      sound &&
      data.event &&
      Date.now() + clockOffset - data.event.at < 2500
    )
      playGameSfx(data.event.card ? "play" : "move");
    eventRef.current = data.eventSequence;
    if (turnRef.current !== data.turnSequence && sound && connected && myTurn) playGameSfx("turn");
    turnRef.current = data.turnSequence;
  }, [clockOffset, connected, data.event, data.eventSequence, data.turnSequence, myTurn, sound]);
  const lastTrick = data.lastTrick;
  return (
    <section
      className={cn(
        "baloot-room",
        immersive && "baloot-room--immersive",
        reducedMotion && "baloot-reduced-motion",
      )}
      dir="rtl"
      aria-label="طاولة البلوت"
    >
      <div className="baloot-table-image" aria-hidden="true" />
      <div className="baloot-room-title">بلوت العائلة</div>
      <nav className="baloot-utilities" aria-label="خيارات اللعب">
        <button onClick={onToggleSound} aria-label={sound ? "كتم الصوت" : "تشغيل الصوت"}>
          {sound ? <Volume2 /> : <VolumeX />}
        </button>
        <button onClick={onGuide} aria-label="طريقة اللعب">
          <BookOpen />
        </button>
        <button onClick={onSettings} aria-label="إعدادات اللعب">
          <Settings2 />
        </button>
        <button onClick={onExit} aria-label="رجوع من وضع اللعبة">
          <LogOut />
        </button>
      </nav>
      <header className="baloot-hud">
        <div className="baloot-hud-team baloot-hud-team--ours">
          <span>
            لنا <b>{data.matchScore?.[myTeam] ?? 0}</b>
          </span>
          <small>الفوز {data.sessionWins?.[myTeam] ?? 0}</small>
        </div>
        <div className="baloot-hud-team baloot-hud-team--theirs">
          <span>
            لهم <b>{data.matchScore?.[1 - myTeam] ?? 0}</b>
          </span>
          <small>الفوز {data.sessionWins?.[1 - myTeam] ?? 0}</small>
        </div>
        <div>الجولة {data.matchRound ?? state.round + 1}</div>
        <div>{contractLabel(data)}</div>
        <div className="baloot-buyer">
          {data.stage === "bidding"
            ? `اللفة ${data.biddingRound === 1 ? "الأولى" : "الثانية"}`
            : `المشتري: ${shortName(players.find((p) => p.id === data.contract?.buyerId))}`}
        </div>
      </header>
      <div className="baloot-center-seal">
        {logoUrl ? <img src={logoUrl} alt="شعار العائلة" /> : <span>البلوت</span>}
      </div>
      {seated.map((p, i) => (
        <div
          key={p.id}
          className={cn(
            "baloot-seat",
            `baloot-seat--${SEATS[i]}`,
            teamOf(players, p.id) === myTeam ? "is-ours" : "is-theirs",
            active?.id === p.id && !data.pendingTrick && data.stage !== "round-end" && "is-active",
            p.connected === false && "is-disconnected",
          )}
          data-player-id={p.id}
        >
          <Avatar player={p} />
          <strong>{shortName(p)}</strong>
          <span className="baloot-seat-role">{i === 0 ? "أنت" : i === 2 ? "خويّك" : "خصم"}</span>
          {p.connected === false && (
            <span className="baloot-seat-offline">
              <WifiOff /> غير متصل
            </span>
          )}
        </div>
      ))}
      {seated.slice(1).map((p, i) => (
        <Backs key={p.id} count={data.hands[p.id]?.length ?? 0} seat={SEATS[i + 1]} />
      ))}
      {data.stage === "bidding" ? (
        <div className="baloot-buy-card">
          <BalootCardFace card={data.buyCard} />
          <strong>ورقة الشراء</strong>
          <span>{data.biddingRound === 1 ? "صن أو حكم بنوع المشترى" : "صن أو حكم بنوع مختلف"}</span>
        </div>
      ) : (
        <div className="baloot-trick" aria-label="أوراق الأكلة الحالية">
          {data.trick.map((play) => {
            const seat = SEATS[seated.findIndex((p) => p.id === play.playerId)] ?? "bottom";
            const [x, y] = TRICK_POINT[seat],
              [wx, wy] = SEAT_POINT[winnerSeat];
            const elapsed = Math.max(0, adjustedNow - (data.event?.at ?? 0));
            const arrives = data.event?.card?.id === play.card.id && elapsed < 600;
            return (
              <div
                key={`${state.round}:${play.card.id}`}
                className={cn("baloot-trick-slot", `baloot-trick-slot--${seat}`)}
                style={
                  {
                    "--take-x": `${wx - x}cqw`,
                    "--take-y": `${wy - y}cqh`,
                    "--arrive-x": `${SEAT_POINT[seat][0] - x}cqw`,
                    "--arrive-y": `${SEAT_POINT[seat][1] - y}cqh`,
                    "--arrival-delay": `${-elapsed}ms`,
                  } as CSSProperties
                }
              >
                <div
                  className={cn(
                    "baloot-play-card",
                    arrives && "is-arriving",
                    collecting && "is-collecting",
                  )}
                >
                  <BalootCardFace card={play.card} />
                </div>
                <small>{shortName(players.find((p) => p.id === play.playerId))}</small>
              </div>
            );
          })}
        </div>
      )}
      <p className="baloot-action-log" role="status">
        {data.lastAction}
      </p>
      <div className="baloot-hand" aria-label="أوراقك الخاصة" dir="ltr">
        {hand.map((card) => {
          const playable =
            canAct && data.stage === "playing" && legal.some((c) => c.id === card.id);
          return (
            <button
              type="button"
              key={card.id}
              className={cn(
                "baloot-hand-card",
                playable && "is-legal",
                selected?.id === card.id && "is-selected",
                canAct && data.stage === "playing" && !playable && "is-unavailable",
              )}
              aria-label={`${card.rank} ${BALOOT_SUIT_LABEL[card.suit]}${playable ? "، مسموحة" : ""}`}
              aria-pressed={selected?.id === card.id}
              disabled={!playable}
              onClick={() =>
                setSelection({ id: card.id, round: state.round, sequence: data.turnSequence })
              }
            >
              <BalootCardFace card={card} />
            </button>
          );
        })}
      </div>
      {data.stage !== "round-end" && (
        <footer
          className={cn("baloot-controls", data.stage === "bidding" && "baloot-controls--bidding")}
        >
          <div
            className={cn("baloot-timer", remaining <= 5 && !data.pendingTrick && "is-urgent")}
            role="timer"
            aria-label={data.pendingTrick ? "جمع الأكلة" : `الوقت المتبقي ${remaining} ثانية`}
            style={
              {
                "--time-progress": `${data.pendingTrick ? 100 : Math.min(100, (remaining / seconds) * 100)}%`,
              } as CSSProperties
            }
          >
            <span>
              {data.pendingTrick ? (
                <Check />
              ) : (
                `٠:${String(remaining)
                  .padStart(2, "0")
                  .replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)])}`
              )}
            </span>
          </div>
          <div className="baloot-turn-hint">
            <strong>
              {!connected
                ? "جارٍ استعادة الاتصال"
                : data.pendingTrick
                  ? `أكلة ${shortName(players.find((p) => p.id === data.lastTrickWinnerId))}`
                  : myTurn
                    ? data.stage === "bidding"
                      ? "قرارك في الشراء"
                      : "دورك"
                    : `دور ${shortName(active)}`}
            </strong>
            <span>
              {data.stage === "bidding"
                ? `${data.biddingRound === 1 ? "بس" : "ولا"} عند انتهاء الوقت`
                : mustFollow
                  ? `الزم النوع ${BALOOT_SUIT_LABEL[lead!]}`
                  : "اختر ورقة ثم العبها"}
            </span>
          </div>
          {data.stage === "bidding" ? (
            <div className="baloot-bid-actions">
              <button
                className="baloot-primary"
                disabled={!canAct}
                onClick={() => void dispatch("baloot-bid", { mode: "sun" })}
              >
                صن
              </button>
              {(data.biddingRound === 1
                ? [data.buyCard.suit]
                : BALOOT_SUITS.filter((s) => s !== data.buyCard.suit)
              ).map((suit) => (
                <button
                  key={suit}
                  className="baloot-secondary"
                  disabled={!canAct}
                  onClick={() => void dispatch("baloot-bid", { mode: "hokm", trump: suit })}
                >
                  حكم {BALOOT_SUIT_LABEL[suit]}
                </button>
              ))}
              <button
                className="baloot-secondary"
                disabled={!canAct}
                onClick={() => void dispatch("baloot-pass")}
              >
                {data.biddingRound === 1 ? "بس" : "ولا"}
              </button>
            </div>
          ) : (
            <button
              className="baloot-primary baloot-play-button"
              disabled={!canPlay}
              onClick={() => selected && void dispatch("baloot-play", { cardId: selected.id })}
            >
              العب الورقة
            </button>
          )}
          {data.stage !== "bidding" && (
            <button
              className="baloot-secondary baloot-last-trick-button"
              disabled={!lastTrick}
              onClick={() => setShowLastTrick(true)}
            >
              <Eye /> آخر أكلة
            </button>
          )}
          <button
            className="baloot-sort-button"
            onClick={() => setSorted((s) => !s)}
            aria-label={sorted ? "عرض ترتيب التوزيع" : "ترتيب حسب النوع"}
            aria-pressed={sorted}
            title={sorted ? "حسب النوع" : "ترتيب التوزيع"}
          >
            <ArrowDownUp />
            <span>{sorted ? "مرتّب" : "ترتيب"}</span>
          </button>
        </footer>
      )}
      {!connected && (
        <div className="baloot-connection-notice">
          <WifiOff /> نحفظ مقعدك وورقك، ونستعيد حالة الغرفة.
        </div>
      )}
      {showLastTrick && lastTrick && (
        <Sheet title="آخر أكلة" onClose={closeLastTrick}>
          <p className="baloot-last-trick-summary">
            أخذها {shortName(players.find((p) => p.id === lastTrick.winnerId))} ·{" "}
            {lastTrick.winningTeam === myTeam ? "لنا" : "لهم"} · {lastTrick.points} أبناط
          </p>
          <div className="baloot-last-trick-cards">
            {lastTrick.plays.map((play) => (
              <div
                key={play.playerId}
                className={cn(play.playerId === lastTrick.winnerId && "is-winner")}
              >
                <BalootCardFace card={play.card} />
                <strong>{shortName(players.find((p) => p.id === play.playerId))}</strong>
                {play.playerId === lastTrick.winnerId && <Trophy />}
              </div>
            ))}
          </div>
        </Sheet>
      )}
      {data.stage === "round-end" && (
        <div className="baloot-round-overlay">
          <div className="baloot-sheet baloot-round-sheet">
            <h3>
              <Trophy /> انتهت الجولة
            </h3>
            <RoundSummary data={data} players={players} myTeam={myTeam} />
            <div className="baloot-round-actions">
              {isHost ? (
                <>
                  <button
                    className="baloot-primary"
                    disabled={!connected}
                    onClick={() => void dispatch("baloot-next-round")}
                  >
                    <RotateCcw /> توزيع الجولة التالية
                  </button>
                  <button className="baloot-secondary" onClick={onFinish}>
                    إنهاء المباراة
                  </button>
                </>
              ) : (
                <p>بانتظار المضيف للتوزيع التالي</p>
              )}
              <button
                className="baloot-secondary"
                onClick={() => setShowLastTrick(true)}
                disabled={!lastTrick}
              >
                آخر أكلة
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
export function BalootResults({
  state,
  players,
  me,
  isHost,
  onRematch,
  onLobby,
}: {
  state: State;
  players: BalootPlayer[];
  me: BalootPlayer;
  isHost: boolean;
  onRematch: () => void;
  onLobby: () => void;
}) {
  const data = state.data as unknown as BalootData,
    myTeam = teamOf(players, me.id);
  return (
    <section className="baloot-results" dir="rtl">
      <div className="baloot-results-panel">
        <Trophy className="baloot-results-trophy" />
        <h2>
          {data.matchWinnerTeam == null
            ? "انتهت المباراة"
            : data.matchWinnerTeam === myTeam
              ? "فاز فريقكم!"
              : "فاز الفريق المقابل"}
        </h2>
        <div className="baloot-result-teams">
          {[myTeam, 1 - myTeam].map((team, i) => (
            <div key={team} className={cn(data.matchWinnerTeam === team && "is-winner")}>
              <h3>{i === 0 ? "لنا" : "لهم"}</h3>
              <p>
                {players
                  .filter((_, j) => j % 2 === team)
                  .map(shortName)
                  .join(" + ")}
              </p>
              <strong>{data.matchScore?.[team] ?? 0}</strong>
              <span>الفوز في الجلسة: {data.sessionWins?.[team] ?? 0}</span>
            </div>
          ))}
        </div>
        {data.roundSummary && <RoundSummary data={data} players={players} myTeam={myTeam} />}
        <div className="baloot-round-actions">
          {isHost ? (
            <>
              <button className="baloot-primary" onClick={onRematch}>
                <RotateCcw /> مباراة جديدة بنفس الفرق
              </button>
              <button className="baloot-secondary" onClick={onLobby}>
                غرفة الانتظار
              </button>
            </>
          ) : (
            <p>بانتظار المضيف لبدء المباراة التالية بنفس الفرق</p>
          )}
        </div>
      </div>
    </section>
  );
}
