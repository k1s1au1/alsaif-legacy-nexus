import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, Bookmark, ChevronLeft, Clock, ExternalLink, LocateFixed, MapPin, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { usePrayerTimes } from "@/hooks/use-prayer-times";
import { useMushafBookmark } from "@/hooks/use-mushaf-bookmark";
import { useProfile } from "@/hooks/use-dashboard-data";
import { MUSHAF_JUZ, MUSHAF_SOURCE, MUSHAF_SURAHS, mushafPageLabel, normalizedSurahSearch } from "@/lib/mushaf";
import { PRAYER_KEYS, PRAYER_NAMES, formatPrayerTime } from "@/lib/prayer-times";
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
      <div className="faith-summary-next"><Clock size={31} aria-hidden="true" /><div><small>الصلاة القادمة</small><strong>{times.prayer?.name || (times.locating ? "تحديد الموقع…" : times.location ? times.error ? "المواقيت غير متاحة" : "تحميل المواقيت…" : "حدد موقعك")}</strong>{times.prayer && <span>{times.countdown}</span>}</div></div>
      <div className="faith-location-control"><span><MapPin size={15} /> {times.location ? times.locationLabel : "المواقيت حسب موقعك"}</span><button type="button" className="faith-button faith-button-gps" onClick={times.locate} disabled={times.locating}><LocateFixed size={18} className={times.locating ? "animate-pulse" : ""} />{times.locating ? "جاري تحديد موقعك…" : times.location ? "تحديث موقعي" : "تحديد موقعي"}</button></div>
      <button type="button" className="faith-button faith-button-light" onClick={() => onViewChange("prayer")}>كل المواقيت <ChevronLeft size={16} /></button>
    </section>
    {times.locationError && <p className="faith-location-message" role="alert"><MapPin size={18} />{times.locationError}{times.location && " تظهر مواقيت آخر موقع محدد على هذا الجهاز."}</p>}
    <Tabs value={view} onValueChange={(value) => onViewChange(value as "prayer" | "mushaf")} dir="rtl">
      <TabsList className="faith-tabs"><TabsTrigger value="mushaf"><BookOpen size={18} /> مصحفي</TabsTrigger><TabsTrigger value="prayer"><Clock size={18} /> مواقيت الصلاة</TabsTrigger></TabsList>
      <TabsContent value="prayer" className="faith-tab-content">
        <section className="faith-prayer-panel">
          <div className="faith-panel-heading"><div><h2>مواقيت الصلاة</h2><p>{times.location ? `${times.locationLabel} · ${new Intl.DateTimeFormat("ar-SA", { timeZone: times.timeZone, weekday: "long", day: "numeric", month: "long" }).format(times.now)}` : "اسمح بالموقع لعرض المواقيت في مكانك"}</p></div><button type="button" className="faith-icon-button" disabled={!times.location || times.refreshing} onClick={times.refresh} aria-label="تحديث مواقيت الصلاة"><RefreshCw size={18} className={times.refreshing ? "animate-spin" : ""} /></button></div>
          {!times.location ? <div className="faith-empty"><LocateFixed size={35} /><p>{times.locating ? "جاري تحديد موقعك…" : "اضغط «تحديد موقعي» واسمح بالوصول إلى الموقع. تظهر المواقيت حسب إحداثياتك دون اختيار مدينة."}</p></div> : times.today ? <div className="faith-prayer-grid">{PRAYER_KEYS.map((key) => <article key={key} className={`faith-prayer-time${times.prayer?.key === key && times.prayer.date === times.date ? " is-next" : ""}`}><Clock size={21} aria-hidden="true" /><strong>{PRAYER_NAMES[key]}</strong><time dateTime={times.today!.timings[key]}>{formatPrayerTime(times.today!.timings[key], times.timeZone)}</time>{times.prayer?.key === key && times.prayer.date === times.date && <small>الصلاة القادمة</small>}</article>)}</div> : <div className="faith-empty" role="status"><Clock size={30} /><p>{times.error ? "تعذر تحميل المواقيت. تحقق من الاتصال وأعد المحاولة." : "جاري تحميل المواقيت حسب موقعك…"}</p>{times.error && <button type="button" className="faith-button" onClick={times.refresh}>إعادة المحاولة</button>}</div>}
          {times.today && times.error && <p className="faith-message" role="status">تظهر المواقيت المحفوظة لهذا اليوم. تعذر تحديثها الآن.</p>}
          {times.location && <p className="faith-source-note">{times.location.accuracy > 5000 ? "الموقع الذي سمح به الجهاز تقريبي؛ فعّل الموقع الدقيق للحصول على مواقيت أدق. " : ""}{times.locationLabel === "آخر موقع محدد" && "هذه المواقيت لآخر موقع محفوظ؛ حدّث موقعك إذا انتقلت. "}آخر تحديد: {new Intl.DateTimeFormat("ar-SA", { timeZone: times.timeZone, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(times.location.obtainedAt))}.</p>}
          <p className="faith-source-note">طريقة الحساب: أم القرى · {times.timeZone === "Asia/Riyadh" ? "توقيت المملكة العربية السعودية" : "توقيت موقعك"}. <a href="https://aladhan.com/calculation-methods" target="_blank" rel="noopener noreferrer">تفاصيل المصدر <ExternalLink size={12} /></a></p>
          <p className="faith-source-note">نستخدم موقعك لحساب المواقيت عبر خدمة AlAdhan. يُحفظ آخر موقع ومواقيت الشهر على جهازك لتظهر دون إنترنت.</p>
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
