import React, { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarDays, Plane, ListChecks, Timer, MapPin, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { TripImage } from "@/components/trip-image";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";

interface HubProps {
  upcomingMeetings: any[];
  upcomingTrips: any[];
  tasksCount: number;
  onViewTrip?: (trip: any) => void;
  onViewMeeting?: (meeting: any) => void;
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

export function IntegratedHub({ upcomingMeetings = [], upcomingTrips = [], tasksCount = 0, onViewTrip, onViewMeeting }: HubProps) {
  const trip = upcomingTrips[0];
  const meeting = upcomingMeetings[0];
  const [api, setApi] = useState<CarouselApi>();
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    if (!api) return;
    const sync = () => setSlide(api.selectedScrollSnap());
    sync(); api.on("select", sync);
    return () => { api.off("select", sync); };
  }, [api]);

  const nudge = tasksCount === 0 ? "أنت فخر العائلة! لا توجد مهام معلقة حالياً." : "إنجازك لهذه المسؤوليات يصنع فرقاً في مسيرة العائلة.";

  return (
    <section className="integrated-hub px-4 animate-fade-up" style={{ animationDelay: "250ms" }}>
      {/* Mobile + tablet: three genuinely separate cards, one visible at a time by horizontal swipe. */}
      <div className="hub-mobile-slider">
        <Carousel setApi={setApi} opts={{ direction: "rtl", loop: true }} className="w-full">
          <CarouselContent>
            <CarouselItem>
              <article className="hub-card hub-trip-ticket">
                {trip?.image_url && <div className="hub-card-bg"><TripImage path={trip.image_url} alt="" className="size-full object-cover" /></div>}
                <div className="hub-trip-main">
                  <div className="hub-card-kicker"><Plane size={16} /> الرحلة القادمة</div>
                  <h3>{trip?.title || "لا توجد رحلة قادمة"}</h3>
                  {trip && <div className="hub-card-meta"><span><MapPin size={13}/>{trip.location || "السعودية"}</span><span><Clock size={13}/>{new Date(trip.start_date).toLocaleDateString("ar-SA", { day:"numeric", month:"long", year:"numeric" })}</span></div>}
                </div>
                <div className="hub-ticket-stub">
                  {trip ? <CountdownDisplay targetDate={trip.start_date} /> : <Plane size={30}/>} 
                  {trip && <button onClick={() => onViewTrip?.(trip)}>التفاصيل</button>}
                </div>
              </article>
            </CarouselItem>

            <CarouselItem>
              <article className="hub-card hub-meeting-card">
                <div className="hub-meeting-date"><CalendarDays size={24}/>{meeting ? new Date(meeting.scheduled_at).toLocaleDateString("ar-SA", { day:"numeric", month:"short" }) : "—"}</div>
                <div className="hub-meeting-copy">
                  <div className="hub-card-kicker"><CalendarDays size={15}/> الاجتماع القادم</div>
                  <h3>{meeting?.title || "لا توجد اجتماعات قادمة"}</h3>
                  {meeting && <p><Clock size={13}/>{new Date(meeting.scheduled_at).toLocaleTimeString("ar-SA", { hour:"2-digit", minute:"2-digit" })}</p>}
                  {meeting && <button onClick={() => onViewMeeting?.(meeting)}>عرض جدول الاجتماع</button>}
                </div>
              </article>
            </CarouselItem>

            <CarouselItem>
              <article className="hub-card hub-tasks-card">
                <div className="hub-task-score"><ListChecks size={25}/><strong>{tasksCount}</strong><span>مهمة</span></div>
                <div className="hub-task-copy">
                  <div className="hub-card-kicker"><ListChecks size={15}/> لوحة الإنجاز</div>
                  <h3>مسؤولياتك العائلية</h3>
                  <p>{nudge}</p>
                  <Link to="/tasks">عرض المهام</Link>
                </div>
              </article>
            </CarouselItem>
          </CarouselContent>
        </Carousel>
        <div className="hub-dots" aria-label="مؤشر البطاقات">{[0,1,2].map(i => <button key={i} onClick={() => api?.scrollTo(i)} className={slide === i ? "active" : ""} aria-label={`بطاقة ${i+1}`} />)}</div>
      </div>

      {/* Desktop stays intentionally simple and separate from the mobile/tablet redesign. */}
      <div className="hub-desktop-legacy">
        <div className="grid grid-cols-3 gap-5">
          <DesktopCard icon={Plane} label="الرحلة القادمة" title={trip?.title || "لا توجد رحلة قادمة"} />
          <DesktopCard icon={CalendarDays} label="الاجتماع القادم" title={meeting?.title || "لا توجد اجتماعات قادمة"} />
          <DesktopCard icon={ListChecks} label="المسؤوليات" title={`${tasksCount} مهمة بانتظارك`} />
        </div>
      </div>
    </section>
  );
}

function DesktopCard({ icon: Icon, label, title }: { icon:any; label:string; title:string }) {
  return <div className="rounded-3xl bg-[#051410] border border-white/10 p-8 text-white"><Icon className="text-gold-primary mb-5"/><div className="text-xs text-white/50 mb-2">{label}</div><div className="text-xl font-black">{title}</div></div>;
}
