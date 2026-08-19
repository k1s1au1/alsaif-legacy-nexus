import React, { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarDays, Plane, ListChecks, MapPin, Clock } from "lucide-react";
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

  return (
    <div className="hub-countdown">
      <span>{timeLeft.value}</span>
      <span>{timeLeft.label}</span>
    </div>
  );
}

type HubSlide =
  | { id: string; type: "trip"; data: any }
  | { id: string; type: "meeting"; data: any }
  | { id: string; type: "task"; data: any };

function formatDate(value?: string | null) {
  if (!value) return "بدون موعد";
  return new Date(value).toLocaleDateString("ar-SA", { day: "numeric", month: "short", year: "numeric" });
}

export function IntegratedHub({
  upcomingMeetings = [],
  upcomingTrips = [],
  upcomingTasks = [],
  tasksCount = 0,
  onViewTrip,
  onViewMeeting,
}: HubProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [slide, setSlide] = useState(0);

  const slides = useMemo<HubSlide[]>(() => {
    const items: HubSlide[] = [];

    upcomingTrips.forEach((trip) => {
      if (trip?.id) items.push({ id: `trip-${trip.id}`, type: "trip", data: trip });
    });

    upcomingMeetings.forEach((meeting) => {
      if (meeting?.id) items.push({ id: `meeting-${meeting.id}`, type: "meeting", data: meeting });
    });

    upcomingTasks.forEach((task) => {
      if (task?.id) items.push({ id: `task-${task.id}`, type: "task", data: task });
    });

    return items;
  }, [upcomingTrips, upcomingMeetings, upcomingTasks]);

  useEffect(() => {
    if (!api) return;
    const sync = () => setSlide(api.selectedScrollSnap());
    sync();
    api.on("select", sync);
    return () => {
      api.off("select", sync);
    };
  }, [api]);

  const firstTrip = upcomingTrips[0];
  const firstMeeting = upcomingMeetings[0];

  return (
    <section className="integrated-hub px-4 animate-fade-up" style={{ animationDelay: "250ms" }}>
      <div className="hub-mobile-slider">
        {slides.length > 0 ? (
          <>
            <Carousel setApi={setApi} opts={{ direction: "rtl", loop: slides.length > 1 }} className="w-full">
              <CarouselContent>
                {slides.map((item) => (
                  <CarouselItem key={item.id}>
                    {item.type === "trip" && (
                      <article className="hub-card hub-trip-ticket">
                        {item.data.image_url && (
                          <div className="hub-card-bg">
                            <TripImage path={item.data.image_url} alt="" className="size-full object-cover" />
                          </div>
                        )}
                        <div className="hub-trip-main">
                          <div className="hub-card-kicker"><Plane size={16} /> الرحلة القادمة</div>
                          <h3>{item.data.title}</h3>
                          <div className="hub-card-meta">
                            <span><MapPin size={13} />{item.data.location || "السعودية"}</span>
                            <span><Clock size={13} />{formatDate(item.data.start_date)}</span>
                          </div>
                        </div>
                        <div className="hub-ticket-stub">
                          <CountdownDisplay targetDate={item.data.start_date} />
                          <button onClick={() => onViewTrip?.(item.data)}>التفاصيل</button>
                        </div>
                      </article>
                    )}

                    {item.type === "meeting" && (
                      <article className="hub-card hub-meeting-card">
                        <div className="hub-meeting-date">
                          <CalendarDays size={24} />
                          <span>{formatDate(item.data.scheduled_at)}</span>
                        </div>
                        <div className="hub-meeting-copy">
                          <div className="hub-card-kicker"><CalendarDays size={15} /> الاجتماع القادم</div>
                          <h3>{item.data.title}</h3>
                          <p>
                            <Clock size={13} />
                            {new Date(item.data.scheduled_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                          <button onClick={() => onViewMeeting?.(item.data)}>عرض جدول الاجتماع</button>
                        </div>
                      </article>
                    )}

                    {item.type === "task" && (
                      <article className="hub-card hub-tasks-card">
                        <div className="hub-task-score">
                          <ListChecks size={25} />
                          <strong>{Math.max(0, Math.min(100, Number(item.data.progress ?? 0)))}%</strong>
                          <span>مكتملة</span>
                        </div>
                        <div className="hub-task-copy">
                          <div className="hub-card-kicker"><ListChecks size={15} /> المهمة</div>
                          <h3>{item.data.title}</h3>
                          <p>
                            {item.data.due_date ? `تاريخ الاستحقاق: ${formatDate(item.data.due_date)}` : "بدون موعد استحقاق"}
                          </p>
                          <Link to="/tasks">عرض المهمة</Link>
                        </div>
                      </article>
                    )}
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>

            {slides.length > 1 && (
              <div className="hub-dots" aria-label="مؤشر البطاقات">
                {slides.map((item, i) => (
                  <button
                    key={item.id}
                    onClick={() => api?.scrollTo(i)}
                    className={slide === i ? "active" : ""}
                    aria-label={`بطاقة ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <article className="hub-card hub-tasks-card">
            <div className="hub-task-score"><ListChecks size={25} /><strong>0</strong><span>عناصر</span></div>
            <div className="hub-task-copy">
              <div className="hub-card-kicker"><ListChecks size={15} /> المتابعة السريعة</div>
              <h3>لا توجد عناصر قادمة</h3>
              <p>عند إضافة رحلة أو اجتماع أو مهمة ستظهر هنا مباشرة.</p>
            </div>
          </article>
        )}
      </div>

      <div className="hub-desktop-legacy">
        <div className="grid grid-cols-3 gap-5">
          <DesktopCard icon={Plane} label="الرحلة القادمة" title={firstTrip?.title || "لا توجد رحلة قادمة"} />
          <DesktopCard icon={CalendarDays} label="الاجتماع القادم" title={firstMeeting?.title || "لا توجد اجتماعات قادمة"} />
          <DesktopCard icon={ListChecks} label="المسؤوليات" title={`${tasksCount} مهمة بانتظارك`} />
        </div>
      </div>
    </section>
  );
}

function DesktopCard({ icon: Icon, label, title }: { icon: any; label: string; title: string }) {
  return (
    <div className="rounded-3xl bg-[#051410] border border-white/10 p-8 text-white">
      <Icon className="text-gold-primary mb-5" />
      <div className="text-xs text-white/50 mb-2">{label}</div>
      <div className="text-xl font-black">{title}</div>
    </div>
  );
}
