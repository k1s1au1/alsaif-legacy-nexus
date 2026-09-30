import { useCallback, useEffect, useMemo, useState } from "react";
import { Crown, RotateCcw, X } from "lucide-react";
import { MillionaireGameRoom } from "./millionaire-game-room";
import {
  chooseMillionaireBotAction,
  initialMonopolyData,
  reduceMonopoly,
  type MonopolyState,
} from "./millionaire-engine";
import "./millionaire-demo.css";

type Difficulty = "easy" | "medium" | "hard";
type Panel = "guide" | "settings" | "exit" | null;

const DEMO_PLAYERS = [
  { id: "demo-khalid", name: "خالد", avatarUrl: null, isHost: true },
  { id: "demo-saud", name: "سعود", avatarUrl: null, isBot: true },
  { id: "demo-noura", name: "نورة", avatarUrl: null, isBot: true },
  { id: "demo-faisal", name: "فيصل", avatarUrl: null, isBot: true },
];

function newMatch(): MonopolyState {
  return { phase: "playing", scores: {}, data: initialMonopolyData(DEMO_PLAYERS) };
}

export function MillionaireDemo() {
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [state, setState] = useState(newMatch);
  const [panel, setPanel] = useState<Panel>(null);
  const players = useMemo(
    () => DEMO_PLAYERS.map((player) => ({ ...player, difficulty })),
    [difficulty],
  );

  const dispatch = useCallback(async (type: string, value?: unknown) => {
    setState((current) => reduceMonopoly(current, { type, value, playerId: DEMO_PLAYERS[0].id }, players));
  }, [players]);

  useEffect(() => {
    if (panel) return;
    const action = chooseMillionaireBotAction(state, players);
    if (!action) return;
    const timer = window.setTimeout(() => {
      setState((current) => reduceMonopoly(current, action, players));
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [state, players, panel]);

  useEffect(() => {
    if (!panel) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanel(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [panel]);

  const restart = () => {
    setState(newMatch());
    setPanel(null);
  };
  const winner = players.find((player) => player.id === state.data.winnerId);
  const victoryLabels: Record<string, string> = {
    line: "الاحتكار الخطي",
    triple: "الاحتكار الثلاثي",
    tourism: "الاحتكار السياحي",
    bankruptcy: "إفلاس المنافسين",
  };

  return (
    <main className="millionaire-demo" dir="rtl">
      <MillionaireGameRoom
        key={state.phase === "playing" ? "playing" : "finished"}
        state={state}
        players={players}
        me={players[0]}
        immersive
        dispatch={dispatch}
        onGuide={() => setPanel("guide")}
        onSettings={() => setPanel("settings")}
        onExit={() => setPanel("exit")}
      />

      {(panel || state.phase === "results") && (
        <div className="millionaire-demo__overlay">
          <section className="millionaire-demo__panel" role="dialog" aria-modal="true" aria-labelledby="millionaire-demo-title">
            {state.phase !== "results" && (
              <button className="millionaire-demo__close" aria-label="العودة إلى اللعبة" onClick={() => setPanel(null)}><X /></button>
            )}
            {state.phase === "results" ? (
              <>
                <Crown className="millionaire-demo__trophy" />
                <h1 id="millionaire-demo-title">{winner?.name ?? "المستثمر"} فاز بالرحلة</h1>
                <p>{victoryLabels[state.data.victoryType] ?? "اكتملت المباراة"}</p>
                <button className="millionaire-demo__primary" onClick={restart}><RotateCcw /> مباراة جديدة</button>
              </>
            ) : panel === "guide" ? (
              <>
                <h1 id="millionaire-demo-title">طريقة اللعب</h1>
                <p>ارمِ النرد، اشترِ المدن التي تصل إليها، ثم طوّرها إلى مبانٍ وفنادق ومعالم. يدفع لك المنافسون رسومًا عند زيارتها.</p>
                <p>اجمع مدن المجموعة لمضاعفة الرسوم. تفوز باحتكار جهة كاملة، أو ثلاث مجموعات، أو كل المواقع السياحية، أو بإفلاس المنافسين.</p>
                <p>استفد من بطاقات الفرصة والسفر والمهرجانات. عند نقص السيولة، بع بعض أملاكك لتسديد الرسوم.</p>
                <p>تلعب هذه التجربة ضد ثلاثة بوتات، ويمكنك تغيير مستواهم من الإعدادات.</p>
                <button className="millionaire-demo__primary" onClick={() => setPanel(null)}>العودة إلى اللعب</button>
              </>
            ) : panel === "settings" ? (
              <>
                <h1 id="millionaire-demo-title">إعدادات التجربة</h1>
                <label htmlFor="millionaire-demo-difficulty">مستوى البوتات</label>
                <select id="millionaire-demo-difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty)}>
                  <option value="easy">سهل</option><option value="medium">متوسط</option><option value="hard">صعب</option>
                </select>
                <button className="millionaire-demo__primary" onClick={() => setPanel(null)}>متابعة المباراة</button>
                <button className="millionaire-demo__secondary" onClick={restart}><RotateCcw /> بدء مباراة جديدة</button>
              </>
            ) : (
              <>
                <h1 id="millionaire-demo-title">مباراة التجربة</h1>
                <button className="millionaire-demo__primary" onClick={() => setPanel(null)}>متابعة اللعب</button>
                <button className="millionaire-demo__secondary" onClick={restart}><RotateCcw /> بدء مباراة جديدة</button>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
