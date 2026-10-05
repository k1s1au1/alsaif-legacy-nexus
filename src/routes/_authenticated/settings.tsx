import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { AppShell } from "@/components/app-shell";
import { BackgroundUploader } from "@/components/background-uploader";
import { supabase } from "@/integrations/supabase/client";
import {
  Moon,
  Sun,
  Languages,
  Bell,
  Smartphone,
  Check,
  Palette,
  Type,
  X,
  Plus,
  Minus,
  ImagePlus,
  Fingerprint,
  Accessibility,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { BiometricAuth } from "@/lib/native-bridge";
import { setupPushNotifications } from "@/lib/pushNotifications";
import { THEME_COLORS } from "@/lib/themes";
import {
  applyThemePreference,
  getThemePreferenceBaseId,
  parseThemePreference,
  serializeThemePreference,
  type ThemePreference,
} from "@/lib/theme-preferences";
import {
  NAV_REGISTRY,
  NavItemKey,
  DEFAULT_NAV_KEYS,
  normalizeBottomNavKeys,
} from "@/lib/navigation-registry";
import { useSimpleMode } from "@/hooks/use-simple-mode";
import { APP_FONTS as FONTS, applyAppFont } from "@/lib/typography";
import { ThemeCustomizationDialog } from "@/components/theme-customization-dialog";
import "@/settings-responsive.css";

type SettingsSectionId =
  "appearance" | "accessibility" | "typography" | "notifications" | "security" | "brand";

const SETTINGS_SECTIONS: {
  id: SettingsSectionId;
  label: string;
  icon: any;
  nativeOnly?: boolean;
  adminOnly?: boolean;
}[] = [
  { id: "appearance", label: "المظهر والهوية", icon: Palette },
  { id: "accessibility", label: "سهولة الاستخدام", icon: Accessibility },
  { id: "typography", label: "الخطوط والتنقل", icon: Type },
  { id: "notifications", label: "الإشعارات", icon: Bell },
  { id: "security", label: "حماية التطبيق", icon: Fingerprint, nativeOnly: true },
  { id: "brand", label: "إدارة الواجهة", icon: ImagePlus, adminOnly: true },
];

export const Route = createFileRoute("/_authenticated/settings")({
  ssr: false,
  component: SettingsPage,
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const { simpleMode, setSimpleMode } = useSimpleMode();
  const [darkMode, setDarkMode] = useState<"light" | "dark" | "system" | null>(null);
  const [font, setFont] = useState("Tajawal");
  const [fontStyle, setFontStyle] = useState<"modern" | "royal">("modern");
  const [fontScale, setFontScale] = useState(1);
  const [themePreference, setThemePreference] = useState<ThemePreference>(() =>
    parseThemePreference(
      typeof window === "undefined"
        ? null
        : localStorage.getItem("app-theme-color-id") || localStorage.getItem("theme-color"),
    ),
  );
  const [isNative, setIsNative] = useState(() => Capacitor.isNativePlatform());
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [showNavPicker, setShowNavPicker] = useState(false);
  const [navSlotToEdit, setNavSlotToEdit] = useState<1 | 2>(1);
  const [bottomNavKeys, setBottomNavKeys] = useState<NavItemKey[]>(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("bottom_nav_prefs");
      if (cached) {
        try {
          return normalizeBottomNavKeys(JSON.parse(cached));
        } catch {
          return DEFAULT_NAV_KEYS;
        }
      }
    }
    return DEFAULT_NAV_KEYS;
  });
  const [canCustomizeBg, setCanCustomizeBg] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSectionId>(() => {
    if (typeof window === "undefined") return "appearance";
    const requestedSection = window.location.hash.replace("#", "") as SettingsSectionId;
    return SETTINGS_SECTIONS.some((section) => section.id === requestedSection)
      ? requestedSection
      : "appearance";
  });

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", auth.user.id);
      const rs = (roles ?? []).map((r) => r.role);
      const isA = rs.includes("admin") || rs.includes("chairman");
      setCanCustomizeBg(isA);
      setIsAdmin(isA || rs.includes("manager"));

      const { data: profile } = await supabase
        .from("profiles")
        .select("bottom_nav_prefs")
        .eq("id", auth.user.id)
        .maybeSingle();

      if (profile?.bottom_nav_prefs && Array.isArray(profile.bottom_nav_prefs)) {
        const keys = normalizeBottomNavKeys(profile.bottom_nav_prefs);
        setBottomNavKeys(keys);
        localStorage.setItem("bottom_nav_prefs", JSON.stringify(keys));
      }
    })();
  }, []);

  useEffect(() => {
    setBiometricEnabled(localStorage.getItem("app-use-biometrics") === "true");

    if (!Capacitor.isNativePlatform()) return;

    BiometricAuth.checkBiometry()
      .then(({ isAvailable }) => setBiometricsAvailable(isAvailable))
      .catch(() => setBiometricsAvailable(false));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | "system" | null;
    const currentTheme = document.documentElement.classList.contains("dark") ? "dark" : "light";
    // Opening settings must not mutate the active theme. Apply it only after
    // the user explicitly chooses one of the appearance options below.
    setDarkMode(savedTheme || currentTheme);

    const savedFont = localStorage.getItem("app-font-id");
    if (savedFont) {
      setFont(savedFont);
      const fontObj = FONTS.find((f) => f.id === savedFont);
      if (fontObj) applyFont(fontObj.family);
    }

    const savedScale = localStorage.getItem("app-font-scale");
    if (savedScale) {
      setFontScale(parseFloat(savedScale));
    }

    const savedStyle = localStorage.getItem("font-style") as "modern" | "royal" | null;
    if (savedStyle) {
      setFontStyle(savedStyle);
      applyFontStyle(savedStyle);
    }

    const savedColor =
      localStorage.getItem("app-theme-color-id") || localStorage.getItem("theme-color");
    const savedPreference = parseThemePreference(savedColor);
    setThemePreference(savedPreference);
    applyThemePreference(savedPreference);

    const win = window as any;
    if (win.Capacitor?.isNativePlatform()) {
      setIsNative(true);
    }
  }, []);

  const applyTheme = (theme: "light" | "dark" | "system") => {
    const root = document.documentElement;
    const isDark =
      theme === "dark" ||
      (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.classList.toggle("dark", isDark);

    const savedPreference = parseThemePreference(
      localStorage.getItem("app-theme-color-id") || localStorage.getItem("theme-color"),
    );
    applyThemePreference(savedPreference);
  };

  const applyFont = (fontFamily: string) => {
    applyAppFont(fontFamily);
  };

  const applyFontScale = (scale: number) => {
    document.documentElement.style.setProperty("--app-font-scale", scale.toString());
    document.documentElement.style.fontSize = `calc(16px * ${scale})`;
  };

  const handleFontScaleChange = (scale: number) => {
    setFontScale(scale);
    localStorage.setItem("app-font-scale", scale.toString());
    applyFontScale(scale);
  };

  const applyFontStyle = (style: "modern" | "royal") => {
    if (style === "royal") {
      document.documentElement.classList.add("font-royal-mode");
    } else {
      document.documentElement.classList.remove("font-royal-mode");
    }
  };

  const handleFontStyleChange = (style: "modern" | "royal") => {
    setFontStyle(style);
    localStorage.setItem("font-style", style);
    applyFontStyle(style);
    toast.success(`تم تفعيل النمط ${style === "royal" ? "الملكي" : "العصري"}`);
  };

  const handleFontChange = (fontId: string) => {
    const selected = FONTS.find((f) => f.id === fontId);
    if (!selected) return;
    setFont(fontId);
    localStorage.setItem("app-font-id", fontId);
    applyFont(selected.family);
    toast.success(`تم تفعيل خط ${selected.name}`);
    setShowFontPicker(false);
  };

  const handleThemePreferenceChange = (nextPreference: ThemePreference) => {
    const storedPreference = serializeThemePreference(nextPreference);
    const baseTheme =
      THEME_COLORS.find((color) => color.id === getThemePreferenceBaseId(nextPreference)) ||
      THEME_COLORS[0];
    setThemePreference(nextPreference);
    localStorage.setItem("app-theme-color-id", storedPreference);
    applyThemePreference(nextPreference);
    toast.success(
      nextPreference.mode === "custom" ? "تم حفظ تخصيص ألوانك" : `تم تفعيل ${baseTheme.name}`,
    );
    setShowColorPicker(false);
    // Persist to the profile so the choice syncs across devices/sessions
    void (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from("profiles")
            .update({ theme_color: storedPreference })
            .eq("id", user.id);
        }
      } catch {
        // Local choice already applied; profile sync is best-effort
      }
    })();
  };

  const handleBiometricChange = async () => {
    if (!biometricsAvailable) {
      toast.error("فعّل البصمة أو رمز قفل الشاشة من إعدادات جهازك أولاً.");
      return;
    }

    if (biometricEnabled) {
      localStorage.removeItem("app-use-biometrics");
      sessionStorage.removeItem("app-biometric-unlocked");
      setBiometricEnabled(false);
      toast.success("تم إيقاف قفل التطبيق");
      return;
    }

    try {
      const result = await BiometricAuth.authenticate({
        title: "تفعيل قفل التطبيق",
        subtitle: "استخدم البصمة أو رمز قفل الجهاز للتأكيد",
      });

      if (!result.success) return;
      localStorage.setItem("app-use-biometrics", "true");
      sessionStorage.setItem("app-biometric-unlocked", "true");
      setBiometricEnabled(true);
      toast.success("تم تفعيل قفل التطبيق بالبصمة أو رمز الجهاز");
    } catch {
      toast.error("تعذر تفعيل القفل. تأكد من إعداد البصمة أو رمز قفل على جهازك.");
    }
  };

  const handleThemeChange = (theme: "light" | "dark" | "system") => {
    setDarkMode(theme);
    localStorage.setItem("theme", theme);
    applyTheme(theme);
    toast.success(
      `تم تفعيل الوضع ${theme === "dark" ? "الداكن" : theme === "light" ? "الفاتح" : "التلقائي"}`,
    );
  };

  const handleNavChoice = async (key: NavItemKey) => {
    if (key === "dashboard") return;

    const previous = normalizeBottomNavKeys(bottomNavKeys);
    const next = [...previous];
    const otherSlot = navSlotToEdit === 1 ? 2 : 1;

    if (next[navSlotToEdit] === key) return;
    if (next[otherSlot] === key) {
      next[otherSlot] = next[navSlotToEdit];
    }
    next[navSlotToEdit] = key;
    setBottomNavKeys(next);

    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      const { error } = await supabase
        .from("profiles")
        .update({ bottom_nav_prefs: next })
        .eq("id", auth.user.id);

      if (error) {
        console.error("Nav preference update error:", error);
        setBottomNavKeys(previous);
        toast.error(`تعذر حفظ التفضيلات: ${error.message}`);
      } else {
        localStorage.setItem("bottom_nav_prefs", JSON.stringify(next));
        // Force immediate refresh of the AppShell nav
        queryClient.invalidateQueries({ queryKey: ["profile"] });
        toast.success(navSlotToEdit === 1 ? "تم تحديث الخانة الثانية" : "تم تحديث الخانة الرابعة");
      }
    }
  };

  const currentThemeObj =
    THEME_COLORS.find((c) => c.id === getThemePreferenceBaseId(themePreference)) || THEME_COLORS[0];
  const currentThemeLabel =
    themePreference.mode === "custom"
      ? `تخصيص شخصي · أساس ${currentThemeObj.name}`
      : currentThemeObj.name;
  const currentFontObj = FONTS.find((f) => f.id === font) || FONTS[0];
  const visibleSettingsSections = SETTINGS_SECTIONS.filter(
    (section) => (!section.nativeOnly || isNative) && (!section.adminOnly || canCustomizeBg),
  );

  useEffect(() => {
    const activeSectionIsAvailable = SETTINGS_SECTIONS.some(
      (section) =>
        section.id === activeSection &&
        (!section.nativeOnly || isNative) &&
        (!section.adminOnly || canCustomizeBg),
    );

    if (!activeSectionIsAvailable) {
      setActiveSection("appearance");
      if (typeof window !== "undefined") {
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${window.location.search}#appearance`,
        );
      }
    }
  }, [activeSection, isNative, canCustomizeBg]);

  const handleSectionChange = (sectionId: SettingsSectionId) => {
    setActiveSection(sectionId);

    if (typeof window === "undefined") return;
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}#${sectionId}`,
    );

    window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });
  };

  const handleDeviceLinking = async () => {
    console.log("[Push] Linking button clicked v2");
    const tId = toast.loading("جاري ربط جهازك بالنظام...");
    try {
      if (Capacitor.isNativePlatform()) {
        await setupPushNotifications();
        // ننتظر 6 ثواني لنعطي فرصة للتسجيل
        await new Promise((r) => setTimeout(r, 6000));
      } else {
        const inIframe = typeof window !== "undefined" && window.self !== window.top;
        if (!("Notification" in window) || !("serviceWorker" in navigator)) {
          throw new Error("هذا المتصفح لا يدعم إشعارات الويب");
        }
        if (Notification.permission === "denied") {
          throw new Error(
            inIframe
              ? "الإشعارات محجوبة داخل نافذة المعاينة. افتح الموقع في تبويب مستقل ثم أعد المحاولة."
              : "الإشعارات محجوبة من إعدادات المتصفح لهذا الموقع. اسمح بالإشعارات من أيقونة القفل في شريط العنوان ثم أعد المحاولة.",
          );
        }

        // Keep this as the first awaited action after the click. Loading Firebase
        // beforehand loses Chrome's transient user activation and suppresses the prompt.
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          throw new Error(
            inIframe
              ? "لم يتم منح إذن الإشعارات — افتح الموقع في تبويب مستقل (خارج نافذة المعاينة) ثم أعد المحاولة."
              : "لم يتم منح إذن الإشعارات",
          );
        }

        const { isSupported, getMessaging, getToken, deleteToken } =
          await import("firebase/messaging");
        const { initializeApp, getApps } = await import("firebase/app");
        const { FIREBASE_CONFIG, FCM_VAPID_KEY } = await import("@/lib/fcm-config");

        if (!(await isSupported())) throw new Error("المتصفح لا يدعم الإشعارات");

        // تحديث Service Worker لضمان استخدام إعدادات Firebase الجديدة
        const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
          scope: "/",
        });
        await registration.update().catch(() => {});
        await navigator.serviceWorker.ready;

        const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
        const messaging = getMessaging(app);
        // حذف أي رمز قديم يعود لمشروع Firebase السابق
        await deleteToken(messaging).catch(() => {});
        const token = await getToken(messaging, {
          vapidKey: FCM_VAPID_KEY,
          serviceWorkerRegistration: registration,
        });

        if (token) {
          const { data: auth } = await supabase.auth.getUser();
          if (auth.user) {
            const { error: tokenError } = await supabase
              .from("push_tokens")
              .upsert(
                { user_id: auth.user.id, token, platform: "web", is_active: true },
                { onConflict: "user_id,token" },
              );
            if (tokenError) throw new Error(`تعذر حفظ تسجيل الجهاز: ${tokenError.message}`);
          }
        }
      }

      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        const { data: tokens } = await supabase
          .from("push_tokens")
          .select("id")
          .eq("user_id", auth.user.id)
          .eq("is_active", true);

        toast.dismiss(tId);
        if (tokens && tokens.length > 0) {
          toast.success("تم الربط بنجاح! ستصلك التنبيهات الآن ✨");
        } else {
          toast.error("فشل تسجيل الجهاز. يرجى التأكد من السماح بالإشعارات.");
        }
      } else {
        toast.dismiss(tId);
      }
    } catch (e: any) {
      toast.dismiss(tId);
      toast.error("حدث خطأ أثناء الربط: " + (e.message || "خطأ غير معروف"));
    }
  };

  return (
    <AppShell title="الإعدادات" user={{ name: "", role: "", initial: "إ" }} fullWidth>
      <div className="settings-page" dir="rtl">
        <header className="settings-hero animate-fade-up">
          <div className="settings-hero-mark" aria-hidden="true">
            <Palette />
          </div>
          <div className="settings-hero-copy">
            <span>لوحة التحكم الشخصية</span>
            <h1>الإعدادات والتخصيص</h1>
            <p>اضبط مظهر المنصة والخطوط والإشعارات بما يناسبك على جميع أجهزتك.</p>
          </div>
          <div className="settings-hero-summary">
            <div>
              <Smartphone />
              <span>
                <small>واجهة متجاوبة</small>
                <b>جوال · لوحي · كمبيوتر</b>
              </span>
            </div>
            <div>
              <i
                aria-hidden="true"
                style={{
                  backgroundColor: currentThemeObj.primary,
                }}
              />
              <span>
                <small>الهوية الحالية</small>
                <b>{currentThemeLabel}</b>
              </span>
            </div>
          </div>
        </header>

        <div className="settings-layout">
          <nav className="settings-section-nav" aria-label="أقسام الإعدادات">
            <div className="settings-nav-title">
              <span>أقسام الإعدادات</span>
              <small>اختر قسمًا لعرض إعداداته</small>
            </div>
            <div className="settings-nav-links" role="tablist">
              {visibleSettingsSections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    id={`settings-tab-${section.id}`}
                    type="button"
                    role="tab"
                    aria-selected={activeSection === section.id}
                    aria-controls={section.id}
                    className={cn(activeSection === section.id && "is-active")}
                    onClick={() => handleSectionChange(section.id)}
                  >
                    <Icon />
                    <span>{section.label}</span>
                    {activeSection === section.id && <Check className="settings-nav-check" />}
                  </button>
                );
              })}
            </div>
            <div className="settings-nav-note">
              <Check />
              <span>تُحفظ اختياراتك مباشرة</span>
            </div>
          </nav>

          <div className="settings-sections">
            {activeSection === "appearance" && (
              <section
                id="appearance"
                role="tabpanel"
                aria-labelledby="settings-tab-appearance"
                tabIndex={0}
                className="settings-panel space-y-6 animate-fade-up"
              >
                <div className="flex items-center gap-4">
                  <h3 className="text-xs font-black text-primary uppercase tracking-[0.3em]">
                    مظهر المنصة
                  </h3>
                  <div className="h-px flex-1 bg-border/60" />
                </div>

                <div className="settings-theme-grid grid grid-cols-1 md:grid-cols-3 gap-4">
                  <ThemeCard
                    active={darkMode === "light"}
                    onClick={() => handleThemeChange("light")}
                    label="فاتح"
                    icon={<Sun />}
                  />
                  <ThemeCard
                    active={darkMode === "dark"}
                    onClick={() => handleThemeChange("dark")}
                    label="داكن"
                    icon={<Moon />}
                  />
                  <ThemeCard
                    active={darkMode === "system"}
                    onClick={() => handleThemeChange("system")}
                    label="تلقائي"
                    icon={<Smartphone />}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowColorPicker(true)}
                  className="settings-identity-card w-full card-surface p-5 flex items-center justify-between gap-4 text-right transition-all hover:-translate-y-0.5 hover:shadow-xl"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className="size-12 shrink-0 rounded-2xl flex items-center justify-center text-white shadow-lg"
                      style={{
                        backgroundColor: currentThemeObj.primary,
                        color: currentThemeObj.foreground,
                      }}
                    >
                      <Palette className="size-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-primary">ألوان الموقع</p>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {currentThemeLabel}
                      </p>
                    </div>
                  </div>
                  <span className="btn-gold px-5 py-3 rounded-xl font-black text-xs shrink-0">
                    تخصيص
                  </span>
                </button>
              </section>
            )}

            {activeSection === "accessibility" && (
              <section
                id="accessibility"
                role="tabpanel"
                aria-labelledby="settings-tab-accessibility"
                tabIndex={0}
                className="settings-panel space-y-6 animate-fade-up"
              >
                <div className="flex items-center gap-4">
                  <h3 className="text-xs font-black text-primary uppercase tracking-[0.3em]">
                    سهولة الاستخدام
                  </h3>
                  <div className="h-px flex-1 bg-border/60" />
                </div>

                <div className="settings-switch-card card-surface p-6 md:p-8 space-y-7">
                  <div className="flex items-center justify-between gap-5">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="size-14 shrink-0 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg">
                        <Accessibility className="size-7" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-lg md:text-xl font-black text-primary">
                          الوضع المبسّط
                        </h4>
                        <p className="mt-1 text-xs md:text-sm leading-relaxed font-bold text-muted-foreground">
                          واجهة رئيسية أوضح بخط أكبر وأزرار أسهل وأهم الخدمات فقط.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={simpleMode}
                      aria-label={simpleMode ? "إيقاف الوضع المبسّط" : "تفعيل الوضع المبسّط"}
                      onClick={() => {
                        const enabled = !simpleMode;
                        setSimpleMode(enabled);
                        toast.success(
                          enabled ? "تم تفعيل الوضع المبسّط" : "تم الرجوع إلى الوضع العادي",
                        );
                      }}
                      className={cn(
                        "relative h-9 w-16 shrink-0 rounded-full transition-colors duration-300 focus:outline-none focus:ring-4 focus:ring-primary/15",
                        simpleMode ? "bg-primary" : "bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-1 right-1 size-7 rounded-full bg-white shadow-md transition-transform duration-300",
                          simpleMode ? "-translate-x-7" : "translate-x-0",
                        )}
                      />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-border/50 pt-6">
                    {[
                      "خطوط أكبر وأكثر وضوحًا",
                      "أزرار واسعة وسهلة اللمس",
                      "أربع خدمات أساسية فقط",
                    ].map((feature) => (
                      <div
                        key={feature}
                        className="min-h-20 flex items-center gap-3 rounded-2xl bg-primary/5 border border-primary/10 p-4"
                      >
                        <span className="size-8 shrink-0 rounded-full bg-primary text-white flex items-center justify-center">
                          <Check className="size-4" strokeWidth={3} />
                        </span>
                        <b className="text-sm leading-relaxed text-primary">{feature}</b>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs font-bold leading-relaxed text-muted-foreground">
                    يتغير ترتيب الصفحة الرئيسية فقط، وتبقى بقية الصفحات والهيدر وشريط التنقل كما هي.
                  </p>
                </div>
              </section>
            )}

            {activeSection === "typography" && (
              <section
                id="typography"
                role="tabpanel"
                aria-labelledby="settings-tab-typography"
                tabIndex={0}
                className="settings-panel space-y-6 animate-fade-up"
              >
                <div className="flex items-center gap-4">
                  <h3 className="text-xs font-black text-primary uppercase tracking-[0.3em]">
                    النمط والخطوط
                  </h3>
                  <div className="h-px flex-1 bg-border/60" />
                </div>

                <div className="settings-control-card card-surface p-8 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-gold-primary/10 flex items-center justify-center text-gold-primary">
                          <Type className="size-5" />
                        </div>
                        <h4 className="text-lg font-black text-primary">نمط الكتابة العام</h4>
                      </div>
                      <div className="flex gap-2 p-1 bg-muted/40 rounded-2xl border border-border/40">
                        <button
                          onClick={() => handleFontStyleChange("modern")}
                          className={cn(
                            "flex-1 py-3 rounded-xl font-black text-xs transition-all",
                            fontStyle === "modern"
                              ? "bg-primary text-white shadow-lg"
                              : "text-muted-foreground hover:bg-muted",
                          )}
                        >
                          عصري
                        </button>
                        <button
                          onClick={() => handleFontStyleChange("royal")}
                          className={cn(
                            "flex-1 py-3 rounded-xl font-black text-xs transition-all",
                            fontStyle === "royal"
                              ? "bg-gold-primary text-white shadow-lg"
                              : "text-muted-foreground hover:bg-muted",
                          )}
                        >
                          ملكي (مخطوطة)
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <Languages className="size-5" />
                          </div>
                          <h4 className="text-lg font-black text-primary">اختيار الخط المخصص</h4>
                        </div>
                        <button
                          onClick={() => setShowFontPicker(true)}
                          className="text-[10px] font-black text-gold-primary uppercase tracking-widest hover:underline"
                        >
                          تغيير
                        </button>
                      </div>
                      <div className="p-4 rounded-2xl bg-muted/30 border border-border/60">
                        <p className="text-sm font-bold text-primary">{currentFontObj.name}</p>
                        <p className="text-[10px] text-muted-foreground">{currentFontObj.desc}</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-border/40">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                          <Type className="size-5" />
                        </div>
                        <div className="text-right">
                          <h4 className="text-lg font-black text-primary">تكبير الخطوط</h4>
                          <p className="text-[10px] text-muted-foreground font-bold">
                            تحكم في حجم نصوص المنصة بالكامل
                          </p>
                        </div>
                      </div>
                      <div className="px-4 py-1.5 rounded-full bg-primary/5 border border-primary/10 text-primary font-black text-xs">
                        {Math.round(fontScale * 100)}%
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <button
                        onClick={() => handleFontScaleChange(Math.max(0.8, fontScale - 0.05))}
                        className="size-12 rounded-2xl bg-muted flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all active:scale-90"
                      >
                        <Minus size={20} strokeWidth={3} />
                      </button>

                      <div className="flex-1 px-2">
                        <input
                          type="range"
                          min="0.8"
                          max="1.5"
                          step="0.05"
                          value={fontScale}
                          onChange={(e) => handleFontScaleChange(parseFloat(e.target.value))}
                          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <div className="flex justify-between mt-2 px-1 text-[11px] font-black text-muted-foreground uppercase tracking-widest">
                          <span>افتراضي</span>
                          <span>كبير</span>
                          <span>ضخم</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleFontScaleChange(Math.min(1.5, fontScale + 0.05))}
                        className="size-12 rounded-2xl bg-primary flex items-center justify-center text-white hover:brightness-110 transition-all active:scale-90 shadow-lg shadow-primary/20"
                      >
                        <Plus size={20} strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="settings-single-grid grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="settings-shortcuts-card card-surface p-8 space-y-6 group">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                          شريط التنقل
                        </p>
                        <h4 className="text-xl font-black text-primary">تخصيص الاختصارات</h4>
                      </div>
                      <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-lg">
                        <Smartphone className="size-7" />
                      </div>
                    </div>
                    <button
                      onClick={() => setShowNavPicker(true)}
                      className="w-full btn-gold py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-sm shadow-2xl shadow-gold-primary/20"
                    >
                      <Palette className="size-5" /> تخصيص الشريط السفلي
                    </button>
                  </div>
                </div>
              </section>
            )}

            {isNative && activeSection === "security" && (
              <section
                id="security"
                role="tabpanel"
                aria-labelledby="settings-tab-security"
                tabIndex={0}
                className="settings-panel space-y-6 animate-fade-up"
              >
                <div className="flex items-center gap-4">
                  <h3 className="text-xs font-black text-primary uppercase tracking-[0.3em]">
                    حماية التطبيق
                  </h3>
                  <div className="h-px flex-1 bg-border/60" />
                </div>

                <div className="settings-switch-card card-surface p-6 flex items-center justify-between gap-5">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="size-12 shrink-0 rounded-2xl bg-gold-primary/10 text-gold-primary flex items-center justify-center">
                      <Fingerprint className="size-6" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-base font-black text-primary">
                        القفل بالبصمة أو رمز الجهاز
                      </h4>
                      <p className="mt-1 text-[11px] leading-relaxed font-bold text-muted-foreground">
                        {biometricsAvailable
                          ? "يطلب تأكيد هويتك عند فتح التطبيق أو العودة إليه."
                          : "فعّل البصمة أو رمز قفل الشاشة من إعدادات جهازك أولاً."}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={biometricEnabled}
                    onClick={handleBiometricChange}
                    disabled={!biometricsAvailable}
                    className={cn(
                      "relative h-8 w-14 shrink-0 rounded-full transition-colors duration-300 focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-45",
                      biometricEnabled ? "bg-primary" : "bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-1 right-1 size-6 rounded-full bg-white shadow-md transition-transform duration-300",
                        biometricEnabled ? "-translate-x-6" : "translate-x-0",
                      )}
                    />
                  </button>
                </div>
              </section>
            )}

            {activeSection === "notifications" && (
              <div
                id="notifications"
                role="tabpanel"
                aria-labelledby="settings-tab-notifications"
                tabIndex={0}
                className="settings-tab-panel"
              >
                <NotificationPreferencesSection />

                <section className="settings-panel settings-panel--notification-test space-y-6 animate-fade-up">
                  <div className="flex items-center gap-4">
                    <h3 className="text-xs font-black text-primary uppercase tracking-[0.3em]">
                      تجربة الإشعارات ({isNative ? "تطبيق الجوال" : "المتصفح"})
                    </h3>
                    <div className="h-px flex-1 bg-border/60" />
                  </div>
                  <div className="settings-notification-test-card card-surface p-8 space-y-4">
                    <p className="text-sm font-bold text-muted-foreground">
                      إذا لم تكن الإشعارات تصلك، يمكنك محاولة إعادة طلب الإذن يدوياً من هنا.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={handleDeviceLinking}
                        className="flex-1 btn-gold py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-sm shadow-xl"
                      >
                        {isNative ? <Smartphone className="size-5" /> : <Bell className="size-5" />}
                        {isNative ? "إعادة ربط الجوال" : "تفعيل إشعارات المتصفح"}
                      </button>

                      <button
                        onClick={async () => {
                          const tId = toast.loading("جاري إرسال إشعار تجريبي لجهازك...");
                          try {
                            const { data: auth } = await supabase.auth.getUser();
                            const { data: result, error } = await supabase.functions.invoke(
                              "send-push",
                              {
                                body: {
                                  title: "🔔 تجربة الإشعارات",
                                  body: "هذا إشعار تجريبي من مجلس السيف الرقمي ✨",
                                  user_ids: [auth.user?.id],
                                },
                              },
                            );
                            toast.dismiss(tId);

                            if (error) {
                              throw new Error(
                                error.message ||
                                  "فشل الاتصال بالخادم (Edge Function). تأكد من رفع الوظائف البرمجية للمشروع.",
                              );
                            }

                            if (result?.success) {
                              if (result.sent > 0) {
                                toast.success("تم قبول الإشعار وإرساله إلى جهازك.");
                              } else {
                                toast.error(
                                  "فشل الإرسال: " +
                                    (result.msg || "لم يتم العثور على أجهزة مسجلة لهذا الحساب."),
                                );
                              }
                            } else {
                              toast.error(
                                "خطأ تقني: " +
                                  (result?.error ||
                                    "فشل إرسال الإشعار. تأكد من إعداد FCM_SERVICE_ACCOUNT في Supabase Dashboard."),
                              );
                            }
                          } catch (e: any) {
                            toast.dismiss(tId);
                            toast.error("خطأ تقني: " + e.message);
                          }
                        }}
                        className="settings-secondary-action px-8 py-4 rounded-2xl font-black text-sm transition-all"
                      >
                        إرسال تجربة
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {canCustomizeBg && activeSection === "brand" && (
              <section
                id="brand"
                role="tabpanel"
                aria-labelledby="settings-tab-brand"
                tabIndex={0}
                className="settings-panel space-y-6 animate-fade-up"
              >
                <div className="flex items-center gap-4">
                  <h3 className="text-xs font-black text-primary uppercase tracking-[0.3em]">
                    خلفيات الواجهة
                  </h3>
                  <div className="h-px flex-1 bg-border/60" />
                </div>
                <div className="settings-admin-card card-surface p-8 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="size-12 rounded-2xl bg-gold-primary/10 flex items-center justify-center text-gold-primary">
                      <ImagePlus className="size-6" />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-primary">تخصيص الخلفيات</h4>
                      <p className="text-xs font-bold text-muted-foreground opacity-60">
                        متاح للمسؤولين التقنيين ورئيس المجلس فقط.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-50">
                        شعار المنصة
                      </p>
                      <BackgroundUploader
                        inline
                        settingKey="site_logo"
                        label="تحديث الشعار الرسمي"
                      />
                    </div>
                    <div className="space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-50">
                        خلفية صفحة الدخول
                      </p>
                      <BackgroundUploader inline settingKey="auth_bg" label="تغيير خلفية الترحيب" />
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showNavPicker && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            dir="rtl"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="settings-modal card-surface w-full max-w-lg p-8 space-y-8 shadow-2xl rounded-[48px]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-primary tracking-tight">
                    تخصيص شريط التنقل
                  </h3>
                  <p className="text-xs font-bold text-muted-foreground mt-1">
                    الرئيسية وخدمات العائلة والمزيد ثابتة دائماً؛ خصّص الخانتين الثانية والرابعة فقط
                  </p>
                </div>
                <button
                  onClick={() => setShowNavPicker(false)}
                  className="size-10 rounded-full bg-muted flex items-center justify-center transition-transform hover:rotate-90"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="grid grid-cols-5 gap-2 rounded-[26px] border border-primary/10 bg-primary/[0.04] p-3 text-center">
                {["الرئيسية", bottomNavKeys[1], "خدمات العائلة", bottomNavKeys[2], "المزيد"].map(
                  (item, index) => {
                    const def = NAV_REGISTRY.find((entry) => entry.id === item);
                    const fixed = index === 0 || index === 2 || index === 4;
                    return (
                      <div
                        key={`${item}-${index}`}
                        className={cn(
                          "flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-3",
                          fixed
                            ? "bg-primary text-white"
                            : "bg-card text-primary ring-1 ring-primary/10",
                        )}
                      >
                        <span className="truncate text-[9px] font-black">{def?.label || item}</span>
                        <small className="text-[8px] font-bold opacity-70">
                          {fixed ? "ثابت" : index === 1 ? "الخانة ٢" : "الخانة ٤"}
                        </small>
                      </div>
                    );
                  },
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {([1, 2] as const).map((slot) => {
                  const def = NAV_REGISTRY.find((entry) => entry.id === bottomNavKeys[slot]);
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setNavSlotToEdit(slot)}
                      className={cn(
                        "rounded-2xl border-2 p-4 text-right transition-all",
                        navSlotToEdit === slot
                          ? "border-primary bg-primary/10 shadow-inner"
                          : "border-border bg-card hover:border-primary/30",
                      )}
                    >
                      <small className="block text-[9px] font-black text-muted-foreground">
                        {slot === 1 ? "الخانة الثانية" : "الخانة الرابعة"}
                      </small>
                      <b className="mt-1 block text-sm text-primary">{def?.label}</b>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[42vh] overflow-y-auto pr-2 custom-scrollbar">
                {NAV_REGISTRY.filter((n) => n.id !== "dashboard" && (!n.adminOnly || isAdmin)).map(
                  (n) => {
                    const selectedSlot =
                      bottomNavKeys[1] === n.id ? 1 : bottomNavKeys[2] === n.id ? 2 : null;
                    return (
                      <button
                        key={n.id}
                        onClick={() => handleNavChoice(n.id)}
                        aria-pressed={selectedSlot !== null}
                        className={cn(
                          "p-4 rounded-[28px] border-2 transition-all flex flex-col items-center gap-3 group relative",
                          selectedSlot
                            ? "border-primary bg-primary/5 shadow-inner"
                            : "border-transparent bg-muted/30 hover:bg-muted/50",
                          selectedSlot === navSlotToEdit && "ring-4 ring-primary/10",
                        )}
                      >
                        <div
                          className={cn(
                            "size-10 rounded-xl flex items-center justify-center transition-all",
                            selectedSlot
                              ? "bg-primary text-white"
                              : "bg-card text-muted-foreground",
                          )}
                        >
                          <n.icon size={20} />
                        </div>
                        <span className="font-black text-[11px] text-primary">{n.label}</span>
                        {selectedSlot && (
                          <div className="absolute top-2 left-2 size-5 rounded-full bg-primary flex items-center justify-center text-white">
                            <span className="text-[10px] font-black">
                              {selectedSlot === 1 ? "٢" : "٤"}
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  },
                )}
              </div>
              <button
                onClick={() => setShowNavPicker(false)}
                className="w-full btn-gold py-4 rounded-2xl font-black text-sm"
              >
                تم الحفظ
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showColorPicker && (
          <ThemeCustomizationDialog
            preference={themePreference}
            onClose={() => setShowColorPicker(false)}
            onSave={handleThemePreferenceChange}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFontPicker && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="settings-modal card-surface w-full max-w-lg p-6 space-y-6 shadow-2xl rounded-[40px]"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-primary tracking-tight">تخصيص الخط</h3>
                <button
                  onClick={() => setShowFontPicker(false)}
                  className="size-8 rounded-full bg-muted flex items-center justify-center"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {FONTS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => handleFontChange(f.id)}
                    style={{ fontFamily: f.family }}
                    className={cn(
                      "p-4 rounded-2xl border-2 transition-all text-right flex items-center justify-between group",
                      font === f.id
                        ? "border-primary bg-primary/5"
                        : "border-transparent bg-muted/30 hover:bg-muted/50",
                    )}
                  >
                    <div className="overflow-hidden">
                      <p className="text-sm font-bold truncate">{f.name}</p>
                      <p className="text-[10px] opacity-60 truncate">{f.desc}</p>
                    </div>
                    <span className="text-xl opacity-20 font-black group-hover:opacity-100 transition-opacity shrink-0">
                      أبج
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function ThemeCard({ active, label, icon, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "settings-theme-card p-6 md:p-8 rounded-[32px] md:rounded-[40px] border-4 transition-all duration-500 flex flex-col items-center gap-3 md:gap-4 text-center",
        active
          ? "bg-primary border-gold-primary text-primary-foreground shadow-2xl scale-105"
          : "bg-card border-transparent text-muted-foreground hover:bg-muted",
      )}
    >
      <div
        className={cn(
          "settings-theme-icon size-12 md:size-16 rounded-[22px] md:rounded-[28px] flex items-center justify-center transition-all duration-700",
          active ? "bg-white/10 text-gold-primary rotate-12" : "bg-muted text-primary",
        )}
      >
        {icon}
      </div>
      <span className="text-base md:text-lg font-black tracking-tight">{label}</span>
    </button>
  );
}

type NotifKey =
  | "meetings" | "occasions" | "trips" | "tasks" | "chat" | "news"
  | "community" | "finance" | "requests" | "entertainment" | "admin";

const NOTIF_GROUPS: { title: string; items: { key: NotifKey; label: string; desc: string }[] }[] = [
  {
    title: "المجلس واللقاءات",
    items: [
      { key: "meetings", label: "الاجتماعات", desc: "إنشاء اجتماع جديد أو تغيير موعده." },
      { key: "occasions", label: "المناسبات العائلية", desc: "الأفراح والمناسبات والدعوات الخاصة." },
      { key: "trips", label: "الرحلات", desc: "إعلان رحلة جديدة وتحديثاتها." },
    ],
  },
  {
    title: "التواصل",
    items: [
      { key: "chat", label: "المحادثات", desc: "وصول رسالة جديدة لك." },
      { key: "news", label: "الأخبار والإعلانات", desc: "نشر خبر أو إعلان في المجلس." },
      { key: "community", label: "ركن الأعضاء", desc: "المنشورات والتعليقات والتصويتات." },
    ],
  },
  {
    title: "الأعمال والمتابعة",
    items: [
      { key: "tasks", label: "المهام", desc: "إسناد مهمة لك أو تحديثها." },
      { key: "finance", label: "الصندوق المالي", desc: "التحويلات والمساهمات والمشاريع." },
      { key: "requests", label: "الطلبات الخاصة", desc: "الردود على طلباتك وتحديث حالتها." },
    ],
  },
  {
    title: "أخرى",
    items: [
      { key: "entertainment", label: "الترفيه والألعاب", desc: "دعوات غرف الألعاب والفعاليات الترفيهية." },
      { key: "admin", label: "تنبيهات الإدارة", desc: "طلبات العضوية وتعديل البيانات (للمسؤولين)." },
    ],
  },
];
const ALL_KEYS = NOTIF_GROUPS.flatMap((g) => g.items.map((i) => i.key));

function NotificationPreferencesSection() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(
    Object.fromEntries(ALL_KEYS.map((k) => [k, true])),
  );
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setLoading(false);
        return;
      }
      setUserId(auth.user.id);
      const { data } = await supabase
        .from("notification_preferences")
        .select(ALL_KEYS.join(","))
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (data) setPrefs((p) => ({ ...p, ...(data as any) }));
      setLoading(false);
    })();
  }, []);

  const save = async (next: Record<string, boolean>, prev: Record<string, boolean>) => {
    if (!userId) return;
    setPrefs(next);
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: userId, ...next } as any, { onConflict: "user_id" });
    if (error) {
      toast.error("تعذّر حفظ الإعداد");
      setPrefs(prev);
    }
  };

  const toggle = (key: string) => save({ ...prefs, [key]: !prefs[key] }, prefs);
  const setAll = (v: boolean) =>
    save(Object.fromEntries(ALL_KEYS.map((k) => [k, v])), prefs);
  const enabledCount = ALL_KEYS.filter((k) => prefs[k]).length;

  return (
    <section className="settings-panel settings-panel--notifications space-y-6 animate-fade-up">
      <div className="flex items-center gap-4">
        <h3 className="text-xs font-black text-primary uppercase tracking-[0.3em]">
          إعدادات الإشعارات
        </h3>
        <div className="h-px flex-1 bg-border/60" />
      </div>

      <div className="card-surface p-5 md:p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="text-right">
          <p className="font-black text-primary text-sm md:text-base">
            الإشعارات المفعّلة: {enabledCount} من {ALL_KEYS.length}
          </p>
          <p className="text-xs font-bold text-muted-foreground">
            أوقف أي قسم لا تريد تنبيهاته، وتبقى بقية الإشعارات تعمل.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setAll(true)}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-black bg-primary text-primary-foreground"
          >
            تفعيل الكل
          </button>
          <button
            onClick={() => setAll(false)}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-black bg-muted text-foreground"
          >
            إيقاف الكل
          </button>
        </div>
      </div>

      {NOTIF_GROUPS.map((group) => (
        <div key={group.title} className="space-y-3">
          <p className="text-sm font-black text-foreground pr-1">{group.title}</p>
          <div className="settings-notification-list card-surface overflow-hidden divide-y divide-border/40">
            {group.items.map((o) => (
              <div
                key={o.key}
                className="settings-notification-row p-5 md:p-6 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="size-11 rounded-2xl bg-primary/5 flex items-center justify-center text-primary shrink-0">
                    <Bell className="size-5" />
                  </div>
                  <div className="text-right min-w-0">
                    <p className="font-black text-primary tracking-tight text-sm md:text-base">
                      {o.label}
                    </p>
                    <p className="text-xs font-bold text-muted-foreground opacity-70">{o.desc}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggle(o.key)}
                  disabled={loading}
                  role="switch"
                  aria-checked={prefs[o.key]}
                  aria-label={o.label}
                  className={cn(
                    "relative w-14 h-8 rounded-full transition-colors shrink-0",
                    prefs[o.key] ? "bg-primary" : "bg-muted",
                    loading && "opacity-50",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-1 size-6 rounded-full bg-background shadow transition-all",
                      prefs[o.key] ? "right-1" : "right-7",
                    )}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
