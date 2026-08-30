import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Trophy, Footprints, Flame, TrendingUp, Loader2, RotateCw, ShieldCheck, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { UserAvatar } from "@/components/user-avatar";
import { Capacitor } from "@capacitor/core";
import { WebPedometer, isMotionSupported, requestMotionPermission, readStoredSteps } from "@/lib/web-pedometer";


export const Route = createFileRoute("/_authenticated/steps-challenge")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "تحدي الخطوات — السيف" },
      { name: "description", content: "تحدي الخطوات العائلي الأسبوعي بقياس حقيقي من مستشعر جوالك." },
      { property: "og:title", content: "تحدي الخطوات — السيف" },
      { property: "og:description", content: "تنافس مع أفراد العائلة بخطوات حقيقية أسبوعياً." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StepsChallengePage,
});

const isNative = () => Capacitor.isNativePlatform();

async function getStepsPlugin() {
  const { registerPlugin } = await import("@capacitor/core");
  return registerPlugin<any>("StepsPlugin");
}

// Local date (device timezone) — avoids the UTC off-by-one of toISOString().
function localDate(d = new Date()) {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeekIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // Sunday-based week
  return localDate(d);
}

function StepsChallengePage() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [mySteps, setMySteps] = useState(0);
  const [myToday, setMyToday] = useState(0);
  const [meId, setMeId] = useState<string | null>(null);
  const [sensorReady, setSensorReady] = useState<boolean | null>(null);
  const [healthConnectStatus, setHealthConnectStatus] = useState<number>(0); // 0: unknown, 1: available, 2: not installed, 3: update required
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const syncingRef = useRef(false);

  const checkHealth = useCallback(async () => {
    if (!isNative()) return;
    try {
      const plugin = await getStepsPlugin();
      const { status } = await plugin.checkHealthConnect();
      setHealthConnectStatus(status || 2);
    } catch {
      setHealthConnectStatus(2);
    }
  }, []);

  const checkSensor = useCallback(async () => {
    if (!isNative()) {
      setSensorReady(false);
      return false;
    }
    try {
      const plugin = await getStepsPlugin();
      const { available, granted } = await plugin.isAvailable();
      const ready = Boolean(available && granted);
      setSensorReady(ready);
      return ready;
    } catch {
      setSensorReady(false);
      return false;
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMeId(user.id);

      const { data: stepsData, error } = await supabase
        .from("steps_data")
        .select("user_id, steps, date")
        .gte("date", startOfWeekIso());

      if (error) throw error;

      const grouped: Record<string, number> = {};
      const today = localDate();
      let todayMine = 0;
      (stepsData ?? []).forEach((row) => {
        grouped[row.user_id] = (grouped[row.user_id] || 0) + (row.steps || 0);
        if (row.user_id === user.id && row.date === today) todayMine = row.steps || 0;
      });

      const userIds = Object.keys(grouped);
      let board: any[] = [];
      if (userIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, arabic_name, full_name, avatar_url")
          .in("id", userIds);
        board = (profiles || [])
          .map((p) => ({ ...p, totalSteps: grouped[p.id] || 0 }))
          .sort((a, b) => b.totalSteps - a.totalSteps);
      }

      setLeaderboard(board);
      setMySteps(grouped[user.id] || 0);
      setMyToday(todayMine);
    } catch (e) {
      console.error("Steps load error", e);
      toast.error("تعذر تحميل بيانات الخطوات");
    } finally {
      setLoading(false);
    }
  }, []);

  useRealtimeSync(["steps_data"], loadData);

  const saveSteps = useCallback(async (steps: number, source: "device" | "manual") => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("NOT_SIGNED_IN");

    // Never lower a day's count with a smaller reading (sensor restarts, etc.)
    const today = localDate();
    const { data: existing } = await supabase
      .from("steps_data")
      .select("steps")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle();

    const finalSteps = source === "manual" ? steps : Math.max(steps, existing?.steps ?? 0);

    const { error } = await supabase
      .from("steps_data")
      .upsert({ user_id: user.id, date: today, steps: finalSteps, source }, { onConflict: "user_id,date" });

    if (error) throw error;
    return finalSteps;
  }, []);

  const requestActivityPermission = async () => {
    if (!isNative()) {
      setManualOpen(true);
      return;
    }
    try {
      const plugin = await getStepsPlugin();
      const { granted } = await plugin.requestActivityPermission();
      console.log("Permission request result:", granted);

      if (!granted) {
        toast.error("لم يتم منح إذن النشاط البدني", { description: "افتح إعدادات التطبيق واسمح بـ (النشاط البدني)." });
        setSensorReady(false);
        return;
      }

      const { available } = await plugin.isAvailable();
      if (!available) {
        toast.error("جوالك لا يحتوي على مستشعر خطوات", { description: "يمكنك إدخال خطواتك يدوياً." });
        setSensorReady(false);
        return;
      }

      setSensorReady(true);
      toast.success("تم تفعيل عدّاد الخطوات ✨");
      // Force a sync attempt immediately
      setTimeout(() => handleSync(true), 500);
    } catch (e) {
      console.error("Permission request failed", e);
      toast.error("فشل تفعيل عدّاد الخطوات", { description: "تأكد من تحديث التطبيق وإعطاء الصلاحيات." });
    }
  };

  const handleSync = useCallback(async (loud = true) => {
    if (syncingRef.current) return;
    if (!isNative()) {
      if (loud) setManualOpen(true);
      return;
    }
    syncingRef.current = true;
    setSyncing(true);
    let tId: string | number | undefined;
    if (loud) tId = toast.loading("جاري قراءة الخطوات من المستشعر...");

    try {
      const plugin = await getStepsPlugin();
      const result = await plugin.getTodaySteps();
      const steps = Number(result?.steps ?? 0);
      const saved = await saveSteps(steps, "device");
      if (loud) toast.success(`خطوات اليوم: ${saved.toLocaleString()} 👟`, { id: tId });
      await loadData();
    } catch (e: any) {
      const code = String(e?.message || e?.code || "");
      if (loud) {
        if (code.includes("NO_PERMISSION")) {
          toast.error("لم يتم منح إذن النشاط البدني", { id: tId });
          setSensorReady(false);
        } else if (code.includes("NO_SENSOR")) {
          toast.error("لا يوجد مستشعر خطوات في هذا الجهاز", { id: tId, description: "أدخل خطواتك يدوياً." });
          setSensorReady(false);
        } else if (code.includes("NO_DATA")) {
          toast.error("لم يصل قياس بعد", { id: tId, description: "تحرّك قليلاً ثم أعد المزامنة." });
        } else {
          toast.error("تعذرت المزامنة", { id: tId, description: code });
        }
      }
      console.error("Steps sync error", e);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [loadData, saveSteps]);

  const submitManual = async () => {
    const value = Number(manualValue);
    if (!Number.isFinite(value) || value < 0 || value > 200000) {
      toast.error("أدخل عدد خطوات صحيح");
      return;
    }
    try {
      const saved = await saveSteps(Math.round(value), "manual");
      toast.success(`تم تسجيل ${saved.toLocaleString()} خطوة لليوم`);
      setManualOpen(false);
      setManualValue("");
      await loadData();
    } catch (e: any) {
      toast.error("تعذر الحفظ", { description: e?.message });
    }
  };

  const handleHealthSync = async () => {
    if (healthConnectStatus !== 1) {
      toast.info("يرجى تثبيت أو تحديث تطبيق Health Connect من متجر جوجل بلاي أولاً.");
      try {
        const plugin = await getStepsPlugin();
        await plugin.openHealthConnectSettings();
      } catch (e) {}
      return;
    }
    const tId = toast.loading("جاري المزامنة مع بيانات الصحة...");
    try {
      const plugin = await getStepsPlugin();
      // This will trigger the permission request or just succeed if already granted
      const result = await plugin.getHealthConnectSteps();
      if (result.supported) {
        toast.success("تم الربط مع نظام الصحة بنجاح ✨", { id: tId });
        await handleSync(true);
      } else {
        // If supported but no data/permission, open settings
        await plugin.openHealthConnectSettings();
        toast.dismiss(tId);
      }
    } catch (e: any) {
      toast.error("فشل الربط مع بيانات الصحة", { id: tId, description: e?.message });
    }
  };

  useEffect(() => {
    (async () => {
      await loadData();
      await checkHealth();
      const ready = await checkSensor();
      if (ready) handleSync(false);
    })();

    let handle: any = null;
    if (isNative()) {
      (async () => {
        try {
          const { App } = await import(/* @vite-ignore */ "@capacitor/app");
          handle = await App.addListener("appStateChange", ({ isActive }) => {
            if (isActive) {
              handleSync(false);
              checkHealth();
            }
          });
        } catch (e) {
          console.warn("Capacitor App plugin not available", e);
        }
      })();
    }
    return () => { if (handle) handle.remove(); };
  }, [loadData, checkSensor, handleSync, checkHealth]);

  const myRank = leaderboard.findIndex((u) => u.id === meId) + 1;

  return (
    <AppShell title="تحدي الخطوات" user={{ name: "", role: "", initial: "ت" }}>
      <div className="max-w-4xl mx-auto space-y-12 pb-24" dir="rtl">
        <section className="text-center space-y-6 animate-fade-up">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-gold-primary/20 blur-[60px] rounded-full" />
            <div className="relative size-32 rounded-[40px] bg-gradient-to-br from-gold-primary to-primary p-0.5 shadow-2xl">
              <div className="size-full rounded-[38px] bg-card flex items-center justify-center">
                <Footprints className="size-16 text-gold-primary" strokeWidth={1.5} />
              </div>
            </div>
            <div className="absolute -bottom-2 -right-2 size-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-xl border-4 border-card">
              <Trophy size={20} />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-4xl font-black text-primary tracking-tight">تحدي خطوات العائلة</h1>
            <p className="text-muted-foreground font-bold">المنافسة الشريفة تبني أجساداً قوية وأرواحاً متآلفة.</p>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-up" style={{ animationDelay: "100ms" }}>
          <StatCard
            label="خطواتك هذا الأسبوع"
            value={mySteps.toLocaleString()}
            icon={<Footprints className="text-blue-500" />}
            desc={`اليوم: ${myToday.toLocaleString()} خطوة`}
          />
          <StatCard
            label="السعرات التقريبية"
            value={Math.round(mySteps * 0.04).toLocaleString()}
            icon={<Flame className="text-orange-500" />}
            unit="سعرة"
          />
          <StatCard
            label="مركزك الحالي"
            value={myRank > 0 ? myRank : "-"}
            icon={<TrendingUp className="text-emerald-500" />}
            desc="من بين جميع الأعضاء"
          />
        </div>

        <div className="flex flex-col items-center gap-4 animate-fade-up" style={{ animationDelay: "200ms" }}>
          {isNative() && healthConnectStatus === 1 && (
             <button
              onClick={handleHealthSync}
              className="px-12 py-5 rounded-full bg-emerald-600 text-white flex items-center gap-4 shadow-2xl hover:scale-105 active:scale-95 transition-all text-lg font-black"
            >
              <ShieldCheck className="size-6" /> ربط مع Health Connect
            </button>
          )}

          {isNative() && sensorReady !== true ? (
            <button
              onClick={requestActivityPermission}
              className="px-12 py-5 rounded-full bg-primary text-white flex items-center gap-4 shadow-2xl hover:scale-105 active:scale-95 transition-all text-lg font-black"
            >
              <ShieldCheck className="size-6" /> تفعيل عدّاد الخطوات
            </button>
          ) : isNative() ? (
            <button
              onClick={() => handleSync(true)}
              disabled={syncing}
              className="btn-gold px-12 py-5 rounded-full flex items-center gap-4 shadow-2xl hover:scale-105 active:scale-95 transition-all text-lg font-black disabled:opacity-60"
            >
              {syncing ? <Loader2 className="size-6 animate-spin" /> : <RotateCw className="size-6" />}
              مزامنة خطوات اليوم
            </button>
          ) : (
            <button
              onClick={() => setManualOpen(true)}
              className="btn-gold px-12 py-5 rounded-full flex items-center gap-4 shadow-2xl hover:scale-105 active:scale-95 transition-all text-lg font-black"
            >
              <Pencil className="size-6" /> تسجيل خطوات اليوم
            </button>
          )}

          <p className="text-[11px] font-bold text-muted-foreground opacity-70 text-center max-w-md leading-relaxed">
            {isNative()
              ? "يتم القياس من مستشعر الخطوات في جوالك أو عبر Health Connect ويُحدَّث تلقائياً عند فتح التطبيق."
              : "قياس الخطوات التلقائي متاح داخل تطبيق الجوال فقط. من المتصفح يمكنك تسجيل خطوات اليوم يدوياً."}
          </p>

          {isNative() && (
            <button onClick={() => setManualOpen(true)} className="text-xs font-black text-primary underline underline-offset-4 opacity-70">
              تسجيل يدوي بدلاً من المستشعر
            </button>
          )}
        </div>

        {manualOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setManualOpen(false)}>
            <div className="card-surface p-8 w-full max-w-sm space-y-6" onClick={(e) => e.stopPropagation()}>
              <div className="space-y-1">
                <h2 className="text-xl font-black text-primary">تسجيل خطوات اليوم</h2>
                <p className="text-xs font-bold text-muted-foreground">أدخل عدد خطواتك كما يظهر في تطبيق الصحة بجوالك.</p>
              </div>
              <input
                type="number"
                inputMode="numeric"
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
                placeholder="مثال: 8500"
                className="w-full rounded-2xl border border-border bg-background px-5 py-4 text-lg font-black text-primary outline-none focus:ring-2 focus:ring-primary/30"
              />
              <div className="flex gap-3">
                <button onClick={submitManual} className="btn-gold flex-1 py-3 rounded-2xl font-black">حفظ</button>
                <button onClick={() => setManualOpen(false)} className="flex-1 py-3 rounded-2xl font-black border border-border">إلغاء</button>
              </div>
            </div>
          </div>
        )}

        <section className="space-y-6 animate-fade-up" style={{ animationDelay: "300ms" }}>
          <div className="flex items-center gap-4">
            <h2 className="text-xs font-black text-primary uppercase tracking-[0.3em]">لوحة الصدارة الأسبوعية</h2>
            <div className="h-px flex-1 bg-border/60" />
          </div>

          <div className="card-surface overflow-hidden divide-y divide-border/40">
            {loading ? (
              <div className="p-20 text-center">
                <Loader2 className="animate-spin size-10 mx-auto text-primary opacity-20" />
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="p-20 text-center text-muted-foreground italic">
                لا يوجد بيانات خطوات مسجلة لهذا الأسبوع. كن أول من يبدأ!
              </div>
            ) : (
              leaderboard.map((user, index) => (
                <div
                  key={user.id}
                  className={cn(
                    "p-6 flex items-center justify-between transition-all",
                    user.id === meId ? "bg-primary/5 border-r-4 border-r-primary" : "hover:bg-muted/30"
                  )}
                >
                  <div className="flex items-center gap-5">
                    <div className="size-10 flex items-center justify-center font-black text-lg text-primary opacity-40 italic">
                      #{index + 1}
                    </div>
                    <div className="size-12 rounded-2xl overflow-hidden border border-border shadow-sm">
                      <UserAvatar path={user.avatar_url} name={user.arabic_name || user.full_name} className="size-full" />
                    </div>
                    <div>
                      <p className="font-black text-primary leading-none">{user.arabic_name || user.full_name}</p>
                      {user.id === meId && <span className="text-[11px] font-black uppercase text-gold-primary tracking-widest mt-1 block">أنت</span>}
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-2xl font-black text-primary tracking-tighter">{user.totalSteps.toLocaleString()}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">خطوة</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function StatCard({ label, value, icon, desc, unit }: any) {
  return (
    <div className="card-surface p-8 space-y-4">
      <div className="size-12 rounded-2xl bg-muted flex items-center justify-center shadow-inner">
        {icon}
      </div>
      <div>
        <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-black text-primary tracking-tighter">{value}</span>
          {unit && <span className="text-xs font-black text-primary/40 uppercase">{unit}</span>}
        </div>
        {desc && <p className="text-[10px] font-bold text-emerald-600 mt-2">{desc}</p>}
      </div>
    </div>
  );
}
