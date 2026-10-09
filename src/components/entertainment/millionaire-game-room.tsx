import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  BookOpen,
  Building2,
  Castle,
  Coins,
  Crown,
  Dices,
  Flag,
  Gift,
  Hammer,
  Landmark,
  LogOut,
  MapPin,
  Navigation,
  Plane,
  RotateCw,
  Settings2,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  WalletCards,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MILLIONAIRE_BOARD, type MillionaireSpaceKind } from "./millionaire-board";
import { monopolyStructureTotal, monopolyToll, monopolyUpgradeCost } from "./millionaire-engine";
import {
  MILLIONAIRE_COLORS as COLORS,
  MILLIONAIRE_LEVELS as LEVELS,
  millionaireCash as cash,
  millionaireCell,
  millionairePoint,
  millionaireThrowSeat,
  millionaireInvestment,
  millionairePropertyAt as propertyAt,
  type MillionaireData,
  type MillionairePlayerView,
} from "./millionaire-presentation";
import {
  MillionairePawn,
  MiniatureBuilding,
  OwnershipFlag,
  PhysicalDice,
} from "./millionaire-pieces";
import { useMillionaireScene } from "./use-millionaire-scene";
import "./millionaire-game-room.css";

export { MILLIONAIRE_BOARD } from "./millionaire-board";
export type { MillionaireSpace, MillionaireSpaceKind } from "./millionaire-board";

type Props = {
  state: { data: MillionaireData };
  players: MillionairePlayerView[];
  me: MillionairePlayerView;
  immersive: boolean;
  dispatch: (type: string, value?: unknown) => Promise<void>;
  onExit: () => void;
  onGuide: () => void;
  onSettings: () => void;
  sound?: boolean;
  reducedMotion?: boolean;
  onToggleSound?: () => void;
};

function label(player: MillionairePlayerView, players: MillionairePlayerView[]) {
  const first = player.name.trim().split(/\s+/)[0] || "لاعب";
  return players.filter((item) => item.name.trim().split(/\s+/)[0] === first).length > 1
    ? first + " " + (players.findIndex((item) => item.id === player.id) + 1)
    : first;
}

function SpaceIcon({ kind }: { kind: MillionaireSpaceKind }) {
  const Icon =
    kind === "start"
      ? Trophy
      : kind === "chance"
        ? Gift
        : kind === "island"
          ? Castle
          : kind === "travel"
            ? Plane
            : kind === "festival"
              ? Sparkles
              : kind === "tourism"
                ? Landmark
                : Building2;
  return <Icon />;
}

function AnimatedCash({ value, reducedMotion }: { value: number; reducedMotion: boolean }) {
  const last = useRef(value);
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const from = last.current;
    last.current = value;
    if (reducedMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    let frame = 0;
    let start = 0;
    const animate = (now: number) => {
      start ||= now;
      const progress = Math.min(1, (now - start) / 650);
      setShown(Math.round(from + (value - from) * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value, reducedMotion]);
  return <b dir="ltr">{cash(shown)}</b>;
}

export function MillionaireDialog({
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
    const restore = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => restore?.focus();
  }, []);
  return (
    <div className="millionaire-modal" onClick={onClose}>
      <div
        ref={ref}
        className="millionaire-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
          if (event.key !== "Tab") return;
          const focusable = Array.from(
            ref.current?.querySelectorAll<HTMLElement>(
              "button:not(:disabled),select,a[href],input",
            ) ?? [],
          );
          const first = focusable[0],
            last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          }
          if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <header>
          <h2>{title}</h2>
          <button type="button" aria-label="إغلاق النافذة" onClick={onClose}>
            <X />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

function CashTransfers({
  deltas,
  root,
  cards,
  reducedMotion,
}: {
  deltas: Record<string, number>;
  root: HTMLDivElement | null;
  cards: Record<string, HTMLElement | null>;
  reducedMotion: boolean;
}) {
  const [flights, setFlights] = useState<
    Array<{ id: string; sx: number; sy: number; dx: number; dy: number }>
  >([]);
  useLayoutEffect(() => {
    if (!root || reducedMotion) {
      setFlights([]);
      return;
    }
    const bounds = root.getBoundingClientRect();
    const center = { x: bounds.width * 0.52, y: bounds.height * 0.5 };
    const point = (id: string) => {
      const box = cards[id]?.getBoundingClientRect();
      return box
        ? {
            x: box.left - bounds.left + box.width * 0.5,
            y: box.top - bounds.top + box.height * 0.5,
          }
        : center;
    };
    const payer = Object.keys(deltas).find((id) => deltas[id] < 0);
    const recipients = Object.keys(deltas).filter((id) => deltas[id] > 0);
    setFlights(
      (recipients.length ? recipients : payer ? [payer] : []).map((id) => {
        const from =
          recipients.length && payer ? point(payer) : recipients.length ? center : point(id);
        const to = recipients.length ? point(id) : center;
        return { id, sx: from.x, sy: from.y, dx: to.x - from.x, dy: to.y - from.y };
      }),
    );
  }, [deltas, root, cards, reducedMotion]);
  return (
    <div className="millionaire-cash-flights" aria-hidden="true">
      {flights.flatMap((flight) =>
        [0, 1, 2, 3].map((index) => (
          <i
            key={flight.id + index}
            style={
              {
                left: flight.sx,
                top: flight.sy,
                "--coin-x": flight.dx + "px",
                "--coin-y": flight.dy + "px",
                animationDelay: index * 65 + "ms",
              } as CSSProperties
            }
          >
            ✦
          </i>
        )),
      )}
    </div>
  );
}

const SPECIAL_COPY: Record<string, string> = {
  start: "تمر من هنا وتستلم مكافأة 300K من البنك.",
  chance: "اسحب بطاقة فرصة: مكافأة أو رسوم أو سفر أو مهرجان.",
  island: "اخرج بالنرد المزدوج، أو ادفع 150K، أو استخدم بطاقة خروج.",
  travel: "اختر أي مدينة أو موقع سياحي للسفر إليه مباشرة.",
  festival: "اختر أحد أملاكك لمضاعفة رسوم زيارته لدورة كاملة.",
};

export function MillionaireGameRoom({
  state,
  players,
  me,
  immersive,
  dispatch,
  onExit,
  onGuide,
  onSettings,
  sound = true,
  reducedMotion = false,
  onToggleSound,
}: Props) {
  const data = state.data ?? {};
  const [localSound, setLocalSound] = useState(sound);
  const audible = onToggleSound ? sound : localSound;
  const scene = useMillionaireScene(data, audible, reducedMotion);
  const [selectedSpace, setSelectedSpace] = useState<number | null>(null);
  const [previewSpace, setPreviewSpace] = useState<number | null>(null);
  const [assetsPlayer, setAssetsPlayer] = useState<string | null>(null);
  const [highlightPlayer, setHighlightPlayer] = useState(me.id);
  const [reviewChance, setReviewChance] = useState(false);
  const [level, setLevel] = useState(1);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [confirmBankrupt, setConfirmBankrupt] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const playerCards = useRef<Record<string, HTMLElement | null>>({});
  const [boardSize, setBoardSize] = useState(520);
  const viewerSeat =
    Math.max(
      0,
      players.findIndex((player) => player.id === me.id),
    ) % 4;
  const activeIndex = Number(data.turnIndex ?? 0) % Math.max(1, players.length);
  const activePlayer = players[activeIndex] ?? me;
  const activeName = label(activePlayer, players);
  const isMyTurn = activePlayer.id === me.id && !data.bankrupt?.[me.id];
  const pending = data.pending;
  const pendingForMe = isMyTurn && pending?.playerId === me.id;
  const pendingIndex = Number(pending?.spaceIndex ?? -1);
  const decisionSpace = MILLIONAIRE_BOARD[pendingIndex];
  const activePosition = scene.positions[activePlayer.id] ?? data.positions?.[activePlayer.id] ?? 0;
  const inspectIndex = selectedSpace ?? (pendingIndex >= 0 ? pendingIndex : activePosition);
  const inspect = MILLIONAIRE_BOARD[inspectIndex] ?? MILLIONAIRE_BOARD[0];
  const inspectProperty = propertyAt(scene.visual, inspectIndex);
  const ownerIndex = players.findIndex((player) => player.id === inspectProperty?.ownerId);
  const owner = players[ownerIndex];
  const ownable = inspect.kind === "city" || inspect.kind === "tourism";
  const myCash = Number(data.cash?.[me.id] ?? 5000);
  const canAct = !scene.busy && !sending && isMyTurn;
  const dice = data.roll?.dice ?? data.dice ?? [1, 1];
  const rollingSeat = players.findIndex(
    (player) => player.id === (data.roll?.playerId ?? activePlayer.id),
  );
  const throwSeat = millionaireThrowSeat(Math.max(0, rollingSeat), viewerSeat);
  const movement = scene.journey.movement;
  const movingPlayer = players.find((player) => player.id === movement?.playerId);
  const path = movement?.steps.slice(0, scene.journey.step) ?? [];
  const focus = scene.cameraFocus === null ? null : millionairePoint(scene.cameraFocus, viewerSeat);
  const options =
    pendingForMe && (pending?.type === "buy" || pending?.type === "upgrade") && decisionSpace
      ? [1, 2, 3, 4].filter((target) => {
          if (decisionSpace.kind === "tourism")
            return target === 1 && pending.type === "buy" && decisionSpace.price <= myCash;
          if (pending.type === "buy" && target === 4) return false;
          const current = pending.type === "upgrade" ? Number(pending.currentLevel ?? 1) : 0;
          const cost =
            pending.type === "buy"
              ? monopolyStructureTotal(pendingIndex, target)
              : monopolyUpgradeCost(pendingIndex, current, target);
          return target > current && cost <= myCash;
        })
      : [];
  const chosenLevel = options.includes(level) ? level : options[0];
  const cost =
    pending?.type === "buy"
      ? monopolyStructureTotal(pendingIndex, chosenLevel ?? 1)
      : monopolyUpgradeCost(pendingIndex, Number(pending?.currentLevel ?? 1), chosenLevel ?? 1);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const resize = () =>
      setBoardSize(Math.max(150, Math.min(stage.clientWidth - 12, stage.clientHeight - 8)));
    resize();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(stage);
    window.addEventListener("resize", resize);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);
  useEffect(() => {
    setLevel(1);
    setError("");
  }, [pending?.type, pendingIndex]);
  useEffect(() => {
    if (scene.phase === "rolling") setSelectedSpace(null);
  }, [scene.phase]);
  const perform = async (type: string, value?: unknown) => {
    if (sending || scene.busy) return;
    setSending(true);
    setError("");
    try {
      await dispatch(type, value);
    } catch {
      setError("تعذر إرسال الحركة. حاول مرة أخرى.");
    } finally {
      setSending(false);
    }
  };
  const inspectLocation = (index: number) => {
    setSelectedSpace(index);
    setAssetsPlayer(null);
  };
  const viewAssets = players.find((player) => player.id === assetsPlayer) ?? me;
  const assets = MILLIONAIRE_BOARD.map((space, index) => ({
    space,
    index,
    property: propertyAt(data, index),
  })).filter((item) => item.property?.ownerId === viewAssets.id);

  const decisions =
    pendingForMe && pending ? (
      <div className="millionaire-decisions" aria-label="قرار الدور" aria-live="polite">
        <div className="millionaire-decision-title">
          <span>قرارك الآن</span>
          <strong>
            {pending.type === "buy"
              ? "شراء " + decisionSpace?.name
              : pending.type === "upgrade"
                ? "تطوير " + decisionSpace?.name
                : pending.type === "takeover"
                  ? "استحواذ على " + decisionSpace?.name
                  : pending.type === "travel"
                    ? "اختر وجهتك"
                    : pending.type === "festival"
                      ? "اختر مدينة المهرجان"
                      : "سدّد الالتزام المالي"}
          </strong>
        </div>
        {scene.busy ? (
          <p className="millionaire-decision-wait">يظهر القرار بعد اكتمال الحركة…</p>
        ) : (
          <>
            {(pending.type === "buy" || pending.type === "upgrade") && (
              <>
                <div className="millionaire-levels" role="group" aria-label="مستوى التطوير">
                  {options.map((target) => (
                    <button
                      type="button"
                      key={target}
                      aria-label={decisionSpace?.kind === "tourism" ? "موقع سياحي" : LEVELS[target]}
                      aria-pressed={chosenLevel === target}
                      onClick={() => setLevel(target)}
                    >
                      <MiniatureBuilding level={target} space={decisionSpace} />
                      <span>
                        {decisionSpace?.kind === "tourism" ? "موقع سياحي" : LEVELS[target]}
                      </span>
                    </button>
                  ))}
                </div>
                {options.length ? (
                  <button
                    type="button"
                    className="millionaire-primary"
                    disabled={!canAct}
                    onClick={() =>
                      void perform(pending.type === "buy" ? "monopoly-buy" : "monopoly-upgrade", {
                        level: chosenLevel,
                      })
                    }
                  >
                    <Hammer /> {pending.type === "buy" ? "شراء" : "تطوير"}{" "}
                    <b dir="ltr">{cash(cost)}</b>
                  </button>
                ) : (
                  <p>رصيدك لا يكفي للاستثمار في هذا الموقع.</p>
                )}
              </>
            )}
            {pending.type === "takeover" && (
              <>
                <p>دفعت رسوم الزيارة. يمكنك شراء الموقع من مالكه قبل تطويره إلى مَعْلم.</p>
                <button
                  type="button"
                  className="millionaire-primary"
                  disabled={!canAct || myCash < Number(pending.cost)}
                  onClick={() => void perform("monopoly-takeover")}
                >
                  <Flag /> استحواذ <b dir="ltr">{cash(Number(pending.cost))}</b>
                </button>
              </>
            )}
            {(pending.type === "travel" || pending.type === "festival") && (
              <div className="millionaire-destinations">
                {MILLIONAIRE_BOARD.map((space, index) => {
                  const allowed =
                    pending.type === "travel"
                      ? space.kind === "city" || space.kind === "tourism"
                      : propertyAt(data, index)?.ownerId === me.id;
                  return allowed ? (
                    <button
                      type="button"
                      key={index}
                      disabled={!canAct}
                      onMouseEnter={() => setPreviewSpace(index)}
                      onFocus={() => setPreviewSpace(index)}
                      onMouseLeave={() => setPreviewSpace(null)}
                      onBlur={() => setPreviewSpace(null)}
                      onClick={() => {
                        setPreviewSpace(null);
                        setSelectedSpace(null);
                        void perform(
                          pending.type === "travel" ? "monopoly-travel" : "monopoly-festival",
                          { spaceIndex: index },
                        );
                      }}
                    >
                      <MapPin />
                      {space.name}
                    </button>
                  ) : null;
                })}
              </div>
            )}
            {pending.type === "debt" && (
              <>
                <p>{pending.reason}</p>
                <p>
                  المطلوب <b dir="ltr">{cash(Number(pending.amount))}</b> · رصيدك{" "}
                  <b dir="ltr">{cash(myCash)}</b>
                </p>
                <button
                  type="button"
                  className="millionaire-primary"
                  disabled={!canAct || myCash < Number(pending.amount)}
                  onClick={() => void perform("monopoly-pay-debt")}
                >
                  <Coins /> سداد كامل
                </button>
                <button
                  type="button"
                  className="millionaire-secondary"
                  onClick={() => setAssetsPlayer(me.id)}
                >
                  <WalletCards /> بيع بعض أملاكك
                </button>
                <button
                  type="button"
                  className="millionaire-danger-text"
                  disabled={!canAct}
                  onClick={() => setConfirmBankrupt(true)}
                >
                  إعلان الإفلاس
                </button>
              </>
            )}
            {pending.type !== "debt" && (
              <button
                type="button"
                className="millionaire-secondary"
                disabled={!canAct}
                onClick={() => void perform("monopoly-decline")}
              >
                {pending.type === "travel"
                  ? "البقاء هنا"
                  : pending.type === "festival"
                    ? "تجاوز المهرجان"
                    : "تجاوز"}
              </button>
            )}
          </>
        )}
      </div>
    ) : null;

  return (
    <div
      ref={rootRef}
      className={cn(
        "millionaire-table",
        immersive ? "is-immersive" : "is-embedded",
        reducedMotion && "is-reduced-motion",
      )}
      dir="rtl"
      aria-label="رحلة المليونير"
      data-viewer-seat={viewerSeat}
      data-phase={scene.phase}
    >
      <div className="millionaire-phone-rotate">
        <RotateCw />
        <h2>لف الجوال للوضع الأفقي</h2>
        <p>عشان تشوف الطاولة كاملة من جهة جلوسك.</p>
        <button type="button" onClick={onExit}>
          رجوع
        </button>
      </div>
      <header className="millionaire-table-header">
        <div className="millionaire-title">
          <h1>رحلة المليونير</h1>
          <p>استكشف مدن المملكة… واصنع ثروتك</p>
        </div>
        <div className="millionaire-turn-pill">
          <i style={{ background: COLORS[activeIndex % 4] }} />
          <span>{isMyTurn ? "دورك الآن" : "دور " + activeName}</span>
          <small>الجولة {data.turnNumber ?? 1}</small>
        </div>
        <nav className="millionaire-table-tools" aria-label="أدوات اللعبة">
          <button
            type="button"
            aria-label={audible ? "كتم الصوت" : "تشغيل الصوت"}
            aria-pressed={audible}
            onClick={onToggleSound ?? (() => setLocalSound((value) => !value))}
          >
            {audible ? <Volume2 /> : <VolumeX />}
          </button>
          <button type="button" aria-label="طريقة اللعب" onClick={onGuide}>
            <BookOpen />
          </button>
          <button type="button" aria-label="إعدادات اللعب" onClick={onSettings}>
            <Settings2 />
          </button>
          <button
            type="button"
            className="is-exit"
            aria-label="الخروج من وضع اللعبة"
            onClick={onExit}
          >
            <LogOut />
            <span>خروج</span>
          </button>
        </nav>
      </header>

      <div className="millionaire-table-layout">
        <aside className="millionaire-inspector" aria-label="تفاصيل الموقع">
          {selectedSpace !== null && (
            <button
              type="button"
              className="millionaire-inspector-close"
              aria-label="العودة إلى محطة الدور"
              onClick={() => setSelectedSpace(null)}
            >
              <X />
            </button>
          )}
          <div className={"millionaire-inspector-art kind-" + inspect.kind}>
            {ownable ? (
              <MiniatureBuilding
                space={inspect}
                level={inspectProperty?.level ?? (inspect.kind === "tourism" ? 4 : 1)}
              />
            ) : (
              <SpaceIcon kind={inspect.kind} />
            )}
            <span>
              {inspect.landmark ?? (inspect.kind === "city" ? "مدينة استثمارية" : "محطة خاصة")}
            </span>
          </div>
          <div className="millionaire-inspector-body">
            <small>{selectedSpace !== null ? "تفاصيل الموقع المحدد" : "محطة الدور"}</small>
            <h2>{inspect.name}</h2>
            <div
              className={cn("millionaire-owner-label", owner && "is-owned")}
              style={{ "--owner-color": COLORS[Math.max(0, ownerIndex) % 4] } as CSSProperties}
            >
              {owner ? (
                <>
                  <Flag /> ملك {label(owner, players)} · {ownerIndex + 1}
                </>
              ) : ownable ? (
                "متاحة للشراء"
              ) : (
                "محطة خاصة"
              )}
            </div>
            {ownable ? (
              <dl className="millionaire-property-numbers">
                <div>
                  <dt>سعر الشراء</dt>
                  <dd dir="ltr">{cash(inspect.price)}</dd>
                </div>
                <div>
                  <dt>{inspectProperty ? "رسوم الزيارة الحالية" : "رسوم الزيارة الأساسية"}</dt>
                  <dd dir="ltr">
                    {cash(
                      inspectProperty ? monopolyToll(scene.visual, inspectIndex) : inspect.rent,
                    )}
                  </dd>
                </div>
                {inspectProperty && (
                  <div>
                    <dt>مستوى التطوير</dt>
                    <dd>
                      {inspect.kind === "tourism"
                        ? "موقع سياحي"
                        : LEVELS[Math.min(4, inspectProperty.level)]}
                    </dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="millionaire-special-copy">{SPECIAL_COPY[inspect.kind]}</p>
            )}
            {data.festival?.spaceIndex === inspectIndex &&
              Number(data.turnNumber) <= data.festival.untilTurn && (
                <p className="millionaire-festival-label">
                  <Sparkles /> مهرجان · الرسوم مضاعفة
                </p>
              )}
            {decisions}
            {!pendingForMe && (
              <div className="millionaire-inspector-hint">
                <MapPin />
                <p>اضغط أي أرض لمعرفة مالكها وتطويرها ورسومها.</p>
              </div>
            )}
            {error && (
              <p className="millionaire-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </aside>

        <div ref={stageRef} className="millionaire-stage">
          <div className="millionaire-view-label">
            <Navigation /> منظورك · {label(me, players)}{" "}
            <i style={{ background: COLORS[viewerSeat] }} />
          </div>
          <div
            className="millionaire-board-camera"
            style={
              {
                "--board-size": boardSize + "px",
                "--camera-scale": focus ? 1.055 : 1,
                "--camera-x": focus ? (50 - focus.x) * 0.045 + "%" : "0%",
                "--camera-y": focus ? (50 - focus.y) * 0.045 + "%" : "0%",
              } as CSSProperties
            }
          >
            <div className="millionaire-luxury-board" aria-label="لوحة رحلة المليونير">
              <div className="millionaire-board-terrain" aria-hidden="true">
                <img
                  src="/assets/games/millionaire-terrain.webp"
                  alt=""
                  style={{ transform: "rotate(" + -viewerSeat * 90 + "deg)" }}
                />
              </div>
              <div className="millionaire-board-grid">
                {MILLIONAIRE_BOARD.map((space, index) => {
                  const [row, column] = millionaireCell(index, viewerSeat);
                  const property = propertyAt(scene.visual, index);
                  const ownerSeat = players.findIndex((player) => player.id === property?.ownerId);
                  const occupants = players.filter(
                    (player) =>
                      !data.bankrupt?.[player.id] && (scene.positions[player.id] ?? 0) === index,
                  );
                  const propertyName = ownerSeat >= 0 ? label(players[ownerSeat], players) : "لاعب";
                  const routeStep = movement?.steps.indexOf(index) ?? -1;
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSelectedSpace(index)}
                      className={cn(
                        "millionaire-tile",
                        "kind-" + space.kind,
                        property && "is-owned",
                        (selectedSpace === index || previewSpace === index) && "is-selected",
                        occupants.some((player) => player.id === activePlayer.id) &&
                          "is-active-location",
                        path.includes(index) && "is-traversed",
                        scene.buildings.includes(index) && "is-building",
                        property?.ownerId === highlightPlayer && "is-highlighted-property",
                        data.festival?.spaceIndex === index && "has-festival",
                      )}
                      style={
                        {
                          gridRow: row + 1,
                          gridColumn: column + 1,
                          "--city-color": space.color,
                          "--owner-color": COLORS[Math.max(0, ownerSeat) % 4],
                          "--route-color":
                            COLORS[
                              Math.max(
                                0,
                                players.findIndex((player) => player.id === movement?.playerId),
                              ) % 4
                            ],
                        } as CSSProperties
                      }
                      aria-label={
                        space.name +
                        "، " +
                        (property
                          ? "ملك " +
                            propertyName +
                            "، " +
                            (space.kind === "tourism"
                              ? "موقع سياحي"
                              : LEVELS[Math.min(4, property.level)])
                          : space.price
                            ? "متاحة للشراء، " + cash(space.price)
                            : "محطة خاصة") +
                        (occupants.length
                          ? "، هنا " + occupants.map((player) => label(player, players)).join(" و")
                          : "")
                      }
                      aria-pressed={selectedSpace === index}
                      data-space-index={index}
                      data-owner-id={property?.ownerId ?? ""}
                      data-view-row={row}
                      data-view-column={column}
                    >
                      <i className="millionaire-tile-band" />
                      <span className="millionaire-tile-plot" aria-hidden="true">
                        {space.price ? (
                          <MiniatureBuilding space={space} level={property?.level ?? 0} />
                        ) : (
                          <SpaceIcon kind={space.kind} />
                        )}
                        {property && ownerSeat >= 0 && (
                          <OwnershipFlag color={COLORS[ownerSeat % 4]} number={ownerSeat + 1} />
                        )}
                        {data.festival?.spaceIndex === index && (
                          <Sparkles className="millionaire-tile-festival" />
                        )}
                      </span>
                      <strong>{space.name}</strong>
                      {space.price > 0 && <small dir="ltr">{cash(space.price)}</small>}
                      {routeStep >= 0 && scene.phase === "moving" && (
                        <b className="millionaire-step-badge">{routeStep + 1}</b>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="millionaire-center">
                <div className="millionaire-center-brand">
                  <span>رحلة</span>
                  <strong>المليونير</strong>
                  <small>من أرضنا تبدأ الرحلة</small>
                </div>
                <div
                  className="millionaire-dice-area"
                  data-throw-seat={throwSeat}
                  aria-label={
                    scene.phase === "rolling"
                      ? "النرد يُرمى بالمنتصف"
                      : "نتيجة النرد " + dice[0] + " و" + dice[1]
                  }
                >
                  <PhysicalDice
                    key={"a" + (data.roll?.sequence ?? 0)}
                    value={dice[0]}
                    rolling={scene.phase === "rolling"}
                    index={0}
                    viewerSeat={viewerSeat}
                  />
                  <PhysicalDice
                    key={"b" + (data.roll?.sequence ?? 0)}
                    value={dice[1]}
                    rolling={scene.phase === "rolling"}
                    index={1}
                    viewerSeat={viewerSeat}
                  />
                </div>
                <button
                  type="button"
                  className="millionaire-chance-deck"
                  disabled={!data.chance || scene.busy}
                  onClick={() => setReviewChance(true)}
                  aria-label="قراءة آخر بطاقة فرصة"
                >
                  <Gift />
                  <span>بطاقات الفرصة</span>
                </button>
              </div>
              {players
                .filter((player) => !data.bankrupt?.[player.id])
                .map((player) => {
                  const seat = players.findIndex((item) => item.id === player.id);
                  const position = scene.positions[player.id] ?? 0;
                  const point = millionairePoint(position, viewerSeat);
                  const same = players.filter(
                    (item) =>
                      !data.bankrupt?.[item.id] && (scene.positions[item.id] ?? 0) === position,
                  );
                  const slot = same.findIndex((item) => item.id === player.id);
                  const x = point.x + (same.length > 1 ? (slot % 2 ? 1 : -1) * 2.1 : 0);
                  const y = point.y + (same.length > 2 ? (slot < 2 ? -1 : 1) * 1.7 : 0);
                  return (
                    <button
                      key={player.id}
                      type="button"
                      className={cn(
                        "millionaire-board-pawn",
                        player.id === me.id && "is-me",
                        scene.phase === "moving" &&
                          movement?.playerId === player.id &&
                          "is-walking",
                      )}
                      style={
                        {
                          left: x + "%",
                          top: y + "%",
                          "--pawn-color": COLORS[seat % 4],
                        } as CSSProperties
                      }
                      onClick={() => {
                        setHighlightPlayer(player.id);
                        setSelectedSpace(position);
                      }}
                      aria-label={
                        "قطعة " +
                        label(player, players) +
                        " في " +
                        MILLIONAIRE_BOARD[position]?.name
                      }
                      data-player-id={player.id}
                      data-position={position}
                    >
                      {player.id === me.id && <span>أنت</span>}
                      <MillionairePawn color={COLORS[seat % 4]} number={seat + 1} />
                    </button>
                  );
                })}
            </div>
          </div>
          {scene.chance && (
            <div className="millionaire-card-draw" role="status" aria-live="polite">
              <div className={cn("millionaire-chance-card", scene.chanceRevealed && "is-revealed")}>
                <div className="millionaire-chance-back">
                  <Gift />
                  <strong>فرصة</strong>
                </div>
                <div className="millionaire-chance-front">
                  <Sparkles />
                  <small>
                    {players.find((player) => player.id === scene.chance?.playerId)?.name}
                  </small>
                  <h2>{scene.chance.title}</h2>
                  <p>{scene.chance.description}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <aside
          className="millionaire-player-rail"
          aria-label="اللاعبون وأملاكهم"
          style={{ "--player-count": Math.min(4, players.length) } as CSSProperties}
        >
          {players.slice(0, 4).map((player, index) => {
            const amount = Number(scene.visual.cash?.[player.id] ?? 5000);
            const position = scene.positions[player.id] ?? 0;
            const count = MILLIONAIRE_BOARD.filter(
              (_, i) => propertyAt(scene.visual, i)?.ownerId === player.id,
            ).length;
            const delta = scene.deltas[player.id];
            return (
              <article
                key={player.id}
                ref={(element) => {
                  playerCards.current[player.id] = element;
                }}
                className={cn(
                  "millionaire-player-card",
                  activePlayer.id === player.id && "is-active",
                  player.id === me.id && "is-me",
                  data.bankrupt?.[player.id] && "is-bankrupt",
                )}
                style={{ "--player-color": COLORS[index % 4] } as CSSProperties}
                data-player-id={player.id}
              >
                <div className="millionaire-player-head">
                  <b className="millionaire-seat-number">{index + 1}</b>
                  <div>
                    <strong>
                      {label(player, players)} {player.isHost && <Crown />}
                    </strong>
                    <small>
                      {player.id === me.id
                        ? "أنت"
                        : player.isBot
                          ? "بوت"
                          : activePlayer.id === player.id
                            ? "يلعب الآن"
                            : "على الطاولة"}
                    </small>
                  </div>
                  {player.avatarUrl && (
                    <img src={player.avatarUrl} alt="" referrerPolicy="no-referrer" />
                  )}
                </div>
                <div className="millionaire-player-balance">
                  <Coins />
                  <AnimatedCash value={amount} reducedMotion={reducedMotion} />
                  {delta && (
                    <mark className={delta > 0 ? "is-gain" : "is-loss"} dir="ltr">
                      {delta > 0 ? "+" : "−"}
                      {cash(Math.abs(delta))}
                    </mark>
                  )}
                </div>
                <div className="millionaire-player-wealth">
                  الثروة{" "}
                  <b dir="ltr">{cash(amount + millionaireInvestment(scene.visual, player.id))}</b>
                </div>
                <button
                  type="button"
                  className="millionaire-player-location"
                  disabled={Boolean(data.bankrupt?.[player.id])}
                  onClick={() => {
                    setHighlightPlayer(player.id);
                    setSelectedSpace(position);
                  }}
                >
                  <MapPin />
                  {data.bankrupt?.[player.id]
                    ? "خرج من الرحلة"
                    : Number(data.jailTurns?.[player.id]) > 0
                      ? "في الجزيرة"
                      : MILLIONAIRE_BOARD[position]?.name}
                </button>
                <button
                  type="button"
                  className="millionaire-player-assets"
                  onClick={() => {
                    setHighlightPlayer(player.id);
                    setAssetsPlayer(player.id);
                  }}
                >
                  <Landmark /> {count} عقارات <ArrowLeft />
                </button>
              </article>
            );
          })}
        </aside>
      </div>

      <footer className="millionaire-table-footer">
        <div className="millionaire-journey-status" role="status" aria-live="polite">
          <strong>
            {scene.phase === "rolling"
              ? activeName + " يرمي النرد…"
              : scene.phase === "moving" && movingPlayer
                ? label(movingPlayer, players) + " يتحرك…"
                : isMyTurn
                  ? "دورك الآن"
                  : "الدور عند " + activeName}
          </strong>
          <span>
            {movement && movingPlayer
              ? (scene.phase === "ready" ? "آخر حركة: " : "") +
                MILLIONAIRE_BOARD[movement.from]?.name +
                " ← " +
                MILLIONAIRE_BOARD[movement.to]?.name
              : "ابدأ رحلتك من الانطلاق"}
          </span>
          {movement && (
            <small>
              {movement.steps.length
                ? scene.journey.step + " / " + movement.steps.length + " خطوات"
                : movement.source === "travel"
                  ? "سفر مباشر"
                  : "انتقال إلى الجزيرة"}
            </small>
          )}
        </div>
        <p className="millionaire-action-receipt">
          {scene.busy
            ? "تُعرض الحركة لجميع اللاعبين من جهة جلوسهم"
            : (data.lastAction ?? "بدأت رحلة المليونير")}
        </p>
        <div className="millionaire-turn-actions">
          {isMyTurn && !data.rolled && Number(data.jailTurns?.[me.id]) > 0 && (
            <div className="millionaire-jail-actions">
              <button
                type="button"
                disabled={!canAct || myCash < 150}
                onClick={() => void perform("monopoly-pay-jail")}
              >
                خروج · 150K
              </button>
              {Number(data.escapeCards?.[me.id]) > 0 && (
                <button
                  type="button"
                  disabled={!canAct}
                  onClick={() => void perform("monopoly-use-pass")}
                >
                  بطاقة خروج
                </button>
              )}
            </div>
          )}
          <button
            type="button"
            className="millionaire-primary"
            disabled={!canAct || Boolean(pending)}
            onClick={() => void perform(data.rolled ? "monopoly-end" : "monopoly-roll")}
          >
            {data.rolled ? <ArrowLeft /> : <Dices />}
            {sending
              ? "جاري الإرسال…"
              : scene.phase === "rolling"
                ? "النرد يتحرك…"
                : scene.busy
                  ? "يتحرك على اللوحة…"
                  : !isMyTurn
                    ? "انتظر دورك"
                    : pending
                      ? "اختر قرارك"
                      : data.rolled
                        ? data.extraTurn
                          ? "رمية إضافية"
                          : "إنهاء الدور"
                        : Number(data.jailTurns?.[me.id]) > 0
                          ? "حاول الخروج بالنرد"
                          : "ارمِ النرد"}
          </button>
        </div>
      </footer>
      <CashTransfers
        deltas={scene.deltas}
        root={rootRef.current}
        cards={playerCards.current}
        reducedMotion={reducedMotion}
      />

      {assetsPlayer && (
        <MillionaireDialog
          title={
            viewAssets.id === me.id ? "أملاكي واستثماراتي" : "أملاك " + label(viewAssets, players)
          }
          onClose={() => setAssetsPlayer(null)}
        >
          <nav className="millionaire-assets-players" aria-label="أملاك اللاعبين">
            {players.map((player, index) => (
              <button
                type="button"
                key={player.id}
                aria-pressed={viewAssets.id === player.id}
                style={{ "--player-color": COLORS[index % 4] } as CSSProperties}
                onClick={() => {
                  setAssetsPlayer(player.id);
                  setHighlightPlayer(player.id);
                }}
              >
                {index + 1} · {label(player, players)}
              </button>
            ))}
          </nav>
          <div className="millionaire-assets-summary">
            <span>
              الكاش<b dir="ltr">{cash(Number(data.cash?.[viewAssets.id]))}</b>
            </span>
            <span>
              الثروة
              <b dir="ltr">
                {cash(
                  Number(data.cash?.[viewAssets.id] ?? 0) +
                    millionaireInvestment(data, viewAssets.id),
                )}
              </b>
            </span>
            <span>
              بطاقات الخروج<b>{data.escapeCards?.[viewAssets.id] ?? 0}</b>
            </span>
          </div>
          <div className="millionaire-assets-list">
            {assets.length ? (
              assets.map(({ space, index, property }) => (
                <article key={index}>
                  <MiniatureBuilding level={property?.level ?? 1} space={space} />
                  <button
                    type="button"
                    className="millionaire-asset-inspect"
                    onClick={() => inspectLocation(index)}
                  >
                    <strong>{space.name}</strong>
                    <small>
                      {space.kind === "tourism"
                        ? "موقع سياحي"
                        : LEVELS[Math.min(4, property?.level ?? 1)]}{" "}
                      · رسوم {cash(monopolyToll(data, index))}
                    </small>
                    <span>
                      <MapPin /> إظهار على اللوحة
                    </span>
                  </button>
                  {viewAssets.id === me.id && (
                    <button
                      type="button"
                      className="millionaire-asset-sell"
                      disabled={!canAct || Boolean(pending && pending.type !== "debt")}
                      onClick={() => void perform("monopoly-sell", { spaceIndex: index })}
                    >
                      <Hammer /> بيع{" "}
                      <small dir="ltr">
                        +{cash(Math.round(Number(property?.invested ?? space.price) * 0.7))}
                      </small>
                    </button>
                  )}
                </article>
              ))
            ) : (
              <p className="millionaire-empty">
                لا توجد أملاك بعد. اشترِ المدن التي تصل إليها لتبدأ الاستثمار.
              </p>
            )}
          </div>
          {viewAssets.id === me.id && (
            <p className="millionaire-assets-note">
              يسترجع بيع الموقع للبنك 70٪ من قيمة الاستثمار.
            </p>
          )}
          <button
            type="button"
            className="millionaire-primary"
            onClick={() => {
              setHighlightPlayer(viewAssets.id);
              setSelectedSpace(null);
              setAssetsPlayer(null);
            }}
          >
            إظهار أملاك {label(viewAssets, players)} على اللوحة
          </button>
        </MillionaireDialog>
      )}
      {reviewChance && data.chance && (
        <MillionaireDialog title="آخر بطاقة فرصة" onClose={() => setReviewChance(false)}>
          <div className="millionaire-chance-review">
            <Gift />
            <h3>{data.chance.title}</h3>
            <p>{data.chance.description}</p>
            <small>
              سحبها {players.find((player) => player.id === data.chance?.playerId)?.name}
            </small>
          </div>
        </MillionaireDialog>
      )}
      {confirmBankrupt && (
        <MillionaireDialog title="إعلان الإفلاس" onClose={() => setConfirmBankrupt(false)}>
          <p>
            ستخرج من هذه المباراة وتُنقل أملاكك حسب الالتزام المالي. يمكنك الرجوع وبيع بعض الأملاك
            أولًا.
          </p>
          <button
            type="button"
            className="millionaire-secondary"
            onClick={() => setConfirmBankrupt(false)}
          >
            الرجوع
          </button>
          <button
            type="button"
            className="millionaire-danger"
            disabled={!canAct}
            onClick={() => {
              setConfirmBankrupt(false);
              void perform("monopoly-bankrupt");
            }}
          >
            إعلان الإفلاس والخروج من المباراة
          </button>
        </MillionaireDialog>
      )}
    </div>
  );
}
