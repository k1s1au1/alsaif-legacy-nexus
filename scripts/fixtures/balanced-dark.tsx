// Actual shared components, with demo data and the existing responsive shell classes.
import React from "react";
import { createRoot } from "react-dom/client";
import {
  Bell,
  Home,
  LayoutGrid,
  ListChecks,
  MessageCircle,
  MoreHorizontal,
  Plane,
  Users,
  Wallet,
} from "lucide-react";
import { HeritagePortal3D } from "../../src/components/dashboard/heritage-portal-3d";
import { PrayerMushafShortcuts } from "../../src/components/dashboard/prayer-mushaf-shortcuts";
import { FamilyStatsStrip } from "../../src/components/dashboard/family-stats-strip";
import { FollowupNoteCard } from "../../src/components/dashboard/followup-note-card";
import { FamilySealHeader } from "../../src/components/family-seal-header";
import { TripTicket } from "../../src/components/trip-ticket";
import { Button } from "../../src/components/ui/button";
import { Input } from "../../src/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "../../src/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../src/components/ui/select";
import { applyThemePreference, createCustomThemePreference } from "../../src/lib/theme-preferences";
import { THEME_COLORS } from "../../src/lib/themes";
import tripPhoto from "../../src/assets/trip-alula.jpg";
import "../../src/settings-responsive.css";
import "../../src/chat-workspace.css";
import "../../src/components/meetings-ledger.css";
import "../../src/components/family-album-book.css";
import "../../src/admin-executive.css";
import "../../src/components/legacy-reference.css";
import "../../src/components/legacy-reference-fixes.css";

const win = window as any;
const tablet = new URLSearchParams(location.search).has("tablet");
const wide = innerWidth >= 970;
const desktop = wide && !tablet;
document.documentElement.dataset.dashboardTabletLandscape = tablet ? "true" : "false";
document.documentElement.classList.add("dark");
win.qaTheme = (presetId: string) => applyThemePreference({ mode: "preset", presetId });
win.qaCustom = () =>
  applyThemePreference({
    ...createCustomThemePreference("emerald"),
    textId: "royal-gold",
    iconId: "royal-copper",
    surfaceId: "midnight",
    navigationId: "heritage-maroon",
    accentId: "muted-palm",
  });
win.qaLight = () => {
  document.documentElement.classList.remove("dark");
  applyThemePreference({ mode: "preset", presetId: "emerald" });
};
win.qaDark = () => {
  document.documentElement.classList.add("dark");
  win.qaTheme("emerald");
};
win.qaThemes = THEME_COLORS.map((theme) => theme.id);
win.qaTheme("emerald");
const services = [
  [Wallet, "الصندوق المالي"],
  [ListChecks, "المهام"],
  [Plane, "الرحلات"],
  [Users, "الاجتماعات"],
] as const;
const trip = {
  title: "رحلة العلا العائلية",
  status: "upcoming",
  location: "العلا",
  badge: null,
  description: "لقاء عائلي بين معالم العلا",
  start_date: "2026-11-20",
  end_date: "2026-11-23",
};

function Cards() {
  return (
    <div className="qa-card-grid" id="qa-cards">
      <TripTicket
        trip={trip}
        image={<img src={tripPhoto} alt="العلا" />}
        details={<a href="#details">التفاصيل</a>}
        actions={
          <>
            <button>تعديل</button>
            <button className="trip-ticket__delete">حذف</button>
          </>
        }
        compact
      />
      <TripTicket
        trip={{
          ...trip,
          status: "planning",
          title: "رحلة الأحساء",
          start_date: null,
          end_date: null,
        }}
        image={<img src={tripPhoto} alt="صورة الرحلة" />}
        details={<a href="#details">التفاصيل</a>}
        compact
      />
      <FollowupNoteCard
        kind="meeting"
        title="لقاء العائلة الشهري"
        date="2026-11-20T18:00:00"
        location="مجلس العائلة"
        action={<button>فتح الاجتماع</button>}
      />
      <FollowupNoteCard
        kind="task"
        title="تنظيم شجرة العائلة"
        date="2026-11-22"
        action={<a href="#task">فتح المهمة</a>}
      />
    </div>
  );
}
function Services({ desktop = false }) {
  return (
    <section className={desktop ? "desktop-services-panel" : "family-services-section"}>
      <div
        className={
          desktop ? "desktop-section-head desktop-section-head-on-dark" : "family-services-heading"
        }
      >
        <h3>خدمات العائلة</h3>
      </div>
      <div className={desktop ? "desktop-services-grid" : "family-services-grid"}>
        {services.map(([Icon, label]) => (
          <a
            href="#service"
            key={label}
            className={desktop ? "desktop-service-card" : "family-service-card"}
          >
            <span className={desktop ? "desktop-service-icon" : "family-service-icon"}>
              <Icon size={23} />
            </span>
            <strong className={desktop ? "" : "family-service-label"}>{label}</strong>
            <span className={desktop ? "" : "family-service-description"}>خدمات العائلة</span>
          </a>
        ))}
      </div>
    </section>
  );
}
function Controls() {
  return (
    <section className="qa-controls settings-page" id="qa-controls">
      <div className="settings-nav-links qa-panel">
        <button className="is-active" id="qa-settings-active">
          المظهر والهوية
        </button>
      </div>
      <div className="admin-navigation qa-panel">
        <nav>
          <button className="is-active" id="qa-admin-active">
            الإدارة
          </button>
        </nav>
      </div>
      <div className="legacy-heritage-hero qa-panel">
        <div className="legacy-heritage-copy">
          <h2>نسب وأثر</h2>
          <p>إرث العائلة</p>
        </div>
      </div>
      <div className="settings-panel card-surface qa-panel">
        <h2>معاينة الوضع الداكن</h2>
        <p className="text-muted-foreground">مكوّنات فعلية · بيانات تجريبية</p>
        <label htmlFor="qa-input">عنوان المهمة</label>
        <Input id="qa-input" placeholder="اكتب العنوان هنا" />
        <Select defaultValue="planning">
          <SelectTrigger id="qa-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="planning">قيد التخطيط</SelectItem>
            <SelectItem value="upcoming">قادمة</SelectItem>
          </SelectContent>
        </Select>
        <div className="qa-buttons">
          <Button id="qa-primary">حفظ</Button>
          <Button variant="destructive" id="qa-destructive">
            حذف
          </Button>
          <Button variant="outline">إلغاء</Button>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary" id="qa-open-dialog">
              فتح التفاصيل
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>تفاصيل الرحلة</DialogTitle>
            <DialogDescription>معاينة النصوص والحقول في النوافذ المنبثقة</DialogDescription>
            <Input placeholder="الوصف" />
            <Button>حفظ التعديل</Button>
          </DialogContent>
        </Dialog>
      </div>
      <div className="meetings-ledger qa-panel">
        <h2>الاجتماعات</h2>
        <p className="text-muted-foreground">المواعيد والتفاصيل</p>
      </div>
      <div className="family-album qa-panel">
        <h2>ألبوم العائلة</h2>
        <p className="text-muted-foreground">الصور تحتفظ بألوانها الأصلية</p>
      </div>
      <div className="chat-workspace qa-panel" style={{ height: "auto", padding: 20 }}>
        <div>
          <h2>الدردشة</h2>
          <p className="text-muted-foreground">نص الرسالة</p>
        </div>
      </div>
    </section>
  );
}
function Header() {
  return (
    <div
      className="app-shell-header-wrap z-[80] fixed top-4 inset-x-0 px-4 md:sticky md:top-0 md:inset-x-0 md:px-0 flex justify-center"
      data-family-seal={wide ? "true" : undefined}
    >
      {wide ? (
        <FamilySealHeader
          logo="/logo-home.png"
          title="السيف"
          path="/dashboard"
          shortcuts={[]}
          services={[]}
          onOpenMenu={() => {}}
          account={<span>حساب المعاينة</span>}
          notifications={<Bell size={18} />}
        />
      ) : (
        <header
          className="app-shell-header flex items-center justify-between h-14 w-full rounded-full px-4 border border-white/10 relative overflow-hidden"
          dir="rtl"
        >
          <span className="qa-avatar">ع</span>
          <b>08:13 م</b>
          <img src="/logo-home.png" alt="السيف" width={44} height={44} />
        </header>
      )}
    </div>
  );
}
function Dock() {
  return (
    <div
      className={`app-shell-bottom-dock fixed bottom-8 inset-x-6 z-[70] flex justify-center ${wide ? "md:hidden" : ""}`}
    >
      <nav
        className="app-shell-curved-dock h-16 w-full max-w-sm rounded-[32px] flex items-center justify-around px-4 relative"
        aria-label="شريط التنقل السفلي"
      >
        <svg
          className="app-shell-dock-curve"
          viewBox="0 0 1000 82"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M -20 72 Q 500 -18 1020 72" />
        </svg>
        {[
          [Home, "الرئيسية"],
          [MessageCircle, "محادثة"],
          [LayoutGrid, "خدمات العائلة"],
          [Wallet, "الصندوق"],
          [MoreHorizontal, "المزيد"],
        ].map(([Icon, label]: any, index) => (
          <React.Fragment key={label}>
            {index > 0 && <span className="app-shell-dock-separator" />}
            <a
              href="#nav"
              className={`app-shell-dock-item ${index === 0 ? "is-active" : ""}`}
              aria-current={index === 0 ? "page" : undefined}
            >
              <Icon />
              <span>{label}</span>
            </a>
          </React.Fragment>
        ))}
      </nav>
    </div>
  );
}
function Fixture() {
  const hero = (
    <HeritagePortal3D
      greeting="مساء الخير"
      name="حساب المعاينة"
      message="نصل العائلة، نحفظ الإرث، ونبني المستقبل."
      visitorCount={1248}
      className={desktop ? "desktop-portal-model" : "dashboard-portal-model"}
    />
  );
  const stats = (
    <FamilyStatsStrip
      balance={125000}
      members={24}
      trips={3}
      tasks={5}
      className={wide ? "family-stats-strip--desktop" : ""}
    />
  );
  return (
    <>
      <main
        className="app-shell-main relative min-h-screen pb-40 md:pb-24"
        data-tablet-portrait={innerWidth >= 600 && !wide ? "true" : undefined}
      >
        <Header />
        <div className="app-shell-content p-4 md:p-8 lg:p-12 mx-auto max-w-7xl">
          {desktop ? (
            <div className="desktop-rebuild-shell">
              <div className="desktop-rebuild-root">
                <PrayerMushafShortcuts desktop />
                <section className="desktop-overview-shell">
                  <div className="desktop-portal-stage">{hero}</div>
                  <Services desktop />
                </section>
                {stats}
                <Cards />
              </div>
            </div>
          ) : (
            <div className="dashboard-page max-w-6xl mx-auto space-y-12">
              <section className="dashboard-spiritual dashboard-faith-strip">
                <div className="dashboard-faith-meta">
                  <span>نفحات إيمانية</span>
                </div>
                <p>مجلس يجمعنا على المودة</p>
              </section>
              <section className="dashboard-hero dashboard-portal-hero has-faith-shortcuts">
                <div className="dashboard-portal-card">
                  <PrayerMushafShortcuts />
                  <div className="dashboard-portal-layout">{hero}</div>
                </div>
              </section>
              <Services />
              <div hidden />
              <div hidden />
              <div hidden />
              {!tablet && stats}
              {!tablet && <Cards />}
            </div>
          )}
          {tablet && (
            <div className="tablet-landscape-desktop-content">
              <div className="desktop-rebuild-root">
                {stats}
                <Cards />
              </div>
            </div>
          )}
          <Controls />
        </div>
        <Dock />
      </main>
    </>
  );
}
createRoot(document.getElementById("app")!).render(<Fixture />);
win.fixtureReady = true;
