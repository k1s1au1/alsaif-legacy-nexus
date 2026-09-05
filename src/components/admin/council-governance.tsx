import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Crown, Loader2, Search, Shield, ShieldCheck, Users, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  normalizeSection,
  roleLabel,
  sectionHeadLabel,
  sectionLabel,
  useUserRole,
  type AppRole,
  type Section,
} from "@/hooks/use-user-role";

/** Sections managed through section_heads (finance included when present in DB). */
const GOVERNED_SECTIONS: Section[] = [
  "meetings",
  "trips",
  "occasions",
  "tasks",
  "news",
  "community",
  "faith",
  "heritage",
  "finance",
];

const BASE_ROLES: { value: AppRole; label: string; hint: string }[] = [
  { value: "chairman", label: "رئيس المجلس", hint: "أعلى سلطة في الديوان" },
  { value: "vice_chairman", label: "نائب رئيس المجلس", hint: "التشغيل اليومي وإدارة الأقسام" },
  { value: "technical_admin", label: "المسؤول التقني", hint: "الأدوات التقنية فقط" },
  { value: "member", label: "عضو", hint: "صلاحيات العضو الأساسية" },
  { value: "guest", label: "ضيف المجلس", hint: "وصول محدود للاطلاع" },
];

type MemberRow = {
  id: string;
  name: string;
  role: AppRole;
  sections: Section[];
};

const primaryOf = (roles: string[]): AppRole => {
  if (roles.includes("chairman")) return "chairman";
  if (roles.includes("vice_chairman")) return "vice_chairman";
  if (roles.includes("technical_admin") || roles.includes("admin")) return "technical_admin";
  if (roles.includes("guest")) return "guest";
  return "member";
};

export function CouncilGovernance() {
  const { userId: meId, isChairman, isViceChairman } = useUserRole();
  const canManageRoles = isChairman;
  const canManageHeads = isChairman || isViceChairman;

  const [rows, setRows] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: profs, error: pErr }, { data: roles }, { data: heads }] = await Promise.all([
      supabase.from("profiles").select("id, arabic_name, full_name").order("full_name"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("section_heads" as any).select("user_id, section"),
    ]);

    if (pErr) {
      toast.error("تعذر تحميل سجل الأعضاء");
      setLoading(false);
      return;
    }

    const rolesBy = new Map<string, string[]>();
    (roles || []).forEach((r: any) => {
      rolesBy.set(r.user_id, [...(rolesBy.get(r.user_id) || []), r.role]);
    });
    const headsBy = new Map<string, Section[]>();
    ((heads as any[]) || []).forEach((h: any) => {
      const s = normalizeSection(String(h.section));
      headsBy.set(h.user_id, [...(headsBy.get(h.user_id) || []), s]);
    });

    setRows(
      (profs || []).map((p: any) => ({
        id: p.id,
        name: p.arabic_name || p.full_name || "عضو",
        role: primaryOf(rolesBy.get(p.id) || []),
        sections: headsBy.get(p.id) || [],
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const chairman = rows.find((r) => r.role === "chairman") || null;
  const vice = rows.find((r) => r.role === "vice_chairman") || null;
  const techAdmins = rows.filter((r) => r.role === "technical_admin");

  const headsBySection = useMemo(() => {
    const map = new Map<Section, MemberRow[]>();
    GOVERNED_SECTIONS.forEach((s) => {
      map.set(
        s,
        rows.filter((r) => r.sections.includes(s)),
      );
    });
    return map;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return rows.slice(0, 40);
    return rows.filter((r) => r.name.includes(q));
  }, [rows, search]);

  const setRole = async (uid: string, role: AppRole) => {
    if (!canManageRoles) {
      toast.error("رئيس المجلس فقط يمكنه تعديل الرتب الأساسية");
      return;
    }
    if (uid === meId && role !== "chairman") {
      toast.error("لا يمكنك إزالة رتبتك كرئيس مجلس");
      return;
    }
    setBusy(uid);
    const { error } = await (supabase.rpc as any)("assign_user_role", {
      _user_id: uid,
      _role: role,
    });
    setBusy(null);
    if (error) {
      toast.error(error.message || "تعذر تحديث الرتبة");
      return;
    }
    toast.success("تم تحديث الرتبة وتسجيل العملية");
    await load();
  };

  const toggleHead = async (uid: string, section: Section, currently: boolean) => {
    if (!canManageHeads) {
      toast.error("تعيين مسؤولي الأقسام متاح لرئيس المجلس ونائبه فقط");
      return;
    }
    setBusy(uid + section);
    const { error } = currently
      ? await supabase
          .from("section_heads" as any)
          .delete()
          .eq("user_id", uid)
          .eq("section", section)
      : await supabase
          .from("section_heads" as any)
          .insert({ user_id: uid, section } as any);
    setBusy(null);
    if (error) {
      toast.error(error.message || "تعذر تحديث مسؤولية القسم");
      return;
    }
    toast.success(currently ? "تم إزالة مسؤولية القسم" : "تم تعيين مسؤول القسم");
    await load();
  };

  if (loading) {
    return (
      <div className="p-16 flex items-center justify-center text-muted-foreground">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <section className="space-y-8 animate-fade-up">
      {/* Council leadership cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <LeaderCard
          icon={Crown}
          title="رئيس المجلس"
          name={chairman?.name || "غير معيّن"}
          note="أعلى سلطة: إدارة الرتب ومسؤولي الأقسام وجميع الأقسام والأرشيف الإداري والسجل."
          tone="gold"
        />
        <LeaderCard
          icon={ShieldCheck}
          title="نائب رئيس المجلس"
          name={vice?.name || "غير معيّن"}
          note="إدارة التشغيل اليومي والأقسام ومسؤولي الأقسام، دون تعديل الرتب الأساسية."
          tone="primary"
        />
        <LeaderCard
          icon={Wrench}
          title="المسؤول التقني"
          name={techAdmins.length ? techAdmins.map((t) => t.name).join("، ") : "غير معيّن"}
          note="أدوات تقنية فقط: البلاغات، الإعدادات، حالة النظام. لا يدير الرتب ولا محتوى الأقسام."
          tone="muted"
        />
      </div>

      {/* Section heads overview */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Users className="size-5 text-primary" />
          <h3 className="text-lg font-black text-primary tracking-tight">مسؤولو الأقسام</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {GOVERNED_SECTIONS.map((s) => {
            const list = headsBySection.get(s) || [];
            return (
              <article
                key={s}
                className="rounded-3xl border-2 border-border/40 bg-card p-5 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <b className="text-sm font-black text-primary">
                    {s === "heritage" ? "الإرث وشجرة العائلة" : sectionLabel(s)}
                  </b>
                  <em
                    className={cn(
                      "text-[11px] font-black not-italic px-2 py-1 rounded-full",
                      list.length ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {list.length}
                  </em>
                </div>
                <p className="text-[11px] font-bold text-muted-foreground opacity-70">
                  {sectionHeadLabel(s)}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {list.length ? (
                    list.map((m) => (
                      <span
                        key={m.id}
                        className="text-xs font-black px-3 py-1.5 rounded-full bg-muted text-foreground"
                      >
                        {m.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs font-bold text-muted-foreground italic">
                      لا يوجد مسؤول معيّن
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* Assignment table */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Shield className="size-5 text-primary" />
          <h3 className="text-lg font-black text-primary tracking-tight">
            تعيين الرتب ومسؤوليات الأقسام
          </h3>
        </div>
        {!canManageRoles && !canManageHeads && (
          <div className="rounded-3xl border-2 border-dashed p-6 text-sm font-bold text-muted-foreground">
            العرض فقط — لا تملك صلاحية تعديل الرتب أو مسؤولي الأقسام.
          </div>
        )}
        <div className="relative">
          <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث عن عضو بالاسم..."
            className="w-full h-14 pr-12 pl-6 rounded-3xl bg-card border-2 border-border/40 focus:border-primary transition-all font-bold"
          />
        </div>

        <div className="grid gap-4">
          {filtered.map((m) => (
            <article
              key={m.id}
              className="rounded-[28px] border-2 border-border/40 bg-card p-5 space-y-4"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                  <b className="text-base font-black text-primary">{m.name}</b>
                  <p className="text-xs font-bold text-muted-foreground">
                    الرتبة الحالية: {roleLabel(m.role)}
                    {m.sections.length > 0 && (
                      <>
                        {" · "}
                        {m.sections
                          .map((s) => (s === "heritage" ? "الإرث وشجرة العائلة" : sectionLabel(s)))
                          .join("، ")}
                      </>
                    )}
                  </p>
                </div>
                {busy === m.id && <Loader2 className="animate-spin size-4 text-primary" />}
              </div>

              <div className="space-y-2">
                <small className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                  الرتبة الأساسية
                </small>
                <div className="flex flex-wrap gap-2">
                  {BASE_ROLES.map((r) => {
                    const active = m.role === r.value;
                    const selfDemote = m.id === meId && r.value !== "chairman";
                    const disabled = !canManageRoles || active || selfDemote;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        title={r.hint}
                        disabled={disabled}
                        onClick={() => setRole(m.id, r.value)}
                        className={cn(
                          "px-4 py-2 rounded-full text-xs font-black border-2 transition-all",
                          active
                            ? "bg-primary text-white border-primary"
                            : "bg-muted/40 border-border text-foreground hover:border-primary",
                          disabled && !active && "opacity-40 cursor-not-allowed",
                        )}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <small className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                  مسؤوليات الأقسام
                </small>
                <div className="flex flex-wrap gap-2">
                  {GOVERNED_SECTIONS.map((s) => {
                    const active = m.sections.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={!canManageHeads || busy === m.id + s}
                        onClick={() => toggleHead(m.id, s, active)}
                        className={cn(
                          "px-4 py-2 rounded-full text-xs font-black border-2 transition-all",
                          active
                            ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-700 dark:text-emerald-400"
                            : "bg-muted/40 border-border text-muted-foreground hover:border-primary",
                          !canManageHeads && "opacity-40 cursor-not-allowed",
                        )}
                      >
                        {s === "heritage" ? "الإرث وشجرة العائلة" : sectionLabel(s)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </article>
          ))}
          {filtered.length === 0 && (
            <div className="p-14 text-center rounded-[32px] border-2 border-dashed text-muted-foreground italic">
              لا توجد نتائج مطابقة.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function LeaderCard({
  icon: Icon,
  title,
  name,
  note,
  tone,
}: {
  icon: any;
  title: string;
  name: string;
  note: string;
  tone: "gold" | "primary" | "muted";
}) {
  return (
    <article
      className={cn(
        "rounded-[28px] border-2 p-6 space-y-3",
        tone === "gold" && "border-amber-500/40 bg-amber-500/5",
        tone === "primary" && "border-primary/30 bg-primary/5",
        tone === "muted" && "border-border/50 bg-card",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "size-11 rounded-2xl flex items-center justify-center",
            tone === "gold" ? "bg-amber-500/15 text-amber-600" : "bg-primary/10 text-primary",
          )}
        >
          <Icon size={20} />
        </span>
        <div>
          <small className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
            {title}
          </small>
          <b className="block text-base font-black text-primary">{name}</b>
        </div>
      </div>
      <p className="text-xs font-bold text-muted-foreground opacity-75 leading-relaxed">{note}</p>
    </article>
  );
}
