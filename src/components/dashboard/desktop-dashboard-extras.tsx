import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Archive,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  ListChecks,
  Newspaper,
  Plane,
  Plus,
  Sparkles,
  Users,
  Wallet,
  Scroll,
  MapPin,
  PartyPopper,
  MessageCircle,
  History,
  Trees,
  Lock,
} from "lucide-react";
import {
  useDashboardAnnouncements,
  useUpcomingEvents,
  useDashboardCounts,
  useFundBalance,
  useHeritageSnippet,
  useProfile,
} from "@/hooks/use-dashboard-data";
import { useSiteLogo } from "@/hooks/use-site-logo";

const fmtDate = (value?: string | null) => {
  if (!value) return "بدون موعد";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "بدون موعد"
    : date.toLocaleDateString("ar-SA", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
};

const fmtMeetingDay = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("ar-SA", { day: "numeric" });
};

const fmtMeetingMonth = (value?: string | null) => {
  if (!value) return "موعد";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "موعد"
    : date.toLocaleDateString("ar-SA", { month: "short" });
};

const services = [
  { to: "/finance", label: "الصندوق المالي", desc: "إدارة الموارد المالية للعائلة", icon: Wallet },
  { to: "/tasks", label: "المهام", desc: "إدارة ومتابعة المهام", icon: ListChecks },
  { to: "/trips", label: "الرحلات", desc: "تنظيم الرحلات العائلية", icon: Plane },
  { to: "/meetings", label: "الاجتماعات", desc: "جدولة اجتماعات العائلة", icon: Users },
  {
    to: "/family-occasions",
    label: "مناسبات العائلة",
    desc: "أفراح ومناسبات وذكريات العائلة",
    icon: PartyPopper,
  },
  { to: "/majlis", label: "المستندات", desc: "أخبار ووثائق العائلة", icon: Newspaper },
  { to: "/archive", label: "الألبومات", desc: "ذكرياتنا في صور جميلة", icon: Archive },
  { to: "/calendar", label: "تقويم العائلة", desc: "المواعيد والمناسبات", icon: CalendarDays },
  { to: "/chat", label: "المحادثات", desc: "تواصل خاص بالعائلة", icon: MessageCircle },
  { to: "/community", label: "ركن الأعضاء", desc: "مجتمع أفراد العائلة", icon: Users },
  { to: "/heritage", label: "الإرث", desc: "تاريخ وإرث العائلة", icon: History },
  { to: "/family-tree", label: "شجرة العائلة", desc: "أجيال العائلة وروابطها", icon: Trees },
  { to: "/vault", label: "الخزنة", desc: "المحتوى العائلي الخاص", icon: Lock },
];

type LocalOccasion = {
  id: string;
  type?: string;
  design?: number;
  title?: string;
  date?: string;
  time?: string;
  location?: string;
  birthdayAudience?: "adult" | "child";
};

const occasionLabels: Record<string, string> = {
  wedding: "زواج / ملكة",
  newborn: "مولود",
  condolence: "عزاء",
  graduation: "تخرج",
  birthday: "يوم ميلاد",
  promotion: "ترقية / إنجاز",
  recovery: "شفاء / سلامة",
  gathering: "عزيمة / لمة عائلية",
  ramadan: "رمضان",
  eid_fitr: "عيد الفطر",
  eid_adha: "عيد الأضحى",
};

const occasionTemplatePath = (item: LocalOccasion) => {
  const rawType = item.type || "gathering";
  const type = Object.prototype.hasOwnProperty.call(occasionLabels, rawType)
    ? rawType
    : "gathering";
  const design = Math.min(3, Math.max(1, Number(item.design) || 1));

  if (type === "condolence") return "/occasion-templates/condolence-1.png.png";
  if (type === "wedding") return `/occasion-templates/wedding-${design}.png.jpg`;
  if (type === "birthday" && item.birthdayAudience === "child") {
    return `/occasion-templates/kids-birthday-${design}.png`;
  }
  if (type === "gathering") return `/occasion-templates/family-gathering-${design}.png`;
  if (type === "eid_fitr") return `/occasion-templates/eid-fitr-${design}.png`;
  if (type === "eid_adha") return `/occasion-templates/eid-adha-${design}.png`;
  return `/occasion-templates/${type}-${design}.png`;
};

export function DesktopDashboardExtras() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const { data: eventsData } = useUpcomingEvents();
  const { data: announcementsData } = useDashboardAnnouncements();
  const { data: counts } = useDashboardCounts();
  const { data: fundBalance } = useFundBalance();
  const { data: heritage } = useHeritageSnippet();
  const { data: profile } = useProfile();
  const logo = useSiteLogo();
  const [target, setTarget] = useState<Element | null>(null);
  const [servicesExpanded, setServicesExpanded] = useState(false);
  const [followExpanded, setFollowExpanded] = useState(false);
  const [followIndex, setFollowIndex] = useState(0);
  const [occasions, setOccasions] = useState<LocalOccasion[]>([]);

  useEffect(() => {
    if (path !== "/dashboard") {
      setTarget(null);
      return;
    }

    let tries = 0;
    const id = window.setInterval(() => {
      const node = document.querySelector("main > div.p-4.md\\:p-8.lg\\:p-12");
      if (node) {
        setTarget(node);
        window.clearInterval(id);
      } else if (++tries > 40) {
        window.clearInterval(id);
      }
    }, 50);

    return () => window.clearInterval(id);
  }, [path]);

  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem("alsaif:family-occasions");
        const rows = raw ? JSON.parse(raw) : [];
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, "0");
        const day = String(today.getDate()).padStart(2, "0");
        const key = `${year}-${month}-${day}`;

        setOccasions(
          Array.isArray(rows)
            ? rows
                .filter((item: LocalOccasion) => item?.id && item?.date && item.date >= key)
                .sort(
                  (a: LocalOccasion, b: LocalOccasion) =>
                    new Date(`${a.date}T${a.time || "23:59"}:00`).getTime() -
                    new Date(`${b.date}T${b.time || "23:59"}:00`).getTime(),
                )
            : [],
        );
      } catch {
        setOccasions([]);
      }
    };

    const onVisibility = () => {
      if (!document.hidden) read();
    };

    read();
    const syncId = window.setInterval(read, 3000);
    window.addEventListener("storage", read);
    window.addEventListener("focus", read);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(syncId);
      window.removeEventListener("storage", read);
      window.removeEventListener("focus", read);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [path]);

  const upcoming = useMemo(() => {
    const rows: any[] = [];

    (eventsData?.meetings || []).forEach((item: any) =>
      rows.push({
        kind: "اجتماع",
        title: item.title,
        date: item.scheduled_at,
        location: item.location,
        icon: Users,
        cardType: "meeting",
        to: "/meetings",
        actionLabel: "فتح الاجتماع",
      }),
    );
    (eventsData?.trips || []).forEach((item: any) =>
      rows.push({
        kind: "رحلة",
        title: item.title,
        date: item.start_date,
        location: item.location,
        icon: Plane,
        cardType: "trip",
        to: "/trips",
        actionLabel: "فتح الرحلة",
      }),
    );
    (eventsData?.tasks || []).forEach((item: any) =>
      rows.push({
        kind: "مهمة",
        title: item.title,
        date: item.due_date,
        icon: ListChecks,
        cardType: "task",
        to: "/tasks",
        actionLabel: "فتح المهمة",
      }),
    );
    occasions.forEach((item) =>
      rows.push({
        kind: occasionLabels[item.type || ""] || "مناسبة عائلية",
        title: item.title || occasionLabels[item.type || ""] || "مناسبة عائلية",
        date: item.date ? `${item.date}T${item.time || "23:59"}:00` : item.date,
        location: item.location,
        icon: PartyPopper,
        cardType: "occasion",
        templateUrl: occasionTemplatePath(item),
        to: "/family-occasions",
        actionLabel: "فتح المناسبة",
      }),
    );

    return rows
      .sort(
        (a, b) =>
          new Date(a.date || "9999-12-31").getTime() -
          new Date(b.date || "9999-12-31").getTime(),
      )
      .slice(0, 12);
  }, [eventsData, occasions]);

  useEffect(() => {
    if (followIndex >= upcoming.length) setFollowIndex(0);
  }, [upcoming.length, followIndex]);

  const featuredUpcoming = useMemo(() => {
    if (!upcoming.length) return [];
    return [...upcoming.slice(followIndex), ...upcoming.slice(0, followIndex)].slice(
      0,
      Math.min(3, upcoming.length),
    );
  }, [upcoming, followIndex]);

  const tasks = (eventsData?.tasks || []).slice(0, 4);
  const latest = announcementsData?.[0];
  const name = profile?.realName || "عضو العائلة";
  const visibleServices = servicesExpanded ? services : services.slice(0, 4);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "صباح الخير" : hour < 17 ? "مساء النور" : "مساء الخير";

  if (path !== "/dashboard" || !target) return null;

  return createPortal(
    <div className="desktop-rebuild-shell" dir="rtl">
      <div className="desktop-rebuild-root">
        <section className="desktop-overview-shell">
          <div className="desktop-hero-card">
            <div className="desktop-hero-logo">
              {logo ? <img src={logo} alt="شعار العائلة" /> : <Sparkles size={42} />}
            </div>
            <div className="desktop-hero-copy">
              <span>
                <Sparkles size={14} /> {greeting}، يا أهل الوفاء
              </span>
              <h1>{name}</h1>
              <p>نصل العائلة، نحفظ الإرث، ونبني المستقبل.</p>
            </div>
            <div className="desktop-hero-ornament" aria-hidden="true" />
          </div>

          <div className={`desktop-services-panel${servicesExpanded ? " is-expanded" : ""}`}>
            <div className="desktop-section-head desktop-section-head-on-dark">
              <div>
                <h2>خدمات العائلة</h2>
                <p>كل ما تحتاجه من مكان واحد</p>
              </div>
              <button
                type="button"
                onClick={() => setServicesExpanded((value) => !value)}
                aria-expanded={servicesExpanded}
              >
                {servicesExpanded ? "إخفاء" : "عرض الكل"}
              </button>
            </div>

            <div className="desktop-services-grid">
              {visibleServices.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={`${item.to}-${item.label}`}
                    to={item.to}
                    className="desktop-service-card"
                  >
                    <div className="desktop-service-icon">
                      <Icon size={24} />
                    </div>
                    <strong>{item.label}</strong>
                    <span>{item.desc}</span>
                  </Link>
                );
              })}
            </div>

            <button
              type="button"
              className="desktop-services-wide-toggle"
              onClick={() => setServicesExpanded((value) => !value)}
              aria-expanded={servicesExpanded}
            >
              {servicesExpanded ? "إغلاق قائمة الخدمات" : "عرض جميع الخدمات"}
              <ChevronLeft size={15} />
            </button>
          </div>
        </section>

        <section className="desktop-follow-panel">
          <div className="desktop-section-head">
            <div>
              <h2>المتابعة السريعة</h2>
              <p>الاجتماعات والرحلات والمهام ومناسبات العائلة القادمة</p>
            </div>
            <button
              type="button"
              onClick={() => setFollowExpanded((value) => !value)}
              aria-expanded={followExpanded}
            >
              {followExpanded ? "طي القائمة" : "عرض الكل"}
            </button>
          </div>

          {followExpanded ? (
            <div className="desktop-follow-list">
              {upcoming.length ? (
                upcoming.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div key={`${item.kind}-${index}`} className="desktop-follow-row">
                      <div className="desktop-next-icon">
                        <Icon size={20} />
                      </div>
                      <div>
                        <b>{item.title}</b>
                        <span>
                          {item.kind} · {fmtDate(item.date)}
                        </span>
                      </div>
                      <Link to={item.to} aria-label={item.actionLabel || `فتح ${item.title}`}>
                        <ChevronLeft size={17} />
                      </Link>
                    </div>
                  );
                })
              ) : (
                <div className="desktop-next-empty">
                  <Sparkles size={28} />
                  <b>لا توجد عناصر قادمة</b>
                </div>
              )}
            </div>
          ) : featuredUpcoming.length ? (
            <div className="desktop-follow-carousel">
              <div className="desktop-follow-cards">
                {featuredUpcoming.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <article
                      key={`${item.kind}-${item.title}-${index}`}
                      className={`desktop-next-card desktop-next-card--${item.cardType || "default"}`}
                    >
                      {item.cardType === "occasion" && item.templateUrl && (
                        <img
                          src={item.templateUrl}
                          alt=""
                          aria-hidden="true"
                          className="desktop-occasion-template"
                        />
                      )}

                      {item.cardType !== "occasion" && (
                        <div
                          className={`desktop-card-motif desktop-card-motif--${item.cardType || "default"}`}
                          aria-hidden="true"
                        >
                          {item.cardType === "meeting" && (
                            <>
                              <CalendarDays />
                              <strong>{fmtMeetingDay(item.date)}</strong>
                              <small>{fmtMeetingMonth(item.date)}</small>
                            </>
                          )}
                          {item.cardType === "trip" && (
                            <>
                              <Plane />
                              <span>ALS</span>
                              <small>BOARDING</small>
                            </>
                          )}
                          {item.cardType === "task" && (
                            <>
                              <span />
                              <span />
                              <span />
                            </>
                          )}
                        </div>
                      )}

                      <div className="desktop-next-top">
                        <span>{item.kind}</span>
                        <div className="desktop-next-icon">
                          <Icon size={22} />
                        </div>
                      </div>
                      <h3>{item.title}</h3>
                      <div className="desktop-next-meta">
                        <span>
                          <CalendarDays size={15} />
                          {fmtDate(item.date)}
                        </span>
                        {item.location && (
                          <span>
                            <MapPin size={15} />
                            {item.location}
                          </span>
                        )}
                      </div>
                      <Link to={item.to} className="desktop-next-action">
                        {item.actionLabel || "فتح التفاصيل"} <ChevronLeft size={16} />
                      </Link>
                    </article>
                  );
                })}
              </div>

              {upcoming.length > 1 && (
                <div className="desktop-follow-controls">
                  <button
                    type="button"
                    onClick={() =>
                      setFollowIndex(
                        (index) => (index - 1 + upcoming.length) % upcoming.length,
                      )
                    }
                    aria-label="السابق"
                  >
                    <ChevronRight size={18} />
                  </button>
                  <div className="desktop-follow-dots">
                    {upcoming.map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        className={index === followIndex ? "active" : ""}
                        onClick={() => setFollowIndex(index)}
                        aria-label={`عنصر ${index + 1}`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setFollowIndex((index) => (index + 1) % upcoming.length)}
                    aria-label="التالي"
                  >
                    <ChevronLeft size={18} />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="desktop-next-empty">
              <Sparkles size={28} />
              <b>لا توجد عناصر قادمة</b>
              <span>ستظهر هنا المناسبات والاجتماعات والرحلات والمهام القادمة.</span>
            </div>
          )}
        </section>

        <section className="desktop-command-grid">
          <div className="desktop-widget-card">
            <div className="desktop-widget-head">
              <div>
                <CalendarDays />
                <span>
                  <b>تقويم العائلة</b>
                  <small>أقرب المواعيد القادمة</small>
                </span>
              </div>
              <Link to="/calendar">عرض الكل</Link>
            </div>
            <div className="desktop-list">
              {upcoming.length ? (
                upcoming.slice(0, 4).map((item: any, index: number) => {
                  const Icon = item.icon;
                  return (
                    <Link key={index} to={item.to}>
                      <Icon />
                      <span>
                        <b>{item.title}</b>
                        <small>
                          {item.kind} · {fmtDate(item.date)}
                        </small>
                      </span>
                      <ChevronLeft />
                    </Link>
                  );
                })
              ) : (
                <p className="desktop-empty">لا توجد مواعيد قريبة حاليًا</p>
              )}
            </div>
          </div>

          <div className="desktop-widget-card">
            <div className="desktop-widget-head">
              <div>
                <Plus />
                <span>
                  <b>إضافة سريعة</b>
                  <small>ابدأ أهم أعمال العائلة</small>
                </span>
              </div>
            </div>
            <div className="desktop-quick-add">
              {[
                { to: "/family-occasions", label: "مناسبة", icon: Sparkles },
                { to: "/meetings", label: "اجتماع", icon: Users },
                { to: "/trips", label: "رحلة", icon: Plane },
                { to: "/tasks", label: "مهمة", icon: ListChecks },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.label} to={item.to}>
                    <Icon />
                    <span>إضافة {item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="desktop-widget-card">
            <div className="desktop-widget-head">
              <div>
                <ListChecks />
                <span>
                  <b>مهامي القادمة</b>
                  <small>ما يحتاج انتباهك الآن</small>
                </span>
              </div>
              <Link to="/tasks">المهام</Link>
            </div>
            <div className="desktop-list">
              {tasks.length ? (
                tasks.map((task: any) => (
                  <Link key={task.id} to="/tasks">
                    <ListChecks />
                    <span>
                      <b>{task.title}</b>
                      <small>{task.due_date ? fmtDate(task.due_date) : "بدون موعد"}</small>
                    </span>
                    <ChevronLeft />
                  </Link>
                ))
              ) : (
                <p className="desktop-empty">لا توجد مهام قادمة</p>
              )}
            </div>
          </div>
        </section>

        <section className="desktop-stats-row">
          <Link to="/finance">
            <Wallet />
            <span>رصيد الصندوق</span>
            <b>{Number(fundBalance || 0).toLocaleString("ar-SA")} ر.س</b>
          </Link>
          <Link to="/members">
            <Users />
            <span>أفراد العائلة</span>
            <b>{counts?.members || 0} عضو</b>
          </Link>
          <Link to="/trips">
            <Plane />
            <span>الرحلات القادمة</span>
            <b>{eventsData?.trips?.length || 0} رحلة</b>
          </Link>
          <Link to="/tasks">
            <ListChecks />
            <span>المهام</span>
            <b>{counts?.tasks || 0} مهمة</b>
          </Link>
        </section>

        <section className="desktop-editorial-grid">
          <Link to="/majlis" className="desktop-news-card">
            {latest?.imageUrl && <img src={latest.imageUrl} alt="" />}
            <div>
              <Newspaper />
              <span>آخر إعلان عائلي</span>
              <h3>{latest?.title || "مركز أخبار العائلة"}</h3>
              <p>{latest?.cleanBody || "تابع أخبار وإعلانات مجلس العائلة من مكان واحد."}</p>
            </div>
          </Link>
          <div className="desktop-side-stack">
            <Link to="/heritage" className="desktop-mini-card">
              <Scroll />
              <div>
                <span>قبس من تاريخ السيف</span>
                <b>{heritage?.title || "إرث العائلة"}</b>
                <small>{heritage?.cleanBody || "تاريخنا يجمعنا."}</small>
              </div>
            </Link>
            <Link to="/archive" className="desktop-mini-card">
              <ImageIcon />
              <div>
                <span>معرض العائلة</span>
                <b>الصور والذكريات</b>
                <small>افتح الألبومات المحفوظة</small>
              </div>
              <Archive />
            </Link>
          </div>
        </section>
      </div>
    </div>,
    target,
  );
}
