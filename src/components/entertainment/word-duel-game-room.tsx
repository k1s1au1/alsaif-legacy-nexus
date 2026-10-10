import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Check,
  Flag,
  HelpCircle,
  Lightbulb,
  LogOut,
  RefreshCcw,
  Send,
  Settings2,
  SkipForward,
  Trophy,
  Volume2,
  VolumeX,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { playGameSfx } from "@/lib/game-sfx";
import {
  WORD_CATEGORIES,
  WORD_TOPICS,
  WORD_TURN_MS,
  normalizeWordOptions,
  validateWord,
  type WordData,
  type WordOptions,
  type WordPlayer,
} from "./word-duel-engine";
import {
  cleanArabicWord,
  eligibleWords,
  ensureWordDictionary,
  spellingKey,
  wordDictionaryReady,
} from "./word-duel-lexicon";
import "./word-duel-game-room.css";

type State = { round: number; scores: Record<string, number>; data: Record<string, unknown> };
type Props = {
  state: State;
  players: WordPlayer[];
  me: WordPlayer;
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
const shortName = (player?: WordPlayer) =>
  player?.name.replace(/^بوت\s+/, "").split(/\s+/)[0] || "اللاعب";
const letterLabel = (letter: string) => (letter === "ه" ? "هـ" : letter);
function Avatar({ player }: { player: WordPlayer }) {
  return (
    <span className="sijal-avatar">
      {player.avatarUrl ? <img src={player.avatarUrl} alt="" /> : shortName(player)[0]}
      {player.isBot && <Bot aria-label="لاعب آلي" />}
    </span>
  );
}
function WrittenWord({ word }: { word: string }) {
  const letters = Array.from(cleanArabicWord(word));
  let lastIndex = letters.length - 1;
  while (lastIndex > 0 && !spellingKey(letters[lastIndex])) lastIndex -= 1;
  return (
    <b className="sijal-written-word">
      {letters.slice(0, lastIndex).join("")}
      <em>{letters[lastIndex]}</em>
      {letters.slice(lastIndex + 1).join("")}
    </b>
  );
}
function useNotebookViewport(immersive: boolean) {
  const [viewport, setViewport] = useState({ height: 0, keyboard: false });
  useEffect(() => {
    if (!immersive) return;
    const visual = window.visualViewport;
    const resize = () =>
      setViewport({
        height: visual?.height ?? window.innerHeight,
        keyboard: window.innerHeight - (visual?.height ?? window.innerHeight) > 140,
      });
    resize();
    visual?.addEventListener("resize", resize);
    window.addEventListener("resize", resize);
    return () => {
      visual?.removeEventListener("resize", resize);
      window.removeEventListener("resize", resize);
    };
  }, [immersive]);
  return viewport;
}

export function WordDuelGameRoom({
  state,
  players,
  me,
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
  const data = state.data as WordData;
  const [now, setNow] = useState(Date.now);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [dictionaryReady, setDictionaryReady] = useState(wordDictionaryReady);
  const [dictionaryError, setDictionaryError] = useState(false);
  const viewport = useNotebookViewport(immersive);
  const stageRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const eventRef = useRef(data.eventSequence);
  const turnRef = useRef(data.turnSequence);
  const tickRef = useRef("");
  const active = players[data.turnIndex ?? 0];
  const myTurn = active?.id === me.id;
  const remaining = Math.max(0, Number(data.turnDeadline ?? now + clockOffset) - now - clockOffset);
  const seconds = Math.ceil(remaining / 1000);
  const actionable = connected && myTurn && remaining > 0 && dictionaryReady;
  const words = Array.isArray(data.words) ? data.words : [];
  const previous = words.at(-1);
  const round = data.roundNumber ?? 1;
  const options = normalizeWordOptions(data.options);
  const category = data.currentCategory ?? "general";
  const hint = data.hints?.[me.id];
  const loadDictionary = () => {
    setDictionaryError(false);
    void ensureWordDictionary()
      .then(() => setDictionaryReady(true))
      .catch(() => setDictionaryError(true));
  };
  useEffect(() => {
    let live = true;
    void ensureWordDictionary()
      .then(() => {
        if (live) setDictionaryReady(true);
      })
      .catch(() => {
        if (live) setDictionaryError(true);
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => {
    setInput("");
    setError("");
  }, [data.turnSequence, state.round]);
  useEffect(() => {
    if (
      sound &&
      connected &&
      data.eventSequence !== eventRef.current &&
      data.event &&
      now + clockOffset - data.event.at < 2500
    )
      playGameSfx(data.event.type === "word" ? "play" : "move");
    if (sound && connected && myTurn && turnRef.current !== data.turnSequence) playGameSfx("turn");
    eventRef.current = data.eventSequence;
    turnRef.current = data.turnSequence;
  }, [
    clockOffset,
    connected,
    data.event,
    data.eventSequence,
    data.turnSequence,
    myTurn,
    now,
    sound,
  ]);
  useEffect(() => {
    const token = `${state.round}:${data.turnSequence}:${seconds}`;
    if (actionable && sound && seconds > 0 && seconds <= 5 && token !== tickRef.current)
      playGameSfx("tick");
    tickRef.current = token;
  }, [actionable, data.turnSequence, seconds, sound, state.round]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!actionable) return;
    const result = validateWord(data, input);
    if (!result.ok) {
      setError(result.reason);
      if (sound) playGameSfx("error");
      return;
    }
    setError("");
    void dispatch("word-submit", { word: input }).catch(() =>
      setError("تعذر إرسال الكلمة. حاول مرة ثانية."),
    );
  };
  const showHint = () => {
    if (!actionable || data.hintUsed?.[me.id]) return;
    if (
      !eligibleWords(data.currentLetter, new Set(words.map((w) => w.key)), category).some(
        (w) => w.key.length >= 3,
      )
    ) {
      setError("ما عندنا تلميح لهذا الحرف الآن. جرّب كلمة قصيرة.");
      return;
    }
    setError("");
    void dispatch("word-hint");
  };
  const focusInput = () =>
    window.setTimeout(
      () => inputRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" }),
      250,
    );
  const feedback = !connected
    ? "نستعيد اتصالك… الدور والوقت محفوظان"
    : !dictionaryReady
      ? dictionaryError
        ? "تعذر تجهيز الكلمات"
        : "نجهّز الكلمات…"
      : myTurn
        ? seconds > 0
          ? "دورك الآن، اكتب كلمة!"
          : "انتهى وقتك، ينتقل الدور…"
        : `${active?.isBot ? "يكتب" : "الدور عند"} ${shortName(active)}${active?.connected === false ? " · غير متصل" : ""}`;
  return (
    <div
      ref={stageRef}
      className={cn(
        "sijal-notebook",
        immersive && "sijal-notebook--immersive",
        viewport.keyboard && "sijal-notebook--keyboard",
        reducedMotion && "sijal-notebook--still",
      )}
      dir="rtl"
      style={
        viewport.height && immersive
          ? ({ "--sijal-viewport-height": `${viewport.height}px` } as CSSProperties)
          : undefined
      }
    >
      <div className="sijal-notebook__page">
        <nav className="sijal-tools" aria-label="أدوات السجال">
          <button onClick={onExit} aria-label={immersive ? "الخروج من وضع اللعبة" : "رجوع"}>
            <LogOut />
          </button>
          <span className="sijal-edition">
            <BookOpen /> دفتر الحروف
          </span>
          <div>
            <button onClick={onToggleSound} aria-label={sound ? "كتم الصوت" : "تشغيل الصوت"}>
              {sound ? <Volume2 /> : <VolumeX />}
            </button>
            <button onClick={onGuide} aria-label="طريقة اللعب">
              <HelpCircle />
            </button>
            <button onClick={onSettings} aria-label="إعدادات اللعبة">
              <Settings2 />
            </button>
          </div>
        </nav>
        <header className="sijal-heading">
          <h2>سجال الحروف</h2>
          <p>كلمة منك، وحرف للي بعدك</p>
          <span className="sijal-round">
            الجولة {round} <small>/ {options.rounds}</small>
          </span>
        </header>
        <div className="sijal-players" aria-label="اللاعبون والنقاط">
          {players.map((player) => (
            <div
              key={player.id}
              className={cn(
                "sijal-player",
                player.id === active?.id && "sijal-player--active",
                player.connected === false && "sijal-player--offline",
              )}
              aria-current={player.id === active?.id ? "step" : undefined}
            >
              <Avatar player={player} />
              <span className="sijal-player__name">
                {shortName(player)}
                {player.id === me.id && <small> أنت</small>}
              </span>
              <strong>
                {state.scores[player.id] ?? 0} <small>نقاط</small>
              </strong>
              {player.connected === false && <WifiOff aria-label="غير متصل" />}
            </div>
          ))}
        </div>
        <div className="sijal-turn-area">
          <div className="sijal-previous">
            <span>آخر كلمة</span>
            {previous ? (
              <>
                <WrittenWord word={previous.word} />
                <small>{shortName(players.find((p) => p.id === previous.playerId))}</small>
              </>
            ) : (
              <>
                <b>البداية عندك</b>
                <small>خلّها كلمة حلوة</small>
              </>
            )}
          </div>
          <div className="sijal-letter" key={`${state.round}:${data.turnSequence}`}>
            <span>ابدأ بحرف</span>
            <strong>{letterLabel(data.currentLetter ?? "ا")}</strong>
            <small>{WORD_CATEGORIES[category]}</small>
          </div>
          <div
            className={cn("sijal-clock", seconds <= 5 && "sijal-clock--urgent")}
            role="timer"
            aria-label={`المتبقي ${seconds} ثانية`}
          >
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r="44" />
              <circle
                cx="50"
                cy="50"
                r="44"
                pathLength="100"
                strokeDasharray="100"
                strokeDashoffset={100 - 100 * Math.min(1, remaining / WORD_TURN_MS)}
              />
            </svg>
            <strong>{seconds}</strong>
            <span>ثانية</span>
          </div>
        </div>
        <div className={cn("sijal-turn-status", myTurn && "sijal-turn-status--mine")} role="status">
          {!connected ? (
            <WifiOff />
          ) : myTurn ? (
            <span className="sijal-status-dot" />
          ) : (
            <span className="sijal-status-dot sijal-status-dot--waiting" />
          )}
          {feedback}
          {dictionaryError && <button onClick={loadDictionary}>إعادة المحاولة</button>}
        </div>
        <section className="sijal-chain" aria-label="سلسلة الكلمات">
          <div className="sijal-chain__heading">
            <span>سلسلة السجال</span>
            <small>{words.length} كلمة مقبولة</small>
          </div>
          <div className="sijal-chain__words">
            {words.length ? (
              words.slice(-5).map((word, index, recent) => (
                <div className="sijal-chain__entry" key={`${state.round}:${word.id}`}>
                  <span
                    className={cn(
                      "sijal-chain__word",
                      index === recent.length - 1 && "sijal-chain__word--latest",
                    )}
                  >
                    <WrittenWord word={word.word} />
                    <small>{shortName(players.find((p) => p.id === word.playerId))}</small>
                  </span>
                  {index < recent.length - 1 && <ArrowLeft aria-hidden="true" />}
                </div>
              ))
            ) : (
              <span className="sijal-chain__empty">أول كلمة تبدأ الحكاية…</span>
            )}
          </div>
        </section>
        <form className="sijal-compose" onSubmit={submit}>
          <label htmlFor="sijal-word-input">
            {myTurn
              ? `اكتب كلمة تبدأ بحرف «${letterLabel(data.currentLetter ?? "ا")}»`
              : "جهّز كلمتك للدور القادم"}
          </label>
          <div className="sijal-compose__row">
            <input
              ref={inputRef}
              id="sijal-word-input"
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                setError("");
              }}
              onFocus={focusInput}
              onKeyDown={(event) => {
                if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault();
              }}
              placeholder={myTurn ? "كلمتك هنا…" : "انتظر دورك…"}
              disabled={!actionable}
              maxLength={40}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="send"
              aria-invalid={Boolean(error)}
              aria-describedby="sijal-input-feedback"
            />
            <button
              className="sijal-button sijal-button--primary"
              type="submit"
              aria-label="إرسال الكلمة"
              disabled={!actionable || !input.trim()}
            >
              <Send />
              <span>إرسال الكلمة</span>
            </button>
          </div>
          <div
            id="sijal-input-feedback"
            className={cn("sijal-input-feedback", error && "sijal-input-feedback--error")}
            aria-live="polite"
          >
            {error ||
              (hint?.turnSequence === data.turnSequence && myTurn ? (
                <>
                  <Lightbulb />
                  {hint.text}
                </>
              ) : data.event?.chainRestarted ? (
                "بدأنا حرفًا جديدًا ليكمل السجال."
              ) : (
                "كل كلمة مقبولة تضيف لك نقطة"
              ))}
          </div>
          <div className="sijal-secondary-actions">
            <button
              type="button"
              className="sijal-button"
              onClick={showHint}
              disabled={!actionable || data.hintUsed?.[me.id]}
            >
              <Lightbulb />
              {data.hintUsed?.[me.id] ? "استخدمت التلميح" : "تلميح"}
              {!data.hintUsed?.[me.id] && <small>مرة واحدة</small>}
            </button>
            <button
              type="button"
              className="sijal-button"
              disabled={!actionable}
              onClick={() => {
                void dispatch("word-skip");
              }}
            >
              <SkipForward />
              تخطي الدور
            </button>
          </div>
        </form>
        <footer className="sijal-footer">
          <div className="sijal-progress" aria-label={`الجولة ${round} من ${options.rounds}`}>
            {Array.from({ length: options.rounds }, (_, index) => (
              <span
                className={cn(
                  index + 1 < round && "sijal-progress--done",
                  index + 1 === round && "sijal-progress--current",
                )}
                key={index}
              >
                {index + 1 < round ? <Check /> : index + 1}
              </span>
            ))}
          </div>
          <p>{options.rounds} جولات · لكل لاعب دور في كل جولة</p>
          {isHost && (
            <button className="sijal-finish" onClick={onFinish} disabled={!connected}>
              <Flag />
              إنهاء المباراة
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

export function WordDuelOptions({
  value,
  disabled,
  onChange,
}: {
  value?: Partial<WordOptions>;
  disabled: boolean;
  onChange: (value: WordOptions) => void;
}) {
  const options = normalizeWordOptions(value);
  return (
    <div className="sijal-options" dir="rtl">
      <div className="sijal-options__title">
        <BookOpen />
        <div>
          <strong>إعدادات دفتر الحروف</strong>
          <p>٣٠ ثانية للدور · نقطة لكل كلمة · تلميح واحد لكل لاعب</p>
        </div>
      </div>
      <fieldset disabled={disabled}>
        <legend>عدد الجولات</legend>
        <div className="sijal-options__rounds">
          {([3, 5, 10] as const).map((rounds) => (
            <button
              type="button"
              key={rounds}
              aria-pressed={options.rounds === rounds}
              onClick={() => onChange({ ...options, rounds })}
            >
              {rounds} جولات
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset disabled={disabled}>
        <legend>فئة الكلمات</legend>
        <div className="sijal-options__topics">
          {WORD_TOPICS.map((topic) => (
            <button
              type="button"
              key={topic.id}
              aria-pressed={options.topic === topic.id}
              onClick={() => onChange({ ...options, topic: topic.id })}
            >
              {topic.label}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

export function WordDuelResults({
  state,
  players,
  me,
  isHost,
  connected,
  onRematch,
  onLobby,
}: {
  state: State;
  players: WordPlayer[];
  me: WordPlayer;
  isHost: boolean;
  connected: boolean;
  onRematch: () => void;
  onLobby: () => void;
}) {
  const data = state.data as WordData;
  const ranked = [...players].sort((a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0));
  const winners = players.filter((p) => data.winnerIds?.includes(p.id));
  const [celebrated, setCelebrated] = useState(false);
  useEffect(() => {
    if (!celebrated && winners.length === 1) {
      let allowed = false;
      try {
        allowed =
          JSON.parse(localStorage.getItem("alsaif-game-experience-v2") ?? "{}").sound !== false;
      } catch {
        /* Optional sound preference. */
      }
      if (allowed) playGameSfx(winners[0].id === me.id ? "win" : "lose");
      setCelebrated(true);
    }
  }, [celebrated, me.id, winners]);
  return (
    <section className="sijal-notebook sijal-results" dir="rtl">
      <div className="sijal-notebook__page">
        <span className="sijal-results__emblem">
          <Trophy />
        </span>
        <p className="sijal-edition">دفتر الحروف · المباراة {data.matchNumber ?? 1}</p>
        <h2>
          {winners.length === 1
            ? `فاز ${shortName(winners[0])}!`
            : winners.length
              ? "تعادل جميل!"
              : "انتهى السجال"}
        </h2>
        <p className="sijal-results__subtitle">
          {winners.length === 1
            ? "كلمات أكثر، ونقاط أعلى"
            : winners.length
              ? winners.map(shortName).join(" و ")
              : "لم تُسجّل كلمات في هذه المباراة"}
          {data.endedEarly ? " · أنهى المضيف المباراة" : ` · ${data.options?.rounds ?? 5} جولات`}
        </p>
        <div className="sijal-results__ranking">
          {ranked.map((player, index) => {
            const stats = data.stats?.[player.id];
            return (
              <div
                key={player.id}
                className={cn(
                  "sijal-results__player",
                  data.winnerIds?.includes(player.id) && "sijal-results__player--winner",
                )}
              >
                <span className="sijal-results__rank">{index + 1}</span>
                <Avatar player={player} />
                <div>
                  <strong>
                    {player.name}
                    {player.id === me.id && " (أنت)"}
                  </strong>
                  <small>
                    {stats?.words ?? 0} كلمة · {stats?.skips ?? 0} تخطي · {stats?.timeouts ?? 0}{" "}
                    انتهاء وقت · {stats?.hints ?? 0} تلميح
                  </small>
                  <small>انتصارات الجلسة: {data.sessionWins?.[player.id] ?? 0}</small>
                </div>
                <b>
                  {state.scores[player.id] ?? 0}
                  <small>نقاط</small>
                </b>
              </div>
            );
          })}
        </div>
        {isHost ? (
          <div className="sijal-results__actions">
            <button
              className="sijal-button sijal-button--primary"
              onClick={onRematch}
              disabled={!connected}
            >
              <RefreshCcw />
              مباراة جديدة
            </button>
            <button className="sijal-button" onClick={onLobby} disabled={!connected}>
              <ArrowLeft />
              العودة للغرفة
            </button>
          </div>
        ) : (
          <p className="sijal-results__waiting">بانتظار المضيف لبدء مباراة جديدة…</p>
        )}
        <p className="sijal-results__note">المباراة الجديدة تحفظ اللاعبين، البوتات والإعدادات</p>
      </div>
    </section>
  );
}
