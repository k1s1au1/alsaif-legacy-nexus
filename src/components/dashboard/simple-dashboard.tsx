import { listOccasions } from "@/lib/api/occasions";
import { useDayBoundaryKey } from "@/hooks/use-day-boundary";
import { IntegratedHub } from "@/components/dashboard/integrated-hub";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Accessibility,
  CalendarDays,
  ChevronLeft,
  MessageCircle,
  Newspaper,
  PartyPopper,
  RotateCcw,
} from "lucide-react";
import { useEffect, useState } from "react";
import "./simple-dashboard.css";

type SimpleDashboardProps = {
  name: string;
  meetings?: any[];
  trips?: any[];
  tasks?: any[];
  tasksCount?: number;
  announcements?: any[];
  onExit: () => void;
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

export function SimpleDashboard({
  name,
  meetings = [],
  trips = [],
  tasks = [],
  tasksCount = 0,
  announcements = [],
  onExit,
}: SimpleDashboardProps) {
  const navigate = useNavigate();
  const activeDayKey = useDayBoundaryKey();
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

  const firstName = name.trim().split(/\s+/)[0] || "عضو العائلة";
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

      <IntegratedHub
        upcomingMeetings={meetings}
        upcomingTrips={trips}
        upcomingTasks={tasks}
        tasksCount={tasksCount}
        onViewTrip={() => void navigate({ to: "/trips" })}
        onViewMeeting={() => void navigate({ to: "/meetings" })}
      />

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
