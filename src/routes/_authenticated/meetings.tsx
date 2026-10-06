import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { X, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/use-user-role";
import { MeetingsLedger } from "@/components/meetings-ledger";
import {
  formatMeetingDate as formatDate,
  splitMeetings,
  normalizeCompanionsCount,
  type Meeting,
  type Attendee,
  type ProfileLite,
  type Rsvp,
} from "@/lib/meetings-ledger";

import { OfflineCache } from "@/lib/offline-cache";
import { consumeQuickCreate } from "@/lib/quick-create";
import { useDayBoundaryKey } from "@/hooks/use-day-boundary";

export const Route = createFileRoute("/_authenticated/meetings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الاجتماعات العائلية — السيف" },
      { name: "description", content: "جدول اجتماعات وفعاليات عائلة السيف." },
    ],
  }),
  component: MeetingsPage,
});

function MeetingsPage() {
  const {
    userId,
    isLoading: rolesLoading,
    canManage: canManageSection,
    primaryRole,
  } = useUserRole();
  const activeDayKey = useDayBoundaryKey();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(true);
  const [savingRsvp, setSavingRsvp] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [showMinutes, setShowMinutes] = useState<Meeting | null>(null);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // form fields
  const [fTitle, setFTitle] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fLocation, setFLocation] = useState("");
  const [fLocationUrl, setFLocationUrl] = useState("");
  const [fWhen, setFWhen] = useState("");
  const [fDuration, setFDuration] = useState("");
  const [fMinutes, setFMinutes] = useState("");

  const canManage = canManageSection("meetings");

  const resetForm = useCallback(() => {
    setFTitle("");
    setFDesc("");
    setFLocation("");
    setFLocationUrl("");
    setFWhen("");
    setFDuration("");
    setFMinutes("");
    setEditing(null);
  }, []);

  const loadAll = useCallback(async () => {
    const cached = OfflineCache.load("meetings");
    const cachedHistory = OfflineCache.load("meetings-history");
    if (cached || cachedHistory) {
      setMeetings([...(cached || []), ...(cachedHistory || [])] as Meeting[]);
    }

    setLoading(true);
    try {
      const [{ data: m, error: meetingError }, { data: a }, { data: pr }] = await Promise.all([
        supabase.from("meetings").select("*").order("scheduled_at", { ascending: true }),
        supabase.from("meeting_attendees").select("*"),
        supabase.from("profiles").select("id, arabic_name, full_name, avatar_url"),
      ]);

      if (meetingError) throw meetingError;
      const allMeetings = (m ?? []) as Meeting[];
      const { upcoming, previous } = splitMeetings(allMeetings);
      setMeetings(allMeetings);
      OfflineCache.save("meetings", upcoming);
      OfflineCache.save("meetings-history", previous);
      setAttendees((a ?? []) as Attendee[]);
      const map: Record<string, ProfileLite> = {};
      ((pr ?? []) as ProfileLite[]).forEach((p) => {
        if (p?.id) map[p.id] = p;
      });
      setProfiles(map);
    } catch (err) {
      console.error("Meetings load error:", err);
      toast.error("فشل في تحميل بيانات الاجتماعات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();

    const channel = supabase
      .channel("meetings-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "meetings" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "meeting_attendees" }, () =>
        loadAll(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAll, userId, primaryRole, activeDayKey]);

  useEffect(() => {
    if (rolesLoading) return;
    if (consumeQuickCreate("meeting") && canManage) {
      resetForm();
      setShowForm(true);
    }
  }, [rolesLoading, canManage, resetForm]);

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (m: Meeting) => {
    setEditing(m);
    setFTitle(m.title);
    setFDesc(m.description ?? "");
    setFLocation(m.location ?? "");
    setFLocationUrl(m.location_url ?? "");
    const d = new Date(m.scheduled_at);
    const pad = (n: number) => String(n).padStart(2, "0");
    setFWhen(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
    );
    setFDuration(m.duration_minutes ? String(m.duration_minutes) : "");
    setFMinutes(m.minutes ?? "");
    setShowForm(true);
  };

  const submitForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    if (!fTitle.trim() || !fWhen) {
      toast.error("العنوان والموعد مطلوبان");
      return;
    }
    setSubmitting(true);
    const payload = {
      title: fTitle.trim(),
      description: fDesc.trim() || null,
      location: fLocation.trim() || null,
      location_url: fLocationUrl.trim() || null,
      scheduled_at: new Date(fWhen).toISOString(),
      duration_minutes: fDuration ? Number(fDuration) : null,
      minutes: fMinutes.trim() || null,
    };
    try {
      if (editing) {
        const { error } = await supabase.from("meetings").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("تم التحديث");
      } else {
        const { error } = await supabase
          .from("meetings")
          .insert({ ...payload, created_by: userId });
        if (error) throw error;
        toast.success("تم الإنشاء");
      }
      setShowForm(false);
      resetForm();
      loadAll();
    } catch (err) {
      console.error("Meeting save error:", err);
      const message = err && typeof err === "object" && "message" in err ? String(err.message) : "";
      let errorMsg = "تأكد من صلاحياتك ومن تعبئة كافة الحقول المطلوبة.";

      if (message.includes("row-level security")) {
        errorMsg = "عذراً، ليس لديك صلاحية لإضافة أو تعديل الاجتماعات.";
      } else if (message) {
        errorMsg = message;
      }

      toast.error("حدث خطأ أثناء الحفظ", {
        description: errorMsg,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteMeeting = async (id: string) => {
    if (!confirm("هل تريد حذف هذا الاجتماع؟")) return;
    const { error } = await supabase.from("meetings").delete().eq("id", id);
    if (error) toast.error("تعذر الحذف");
    else {
      toast.success("تم الحذف");
      loadAll();
    }
  };

  const setRsvp = async (
    meetingId: string,
    rsvp: Rsvp,
    companionsCount: number = 0,
    mode: "choice" | "companions" = "choice",
  ) => {
    if (!userId || savingRsvp === meetingId) return;

    const prevAttendees = attendees;
    const current = attendees.find((a) => a.meeting_id === meetingId && a.user_id === userId);
    const count = rsvp === "going" ? normalizeCompanionsCount(companionsCount) : 0;
    if (mode === "companions" && (current?.rsvp !== "going" || normalizeCompanionsCount(current.companions_count) === count)) return;
    const isRemoving = mode === "choice" && current?.rsvp === rsvp && normalizeCompanionsCount(current?.companions_count) === count;

    setSavingRsvp(meetingId);

    // Optimistic update
    setAttendees((prev) => {
      const without = prev.filter((a) => !(a.meeting_id === meetingId && a.user_id === userId));
      return isRemoving
        ? without
        : [
            ...without,
            { meeting_id: meetingId, user_id: userId, rsvp, companions_count: count },
          ];
    });

    try {
      if (isRemoving) {
        const { error } = await supabase
          .from("meeting_attendees")
          .delete()
          .eq("meeting_id", meetingId)
          .eq("user_id", userId);
        if (error) throw error;
        toast.success("تم إلغاء الرد");
      } else {
        const payload = {
          meeting_id: meetingId,
          user_id: userId,
          rsvp,
          companions_count: count,
        };

        const { data, error } = await supabase
          .from("meeting_attendees")
          .upsert(payload, { onConflict: "meeting_id,user_id" })
          .select("*")
          .single();

        if (error) throw error;
        if (!data || data.rsvp !== rsvp || data.companions_count !== count) {
          throw new Error("Meeting attendance was not saved with the requested companion count");
        }
        setAttendees((prev) => [
          ...prev.filter((a) => !(a.meeting_id === meetingId && a.user_id === userId)),
          data as Attendee,
        ]);

        toast.success(mode === "companions" ? "تم حفظ عدد المرافقين" : rsvp === "going" ? "ننتظر تشريفك!" : "تم تسجيل اعتذارك");
      }
    } catch (error) {
      console.error("Meeting RSVP error:", error);
      toast.error(mode === "companions" ? "تعذر حفظ عدد المرافقين" : "تعذر تحديث حالة الحضور");
      setAttendees(prevAttendees);
    } finally {
      setSavingRsvp(null);
    }
  };

  const handleRemindAll = async (m: Meeting) => {
    try {
      toast.loading("جاري إرسال التذكيرات...");
      const { sendPushNotification } = await import("@/lib/api/push.functions");
      const result = await sendPushNotification({
        data: {
          title: `تذكير: ${m.title}`,
          body: `نذكركم بموعدنا القريب في: ${formatDate(m.scheduled_at).weekday} الساعة ${formatDate(m.scheduled_at).time}`,
          type: "meetings",
          route: "/meetings",
          category: "MEETING_INVITE",
          data: { meeting_id: String(m.id) },
        },
      });

      toast.dismiss();
      if (result.success) {
        toast.success(`تم إرسال التذكير لعدد ${result.count} جهاز بنجاح ✨`);
      } else {
        toast.error(result.error || "فشل إرسال التذكير");
      }
    } catch (err) {
      toast.dismiss();
      const message =
        err && typeof err === "object" && "message" in err ? String(err.message) : undefined;
      toast.error("فشل إرسال التذكير", { description: message });
    }
  };

  const { upcoming, previous } = useMemo(
    () => splitMeetings(meetings, new Date(`${activeDayKey}T00:00:00`)),
    [meetings, activeDayKey],
  );

  return (
    <AppShell title="الاجتماعات" user={{ name: "", role: "", initial: "ص" }}>
      <div className="meetings-page max-w-6xl mx-auto pb-24 px-2 sm:px-4 md:px-0" dir="rtl">
        <MeetingsLedger
          upcoming={upcoming}
          previous={previous}
          attendees={attendees}
          profiles={profiles}
          userId={userId}
          canManage={canManage}
          ready={!rolesLoading && !!userId}
          loading={loading}
          savingRsvp={savingRsvp}
          onCreate={openCreate}
          onEdit={openEdit}
          onDelete={deleteMeeting}
          onRsvp={setRsvp}
          onCompanionsChange={(id, count) => void setRsvp(id, "going", count, "companions")}
          onRemind={handleRemindAll}
          onShowMinutes={setShowMinutes}
        />
      </div>

      <AnimatePresence>
        {showMinutes && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-card border border-border rounded-[40px] w-full max-w-3xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col"
              dir="rtl"
            >
              <div className="p-8 border-b border-border flex items-center justify-between bg-muted/20">
                <div className="space-y-1">
                  <h3 className="text-2xl font-black text-primary">{showMinutes.title}</h3>
                  <p className="text-xs font-bold text-muted-foreground">
                    محضر اجتماع {formatDate(showMinutes.scheduled_at).day}{" "}
                    {formatDate(showMinutes.scheduled_at).month}{" "}
                    {formatDate(showMinutes.scheduled_at).year}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => window.print()}
                    className="size-11 rounded-full bg-primary text-white flex items-center justify-center shadow-lg hover:scale-105 transition-all"
                  >
                    <Download size={20} />
                  </button>
                  <button
                    onClick={() => setShowMinutes(null)}
                    className="size-11 rounded-full bg-muted flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="p-8 md:p-12 overflow-y-auto custom-scrollbar flex-1 prose dark:prose-invert max-w-none">
                <div className="bg-primary/5 p-8 rounded-[32px] border border-primary/10 shadow-inner min-h-[300px]">
                  <p className="text-lg font-bold text-foreground leading-relaxed whitespace-pre-wrap">
                    {showMinutes.minutes}
                  </p>
                </div>
              </div>
              <div className="p-6 bg-muted/10 border-t border-border text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  أرشيف مجلس السيف الرقمي — {new Date().getFullYear()}م
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-card border border-border rounded-[40px] w-full max-w-xl max-h-[90dvh] overflow-y-auto shadow-2xl p-6 md:p-8 space-y-6"
              dir="rtl"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-2xl font-black tracking-tight text-primary">
                    {editing ? "تعديل اللقاء" : "جدولة لقاء عائلي"}
                  </h3>
                </div>
                <button
                  onClick={() => setShowForm(false)}
                  className="size-10 rounded-full bg-muted/50 flex items-center justify-center hover:bg-primary hover:text-white transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={submitForm} className="space-y-4">
                <div className="grid gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-primary uppercase tracking-widest mr-2 block">
                      عنوان الاجتماع
                    </label>
                    <input
                      value={fTitle}
                      onChange={(e) => setFTitle(e.target.value)}
                      required
                      placeholder="مثال: اجتماع العائلة السنوي"
                      className="w-full h-12 bg-muted/30 border border-border rounded-xl px-5 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-primary uppercase tracking-widest mr-2 block">
                      وصف موجز
                    </label>
                    <textarea
                      value={fDesc}
                      onChange={(e) => setFDesc(e.target.value)}
                      rows={2}
                      placeholder="ماذا سنناقش في هذا اللقاء؟"
                      className="w-full bg-muted/30 border border-border rounded-xl px-5 py-3 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-primary uppercase tracking-widest mr-2 block">
                        موعد اللقاء
                      </label>
                      <input
                        type="datetime-local"
                        value={fWhen}
                        onChange={(e) => setFWhen(e.target.value)}
                        required
                        className="w-full h-12 bg-muted/30 border border-border rounded-xl px-5 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-primary uppercase tracking-widest mr-2 block">
                        المدة (دقيقة)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={fDuration}
                        onChange={(e) => setFDuration(e.target.value)}
                        placeholder="60"
                        className="w-full h-12 bg-muted/30 border border-border rounded-xl px-5 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-primary uppercase tracking-widest mr-2 block">
                      مكان الاجتماع / الرابط
                    </label>
                    <input
                      value={fLocation}
                      onChange={(e) => setFLocation(e.target.value)}
                      placeholder="مثال: مجلس العائلة"
                      className="w-full h-12 bg-muted/30 border border-border rounded-xl px-5 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm mb-2"
                    />
                    <input
                      type="url"
                      value={fLocationUrl}
                      onChange={(e) => setFLocationUrl(e.target.value)}
                      placeholder="رابط الموقع على الخريطة"
                      className="w-full h-12 bg-muted/30 border border-border rounded-xl px-5 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm"
                    />
                  </div>

                  {editing && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-primary uppercase tracking-widest mr-2 block">
                        محضر الاجتماع (القرارات والنتائج)
                      </label>
                      <textarea
                        value={fMinutes}
                        onChange={(e) => setFMinutes(e.target.value)}
                        rows={4}
                        placeholder="اكتب هنا ما تم الاتفاق عليه والقرارات التي اتخذت..."
                        className="w-full bg-muted/30 border border-border rounded-xl px-5 py-3 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm resize-none custom-scrollbar"
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={submitting || !canManage}
                    className={cn(
                      "flex-1 py-4 rounded-2xl text-base font-black shadow-xl flex items-center justify-center gap-3 disabled:opacity-50",
                      canManage ? "btn-gold" : "bg-muted text-muted-foreground cursor-not-allowed",
                    )}
                  >
                    {submitting ? (
                      <div className="size-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                    ) : (
                      <div className="flex flex-col items-center">
                        <span>{editing ? "حفظ التعديلات" : "تأكيد الجدولة"}</span>
                        {!canManage && (
                          <span className="text-[11px] opacity-70">غير مصرح لك بالإدارة</span>
                        )}
                      </div>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-8 py-4 rounded-2xl bg-muted/50 font-black text-sm text-muted-foreground hover:bg-muted transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
