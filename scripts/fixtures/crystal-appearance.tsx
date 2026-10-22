import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Bell, CalendarDays, Menu, Settings, ShieldCheck, UserRound } from "lucide-react";
import { FamilySealHeader } from "../../src/components/family-seal-header";
import { HeritagePortal3D } from "../../src/components/dashboard/heritage-portal-3d";
import { FamilyServicesPaper } from "../../src/components/dashboard/family-services-paper";
import { InterfaceMaterialPicker } from "../../src/components/interface-material-picker";
import { ThemeCustomizationDialog } from "../../src/components/theme-customization-dialog";
import { LiquidGlassEffects } from "../../src/components/liquid-glass-effects";
import { Button } from "../../src/components/ui/button";
import { Input } from "../../src/components/ui/input";
import { Switch } from "../../src/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../src/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../src/components/ui/dialog";
import { applyThemePreference, createCustomThemePreference, parseThemePreference, serializeThemePreference, type ThemePreference } from "../../src/lib/theme-preferences";
import { THEME_COLORS } from "../../src/lib/themes";
import "../../src/settings-responsive.css";

const win = window as any;
const tablet = new URLSearchParams(location.search).has("tablet");
const wide = innerWidth >= 970;
// CI has no attached mouse. The desktop scenario sends real CDP mouse events,
// so expose that hardware capability while keeping motion/transparency media native.
if (wide && !tablet) {
  const nativeMatchMedia = window.matchMedia.bind(window);
  window.matchMedia = (query: string) => {
    const media = nativeMatchMedia(query);
    if (query === "(hover: hover) and (pointer: fine)") {
      Object.defineProperty(media, "matches", { value: true });
    }
    return media;
  };
}
if (new URLSearchParams(location.search).has("reset")) localStorage.removeItem("app-theme-color-id");
document.documentElement.dataset.dashboardTabletLandscape = String(tablet);
win.qaThemes = THEME_COLORS.map((theme) => theme.id);

function Fixture() {
  const [preference, setPreference] = useState<ThemePreference>(() => parseThemePreference(localStorage.getItem("app-theme-color-id")));
  const [editor, setEditor] = useState(false);
  const [details, setDetails] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const save = (next: ThemePreference) => {
    localStorage.setItem("app-theme-color-id", serializeThemePreference(next));
    applyThemePreference(next);
    setPreference(next);
    setEditor(false);
  };
  win.qaTheme = (presetId: string, dark = false) => {
    document.documentElement.classList.toggle("dark", dark);
    save({ mode: "preset", presetId, material: preference.material });
  };
  win.qaCustom = () => save({ ...createCustomThemePreference(), textId: "royal-copper", iconId: "family-ivory", navigationId: "heritage-maroon", surfaceId: "muted-palm", accentId: "royal-gold", material: preference.material });
  applyThemePreference(preference);
  const services = <FamilyServicesPaper className={wide && !tablet ? "desktop-services-panel" : "family-services-section"} />;
  return (
    <main className="app-shell-main">
      <LiquidGlassEffects />
      <div className="app-shell-header-wrap" data-family-seal={wide ? "true" : undefined}>
        {wide ? <FamilySealHeader
          logo="/logo-home.png" title="الرئيسية" path="/dashboard"
          shortcuts={[
            { id: "calendar", label: "التقويم", to: "/calendar", icon: CalendarDays },
            { id: "admin", label: "الإدارة", to: "/admin", icon: ShieldCheck },
          ]}
          services={[{ id: "calendar", label: "التقويم", to: "/calendar", icon: CalendarDays }]}
          onOpenMenu={() => {}}
          account={<button aria-label="الحساب"><UserRound /></button>}
          notifications={<button aria-label="الإشعارات"><Bell /></button>}
        /> : <header className="app-shell-header"><img src="/logo-home.png" alt="السيف" /><b>لوحة العائلة</b><button aria-label="الإعدادات"><Settings /></button></header>}
      </div>
      <div className="app-shell-content">
        <div className={wide && !tablet ? "desktop-rebuild-shell" : "dashboard-page max-w-6xl mx-auto space-y-12"}>
          <div className={wide && !tablet ? "desktop-rebuild-root" : "qa-tablet-content"}>
            <section className={wide && !tablet ? "desktop-faith-strip" : "dashboard-spiritual dashboard-faith-strip"}><p>خيركم خيركم لأهله</p></section>
            <section className={wide && !tablet ? "desktop-portal-stage" : "dashboard-portal-card"}>
              <HeritagePortal3D greeting="مساء النور" name="خالد عبدالعزيز ابراهيم" message="المجلس يرحب بكم دائماً يا أهل الوفاء." visitorCount={2} />
            </section>
            {wide && !tablet ? <section className="desktop-overview-shell">{services}</section> : services}
          </div>
        </div>
        <section className="settings-page qa-settings card-surface">
          <InterfaceMaterialPicker value={preference.material ?? "classic"} onChange={(material) => save({ ...preference, material })} />
          <button className="btn-gold qa-open-colors" onClick={() => setEditor(true)}>ألوان الموقع</button>
          <div className="qa-controls">
            <h3>إدارة خدمات العائلة</h3>
            <Input className="qa-search" type="search" aria-label="البحث في الخدمات" placeholder="ابحث في خدمات العائلة" />
            <Tabs defaultValue="upcoming">
              <TabsList><TabsTrigger value="upcoming">القادمة</TabsTrigger><TabsTrigger value="saved">المحفوظة</TabsTrigger></TabsList>
              <TabsContent value="upcoming">الاجتماعات والرحلات القادمة</TabsContent>
              <TabsContent value="saved">الخدمات المحفوظة</TabsContent>
            </Tabs>
            <label className="qa-switch-row">تنبيهات العائلة <Switch aria-label="تنبيهات العائلة" checked={notifications} onCheckedChange={setNotifications} /></label>
            <Button className="qa-open-details" onClick={() => setDetails(true)}>عرض التفاصيل</Button>
            <Button variant="outline">عرض التقويم</Button>
          </div>
        </section>
      </div>
      {!wide && <div className="app-shell-bottom-dock"><nav className="app-shell-curved-dock"><button className="app-shell-dock-item"><Menu /><span>الرئيسية</span></button></nav></div>}
      {editor && <ThemeCustomizationDialog preference={preference} onClose={() => setEditor(false)} onSave={save} />}
      <Dialog open={details} onOpenChange={setDetails}>
        <DialogContent className="qa-details"><DialogHeader><DialogTitle>خدمات العائلة</DialogTitle><DialogDescription>تفاصيل الخدمات وتنبيهات العائلة.</DialogDescription></DialogHeader><Input aria-label="اسم الخدمة" placeholder="اسم الخدمة" /><Button onClick={() => setDetails(false)}>تم</Button></DialogContent>
      </Dialog>
    </main>
  );
}
createRoot(document.getElementById("app")!).render(<Fixture />);
win.fixtureReady = true;
