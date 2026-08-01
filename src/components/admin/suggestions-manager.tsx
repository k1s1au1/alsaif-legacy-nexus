import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Inbox, Loader2, Trash2, Clock, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type Status = "new" | "reviewing" | "accepted" | "rejected";

type Row = {
  id: string;
  content: string;
  status: Status;
  created_at: string;
};

const STATUSES: { key: Status; label: string; classes: string }[] = [
  { key: "new", label: "جديد", classes: "bg-sky-500/10 text-sky-600 border-sky-500/20" },
  { key: "reviewing", label: "قيد المراجعة", classes: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  { key: "accepted", label: "مقبول", classes: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  { key: "rejected", label: "مرفوض", classes: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
];

const FILTERS: { key: Status | "all"; label: string }[] = [
  { key: "all", label: "الكل" },
  ...STATUSES.map((s) => ({ key: s.key, label: s.label })),
];

export function SuggestionsManager() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("anonymous_suggestions")
      .select("id, content, status, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error("فشل جلب المقترحات", { description: error.message });
    else setRows((data as Row[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const setStatus = async (id: string, status: Status) => {
    setBusy(id);
    const { error } = await supabase.from("anonymous_suggestions").update({ status }).eq("id", id);
    setBusy(null);
    if (error) {
      toast.error("فشل تحديث الحالة", { description: error.message });
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    toast.success("تم تحديث حالة المقترح");
  };

  const remove = async (id: string) => {
    if (!confirm("هل تريد حذف هذا المقترح؟")) return;
    const { error } = await supabase.from("anonymous_suggestions").delete().eq("id", id);
    if (error) {
      toast.error("فشل الحذف", { description: error.message });
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
    toast.success("تم الحذف");
  };

  const visible = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  return (
    <section className="space-y-8 animate-fade-up" dir="rtl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="size-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
            <Inbox className="size-5" />
          </div>
          <h3 className="text-2xl font-black text-primary">مقترحات الأعضاء المجهولة</h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map((f) => {
            const count = f.key === "all" ? rows.length : rows.filter((r) => r.status === f.key).length;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "px-5 py-2 rounded-full text-xs font-black transition-all border",
                  filter === f.key
                    ? "bg-primary text-white border-primary shadow-lg"
                    : "bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted",
                )}
              >
                {f.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center opacity-40">
          <Loader2 className="animate-spin size-10 mx-auto mb-4" />
          <p className="font-black">جاري جلب المقترحات...</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="card-surface p-20 text-center text-muted-foreground border-dashed italic">
          لا توجد مقترحات في هذا التصنيف.
        </div>
      ) : (
        <div className="grid gap-6">
          <AnimatePresence initial={false}>
            {visible.map((s) => {
              const meta = STATUSES.find((x) => x.key === s.status) ?? STATUSES[0];
              return (
                <motion.div
                  key={s.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="card-surface p-8 space-y-6"
                >
                  <div className="flex justify-between items-start gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <MessageSquareText size={20} className="text-indigo-500" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">
                        مقترح مجهول
                      </span>
                      <span
                        className={cn(
                          "px-3 py-1 rounded-full border text-[10px] font-black",
                          meta.classes,
                        )}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest">
                      <Clock size={12} />
                      {new Date(s.created_at).toLocaleDateString("ar-SA", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </div>
                  </div>

                  <p className="text-lg font-bold text-foreground leading-relaxed border-r-4 border-indigo-500/20 pr-4">
                    {s.content}
                  </p>

                  <div className="flex items-center justify-between gap-3 pt-4 border-t border-border/40 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {STATUSES.map((st) => (
                        <button
                          key={st.key}
                          disabled={busy === s.id || s.status === st.key}
                          onClick={() => setStatus(s.id, st.key)}
                          className={cn(
                            "px-4 py-2 rounded-xl text-xs font-black border transition-all disabled:opacity-40",
                            s.status === st.key ? st.classes : "bg-muted/30 border-border/50 hover:bg-muted",
                          )}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => remove(s.id)}
                      className="p-3 rounded-xl bg-rose-500/5 text-rose-500 hover:bg-rose-500 hover:text-white transition-all"
                      title="حذف المقترح"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
