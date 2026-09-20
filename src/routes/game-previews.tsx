import { createFileRoute } from "@tanstack/react-router";
import { Banknote, CircleHelp, Crown, Gem, MoveDiagonal, RotateCcw, Sparkles, Target, Users } from "lucide-react";
import { useState } from "react";
import "./game-previews.css";

export const Route = createFileRoute("/game-previews")({
  ssr: false,
  component: GamePreviews,
});

type PreviewId = "carrom" | "kingdom";

const carromPieces = [
  { color: "ivory", left: "48%", top: "43%" },
  { color: "gold", left: "54%", top: "44%" },
  { color: "ivory", left: "51%", top: "49%" },
  { color: "crimson", left: "48%", top: "50%" },
  { color: "ivory", left: "56%", top: "51%" },
  { color: "gold", left: "44%", top: "48%" },
  { color: "ivory", left: "52%", top: "55%" },
  { color: "crimson", left: "46%", top: "54%" },
];

const kingdomSpaces = [
  ["بوابة الدرعية", "start", "٢٥٠"],
  ["واجهة الرياض", "teal", "٣٥٠"],
  ["صندوق العائلة", "chance", "—"],
  ["العلا", "sand", "٤٠٠"],
  ["محطة قطار", "station", "٥٠٠"],
  ["البحر الأحمر", "blue", "٤٥٠"],
  ["ضريبة الرفاهية", "tax", "—"],
  ["نيوم", "violet", "٦٠٠"],
  ["مجلس الأجداد", "chance", "—"],
  ["جدة التاريخية", "coral", "٥٥٠"],
  ["استراحة", "rest", "—"],
  ["الرياض", "green", "٧٥٠"],
];

function GamePreviews() {
  const [activePreview, setActivePreview] = useState<PreviewId>("carrom");

  return (
    <main className="game-preview-shell" dir="rtl">
      <header className="game-preview-header">
        <div>
          <span className="game-preview-kicker">استوديو النماذج المرئية</span>
          <h1>ميدان الألعاب</h1>
          <p>معاينات تصميمية ثابتة قبل اعتماد تجربة اللعب النهائية.</p>
        </div>
        <div className="game-preview-status"><Sparkles size={16} /> معاينة فقط</div>
      </header>

      <nav className="game-preview-tabs" aria-label="اختيار نموذج اللعبة">
        <button className={activePreview === "carrom" ? "is-active" : ""} onClick={() => setActivePreview("carrom")}>
          <Target size={18} /> الكِيرم
        </button>
        <button className={activePreview === "kingdom" ? "is-active" : ""} onClick={() => setActivePreview("kingdom")}>
          <Crown size={18} /> عقارات المملكة
        </button>
      </nav>

      {activePreview === "carrom" ? <CarromPreview /> : <KingdomPreview />}
    </main>
  );
}

function CarromPreview() {
  return (
    <section className="preview-stage carrom-stage" aria-label="نموذج لعبة الكيرم">
      <div className="stage-topline">
        <div className="stage-title"><Target size={18} /><div><span>جلسة الكِيرم</span><strong>ليلة المجلس</strong></div></div>
        <div className="stage-meta"><span><Users size={15} /> لاعبان</span><span>الدور: سعود</span><button aria-label="تغيير العرض"><MoveDiagonal size={17} /></button></div>
      </div>

      <div className="carrom-layout">
        <aside className="player-rail player-rail-top">
          <div className="player-avatar player-avatar-gold">س</div>
          <div><strong>سعود</strong><span>الدور الحالي</span></div>
          <b>١٢ <small>قطعة</small></b>
        </aside>

        <div className="carrom-majlis">
          <div className="carrom-lamp" />
          <div className="carrom-cushion cushion-one" />
          <div className="carrom-cushion cushion-two" />
          <div className="carrom-board">
            <div className="board-inlay" />
            <div className="board-pocket pocket-a" />
            <div className="board-pocket pocket-b" />
            <div className="board-pocket pocket-c" />
            <div className="board-pocket pocket-d" />
            <div className="aim-line"><span className="aim-spark" /></div>
            {carromPieces.map((piece, index) => <span key={index} className={`carrom-piece piece-${piece.color}`} style={{ left: piece.left, top: piece.top }} />)}
            <div className="striker" />
          </div>
        </div>

        <aside className="player-rail player-rail-bottom">
          <div className="player-avatar player-avatar-rose">ن</div>
          <div><strong>نورة</strong><span>في الانتظار</span></div>
          <b>٠٨ <small>قطعة</small></b>
        </aside>
      </div>

      <div className="carrom-controls">
        <div className="turn-callout"><span className="pulse-dot" /> حرّك خط التصويب ثم اسحب لإطلاق القطعة</div>
        <div className="power-control"><span>القوة</span><div className="power-meter"><i /></div><b>٦٨٪</b></div>
        <button className="preview-button primary">إطلاق القطعة <Target size={17} /></button>
      </div>
    </section>
  );
}

function KingdomPreview() {
  return (
    <section className="preview-stage kingdom-stage" aria-label="نموذج لعبة عقارات المملكة">
      <div className="stage-topline">
        <div className="stage-title"><Crown size={18} /><div><span>رحلة المليونير</span><strong>عقارات المملكة</strong></div></div>
        <div className="stage-meta"><span><Users size={15} /> ٤ لاعبين</span><span>الجولة ٠٣</span><button aria-label="إعادة العرض"><RotateCcw size={17} /></button></div>
      </div>

      <div className="kingdom-layout">
        <div className="kingdom-board-wrap">
          <div className="kingdom-board">
            <div className="board-centerpiece"><Crown size={28} /><strong>رحلة<br />المليونير</strong><span>من أرضنا تبدأ الحكاية</span></div>
            {kingdomSpaces.map(([name, color, price], index) => (
              <div key={name} className={`kingdom-space space-${index} space-${color}`}>
                <span className="space-color" /><strong>{name}</strong><b>{price}</b>
                {index === 3 ? <span className="mini-token token-sand" /> : null}
                {index === 7 ? <span className="mini-token token-gold" /> : null}
              </div>
            ))}
            <span className="kingdom-token token-rose" /><span className="kingdom-token token-teal" />
          </div>
        </div>

        <aside className="kingdom-sidebar">
          <div className="active-investor"><div className="investor-heading"><span className="investor-avatar">ع</span><div><span>دورك الآن</span><strong>عبدالله</strong></div><Gem size={18} /></div><div className="cash-balance"><Banknote size={18} /><strong>١٢٬٨٥٠</strong><span>ريال</span></div></div>
          <div className="property-card"><div className="property-card-band" /><span>ملكية مستحوذ عليها</span><strong>العلا</strong><div><span>قيمة الشراء</span><b>٤٠٠ ريال</b></div><button>عرض التفاصيل</button></div>
          <div className="kingdom-players"><span className="panel-label">اللاعبون</span><PlayerLine name="سارة" cash="١١٬٢٠٠" color="rose" status="متصل" /><PlayerLine name="فيصل" cash="٩٬٧٥٠" color="teal" status="متصل" /><PlayerLine name="نورة" cash="٨٬٤٠٠" color="gold" status="متصل" /></div>
          <div className="kingdom-actions"><button className="preview-button primary">رمي النرد <span className="dice-face">⚄</span></button><button className="preview-button ghost"><CircleHelp size={16} /> قواعد الجولة</button></div>
        </aside>
      </div>
    </section>
  );
}

function PlayerLine({ name, cash, color, status }: { name: string; cash: string; color: string; status: string }) {
  return <div className="player-line"><span className={`line-avatar avatar-${color}`}>{name[0]}</span><div><strong>{name}</strong><span>{status}</span></div><b>{cash}<small> ريال</small></b></div>;
}
