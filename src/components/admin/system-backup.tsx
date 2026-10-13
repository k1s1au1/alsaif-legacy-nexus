import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, DatabaseBackup, Download, ShieldCheck, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { createFullBackup } from "@/lib/api/backup.functions";
import type { BackupResult } from "@/lib/api/backup.functions";
import { saveBackupFile } from "@/lib/save-backup";

type BackupRow = {
  id: string;
  actor_id: string;
  created_at: string;
  rows_count: number;
  tables_count: number;
  bytes_size: number;
};

const formatSize = (bytes: number) => {
  if (!bytes) return "0 ك.ب";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(2)} م.ب` : `${Math.max(1, Math.round(bytes / 1024))} ك.ب`;
};

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));

export function SystemBackup() {
  const runBackup = useServerFn(createFullBackup);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [readyBackup, setReadyBackup] = useState<BackupResult | null>(null);
  const [history, setHistory] = useState<BackupRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from("system_backups" as any)
      .select("id, actor_id, created_at, rows_count, tables_count, bytes_size")
      .order("created_at", { ascending: false })
      .limit(10);
    const rows = (data ?? []) as unknown as BackupRow[];
    setHistory(rows);
    const ids = Array.from(new Set(rows.map((r) => r.actor_id)));
    if (ids.length) {
      const { data: people } = await supabase
        .from("profiles")
        .select("id, arabic_name, full_name")
        .in("id", ids);
      const map: Record<string, string> = {};
      for (const p of people ?? []) {
        map[(p as any).id] = (p as any).arabic_name || (p as any).full_name || "عضو";
      }
      setNames(map);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleBackup = async () => {
    if (busy || saving) return;
    if (!password.trim()) {
      toast.error("أدخل كلمة المرور للتأكيد قبل بدء النسخ");
      return;
    }
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email;
      if (!email) throw new Error("تعذر التحقق من الحساب الحالي");

      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw new Error("كلمة المرور غير صحيحة");

      toast.info("جاري تجهيز النسخة الاحتياطية، قد تستغرق دقيقة...");
      const result = await runBackup({ data: undefined as never });

      setReadyBackup(result);
      setPassword("");
      toast.info("النسخة جاهزة. اضغط حفظ النسخة على جهازي واختر مكان الحفظ.");
      void loadHistory().catch(() => {});
    } catch (err: any) {
      toast.error(err?.message || "تعذر إنشاء النسخة الاحتياطية");
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!readyBackup || busy || saving) return;
    setSaving(true);
    try {
      const outcome = await saveBackupFile(readyBackup);
      if (outcome === "saved") {
        toast.success("تم حفظ النسخة في المكان الذي اخترته.");
      } else if (outcome === "download-started") {
        toast.info("بدأ تنزيل النسخة. تابع اكتمالها في تنزيلات المتصفح.");
      } else {
        toast.info("أُلغيت عملية الحفظ. النسخة ما زالت جاهزة لإعادة المحاولة.");
      }
    } catch (err: any) {
      toast.error(err?.message || "تعذر حفظ النسخة. يمكنك إعادة المحاولة من زر الحفظ.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="animate-fade-up space-y-6" dir="rtl">
      <div className="space-y-1">
        <h3 className="text-xl font-black text-primary tracking-tight">النسخ الاحتياطي الشامل</h3>
        <p className="text-sm font-bold text-muted-foreground opacity-60">
          تنزيل نسخة كاملة من بيانات الموقع: الحسابات، الأعضاء، المناسبات، الاجتماعات، الرحلات،
          المهام، المشاركات، المحادثات، شجرة العائلة، المالية، والطلبات، مع فهرس كامل للصور والملفات.
        </p>
      </div>

      <div className="rounded-[32px] border-2 border-primary/15 bg-card p-6 space-y-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="size-12 rounded-2xl bg-primary/10 grid place-items-center text-primary shrink-0">
            <DatabaseBackup className="size-6" />
          </div>
          <div className="space-y-1">
            <p className="font-black text-foreground">ملف واحد مضغوط يحتوي كل شيء</p>
            <p className="text-sm font-bold text-muted-foreground opacity-70">
              يحتوي الملف على جميع البيانات بصيغتي JSON و CSV القابلة للفتح في Excel، وروابط تحميل
              كل الصور والمستندات صالحة لمدة سبعة أيام.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm font-bold text-primary">
          <ShieldCheck className="size-4" />
          للتأكيد الأمني، أدخل كلمة مرور حسابك قبل إنشاء النسخة.
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="كلمة مرور حسابك"
            autoComplete="current-password"
            className="rounded-2xl font-bold"
            disabled={busy || saving}
          />
          <Button
            onClick={handleBackup}
            disabled={busy || saving}
            className="rounded-2xl font-black gap-2 sm:w-auto w-full"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {busy ? "جاري التجهيز..." : "إنشاء النسخة"}
          </Button>
        </div>
        {readyBackup && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3" role="status">
            <p className="font-black text-primary">النسخة جاهزة للحفظ</p>
            <p className="text-sm font-bold text-muted-foreground">
              {readyBackup.rowsCount} سجل · {formatSize(readyBackup.bytesSize)}
            </p>
            <p className="text-xs text-muted-foreground break-all" dir="ltr">
              {readyBackup.fileName}
            </p>
            <Button
              onClick={handleSave}
              disabled={busy || saving}
              className="w-full rounded-2xl font-black gap-2"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {saving ? "جاري الحفظ..." : "حفظ النسخة على جهازي"}
            </Button>
            <p className="text-xs text-muted-foreground">
              تظل النسخة جاهزة لإعادة الحفظ ما دمت في هذه الصفحة.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-black text-foreground">
          <History className="size-4 text-primary" />
          سجل عمليات النسخ الاحتياطي
        </div>
        <p className="text-xs text-muted-foreground">
          السجل يوثّق إنشاء النسخ. حفظ الملف على جهازك يتم من زر الحفظ بعد إنشائه.
        </p>
        {history.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground italic bg-muted/20 rounded-[28px] border-2 border-dashed">
            لم يتم تنفيذ أي نسخة احتياطية بعد.
          </div>
        ) : (
          <div className="grid gap-2">
            {history.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-primary/10 bg-card px-4 py-3"
              >
                <span className="font-black text-sm text-foreground">
                  {names[row.actor_id] || "عضو"}
                </span>
                <span className="text-xs font-bold text-muted-foreground">
                  {formatDate(row.created_at)}
                </span>
                <span className="text-xs font-bold text-primary">
                  {row.rows_count} سجل · {formatSize(row.bytes_size)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
