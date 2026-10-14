import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import {
  ArrowRight,
  Calendar,
  MapPin,
  Users,
  Tent,
  Info,
  Share2,
  Loader2,
  Plus,
  Minus,
  ExternalLink,
  UserCheck,
  UserX,
} from "lucide-react";
import { TripImage } from "@/components/trip-image";
import { UserAvatar } from "@/components/user-avatar";
import { QuickActionsBanner } from "@/components/quick-actions-banner";
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
import "@/components/trip-detail.css";

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
    new Date(iso).toLocaleDateString("ar-SA-u-ca-gregory", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  if (!end || end === start) return fmt(start);
  return `${fmt(start)} - ${fmt(end)}`;
}

function TripDetail() {
  const { tripId } = useParams({ from: "/_authenticated/trips/$tripId" });
  const { userId, isLoading: rolesLoading, canManage, primaryRole } = useUserRole();
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

  const attendanceDisabled =
    saving || !userId || !attendanceLoaded || tripPhase(trip) === "past" || primaryRole === "guest";
  const othersCount = attendees
    .filter((a) => a.user_id !== userId)
    .reduce((total, a) => total + 1 + (a.companions_count || 0), 0);
  const myAttendance = attendees.find((a) => a.user_id === userId);
  const participantCount =
    othersCount +
    (attendanceStatus === "going"
      ? 1 + companionsCount
      : myAttendance
        ? 1 + (myAttendance.companions_count || 0)
        : 0);

  function changeCompanions(amount: number) {
    if (attendanceDisabled) return;
    const next = Math.max(0, Math.min(50, companionsCount + amount));
    setCompanionsCount(next);
    void updateAttendance("going", next);
  }

  return (
    <AppShell title={trip.title} user={profile}>
      <div className="trip-detail" dir="rtl">
        <QuickActionsBanner />
        <div className="trip-detail__toolbar">
          <Link to="/trips" className="trip-detail__tool">
            <ArrowRight size={18} /> العودة للرحلات
          </Link>
          <div className="trip-detail__tools">
            <button
              type="button"
              className="trip-detail__tool"
              disabled={trip.status === "planning" || !trip.start_date}
              aria-label="إضافة الرحلة إلى تقويم جهازك"
              title={
                trip.status === "planning" ? "يتاح بعد اعتماد الرحلة" : "إضافة إلى تقويم جهازك"
              }
              onClick={() =>
                addToCalendar({
                  title: trip.title,
                  description: trip.description || "",
                  location: trip.location || "",
                  startTime: trip.start_date || new Date().toISOString(),
                })
              }
            >
              <Calendar size={18} />
              <span>إضافة للتقويم</span>
            </button>
            <button
              type="button"
              className="trip-detail__tool"
              aria-label="مشاركة الرحلة"
              onClick={() =>
                FamilySharing.shareInvitation({
                  title: trip.title,
                  date: formatRange(trip.start_date, trip.end_date),
                  location: trip.location || "وجهة عائلية",
                })
              }
            >
              <Share2 size={18} />
              <span>مشاركة</span>
            </button>
          </div>
        </div>

        <section className="trip-detail__cover" aria-labelledby="trip-detail-title">
          <div className="trip-detail__photo">
            <TripImage path={trip.image_url} alt={trip.title} />
          </div>
          <div className="trip-detail__caption">
            <div className="trip-detail__title-row">
              <h1 id="trip-detail-title">{trip.title}</h1>
              <div className="trip-detail__badges">
                <TripStatusControl
                  trip={trip}
                  canManage={isPrivileged}
                  onSaved={(status) =>
                    setTrip((current) => (current ? { ...current, status } : current))
                  }
                  onRecordSaved={() => void reloadTrip()}
                />
                {trip.badge && <span className="trip-detail__badge">{trip.badge}</span>}
              </div>
            </div>
            <div className="trip-detail__cover-meta">
              <span>
                <MapPin size={19} />
                {trip.location || "وجهة عائلية"}
              </span>
              <span>
                <Calendar size={19} />
                {trip.status === "planning" && "موعد أولي: "}
                {formatRange(trip.start_date, trip.end_date)}
              </span>
              {trip.accommodation_type && (
                <span>
                  <Tent size={19} />
                  {trip.accommodation_type}
                </span>
              )}
            </div>
          </div>
        </section>

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

        <div
          className={`trip-detail__grid${trip.status === "planning" ? " trip-detail__grid--planning" : ""}`}
        >
          {trip.status !== "planning" && (
            <section className="trip-detail__attendance" aria-labelledby="trip-attendance-title">
              <div className="trip-detail__section-heading">
                <h2 id="trip-attendance-title">
                  <Users size={23} />
                  هل ستنضم إلينا؟
                </h2>
                <p>أخبرنا عن مشاركتك في هذه الرحلة العائلية.</p>
              </div>
              <div className="trip-detail__attendance-choices">
                <button
                  type="button"
                  aria-pressed={attendanceStatus === "going"}
                  onClick={() => void updateAttendance("going", companionsCount, true)}
                  disabled={attendanceDisabled}
                >
                  {saving && attendanceStatus === "going" ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <UserCheck size={20} />
                  )}
                  سأحضر
                </button>
                <button
                  type="button"
                  aria-pressed={attendanceStatus === "not_going"}
                  onClick={() => void updateAttendance("not_going", 0, true)}
                  disabled={attendanceDisabled}
                >
                  {saving && attendanceStatus === "not_going" ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <UserX size={20} />
                  )}
                  أعتذر
                </button>
              </div>
              {attendanceStatus === "going" && (
                <div className="trip-detail__companions">
                  <label htmlFor="trip-companions">
                    <Users size={18} />
                    عدد المرافقين
                  </label>
                  <div className="trip-detail__counter" dir="ltr">
                    <button
                      type="button"
                      aria-label="تقليل عدد المرافقين"
                      disabled={attendanceDisabled || companionsCount === 0}
                      onPointerDown={(event) => event.preventDefault()}
                      onClick={() => changeCompanions(-1)}
                    >
                      <Minus size={17} />
                    </button>
                    <input
                      id="trip-companions"
                      type="tel"
                      inputMode="numeric"
                      disabled={attendanceDisabled}
                      value={companionsCount}
                      onFocus={(event) => event.target.select()}
                      onChange={(event) => {
                        const value = event.target.value.replace(/[^0-9]/g, "");
                        setCompanionsCount(value === "" ? 0 : Math.min(50, parseInt(value)));
                      }}
                      onBlur={() => {
                        if (companionsCount !== (myAttendance?.companions_count || 0))
                          void updateAttendance("going", companionsCount);
                      }}
                    />
                    <button
                      type="button"
                      aria-label="زيادة عدد المرافقين"
                      disabled={attendanceDisabled || companionsCount === 50}
                      onPointerDown={(event) => event.preventDefault()}
                      onClick={() => changeCompanions(1)}
                    >
                      <Plus size={17} />
                    </button>
                  </div>
                </div>
              )}
              <div className="trip-detail__participants">
                <div className="trip-detail__participants-heading">
                  <Users size={17} />
                  <span>{participantCount} حاضرين</span>
                </div>
                <div className="trip-detail__avatars">
                  {attendees.slice(0, 8).map((person) => (
                    <div key={person.user_id} className="trip-detail__avatar" title={person.name}>
                      <UserAvatar
                        path={person.avatarPath}
                        name={person.name}
                        initial={person.initial}
                        className="size-full"
                        userId={person.user_id}
                      />
                      {(person.user_id === userId ? companionsCount : person.companions_count) >
                        0 && (
                        <span>
                          +{person.user_id === userId ? companionsCount : person.companions_count}
                        </span>
                      )}
                    </div>
                  ))}
                  {attendees.length > 8 && (
                    <span className="trip-detail__more-attendees">+{attendees.length - 8}</span>
                  )}
                  {attendees.length === 0 && <p>لا يوجد حضور مؤكد بعد</p>}
                </div>
              </div>
            </section>
          )}

          <section className="trip-detail__about" aria-labelledby="trip-about-title">
            <h2 id="trip-about-title">
              <Info size={22} />
              عن الرحلة
            </h2>
            <p className="trip-detail__description">
              {trip.description?.trim() || "لا يوجد وصف لهذه الرحلة."}
            </p>
            <div className="trip-detail__facts">
              <div>
                <MapPin size={22} />
                <div>
                  <span>الموقع</span>
                  <strong>{trip.location || "غير محدد"}</strong>
                </div>
              </div>
              <div>
                <Tent size={22} />
                <div>
                  <span>نوع الإقامة</span>
                  <strong>{trip.accommodation_type || "غير محدد"}</strong>
                </div>
              </div>
            </div>
            {trip.location_url && (
              <a
                href={trip.location_url}
                target="_blank"
                rel="noopener noreferrer"
                className="trip-detail__map"
              >
                <MapPin size={19} />
                فتح الموقع في الخريطة
                <ExternalLink size={18} />
              </a>
            )}
          </section>
        </div>
        {trip.status !== "planning" && (
          <div className="trip-detail__preparations">
            <TripPreparations
              tripId={tripId}
              userId={rolesLoading || primaryRole === "guest" ? null : userId}
              canManage={isPrivileged}
              readOnly={tripPhase(trip) === "past"}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}
