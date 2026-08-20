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

const fmtDate = (v?: string | null) => {
  if (!v) return "بدون موعد";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? "بدون موعد"
    : d.toLocaleDateString("ar-SA", { weekday: "short", day: "numeric", month: "short" });
};

const services = [
  { to: "/finance", label: "الصندوق المالي", desc: "إدارة الموارد المالية للعائلة", icon: Wallet },
  { to: "/tasks", label: "المهام", desc: "إدارة ومتابعة المهام", icon: ListChecks },
  { to: "/trips", label: "الرحلات", desc: "تنظيم الرحلات العائلية", icon: Plane },
  { to: "/meetings", label: "الاجتماعات", desc: "جدولة اجتماعات العائلة", icon: Users },
  { to: "/family-occasions", label: "مناسبات العائلة", desc: "أفراح ومناسبات وذكريات العائلة", icon: PartyPopper },
  { to: "/majlis", label: "المستندات", desc: "أخبار ووثائق العائلة", icon: Newspaper },
  { to: "/archive", label: "الألبومات", desc: "ذكرياتنا في صور جميلة", icon: Archive },
  { to: "/meetings", label: "التقويم", desc: "المواعيد والمناسبات", icon: CalendarDays },
  { to: "/chat", label: "المحادثات", desc: "تواصل خاص بالعائلة", icon: MessageCircle },
  { to: "/community", label: "ركن الأعضاء", desc: "مجتمع أفراد العائلة", icon: Users },
  { to: "/heritage", label: "الإرث", desc: "تاريخ وإرث العائلة", icon: History },
  { to: "/family-tree", label: "شجرة العائلة", desc: "أجيال العائلة وروابطها", icon: Trees },
  { to: "/vault", label: "الخزنة", desc: "المحتوى العائلي الخاص", icon: Lock },
];

type LocalOccasion = { id: string; type?: string; title?: string; date?: string; time?: string; location?: string };
const occasionLabels: Record<string, string> = { wedding: "زواج / ملكة", newborn: "مولود", condolence: "عزاء", graduation: "تخرج", birthday: "يوم ميلاد", promotion: "ترقية / إنجاز", recovery: "شفاء / سلامة", gathering: "عزيمة / لمة عائلية", ramadan: "رمضان", eid_fitr: "عيد الفطر", eid_adha: "عيد الأضحى" };

export function DesktopDashboardExtras() {
  const path = useRouterState({ select: (s) => s.location.pathname });
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
    if (path !== "/dashboard") { setTarget(null); return; }
    let tries = 0;
    const id = window.setInterval(() => {
      const node = document.querySelector("main > div.p-4.md\\:p-8.lg\\:p-12");
      if (node) { setTarget(node); window.clearInterval(id); }
      else if (++tries > 40) window.clearInterval(id);
    }, 50);
    return () => window.clearInterval(id);
  }, [path]);

  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem("alsaif:family-occasions");
        const rows = raw ? JSON.parse(raw) : [];
        const today = new Date();
        const y = today.getFullYear(), m = String(today.getMonth()+1).padStart(2,"0"), d = String(today.getDate()).padStart(2,"0");
        const key = `${y}-${m}-${d}`;
        setOccasions(
          Array.isArray(rows)
            ? rows
                .filter((x: LocalOccasion) => x?.id && x?.date && x.date >= key)
                .sort((a: LocalOccasion, b: LocalOccasion) => new Date(`${a.date}T${a.time || "23:59"}:00`).getTime() - new Date(`${b.date}T${b.time || "23:59"}:00`).getTime())
            : [],
        );
      } catch { setOccasions([]); }
    };
    const onVisibility = () => { if (!document.hidden) read(); };
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
    (eventsData?.meetings || []).forEach((x: any) => rows.push({ kind: "اجتماع", title: x.title, date: x.scheduled_at, location: x.location, icon: Users, to: "/meetings", actionLabel: "فتح الاجتماع" }));
    (eventsData?.trips || []).forEach((x: any) => rows.push({ kind: "رحلة", title: x.title, date: x.start_date, location: x.location, icon: Plane, to: "/trips", actionLabel: "فتح الرحلة" }));
    (eventsData?.tasks || []).forEach((x: any) => rows.push({ kind: "مهمة", title: x.title, date: x.due_date, icon: ListChecks, to: "/tasks", actionLabel: "فتح المهمة" }));
    occasions.forEach((x) => rows.push({
      kind: occasionLabels[x.type || ""] || "مناسبة عائلية",
      title: x.title || occasionLabels[x.type || ""] || "مناسبة عائلية",
      date: x.date ? `${x.date}T${x.time || "23:59"}:00` : x.date,
      location: x.location,
      icon: PartyPopper,
      to: "/family-occasions",
      actionLabel: "فتح المناسبة",
      isOccasion: true,
    }));
    return rows.sort((a, b) => new Date(a.date || "9999-12-31").getTime() - new Date(b.date || "9999-12-31").getTime()).slice(0, 12);
  }, [eventsData, occasions]);

  useEffect(() => { if (followIndex >= upcoming.length) setFollowIndex(0); }, [upcoming.length, followIndex]);

  const next = upcoming[followIndex] || upcoming[0];
  const tasks = (eventsData?.tasks || []).slice(0, 4);
  const latest = announcementsData?.[0];
  const name = profile?.realName || "عضو العائلة";
  const visibleServices = servicesExpanded ? services : services.slice(0, 4);

  if (path !== "/dashboard" || !target) return null;

  const toggleServices = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setServicesExpanded((v) => !v);
  };

  const toggleFollow = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setFollowExpanded((v) => !v);
  };

  return createPortal(
    <div className="desktop-rebuild-shell" dir="rtl">
      <div className="desktop-rebuild-root">
        <section className="desktop-hero-card">
          <div className="desktop-hero-logo">{logo ? <img src={logo} alt="شعار العائلة" /> : <Sparkles size={42} />}</div>
          <div className="desktop-hero-copy"><span>مساء الخير، يا أهل الوفاء</span><h1>{name}</h1><p>نصل العائلة، نحفظ الإرث، ونبني المستقبل.</p></div>
        </section>

        <section className="desktop-main-grid">
          <div className="desktop-services-panel">
            <div className="desktop-section-head">
              <div><h2>خدمات العائلة</h2><p>كل ما تحتاجه من مكان واحد</p></div>
              <button type="button" onClick={toggleServices} aria-expanded={servicesExpanded}>{servicesExpanded ? "إخفاء" : "عرض الكل"}</button>
            </div>
            <div className="desktop-services-grid">
              {visibleServices.map((item) => { const Icon = item.icon; return <Link key={`${item.to}-${item.label}`} to={item.to} className="desktop-service-card"><div className="desktop-service-icon"><Icon size={24} /></div><strong>{item.label}</strong><span>{item.desc}</span></Link>; })}
            </div>
          </div>

          <div className="desktop-follow-panel">
            <div className="desktop-section-head">
              <div><h2>المتابعة السريعة</h2><p>الاجتماعات والرحلات والمهام ومناسبات العائلة القادمة</p></div>
              <button type="button" onClick={toggleFollow} aria-expanded={followExpanded}>{followExpanded ? "إخفاء" : "عرض الكل"}</button>
            </div>
            {followExpanded ? (
              <div className="desktop-follow-list">
                {upcoming.length ? upcoming.map((item, i) => { const Icon = item.icon; return <div key={`${item.kind}-${i}`} className="desktop-follow-row"><div className="desktop-next-icon"><Icon size={20}/></div><div><b>{item.title}</b><span>{item.kind} · {fmtDate(item.date)}</span></div><Link to={item.to} aria-label={item.actionLabel || `فتح ${item.title}`}><ChevronLeft size={17}/></Link></div>; }) : <div className="desktop-next-empty"><Sparkles size={28}/><b>لا توجد عناصر قادمة</b></div>}
              </div>
            ) : next ? (
              <div className="desktop-follow-carousel">
                <div className="desktop-next-card">
                  <div className="desktop-next-top"><span>{next.kind}</span><div className="desktop-next-icon">{(() => { const Icon = next.icon; return <Icon size={22}/>; })()}</div></div>
                  <h3>{next.title}</h3>
                  <div className="desktop-next-meta"><span><CalendarDays size={15}/>{fmtDate(next.date)}</span>{next.location && <span><MapPin size={15}/>{next.location}</span>}</div>
                  <Link to={next.to} className="desktop-next-action">{next.actionLabel || "فتح التفاصيل"} <ChevronLeft size={16}/></Link>
                </div>
                {upcoming.length > 1 && <div className="desktop-follow-controls"><button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFollowIndex(i => (i - 1 + upcoming.length) % upcoming.length); }} aria-label="السابق"><ChevronRight size={18}/></button><div className="desktop-follow-dots">{upcoming.map((_, i) => <button key={i} type="button" className={i === followIndex ? "active" : ""} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFollowIndex(i); }} aria-label={`عنصر ${i+1}`}/>)}</div><button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFollowIndex(i => (i + 1) % upcoming.length); }} aria-label="التالي"><ChevronLeft size={18}/></button></div>}
              </div>
            ) : <div className="desktop-next-empty"><Sparkles size={28}/><b>لا توجد عناصر قادمة</b><span>ستظهر هنا المناسبات والاجتماعات والرحلات والمهام القادمة.</span></div>}
          </div>
        </section>

        <section className="desktop-command-grid">
          <div className="desktop-widget-card"><div className="desktop-widget-head"><div><CalendarDays/><span><b>تقويم العائلة</b><small>أقرب المواعيد القادمة</small></span></div><Link to="/meetings">عرض الكل</Link></div><div className="desktop-list">{upcoming.length ? upcoming.slice(0,4).map((item:any,i:number)=>{const Icon=item.icon;return <Link key={i} to={item.to}><Icon/><span><b>{item.title}</b><small>{item.kind} · {fmtDate(item.date)}</small></span><ChevronLeft/></Link>}) : <p className="desktop-empty">لا توجد مواعيد قريبة حاليًا</p>}</div></div>
          <div className="desktop-widget-card"><div className="desktop-widget-head"><div><Plus/><span><b>إضافة سريعة</b><small>ابدأ أهم أعمال العائلة</small></span></div></div><div className="desktop-quick-add">{[{to:"/family-occasions",label:"مناسبة",icon:Sparkles},{to:"/meetings",label:"اجتماع",icon:Users},{to:"/trips",label:"رحلة",icon:Plane},{to:"/tasks",label:"مهمة",icon:ListChecks}].map(x=>{const Icon=x.icon;return <Link key={x.label} to={x.to}><Icon/><span>إضافة {x.label}</span></Link>})}</div></div>
          <div className="desktop-widget-card"><div className="desktop-widget-head"><div><ListChecks/><span><b>مهامي القادمة</b><small>ما يحتاج انتباهك الآن</small></span></div><Link to="/tasks">المهام</Link></div><div className="desktop-list">{tasks.length ? tasks.map((t:any)=><Link key={t.id} to="/tasks"><ListChecks/><span><b>{t.title}</b><small>{t.due_date?fmtDate(t.due_date):"بدون موعد"}</small></span><ChevronLeft/></Link>) : <p className="desktop-empty">لا توجد مهام قادمة</p>}</div></div>
        </section>

        <section className="desktop-stats-row"><Link to="/finance"><Wallet/><span>رصيد الصندوق</span><b>{Number(fundBalance||0).toLocaleString("ar-SA")} ر.س</b></Link><Link to="/members"><Users/><span>أفراد العائلة</span><b>{counts?.members||0} عضو</b></Link><Link to="/trips"><Plane/><span>الرحلات القادمة</span><b>{eventsData?.trips?.length||0} رحلة</b></Link><Link to="/tasks"><ListChecks/><span>المهام</span><b>{counts?.tasks||0} مهمة</b></Link></section>
        <section className="desktop-editorial-grid"><Link to="/majlis" className="desktop-news-card">{latest?.imageUrl&&<img src={latest.imageUrl} alt=""/>}<div><Newspaper/><span>آخر إعلان عائلي</span><h3>{latest?.title||"مركز أخبار العائلة"}</h3><p>{latest?.cleanBody||"تابع أخبار وإعلانات مجلس العائلة من مكان واحد."}</p></div></Link><div className="desktop-side-stack"><Link to="/heritage" className="desktop-mini-card"><Scroll/><div><span>قبس من تاريخ السيف</span><b>{heritage?.title||"إرث العائلة"}</b><small>{heritage?.cleanBody||"تاريخنا يجمعنا."}</small></div></Link><Link to="/archive" className="desktop-mini-card"><ImageIcon/><div><span>معرض العائلة</span><b>الصور والذكريات</b><small>افتح الألبومات المحفوظة</small></div><Archive/></Link></div></section>
      </div>
    </div>, target,
  );
}
