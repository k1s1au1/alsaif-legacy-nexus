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
  Star,
  Fingerprint,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { BiometricAuth } from "@/lib/native-bridge";
import { setupPushNotifications } from "@/lib/pushNotifications";
import { THEME_COLORS, applyThemeColors } from "@/lib/themes";
import { NAV_REGISTRY, NavItemKey, DEFAULT_NAV_KEYS } from "@/lib/navigation-registry";

const FONTS = [
  { id: "Tajawal", name: "تجوال (عصري)", family: "'Tajawal', sans-serif", desc: "خط ناعم وأنيق" },
  { id: "Cairo", name: "كايـرو (عريض)", family: "'Cairo', sans-serif", desc: "وضوح عالي جداً" },
  { id: "Lalezar", name: "لاليزار (فني)", family: "'Lalezar', cursive", desc: "خط عريض ومميز" },
  { id: "Amiri", name: "الأميري (تراثي)", family: "'Amiri', serif", desc: "طابع كلاسيكي فاخر" },
  { id: "Changa", name: "شانغا (هندسي)", family: "'Changa', sans-serif", desc: "زوايا حادة وقوية" },
  {
    id: "ReemKufi",
    name: "ريم كوفي (كوفي)",
    family: "'Reem Kufi', sans-serif",
    desc: "أصالة الخط الكوفي",
  },
  {
    id: "Markazi",
    name: "مركزي (أدبي)",
    family: "'Markazi Text', serif",
    desc: "خط الكتب والروايات",
  },
  {
    id: "Vazirmatn",
    name: "وزير (بسيط)",
    family: "'Vazirmatn', sans-serif",
    desc: "بساطة تقنية حديثة",
  },
];

export const Route = createFileRoute("/_authenticated/settings")({
  ssr: false,
  component: SettingsPage,
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const [darkMode, setDarkMode] = useState<"light" | "dark" | "system" | null>(null);
  const [font, setFont] = useState("Tajawal");
  const [fontStyle, setFontStyle] = useState<"modern" | "royal">("modern");
  const [fontScale, setFontScale] = useState(1);
  const [themeColor, setThemeColor] = useState("emerald");
  const [isNative, setIsNative] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [showNavPicker, setShowNavPicker] = useState(false);
  const [bottomNavKeys, setBottomNavKeys] = useState<NavItemKey[]>(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("bottom_nav_prefs");
      if (cached) {
        try {
          return JSON.parse(cached);
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
  const dynamicLogo = useSiteLogo();

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
        const keys = profile.bottom_nav_prefs as NavItemKey[];
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
    if (savedTheme) {
      setDarkMode(savedTheme);
      applyTheme(savedTheme);
    } else {
      setDarkMode("system");
    }

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

    const savedColor = localStorage.getItem("app-theme-color-id");
    if (savedColor) {
      setThemeColor(savedColor);
      const colorObj = THEME_COLORS.find((c) => c.id === savedColor);
      if (colorObj) applyThemeColors(colorObj);
    }

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

    const savedColor = localStorage.getItem("app-theme-color-id") || "emerald";
    const colorObj = THEME_COLORS.find((c) => c.id === savedColor);
    if (colorObj) applyThemeColors(colorObj);
  };

  const applyFont = (fontFamily: string) => {
    document.documentElement.style.setProperty("--app-font", fontFamily);
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

  const handleThemeColorChange = (colorId: string) => {
    const selected = THEME_COLORS.find((c) => c.id === colorId);
    if (!selected) return;
    setThemeColor(colorId);
    localStorage.setItem("app-theme-color-id", colorId);
    applyThemeColors(selected);
    toast.success(`تم تفعيل ${selected.name}`);
    setShowColorPicker(false);
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

  const handleNavToggle = async (key: NavItemKey) => {
    let next = [...bottomNavKeys];
    if (next.includes(key)) {
      if (next.length <= 1) return toast.error("يجب اختيار عنصر واحد على الأقل");
      next = next.filter((k) => k !== key);
    } else {
      if (next.length >= 3) return toast.error("يمكنك اختيار 3 عناصر كحد أقصى");
      next.push(key);
    }
    setBottomNavKeys(next);

    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      const { error } = await supabase
        .from("profiles")
        .update({ bottom_nav_prefs: next })
        .eq("id", auth.user.id);

      if (error) {
        console.error("Nav preference update error:", error);
        toast.error(`تعذر حفظ التفضيلات: ${error.message}`);
      } else {
        localStorage.setItem("bottom_nav_prefs", JSON.stringify(next));
        // Force immediate refresh of the AppShell nav
        queryClient.invalidateQueries({ queryKey: ["profile"] });
        toast.success("تم تحديث شريط التنقل");
      }
    }
  };

  const currentThemeObj = THEME_COLORS.find((c) => c.id === themeColor) || THEME_COLORS[0];
  const currentFontObj = FONTS.find((f) => f.id === font) || FONTS[0];

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

        const { isSupported, getMessaging, getToken, deleteToken } = await import("firebase/messaging");
        const { initializeApp, getApps } = await import("firebase/app");
        const firebaseConfig = {
          apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
          authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
          projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
          storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId: import.meta.env.VITE_FIREBASE_APP_ID,
        };
        const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
        if (!(await isSupported())) throw new Error("خدمة الإشعارات غير مدعومة في هذا المتصفح");
        const messaging = getMessaging(firebaseApp);
        const registration = await navigator.serviceWorker.ready;
        const token = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: registration,
        });
        if (token) {
          const { data: auth } = await supabase.auth.getUser();
          if (auth.user) {
            await supabase.from("push_tokens").upsert(
              { user_id: auth.user.id, token, platform: "web" },
              { onConflict: "token" },
            );
          }
        }
      }

      toast.dismiss(tId);
      toast.success("تم الربط بنجاح! ستصلك التنبيهات الآن ✨");
    } catch (e: any) {
      toast.dismiss(tId);
      toast.error("حدث خطأ أثناء الربط: " + (e.message || "خطأ غير معروف"));
    }
  };

  return (
    <AppShell title="الإعدادات" user={{ name: "", role: "", initial: "إ" }}>
      <div className="max-w-4xl mx-auto space-y-12 pb-24" dir="rtl">
        <section className="space-y-6 animate-fade-up">
          <div className="flex items-center gap-4">
            <h3 className="text-xs font-black text-primary uppercase tracking-[0.3em]">
              مظهر المنصة
            </h3>
            <div className="h-px flex-1 bg-border/60" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            onClick={() => setShowColorPicker(true)}
            className="w-full card-surface p-5 flex items-center justify-between gap-4 text-right transition-all hover:-translate-y-0.5 hover:shadow-xl"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div
                className="size-12 shrink-0 rounded-2xl flex items-center justify-center text-white shadow-lg"
                style={{ backgroundColor: currentThemeObj.primary }}
              >
                <Palette className="size-6" />
              </div>
              <div className="min-w-0">
                <p className="font-black text-primary">ألوان الهوية</p>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {currentThemeObj.name}
                </p>
              </div>
            </div>
            <span className="btn-gold px-5 py-3 rounded-xl font-black text-xs shrink-0">
              تغيير
            </span>
          </button>
        </section>

        <section className="space-y-6 animate-fade-up" style={{ animationDelay: "100ms" }}>
          <div className="flex items-center gap-4">
            <h3 className="text-xs font-black text-primary uppercase tracking-[0.3em]">
              النمط والخطوط
            </h3>
            <div className="h-px flex-1 bg-border/60" />
          </div>

          <div className="card-surface p-8 space-y-8">
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
                        ? "bg-primary text-white shadow-lg"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    ملكي
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-gold-primary/10 flex items-center justify-center text-gold-primary">
                    <Languages className="size-5" />
                  </div>
                  <h4 className="text-lg font-black text-primary">الخط</h4>
                </div>
                <button
                  onClick={() => setShowFontPicker(true)}
                  className="w-full p-4 rounded-2xl border border-border/60 bg-muted/30 flex items-center justify-between gap-4 text-right"
                >
                  <div className="min-w-0">
                    <p className="font-black text-primary">{currentFontObj.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{currentFontObj.desc}</p>
                  </div>
                  <Type className="size-5 shrink-0 text-gold-primary" />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-black text-primary">حجم الخط</h4>
                <span className="text-sm font-black text-gold-primary">{Math.round(fontScale * 100)}%</span>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => handleFontScaleChange(Math.max(0.85, fontScale - 0.05))}
                  className="size-12 rounded-2xl border border-border/60 bg-muted/30 flex items-center justify-center"
                  aria-label="تصغير الخط"
                >
                  <Minus className="size-5" />
                </button>
                <input
                  type="range"
                  min="0.85"
                  max="1.25"
                  step="0.05"
                  value={fontScale}
                  onChange={(e) => handleFontScaleChange(Number(e.target.value))}
                  className="flex-1 accent-gold-primary"
                />
                <button
                  onClick={() => handleFontScaleChange(Math.min(1.25, fontScale + 0.05))}
                  className="size-12 rounded-2xl border border-border/60 bg-muted/30 flex items-center justify-center"
                  aria-label="تكبير الخط"
                >
                  <Plus className="size-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card-surface p-8 space-y-6 group">
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

        {isNative && (
          <section className="space-y-6 animate-fade-up" style={{ animationDelay: "250ms" }}>
            <div className="flex items-center gap-4">
              <h3 className="text-xs font-black text-primary uppercase tracking-[0.3em]">
                حماية التطبيق
              </h3>
              <div className="h-px flex-1 bg-border/60" />
            </div>

            <div className="card-surface p-6 flex items-center justify-between gap-5">
              <div className="flex items-center gap-4 min-w-0">
                <div className="size-12 shrink-0 rounded-2xl bg-gold-primary/10 text-gold-primary flex items-center justify-center">
                  <Fingerprint className="size-6" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-black text-primary">قفل التطبيق</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    حماية التطبيق بالبصمة أو رمز قفل الجهاز
                  </p>
                </div>
              </div>
              <button
                onClick={handleBiometricChange}
                className={cn(
                  "shrink-0 px-5 py-3 rounded-xl font-black text-xs transition-all",
                  biometricEnabled ? "bg-primary text-white" : "btn-gold",
                )}
              >
                {biometricEnabled ? "مفعل" : "تفعيل"}
              </button>
            </div>
          </section>
        )}

        {isAdmin && (
          <section className="space-y-6 animate-fade-up" style={{ animationDelay: "300ms" }}>
            <div className="flex items-center gap-4">
              <h3 className="text-xs font-black text-primary uppercase tracking-[0.3em]">
                هوية المنصة
              </h3>
              <div className="h-px flex-1 bg-border/60" />
            </div>
            <div className="card-surface p-8 space-y-6">
              <div className="flex items-center gap-4">
                <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <ImagePlus className="size-7" />
                </div>
                <div>
                  <h4 className="text-xl font-black text-primary">خلفية المنصة</h4>
                  <p className="text-sm text-muted-foreground mt-1">تخصيص الخلفية الرئيسية للمنصة</p>
                </div>
              </div>
              {canCustomizeBg && <BackgroundUploader />}
            </div>
          </section>
        )}

        <section className="space-y-6 animate-fade-up" style={{ animationDelay: "350ms" }}>
          <div className="flex items-center gap-4">
            <h3 className="text-xs font-black text-primary uppercase tracking-[0.3em]">
              الإشعارات
            </h3>
            <div className="h-px flex-1 bg-border/60" />
          </div>
          <div className="card-surface p-8 flex items-center justify-between gap-6">
            <div className="flex items-center gap-4 min-w-0">
              <div className="size-14 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Bell className="size-7" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xl font-black text-primary">ربط الجهاز</h4>
                <p className="text-sm text-muted-foreground mt-1">فعّل إشعارات هذا الجهاز</p>
              </div>
            </div>
            <button
              onClick={handleDeviceLinking}
              className="btn-gold px-6 py-3 rounded-xl font-black text-xs shrink-0"
            >
              ربط الجهاز
            </button>
          </div>
        </section>
      </div>

      <AnimatePresence>
        {showFontPicker && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" dir="rtl">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="card-surface w-full max-w-lg p-8 space-y-8 shadow-2xl rounded-[48px]"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-primary tracking-tight">اختيار الخط</h3>
                <button
                  onClick={() => setShowFontPicker(false)}
                  className="size-10 rounded-full bg-muted flex items-center justify-center transition-transform hover:rotate-90"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {FONTS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => handleFontChange(f.id)}
                    className={cn(
                      "p-5 rounded-[32px] border-2 transition-all text-right flex items-center gap-4 group relative",
                      font === f.id
                        ? "border-gold-primary bg-gold-primary/10 shadow-lg"
                        : "border-border/50 bg-muted/20 hover:border-gold-primary/40",
                    )}
                  >
                    <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Type className="size-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-primary" style={{ fontFamily: f.family }}>
                        {f.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
                    </div>
                    {font === f.id && (
                      <div className="absolute top-3 left-3 size-6 rounded-full bg-gold-primary flex items-center justify-center text-white">
                        <Check size={12} strokeWidth={4} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNavPicker && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" dir="rtl">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="card-surface w-full max-w-lg p-8 space-y-8 shadow-2xl rounded-[48px]"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-primary tracking-tight">تخصيص الشريط السفلي</h3>
                <button
                  onClick={() => setShowNavPicker(false)}
                  className="size-10 rounded-full bg-muted flex items-center justify-center transition-transform hover:rotate-90"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="text-sm text-muted-foreground">اختر حتى 3 اختصارات تظهر في الشريط السفلي.</p>
              <div className="grid grid-cols-1 gap-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {NAV_REGISTRY.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleNavToggle(n.id)}
                    className={cn(
                      "relative w-full p-4 rounded-2xl border-2 flex items-center gap-4 text-right transition-all",
                      bottomNavKeys.includes(n.id)
                        ? "border-primary bg-primary/10"
                        : "border-border/50 bg-muted/20 hover:border-primary/40",
                    )}
                  >
                    <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <n.icon className="size-5" />
                    </div>
                    <span className="font-black text-[11px] text-primary">{n.label}</span>
                    {bottomNavKeys.includes(n.id) && (
                      <div className="absolute top-2 left-2 size-5 rounded-full bg-primary flex items-center justify-center text-white">
                        <Check size={10} strokeWidth={4} />
                      </div>
                    )}
                  </button>
                ))}
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
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            dir="rtl"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="card-surface w-full max-w-lg p-8 space-y-8 shadow-2xl rounded-[48px]"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-primary tracking-tight">
                  ألوان الهوية الفاخرة
                </h3>
                <button
                  onClick={() => setShowColorPicker(false)}
                  className="size-10 rounded-full bg-muted flex items-center justify-center transition-transform hover:rotate-90"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {THEME_COLORS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleThemeColorChange(c.id)}
                    className={cn(
                      "p-5 rounded-[32px] border-2 transition-all text-right flex items-center gap-4 group relative",
                      themeColor === c.id
                        ? "border-gold-primary bg-gold-primary/10 shadow-lg"
                        : "border-border/50 bg-muted/20 hover:border-gold-primary/40",
                    )}
                  >
                    <div className="size-14 rounded-2xl shrink-0 shadow-lg border border-white/20" style={{ background: c.primary }} />
                    <div className="min-w-0">
                      <p className="font-black text-primary">{c.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{c.id === "emerald" ? "الهوية الأصلية" : "لون هوية بديل"}</p>
                    </div>
                    {themeColor === c.id && (
                      <div className="absolute top-3 left-3 size-6 rounded-full bg-gold-primary flex items-center justify-center text-white">
                        <Check size={12} strokeWidth={4} />
                      </div>
                    )}
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

function ThemeCard({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "card-surface p-6 flex items-center gap-4 text-right transition-all",
        active ? "border-primary bg-primary/10 shadow-xl" : "hover:-translate-y-1 hover:shadow-lg",
      )}
    >
      <div className={cn("size-12 rounded-2xl flex items-center justify-center", active ? "bg-primary text-white" : "bg-muted text-primary")}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-black text-primary">{label}</p>
        <p className="text-xs text-muted-foreground mt-1">مظهر الواجهة</p>
      </div>
    </button>
  );
}
