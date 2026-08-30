import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Loader2, ShieldAlert, X } from "lucide-react";
import { CALENDAR_LABEL, GENDER_LABEL } from "@/lib/birth-info";

type ChangeRequest = {
  id: string;
  user_id: string;
  changes: Record<string, any>;
  current_values: Record<string, any>;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  member?: { arabic_name: string | null; full_name: string | null } | null;
};

const FIELD_LABEL: Record<string, string> = {
  arabic_name: "الاسم بالعربية",
  full_name: "الاسم الكامل",
  first_name: "الاسم الأول",
  father_name: "اسم الأب",
  grandfather_name: "اسم الجد",
  gender: "الجنس",
  birth_calendar: "نوع التقويم",
  birth_date: "تاريخ الميلاد (ميلادي)",
  birth_date_hijri: "تاريخ الميلاد (هجري)",
};

function fmt(field: string, value: any) {
  if (value === null || value === undefined || value === "") return "—";
  if (field === "gender") return GENDER_LABEL[value as "male" | "female"] ?? String(value);
  if (field === "birth_calendar")
    return CALENDAR_LABEL[value as "hijri" | "gregorian"] ?? String(value);
  return String(value);
}

export function ProfileChangeRequests() {
  const [list, setList] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profile_change_requests" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("تعذر تحميل طلبات تعديل البيانات");
      setLoading(false);
      return;
    }
    const rows = ((data as any[]) || []) as ChangeRequest[];
    const ids = Array.from(new Set(rows.map((r) => r.user_id)));
    const map = new Map<string, any>();
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, arabic_name, full_name")
        .in("id", ids);
      (profs || []).forEach((p: any) => map.set(p.id, p));
    }
    setList(rows.map((r) => ({ ...r, member: map.get(r.user_id) ?? null })));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const review = async (id: string, approve: boolean) => {
    if (!approve && !(notes[id] || "").trim()) {
      toast.error("يرجى كتابة سبب الرفض");
      return;
    }
    setBusy(id);
    const { error } = await supabase.rpc("review_profile_change_request" as any, {
      _id: id,
      _approve: approve,
      _note: notes[id] || null,
    });
    setBusy(null);
    if (error) {
      toast.error(error.message || "تعذر تنفيذ المراجعة");
      return;
    }
    toast.success(approve ? "تم اعتماد التعديل وتحديث بيانات العضو" : "تم رفض الطلب");
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 opacity-50">
        <Loader2 className="size-7 animate-spin text-primary" />
      </div>
    );
  }

  const pending = list.filter((r) => r.status === "pending");
  const history = list.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-8" dir="rtl">
      <div className="flex items-start gap-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 text-amber-700 dark:text-amber-400">
        <ShieldAlert className="size-4 mt-0.5 shrink-0" />
        <p className="text-xs font-bold leading-relaxed">
          بيانات الهوية مقفلة على الأعضاء؛ أي تعديل عليها يمر عبر هذه الطلبات لمنع انتحال الهوية.
        </p>
      </div>

      {pending.length === 0 && (
        <p className="text-sm font-bold text-muted-foreground text-center py-10">
          لا توجد طلبات تعديل قيد المراجعة.
        </p>
      )}

      {pending.map((r) => (
        <div key={r.id} className="card-surface p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-4">
            <h4 className="text-base font-black text-primary">
              {r.member?.arabic_name || r.member?.full_name || "عضو"}
            </h4>
            <span className="text-[11px] font-bold text-muted-foreground">
              {new Date(r.created_at).toLocaleDateString("ar-SA")}
            </span>
          </div>

          <div className="space-y-2">
            {Object.keys(r.changes).map((field) => (
              <div
                key={field}
                className="flex flex-wrap items-center gap-3 text-sm font-bold bg-muted/30 rounded-xl px-4 py-3"
              >
                <span className="text-muted-foreground">{FIELD_LABEL[field] || field}:</span>
                <span className="line-through opacity-60">
                  {fmt(field, r.current_values?.[field])}
                </span>
                <span className="text-muted-foreground">←</span>
                <span className="text-primary font-black">{fmt(field, r.changes[field])}</span>
              </div>
            ))}
          </div>

          {r.reason && (
            <p className="text-xs font-bold text-muted-foreground leading-relaxed">
              سبب الطلب: {r.reason}
            </p>
          )}

          <input
            value={notes[r.id] || ""}
            onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
            placeholder="ملاحظة المراجعة (مطلوبة عند الرفض)"
            maxLength={300}
            className="w-full h-12 px-4 bg-muted/30 border border-border rounded-xl font-bold text-sm focus:outline-none focus:border-primary"
          />

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy === r.id}
              onClick={() => review(r.id, true)}
              className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center gap-2 hover:opacity-90 transition"
            >
              <Check className="size-4" /> اعتماد التعديل
            </button>
            <button
              type="button"
              disabled={busy === r.id}
              onClick={() => review(r.id, false)}
              className="px-6 py-3 rounded-xl bg-rose-600 text-white font-black text-xs flex items-center gap-2 hover:opacity-90 transition"
            >
              <X className="size-4" /> رفض
            </button>
          </div>
        </div>
      ))}

      {history.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-black uppercase tracking-[0.2em] text-gold-primary">
            سجل الطلبات
          </h4>
          {history.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 px-4 py-3"
            >
              <span className="text-sm font-black text-primary">
                {r.member?.arabic_name || r.member?.full_name || "عضو"}
              </span>
              <span className="text-xs font-bold text-muted-foreground">
                {Object.keys(r.changes)
                  .map((f) => FIELD_LABEL[f] || f)
                  .join("، ")}
              </span>
              <span
                className={
                  r.status === "approved"
                    ? "text-xs font-black text-emerald-600"
                    : "text-xs font-black text-rose-600"
                }
              >
                {r.status === "approved" ? "معتمد" : "مرفوض"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
