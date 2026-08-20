import React, { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarDays, Plane, ListChecks, MapPin, Clock, Users, ChevronLeft, ChevronUp, Sparkles, PartyPopper } from "lucide-react";
import { TripImage } from "@/components/trip-image";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";

interface HubProps {
  upcomingMeetings: any[];
  upcomingTrips: any[];
  upcomingTasks?: any[];
  tasksCount: number;
  onViewTrip?: (trip: any) => void;
  onViewMeeting?: (meeting: any) => void;
}

type FamilyOccasion = {
  id: string;
  type: string;
  design?: number;
  title?: string;
  date?: string;
  time?: string;
  location?: string;
  details?: string;
  birthdayAudience?: "adult" | "child";
};

const OCCASIONS_STORAGE_KEY = "alsaif:family-occasions";
const OCCASION_TEMPLATES_ROOT = "/occasion-templates";

const OCCASION_LABELS: Record<string, string> = {
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

function occasionTemplatePath(occasion: FamilyOccasion) {
  const type = occasion.type;
  const design = occasion.design || 1;
  if (type === "condolence") return `${OCCASION_TEMPLATES_ROOT}/condolence-1.png.png`;
  if (type === "wedding") return `${OCCASION_TEMPLATES_ROOT}/wedding-${design}.png.jpg`;
  if (type === "birthday" && occasion.birthdayAudience === "child") return `${OCCASION_TEMPLATES_ROOT}/kids-birthday-${design}.png`;
  if (type === "gathering") return `${OCCASION_TEMPLATES_ROOT}/family-gathering-${design}.png`;
  if (type === "eid_fitr") return `${OCCASION_TEMPLATES_ROOT}/eid-fitr-${design}.png`;
  if (type === "eid_adha") return `${OCCASION_TEMPLATES_ROOT}/eid-adha-${design}.png`;
  return `${OCCASION_TEMPLATES_ROOT}/${type}-${design}.png`;
}

function CountdownDisplay({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState({ value: "0", label: "أيام متبقية" });
  useEffect(() => {
    const calculate = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) return { value: "0", label: "بدأ الآن" };
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      if (days >= 1) return { value: String(days), label: days === 1 ? "يوم متبقي" : "أيام متبقية" };
      if (hours >= 1) return { value: String(hours), label: "ساعات متبقية" };
      return { value: String(minutes), label: "دقائق متبقية" };
    };
    setTimeLeft(calculate());
    const id = setInterval(() => setTimeLeft(calculate()), 60000);
    return () => clearInterval(id);
  }, [targetDate]);
  return <div className="hub-countdown"><span>{timeLeft.value}</span><span>{timeLeft.label}</span></div>;
}

type HubSlide =
  | { id: string; type: "trip"; data: any }
  | { id: string; type: "meeting"; data: any }
  | { id: string; type: "task"; data: any }
  | { id: string; type: "occasion"; data: FamilyOccasion };

function formatDate(value?: string | null) {
  if (!value) return "بدون موعد";
  return new Date(value).toLocaleDateString("ar-SA", { day: "numeric", month: "long", year: "numeric" });
}

function occasionDateTime(occasion: FamilyOccasion) {
  if (!occasion.date) return null;
  const time = occasion.time || "23:59";
  return `${occasion.date}T${time}:00`;
}

function slideTime(item: HubSlide) {
  if (item.type === "trip") return new Date(item.data.start_date || "9999-12-31").getTime();
  if (item.type === "meeting") return new Date(item.data.scheduled_at || "9999-12-31").getTime();
  if (item.type === "occasion") return new Date(occasionDateTime(item.data) || "9999-12-31").getTime();
  return item.data.due_date ? new Date(item.data.due_date).getTime() : Number.MAX_SAFE_INTEGER;
}

export function IntegratedHub({ upcomingMeetings = [], upcomingTrips = [], upcomingTasks = [], tasksCount = 0, onViewTrip, onViewMeeting }: HubProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [slide, setSlide] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [upcomingOccasions, setUpcomingOccasions] = useState<FamilyOccasion[]>([]);

  useEffect(() => {
    const readOccasions = () => {
      try {
        const raw = localStorage.getItem(OCCASIONS_STORAGE_KEY);
        const all = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(all)) return setUpcomingOccasions([]);

        const now = new Date();
        const today = [
          now.getFullYear(),
          String(now.getMonth() + 1).padStart(2, "0"),
          String(now.getDate()).padStart(2, "0"),
        ].join("-");

        const next = all
          .filter((item: FamilyOccasion) => item?.id && item?.date && item.date >= today)
          .sort((a: FamilyOccasion, b: FamilyOccasion) => {
            const av = new Date(occasionDateTime(a) || "9999-12-31").getTime();
            const bv = new Date(occasionDateTime(b) || "9999-12-31").getTime();
            return av - bv;
          });
        setUpcomingOccasions(next);
      } catch {
        setUpcomingOccasions([]);
      }
    };

    readOccasions();
    window.addEventListener("focus", readOccasions);
    window.addEventListener("storage", readOccasions);
    const id = window.setInterval(readOccasions, 15000);
    return () => {
      window.removeEventListener("focus", readOccasions);
      window.removeEventListener("storage", readOccasions);
      window.clearInterval(id);
    };
  }, []);

  const slides = useMemo<HubSlide[]>(() => {
    const items: HubSlide[] = [];
    upcomingTrips.forEach((trip) => trip?.id && items.push({ id: `trip-${trip.id}`, type: "trip", data: trip }));
    upcomingMeetings.forEach((meeting) => meeting?.id && items.push({ id: `meeting-${meeting.id}`, type: "meeting", data: meeting }));
    upcomingOccasions.forEach((occasion) => occasion?.id && items.push({ id: `occasion-${occasion.id}`, type: "occasion", data: occasion }));
    upcomingTasks.forEach((task) => task?.id && items.push({ id: `task-${task.id}`, type: "task", data: task }));
    return items.sort((a, b) => slideTime(a) - slideTime(b));
  }, [upcomingTrips, upcomingMeetings, upcomingTasks, upcomingOccasions]);

  useEffect(() => {
    if (!api) return;
    const sync = () => setSlide(api.selectedScrollSnap());
    sync();
    api.on("select", sync);
    return () => { api.off("select", sync); };
  }, [api]);

  const firstTrip = upcomingTrips[0];
  const firstMeeting = upcomingMeetings[0];
  const firstOccasion = upcomingOccasions[0];

  const renderCard = (item: HubSlide) => (
    <React.Fragment key={item.id}>
      {item.type === "trip" && (
        <article className="hub-card hub-trip-ticket">
          {item.data.image_url && <div className="hub-card-bg"><TripImage path={item.data.image_url} alt="" className="size-full object-cover" /></div>}
          <div className="hub-trip-main">
            <div className="hub-card-kicker"><Plane size={16} /> الرحلة القادمة</div>
            <h3>{item.data.title}</h3>
            <div className="hub-card-meta">
              <span><CalendarDays size={13} />{formatDate(item.data.start_date)}</span>
              <span><MapPin size={13} />{item.data.location || "السعودية"}</span>
            </div>
            <button className="hub-outline-action" onClick={() => onViewTrip?.(item.data)}>التفاصيل <ChevronLeft size={14}/></button>
          </div>
          <div className="hub-ticket-stub">
            <Plane className="hub-watermark-icon" size={54} />
            <CountdownDisplay targetDate={item.data.start_date} />
          </div>
        </article>
      )}

      {item.type === "meeting" && (
        <article className="hub-card hub-meeting-card">
          <div className="hub-spiral" aria-hidden="true" />
          <div className="hub-meeting-copy">
            <div className="hub-card-kicker"><Users size={16} /> الاجتماع القادم</div>
            <h3>{item.data.title}</h3>
            <div className="hub-meeting-meta">
              <span><CalendarDays size={14}/>{formatDate(item.data.scheduled_at)}</span>
              <span><Clock size={14}/>{new Date(item.data.scheduled_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}</span>
              {item.data.location && <span><MapPin size={14}/>{item.data.location}</span>}
            </div>
            <button className="hub-gold-action" onClick={() => onViewMeeting?.(item.data)}>عرض جدول الأعمال <ChevronLeft size={14}/></button>
          </div>
        </article>
      )}

      {item.type === "occasion" && (
        <article className="relative min-h-[250px] overflow-hidden rounded-[28px] border border-white/10 shadow-xl">
          <img
            src={occasionTemplatePath(item.data)}
            alt={`قالب ${OCCASION_LABELS[item.data.type] || "المناسبة"}`}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/5" />
          <div className="relative z-10 flex min-h-[250px] flex-col justify-end p-5 text-white sm:p-6">
            <div className="mb-auto flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-black/35 px-3 py-1.5 text-[11px] font-black backdrop-blur-md">
                <PartyPopper size={14} /> {OCCASION_LABELS[item.data.type] || "مناسبة عائلية"}
              </div>
              {occasionDateTime(item.data) && <CountdownDisplay targetDate={occasionDateTime(item.data)!} />}
            </div>
            <h3 className="mt-16 text-2xl font-black drop-shadow-lg">{item.data.title || OCCASION_LABELS[item.data.type] || "مناسبة عائلية"}</h3>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold text-white/90">
              <span className="inline-flex items-center gap-1.5"><CalendarDays size={14}/>{formatDate(item.data.date)}</span>
              {item.data.time && <span className="inline-flex items-center gap-1.5"><Clock size={14}/>{item.data.time}</span>}
              {item.data.location && <span className="inline-flex items-center gap-1.5"><MapPin size={14}/>{item.data.location}</span>}
            </div>
            <Link to="/family-occasions" className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/90 px-4 py-2 text-xs font-black text-[#183f36] shadow-lg backdrop-blur">فتح المناسبة <ChevronLeft size={14}/></Link>
          </div>
        </article>
      )}

      {item.type === "task" && (
        <article className="hub-card hub-tasks-card">
          <div className="hub-task-copy">
            <div className="hub-card-kicker"><ListChecks size={16} /> المهمة</div>
            <span className="hub-task-nearest">أقرب مهمة</span>
            <h3>{item.data.title}</h3>
            <div className="hub-task-meta">
              <span><CalendarDays size={13}/>{item.data.due_date ? formatDate(item.data.due_date) : "بدون موعد"}</span>
            </div>
            <Link className="hub-outline-action" to="/tasks">عرض جميع المهام <ChevronLeft size={14}/></Link>
          </div>
          <div className="hub-task-score" style={{ "--progress": `${Math.max(0, Math.min(100, Number(item.data.progress ?? 0)))}%` } as React.CSSProperties}>
            <div className="hub-progress-ring"><strong>{Math.max(0, Math.min(100, Number(item.data.progress ?? 0)))}%</strong><span>مكتملة</span></div>
          </div>
        </article>
      )}
    </React.Fragment>
  );

  return (
    <section className="integrated-hub px-4 animate-fade-up" style={{ animationDelay: "250ms" }}>
      <div className="hub-mobile-slider">
        <div className="hub-quick-heading">
          <div className="hub-quick-title"><Sparkles size={16} /><span>المتابعة السريعة</span></div>
          <button type="button" className="hub-quick-all !text-[#b99755] font-bold opacity-100" style={{ color: "#b99755" }} onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
            {expanded ? <>طي القائمة <ChevronUp size={13} /></> : <>عرض الكل <ChevronLeft size={13} /></>}
          </button>
        </div>

        {slides.length > 0 ? (
          expanded ? (
            <div className="hub-expanded-list" style={{ display: "grid", gap: "1rem" }}>
              {slides.map(renderCard)}
            </div>
          ) : (
            <>
              <Carousel setApi={setApi} opts={{ direction: "rtl", loop: slides.length > 1, align: "center" }} className="w-full hub-main-carousel">
                <CarouselContent className="hub-main-carousel-content">
                  {slides.map((item) => (
                    <CarouselItem key={item.id} className="hub-carousel-item basis-[92%] md:basis-[82%]">
                      {renderCard(item)}
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Carousel>

              {slides.length > 1 && (
                <div className="hub-dots" aria-label="مؤشر البطاقات">
                  {slides.map((item, i) => <button key={item.id} onClick={() => api?.scrollTo(i)} className={slide === i ? "active" : ""} aria-label={`بطاقة ${i + 1}`} />)}
                </div>
              )}
            </>
          )
        ) : (
          <article className="hub-card hub-empty-card">
            <ListChecks size={30}/><h3>لا توجد عناصر قادمة</h3><p>عند إضافة رحلة أو اجتماع أو مناسبة أو مهمة ستظهر هنا مباشرة.</p>
          </article>
        )}
      </div>

      <div className="hub-desktop-legacy">
        <div className="grid grid-cols-4 gap-5">
          <DesktopCard icon={Plane} label="الرحلة القادمة" title={firstTrip?.title || "لا توجد رحلة قادمة"} />
          <DesktopCard icon={CalendarDays} label="الاجتماع القادم" title={firstMeeting?.title || "لا توجد اجتماعات قادمة"} />
          <DesktopCard icon={PartyPopper} label="المناسبة القادمة" title={firstOccasion?.title || (firstOccasion ? OCCASION_LABELS[firstOccasion.type] : "لا توجد مناسبات قادمة")} />
          <DesktopCard icon={ListChecks} label="المسؤوليات" title={`${tasksCount} مهمة بانتظارك`} />
        </div>
      </div>
    </section>
  );
}

function DesktopCard({ icon: Icon, label, title }: { icon: any; label: string; title: string }) {
  return <div className="rounded-3xl bg-[#051410] border border-white/10 p-8 text-white"><Icon className="text-gold-primary mb-5" /><div className="text-xs text-white/50 mb-2">{label}</div><div className="text-xl font-black">{title}</div></div>;
}
