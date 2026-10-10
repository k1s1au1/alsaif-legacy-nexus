import { useEffect, useRef, useState } from "react";
import {
  Calendar,
  Check,
  Compass,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { approveTrip, saveTripPreference } from "@/lib/api/trip-planning";
import {
  currentPreferences,
  formatTripDate,
  type DateOption,
  type DestinationOption,
  type PlannedTrip,
  type TripPreference,
} from "@/lib/trip-planning";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import "./trip-planning.css";

function errorMessage(error: unknown) {
  return (error as { message?: string })?.message || "تعذر الحفظ، حاول مرة أخرى";
}

export function TripApprovalDialog({
  trip,
  onClose,
  onSaved,
}: {
  trip: PlannedTrip;
  onClose: () => void;
  onSaved: (trip: PlannedTrip) => void;
}) {
  const [location, setLocation] = useState(trip.location || "");
  const [start, setStart] = useState(trip.start_date || "");
  const [end, setEnd] = useState(trip.end_date || trip.start_date || "");
  const revision = useRef(trip.planning_revision ?? 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      const result = await approveTrip(
        { ...trip, planning_revision: revision.current },
        location,
        start,
        end,
      );
      onSaved(result);
      toast.success("تم اعتماد الرحلة وفتح تأكيد الحضور والتجهيزات");
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="trip-system trip-system__modal" dir="rtl">
        <DialogTitle>اعتماد الرحلة</DialogTitle>
        <DialogDescription>ثبّت الوجهة والموعد النهائيين لرحلة «{trip.title}».</DialogDescription>
        <form onSubmit={save} className="trip-system__stack">
          {!!trip.planning_destinations?.length && (
            <label className="trip-system__field">
              الوجهات المقترحة
              <select
                value=""
                onChange={(e) => {
                  const choice = trip.planning_destinations?.find((o) => o.id === e.target.value);
                  if (choice) setLocation(choice.name);
                }}
              >
                <option value="">اختر من المقترحات</option>
                {trip.planning_destinations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="trip-system__field">
            الوجهة النهائية
            <input
              required
              maxLength={120}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </label>
          {!!trip.planning_dates?.length && (
            <label className="trip-system__field">
              المواعيد المقترحة
              <select
                value=""
                onChange={(e) => {
                  const choice = trip.planning_dates?.find((o) => o.id === e.target.value);
                  if (choice) {
                    setStart(choice.start_date);
                    setEnd(choice.end_date);
                  }
                }}
              >
                <option value="">اختر من المقترحات</option>
                {trip.planning_dates.map((o) => (
                  <option key={o.id} value={o.id}>
                    {formatTripDate(o.start_date)} — {formatTripDate(o.end_date)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="trip-system__grid">
            <label className="trip-system__field">
              تاريخ البداية
              <input
                type="date"
                required
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label className="trip-system__field">
              تاريخ النهاية
              <input
                type="date"
                required
                min={start || undefined}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          </div>
          <p className="trip-system__notice">
            الاهتمام أثناء التخطيط لا يُعد تأكيد حضور. سيؤكد الأعضاء حضورهم بعد الاعتماد.
          </p>
          {error && (
            <p className="trip-system__error" role="alert">
              {error}
            </p>
          )}
          <div className="trip-system__actions">
            <button
              type="submit"
              disabled={saving}
              className="trip-system__button trip-system__button--primary"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}{" "}
              اعتماد الرحلة
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="trip-system__button"
            >
              إلغاء
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TripPlanningPanel({
  trip,
  userId,
  canManage,
  onSaved,
}: {
  trip: PlannedTrip;
  userId: string | null;
  canManage: boolean;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<TripPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [destination, setDestination] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [interested, setInterested] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editor, setEditor] = useState(false);
  const [approval, setApproval] = useState(false);
  const busy = useRef(false);
  const validRows = currentPreferences(trip, rows);
  const mine = validRows.find((row) => row.user_id === userId);
  useEffect(() => {
    setDestination(mine?.destination_id ?? null);
    setDate(mine?.date_id ?? null);
    setInterested(mine?.interested ?? false);
  }, [userId, trip.planning_revision, mine?.destination_id, mine?.date_id, mine?.interested]);
  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error } = await supabase
        .from("trip_preferences")
        .select("*")
        .eq("trip_id", trip.id);
      if (!active) return;
      if (error) setError("تعذر تحميل اختيارات الأعضاء. حاول التحديث.");
      else {
        setRows((data || []) as TripPreference[]);
        setError("");
      }
      setLoading(false);
    }
    void load();
    const channel = supabase
      .channel(`trip-preferences-${trip.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trip_preferences",
          filter: `trip_id=eq.${trip.id}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [trip.id, trip.planning_revision]);
  async function save(nextInterest = interested) {
    if (!userId || busy.current || loading || error) return;
    busy.current = true;
    setSaving(true);
    try {
      const saved = await saveTripPreference(trip, {
        interested: nextInterest,
        destination_id: destination,
        date_id: date,
      });
      setRows((prev) => [...prev.filter((r) => r.user_id !== userId), saved]);
      setInterested(saved.interested);
      toast.success("تم حفظ اختيارك واهتمامك بالرحلة");
    } catch (e) {
      toast.error(errorMessage(e));
      onSaved();
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  return (
    <section className="trip-system trip-system__panel" aria-label="تخطيط الرحلة">
      <div className="trip-system__heading">
        <div>
          <h3>نخطط رحلتنا معاً</h3>
          <p className="trip-system__muted">اختر الوجهة والموعد الأنسب لك قبل اعتماد الرحلة.</p>
        </div>
        {canManage && (
          <button className="trip-system__button" onClick={() => setEditor(true)}>
            <Pencil size={17} /> تعديل خيارات التخطيط
          </button>
        )}
      </div>
      {error && (
        <p className="trip-system__error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">جاري تحميل الاختيارات…</p>
      ) : (
        <>
          <div className="trip-system__grid">
            <fieldset>
              <legend className="font-black flex items-center gap-2">
                <Compass size={20} /> اختر الوجهة
              </legend>
              <div className="trip-system__choices">
                {(trip.planning_destinations || []).map((option) => (
                  <label key={option.id} className="trip-system__choice">
                    <input
                      type="radio"
                      name={`destination-${trip.id}`}
                      checked={destination === option.id}
                      onChange={() => setDestination(option.id)}
                      disabled={saving || !userId || !!error}
                    />
                    <span>
                      <strong>{option.name}</strong>
                      <span className="trip-system__muted">
                        {validRows.filter((r) => r.destination_id === option.id).length} اختيارات
                      </span>
                    </span>
                  </label>
                ))}
                {!trip.planning_destinations?.length && (
                  <p className="trip-system__muted">سيضيف المسؤول الوجهات المقترحة هنا.</p>
                )}
              </div>
            </fieldset>
            <fieldset>
              <legend className="font-black flex items-center gap-2">
                <Calendar size={20} /> الموعد الأنسب لك
              </legend>
              <div className="trip-system__choices">
                {(trip.planning_dates || []).map((option) => (
                  <label key={option.id} className="trip-system__choice">
                    <input
                      type="radio"
                      name={`date-${trip.id}`}
                      checked={date === option.id}
                      onChange={() => setDate(option.id)}
                      disabled={saving || !userId || !!error}
                    />
                    <span>
                      <strong>
                        {formatTripDate(option.start_date)} — {formatTripDate(option.end_date)}
                      </strong>
                      <span className="trip-system__muted">
                        {validRows.filter((r) => r.date_id === option.id).length} اختيارات
                      </span>
                    </span>
                  </label>
                ))}
                {!trip.planning_dates?.length && (
                  <p className="trip-system__muted">سيضيف المسؤول المواعيد المقترحة هنا.</p>
                )}
              </div>
            </fieldset>
          </div>
          <div className="trip-system__summary">
            <strong className="flex gap-2 items-center">
              <Users size={20} /> {validRows.filter((r) => r.interested).length} مهتم بالرحلة
            </strong>
            <div className="trip-system__actions">
              <button
                className={`trip-system__button ${interested ? "trip-system__button--primary" : ""}`}
                aria-pressed={interested}
                onClick={() => void save(!interested)}
                disabled={saving || !userId || !!error}
              >
                {interested ? <Check size={18} /> : <Plus size={18} />}
                {interested ? "مهتم بالرحلة — إلغاء الاهتمام" : "مهتم بالرحلة"}
              </button>
              <button
                className="trip-system__button trip-system__button--primary"
                onClick={() => void save()}
                disabled={saving || !userId || !!error}
              >
                {saving && <Loader2 size={18} className="animate-spin" />} حفظ اختياراتي
              </button>
            </div>
          </div>
          <p className="trip-system__muted mt-4">
            هذه خيارات أولية؛ يفتح تأكيد الحضور والتجهيزات بعد اعتماد الوجهة والموعد.
          </p>
        </>
      )}
      {canManage && (
        <div className="trip-system__summary">
          <p className="trip-system__muted">
            للمسؤول والرئيس والنائب: راجع التصويت وثبّت الخطة النهائية.
          </p>
          <button
            className="trip-system__button trip-system__button--primary"
            onClick={() => setApproval(true)}
          >
            <ShieldCheck size={18} /> اعتماد الرحلة
          </button>
        </div>
      )}
      {editor && (
        <PlanningOptionsDialog trip={trip} onClose={() => setEditor(false)} onSaved={onSaved} />
      )}
      {approval && (
        <TripApprovalDialog
          trip={trip}
          onClose={() => setApproval(false)}
          onSaved={() => {
            onSaved();
            void queryClient.invalidateQueries({ queryKey: ["upcoming-events"] });
            void queryClient.invalidateQueries({ queryKey: ["dashboard-counts"] });
          }}
        />
      )}
    </section>
  );
}

function PlanningOptionsDialog({
  trip,
  onClose,
  onSaved,
}: {
  trip: PlannedTrip;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [destinations, setDestinations] = useState<DestinationOption[]>(
    trip.planning_destinations || [],
  );
  const [dates, setDates] = useState<DateOption[]>(trip.planning_dates || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const revision = useRef(trip.planning_revision ?? 1);
  const busy = useRef(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy.current) return;
    if (
      destinations.some((o) => !o.name.trim()) ||
      dates.some((o) => !o.start_date || !o.end_date || o.end_date < o.start_date)
    ) {
      setError("أكمل أسماء الوجهات وتواريخ الخيارات بشكل صحيح");
      return;
    }
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      const { data, error } = await supabase
        .from("trips")
        .update({
          planning_destinations: destinations.map((o) => ({ ...o, name: o.name.trim() })),
          planning_dates: dates,
        })
        .eq("id", trip.id)
        .eq("status", "planning")
        .eq("planning_revision", revision.current)
        .select("id")
        .single();
      if (error) throw error;
      if (!data) throw new Error("تغيرت الخطة؛ حدّث الصفحة وحاول مجدداً");
      toast.success("تم حفظ خيارات التخطيط");
      onSaved();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="trip-system trip-system__modal" dir="rtl">
        <DialogTitle>خيارات التخطيط</DialogTitle>
        <DialogDescription>أضف حتى 8 وجهات و8 مواعيد ليختار أفراد العائلة منها.</DialogDescription>
        <form onSubmit={save} className="trip-system__stack">
          <h3 className="font-black">الوجهات المقترحة</h3>
          {destinations.map((o, index) => (
            <div className="trip-system__option-edit" key={o.id}>
              <label className="trip-system__field">
                الوجهة {index + 1}
                <input
                  required
                  maxLength={120}
                  value={o.name}
                  onChange={(e) =>
                    setDestinations((prev) =>
                      prev.map((x) => (x.id === o.id ? { ...x, name: e.target.value } : x)),
                    )
                  }
                />
              </label>
              <button
                type="button"
                className="trip-system__button"
                aria-label={`حذف الوجهة ${index + 1}`}
                onClick={() => setDestinations((prev) => prev.filter((x) => x.id !== o.id))}
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={destinations.length >= 8}
            className="trip-system__button"
            onClick={() =>
              setDestinations((prev) => [...prev, { id: crypto.randomUUID(), name: "" }])
            }
          >
            <Plus size={18} /> إضافة وجهة
          </button>
          <h3 className="font-black">المواعيد المقترحة</h3>
          {dates.map((o, index) => (
            <div className="trip-system__option-edit" key={o.id}>
              <label className="trip-system__field">
                البداية {index + 1}
                <input
                  required
                  type="date"
                  value={o.start_date}
                  onChange={(e) =>
                    setDates((prev) =>
                      prev.map((x) => (x.id === o.id ? { ...x, start_date: e.target.value } : x)),
                    )
                  }
                />
              </label>
              <label className="trip-system__field">
                النهاية {index + 1}
                <input
                  required
                  type="date"
                  min={o.start_date || undefined}
                  value={o.end_date}
                  onChange={(e) =>
                    setDates((prev) =>
                      prev.map((x) => (x.id === o.id ? { ...x, end_date: e.target.value } : x)),
                    )
                  }
                />
              </label>
              <button
                type="button"
                className="trip-system__button"
                aria-label={`حذف الموعد ${index + 1}`}
                onClick={() => setDates((prev) => prev.filter((x) => x.id !== o.id))}
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={dates.length >= 8}
            className="trip-system__button"
            onClick={() =>
              setDates((prev) => [
                ...prev,
                { id: crypto.randomUUID(), start_date: "", end_date: "" },
              ])
            }
          >
            <Plus size={18} /> إضافة موعد
          </button>
          <p className="trip-system__notice">
            عند تغيير الخيارات يبدأ التصويت عليها من جديد، ويختار كل عضو ما يناسبه من الخطة المحدثة.
          </p>
          {error && (
            <p role="alert" className="trip-system__error">
              {error}
            </p>
          )}
          <div className="trip-system__actions">
            <button
              type="submit"
              disabled={saving}
              className="trip-system__button trip-system__button--primary"
            >
              {saving && <Loader2 size={18} className="animate-spin" />} حفظ الخيارات
            </button>
            <button
              type="button"
              disabled={saving}
              className="trip-system__button"
              onClick={onClose}
            >
              إلغاء
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
