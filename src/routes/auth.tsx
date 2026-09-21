import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BirthInfoFields } from "@/components/birth-info-fields";
import { buildBirthPayload, validateBirthDate, validateGender, type BirthCalendar, type Gender } from "@/lib/birth-info";
import { toast } from "sonner";
import {
  Loader2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  Send,
  X,
  Phone,
  User,
  Sparkles,
  ImagePlus,
  ChevronDown,
} from "lucide-react";
import palmWatermark from "@/assets/palm-watermark.png";
import authBgAsset from "@/assets/alsaif-auth-bg.png.asset.json";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { useAppBackground } from "@/hooks/use-app-background";
import { BackgroundUploader } from "@/components/background-uploader";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { getPublicStats } from "@/lib/api/stats.functions";
import { notifyAdminsOfNewRequest } from "@/lib/api/admin-notifications.functions";
import { useQuery } from "@tanstack/react-query";
import { queueLoginWelcome } from "@/lib/login-welcome";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { next?: string } => {
    const next = typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//") ? s.next : "";
    return next ? { next } : {};
  },
  head: () => ({
    meta: [
      { title: "مجلس السيف — بوابة الدخول" },
      { name: "description", content: "بوابة الدخول الخاصة بأعضاء عائلة السيف." },
    ],
  }),
  component: AuthPage,
});

type AuthMode = "login" | "request" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  // Honor a preserved same-origin return path (used by the agent-integrations
  // consent flow) instead of always landing on the dashboard.
  const goAfterAuth = () => {
    if (next) {
      window.location.replace(next);
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  };
  const [mode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const dynamicLogo = useSiteLogo();
  const { url: customBg } = useAppBackground("auth_bg");

  // Fetch Public Stats directly from the new project to ensure they are "honest"
  // Refresh every 10 seconds for a "live" feel
  const { data: counts = { members: 0, completedTasks: 0 } } = useQuery({
    queryKey: ["public-stats"],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("public_stats");
      return {
        members: (data as any)?.members ?? 0,
        completedTasks: (data as any)?.completedTasks ?? 0,
      };
    },

    refetchInterval: 1000 * 10,
  });

  const [reqForm, setReqForm] = useState({
    firstName: "",
    fatherName: "",
    grandFatherName: "",
    phone: "",
    email: "",
  });
  const [reqGender, setReqGender] = useState<Gender | null>(null);
  const [reqCalendar, setReqCalendar] = useState<BirthCalendar>("gregorian");
  const [reqBirthDate, setReqBirthDate] = useState("");

  const [msgIndex, setMsgIndex] = useState(0);
  const welcomeMessages = [
    "أهلاً بك في مجلس السيف الموقر",
    "نصل العائلة.. ونبض المجتمع",
    "حيث يُحفظ الإرث وتُبنى الروابط",
    "منصة التواصل الرسمية والخاصة",
  ];

  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr >= 5 && hr < 12) return "صباح الخير";
    if (hr >= 12 && hr < 17) return "مساء النور";
    if (hr >= 17 && hr < 21) return "مساء الخير";
    return "طاب مساؤك";
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % welcomeMessages.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        goAfterAuth();
        // Also check if admin for the uploader button
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id)
          .then(({ data: roles }) => {
            const r = (roles ?? []).map((x) => x.role);
            setIsAdmin(r.includes("admin") || r.includes("chairman"));
          });
      }
    });
  }, [navigate]);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loginMethod === "phone") {
      await onPhoneLogin();
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      let msg = "تأكد من صحة البريد وكلمة المرور";
      if (error.message.includes("Invalid login credentials")) msg = "بيانات الدخول غير صحيحة";
      if (error.message.includes("Email not confirmed")) msg = "يرجى تأكيد بريدك الإلكتروني أولاً";

      toast.error("عذراً، فشل الدخول", { description: msg });
      return;
    }
    if (data.user) queueLoginWelcome(data.user.id);
    goAfterAuth();
  }

  /** Phone sign-in: ask for a WhatsApp code, then exchange it for a session. */
  async function onPhoneLogin() {
    setLoading(true);
    try {
      if (otpStage === "phone") {
        const result = await requestPhoneLoginCode({ data: { phone: loginPhone } });
        if (!result.ok) {
          toast.error("تعذّر إرسال الرمز", { description: result.error });
          return;
        }
        setOtpStage("code");
        toast.success("تم إرسال رمز التحقق", { description: "تفقّد رسائل واتساب على رقمك المسجّل." });
        return;
      }

      const result = await verifyPhoneLoginCode({ data: { phone: loginPhone, code: otpCode } });
      if (!result.ok) {
        toast.error("رمز غير صحيح", { description: result.error });
        return;
      }

      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: result.tokenHash,
        type: "email",
      });
      if (error || !data.user) {
        toast.error("تعذّر إكمال الدخول", { description: "يرجى طلب رمز جديد والمحاولة مرة أخرى." });
        setOtpStage("phone");
        setOtpCode("");
        return;
      }
      queueLoginWelcome(data.user.id);
      goAfterAuth();
    } catch {
      toast.error("تعذّر الاتصال بالخدمة", { description: "تحقق من اتصالك بالإنترنت وحاول مجدداً." });
    } finally {
      setLoading(false);
    }
  }

  async function onForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      toast.error("يرجى إدخال البريد الإلكتروني أولاً");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error("فشل إرسال الرابط", { description: "تأكد من صحة البريد الإلكتروني المحفوظ." });
      return;
    }
    toast.success("تم إرسال رابط الاستعادة", { description: "تفقّد صندوق الوارد في بريدك الإلكتروني." });
    setAuthMode("login");
  }

  async function onRequest(e: React.FormEvent) {
    e.preventDefault();
    const genderError = validateGender(reqGender);
    if (genderError) {
      toast.error(genderError);
      return;
    }
    const birthError = validateBirthDate(reqCalendar, reqBirthDate);
    if (birthError) {
      toast.error(birthError);
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("account_requests").insert({
      first_name: reqForm.firstName,
      father_name: reqForm.fatherName,
      grandfather_name: reqForm.grandFatherName,
      phone: reqForm.phone,
      email: reqForm.email,
      status: "pending",
      ...buildBirthPayload(reqGender, reqCalendar, reqBirthDate),
    } as any);

    if (error) {
      setLoading(false);
      toast.error("لم نتمكن من إرسال الطلب", { description: "يرجى المحاولة مرة أخرى لاحقاً أو التواصل مع المدير مباشرة." });
      return;
    }

    // Notify admins (Chairman and Technical Admin)
    try {
      await notifyAdminsOfNewRequest({ data: { name: `${reqForm.firstName} ${reqForm.fatherName}` } });
    } catch (err) {
      console.warn("Notification error:", err);
    }

    setLoading(false);
    toast.success("تم إرسال طلبك بنجاح", { description: "بعد الموافقة سيصلك رابط آمن لتعيين كلمة المرور." });
    setAuthMode("login");
  }

  return (
    <div
      className="min-h-screen relative flex flex-col lg:flex-row bg-[#062F2B] overflow-y-auto"
      dir="rtl"
    >
      {/* 1. Full-Height Login Pane (Main on Mobile) */}
      <div className="w-full lg:w-[500px] xl:w-[600px] min-h-screen bg-gradient-to-b from-[#FCF8EF] via-[#F7F1E4] to-[#EEE4CF] relative z-20 flex flex-col items-center justify-center p-6 sm:p-20 border-l border-[#D8C282]/45 shadow-[-40px_0_100px_rgba(4,43,38,0.22)] shrink-0 overflow-hidden">

        {/* Layered Alsaif palette: teal depth, ivory light, and a restrained gold glow */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute right-0 top-24 h-2/3 w-px bg-gradient-to-b from-transparent via-gold-primary/35 to-transparent" />
          <div className="absolute inset-x-10 bottom-10 h-px bg-gradient-to-l from-transparent via-[#0B5D4B]/20 to-transparent" />
          <div className="absolute top-8 left-8 right-8 flex items-center gap-3 opacity-70">
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#0B5D4B]/20" />
            <span className="text-[11px] font-black tracking-[0.35em] text-[#0B5D4B]/55">إرثٌ يجمعنا</span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#0B5D4B]/20" />
          </div>
        </div>


        {/* Immersive Mobile Background (Shows the custom image with charcoal overlay) */}
        <div className="lg:hidden absolute inset-0 -z-10 overflow-hidden">
          <div
            className="size-full bg-cover bg-left opacity-10 scale-110 blur-[2px]"
            style={{ backgroundImage: `url(${customBg || authBgAsset.url})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#FCF8EF]/95 via-[#F7F1E4]/96 to-[#EEE4CF]/98" />
        </div>

        {/* Integrated Palm Watermark with Warm Golden Glow */}
        <div className="absolute -right-28 -bottom-28 size-[26rem] lg:size-[32rem] opacity-[0.14] pointer-events-none text-[#0B5D4B]">
          <div className="absolute inset-10 rounded-full border border-[#0B5D4B]/15" />
          <div className="absolute inset-16 rounded-full border border-gold-primary/20 border-dashed" />
          <img
            src={palmWatermark}
            alt=""
            className="size-full object-contain opacity-55 mix-blend-multiply rotate-[-8deg]"
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, type: "spring" }}
          className="w-full max-w-md flex flex-col items-center relative z-10"
        >
          {/* Mobile Welcome Tag */}
          <div className="lg:hidden mb-6 px-4 py-1.5 rounded-full bg-[#0B5D4B]/5 border border-[#0B5D4B]/15 backdrop-blur-md">
            <p className="text-[10px] font-black text-[#0B5D4B] uppercase tracking-[0.3em]">
              {getGreeting()}، يا أهل الوفاء
            </p>
          </div>

          {/* Logo Section */}
          <div className="mb-10 lg:mb-12 text-center flex flex-col items-center w-full">
            <div className="size-32 lg:size-52 rounded-[38px] lg:rounded-[60px] p-0.5 bg-gradient-to-br from-gold-primary via-gold-primary/20 to-gold-primary shadow-2xl mb-6 lg:mb-8 relative overflow-hidden group/logo flex items-center justify-center transition-all duration-700 hover:scale-105">
              <div className="size-full rounded-[36px] lg:rounded-[58px] bg-[#FCF8EF] p-3 lg:p-6 flex items-center justify-center shadow-inner overflow-hidden border border-emerald-950/5">
                {dynamicLogo && !dynamicLogo.includes("alsaif-mark") ? (
                  <div
                    className="size-full bg-contain bg-no-repeat bg-center transition-transform duration-1000 group-hover/logo:rotate-[360deg] scale-110"
                    style={{ backgroundImage: `url(${dynamicLogo})` }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 opacity-20">
                    <Sparkles className="size-16 text-gold-primary animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-gold-primary">
                      ارفع الشعار
                    </span>
                  </div>
                )}
              </div>
            </div>

            <h3 className="text-3xl lg:text-4xl font-black text-[#0B5D4B] tracking-tight">
              مجلس السيف
            </h3>
            <div className="flex items-center justify-center gap-3 mt-4 opacity-70">
              <div className="h-px w-8 bg-gold-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#0B5D4B]/70">
                بوابة المجلس الرقمية
              </span>
              <div className="h-px w-8 bg-gold-primary" />
            </div>
          </div>

          <AnimatePresence mode="wait">
            {mode === "login" ? (
              <motion.form
                key="login"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={onLogin}
                className="w-full space-y-6"
              >
                <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-[#0B5D4B]/5 border border-[#0B5D4B]/15">
                  {(
                    [
                      { id: "email" as const, label: "البريد وكلمة المرور" },
                      { id: "phone" as const, label: "رقم الجوال ورمز التحقق" },
                    ]
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setLoginMethod(tab.id)}
                      className={cn(
                        "h-12 rounded-xl text-[11px] font-black transition-all",
                        loginMethod === tab.id
                          ? "bg-gold-primary text-emerald-950 shadow-md"
                          : "text-[#0B3F3A]/70 hover:bg-white/60",
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {loginMethod === "email" ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-[#0B3F3A]/65 mr-1 uppercase tracking-widest">
                        البريد الإلكتروني
                      </label>
                      <div className="relative group">
                        <Mail className="absolute right-5 top-1/2 -translate-y-1/2 size-5 text-gold-primary/40 group-focus-within:text-gold-primary transition-colors" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full h-16 bg-white/60 border border-[#0B5D4B]/20 rounded-2xl pr-14 pl-6 font-bold text-sm text-[#0B3F3A] focus:outline-none focus:ring-4 focus:ring-gold-primary/5 focus:border-gold-primary transition-all shadow-inner"
                          placeholder="example@mail.com"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[11px] font-black text-[#0B3F3A]/65 uppercase tracking-widest">
                          كلمة المرور
                        </label>
                        <button
                          type="button"
                          onClick={() => setAuthMode("forgot")}
                          className="text-[11px] font-black text-[#0B5D4B] hover:text-[#064A43] hover:underline"
                        >
                          نسيت الكلمة؟
                        </button>
                      </div>
                      <div className="relative group">
                        <Lock className="absolute right-5 top-1/2 -translate-y-1/2 size-5 text-gold-primary/40 group-focus-within:text-gold-primary transition-colors" />
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full h-16 bg-white/60 border border-[#0B5D4B]/20 rounded-2xl pr-14 pl-14 font-bold text-sm text-[#0B3F3A] focus:outline-none focus:ring-4 focus:ring-gold-primary/5 focus:border-gold-primary transition-all shadow-inner"
                          placeholder="••••••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gold-primary transition-colors p-1"
                        >
                          {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-[#0B3F3A]/65 mr-1 uppercase tracking-widest">
                        رقم الجوال المسجّل
                      </label>
                      <div className="relative group">
                        <Phone className="absolute right-5 top-1/2 -translate-y-1/2 size-5 text-gold-primary/40 group-focus-within:text-gold-primary transition-colors" />
                        <input
                          type="tel"
                          inputMode="numeric"
                          required
                          disabled={otpStage === "code"}
                          value={loginPhone}
                          onChange={(e) => setLoginPhone(e.target.value)}
                          className="w-full h-16 bg-white/60 border border-[#0B5D4B]/20 rounded-2xl pr-14 pl-6 font-bold text-sm text-[#0B3F3A] focus:outline-none focus:ring-4 focus:ring-gold-primary/5 focus:border-gold-primary transition-all shadow-inner disabled:opacity-60"
                          placeholder="05xxxxxxxx"
                          dir="ltr"
                        />
                      </div>
                    </div>

                    {otpStage === "code" && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center px-1">
                          <label className="text-[11px] font-black text-[#0B3F3A]/65 uppercase tracking-widest">
                            رمز التحقق
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setOtpStage("phone");
                              setOtpCode("");
                            }}
                            className="text-[11px] font-black text-[#0B5D4B] hover:underline"
                          >
                            تغيير الرقم
                          </button>
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          required
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                          className="w-full h-16 bg-white/60 border border-[#0B5D4B]/20 rounded-2xl px-6 font-black text-2xl tracking-[0.6em] text-center text-[#0B3F3A] focus:outline-none focus:ring-4 focus:ring-gold-primary/5 focus:border-gold-primary transition-all shadow-inner"
                          placeholder="______"
                          dir="ltr"
                        />
                        <p className="text-[10px] font-bold text-[#0B3F3A]/55 text-center leading-relaxed">
                          أرسلنا رمزاً من ٦ أرقام على واتساب الخاص برقمك المسجّل، وصلاحيته ٥ دقائق.
                        </p>
                      </div>
                    )}
                  </>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-16 bg-gold-primary text-emerald-950 font-black rounded-2xl shadow-[0_15px_40px_-5px_rgba(212,175,55,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-4 mt-2"
                >
                  {loading ? (
                    <Loader2 className="animate-spin size-6" />
                  ) : (
                    <>
                      <span>
                        {loginMethod === "email"
                          ? "دخول للمجلس"
                          : otpStage === "phone"
                            ? "إرسال رمز التحقق"
                            : "تأكيد الرمز والدخول"}
                      </span>
                      <ArrowLeft className="size-6 rotate-180" />
                    </>
                  )}
                </button>


                <div className="pt-12 text-center border-t border-[#0B3F3A]/10 mt-6">
                  <p className="text-xs font-bold text-[#0B3F3A]/60 mb-6 uppercase tracking-widest">
                    منصة خاصة وحصرية لأفراد العائلة
                  </p>
                  <button
                    type="button"
                    onClick={() => setAuthMode("request")}
                    className="w-full h-14 rounded-2xl bg-[#0B5D4B]/5 text-[#0B3F3A] font-black text-xs hover:bg-[#0B5D4B]/10 transition-all border border-[#0B5D4B]/15 shadow-sm"
                  >
                    إرسال طلب فتح حساب جديد
                  </button>
                  <p className="mt-4 text-[10px] text-muted-foreground font-bold leading-relaxed">
                    الدخول متاح فقط للمدعوين رسمياً. سيتم مراجعة طلبك من قبل إدارة المجلس والرد عليك عبر الجوال.
                  </p>
                </div>
              </motion.form>
            ) : mode === "forgot" ? (
              <motion.form
                key="forgot"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={onForgot}
                className="w-full space-y-6"
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-2xl font-black text-[#0B5D4B] tracking-tight">
                    استعادة الحساب
                  </h3>
                  <button
                    type="button"
                    onClick={() => setAuthMode("login")}
                    className="size-10 rounded-full bg-[#0B5D4B]/5 flex items-center justify-center text-[#0B3F3A]/60 hover:bg-rose-500 hover:text-white transition-all"
                  >
                    <X size={22} />
                  </button>
                </div>
                <p className="text-sm text-[#0B3F3A]/65 leading-relaxed">
                  أدخل بريدك المسجل وسنرسل لك رابط التحديث فوراً.
                </p>
                <AuthField
                  label="البريد الإلكتروني"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="mail@example.com"
                  icon={<Mail size={20} />}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-16 bg-gold-primary text-emerald-950 font-black rounded-2xl shadow-lg mt-6 flex items-center justify-center gap-3"
                >
                  {loading ? (
                    <Loader2 className="size-6 animate-spin" />
                  ) : (
                    <>
                      <Send size={20} /> <span>إرسال الرابط</span>
                    </>
                  )}
                </button>
              </motion.form>
            ) : (
              <motion.div
                key="request-container"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative w-full"
              >
                <form
                  onSubmit={onRequest}
                  className="w-full space-y-5 max-h-[500px] overflow-y-auto pr-3 scrollbar-thin scrollbar-thumb-gold-primary/20 hover:scrollbar-thumb-gold-primary/40 scrollbar-track-transparent custom-scrollbar-pane"
                  dir="rtl"
                  id="auth-request-form"
                >
                  <div className="flex justify-between items-center mb-6 sticky top-0 bg-[#F7F1E4] z-10 py-2">
                    <h3 className="text-2xl font-black text-[#0B5D4B] tracking-tight">
                      طلب عضوية
                    </h3>
                    <button
                      type="button"
                      onClick={() => setAuthMode("login")}
                      className="size-10 rounded-full bg-[#0B5D4B]/5 flex items-center justify-center text-[#0B3F3A]/60 hover:bg-rose-500 hover:text-white transition-all"
                    >
                      <X size={22} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-5">
                    <AuthField
                      label="الاسم الأول"
                      value={reqForm.firstName}
                      onChange={(v: string) => setReqForm({ ...reqForm, firstName: v })}
                      placeholder="الاسم الشخصي"
                      icon={<User size={18} />}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <AuthField
                        label="اسم الأب"
                        value={reqForm.fatherName}
                        onChange={(v: string) => setReqForm({ ...reqForm, fatherName: v })}
                        placeholder="الأب"
                      />
                      <AuthField
                        label="اسم الجد"
                        value={reqForm.grandFatherName}
                        onChange={(v: string) => setReqForm({ ...reqForm, grandFatherName: v })}
                        placeholder="الجد"
                      />
                    </div>
                    <AuthField
                      label="رقم الجوال"
                      value={reqForm.phone}
                      onChange={(v: string) => setReqForm({ ...reqForm, phone: v })}
                      placeholder="05xxxxxxxx"
                      icon={<Phone size={18} />}
                    />
                    <BirthInfoFields
                      gender={reqGender}
                      onGender={setReqGender}
                      calendar={reqCalendar}
                      onCalendar={setReqCalendar}
                      dateValue={reqBirthDate}
                      onDate={setReqBirthDate}
                    />
                    <AuthField
                      label="البريد الإلكتروني"
                      type="email"
                      value={reqForm.email}
                      onChange={(v: string) => setReqForm({ ...reqForm, email: v })}
                      placeholder="mail@example.com"
                      icon={<Mail size={18} />}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-16 bg-gold-primary text-emerald-950 font-black rounded-2xl shadow-xl mt-6 flex items-center justify-center gap-3 mb-10"
                  >
                    {loading ? (
                      <Loader2 className="size-6 animate-spin" />
                    ) : (
                      <>
                        <Send size={20} /> <span>إرسال الطلب</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Floating Scroll Indicator for long forms */}
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 pointer-events-none animate-bounce opacity-40">
                  <ChevronDown className="size-5 text-gold-primary" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-12 pt-8 border-t border-[#0B3F3A]/10 flex flex-col items-center gap-2 opacity-35">
            <p className="text-[11px] font-black tracking-[0.5em] text-[#0B3F3A] uppercase">
              Alsaif Family • 2026
            </p>
          </div>
        </motion.div>
      </div>

      {/* 2. Welcoming Heritage Section (Left Side in RTL) */}
      <div className="hidden lg:flex flex-1 flex-col justify-center items-start p-12 xl:p-24 relative overflow-hidden bg-[#062F2B]">
        {/* Heritage Backdrop Image with Optimized Fitting */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <motion.div
            key={customBg}
            initial={{ scale: 1.02, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="size-full bg-no-repeat transition-all duration-1000"
            style={{
              backgroundImage: customBg ? `url(${customBg})` : "none",
              backgroundSize: "cover",
              backgroundPosition: "left", // Strictly focus on the left side
              filter: "brightness(0.9)"
            }}
          />
        </div>

        {/* Refined Seamless Blend - Enhanced for image integrity */}
        <div className="absolute inset-0 z-1 bg-gradient-to-l from-[#062F2B] via-[#062F2B]/30 to-transparent" />
        <div className="absolute inset-0 z-1 bg-gradient-to-t from-[#062F2B]/50 via-transparent to-transparent opacity-50" />
        <div className="absolute inset-y-0 left-0 w-48 z-1 bg-gradient-to-r from-[#062F2B]/30 to-transparent" />

        <div className="relative z-10 space-y-10 w-full max-w-4xl pr-4">
          <div className="space-y-6 text-right">
            <motion.div
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="flex items-center gap-4"
            >
              <div className="h-px w-12 bg-gold-primary/70" />
              <span className="text-[10px] font-black uppercase tracking-[0.35em] text-gold-primary">
                إرث يمتد.. ومستقبل يُبنى
              </span>
            </motion.div>

            <motion.h1
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 1, delay: 0.2 }}
              className="text-6xl xl:text-8xl font-black text-white tracking-tighter leading-[0.95] drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
            >
              عائلة
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-l from-gold-primary via-white/80 to-[#8E7745] animate-pulse">
                السيف
              </span>
            </motion.h1>

            <div className="h-16 overflow-hidden relative">
              <AnimatePresence mode="wait">
                <motion.p
                  key={msgIndex}
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -40, opacity: 0 }}
                  transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
                  className="text-2xl xl:text-4xl text-white/70 font-bold max-w-2xl leading-tight"
                >
                  {welcomeMessages[msgIndex]}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-16 pt-6">
            <HeritageStat label="الأعضاء المسجلين" value={`${counts.members}`} delay={0.4} />
            <HeritageStat label="مبادرات مكتملة" value={`${counts.completedTasks}`} delay={0.6} />
          </div>
        </div>

        {/* Change Background Button (Visible for admins) */}
        {isAdmin && (
          <div className="absolute bottom-10 left-10 z-50">
            <BackgroundUploader
              settingKey="auth_bg"
              label="تغيير الخلفية"
              className="bg-white/5 text-white/40 border border-white/10 hover:bg-gold-primary hover:text-emerald-950 transition-all shadow-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function HeritageStat({
  label,
  value,
  delay = 0,
}: {
  label: string;
  value: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay }}
      className="space-y-3 group cursor-default border-t border-gold-primary/20 pt-4"
    >
      <div className="flex items-baseline gap-2">
        <p className="text-5xl xl:text-6xl font-black text-white tabular-nums drop-shadow-[0_6px_18px_rgba(0,0,0,0.35)] group-hover:text-gold-primary transition-colors duration-700">
          {value}
        </p>
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gold-primary/60 group-hover:text-white transition-colors duration-500">
        {label}
      </p>
    </motion.div>
  );
}

function AuthField({ label, icon, value, onChange, placeholder, type = "text" }: any) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-black text-white/40 mr-1 uppercase tracking-widest">
        {label}
      </label>
      <div className="relative group">
        {icon && (
          <div className="absolute right-5 top-1/2 -translate-y-1/2 text-gold-primary/40 group-focus-within:text-gold-primary transition-colors">
            {icon}
          </div>
        )}
        <input
          type={type}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-16 bg-white/60 border border-[#0B5D4B]/20 rounded-2xl font-bold text-sm text-[#0B3F3A] focus:outline-none focus:ring-4 focus:ring-gold-primary/5 focus:border-gold-primary transition-all pr-14 pl-6 shadow-sm"
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
