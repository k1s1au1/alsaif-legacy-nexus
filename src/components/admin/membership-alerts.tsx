import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { UserPlus, CheckCircle2, XCircle, RefreshCw, Inbox, Clock } from "lucide-react";

type AlertRow = {
  id: string;
  first_name: string;
  father_name: string | null;
  grandfather_name: string | null;
  phone: string | null;
  email: string | null;
  status: "pending" | "approved" | "rejected" | string;
  created_at: string;
  updated_at: string | null;
  reviewed_at: string | null;
};

const FILTERS = [
  { key: "all", label: "الكل" },
  { key: "pending", label: "طلبات جديدة" },
  { key: "approved", label: "تمت الموافقة" },
  { key: "rejected", label: "مرفوضة" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `منذ ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} ساعة`;
  const d = Math.floor(h / 24);
  return `منذ ${d} يوم`;
}

const STATUS_META: Record<string, { label: string; icon: any; className: string }> = {
  pending: {
    label: "طلب عضوية جديد",
    icon: UserPlus,
    className: "bg-amber-500/10 text-amber-600",
  },
  approved: {
    label: "تمت الموافقة على العضوية",
    icon: CheckCircle2,
    className: "bg-emerald-500/10 text-emerald-600",
  },
  rejected: {
    label: "تم رفض طلب العضوية",
    icon: XCircle,
    className: "bg-rose-500/10 text-rose-600",
  },
};

export function MembershipAlerts({ canManage = false }: { canManage?: boolean }) {
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("account_requests")
      .select(
        "id,first_name,father_name,grandfather_name,phone,email,status,created_at,updated_at,reviewed_at",
      )
      .order("created_at", { ascending: false })
      .limit(80);
    setRows((data ?? []) as AlertRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`membership-alerts-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "account_requests" }, () =>
        load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const setStatus = async (id: string, status: "approved" | "rejected") => {
    setBusy(id);
    await supabase.from("account_requests").update({ status }).eq("id", id);
    setBusy(null);
    load();
  };

  const counts = {
    all: rows.length,
    pending: rows.filter((r) => r.status === "pending").length,
    approved: rows.filter((r) => r.status === "approved").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
  };

  const visible = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  return (
    <section className="space-y-6 animate-fade-up" dir="rtl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-5 py-2 rounded-full text-xs font-black transition-all border",
                filter === f.key
                  ? "bg-primary text-primary-foreground border-primary shadow-lg"
                  : "bg-card text-muted-foreground border-border hover:bg-muted",
              )}
            >
              {f.label} <span className="ms-2 opacity-60">{counts[f.key]}</span>
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" className="rounded-xl" onClick={load}>
          <RefreshCw size={14} className="ms-1" /> تحديث
        </Button>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center gap-3 text-muted-foreground">
          <RefreshCw size={26} className="animate-spin opacity-50" />
          <p className="text-sm font-bold">جاري تحميل الإشعارات…</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="py-20 flex flex-col items-center gap-3 text-muted-foreground bg-muted/20 rounded-[32px] border-2 border-dashed">
          <Inbox size={40} strokeWidth={1.2} />
          <p className="text-sm font-black">لا توجد إشعارات عضوية في هذا التصنيف.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((r) => {
            const meta = STATUS_META[r.status] ?? STATUS_META.pending;
            const Icon = meta.icon;
            const name = [r.first_name, r.father_name, r.grandfather_name]
              .filter(Boolean)
              .join(" ");
            const stamp = r.status === "pending" ? r.created_at : r.reviewed_at || r.updated_at;
            return (
              <li
                key={`${r.id}-${r.status}`}
                className="flex items-start gap-4 p-5 rounded-3xl bg-card border border-border shadow-sm"
              >
                <div
                  className={cn(
                    "size-12 rounded-2xl flex items-center justify-center shrink-0",
                    meta.className,
                  )}
                >
                  <Icon size={22} />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-black text-foreground">{meta.label}</p>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                      <Clock size={11} /> {timeAgo(stamp)}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-foreground/80">{name || "عضو جديد"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {r.email || "—"}
                    {r.phone ? ` · ${r.phone}` : ""}
                  </p>
                  {canManage && r.status === "pending" && (
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        size="sm"
                        className="rounded-xl"
                        disabled={busy === r.id}
                        onClick={() => setStatus(r.id, "approved")}
                      >
                        موافقة
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl text-rose-600"
                        disabled={busy === r.id}
                        onClick={() => setStatus(r.id, "rejected")}
                      >
                        رفض
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
