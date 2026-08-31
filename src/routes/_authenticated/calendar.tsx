import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useUserRole, roleLabel } from "@/hooks/use-user-role";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import {
  CalendarDays,
  ChevronRight,
  ChevronLeft,
  Users,
  PartyPopper,
  Plane,
  ListChecks,
  MapPin,
  Clock,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isFamilyOccasionEvent } from "@/lib/family-occasion-events";

export const Route = createFileRoute("/_authenticated/calendar")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "تقويم العائلة — السيف" },
      {
        name: "description",
        content:
          "تقويم العائلة الشهري: الاجتماعات والمناسبات والرحلات والمهام في مكان واحد.",
      },
      { property: "og:title", content: "تقويم العائلة — السيف" },
      {
        property: "og:description",
        content:
          "تقويم العائلة الشهري: الاجتماعات والمناسبات والرحلات والمهام في مكان واحد.",
      },
    ],
  }),
  component: FamilyCalendarPage,
});

type CalCategory = "meeting" | "event" | "trip" | "task";

interface CalItem {
  id: string;
  category: CalCategory;
  title: string;
  dayKey: string; // YYYY-MM-DD (local)
  start: Date | null;
  end: Date | null;
  location?: string | null;
  to: string;
}

const CATEGORY_META: Record<
  CalCategory,
  { label: string; icon: any; chip: string; dot: string; text: string }
> = {
  meeting: {
    label: "اجتماع",
    icon: Users,
    chip: "bg-amber-500/10 border-amber-500/25",
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
  event: {
    label: "مناسبة",
    icon: PartyPopper,
    chip: "bg-rose-500/10 border-rose-500/25",
    dot: "bg-rose-500",
    text: "text-rose-600 dark:text-rose-400",
  },
  trip: {
    label: "رحلة",
    icon: Plane,
    chip: "bg-blue-500/10 border-blue-500/25",
    dot: "bg-blue-500",
    text: "text-blue-600 dark:text-blue-400",
  },
  task: {
    label: "مهمة",
    icon: ListChecks,
    chip: "bg-emerald-500/10 border-emerald-500/25",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
};

const WEEKDAYS = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
const MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function hijriLabel(d: Date) {
  try {
    return new Intl.DateTimeFormat("ar-SA-u-ca-islamic", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  } catch {
    return "";
  }
}

function timeLabel(d: Date | null) {
  if (!d) return "";
  try {
    return d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function FamilyCalendarPage() {
  const { userId, primaryRole } = useUserRole();
  const [profile, setProfile] = useState({
    name: "عضو العائلة",
    role: "عضو",
    initial: "ص",
    avatarPath: null as string | null,
  });

  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedKey, setSelectedKey] = useState(dayKey(today));
  const [items, setItems] = useState<CalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("arabic_name, full_name, avatar_url")
        .eq("id", userId)
        .maybeSingle();
      const name = data?.arabic_name || data?.full_name || "عضو العائلة";
      setProfile({
        name,
        role: roleLabel(primaryRole),
        initial: name.charAt(0),
        avatarPath: data?.avatar_url ?? null,
      });
    })();
  }, [userId, primaryRole]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [meetingsRes, eventsRes, tripsRes, tasksRes] = await Promise.all([
        supabase
          .from("meetings")
          .select("id,title,scheduled_at,location,status")
          .neq("status", "cancelled"),
        supabase
          .from("events")
          .select("id,title,starts_at,ends_at,location,status,description")
          .neq("status", "cancelled"),
        supabase
          .from("trips")
          .select("id,title,start_date,end_date,location,status"),
        supabase
          .from("tasks")
          .select("id,title,due_date,status")
          .not("due_date", "is", null)
          .neq("status", "done"),
      ]);

      const out: CalItem[] = [];

      (meetingsRes.data ?? []).forEach((m: any) => {
        const start = m.scheduled_at ? new Date(m.scheduled_at) : null;
        if (!start || isNaN(start.getTime())) return;
        out.push({
          id: `meeting-${m.id}`,
          category: "meeting",
          title: m.title,
          dayKey: dayKey(start),
          start,
          end: null,
          location: m.location,
          to: "/meetings",
        });
      });

      (eventsRes.data ?? [])
        .filter((event: any) => isFamilyOccasionEvent(event))
        .forEach((e: any) => {
        const start = e.starts_at ? new Date(e.starts_at) : null;
        if (!start || isNaN(start.getTime())) return;
        const end = e.ends_at ? new Date(e.ends_at) : null;
        out.push({
          id: `event-${e.id}`,
          category: "event",
          title: e.title,
          dayKey: dayKey(start),
          start,
          end: end && !isNaN(end.getTime()) ? end : null,
          location: e.location,
            to: "/family-occasions",
          });
        });

      (tripsRes.data ?? []).forEach((t: any) => {
        if (!t.start_date) return;
        const start = new Date(`${t.start_date}T00:00:00`);
        if (isNaN(start.getTime())) return;
        const end = t.end_date ? new Date(`${t.end_date}T00:00:00`) : start;
        // Expand multi-day trips across their range (capped at 31 days)
        const cursorDay = new Date(start);
        let guard = 0;
        while (cursorDay <= end && guard < 31) {
          out.push({
            id: `trip-${t.id}-${dayKey(cursorDay)}`,
            category: "trip",
            title: t.title,
            dayKey: dayKey(cursorDay),
            start: new Date(start),
            end,
            location: t.location,
            to: "/trips",
          });
          cursorDay.setDate(cursorDay.getDate() + 1);
          guard++;
        }
      });

      (tasksRes.data ?? []).forEach((t: any) => {
        const due = t.due_date ? new Date(t.due_date) : null;
        if (!due || isNaN(due.getTime())) return;
        out.push({
          id: `task-${t.id}`,
          category: "task",
          title: t.title,
          dayKey: dayKey(due),
          start: due,
          end: null,
          to: "/tasks",
        });
      });

      setItems(out);
      setLoading(false);
    })();
  }, [refreshKey]);

  useRealtimeSync(["meetings", "events", "trips", "tasks"], () => setRefreshKey((k) => k + 1));

  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalItem[]>();
    items.forEach((it) => {
      const list = map.get(it.dayKey) ?? [];
      list.push(it);
      map.set(it.dayKey, list);
    });
    map.forEach((list) =>
      list.sort(
        (a, b) => (a.start?.getTime() ?? 0) - (b.start?.getTime() ?? 0),
      ),
    );
    return map;
  }, [items]);

  // Build the 6-week grid for the visible month (weeks start on Sunday)
  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startOffset = first.getDay(); // 0 = Sunday
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - startOffset);
    const arr: { date: Date; inMonth: boolean; key: string }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      arr.push({
        date: d,
        inMonth: d.getMonth() === cursor.getMonth(),
        key: dayKey(d),
      });
    }
    return arr;
  }, [cursor]);

  const monthCounts = useMemo(() => {
    const counts: Record<CalCategory, number> = {
      meeting: 0,
      event: 0,
      trip: 0,
      task: 0,
    };
    const prefix = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    const seenTrips = new Set<string>();
    items.forEach((it) => {
      if (!it.dayKey.startsWith(prefix)) return;
      if (it.category === "trip") {
        const tripId = it.id.split("-").slice(1, -1).join("-");
        if (seenTrips.has(tripId)) return;
        seenTrips.add(tripId);
      }
      counts[it.category]++;
    });
    return counts;
  }, [items, cursor]);

  const selectedItems = itemsByDay.get(selectedKey) ?? [];
  const selectedDate = useMemo(() => {
    const [y, m, d] = selectedKey.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, [selectedKey]);

  const shiftMonth = (delta: number) => {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  };

  const goToday = () => {
    const now = new Date();
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedKey(dayKey(now));
  };

  const todayKey = dayKey(today);

  return (
    <AppShell title="تقويم العائلة" user={profile}>
      <div className="max-w-6xl mx-auto space-y-6 pb-24" dir="rtl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-2xl bg-gold-primary/15 border border-gold-primary/25 flex items-center justify-center">
              <CalendarDays className="size-6 text-gold-primary" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-primary">
                {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
              </h2>
              <p className="text-xs text-muted-foreground font-bold">
                {hijriLabel(selectedDate)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goToday}
              className="px-4 h-10 rounded-xl bg-gold-primary/15 border border-gold-primary/30 text-gold-primary text-sm font-black hover:bg-gold-primary/25 transition-colors"
            >
              اليوم
            </button>
            <button
              type="button"
              aria-label="الشهر السابق"
              onClick={() => shiftMonth(-1)}
              className="size-10 rounded-xl border border-border/60 bg-card/60 flex items-center justify-center text-primary hover:bg-muted transition-colors"
            >
              <ChevronRight size={18} />
            </button>
            <button
              type="button"
              aria-label="الشهر التالي"
              onClick={() => shiftMonth(1)}
              className="size-10 rounded-xl border border-border/60 bg-card/60 flex items-center justify-center text-primary hover:bg-muted transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
          </div>
        </div>

        {/* Legend / month summary */}
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(CATEGORY_META) as CalCategory[]).map((cat) => {
            const meta = CATEGORY_META[cat];
            const Icon = meta.icon;
            return (
              <div
                key={cat}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-black",
                  meta.chip,
                  meta.text,
                )}
              >
                <Icon size={13} />
                <span>{meta.label}</span>
                <span className="opacity-70">{monthCounts[cat]}</span>
              </div>
            );
          })}
        </div>

        {/* Calendar grid */}
        <div className="rounded-3xl border border-border/50 bg-card/50 backdrop-blur-xl overflow-hidden shadow-[0_20px_60px_-30px_rgba(0,0,0,0.35)]">
          <div className="grid grid-cols-7 border-b border-border/40 bg-muted/30">
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="py-2.5 text-center text-[10px] sm:text-xs font-black text-muted-foreground"
              >
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((cell, i) => {
              const dayItems = itemsByDay.get(cell.key) ?? [];
              const isToday = cell.key === todayKey;
              const isSelected = cell.key === selectedKey;
              return (
                <button
                  key={`${cell.key}-${i}`}
                  type="button"
                  onClick={() => setSelectedKey(cell.key)}
                  className={cn(
                    "relative min-h-[64px] sm:min-h-[96px] p-1.5 sm:p-2 border-b border-l border-border/30 text-right transition-colors flex flex-col items-stretch gap-1",
                    !cell.inMonth && "opacity-35",
                    isSelected
                      ? "bg-gold-primary/10"
                      : "hover:bg-muted/40",
                  )}
                >
                  <span
                    className={cn(
                      "self-start text-[11px] sm:text-sm font-black size-6 sm:size-7 flex items-center justify-center rounded-full",
                      isToday
                        ? "bg-gold-primary text-white shadow-md"
                        : "text-foreground/80",
                    )}
                  >
                    {cell.date.getDate()}
                  </span>
                  <div className="hidden sm:flex flex-col gap-1 overflow-hidden">
                    {dayItems.slice(0, 2).map((it) => {
                      const meta = CATEGORY_META[it.category];
                      return (
                        <span
                          key={it.id}
                          className={cn(
                            "text-[10px] font-bold truncate px-1.5 py-0.5 rounded-md border",
                            meta.chip,
                            meta.text,
                          )}
                        >
                          {it.title}
                        </span>
                      );
                    })}
                    {dayItems.length > 2 && (
                      <span className="text-[9px] font-black text-muted-foreground px-1">
                        +{dayItems.length - 2} أخرى
                      </span>
                    )}
                  </div>
                  {dayItems.length > 0 && (
                    <div className="sm:hidden flex items-center gap-0.5 flex-wrap">
                      {dayItems.slice(0, 3).map((it) => (
                        <span
                          key={it.id}
                          className={cn(
                            "size-1.5 rounded-full",
                            CATEGORY_META[it.category].dot,
                          )}
                        />
                      ))}
                      {dayItems.length > 3 && (
                        <span className="text-[8px] font-black text-muted-foreground">
                          +{dayItems.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected day details */}
        <div className="rounded-3xl border border-border/50 bg-card/50 backdrop-blur-xl p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-black text-primary">
              {WEEKDAYS[selectedDate.getDay()]} {selectedDate.getDate()}{" "}
              {MONTHS[selectedDate.getMonth()]}
            </h3>
            <span className="text-[11px] font-bold text-muted-foreground">
              {hijriLabel(selectedDate)}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="size-8 rounded-full border-2 border-gold-primary border-t-transparent animate-spin" />
            </div>
          ) : selectedItems.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <Sparkles size={28} className="opacity-40" />
              <p className="text-sm font-bold">لا توجد فعاليات في هذا اليوم</p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedItems.map((it) => {
                const meta = CATEGORY_META[it.category];
                const Icon = meta.icon;
                return (
                  <Link
                    key={it.id}
                    to={it.to}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-2xl border transition-transform hover:-translate-y-0.5",
                      meta.chip,
                    )}
                  >
                    <div
                      className={cn(
                        "size-10 rounded-xl bg-white/70 dark:bg-card/70 flex items-center justify-center shrink-0 shadow-sm",
                        meta.text,
                      )}
                    >
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-foreground truncate">
                        {it.title}
                      </p>
                      <div className="flex items-center gap-3 text-[11px] font-bold text-muted-foreground">
                        <span className={cn("font-black", meta.text)}>
                          {meta.label}
                        </span>
                        {it.start && it.category !== "trip" && (
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {timeLabel(it.start)}
                          </span>
                        )}
                        {it.category === "trip" && it.end && (
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            حتى {it.end.getDate()} {MONTHS[it.end.getMonth()]}
                          </span>
                        )}
                        {it.location && (
                          <span className="flex items-center gap-1 truncate">
                            <MapPin size={11} />
                            {it.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronLeft size={16} className="text-muted-foreground shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
