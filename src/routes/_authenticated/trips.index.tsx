import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import {
  MapPin,
  ChevronLeft,
  Plus,
  X,
  Upload,
  ImageIcon,
  Trash2,
  Pencil,
  Save,
  Compass,
  Loader2,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { TripImage } from "@/components/trip-image";
import { TripTicket } from "@/components/trip-ticket";
import { QuickActionsBanner } from "@/components/quick-actions-banner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useUserRole, roleLabel } from "@/hooks/use-user-role";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { GameRoomsHub } from "@/components/entertainment/game-rooms-hub";
import { sendPushNotification } from "@/lib/api/push.functions";
import { consumeQuickCreate } from "@/lib/quick-create";
import { useDayBoundaryKey } from "@/hooks/use-day-boundary";
import { TripStatusControl } from "@/components/trip-status-control";
import type { EditableTripStatus } from "@/lib/trip-status";
import { tripPhase, type PlannedTrip } from "@/lib/trip-planning";
import { TripImageUploadError, uploadTripImage } from "@/lib/trip-image-upload";

export const Route = createFileRoute("/_authenticated/trips/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الترفيه — السيف" },
      { name: "description", content: "وجهات ترفيهية وفعاليات عائلية لتعزيز الترابط." },
    ],
  }),
  component: TripsPage,
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

function TripsPage() {
  const [profile, setProfile] = useState<{
    name: string;
    role: string;
    initial: string;
    avatarPath?: string | null;
  }>({ name: "عضو العائلة", role: "عضو", initial: "ص", avatarPath: null });
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"destinations" | "games">("destinations");
  const [tripTab, setTripTab] = useState<"upcoming" | "planning">("upcoming");
  const [showAdd, setShowAdd] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const {
    userId,
    canManage: canManageSection,
    primaryRole,
    isLoading: rolesLoading,
  } = useUserRole();
  const canManage = !rolesLoading && !!userId && canManageSection("trips");
  const dynamicLogo = useSiteLogo();
  const activeDayKey = useDayBoundaryKey();

  async function loadTrips() {
    const { data, error } = await supabase
      .from("trips")
      .select("*")
      .order("start_date", { ascending: true, nullsFirst: false });
    if (error) {
      toast.error("تعذر تحميل بيانات الترفيه");
    } else {
      setTrips(((data ?? []) as Trip[]).filter((trip) => tripPhase(trip) !== "past"));
    }
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      if (userId) {
        const [{ data: p }, { data: r }] = await Promise.all([
          supabase
            .from("profiles")
            .select("arabic_name, full_name, avatar_url")
            .eq("id", userId)
            .maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", userId),
        ]);
        const rs = (r ?? []).map((x) => x.role);
        const name = p?.arabic_name?.trim() || p?.full_name?.trim() || "عضو العائلة";
        setProfile({
          name,
          role: roleLabel(primaryRole),
          initial: (name[0] ?? "س").toUpperCase(),
          avatarPath: p?.avatar_url ?? null,
        });
      }
      await loadTrips();
    })();

    const channel = supabase
      .channel("trips-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, () => loadTrips())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, activeDayKey]);

  useEffect(() => {
    if (rolesLoading) return;
    const requested = consumeQuickCreate("trip");
    if (requested && canManage) {
      setActiveTab("destinations");
      setEditingTrip(null);
      setShowAdd(true);
    }
  }, [rolesLoading, canManage]);

  return (
    <AppShell title="الترفيه" user={{ name: "", role: "", initial: "ص" }}>
      <div className="trips-page" dir="rtl">
        <QuickActionsBanner />

        <div className="trips-section-tabs" role="group" aria-label="أقسام الترفيه">
          <button
            type="button"
            aria-pressed={activeTab === "destinations"}
            onClick={() => setActiveTab("destinations")}
          >
            <Compass size={20} />
            <span>الوجهات والرحلات</span>
          </button>
          <button
            type="button"
            aria-pressed={activeTab === "games"}
            onClick={() => setActiveTab("games")}
          >
            <Target size={20} />
            <span>غرف الألعاب</span>
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "destinations" ? (
            <motion.div
              key="destinations"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="trips-destinations"
            >
              <section className="trips-ticket-header" aria-labelledby="trips-heading">
                <div
                  className="trips-ticket-header__logo logo-alsaif-banner"
                  aria-hidden="true"
                  style={{ "--logo-url": dynamicLogo ? `url(${dynamicLogo})` : "none" } as any}
                />
                <div className="trips-ticket-header__copy">
                  <h2 id="trips-heading">ترفيه العائلة</h2>
                  <p>جدول الوجهات واللقاءات الترفيهية لأعضاء عائلة السيف لتعزيز الترابط.</p>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setShowAdd(true)}
                    className="trips-ticket-add"
                  >
                    <Plus size={21} strokeWidth={2.5} aria-hidden="true" />
                    <span>إضافة رحلة جديدة</span>
                  </button>
                )}
              </section>

              <div className="trips-phase-tabs" role="group" aria-label="مرحلة الرحلات">
                {(["upcoming", "planning"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    aria-pressed={tripTab === tab}
                    onClick={() => setTripTab(tab)}
                  >
                    {tab === "planning" ? "قيد التخطيط" : "الرحلات القادمة والحالية"}{" "}
                    <span>
                      {
                        trips.filter(
                          (trip) => (trip.status === "planning") === (tab === "planning"),
                        ).length
                      }
                    </span>
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4 opacity-40">
                  <div className="size-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                  <p className="font-black">جاري تحضير الوجهات الترفيهية...</p>
                </div>
              ) : trips.filter((trip) => (trip.status === "planning") === (tripTab === "planning"))
                  .length === 0 ? (
                <div className="trips-empty flex flex-col items-center text-center gap-6">
                  <div className="size-20 rounded-[40px] bg-muted/50 flex items-center justify-center text-muted-foreground">
                    <Compass size={60} strokeWidth={1} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-black text-primary">لا توجد أنشطة ترفيهية حالياً</p>
                    <p className="text-sm font-bold opacity-60">
                      سيتم إشعارك فور إعلان الإدارة عن وجهة ترفيهية جديدة.
                    </p>
                  </div>
                </div>
              ) : (
                <div className={`trips-ticket-grid trips-ticket-grid--${tripTab}`}>
                  {trips
                    .filter((trip) => (trip.status === "planning") === (tripTab === "planning"))
                    .map((trip) => (
                      <TripCard
                        key={trip.id}
                        trip={trip}
                        canManage={canManage}
                        onEdit={setEditingTrip}
                        onRefresh={loadTrips}
                        onStatusSaved={(status: EditableTripStatus) => {
                          if (status !== "past")
                            setTripTab(status === "planning" ? "planning" : "upcoming");
                          setTrips((items) =>
                            items.map((item) => (item.id === trip.id ? { ...item, status } : item)),
                          );
                        }}
                      />
                    ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="games"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              {/* Games Header */}
              <section className="animate-fade-up px-4 md:px-0">
                <div className="relative overflow-hidden rounded-[32px] md:rounded-[48px] bg-gradient-to-br from-[#064E3B] via-[#0d2620] to-black p-6 md:p-12 text-white shadow-2xl border border-white/5 group">
                  <div className="absolute left-4 md:left-10 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none z-1 transition-transform duration-1000 group-hover:scale-110 group-hover:opacity-40">
                    <div
                      className="size-28 md:size-64 logo-alsaif-banner"
                      style={{ "--logo-url": `url(${dynamicLogo || ""})` } as any}
                    />
                  </div>
                  <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-10">
                    <div className="space-y-3 md:space-y-5 text-center md:text-right">
                      <div className="flex items-center justify-center md:justify-start gap-3">
                        <div className="h-0.5 w-8 md:w-12 bg-gold-primary shadow-[0_0_10px_rgba(212,175,55,0.6)]" />
                        <span className="text-[11px] md:text-xs font-black uppercase tracking-[0.4em] text-gold-primary">
                          ميدان التنافس
                        </span>
                      </div>
                      <h2 className="text-3xl md:text-6xl font-black tracking-tighter leading-tight drop-shadow-2xl text-gold-primary">
                        غرف ألعاب السيف
                      </h2>
                      <p className="text-white/60 font-bold text-sm md:text-xl max-w-xl">
                        أنشئ غرفة، شارك الرمز، وخلي كل فرد يدخل من جواله ويلعب معكم لحظيًا.
                      </p>
                    </div>
                    <div className="size-16 md:size-28 rounded-2xl md:rounded-[36px] bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center shadow-2xl self-center md:self-auto shrink-0 group-hover:rotate-12 transition-transform duration-700">
                      <Target className="size-8 md:size-14 text-gold-primary" strokeWidth={1.5} />
                    </div>
                  </div>
                </div>
              </section>

              <GameRoomsHub />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {(showAdd || editingTrip) && (
          <TripDialog
            trip={editingTrip || undefined}
            onClose={() => {
              setShowAdd(false);
              setEditingTrip(null);
            }}
            onSaved={loadTrips}
            onCreated={() => setTripTab("planning")}
          />
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function TripCard({
  trip,
  canManage,
  onEdit,
  onRefresh,
  onStatusSaved,
}: {
  trip: Trip;
  canManage: boolean;
  onEdit: (trip: Trip) => void;
  onRefresh: () => Promise<void>;
  onStatusSaved: (status: EditableTripStatus) => void;
}) {
  return (
    <TripTicket
      trip={trip}
      image={<TripImage path={trip.image_url} alt={trip.title} />}
      statusControl={
        <TripStatusControl
          trip={trip}
          canManage={canManage}
          onSaved={onStatusSaved}
          onRecordSaved={() => void onRefresh()}
        />
      }
      details={
        <Link to="/trips/$tripId" params={{ tripId: trip.id }} className="trip-ticket__details">
          <span>عرض التفاصيل</span>
          <ChevronLeft size={17} aria-hidden="true" />
        </Link>
      }
      actions={
        canManage ? (
          <>
            <button
              type="button"
              aria-label={`تعديل رحلة ${trip.title}`}
              onClick={() => onEdit(trip)}
            >
              <Pencil size={20} aria-hidden="true" />
              <span>تعديل</span>
            </button>
            <button
              type="button"
              aria-label={`حذف رحلة ${trip.title}`}
              onClick={async () => {
                if (!confirm(`هل تريد حذف رحلة "${trip.title}"؟`)) return;
                const { error } = await supabase.from("trips").delete().eq("id", trip.id);
                if (error) toast.error("تعذر الحذف");
                else {
                  toast.success("تم الحذف");
                  onRefresh();
                }
              }}
              className="trip-ticket__delete"
            >
              <Trash2 size={20} aria-hidden="true" />
              <span>حذف</span>
            </button>
          </>
        ) : undefined
      }
    />
  );
}

function TripDialog({ trip, onClose, onSaved, onCreated }: any) {
  const sendPush = useServerFn(sendPushNotification);
  const isEdit = !!trip;
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const [form, setForm] = useState({
    title: trip?.title ?? "",
    badge: trip?.badge ?? "",
    location: trip?.location ?? "",
    location_url: trip?.location_url ?? "",
    accommodation_type: trip?.accommodation_type ?? "مخيم عائلي فاخر",
    start_date: trip?.start_date ?? "",
    end_date: trip?.end_date ?? "",
    description: trip?.description ?? "",
  });

  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const onPickImage = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) {
      toast.error("عنوان الرحلة مطلوب");
      return;
    }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        toast.error("سجل دخولك لحفظ الرحلة");
        return;
      }
      if (form.start_date && form.end_date && form.end_date < form.start_date) {
        toast.error("تاريخ النهاية يجب أن يكون بعد البداية أو في اليوم نفسه");
        return;
      }

      let imagePath: string | null | undefined = undefined;
      if (imageFile) {
        imagePath = await uploadTripImage(imageFile, u.user.id);
      } else if (isEdit && removeExistingImage) {
        imagePath = null;
      }

      const payload: any = {
        ...form,
        title,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      };
      if (!isEdit) {
        payload.status = "planning";
        payload.planning_destinations = form.location.trim()
          ? [{ id: crypto.randomUUID(), name: form.location.trim() }]
          : [];
        payload.planning_dates = form.start_date
          ? [
              {
                id: crypto.randomUUID(),
                start_date: form.start_date,
                end_date: form.end_date || form.start_date,
              },
            ]
          : [];
      }
      if (imagePath !== undefined) payload.image_url = imagePath;

      let error: any;
      if (isEdit) {
        ({ error } = await supabase
          .from("trips")
          .update(payload)
          .eq("id", trip.id)
          .select("id")
          .single());
      } else {
        ({ error } = await supabase
          .from("trips")
          .insert({ ...payload, created_by: u.user.id })
          .select("id")
          .single());
      }

      // Keep the list usable while an older database is waiting for the migration.
      if (error?.message?.includes("accommodation_type")) {
        const { accommodation_type: _accommodationType, ...legacyPayload } = payload;
        if (isEdit) {
          ({ error } = await supabase
            .from("trips")
            .update(legacyPayload)
            .eq("id", trip.id)
            .select("id")
            .single());
        } else {
          ({ error } = await supabase
            .from("trips")
            .insert({ ...legacyPayload, created_by: u.user.id })
            .select("id")
            .single());
        }
        if (!error) {
          toast.info("تم حفظ الرحلة. سيُفعّل نوع الإقامة بعد تحديث قاعدة البيانات.");
        }
      }

      if (error) {
        console.error("Trip save error:", error);
        toast.error("حدث خطأ أثناء الحفظ", {
          description: error.message || "تأكد من تعبئة الحقول المطلوبة وصلاحياتك.",
        });
      } else {
        toast.success("تم الحفظ");

        if (!isEdit) {
          // Trigger FCM for new trip
          try {
            await sendPush({
              data: {
                title: "فعالية جديدة",
                body: "تمت إضافة فعالية جديدة في قسم الترفيه.",
                type: "entertainment",
                route: "/trips",
              },
            });
          } catch (fcmErr) {
            console.warn("Push broadcast failed:", fcmErr);
          }
        }

        if (!isEdit) onCreated?.();
        onSaved();
        onClose();
      }
    } catch (error) {
      if (error instanceof TripImageUploadError) {
        console.error("Trip image upload failed:", error.cause);
        toast.error("تعذّر رفع صورة الرحلة", { description: error.message });
      } else {
        console.error("Trip save failed:", error);
        toast.error("تعذّر حفظ الرحلة. تحقق من الاتصال وأعد المحاولة.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-4 bg-black/80 backdrop-blur-md"
      dir="rtl"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-card w-full max-w-2xl overflow-hidden shadow-2xl rounded-[32px] md:rounded-[48px] flex flex-col max-h-[90vh] border border-border"
      >
        <div className="p-6 md:p-12 space-y-6 md:space-y-8 overflow-y-auto custom-scrollbar flex-1">
          <div className="flex items-center justify-between sticky top-0 bg-card z-10 pb-4 border-b border-border/20">
            <div className="space-y-1">
              <h3 className="text-2xl md:text-3xl font-black text-primary tracking-tight">
                {isEdit ? "تعديل الرحلة" : "إضافة رحلة جديدة"}
              </h3>
              <p className="text-xs md:text-sm font-bold text-muted-foreground opacity-60">
                {isEdit
                  ? "أدخل تفاصيل الوجهة والمواعيد لرحلة العائلة."
                  : "تُضاف الرحلة قيد التخطيط؛ تُعتمد الوجهة والمواعيد من واجهة الرحلة."}
              </p>
            </div>
            <button
              onClick={onClose}
              className="size-10 md:size-12 rounded-full bg-muted flex items-center justify-center hover:bg-primary hover:text-white transition-all"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={submit} className="space-y-6 md:space-y-8 text-foreground">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
              <Field
                label="عنوان الرحلة"
                value={form.title}
                onChange={(v: any) => update("title", v)}
                placeholder="مثال: رحلة العلا"
              />
              <Field
                label="الوسم"
                value={form.badge}
                onChange={(v: any) => update("badge", v)}
                placeholder="مثال: الرحلة السنوية"
              />
              <Field
                label="الوجهة"
                value={form.location}
                onChange={(v: any) => update("location", v)}
                placeholder="المدينة أو الدولة"
              />
              <div className="space-y-2">
                <label className="text-[11px] md:text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">
                  نوع الإقامة
                </label>
                <select
                  value={form.accommodation_type}
                  onChange={(e) => update("accommodation_type", e.target.value)}
                  className="w-full h-12 md:h-14 px-5 rounded-2xl md:rounded-2xl bg-muted/40 border border-border/60 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all text-foreground"
                >
                  <option value="مخيم عائلي فاخر">مخيم عائلي فاخر</option>
                  <option value="فندق">فندق</option>
                  <option value="منتجع">منتجع</option>
                  <option value="شاليه">شاليه</option>
                  <option value="استراحة">استراحة</option>
                  <option value="رحلة بحرية">رحلة بحرية</option>
                  <option value="يوم ترفيهي">يوم ترفيهي</option>
                  <option value="أخرى">أخرى</option>
                </select>
              </div>
              <Field
                label="تاريخ البدء"
                type="date"
                value={form.start_date}
                onChange={(v: any) => update("start_date", v)}
              />
              <Field
                label="تاريخ الانتهاء"
                type="date"
                value={form.end_date}
                onChange={(v: any) => update("end_date", v)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] md:text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">
                رابط الموقع
              </label>
              <input
                dir="ltr"
                value={form.location_url}
                onChange={(e) => update("location_url", e.target.value)}
                placeholder="رابط خرائط جوجل"
                className="w-full h-12 md:h-14 px-5 rounded-2xl bg-muted/40 border border-border/60 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all shadow-inner text-foreground placeholder:text-muted-foreground/50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] md:text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">
                وصف الرحلة
              </label>
              <textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="التفاصيل والبرامج..."
                rows={3}
                className="w-full p-5 md:p-6 rounded-2xl md:rounded-3xl bg-muted/40 border border-border/60 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all resize-none shadow-inner text-foreground placeholder:text-muted-foreground/50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] md:text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">
                صورة الوجهة
              </label>
              <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-border/60 rounded-[24px] md:rounded-[32px] cursor-pointer hover:bg-primary/5 hover:border-primary/40 transition-all bg-muted/20">
                {imagePreview || trip?.image_url ? (
                  <img
                    src={imagePreview || trip?.image_url}
                    className="w-full h-32 md:h-40 object-cover rounded-xl shadow-lg"
                  />
                ) : (
                  <>
                    <ImageIcon className="size-8 text-muted-foreground opacity-30" />
                    <span className="text-xs font-bold text-muted-foreground">اضغط لرفع صورة</span>
                  </>
                )}
                <input type="file" hidden accept="image/*" onChange={onPickImage} />
              </label>
            </div>
          </form>
        </div>
        <div className="p-6 md:p-10 bg-card border-t border-border/20 flex gap-3 md:gap-4 sticky bottom-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-4 md:py-5 rounded-2xl md:rounded-3xl font-black text-muted-foreground hover:bg-muted transition-all"
          >
            إلغاء
          </button>
          <button
            disabled={saving}
            onClick={submit as any}
            className="flex-[2] btn-gold py-4 md:py-5 rounded-2xl md:rounded-3xl font-black text-base md:text-lg shadow-2xl shadow-gold-primary/20 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="size-5 animate-spin" /> : <span>حفظ البيانات</span>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: any) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase tracking-widest text-primary px-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-14 px-6 rounded-2xl bg-muted/30 border border-border font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all shadow-sm"
      />
    </div>
  );
}
