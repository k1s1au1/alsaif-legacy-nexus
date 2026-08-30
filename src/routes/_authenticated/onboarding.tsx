import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { BirthInfoFields } from "@/components/birth-info-fields";
import { buildBirthPayload, validateBirthDate, validateGender, type BirthCalendar, type Gender } from "@/lib/birth-info";

export const Route = createFileRoute("/_authenticated/onboarding")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "إكمال الملف الشخصي — السيف" },
      { name: "description", content: "أكمل اسمك الثلاثي ورقم جوالك والجنس وتاريخ الميلاد قبل المتابعة." },
    ],
  }),
  component: OnboardingPage,
});

const nameSchema = z
  .string()
  .trim()
  .min(2, { message: "يجب أن يكون حرفين على الأقل" })
  .max(40, { message: "طويل جداً" });

const phoneSchema = z
  .string()
  .trim()
  .min(8, { message: "رقم الجوال قصير جداً" })
  .max(20, { message: "رقم الجوال طويل جداً" })
  .regex(/^[\d\s+\-()]+$/, { message: "أرقام فقط" });

function OnboardingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState("");
  const [first, setFirst] = useState("");
  const [father, setFather] = useState("");
  const [grand, setGrand] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [calendar, setCalendar] = useState<BirthCalendar>("gregorian");
  const [birthDate, setBirthDate] = useState("");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      setUserId(u.user.id);
      const { data: pRaw } = await supabase.rpc("get_my_profile" as any).maybeSingle();
      const p = pRaw as {
        first_name: string | null;
        father_name: string | null;
        grandfather_name: string | null;
        phone: string | null;
        gender: Gender | null;
        birth_calendar: BirthCalendar | null;
        birth_date: string | null;
        birth_date_hijri: string | null;
      } | null;
      if (p?.first_name && p?.father_name && p?.grandfather_name && p?.gender && (p?.birth_date || p?.birth_date_hijri)) {
        navigate({ to: "/dashboard", replace: true });
        return;
      }
      setFirst(p?.first_name ?? "");
      setFather(p?.father_name ?? "");
      setGrand(p?.grandfather_name ?? "");
      setPhone(p?.phone ?? "");
      const cal: BirthCalendar = p?.birth_calendar === "hijri" ? "hijri" : "gregorian";
      setGender(p?.gender ?? null);
      setCalendar(cal);
      setBirthDate((cal === "hijri" ? p?.birth_date_hijri : p?.birth_date) ?? "");
      setLoading(false);
    })();
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    for (const [v, label] of [
      [first, "الاسم الأول"],
      [father, "اسم الأب"],
      [grand, "اسم الجد"],
    ] as const) {
      const r = nameSchema.safeParse(v);
      if (!r.success) {
        toast.error(`${label}: ${r.error.issues[0].message}`);
        return;
      }
    }
    const phoneParsed = phoneSchema.safeParse(phone);
    if (!phoneParsed.success) {
      toast.error(`رقم الجوال: ${phoneParsed.error.issues[0].message}`);
      return;
    }
    const genderError = validateGender(gender);
    if (genderError) {
      toast.error(genderError);
      return;
    }
    const birthError = validateBirthDate(calendar, birthDate);
    if (birthError) {
      toast.error(birthError);
      return;
    }
    setSaving(true);
    const f = first.trim();
    const fa = father.trim();
    const g = grand.trim();
    const arabic_name = `${f} ${fa} ${g}`;
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: f,
        father_name: fa,
        grandfather_name: g,
        arabic_name,
        phone: phone.trim() || null,
        ...buildBirthPayload(gender, calendar, birthDate),
      } as any)
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast.error("تعذر الحفظ، حاول مرة أخرى");
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-gold-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center px-4">
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 30% 20%, rgba(191,161,93,0.18), transparent 50%), radial-gradient(circle at 80% 80%, rgba(191,161,93,0.10), transparent 50%)",
        }}
      />
      <div className="relative w-full max-w-md card-surface p-10 animate-fade-up">
        <div className="text-center mb-8">
          <div className="size-14 mx-auto rounded-xl bg-gold-primary/10 ring-1 ring-gold-primary/30 grid place-items-center mb-5">
            <span className="text-gold-primary text-2xl font-semibold">س</span>
          </div>
          <h1 className="text-2xl font-medium text-ivory tracking-tight">أكمل بياناتك</h1>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            رجاءً سجّل اسمك الثلاثي ورقم جوالك والجنس وتاريخ الميلاد قبل المتابعة لاستخدام المنصة.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="الاسم الأول" value={first} onChange={setFirst} placeholder="مثال: فيصل" />
          <Field label="اسم الأب" value={father} onChange={setFather} placeholder="مثال: عبدالله" />
          <Field label="اسم الجد" value={grand} onChange={setGrand} placeholder="مثال: السيف" />
          <Field
            label="رقم الجوال"
            value={phone}
            onChange={setPhone}
            placeholder="مثال: 055 123 4567"
          />
          <BirthInfoFields
            tone="dark"
            gender={gender}
            onGender={setGender}
            calendar={calendar}
            onCalendar={setCalendar}
            dateValue={birthDate}
            onDate={setBirthDate}
          />
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-gold-primary text-navy-base text-sm font-semibold rounded-lg hover:brightness-110 transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            متابعة
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm text-ivory placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-gold-primary/40 focus:border-gold-primary/40 transition"
      />
    </label>
  );
}
