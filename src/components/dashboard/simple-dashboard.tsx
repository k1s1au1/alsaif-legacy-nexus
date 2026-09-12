import { listOccasions } from "@/lib/api/occasions";
import { useDayBoundaryKey } from "@/hooks/use-day-boundary";
import { Link } from "@tanstack/react-router";
import {
  Accessibility,
  CalendarDays,
  ChevronLeft,
  MessageCircle,
  Newspaper,
  PartyPopper,
  Plane,
  RotateCcw,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import "./simple-dashboard.css";

type SimpleDashboardProps = {
  name: string;
  meetings?: any[];
  trips?: any[];
  announcements?: any[];
  onExit: () => void;
};

type UpcomingItem = {
  id: string;
  title: string;
  kind: string;
  date: Date;
  to: string;
  icon: LucideIcon;
};

const parseDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const occasionDate = (occasion: any) => {
  if (!occasion?.date) return null;
  return parseDate(`${occasion.date}T${occasion.time || "12:00"}:00`);
};

const formatEventDate = (date: Date) =>
  date.toLocaleDateString("ar-SA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

export function SimpleDashboard({
  name,
  meetings = [],
  trips = [],
  announcements = [],
  onExit,
}: SimpleDashboardProps) {
  const activeDayKey = useDayBoundaryKey();
  const today = useMemo(() => new Date(), [activeDayKey]);
  const [occasions, setOccasions] = useState<any[]>([]);

  useEffect(() => {
    let active = true;

    const loadOccasions = async () => {
      try {
        const rows = await listOccasions({
          userId: null,
          canManageOccasions: false,
        });
        if (active) {
          const startOfToday = new Date();
          startOfToday.setHours(0, 0, 0, 0);
          setOccasions(
            (rows || []).filter((occasion: any) => {
              const date = occasionDate(occasion);
              return Boolean(date && date >= startOfToday);
            }),
          );
        }
      } catch {
        if (active) setOccasions([]);
      }
    };

    void loadOccasions();
    return () => {
      active = false;
    };
  }, [activeDayKey]);

  const nextItem = useMemo<UpcomingItem | null>(() => {
    const startOfToday = new Date(today);
    startOfToday.setHours(0, 0, 0, 0);
    const rows: UpcomingItem[] = [];

    meetings.forEach((meeting: any) => {
      const date = parseDate(meeting?.scheduled_at);
      if (!meeting?.id || !date || date < startOfToday) return;
      rows.push({
        id: `meeting-${meeting.id}`,
        title: meeting.title || "اجتماع العائلة",
        kind: "اجتماع",
        date,
        to: "/meetings",
        icon: Users,
      });
    });

    trips.forEach((trip: any) => {
      const date = parseDate(trip?.start_date);
      if (!trip?.id || !date || date < startOfToday) return;
      rows.push({
        id: `trip-${trip.id}`,
        title: trip.title || "ترفيه عائلي",
        kind: "رحلة",
        date,
        to: "/trips",
        icon: Plane,
      });
    });

    occasions.forEach((occasion: any) => {
      const date = occasionDate(occasion);
      if (!occasion?.id || !date || date < startOfToday) return;
      rows.push({
        id: `occasion-${occasion.id}`,
        title: occasion.title || "مناسبة عائلية",
        kind: "مناسبة",
        date,
        to: "/family-occasions",
        icon: PartyPopper,
      });
    });

    return rows.sort((a, b) => a.date.getTime() - b.date.getTime())[0] || null;
  }, [meetings, occasions, today, trips]);

  const firstName = name.trim().split(/\s+/)[0] || "عضو العائلة";
  const EventIcon = nextItem?.icon || CalendarDays;
  const services = [
    {
      to: "/majlis",
      label: "أخبار العائلة",
      description: "آخر الأخبار والإعلانات",
      icon: Newspaper,
      badge: announcements.length,
    },
    {
      to: "/family-occasions",
      label: "المناسبات",
      description: "مناسبات العائلة القادمة",
      icon: PartyPopper,
      badge: occasions.length,
    },
    {
      to: "/chat",
      label: "المحادثات",
      description: "التواصل مع أفراد العائلة",
      icon: MessageCircle,
      badge: 0,
    },
    {
      to: "/calendar",
      label: "التقويم",
      description: "كل المواعيد في مكان واحد",
      icon: CalendarDays,
      badge: 0,
    },
  ];

  return (
    <main className="simple-home" dir="rtl">
      <section className="simple-home__mode-bar" aria-label="حالة وضع العرض">
        <div className="simple-home__mode-copy">
          <span className="simple-home__mode-icon" aria-hidden="true">
            <Accessibility />
          </span>
          <span>
            <small>واجهة أوضح وأسهل</small>
            <b>الوضع المبسّط مفعّل</b>
          </span>
        </div>
        <button type="button" onClick={onExit} aria-label="العودة إلى الوضع العادي">
          <RotateCcw aria-hidden="true" />
          <span>الوضع العادي</span>
        </button>
      </section>

      <header className="simple-home__welcome">
        <p>أهلًا وسهلًا</p>
        <h1>حياك الله يا {firstName}</h1>
        <span>كل ما تحتاجه أمامك بوضوح</span>
      </header>

      <Link
        to={(nextItem?.to || "/calendar") as any}
        className="simple-home__next-event"
        aria-label={nextItem ? `عرض تفاصيل ${nextItem.title}` : "فتح تقويم العائلة"}
      >
        <span className="simple-home__event-icon" aria-hidden="true">
          <EventIcon />
        </span>
        <span className="simple-home__event-copy">
          <small>{nextItem ? `الموعد القادم · ${nextItem.kind}` : "المواعيد القادمة"}</small>
          <h2>{nextItem?.title || "لا توجد مواعيد قريبة"}</h2>
          <time dateTime={nextItem?.date.toISOString()}>
            {nextItem ? formatEventDate(nextItem.date) : "يمكنك الاطلاع على تقويم العائلة"}
          </time>
        </span>
        <span className="simple-home__event-action">
          {nextItem ? "عرض التفاصيل" : "فتح التقويم"}
          <ChevronLeft aria-hidden="true" />
        </span>
      </Link>

      <section className="simple-home__services" aria-labelledby="simple-home-services-title">
        <div className="simple-home__section-title">
          <h2 id="simple-home-services-title">الخدمات الأساسية</h2>
          <span>اختر الخدمة التي تريدها</span>
        </div>
        <div className="simple-home__services-grid">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <Link key={service.to} to={service.to as any} className="simple-home__service">
                <span className="simple-home__service-icon" aria-hidden="true">
                  <Icon />
                </span>
                <span className="simple-home__service-copy">
                  <b>{service.label}</b>
                  <small>{service.description}</small>
                </span>
                {service.badge > 0 && (
                  <span className="simple-home__service-badge" aria-label={`${service.badge} عناصر`}>
                    {service.badge.toLocaleString("ar-SA")}
                  </span>
                )}
                <ChevronLeft className="simple-home__service-arrow" aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}

