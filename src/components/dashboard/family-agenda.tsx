import { listOccasions } from "@/lib/api/occasions";
import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  MessageCircle,
  PartyPopper,
  Plane,
  Plus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { useDayBoundaryKey } from "@/hooks/use-day-boundary";
import { useUserRole } from "@/hooks/use-user-role";
import { MemberPostsPreview } from "./member-posts-preview";
import "./family-agenda.css";

type FamilyAgendaProps = {
  meetings?: any[];
  trips?: any[];
  tasks?: any[];
  occasions?: any[];
  className?: string;
};

type AgendaTone = "meeting" | "trip" | "task" | "occasion";

type AgendaItem = {
  id: string;
  kind: string;
  title: string;
  date?: string | null;
  to: string;
  tone: AgendaTone;
  icon: LucideIcon;
};

const WEEK_DAYS = [
  "السبت",
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
];

const pad = (value: number) => String(value).padStart(2, "0");

const toDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const dateKey = (value: Date) =>
  `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;

const itemDateKey = (value?: string | null) => {
  const parsed = toDate(value);
  return parsed ? dateKey(parsed) : "";
};

const occasionDate = (item: any) => {
  if (!item?.date) return null;
  return `${item.date}T${item.time || "23:59"}:00`;
};

export function FamilyAgenda({
  meetings = [],
  trips = [],
  tasks = [],
  occasions: suppliedOccasions,
  className = "",
}: FamilyAgendaProps) {
  const activeDayKey = useDayBoundaryKey();
  const today = useMemo(() => new Date(), [activeDayKey]);
  const [monthCursor, setMonthCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [loadedOccasions, setLoadedOccasions] = useState<any[]>([]);
  const actionsId = `family-agenda-actions-${useId().replace(/:/g, "")}`;

  const {
    userId,
    canManage: canManageSection,
    isAdmin,
    isManager,
    isChairman,
    sectionHeads,
    isLoading: rolesLoading,
  } = useUserRole();

  useEffect(() => {
    if (suppliedOccasions !== undefined) return;

    let alive = true;
    const read = async () => {
      try {
        const rows = await listOccasions({
          userId: null,
          canManageOccasions: false,
        });
        if (!alive) return;
        const todayKey = dateKey(new Date());
        setLoadedOccasions(
          (rows || [])
            .filter((item: any) => item?.id && item?.date && item.date >= todayKey)
            .sort(
              (a: any, b: any) =>
                (toDate(occasionDate(a))?.getTime() || Number.MAX_SAFE_INTEGER) -
                (toDate(occasionDate(b))?.getTime() || Number.MAX_SAFE_INTEGER),
            ),
        );
      } catch {
        if (alive) setLoadedOccasions([]);
      }
    };

    void read();
    return () => {
      alive = false;
    };
  }, [suppliedOccasions]);

  const occasions = suppliedOccasions ?? loadedOccasions;

  const agendaItems = useMemo<AgendaItem[]>(() => {
    const rows: AgendaItem[] = [];

    meetings.forEach((item: any) => {
      if (!item?.id) return;
      rows.push({
        id: `meeting-${item.id}`,
        kind: "اجتماع",
        title: item.title || "اجتماع العائلة",
        date: item.scheduled_at,
        to: "/meetings",
        tone: "meeting",
        icon: Users,
      });
    });

    trips.forEach((item: any) => {
      if (!item?.id) return;
      rows.push({
        id: `trip-${item.id}`,
        kind: "رحلة",
        title: item.title || "رحلة عائلية",
        date: item.start_date,
        to: "/trips",
        tone: "trip",
        icon: Plane,
      });
    });

    tasks.forEach((item: any) => {
      if (!item?.id) return;
      rows.push({
        id: `task-${item.id}`,
        kind: "مهمة",
        title: item.title || "مهمة عائلية",
        date: item.due_date,
        to: "/tasks",
        tone: "task",
        icon: ListChecks,
      });
    });

    occasions.forEach((item: any) => {
      if (!item?.id) return;
      rows.push({
        id: `occasion-${item.id}`,
        kind: "مناسبة",
        title: item.title || "مناسبة عائلية",
        date: occasionDate(item),
        to: "/family-occasions",
        tone: "occasion",
        icon: PartyPopper,
      });
    });

    return rows.sort(
      (a, b) =>
        (toDate(a.date)?.getTime() || Number.MAX_SAFE_INTEGER) -
        (toDate(b.date)?.getTime() || Number.MAX_SAFE_INTEGER),
    );
  }, [meetings, trips, tasks, occasions]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, AgendaItem[]>();
    agendaItems.forEach((item) => {
      const key = itemDateKey(item.date);
      if (!key) return;
      map.set(key, [...(map.get(key) || []), item]);
    });
    return map;
  }, [agendaItems]);

  const monthDays = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const leading = (firstDay + 1) % 7;
    const total = leading + daysInMonth <= 35 ? 35 : 42;

    return Array.from({ length: total }, (_, index) => {
      const day = index - leading + 1;
      return new Date(year, month, day);
    });
  }, [monthCursor]);

  const weekDays = useMemo(() => {
    const start = new Date(today);
    start.setHours(12, 0, 0, 0);
    start.setDate(start.getDate() - ((start.getDay() + 1) % 7));
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [today]);

  const canCreateTask =
    !rolesLoading && (isAdmin || isManager || isChairman || sectionHeads.length > 0);
  const managementActions = [
    {
      to: "/meetings",
      create: "meeting",
      label: "اجتماع",
      icon: Users,
      allowed: !rolesLoading && canManageSection("meetings"),
    },
    {
      to: "/trips",
      create: "trip",
      label: "رحلة",
      icon: Plane,
      allowed: !rolesLoading && canManageSection("trips"),
    },
    {
      to: "/tasks",
      create: "task",
      label: "مهمة",
      icon: ListChecks,
      allowed: canCreateTask,
    },
  ].filter((item) => item.allowed);

  const quickActions = [
    {
      to: "/family-occasions",
      create: "occasion",
      label: "مناسبة",
      icon: PartyPopper,
    },
    ...managementActions,
    ...(managementActions.length < 3
      ? [
          {
            to: "/community",
            create: "community",
            label: "مشاركة",
            icon: MessageCircle,
          },
        ]
      : []),
  ].slice(0, 4);

  const todayKey = dateKey(today);
  const monthLabel = monthCursor.toLocaleDateString("ar-SA", {
    month: "long",
    year: "numeric",
  });

  return (
    <section className={`family-agenda ${className}`.trim()} dir="rtl">
      <header className="family-agenda__header">
        <div className="family-agenda__identity">
          <span className="family-agenda__header-icon" aria-hidden="true">
            <CalendarDays />
          </span>
          <span>
            <small>تنظيم ومتابعة العائلة</small>
            <h2>لوحة المتابعة</h2>
            <time dateTime={todayKey}>
              {today.toLocaleDateString("ar-SA", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </time>
          </span>
        </div>
        <a className="family-agenda__new" href={`#${actionsId}`}>
          <Plus aria-hidden="true" />
          إضافة جديدة
        </a>
      </header>

      <div className="family-agenda__body">
        <section className="family-agenda__calendar" aria-labelledby={`${actionsId}-calendar`}>
          <div className="family-agenda__section-head">
            <span>
              <CalendarDays aria-hidden="true" />
              <b id={`${actionsId}-calendar`}>تقويم العائلة</b>
            </span>
            <Link to="/calendar">
              عرض الكل
              <ChevronLeft aria-hidden="true" />
            </Link>
          </div>

          <div className="family-agenda__month">
            <div className="family-agenda__month-nav">
              <button
                type="button"
                onClick={() =>
                  setMonthCursor(
                    (current) =>
                      new Date(current.getFullYear(), current.getMonth() + 1, 1),
                  )
                }
                aria-label="الشهر التالي"
              >
                <ChevronRight />
              </button>
              <strong>{monthLabel}</strong>
              <button
                type="button"
                onClick={() =>
                  setMonthCursor(
                    (current) =>
                      new Date(current.getFullYear(), current.getMonth() - 1, 1),
                  )
                }
                aria-label="الشهر السابق"
              >
                <ChevronLeft />
              </button>
            </div>
            <div className="family-agenda__week-labels" aria-hidden="true">
              {WEEK_DAYS.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="family-agenda__month-grid">
              {monthDays.map((day) => {
                const key = dateKey(day);
                const events = eventsByDate.get(key) || [];
                const isCurrentMonth = day.getMonth() === monthCursor.getMonth();
                return (
                  <Link
                    key={key}
                    to="/calendar"
                    className={`${isCurrentMonth ? "" : "is-outside"} ${
                      key === todayKey ? "is-today" : ""
                    }`.trim()}
                    aria-label={`${day.toLocaleDateString("ar-SA")}، ${events.length} عناصر`}
                  >
                    <span>{day.toLocaleDateString("ar-SA", { day: "numeric" })}</span>
                    {events[0] && (
                      <small data-tone={events[0].tone}>{events[0].kind}</small>
                    )}
                    {events.length > 1 && <i>+{events.length - 1}</i>}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="family-agenda__week-strip" aria-label="أيام الأسبوع الحالي">
            {weekDays.map((day) => {
              const key = dateKey(day);
              const events = eventsByDate.get(key) || [];
              return (
                <Link
                  key={key}
                  to="/calendar"
                  className={key === todayKey ? "is-today" : ""}
                  aria-label={`${day.toLocaleDateString("ar-SA")}، ${events.length} عناصر`}
                >
                  <small>{WEEK_DAYS[(day.getDay() + 1) % 7]}</small>
                  <b>{day.toLocaleDateString("ar-SA", { day: "numeric" })}</b>
                  <span>
                    {events.slice(0, 3).map((event) => (
                      <i key={event.id} data-tone={event.tone} />
                    ))}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <MemberPostsPreview userId={userId} authLoading={rolesLoading} headingId={`${actionsId}-posts`} />
      </div>

      <nav id={actionsId} className="family-agenda__actions" aria-label="الإضافة السريعة">
        <span className="family-agenda__actions-title">
          <Plus aria-hidden="true" />
          <b>إضافة سريعة</b>
        </span>
        <div>
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={`${action.to}-${action.create}`}
                to={action.to as any}
                search={{ create: action.create } as any}
              >
                <Icon aria-hidden="true" />
                <span>{action.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </section>
  );
}
