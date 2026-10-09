import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  Banknote,
  BookOpen,
  Bot,
  Check,
  Clock3,
  Eye,
  Info,
  LogOut,
  Play,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Trash2,
  Trophy,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { playGameSfx } from "@/lib/game-sfx";
import {
  DEAL_GROUPS,
  DEAL_HAND_LIMIT,
  DEAL_TURN_MS,
  completedDealSets,
  dealBankTotal,
  dealGroup,
  dealRent,
  isProtectedDealProperty,
  legalDealProperties,
  type DealCard,
  type DealData,
} from "./saudi-deal-engine";
import "./saudi-deal-game-room.css";

type Player = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  isBot?: boolean;
  connected?: boolean;
};
type State = { round: number; scores: Record<string, number>; data: Record<string, unknown> };
type Props = {
  state: State;
  players: Player[];
  me: Player;
  logoUrl?: string | null;
  immersive: boolean;
  connected: boolean;
  clockOffset: number;
  sound: boolean;
  reducedMotion: boolean;
  dispatch: (type: string, value?: Record<string, unknown>) => Promise<void>;
  onExit: () => void;
  onGuide: () => void;
  onSettings: () => void;
  onToggleSound: () => void;
  isHost: boolean;
  onFinish: () => void;
};
type Target = { playerId: string; propertyId?: string; group?: string };
type Flight = {
  id: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  delay: number;
  card?: DealCard;
  bank?: boolean;
  caption?: string;
};
const shortName = (p?: Player) => p?.name.trim().split(/\s+/)[0] || "اللاعب";
const EMPTY_CARDS: DealCard[] = [];
const targeted = ["rent", "debt", "steal", "forced_swap", "deal_breaker"];
const ACTION_HELP: Record<string, string> = {
  draw2: "اسحب ورقتين إضافيتين. تحتسب حركة واحدة، ويبقى مؤقت دورك نفسه.",
  rent: "اختر لاعبًا لتحصيل إيجار حسب عدد الأراضي في أكبر مجموعة عندك، بحد أقصى ٥ ملايين. الدفع من البنك ثم الأراضي عند الحاجة.",
  debt: "اختر لاعبًا لتحصيل دين بقيمة ٥ ملايين. إذا لم تكفِ أملاكه يدفع المتاح.",
  steal: "اختر أرضًا عند لاعب آخر. الأراضي ضمن مجموعة مكتملة محمية من هذه البطاقة.",
  forced_swap:
    "اختر أرضًا عند خصمك وأرضًا من أراضيك للتبادل. يجب أن تكون الأرضان خارج المجموعات المكتملة.",
  deal_breaker: "اختر مجموعة مكتملة عند لاعب آخر للاستحواذ عليها كلها.",
  birthday: "كل لاعب آخر يدفع لك مليونين من البنك أو الأراضي المتاحة.",
  double_rent: "يضاعف تحصيل الإيجار التالي في نفس الدور. تحتسب هذه البطاقة حركة مستقلة.",
  just_say_no:
    "تصد هجومًا تلقائيًا ما دامت في يدك، ثم تُرمى. تقدر تودعها في البنك، وعندها تفقد الحماية.",
};
function Avatar({ player }: { player: Player }) {
  return (
    <span className="deal-avatar">
      {player.avatarUrl ? <img src={player.avatarUrl} alt="" /> : shortName(player)[0]}
      {player.isBot && <Bot />}
    </span>
  );
}
function Back() {
  return (
    <span className="deal-back" aria-hidden="true">
      <span>
        سعودي
        <br />
        ديل
      </span>
      <i>✦</i>
    </span>
  );
}
function Face({ card, bank = false }: { card: DealCard; bank?: boolean }) {
  const group = dealGroup(card);
  const property = card.type === "property" && !bank;
  const index = property
    ? Math.max(
        0,
        DEAL_GROUPS.findIndex((g) => g.id === card.group),
      )
    : bank || card.type === "money"
      ? 0
      : ({
          rent: 1,
          birthday: 1,
          double_rent: 1,
          draw2: 2,
          steal: 3,
          forced_swap: 4,
          debt: 5,
          deal_breaker: 6,
          just_say_no: 7,
        }[card.action ?? ""] ?? 0);
  return (
    <span
      className={cn("deal-face", property && "deal-face--property", bank && "deal-face--bank")}
      style={{ "--group-color": property ? group?.color : "#263d52" } as CSSProperties}
    >
      <strong className="deal-face__title">{bank ? `${card.value} مليون` : card.label}</strong>
      <span
        className="deal-face__art"
        style={{
          backgroundImage: `url('/assets/games/saudi-deal/${property ? "regions" : "actions"}.webp')`,
          backgroundPosition: `${((index % 4) * 100) / 3}% ${index >= 4 ? 100 : 0}%`,
        }}
      />
      <span className="deal-face__footer">
        <b>{property ? group?.label : bank || card.type === "money" ? "البنك" : "أكشن"}</b>
        <span>
          {card.value}
          <small> م</small>
        </span>
      </span>
      {card.action === "double_rent" && !bank && <span className="deal-face__double">×٢</span>}
    </span>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const items = panel.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),select,a[href],[tabindex="0"]',
        );
        if (!items?.length) return;
        if (
          e.shiftKey &&
          (document.activeElement === items[0] || document.activeElement === panel.current)
        ) {
          e.preventDefault();
          items[items.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === items[items.length - 1]) {
          e.preventDefault();
          items[0].focus();
        }
      }
    };
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("keydown", key, true);
      previous?.focus();
    };
  }, []);
  return (
    <div className="deal-modal" onClick={onClose}>
      <div
        ref={panel}
        tabIndex={-1}
        className="deal-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="deal-icon-button deal-modal__close" aria-label="إغلاق" onClick={onClose}>
          <X />
        </button>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function SaudiDealGameRoom({
  state,
  players,
  me,
  logoUrl,
  immersive,
  connected,
  clockOffset,
  sound,
  reducedMotion,
  dispatch,
  onExit,
  onGuide,
  onSettings,
  onToggleSound,
  isHost,
  onFinish,
}: Props) {
  const data = state.data as DealData;
  const root = useRef<HTMLElement>(null);
  const anchors = useRef(new Map<string, HTMLElement>());
  const [now, setNow] = useState(() => Date.now());
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState<DealCard | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [offered, setOffered] = useState<string>("");
  const [inspect, setInspect] = useState<string | null>(null);
  const [help, setHelp] = useState<DealCard | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [effect, setEffect] = useState<{ completed: string[]; blocked: string[] } | null>(null);
  const seenEvent = useRef("");
  const settings = useRef({ sound, reducedMotion, clockOffset });
  settings.current = { sound, reducedMotion, clockOffset };
  const active = players[Number(data.turnIndex ?? 0) % Math.max(1, players.length)];
  const seconds = Math.max(
    0,
    Math.ceil((Number(data.turnDeadline ?? Date.now() + DEAL_TURN_MS) - now - clockOffset) / 1000),
  );
  const myTurn = active?.id === me.id;
  const canAct = connected && myTurn && seconds > 0 && !data.needsDraw;
  const canPlay = canAct && !data.endingTurn && data.actionsLeft > 0;
  const hand = data.hands[me.id] ?? EMPTY_CARDS;
  const ownProperties = (data.properties[me.id] ?? []) as DealCard[];
  const chosen = hand.find((c) => c.id === selected);
  const excess = Math.max(0, hand.length - DEAL_HAND_LIMIT);
  const ownIndex = Math.max(
    0,
    players.findIndex((p) => p.id === me.id),
  );
  const opponents = Array.from(
    { length: Math.max(0, players.length - 1) },
    (_, i) => players[(ownIndex + i + 1) % players.length],
  );
  const locations =
    opponents.length === 1
      ? ["top"]
      : opponents.length === 2
        ? ["right", "left"]
        : ["right", "top", "left"];
  const anchor = (key: string) => (el: HTMLElement | null) => {
    if (el) anchors.current.set(key, el);
    else anchors.current.delete(key);
  };
  const clearTarget = () => {
    setPending(null);
    setTarget(null);
    setOffered("");
  };
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    clearTarget();
    setSelected(null);
  }, [data.turnSequence, state.round, connected]);
  useEffect(() => {
    if (seconds === 0) clearTarget();
  }, [seconds]);
  useEffect(() => {
    if (selected && !hand.some((c) => c.id === selected)) setSelected(null);
  }, [hand, selected]);
  const lastTick = useRef("");
  useEffect(() => {
    const token = `${state.round}:${data.turnSequence}:${seconds}`;
    if (canAct && seconds <= 5 && seconds > 0 && token !== lastTick.current) {
      lastTick.current = token;
      if (sound) playGameSfx("tick");
    }
  }, [canAct, seconds, sound, state.round, data.turnSequence]);
  // A refreshed snapshot may repeat the same event; keep its animation timer intact.
  const eventRef = useRef(data.event);
  eventRef.current = data.event;
  useEffect(() => {
    const event = eventRef.current;
    if (!event || !root.current) return;
    const token = `${state.round}:${event.sequence}`;
    if (seenEvent.current === token) return;
    seenEvent.current = token;
    if (Date.now() + settings.current.clockOffset - event.at > 2500) return;
    if (settings.current.sound)
      playGameSfx(
        event.transfers?.some((t) => t.kind === "bank")
          ? "coin"
          : event.drawnCount
            ? "draw"
            : "play",
      );
    setEffect({ completed: event.completedGroups ?? [], blocked: event.blockedIds ?? [] });
    const bounds = root.current.getBoundingClientRect();
    const motions: Flight[] = [];
    function fly(
      from: string,
      to: string,
      card?: DealCard,
      caption?: string,
      delay = 0,
      bank = false,
    ) {
      const a = anchors.current.get(from)?.getBoundingClientRect(),
        b = anchors.current.get(to)?.getBoundingClientRect();
      if (!a || !b) return;
      const x = a.left + a.width / 2 - bounds.left,
        y = a.top + a.height / 2 - bounds.top;
      motions.push({
        id: `${token}:${motions.length}`,
        x,
        y,
        dx: b.left + b.width / 2 - bounds.left - x,
        dy: b.top + b.height / 2 - bounds.top - y,
        delay,
        card,
        bank,
        caption,
      });
    }
    if (!settings.current.reducedMotion) {
      if (event.card)
        fly(
          `hand:${event.playerId}`,
          event.type === "deal-property"
            ? `group:${event.playerId}:${event.card.group}`
            : event.type === "deal-bank"
              ? `bank:${event.playerId}`
              : "discard",
          event.card,
          undefined,
          0,
          event.type === "deal-bank",
        );
      if (event.drawnCount)
        fly(
          "draw",
          `hand:${event.playerId}`,
          undefined,
          `+${event.drawnCount}`,
          event.card ? 250 : 0,
        );
      for (const transfer of event.transfers ?? [])
        fly(
          `${transfer.kind === "bank" ? "bank" : "properties"}:${transfer.fromId}`,
          `${transfer.kind === "bank" ? "bank" : "properties"}:${transfer.toId}`,
          transfer.cards[0],
          transfer.kind === "bank"
            ? `${transfer.amount} م`
            : transfer.cards.length > 1
              ? `${transfer.cards.length} أراضٍ`
              : undefined,
          280,
          transfer.kind === "bank",
        );
    }
    setFlights(motions);
    const timer = window.setTimeout(() => {
      setFlights([]);
      setEffect(null);
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [data.event?.sequence, state.round]);

  function selectablePlayer(p: Player) {
    if (!pending || p.id === me.id) return false;
    return (
      ["rent", "debt"].includes(pending.action ?? "") ||
      legalDealProperties(data, p.id, pending.action).length > 0
    );
  }
  function pickProperty(p: Player, c: DealCard) {
    if (!pending || !canPlay) {
      setInspect(p.id);
      return;
    }
    if (p.id === me.id) {
      if (pending.action === "forced_swap" && !isProtectedDealProperty(ownProperties, c)) {
        setOffered(c.id);
        setInspect(null);
      }
      return;
    }
    if (!legalDealProperties(data, p.id, pending.action).some((item) => item.id === c.id)) return;
    setTarget({ playerId: p.id, propertyId: c.id, group: c.group });
    setInspect(null);
  }
  function rack(p: Player, own = false) {
    const cards = (data.properties[p.id] ?? []) as DealCard[];
    const groups = DEAL_GROUPS.filter((g) => cards.some((c) => c.group === g.id));
    return (
      <div
        ref={anchor(`properties:${p.id}`)}
        className={cn("deal-rack", own && "deal-rack--own")}
        aria-label={`أراضي ${p.name}`}
      >
        {groups.length ? (
          groups.map((g) => {
            const items = cards.filter((c) => c.group === g.id),
              complete = items.length >= g.size;
            const eligible =
              pending &&
              (own
                ? pending.action === "forced_swap" && !complete
                : selectablePlayer(p) &&
                  (pending.action === "deal_breaker"
                    ? complete
                    : ["steal", "forced_swap"].includes(pending.action ?? "") && !complete));
            return (
              <div
                key={g.id}
                ref={anchor(`group:${p.id}:${g.id}`)}
                className={cn(
                  "deal-set",
                  complete && "deal-set--complete",
                  eligible && "deal-set--eligible",
                  p.id === data.event?.playerId &&
                    effect?.completed.includes(g.id) &&
                    "deal-set--celebrate",
                )}
                style={{ "--group-color": g.color } as CSSProperties}
              >
                <div className="deal-set__label">
                  <b>{g.label}</b>
                  <span>
                    {complete && <Check />}
                    {items.length}/{g.size}
                  </span>
                </div>
                <div className="deal-set__cards">
                  {items.map((c) => (
                    <button
                      key={c.id}
                      className={cn(
                        "deal-public-card",
                        ((target?.playerId === p.id &&
                          (pending?.action === "deal_breaker"
                            ? target.group === c.group
                            : target.propertyId === c.id)) ||
                          offered === c.id) &&
                          "is-selected",
                      )}
                      aria-label={`${c.label} عند ${p.name}${complete ? "، مجموعة مكتملة" : ""}`}
                      onClick={() => pickProperty(p, c)}
                    >
                      <Face card={c} />
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          <span className="deal-rack__empty">لا توجد أراضٍ بعد</span>
        )}
      </div>
    );
  }
  function badge(p: Player, own = false) {
    const isActive = active?.id === p.id;
    const canTarget = selectablePlayer(p) && ["rent", "debt"].includes(pending?.action ?? "");
    return (
      <div
        className={cn(
          "deal-player",
          isActive && "deal-player--active",
          own && "deal-player--own",
          effect?.blocked.includes(p.id) && "deal-player--blocked",
          target?.playerId === p.id && "deal-player--chosen",
        )}
        data-player-id={p.id}
      >
        <button
          className={cn("deal-player__identity", canTarget && "is-eligible")}
          aria-label={canTarget ? `اختيار ${p.name} للتحصيل` : `عرض أملاك ${p.name}`}
          onClick={() => (canTarget && canPlay ? setTarget({ playerId: p.id }) : setInspect(p.id))}
        >
          <Avatar player={p} />
          <span>
            <strong>
              {shortName(p)}
              {own && " (أنت)"}
            </strong>
            <small>
              {p.connected === false
                ? "يعيد الاتصال"
                : isActive
                  ? "دوره الآن"
                  : `${data.hands[p.id]?.length ?? 0} أوراق`}
            </small>
          </span>
          {p.connected === false && <WifiOff />}
        </button>
        <button
          ref={anchor(`bank:${p.id}`)}
          className={cn("deal-bank", canTarget && "is-eligible")}
          aria-label={`بنك ${p.name}: ${dealBankTotal(data.banks[p.id] ?? [])} مليون`}
          onClick={() => (canTarget && canPlay ? setTarget({ playerId: p.id }) : setInspect(p.id))}
        >
          <Banknote />
          <b>{dealBankTotal(data.banks[p.id] ?? [])}</b>
          <small>م</small>
        </button>
        <span
          className="deal-progress"
          aria-label={`${completedDealSets(data.properties[p.id] ?? [])} من 3 مجموعات مكتملة`}
        >
          <Trophy />
          {completedDealSets(data.properties[p.id] ?? [])}/3
        </span>
        {isActive && (
          <span
            className="deal-player__clock"
            style={{ "--time-left": `${(seconds / 90) * 100}%` } as CSSProperties}
          />
        )}
      </div>
    );
  }
  function startPlay() {
    if (!chosen || !canPlay) return;
    if (chosen.type === "property") {
      void dispatch("deal-property", { cardId: chosen.id });
      setSelected(null);
      return;
    }
    if (chosen.type !== "action" || chosen.action === "just_say_no") return;
    if (targeted.includes(chosen.action ?? "")) {
      setPending(chosen);
      setTarget(null);
      setOffered("");
      return;
    }
    void dispatch("deal-action", { cardId: chosen.id });
    setSelected(null);
  }
  const targetPlayer = players.find((p) => p.id === target?.playerId);
  const targetCard = target
    ? ((data.properties[target.playerId] ?? []).find(
        (c: DealCard) => c.id === target.propertyId,
      ) as DealCard | undefined)
    : undefined;
  const ownOffer = ownProperties.find((c) => c.id === offered);
  const targetDescription = pending
    ? !target
      ? ["rent", "debt"].includes(pending.action ?? "")
        ? "اختر اللاعب من اسمه أو بنكه"
        : pending.action === "deal_breaker"
          ? "اختر مجموعة مكتملة عند خصمك"
          : "اختر أرضًا مضيئة عند خصمك"
      : `${shortName(targetPlayer)}${pending.action === "deal_breaker" ? ` · مجموعة ${targetCard ? (dealGroup(targetCard)?.label ?? "") : ""}` : targetCard ? ` · ${targetCard.label}` : ""}${pending.action === "forced_swap" ? (ownOffer ? ` ↔ ${ownOffer.label}` : " · ثم اختر أرضك للتبادل") : pending.action === "rent" ? ` · إيجار ${dealRent(data, me.id)} م` : pending.action === "debt" ? " · دين ٥ م" : ""}`
    : "";
  const confirmReady = Boolean(canPlay && target && (pending?.action !== "forced_swap" || offered));
  const playAvailable = Boolean(
    canPlay &&
    chosen &&
    (chosen.type === "property" ||
      (chosen.type === "action" &&
        chosen.action !== "just_say_no" &&
        (chosen.action !== "forced_swap" ||
          legalDealProperties(data, me.id, "forced_swap").length > 0) &&
        (!targeted.includes(chosen.action ?? "") ||
          opponents.some(
            (p) =>
              ["rent", "debt"].includes(chosen.action ?? "") ||
              legalDealProperties(data, p.id, chosen.action).length > 0,
          )))),
  );
  const viewer = players.find((p) => p.id === me.id) ?? me;
  const inspected = players.find((p) => p.id === inspect);
  const topDiscard = (data.discard as DealCard[]).at(-1);

  return (
    <main
      ref={root}
      className={cn(
        "deal-game-room",
        immersive && "deal-game-room--immersive",
        reducedMotion && "deal-game-room--still",
      )}
      dir="rtl"
      data-turn-sequence={data.turnSequence}
    >
      <header className="deal-hud">
        <div className="deal-hud__title">
          <b>سعودي ديل</b>
          <span>
            الجولة {state.round + 1} · {players.length} لاعبين
          </span>
        </div>
        <div
          className={cn("deal-timer", seconds <= 15 && "deal-timer--urgent")}
          role="timer"
          aria-label={`الوقت المتبقي ${seconds} ثانية`}
        >
          <Clock3 />
          <strong dir="ltr">
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
          </strong>
          <span>{myTurn ? "دورك" : shortName(active)}</span>
        </div>
        <nav aria-label="أدوات اللعبة">
          <button
            className="deal-icon-button"
            onClick={onToggleSound}
            aria-label={sound ? "كتم الصوت" : "تشغيل الصوت"}
          >
            {sound ? <Volume2 /> : <VolumeX />}
          </button>
          <button className="deal-icon-button" onClick={onGuide} aria-label="طريقة اللعب">
            <BookOpen />
          </button>
          <button className="deal-icon-button" onClick={onSettings} aria-label="إعدادات اللعب">
            <Settings2 />
          </button>
          <button className="deal-icon-button" onClick={onExit} aria-label="إغلاق وضع اللعبة">
            <LogOut />
          </button>
        </nav>
      </header>
      {!connected && (
        <div className="deal-connection" role="status">
          <WifiOff />
          جارٍ استعادة اتصالك وأوراقك…
        </div>
      )}
      <section className="deal-table" aria-label="طاولة سعودي ديل">
        <div className="deal-stage">
          {opponents.map((p, i) => (
            <section
              key={p.id}
              className={`deal-opponent deal-opponent--${locations[i]}${opponents.length === 1 ? " deal-opponent--solo" : ""}`}
              aria-label={`مقعد ${p.name}`}
            >
              {badge(p)}
              <div
                ref={anchor(`hand:${p.id}`)}
                className="deal-hidden-hand"
                aria-label={`${data.hands[p.id]?.length ?? 0} أوراق مقلوبة`}
              >
                <div>
                  {Array.from({ length: Math.min(7, data.hands[p.id]?.length ?? 0) }, (_, n) => (
                    <Back key={n} />
                  ))}
                </div>
                <b>{data.hands[p.id]?.length ?? 0}</b>
              </div>
              {rack(p)}
            </section>
          ))}
          <div
            className={cn(
              "deal-center",
              opponents.length === 1 && "deal-center--two",
              opponents.length === 2 && "deal-center--three",
            )}
          >
            <div className="deal-piles">
              <div className="deal-pile" ref={anchor("draw")}>
                <Back />
                <span>السحب · {data.drawPile?.length ?? 0}</span>
              </div>
              <div className="deal-seal">
                {logoUrl ? (
                  <img src={logoUrl} alt="شعار العائلة" />
                ) : (
                  <>
                    <span>سعودي</span>
                    <strong>ديل</strong>
                    <small>مجلس العائلة</small>
                  </>
                )}
              </div>
              <button
                className="deal-pile deal-pile--discard"
                ref={anchor("discard")}
                aria-label={topDiscard ? `آخر بطاقة: ${topDiscard.label}` : "كومة الرمي فارغة"}
                disabled={!topDiscard}
                onClick={() => topDiscard && setHelp(topDiscard)}
              >
                {topDiscard ? (
                  <Face card={topDiscard} />
                ) : (
                  <span className="deal-empty-card">الرمي</span>
                )}
                <span>الرمي · {data.discard?.length ?? 0}</span>
              </button>
            </div>
            <p className="deal-last-action" role="status">
              {data.lastAction}
            </p>
          </div>
        </div>
        <section className="deal-owned" aria-label="أراضيك">
          <div className="deal-owned__heading">
            <b>أراضيك</b>
            <span>
              <Trophy />
              {completedDealSets(ownProperties)}/3
            </span>
          </div>
          {rack(viewer, true)}
          <button
            className="deal-inspect"
            aria-label="عرض جميع أراضيك وبنكك"
            onClick={() => setInspect(me.id)}
          >
            <Eye />
          </button>
        </section>
        <footer className="deal-hand-zone">
          <div className="deal-me">
            {badge(viewer, true)}
            <p>
              {!connected
                ? "جارٍ الاتصال"
                : !myTurn
                  ? `بانتظار ${shortName(active)}`
                  : data.needsDraw
                    ? "تُسحب أوراق بداية الدور…"
                    : data.endingTurn
                      ? `ارمِ ${excess} أوراق زائدة`
                      : `${data.actionsLeft} حركات متبقية`}
            </p>
            {isHost && (
              <button className="deal-finish" onClick={onFinish}>
                إنهاء اللعبة
              </button>
            )}
          </div>
          <div className="deal-hand-wrap">
            <div
              className={cn(
                "deal-hand-hint",
                pending && "deal-hand-hint--target",
                excess > 0 && data.endingTurn && "deal-hand-hint--urgent",
              )}
            >
              <span>
                {pending
                  ? targetDescription
                  : excess && data.endingTurn
                    ? `اختر ورقة ثم اضغط رمي الزيادة · الحد ${DEAL_HAND_LIMIT}`
                    : chosen
                      ? chosen.type === "property"
                        ? `${chosen.label} · ${dealGroup(chosen)?.label}`
                        : chosen.label
                      : "اختر ورقة من يدك"}
              </span>
              {chosen && (
                <button aria-label={`شرح بطاقة ${chosen.label}`} onClick={() => setHelp(chosen)}>
                  <Info />
                </button>
              )}
            </div>
            <div ref={anchor(`hand:${me.id}`)} className="deal-hand" aria-label="أوراق يدك">
              {hand.map((c) => (
                <button
                  key={c.id}
                  className={cn("deal-hand-card", selected === c.id && "is-selected")}
                  aria-label={c.label}
                  aria-pressed={selected === c.id}
                  onClick={() => {
                    if (pending) return;
                    setSelected(selected === c.id ? null : c.id);
                  }}
                >
                  <Face card={c} />
                </button>
              ))}
              {!hand.length && <span className="deal-hand__empty">يدك فارغة</span>}
            </div>
          </div>
          <div className="deal-controls">
            {pending ? (
              <>
                <button
                  className="deal-primary"
                  disabled={!confirmReady}
                  onClick={() => {
                    if (confirmReady && pending && target)
                      void dispatch("deal-action", {
                        cardId: pending.id,
                        targetId: target.playerId,
                        propertyId: target.propertyId,
                        group: target.group,
                        ownPropertyId: offered || undefined,
                      });
                    clearTarget();
                    setSelected(null);
                  }}
                >
                  <Check />
                  تأكيد الأكشن
                </button>
                <button onClick={clearTarget}>
                  <X />
                  إلغاء الاختيار
                </button>
              </>
            ) : (
              <>
                <button className="deal-primary" disabled={!playAvailable} onClick={startPlay}>
                  <Play />
                  العب الورقة
                </button>
                <button
                  disabled={!canPlay || !chosen || chosen.type === "property"}
                  onClick={() => {
                    if (chosen && canPlay) void dispatch("deal-bank", { cardId: chosen.id });
                    setSelected(null);
                  }}
                >
                  <Banknote />
                  إيداع بالبنك
                </button>
              </>
            )}
            {excess > 0 ? (
              <button
                className="deal-discard-button"
                disabled={!canAct || !chosen || Boolean(pending)}
                onClick={() => {
                  if (chosen && canAct) void dispatch("deal-discard", { cardId: chosen.id });
                  setSelected(null);
                }}
              >
                <Trash2 />
                رمي الزيادة ({excess})
              </button>
            ) : (
              <button
                disabled={!canAct || Boolean(pending)}
                onClick={() => {
                  clearTarget();
                  void dispatch("deal-end");
                }}
              >
                <Check />
                إنهاء دوري
              </button>
            )}
          </div>
        </footer>
      </section>
      <div className="deal-flights" aria-hidden="true">
        {flights.map((f) => (
          <div
            key={f.id}
            className="deal-flight"
            style={
              {
                left: f.x,
                top: f.y,
                "--flight-x": `${f.dx}px`,
                "--flight-y": `${f.dy}px`,
                animationDelay: `${f.delay}ms`,
              } as CSSProperties
            }
          >
            {f.card ? <Face card={f.card} bank={f.bank} /> : <Back />}
            {f.caption && <b>{f.caption}</b>}
          </div>
        ))}
      </div>
      {effect?.completed.length ? (
        <div className="deal-celebration" role="status">
          <Check />
          اكتملت مجموعة{" "}
          {effect.completed.map((id) => DEAL_GROUPS.find((g) => g.id === id)?.label).join(" و")}
        </div>
      ) : null}
      {inspected && (
        <Modal title={`أملاك ${inspected.name}`} onClose={() => setInspect(null)}>
          <div className="deal-inspection__summary">
            <span>
              <Banknote />
              البنك: {dealBankTotal(data.banks[inspected.id] ?? [])} مليون
            </span>
            <span>
              <Trophy />
              {completedDealSets(data.properties[inspected.id] ?? [])}/3 مجموعات مكتملة
            </span>
          </div>
          <h3>الأراضي</h3>
          {pending && <p>{targetDescription}</p>}
          <div className="deal-inspection__lands">{rack(inspected, inspected.id === me.id)}</div>
          <h3>بطاقات البنك</h3>
          <p>القيمة المودعة ثابتة؛ بطاقات الأكشن في البنك تُستخدم مالًا.</p>
          <div className="deal-inspection__bank">
            {(data.banks[inspected.id] ?? []).map((c: DealCard) => (
              <div key={c.id}>
                <Face card={c} bank />
              </div>
            ))}
            {!data.banks[inspected.id]?.length && <span>البنك فارغ</span>}
          </div>
        </Modal>
      )}
      {help && (
        <Modal title={help.label} onClose={() => setHelp(null)}>
          <div className="deal-card-help">
            <Face card={help} />
            <div>
              <p>
                {help.type === "property"
                  ? `أضفها إلى مجموعة ${dealGroup(help)?.label}. تكتمل هذه المجموعة عند امتلاك ${dealGroup(help)?.size} أراضٍ، وتحتاج ثلاث مجموعات مختلفة للفوز.`
                  : help.type === "money"
                    ? `أودعها في البنك بقيمة ${help.value} مليون. الإيداع يحتسب حركة واحدة.`
                    : ACTION_HELP[help.action ?? ""]}
              </p>
              <p>
                قيمة البطاقة: {help.value} مليون{help.type === "action" && " عند إيداعها بالبنك"}.
              </p>
              {help.action === "just_say_no" && <ShieldCheck />}
              <small>
                وقت الدور ١:٣٠، ولا يتجدد مع كل حركة. حد اليد في نهاية الدور ٧ أوراق؛ عند انتهاء
                الوقت تُرمى الزيادة بدءًا من آخر الأوراق.
              </small>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}

export function SaudiDealResults({
  state,
  players,
  isHost,
  onRematch,
  onLobby,
}: {
  state: State;
  players: Player[];
  isHost: boolean;
  onRematch: () => void;
  onLobby: () => void;
}) {
  const winner = players.find((p) => p.id === state.data.winnerId);
  return (
    <section className="deal-results" dir="rtl">
      <Trophy className="deal-results__trophy" />
      <small>الجولة {state.round + 1}</small>
      <h2>{winner ? `${shortName(winner)} أكمل ثلاث مجموعات!` : "انتهت الجولة"}</h2>
      <p>انتصارات الجلسة</p>
      <div className="deal-standings">
        {players
          .slice()
          .sort((a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0))
          .map((p) => (
            <div key={p.id}>
              <Avatar player={p} />
              <strong>{p.name}</strong>
              <b>{state.scores[p.id] ?? 0}</b>
            </div>
          ))}
      </div>
      {isHost ? (
        <div className="deal-results__actions">
          <button onClick={onRematch}>
            <RotateCcw />
            جولة جديدة بنفس اللاعبين
          </button>
          <button onClick={onLobby}>
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
