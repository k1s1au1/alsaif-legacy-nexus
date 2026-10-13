import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, Bookmark, ChevronLeft, Clock, ExternalLink, MapPin, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { usePrayerTimes, setPrayerCity } from "@/hooks/use-prayer-times";
import { useMushafBookmark } from "@/hooks/use-mushaf-bookmark";
import { useProfile } from "@/hooks/use-dashboard-data";
import { MUSHAF_JUZ, MUSHAF_SOURCE, MUSHAF_SURAHS, mushafPageLabel, normalizedSurahSearch } from "@/lib/mushaf";
import { PRAYER_CITIES, PRAYER_KEYS, PRAYER_NAMES, formatPrayerTime } from "@/lib/prayer-times";
import { MushafReader } from "./mushaf-reader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import "./faith.css";

export function FaithCenter({ view, onViewChange }: { view: "prayer" | "mushaf"; onViewChange: (view: "prayer" | "mushaf") => void }) {
  const times = usePrayerTimes();
  const { data: profile } = useProfile();
  const reading = useMushafBookmark(profile?.id || undefined);
  const [readerPage, setReaderPage] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [indexType, setIndexType] = useState<"surah" | "juz">("surah");
  const surahs = MUSHAF_SURAHS.filter((item) => normalizedSurahSearch(item.name).includes(normalizedSurahSearch(search)) || String(item.id) === search.trim());
  const format = new Intl.NumberFormat("ar-SA");

  return <div className="faith-page" dir="rtl">
    <header className="faith-page-heading"><div><Link to="/dashboard">الرئيسية <ChevronLeft size={14} /></Link><h1>الصلاة ومصحفي</h1><p>مواقيت يومك، ومصحفك في مكان واحد</p></div><BookOpen size={35} aria-hidden="true" /></header>
    <section className="faith-prayer-summary" aria-label="الصلاة القادمة">
      <div className="faith-summary-next"><Clock size={31} aria-hidden="true" /><div><small>الصلاة القادمة</small><strong>{times.prayer?.name || (times.city ? "تحميل المواقيت…" : "اختر مدينتك")}</strong>{times.prayer && <span>{times.countdown}</span>}</div></div>
      <label className="faith-city-selector"><span><MapPin size={15} /> المدينة</span><select value={times.city?.id || ""} onChange={(event) => setPrayerCity(event.target.value)}><option value="" disabled>اختر مدينتك</option>{PRAYER_CITIES.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label>
      <button type="button" className="faith-button faith-button-light" onClick={() => onViewChange("prayer")}>كل المواقيت <ChevronLeft size={16} /></button>
    </section>
    <Tabs value={view} onValueChange={(value) => onViewChange(value as "prayer" | "mushaf")} dir="rtl">
      <TabsList className="faith-tabs"><TabsTrigger value="mushaf"><BookOpen size={18} /> مصحفي</TabsTrigger><TabsTrigger value="prayer"><Clock size={18} /> مواقيت الصلاة</TabsTrigger></TabsList>
      <TabsContent value="prayer" className="faith-tab-content">
        <section className="faith-prayer-panel">
          <div className="faith-panel-heading"><div><h2>مواقيت الصلاة</h2><p>{times.city ? `${times.city.name} · ${new Intl.DateTimeFormat("ar-SA", { timeZone: "Asia/Riyadh", weekday: "long", day: "numeric", month: "long" }).format(times.now)}` : "اختر مدينتك لعرض المواقيت الصحيحة"}</p></div><button type="button" className="faith-icon-button" disabled={!times.city || times.refreshing} onClick={times.refresh} aria-label="تحديث مواقيت الصلاة"><RefreshCw size={18} className={times.refreshing ? "animate-spin" : ""} /></button></div>
          {!times.city ? <div className="faith-empty"><MapPin size={35} /><p>حدد المدينة من القائمة بالأعلى. يُحفظ اختيارك على هذا الجهاز.</p></div> : times.today ? <div className="faith-prayer-grid">{PRAYER_KEYS.map((key) => <article key={key} className={`faith-prayer-time${times.prayer?.key === key && times.prayer.date === times.date ? " is-next" : ""}`}><Clock size={21} aria-hidden="true" /><strong>{PRAYER_NAMES[key]}</strong><time dateTime={times.today!.timings[key]}>{formatPrayerTime(times.today!.timings[key])}</time>{times.prayer?.key === key && times.prayer.date === times.date && <small>الصلاة القادمة</small>}</article>)}</div> : <div className="faith-empty" role="status"><Clock size={30} /><p>{times.error ? "تعذر تحميل المواقيت. تحقق من الاتصال وأعد المحاولة." : "جاري تحميل مواقيت مدينتك…"}</p>{times.error && <button type="button" className="faith-button" onClick={times.refresh}>إعادة المحاولة</button>}</div>}
          {times.today && times.error && <p className="faith-message" role="status">تظهر المواقيت المحفوظة لهذا اليوم. تعذر تحديثها الآن.</p>}
          <p className="faith-source-note">طريقة الحساب: أم القرى · توقيت المملكة العربية السعودية. <a href="https://aladhan.com/calculation-methods" target="_blank" rel="noopener noreferrer">تفاصيل المصدر <ExternalLink size={12} /></a></p>
          <p className="faith-source-note">تُحفظ مواقيت الشهر على الجهاز بعد تحميلها لتظهر دون إنترنت.</p>
        </section>
      </TabsContent>
      <TabsContent value="mushaf" className="faith-tab-content">
        {readerPage !== null ? <MushafReader initialPage={readerPage} onRead={reading.savePage} onClose={() => setReaderPage(null)} /> : <>
          <div className="faith-mushaf-overview">
            <section className="faith-resume-card">
              <div className="faith-mushaf-cover" aria-hidden="true"><BookOpen size={38} /><span>مصحفي</span></div>
              <div className="faith-resume-copy"><small><Bookmark size={14} /> وردك اليومي</small><h2>{reading.lastPage ? "أكمل قراءتك" : "ابدأ القراءة"}</h2><p>{reading.lastPage ? `${mushafPageLabel(reading.lastPage)} · صفحة ${format.format(reading.lastPage)}` : MUSHAF_SOURCE.narration}</p><button type="button" className="faith-button" onClick={() => setReaderPage(reading.lastPage || 1)}>{reading.lastPage ? "متابعة القراءة" : "فتح مصحفي"}<ChevronLeft size={17} /></button></div>
            </section>
            <aside className="faith-mushaf-source"><ShieldCheck size={27} /><div><h2>من مصدر سعودي رسمي</h2><p>صفحات مصوّرة من مصحف المدينة، من مشروع «آيات» بجامعة الملك سعود، تُعرض كما وردت من المصدر.</p><a href={MUSHAF_SOURCE.url} target="_blank" rel="noopener noreferrer">زيارة موقع جامعة الملك سعود للمصحف <ExternalLink size={14} /></a></div></aside>
          </div>
          <section className="faith-index-panel" aria-label="فهرس مصحفي">
            <div className="faith-panel-heading"><h2>فهرس مصحفي</h2><div className="faith-index-switch"><button type="button" aria-pressed={indexType === "surah"} onClick={() => setIndexType("surah")}>السور</button><button type="button" aria-pressed={indexType === "juz"} onClick={() => setIndexType("juz")}>الأجزاء</button></div></div>
            {indexType === "surah" ? <><label className="faith-search"><Search size={19} /><input type="search" placeholder="ابحث عن سورة" aria-label="البحث في أسماء السور" value={search} onChange={(event) => setSearch(event.target.value)} /></label><div className="faith-surah-list">{surahs.map((surah) => <button type="button" key={surah.id} onClick={() => setReaderPage(surah.page)}><span className="faith-surah-number">{format.format(surah.id)}</span><strong>{surah.name}</strong><small>{format.format(surah.ayahs)} آية</small><ChevronLeft size={17} /></button>)}</div>{!surahs.length && <p className="faith-empty">لم نجد سورة بهذا الاسم.</p>}</> : <div className="faith-juz-list">{MUSHAF_JUZ.map((juz) => <button type="button" key={juz.id} onClick={() => setReaderPage(juz.page)}><BookOpen size={20} /><strong>الجزء {format.format(juz.id)}</strong><small>صفحة {format.format(juz.page)}</small></button>)}</div>}
          </section>
        </>}
      </TabsContent>
    </Tabs>
  </div>;
}
