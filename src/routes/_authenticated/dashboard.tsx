import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { getSupabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import {
  Megaphone,
  Clock,
  MapPin,
  ChevronLeft,
  Wallet,
  Users,
  CalendarDays,
  ListChecks,
  Plane,
  X,
  Inbox,
  Image as ImageIcon,
  Loader2,
  Newspaper,
  Scroll,
  ShieldAlert,
  Send,
} from "lucide-react";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { HeritagePortal3D } from "@/components/dashboard/heritage-portal-3d";
import { ResponsiveDashboardExtras } from "@/components/dashboard/desktop-dashboard-extras";
import { AnimatedCounter } from "@/components/dashboard/animated-counter";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { QuickActionsBanner } from "@/components/quick-actions-banner";
import {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { TripImage } from "@/components/trip-image";
import { IntegratedHub } from "@/components/dashboard/integrated-hub";
import { PollsPopup } from "@/components/dashboard/polls-popup";
import { showIsland } from "@/components/dynamic-island";
import { useWidgetUpdater } from "@/hooks/use-widget-updater";
import {
  useProfile,
  useDashboardCounts,
  useUpcomingEvents,
  useDashboardAnnouncements,
  useFundBalance,
  useHeritageSnippet,
} from "@/hooks/use-dashboard-data";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "لوحة العائلة — السيف" },
      { name: "description", content: "مركز إدارة عائلة السيف." },
    ],
  }),
  component: Dashboard,
});

function ImmersiveView({
  item,
  onClose,
}: {
  item: { type: "trip" | "meeting" | "news"; data: any };
  onClose: () => void;
}) {
  const { type, data } = item;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-2xl p-0 md:p-10 overscroll-none"
      dir="rtl"
    >
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 200 }}
        className="bg-[var(--nav-bg)] w-full max-w-6xl h-[100dvh] md:h-[90vh] rounded-t-[32px] md:rounded-[60px] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col relative border-t border-white/20 md:border border-white/10"
      >
        <button
          onClick={onClose}
          className="absolute top-8 left-6 md:top-6 md:left-6 z-40 size-11 md:size-12 rounded-full bg-black/50 backdrop-blur-xl text-white flex items-center justify-center hover:bg-red-500 transition-all border border-white/20 group shadow-2xl"
        >
          <X size={22} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>
        <div className="flex-1 overflow-y-auto no-scrollbar pb-32 md:pb-16">
          <div className="relative h-[280px] md:h-[480px] shrink-0">
            {type === "trip" ? (
              <TripImage
                path={data.image_url}
                alt={data.title}
                className="size-full object-cover"
              />
            ) : (
              <div className="size-full bg-gradient-to-br from-primary via-[var(--nav-bg)] to-black flex items-center justify-center">
                {type === "meeting" ? (
                  <CalendarDays className="size-32 text-gold-primary opacity-10" />
                ) : (
                  <Newspaper className="size-32 text-gold-primary opacity-10" />
                )}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--nav-bg)] via-[var(--nav-bg)]/40 to-transparent" />
            <div className="absolute bottom-6 right-6 left-6 md:bottom-12 md:right-12 md:left-12 space-y-2 md:space-y-4">
              <div className="flex items-center gap-2 text-gold-primary bg-black/50 backdrop-blur-xl w-fit px-3 py-1 rounded-full border border-white/10 shadow-lg">
                {type === "trip" ? (
                  <Plane size={14} />
                ) : type === "meeting" ? (
                  <CalendarDays size={14} />
                ) : (
                  <Newspaper size={14} />
                )}
                <span className="text-[11px] md:text-[10px] font-black uppercase tracking-[0.25em]">
                  {type === "trip"
                    ? "ترفيه عائلي"
                    : type === "meeting"
                      ? "اجتماع مرتقب"
                      : "أخبار السيف"}
                </span>
              </div>
              <h2 className="text-3xl md:text-7xl font-black text-white leading-[1.1] tracking-tighter drop-shadow-2xl">
                {data.title}
              </h2>
            </div>
          </div>
          <div className="p-6 md:p-16 space-y-8 md:space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-10">
              <div className="flex items-center gap-4 bg-white/[0.03] p-5 rounded-[24px] border border-white/5 shadow-inner">
                <div className="size-12 rounded-2xl bg-gold-primary/10 flex items-center justify-center text-gold-primary border border-gold-primary/20 shadow-xl">
                  <Clock size={24} />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase opacity-40 mb-0.5">
                    الموعد والتاريخ
                  </p>
                  <p className="text-sm md:text-xl font-black text-white">
                    {new Date(
                      data.start_date || data.scheduled_at || data.created_at,
                    ).toLocaleDateString("ar-SA", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </p>
                </div>
              </div>
              {data.location && (
                <div className="flex items-center gap-4 bg-white/[0.03] p-5 rounded-[24px] border border-white/5 shadow-inner">
                  <div className="size-12 rounded-xl bg-gold-primary/10 flex items-center justify-center text-gold-primary border border-gold-primary/20 shadow-xl">
                    <MapPin size={24} />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase opacity-40 mb-0.5">
                      الموقع / المكان
                    </p>
                    <p className="text-sm md:text-xl font-black text-white">{data.location}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <h4 className="text-[11px] font-black uppercase tracking-[0.35em] text-gold-primary/60">
                  تفاصيل الحدث
                </h4>
                <div className="h-px flex-1 bg-white/10" />
              </div>
              <p className="text-base md:text-2xl font-bold text-white/80 leading-relaxed text-right md:text-justify whitespace-pre-wrap">
                {data.description ||
                  data.cleanBody ||
                  data.body ||
                  "لا توجد تفاصيل إضافية لهذا الحدث حالياً."}
              </p>
            </div>
            <div className="pt-6 flex flex-col md:flex-row gap-3 md:gap-4">
              {type === "trip" && (
                <Link
                  to="/trips/$tripId"
                  params={{ tripId: data.id }}
                  className="btn-gold py-5 md:py-6 px-12 rounded-full font-black text-lg md:text-xl text-center flex-1 shadow-[0_15px_40px_-5px_rgba(139,107,35,0.4)] hover:scale-[1.02] active:scale-95 transition-all"
                >
                  فتح صفحة الترفيه
                </Link>
              )}
              {type === "meeting" && (
                <Link
                  to="/meetings"
                  className="btn-gold py-5 md:py-6 px-12 rounded-full font-black text-lg md:text-xl text-center flex-1 shadow-[0_15px_40px_-5px_rgba(139,107,35,0.4)] hover:scale-[1.02] active:scale-95 transition-all"
                >
                  تأكيد الحضور
                </Link>
              )}
              {type === "news" && (
                <Link
                  to="/majlis"
                  className="btn-gold py-5 md:py-6 px-12 rounded-full font-black text-lg md:text-xl text-center flex-1 shadow-[0_15px_40px_-5px_rgba(139,107,35,0.4)] hover:scale-[1.02] active:scale-95 transition-all"
                >
                  فتح في الأخبار
                </Link>
              )}
              <button
                onClick={onClose}
                className="py-5 md:py-6 px-12 rounded-full bg-white/5 text-white font-black text-lg md:text-xl hover:bg-white/10 active:scale-95 transition-all border border-white/10"
              >
                إغلاق العرض
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

const SPIRITUAL_QUOTES = [
  // Friday Special
  {
    text: "يَا أَيُّهَا الَّذِينَ آمَنُوا إِذَا نُودِيَ لِلصَّلَاةِ مِن يَوْمِ الْجُمُعَةِ فَاسْعَوْا إِلَىٰ ذِكْرِ اللَّهِ",
    source: "سورة الجمعة",
    type: "quran",
    category: "friday",
  },
  {
    text: "إِنَّ مِنْ أَفْضَلِ أَيَّامِكُمْ يَوْمَ الْجُمُعَةِ ، فَأَكْثِرُوا عَلَيَّ مِنَ الصَّلَاةِ فِيهِ",
    source: "حديث شريف (رواه أبو داود)",
    type: "hadith",
    category: "friday",
  },

  // Monday & Thursday
  {
    text: "تُعْرَضُ الأَعْمَالُ يَوْمَ الاثْنَيْنِ وَالْخَمِيسِ ، فَأُحِبُّ أَنْ يُعْرَضَ عَمَلِي وَأَنَا صَائِمٌ",
    source: "حديث شريف (رواه الترمذي)",
    type: "hadith",
    category: "mon_thu",
  },

  // White Days (13, 14, 15 Hijri)
  {
    text: "صِيَامُ ثَلاثَةِ أَيَّامٍ مِنْ كُلِّ شَهْرٍ صِيَامُ الدَّهْرِ ، وَهِيَ أَيَّامُ الْبِيضِ",
    source: "حديث شريف (رواه النسائي)",
    type: "hadith",
    category: "white_days",
  },

  // General Quotes
  {
    text: "وَاعْتَصِمُوا بِحَبْلِ اللَّهِ جَمِيعًا وَلَا تَفَرَّقُوا",
    source: "سورة آل عمران",
    type: "quran",
    category: "general",
  },
  {
    text: "وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَىٰ",
    source: "سورة المائدة",
    type: "quran",
    category: "general",
  },
  {
    text: "إِنَّمَا الْمُؤْمِنُونَ إِخْوَةٌ",
    source: "سورة الحجرات",
    type: "quran",
    category: "general",
  },
  {
    text: "خَيْرُكُمْ خَيْرُكُمْ لِأَهْلِهِ",
    source: "حديث شريف",
    type: "hadith",
    category: "general",
  },
  {
    text: "الْبَرَكَةُ مَعَ أَكَابِرِكُمْ",
    source: "أثر مأثور",
    type: "wisdom",
    category: "general",
  },
  {
    text: "أَحَبُّ النَّاسِ إِلَى اللَّهِ أَنْفَعُهُمْ لِلنَّاسِ",
    source: "حديث شريف",
    type: "hadith",
    category: "general",
  },
];

function Dashboard() {
  const { data: profileData, isLoading: profileLoading } = useProfile();
  const { data: countsData } = useDashboardCounts();
  const { data: eventsData } = useUpcomingEvents();
  const { data: announcementsData } = useDashboardAnnouncements();
  const { data: fundBalance } = useFundBalance();
  const { data: heritageSnippet } = useHeritageSnippet();

  const spiritualQuote = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    let hijriDay = 1;
    try {
      hijriDay = parseInt(
        new Intl.DateTimeFormat("en-u-ca-islamic-uma-nu-latn", { day: "numeric" }).format(now),
      );
    } catch (e) {}

    if ([13, 14, 15].includes(hijriDay)) {
      return SPIRITUAL_QUOTES.find((q) => q.category === "white_days") || SPIRITUAL_QUOTES[0];
    }
    if (dayOfWeek === 5) {
      const fridayQuotes = SPIRITUAL_QUOTES.filter((q) => q.category === "friday");
      return fridayQuotes[now.getDate() % fridayQuotes.length];
    }
    if (dayOfWeek === 1 || dayOfWeek === 4) {
      return SPIRITUAL_QUOTES.find((q) => q.category === "mon_thu") || SPIRITUAL_QUOTES[0];
    }
    const generalQuotes = SPIRITUAL_QUOTES.filter((q) => q.category === "general");
    return generalQuotes[now.getDate() % generalQuotes.length];
  }, []);

  const [annIndex, setAnnIndex] = useState(0);
  const [announcementsApi, setAnnouncementsApi] = useState<CarouselApi>();
  const [statusIndex, setStatusIndex] = useState(0);
  const [showBugReport, setShowBugReport] = useState(false);
  const [immersiveItem, setImmersiveItem] = useState<{
    type: "trip" | "meeting" | "news";
    data: any;
  } | null>(null);
  const [bugBody, setBugBody] = useState("");
  const [bugImage, setBugImage] = useState<File | null>(null);
  const [bugImagePreview, setBugImagePreview] = useState<string | null>(null);
  const [bugSending, setBugSending] = useState(false);
  const hasGreeted = useRef(false);
  const dynamicLogo = useSiteLogo();

  useWidgetUpdater(eventsData?.meetings || [], eventsData?.trips || []);

  const announcementsAutoplay = useRef(Autoplay({ delay: 7000, stopOnInteraction: true }));
  const announcementsPlugins = useMemo(() => [announcementsAutoplay.current], []);
  const announcementsOpts = useMemo(() => ({ loop: true, direction: "rtl" as const }), []);

  useEffect(() => {
    if (announcementsData && !hasGreeted.current && profileData?.id) {
      const supabase = getSupabase();
      supabase
        .from("majlis_posts")
        .select("*")
        .ilike("body", "%---poll:%")
        .limit(10)
        .then(async ({ data: pollPosts }) => {
          if (pollPosts?.length) {
            const { data: myVotes } = await supabase
              .from("majlis_comments")
              .select("post_id")
              .eq("author_id", profileData.id)
              .in("post_id", pollPosts.map((p) => p.id))
              .like("body", "[VOTE]:%");

            const pendingCount = pollPosts.filter(
              (p) => !(myVotes || []).some((v) => v.post_id === p.id),
            ).length;

            if (pendingCount > 0)
              showIsland(`لديك ${pendingCount} اقتراح بانتظار تصويتك`, "info", 8000, () =>
                window.dispatchEvent(new CustomEvent("polls:open")),
              );
          }
          hasGreeted.current = true;
        });
    }
  }, [announcementsData, profileData?.id]);

  useEffect(() => {
    if (!announcementsApi) return;

    const syncSelectedNews = () => setAnnIndex(announcementsApi.selectedScrollSnap());
    syncSelectedNews();
    announcementsApi.on("select", syncSelectedNews);
    announcementsApi.on("reInit", syncSelectedNews);

    return () => {
      announcementsApi.off("select", syncSelectedNews);
      announcementsApi.off("reInit", syncSelectedNews);
    };
  }, [announcementsApi]);

  const statusMessages = useMemo(() => {
    const msgs = ["نصل العائلة، نحفظ الإرث، ونبني المستقبل."];
    if ((countsData?.myTasks || 0) > 0) msgs.push(`لديك ${countsData?.myTasks} مسؤوليات بانتظار إنجازك.`);
    if ((countsData?.newNews || 0) > 0) msgs.push(`هناك ${countsData?.newNews} أخبار جديدة في مركز المجلس.`);
    msgs.push("المجلس يرحب بكم دائماً يا أهل الوفاء.");
    msgs.push("كل خطوة تخطونها تبني مجداً لعائلة السيف.");
    return msgs;
  }, [countsData]);

  useEffect(() => {
    const t = setInterval(() => setStatusIndex((p) => (p + 1) % statusMessages.length), 6000);
    return () => clearInterval(t);
  }, [statusMessages.length]);

  const stats: Array<{
    label: string;
    value: number;
    suffix: string;
    color: string;
    icon: React.ElementType<{ className?: string }>;
    link: "/finance" | "/members" | "/trips" | "/tasks";
  }> = [
    {
      label: "رصيد الصندوق",
      value: fundBalance || 0,
      suffix: "ر.س",
      color: "bg-gradient-to-br from-emerald-600 to-teal-900",
      icon: Wallet,
      link: "/finance",
    },
    {
      label: "أفراد العائلة",
      value: countsData?.members || 0,
      suffix: "عضو",
      color: "bg-gradient-to-br from-primary to-emerald-950",
      icon: Users,
      link: "/members",
    },
    {
      label: "ترفيه عائلي",
      value: eventsData?.trips.length || 0,
      suffix: "وجهة",
      color: "bg-gradient-to-br from-[#8E7745] to-[#453a22]",
      icon: Plane,
      link: "/trips",
    },
    {
      label: "مهام قيد التنفيذ",
      value: countsData?.tasks || 0,
      suffix: "مهمة",
      color: "bg-gradient-to-br from-rose-700 to-rose-950",
      icon: ListChecks,
      link: "/tasks",
    },
  ];

  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr >= 5 && hr < 12) return "صباح الخير";
    if (hr >= 12 && hr < 17) return "مساء النور";
    if (hr >= 17 && hr < 21) return "مساء الخير";
    return "طاب مساؤك";
  };

  const sendBugReport = async () => {
    const supabase = getSupabase();
    if (!supabase || !profileData?.id) return;
    if (!bugBody.trim()) return;
    setBugSending(true);
    showIsland("جاري إرسال البلاغ...", "loading");
    try {
      let url = null;
      if (bugImage) {
        const path = `bugs/${profileData.id}/${crypto.randomUUID()}.${bugImage.name.split(".").pop()}`;
        await supabase.storage.from("trip-images").upload(path, bugImage);
        url = (await supabase.storage.from("trip-images").createSignedUrl(path, 31536000)).data
          ?.signedUrl;
      }
      await supabase
        .from("bug_reports" as any)
        .insert({ reporter_id: profileData.id, body: bugBody.trim(), image_url: url });
      showIsland("تم إرسال البلاغ بنجاح", "success");
      setShowBugReport(false);
      setBugBody("");
      setBugImage(null);
      setBugImagePreview(null);
    } catch {
      showIsland("فشل الإرسال", "error");
    } finally {
      setBugSending(false);
    }
  };

  const safeProfile = profileData ? {
    ...profileData,
    name: profileData.realName || "عضو العائلة"
  } : { id: null as any, name: "جاري التحميل...", role: "عضو", initial: "س", avatarPath: null as any };

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-12 text-gold-primary animate-spin" />
      </div>
    );
  }

  return (
    <AppShell title="لوحة العائلة" user={{ name: "", role: "", initial: "س" }}>
      <div className="dashboard-page max-w-6xl mx-auto space-y-12 pb-20 px-4 md:px-0">
        {/* 1. SPIRITUAL REMINDER */}
        <section className="dashboard-spiritual dashboard-faith-strip animate-fade-up">
          <div className="dashboard-faith-meta">
            <div className="dashboard-faith-label">
              <Scroll size={16} aria-hidden="true" />
              <span>نفحات إيمانية</span>
            </div>
            <span className="dashboard-faith-source">{spiritualQuote.source}</span>
          </div>
          <p style={{ fontFamily: "'Amiri', serif" }}>
            "{spiritualQuote.text}"
          </p>
        </section>

        {/* 2. INTERACTIVE NAJDI WELCOME PAVILION */}
        <section
          className="dashboard-hero dashboard-portal-hero animate-fade-up"
          data-transition-section
        >
          <div className="dashboard-portal-card">
            <div className="dashboard-portal-layout">
              <HeritagePortal3D
                logoUrl={dynamicLogo}
                greeting={getGreeting()}
                name={safeProfile.name}
                message={statusMessages[statusIndex]}
                className="dashboard-portal-model"
              />
            </div>
          </div>
        </section>

        {/* 3. QUICK ACTIONS BANNER - ONLY ONE INSTANCE */}
        <QuickActionsBanner />

        {/* 4. LATEST COUNCIL NEWS */}
        {announcementsData && announcementsData.length > 0 && (
          <section
            className="dashboard-news-section animate-fade-up"
            aria-labelledby="dashboard-news-title"
          >
            <div className="dashboard-news-heading">
              <h2 id="dashboard-news-title">
                <Newspaper size={20} aria-hidden="true" />
                آخر أخبار المجلس
              </h2>
              <Link to="/majlis">
                عرض الكل
                <ChevronLeft size={15} aria-hidden="true" />
              </Link>
            </div>

            <Carousel
              opts={announcementsOpts}
              plugins={announcementsPlugins}
              setApi={setAnnouncementsApi}
              className="dashboard-news-carousel"
            >
              <CarouselContent className="dashboard-news-track">
                {announcementsData.map((a, i) => (
                  <CarouselItem key={a.id || i} className="dashboard-news-slide">
                    <Link to="/majlis" className="dashboard-news-card">
                      <div className="dashboard-news-media">
                        {a.imageUrl ? (
                          <img src={a.imageUrl} alt="" />
                        ) : (
                          <div className="dashboard-news-media-fallback" aria-hidden="true">
                            <Newspaper size={36} />
                          </div>
                        )}
                      </div>

                      <div className="dashboard-news-copy">
                        <div className="dashboard-news-meta">
                          <span>{a._label || "إعلان المجلس"}</span>
                          <time dateTime={a.created_at}>
                            {new Date(a.created_at).toLocaleDateString("ar-SA", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </time>
                        </div>
                        <h3>{a.title}</h3>
                        <p>{a.cleanBody}</p>
                        <span className="dashboard-news-action">
                          قراءة الخبر
                          <ChevronLeft size={15} aria-hidden="true" />
                        </span>
                      </div>
                    </Link>
                  </CarouselItem>
                ))}
              </CarouselContent>

              {announcementsData.length > 1 && (
                <div className="dashboard-news-dots" aria-label="اختيار الخبر">
                  {announcementsData.map((a, i) => (
                    <button
                      key={a.id || i}
                      type="button"
                      className={i === annIndex ? "active" : ""}
                      onClick={() => announcementsApi?.scrollTo(i)}
                      aria-label={`الخبر ${i + 1}`}
                      aria-current={i === annIndex ? "true" : undefined}
                    />
                  ))}
                </div>
              )}
            </Carousel>
          </section>
        )}


        {/* 5. CONTENT HUB & POLLS */}
        <PollsPopup userId={safeProfile.id ?? null} />
        <IntegratedHub
          upcomingMeetings={eventsData?.meetings || []}
          upcomingTrips={eventsData?.trips || []}
          upcomingTasks={eventsData?.tasks || []}
          tasksCount={countsData?.tasks || 0}
          onViewTrip={(t) => setImmersiveItem({ type: "trip", data: t })}
          onViewMeeting={(m) => setImmersiveItem({ type: "meeting", data: m })}
        />

        {/* 6. HERITAGE SNIPPET */}
        {heritageSnippet && (
          <section className="dashboard-heritage animate-fade-up px-4 md:px-0">
            <Link
              to="/heritage"
              className="block group card-surface p-8 transition-all hover:scale-[1.01]"
            >
              <div className="flex items-center gap-6">
                <div className="size-16 rounded-[22px] bg-gold-primary/10 flex items-center justify-center shrink-0 border border-gold-primary/20">
                  <Scroll className="size-8 text-gold-primary" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <span className="text-[10px] font-black uppercase text-gold-primary/80">
                    قبس من تاريخ السيف
                  </span>
                  <h3 className="text-xl md:text-2xl font-black text-primary truncate">
                    {heritageSnippet.title}
                  </h3>
                  <p className="text-sm md:text-lg font-bold text-muted-foreground line-clamp-1 italic opacity-90 leading-relaxed">
                    "{heritageSnippet.cleanBody}"
                  </p>
                </div>
                <ChevronLeft className="size-6 text-gold-primary opacity-30 group-hover:opacity-100 group-hover:-translate-x-2 transition-all" />
              </div>
            </Link>
          </section>
        )}

        {/* 7. STATS GRID */}
        <section className="dashboard-stats-grid grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 px-2 md:px-0">
          {stats.map((s, i) => (
            <Link key={i} to={s.link} className="block group">
              <div
                className={cn(
                  "relative overflow-hidden rounded-[24px] md:rounded-[32px] p-5 md:p-8 text-white shadow-lg transition-all duration-500 hover:scale-[1.02]",
                  s.color,
                )}
              >
                <div className="absolute top-0 right-0 p-3 md:p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                  {React.createElement(s.icon, { className: "size-10 md:size-16" })}
                </div>
                <div className="relative z-10 space-y-2 md:space-y-4">
                  <p className="text-[10px] md:text-sm font-black uppercase tracking-widest opacity-80">
                    {s.label}
                  </p>
                  <div className="flex items-baseline gap-1 md:gap-2">
                    <span className="text-xl md:text-4xl font-black tracking-tighter">
                      <AnimatedCounter value={s.value} />
                    </span>
                    <span className="text-[10px] md:text-sm font-bold opacity-60">{s.suffix}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </section>

        {/* 8. SUPPORT SECTION */}
        <section className="dashboard-support pb-20 px-4 md:px-0 animate-fade-up">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {/* Bug Report Card */}
            <div
              onClick={() => setShowBugReport(true)}
              className="glass-surface p-8 md:p-10 border border-rose-500/20 rounded-[32px] md:rounded-[40px] flex items-center gap-6 cursor-pointer hover:bg-rose-500/5 transition-all group overflow-hidden relative shadow-xl"
            >
              <div className="size-16 md:size-20 rounded-[20px] md:rounded-[24px] bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-inner">
                <ShieldAlert className="size-8 md:size-10" />
              </div>
              <div className="text-right flex-1 min-w-0">
                <h3 className="text-xl md:text-2xl font-black text-primary tracking-tight">أبلغ عن عطل</h3>
                <p className="text-xs md:text-sm font-bold text-muted-foreground opacity-60 leading-relaxed mt-1">فريقنا التقني جاهز لمساعدتك وحل أي عائق برمجي في النظام.</p>
              </div>
              <div className="absolute -bottom-6 -left-6 size-24 bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-500/10 transition-colors" />
            </div>

            {/* Anonymous Suggestion Card */}
            <Link
              to="/suggestions"
              className="glass-surface p-8 md:p-10 border border-indigo-500/20 rounded-[32px] md:rounded-[40px] flex items-center gap-6 cursor-pointer hover:bg-indigo-500/5 transition-all group overflow-hidden relative shadow-xl"
            >
              <div className="size-16 md:size-20 rounded-[20px] md:rounded-[24px] bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500 shadow-inner">
                <Inbox className="size-8 md:size-10" />
              </div>
              <div className="text-right flex-1 min-w-0">
                <h3 className="text-xl md:text-2xl font-black text-primary tracking-tight">صندوق المقترحات</h3>
                <p className="text-xs md:text-sm font-bold text-muted-foreground opacity-60 leading-relaxed mt-1">شاركنا أفكارك لتطوير المجلس بسرية تامة وهويتك لن تظهر لأحد.</p>
              </div>
              <div className="absolute -bottom-6 -left-6 size-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors" />
            </Link>
          </div>
        </section>
      </div>

      <ResponsiveDashboardExtras />

      <AnimatePresence>
        {immersiveItem && (
          <ImmersiveView item={immersiveItem} onClose={() => setImmersiveItem(null)} />
        )}
        {showBugReport && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            dir="rtl"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-card border border-border rounded-[32px] w-full max-w-lg p-8 space-y-6 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-primary">بلاغ فني</h3>
                <button
                  onClick={() => setShowBugReport(false)}
                  className="size-10 rounded-full bg-muted flex items-center justify-center"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-4">
                <textarea
                  value={bugBody}
                  onChange={(e) => setBugBody(e.target.value)}
                  placeholder="صف المشكلة هنا..."
                  rows={5}
                  className="w-full p-6 rounded-2xl bg-muted/40 border border-border font-bold text-sm focus:outline-none focus:border-primary transition-all resize-none shadow-inner text-foreground"
                />
                <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-border/60 rounded-3xl cursor-pointer hover:bg-primary/5 transition-all bg-muted/20">
                  {bugImagePreview ? (
                    <img src={bugImagePreview} className="h-32 object-contain rounded-xl" alt="" />
                  ) : (
                    <>
                      <ImageIcon className="size-8 text-muted-foreground opacity-30" />
                      <span className="text-xs font-bold text-muted-foreground">لقطة شاشة</span>
                    </>
                  )}
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setBugImage(f);
                        setBugImagePreview(URL.createObjectURL(f));
                      }
                    }}
                  />
                </label>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBugReport(false)}
                  className="flex-1 py-4 rounded-2xl font-black text-muted-foreground hover:bg-muted transition-all"
                >
                  إلغاء
                </button>
                <button
                  onClick={sendBugReport}
                  disabled={bugSending || !bugBody.trim()}
                  className="flex-[2] btn-gold py-4 rounded-2xl font-black flex items-center justify-center gap-2"
                >
                  {bugSending ? <Loader2 className="animate-spin size-4" /> : <Send size={16} />}{" "}
                  إرسال
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
