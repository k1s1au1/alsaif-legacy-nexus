import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import {
  ArrowRight,
  Calendar,
  MapPin,
  Users,
  CheckCircle2,
  Tent,
  Compass,
  Clock,
  Info,
  Share2,
  Shield,
  ChevronLeft,
  Loader2,
  X,
  ListChecks,
  Plus,
  Trash2,
  UserCheck,
  UserX,
  Navigation,
} from "lucide-react";
import { TripImage } from "@/components/trip-image";
import { UserAvatar } from "@/components/user-avatar";
import { QuickActionsBanner } from "@/components/quick-actions-banner";
import { cn } from "@/lib/utils";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { toast } from "sonner";
import { useUserRole, roleLabel } from "@/hooks/use-user-role";
import { addToCalendar } from "@/lib/calendar";
import { FamilySharing } from "@/lib/native-bridge";
import { TripStatusControl } from "@/components/trip-status-control";
import { TripPlanningPanel } from "@/components/trip-planning-panel";
import { TripPreparations } from "@/components/trip-preparations";
import { confirmedAttendees, tripPhase, type PlannedTrip } from "@/lib/trip-planning";
import { saveTripAttendance } from "@/lib/api/trip-planning";
import { useDayBoundaryKey } from "@/hooks/use-day-boundary";

export const Route = createFileRoute("/_authenticated/trips/$tripId")({
  ssr: false,
  head: () => ({
    meta: [{ title: "تفاصيل الرحلة — السيف" }],
  }),
  component: TripDetail,
});

type Trip = PlannedTrip & {
  id: string;
  title: string;
  badge: string | null;
  location: string | null;
  location_url: string | null;
  accommodation_type: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  image_url: string | null;
  status: string;
};

function formatRange(start: string | null, end: string | null) {
  if (!start) return "—";
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("ar-SA", { day: "numeric", month: "long", year: "numeric" });
  if (!end || end === start) return fmt(start);
  return `${fmt(start)} - ${fmt(end)}`;
}

function TripDetail() {
  const { tripId } = useParams({ from: "/_authenticated/trips/$tripId" });
  const { userId, isLoading: rolesLoading, canManage, primaryRole } = useUserRole();
  const dynamicLogo = useSiteLogo();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [attendanceLoaded, setAttendanceLoaded] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState<"going" | "not_going" | null>(null);
  const [companionsCount, setCompanionsCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const attendanceBusy = useRef(false);
  const tripRef = useRef<Trip | null>(null);
  tripRef.current = trip;
  const [needsReconfirmation, setNeedsReconfirmation] = useState(false);
  const activeDayKey = useDayBoundaryKey();
  const [attendees, setAttendees] = useState<
    {
      user_id: string;
      name: string;
      initial: string;
      avatarPath: string | null;
      companions_count: number;
    }[]
  >([]);
  const isPrivileged = !rolesLoading && !!userId && canManage("trips");
  const [profile, setProfile] = useState<{
    name: string;
    role: string;
    initial: string;
    avatarPath?: string | null;
  }>({ name: "عضو العائلة", role: "عضو", initial: "ص", avatarPath: null });

  async function loadAttendees(tid: string, currentTrip = tripRef.current) {
    try {
      const { data: rows, error } = await supabase
        .from("trip_attendees")
        .select("user_id, status, companions_count, approval_version")
        .eq("trip_id", tid);

      if (error) throw error;
      if (!currentTrip) return;
      const mine = (rows || []).find((row) => row.user_id === userId);
      const valid = mine && mine.approval_version === (currentTrip.approval_version ?? 1);
      setAttendanceStatus(valid ? mine.status : null);
      setCompanionsCount(valid ? mine.companions_count || 0 : 0);
      setNeedsReconfirmation(!!mine && !valid);
      setAttendanceLoaded(true);
      await processAttendees(confirmedAttendees(currentTrip, rows || []));
    } catch (err) {
      console.error("Load attendees error:", err);
      setAttendanceLoaded(false);
      toast.error("تعذر تحميل الحضور؛ حدّث الصفحة قبل تسجيل اختيارك");
    }
  }

  async function processAttendees(rows: any[]) {
    const ids = rows.map((r) => r.user_id);
    if (ids.length === 0) {
      setAttendees([]);
      return;
    }
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, arabic_name, full_name, avatar_url")
      .in("id", ids);
    const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
    const rowsMap = new Map(rows.map((r) => [r.user_id, r.companions_count || 0]));

    setAttendees(
      ids.map((id) => {
        const p = map.get(id) as any;
        const name = p?.arabic_name?.trim() || p?.full_name?.trim() || "عضو العائلة";
        return {
          user_id: id,
          name,
          initial: (name[0] ?? "س").toUpperCase(),
          avatarPath: p?.avatar_url ?? null,
          companions_count: rowsMap.get(id) || 0,
        };
      }),
    );
  }

  async function reloadTrip() {
    const { data, error } = await supabase.from("trips").select("*").eq("id", tripId).single();
    if (error || !data) {
      toast.error("تعذر تحديث بيانات الرحلة");
      return;
    }
    setTrip(data as Trip);
  }

  useEffect(() => {
    setProfile((p) => ({ ...p, role: roleLabel(primaryRole) }));
  }, [primaryRole]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const profileTask = userId
        ? Promise.all([
            supabase
              .from("profiles")
              .select("arabic_name, full_name, avatar_url")
              .eq("id", userId)
              .maybeSingle(),
          ])
        : Promise.resolve(null);
      const tripTask = supabase.from("trips").select("*").eq("id", tripId).maybeSingle();

      const [mineRes, tripRes] = await Promise.all([profileTask, tripTask]);
      if (cancelled) return;
      if (mineRes) {
        const [{ data: p }] = mineRes;
        const name = p?.arabic_name?.trim() || p?.full_name?.trim() || "عضو العائلة";
        setProfile((prev) => ({
          ...prev,
          name,
          initial: (name[0] ?? "س").toUpperCase(),
          avatarPath: p?.avatar_url ?? null,
        }));
      }
      setTrip((tripRes.data as Trip | null) ?? null);
      setLoading(false);
      // Secondary lists load in the background without blocking the page.
      void loadAttendees(tripId, tripRes.data as Trip);
    })();

    let tA: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel(`trip-${tripId}-realtime`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "trips", filter: `id=eq.${tripId}` },
        (payload) => {
          if (cancelled) return;
          setTrip((current) => (current ? { ...current, ...payload.new } : current));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_attendees", filter: `trip_id=eq.${tripId}` },
        () => {
          clearTimeout(tA);
          tA = setTimeout(() => loadAttendees(tripId), 300);
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      clearTimeout(tA);
      supabase.removeChannel(channel);
    };
  }, [tripId, userId]);

  useEffect(() => {
    if (trip) void loadAttendees(tripId, trip);
  }, [trip?.approval_version, trip?.status, activeDayKey]);

  async function updateAttendance(
    status: "going" | "not_going",
    companions = 0,
    isExplicitClick = false,
  ) {
    if (
      !userId ||
      !trip ||
      attendanceBusy.current ||
      tripPhase(trip) === "past" ||
      trip.status === "planning"
    )
      return;
    const previousStatus = attendanceStatus;
    const isRemoving = isExplicitClick && attendanceStatus === status;
    attendanceBusy.current = true;
    setSaving(true);
    try {
      const saved = await saveTripAttendance(trip, isRemoving ? null : status, companions);
      setAttendanceStatus(saved.status as "going" | "not_going" | null);
      setCompanionsCount(saved.companions_count || 0);
      setNeedsReconfirmation(false);
      await loadAttendees(tripId, trip);
      toast.success(
        isRemoving
          ? "تم إلغاء اختيارك"
          : status === "not_going"
            ? "تم تسجيل اعتذارك"
            : previousStatus === "going"
              ? "تم تحديث عدد المرافقين"
              : "تم تأكيد حضورك",
      );
    } catch (error: any) {
      toast.error(error?.message || "تعذر حفظ الحضور والمرافقين");
      await loadAttendees(tripId);
    } finally {
      attendanceBusy.current = false;
      setSaving(false);
    }
  }

  if (loading)
    return (
      <AppShell title="الرحلات" user={profile}>
        <div className="p-20 text-center opacity-40">جاري التحميل...</div>
      </AppShell>
    );
  if (!trip)
    return (
      <AppShell title="الرحلات" user={profile}>
        <div className="card-surface p-10 text-center">
          <p className="text-muted-foreground">لم يتم العثور على الرحلة.</p>
          <Link
            to="/trips"
            className="mt-4 inline-flex items-center gap-2 text-gold-primary text-sm"
          >
            <ArrowRight className="size-4" />
            العودة للقائمة
          </Link>
        </div>
      </AppShell>
    );

  return (
    <AppShell title={trip.title} user={profile}>
      <div className="max-w-6xl mx-auto space-y-8 pb-32 px-4 md:px-0" dir="rtl">
        <QuickActionsBanner />

        <div className="flex items-center justify-between px-2">
          <Link
            to="/trips"
            className="group flex items-center gap-3 text-muted-foreground hover:text-gold-primary transition-all font-black text-xs uppercase tracking-widest"
          >
            <div className="size-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-gold-primary group-hover:text-black transition-all">
              <ArrowRight className="size-4" />
            </div>
            العودة للترفيه
          </Link>
          <div className="flex items-center gap-2">
            <button
              disabled={trip.status === "planning" || !trip.start_date}
              title={
                trip.status === "planning" ? "يتاح بعد اعتماد الرحلة" : "إضافة إلى تقويم جهازك"
              }
              onClick={() =>
                trip &&
                addToCalendar({
                  title: trip.title,
                  description: trip.description || "",
                  location: trip.location || "",
                  startTime: trip.start_date || new Date().toISOString(),
                })
              }
              className="px-4 py-2 rounded-full bg-gold-primary/10 hover:bg-gold-primary/20 text-gold-primary border border-gold-primary/20 transition-all font-black text-[10px] flex items-center gap-2"
            >
              <Calendar size={14} /> إضافة للتقويم
            </button>
            <button
              onClick={() =>
                trip &&
                FamilySharing.shareInvitation({
                  title: trip.title,
                  date: formatRange(trip.start_date, trip.end_date),
                  location: trip.location || "وجهة عائلية",
                })
              }
              className="size-10 rounded-full bg-muted/50 flex items-center justify-center hover:bg-gold-primary/20 transition-all text-gold-primary"
            >
              <Share2 size={18} />
            </button>
          </div>
        </div>

        <article className="space-y-8">
          {/* Hero Header - Square on Mobile */}
          <div className="relative aspect-square md:aspect-auto md:h-[500px] w-full overflow-hidden rounded-[32px] md:rounded-[48px] shadow-2xl border-4 border-white/5 group">
            <TripImage
              path={trip.image_url}
              alt={trip.title}
              className="absolute inset-0 size-full object-cover transition-transform duration-1000 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-10" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent z-10" />
            <div className="absolute bottom-0 right-0 left-0 p-8 md:p-16 z-20 space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <div className="h-1 w-12 bg-gold-primary rounded-full" />
                {trip.badge && (
                  <span className="px-4 py-1.5 bg-gold-primary text-black text-[10px] font-black rounded-full uppercase tracking-[0.2em] shadow-xl">
                    {trip.badge}
                  </span>
                )}
                <TripStatusControl
                  trip={trip}
                  canManage={isPrivileged}
                  onSaved={(status) =>
                    setTrip((current) => (current ? { ...current, status } : current))
                  }
                  onRecordSaved={() => void reloadTrip()}
                />
              </div>
              <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter drop-shadow-2xl">
                {trip.title}
              </h2>
              <div className="flex flex-wrap items-center gap-6 text-white/80 font-bold">
                <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                  <MapPin className="size-5 text-gold-primary" />
                  <span>{trip.location || "وجهة عائلية"}</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                  <Calendar className="size-5 text-gold-primary" />
                  <span>
                    {trip.status === "planning" && "موعد أولي: "}
                    {formatRange(trip.start_date, trip.end_date)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {trip.status === "planning" && (
            <TripPlanningPanel
              trip={trip}
              userId={rolesLoading || primaryRole === "guest" ? null : userId}
              canManage={isPrivileged}
              onSaved={() => void reloadTrip()}
            />
          )}
          {needsReconfirmation && trip.status !== "planning" && (
            <p className="trip-system trip-system__notice" role="status">
              تغيّرت خطة الرحلة بعد تسجيلك السابق. راجع الوجهة والموعد وأكد حضورك من جديد.
            </p>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-3 space-y-6 md:space-y-8">
              {/* MERGED PREMIUM TRIP HUB BANNER - Separated on Mobile */}
              <div
                className={cn(
                  "relative overflow-hidden rounded-[32px] md:rounded-[48px] shadow-2xl border border-white/10 group md:min-h-[500px] flex flex-col-reverse md:flex-row transition-all duration-700",
                  attendanceStatus === "going"
                    ? "bg-emerald-950"
                    : attendanceStatus === "not_going"
                      ? "bg-rose-950"
                      : "bg-[#0a1a16]",
                )}
              >
                {/* Journey identity layer: trip image, family mark, and a quiet route motif */}
                <div className="absolute inset-0 bg-gradient-to-br from-black/10 via-transparent to-black/35 pointer-events-none" />
                {dynamicLogo && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-[0.07] pointer-events-none">
                    <img
                      src={dynamicLogo}
                      alt=""
                      className="size-[18rem] md:size-[28rem] object-contain grayscale mix-blend-screen rotate-[-8deg]"
                    />
                  </div>
                )}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 text-gold-primary/40 pointer-events-none">
                  <div className="w-16 md:w-24 border-t border-dashed border-gold-primary/30" />
                  <Navigation className="size-4 md:size-5" />
                  <span className="text-[11px] md:text-[10px] font-black tracking-[0.3em] whitespace-nowrap">
                    رحلة تجمعنا
                  </span>
                  <div className="w-16 md:w-24 border-t border-dashed border-gold-primary/30" />
                </div>

                {/* Background Decoration - Desktop Only */}
                <div className="absolute top-0 right-0 p-12 opacity-[0.08] pointer-events-none hidden md:block">
                  <Tent size={240} className="text-white" />
                </div>
                <div className="absolute bottom-0 left-0 p-12 opacity-[0.08] pointer-events-none -rotate-12 hidden md:block">
                  <Compass size={180} className="text-white" />
                </div>

                {/* Left Side (or Top on Mobile): Attendance & Participants */}
                {trip.status !== "planning" && (
                  <div
                    className={cn(
                      "md:w-1/3 p-6 md:p-12 flex flex-col justify-between space-y-6 md:space-y-10 relative z-10",
                      "bg-white/5 backdrop-blur-sm md:border-l border-white/10 rounded-[28px] md:rounded-none m-2 md:m-0 shadow-xl md:shadow-none",
                    )}
                  >
                    <div className="space-y-4 md:space-y-6">
                      <div className="space-y-2 md:space-y-3">
                        <h3 className="text-2xl md:text-4xl font-black text-white leading-tight tracking-tight">
                          هل ستنضم إلينا؟
                        </h3>
                        <p className="text-xs md:text-sm font-bold leading-relaxed text-emerald-100/60">
                          أكد حضورك الآن لتساعدنا في تنظيم الرحلة بشكل أفضل.
                        </p>
                      </div>

                      <div className="flex flex-col gap-3 md:gap-4">
                        {attendanceStatus === "going" && (
                          <div className="flex flex-col gap-2 md:gap-3 animate-fade-up bg-white/10 p-4 md:p-5 rounded-[24px] md:rounded-[32px] border border-white/10 shadow-inner">
                            <div className="flex items-center justify-between px-1">
                              <p className="text-[11px] md:text-[10px] font-black text-gold-primary uppercase tracking-widest">
                                عدد المرافقين معك؟
                              </p>
                              <div className="text-center bg-gold-primary/20 px-2 py-0.5 md:px-3 md:py-1 rounded-lg border border-gold-primary/20">
                                <span className="text-[12px] md:text-[14px] font-black leading-none text-gold-primary">
                                  {1 + companionsCount} حاضرين
                                </span>
                              </div>
                            </div>
                            <input
                              type="tel"
                              aria-label="عدد المرافقين"
                              disabled={saving || tripPhase(trip) === "past"}
                              value={companionsCount === 0 ? "" : companionsCount}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, "");
                                setCompanionsCount(val === "" ? 0 : Math.min(50, parseInt(val)));
                              }}
                              onBlur={() => updateAttendance("going", companionsCount)}
                              className="w-full h-12 md:h-16 bg-black/20 border-2 border-white/10 rounded-[18px] md:rounded-[24px] px-6 font-black text-center text-2xl md:text-3xl focus:outline-none focus:border-gold-primary transition-all text-white shadow-inner"
                              placeholder="٠"
                            />
                          </div>
                        )}

                        <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 p-1 rounded-[22px] md:rounded-[28px] grid grid-cols-2 gap-1 shadow-2xl overflow-hidden h-[60px] md:h-[70px]">
                          <div
                            className={cn(
                              "absolute inset-y-1 w-[calc(50%-4px)] rounded-[18px] md:rounded-[22px] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-lg",
                              attendanceStatus === "going"
                                ? "right-1 bg-emerald-500 shadow-emerald-500/40"
                                : attendanceStatus === "not_going"
                                  ? "right-[calc(50%+1px)] bg-rose-500 shadow-rose-500/40"
                                  : "opacity-0",
                            )}
                          />
                          <button
                            aria-pressed={attendanceStatus === "going"}
                            onClick={() => updateAttendance("going", companionsCount, true)}
                            disabled={
                              saving ||
                              !userId ||
                              !attendanceLoaded ||
                              tripPhase(trip) === "past" ||
                              primaryRole === "guest"
                            }
                            className={cn(
                              "relative z-10 flex items-center justify-center gap-2 md:gap-3 font-black text-xs md:text-sm transition-colors duration-500",
                              attendanceStatus === "going"
                                ? "text-white"
                                : "text-white/40 hover:text-white/60",
                            )}
                          >
                            {saving && attendanceStatus === "going" ? (
                              <Loader2 className="size-4 md:size-[18px] animate-spin" />
                            ) : (
                              <UserCheck className="size-[18px] md:size-5" />
                            )}
                            <span>سأحضر</span>
                          </button>
                          <button
                            aria-pressed={attendanceStatus === "not_going"}
                            onClick={() => updateAttendance("not_going", 0, true)}
                            disabled={
                              saving ||
                              !userId ||
                              !attendanceLoaded ||
                              tripPhase(trip) === "past" ||
                              primaryRole === "guest"
                            }
                            className={cn(
                              "relative z-10 flex items-center justify-center gap-2 md:gap-3 font-black text-xs md:text-sm transition-colors duration-500",
                              attendanceStatus === "not_going"
                                ? "text-white"
                                : "text-white/40 hover:text-white/60",
                            )}
                          >
                            {saving && attendanceStatus === "not_going" ? (
                              <Loader2 className="size-4 md:size-[18px] animate-spin" />
                            ) : (
                              <UserX className="size-[18px] md:size-5" />
                            )}
                            <span>أعتذر</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 md:space-y-4 pt-4 md:pt-0">
                      <div className="flex items-center justify-between border-t border-white/10 pt-4 md:pt-6">
                        <div className="flex items-center gap-2 text-gold-primary font-black uppercase tracking-[0.2em] text-[11px] md:text-[10px]">
                          <Users className="size-3.5 md:size-4" /> المشاركون
                        </div>
                        <span className="text-[11px] md:text-[10px] font-black bg-white/10 text-white px-2 py-0.5 md:px-3 md:py-1 rounded-full">
                          {(() => {
                            const meInList = attendees.some((a) => a.user_id === userId);
                            const othersSum = attendees
                              .filter((a) => a.user_id !== userId)
                              .reduce((acc, curr) => acc + 1 + (curr.companions_count || 0), 0);

                            if (attendanceStatus === "going") {
                              return othersSum + 1 + companionsCount;
                            }

                            // If not going but was in list (unlikely with delete logic but safe)
                            return (
                              othersSum +
                              (meInList
                                ? 1 +
                                  (attendees.find((a) => a.user_id === userId)?.companions_count ||
                                    0)
                                : 0)
                            );
                          })()}{" "}
                          حاضرين
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 md:gap-2">
                        {attendees.slice(0, 5).map((a) => (
                          <div key={a.user_id} className="relative group/avatar">
                            <div className="size-8 md:size-10 rounded-lg md:rounded-xl overflow-hidden ring-2 ring-white/10 shadow-lg transition-transform hover:scale-110">
                              <UserAvatar
                                path={a.avatarPath}
                                name={a.name}
                                initial={a.initial}
                                className="size-full"
                                userId={a.user_id}
                              />
                            </div>
                            {(a.user_id === userId ? companionsCount : a.companions_count) > 0 && (
                              <div className="absolute -top-1 -right-1 size-4 md:size-5 bg-gold-primary text-black text-[7px] md:text-[11px] font-black rounded-full flex items-center justify-center border border-emerald-950 z-10 shadow-lg">
                                +{a.user_id === userId ? companionsCount : a.companions_count}
                              </div>
                            )}
                          </div>
                        ))}
                        {attendees.length > 5 && (
                          <div className="size-8 md:size-10 rounded-lg md:rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[11px] md:text-[10px] font-black text-white">
                            +{attendees.length - 5}
                          </div>
                        )}
                        {attendees.length === 0 && (
                          <p className="text-[11px] md:text-[10px] font-bold text-white/30 italic">
                            لا يوجد حضور مؤكد بعد
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {/* Right Side (or Bottom on Mobile): Info & Description */}
                <div
                  className={cn(
                    "flex-1 p-6 md:p-14 space-y-8 md:space-y-12 relative z-10",
                    "rounded-[28px] md:rounded-none m-2 md:m-0 bg-white/[0.02] md:bg-transparent border border-white/5 md:border-none shadow-xl md:shadow-none",
                  )}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
                    <div className="space-y-4 md:space-y-6">
                      <div className="flex items-center gap-3 text-gold-primary font-black uppercase tracking-[0.3em] text-[10px] md:text-xs">
                        <Compass className="size-4 md:size-[18px]" /> وصف الرحلة
                      </div>
                      <p className="text-sm md:text-xl font-medium text-emerald-50/90 leading-relaxed whitespace-pre-line drop-shadow-sm">
                        {trip.description?.trim() || "لا يوجد وصف لهذه الرحلة."}
                      </p>
                    </div>

                    <div className="space-y-6 md:space-y-8">
                      <div className="flex items-center gap-3 text-gold-primary font-black uppercase tracking-[0.3em] text-[10px] md:text-xs">
                        <Info className="size-4 md:size-[18px]" /> تفاصيل إضافية
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:gap-6">
                        <div className="flex items-center gap-3 md:gap-4 bg-white/5 p-3 md:p-4 rounded-2xl md:rounded-3xl border border-white/10">
                          <div className="size-10 md:size-12 rounded-xl md:rounded-2xl bg-gold-primary/10 flex items-center justify-center text-gold-primary shadow-xl shrink-0">
                            <Tent className="size-[18px] md:size-[22px]" />
                          </div>
                          <div>
                            <p className="text-[10px] md:text-[10px] font-black text-white/40 uppercase tracking-widest">
                              نوع الإقامة
                            </p>
                            <p className="text-xs md:text-sm font-black text-white">
                              {trip.accommodation_type || "غير محدد"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 md:gap-4 bg-white/5 p-3 md:p-4 rounded-2xl md:rounded-3xl border border-white/10">
                          <div className="size-10 md:size-12 rounded-xl md:rounded-2xl bg-gold-primary/10 flex items-center justify-center text-gold-primary shadow-xl shrink-0">
                            <Clock className="size-[18px] md:size-[22px]" />
                          </div>
                          <div>
                            <p className="text-[10px] md:text-[10px] font-black text-white/40 uppercase tracking-widest">
                              آخر موعد للتسجيل
                            </p>
                            <p className="text-xs md:text-sm font-black text-white">
                              {formatDate(trip.start_date)}
                            </p>
                          </div>
                        </div>
                        {trip.location_url && (
                          <a
                            href={trip.location_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-3.5 md:p-5 rounded-2xl md:rounded-[28px] bg-gold-primary text-emerald-950 font-black shadow-xl hover:scale-[1.02] transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <MapPin className="size-[18px] md:size-[22px]" strokeWidth={2.5} />
                              <span className="text-xs md:text-base">موقع الوجهة على الخريطة</span>
                            </div>
                            <ChevronLeft className="size-4 md:size-5" strokeWidth={3} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {trip.status !== "planning" && (
                <TripPreparations
                  tripId={tripId}
                  userId={rolesLoading || primaryRole === "guest" ? null : userId}
                  canManage={isPrivileged}
                  readOnly={tripPhase(trip) === "past"}
                />
              )}
            </div>
          </div>
        </article>
      </div>
    </AppShell>
  );
}

function SidebarStat({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-start gap-4">
      <div className="size-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary shrink-0 border border-primary/10">
        <Icon size={20} />
      </div>
      <div className="space-y-0.5">
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">
          {label}
        </p>
        <p className="text-base font-black text-foreground tracking-tight">{value}</p>
      </div>
    </div>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ar-SA", { day: "numeric", month: "long" });
  } catch {
    return "—";
  }
}
