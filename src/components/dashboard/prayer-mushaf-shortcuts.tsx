import { Link } from "@tanstack/react-router";
import { BookOpen, Clock } from "lucide-react";
import { usePrayerTimes } from "@/hooks/use-prayer-times";
import "@/components/faith/faith.css";

export function PrayerMushafShortcuts({ desktop = false }: { desktop?: boolean }) {
  const { location, locationLabel, locating, prayer, countdown, loading } = usePrayerTimes();
  return <section className={`faith-home-shortcuts${desktop ? " faith-home-shortcuts-desktop" : ""}`} aria-label="الصلاة ومصحفي" dir="rtl">
    <Link to="/faith" search={{ view: "prayer" }} className="faith-home-link" aria-label={location && prayer ? `مواقيت ${locationLabel}، الصلاة القادمة ${prayer.name}، ${countdown}` : "مواقيت الصلاة حسب موقعك"}>
      <Clock className="faith-home-icon" aria-hidden="true" />
      <span><strong>{prayer?.name || "مواقيت الصلاة"}</strong><small>{locating ? "جاري تحديد موقعك…" : !location ? "حدد موقعك" : loading ? "تحميل المواقيت…" : locationLabel === "آخر موقع محدد" ? "حسب آخر موقع محدد" : prayer ? countdown : "عرض المواقيت"}</small></span>
    </Link>
    <span className="faith-home-divider" aria-hidden="true" />
    <Link to="/faith" search={{ view: "mushaf" }} className="faith-home-link faith-home-reading" aria-label="فتح مصحفي واستكمال آخر قراءة">
      <BookOpen className="faith-home-icon" aria-hidden="true" />
      <span><strong>مصحفي</strong><small>أكمل قراءتك</small></span>
    </Link>
  </section>;
}
