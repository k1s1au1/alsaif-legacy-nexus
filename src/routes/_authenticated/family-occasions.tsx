import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  Baby,
  Cake,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Flower2,
  GraduationCap,
  Heart,
  MapPin,
  MoonStar,
  PartyPopper,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/family-occasions")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "مناسبات العائلة — السيف" },
      { name: "description", content: "مناسبات العائلة ودعواتها في مكان واحد." },
    ],
  }),
  component: FamilyOccasionsPage,
});

type OccasionType =
  | "wedding"
  | "newborn"
  | "condolence"
  | "graduation"
  | "birthday"
  | "gathering"
  | "eid"
  | "engagement"
  | "other";

type Occasion = {
  id: string;
  type: OccasionType;
  design: number;
  title: string;
  date: string;
  time: string;
  location: string;
  details: string;
};

type OccasionTypeMeta = {
  key: OccasionType;
  title: string;
  icon: typeof Heart;
};

const TYPE_OPTIONS: OccasionTypeMeta[] = [
  { key: "wedding", title: "زواج / ملكة", icon: Heart },
  { key: "newborn", title: "مولود", icon: Baby },
  { key: "condolence", title: "عزاء", icon: Flower2 },
  { key: "graduation", title: "تخرج", icon: GraduationCap },
  { key: "birthday", title: "عيد ميلاد", icon: Cake },
  { key: "gathering", title: "عزيمة / لمة", icon: Users },
  { key: "eid", title: "عيد / مناسبة موسمية", icon: MoonStar },
  { key: "engagement", title: "خطوبة", icon: Heart },
  { key: "other", title: "مناسبة أخرى", icon: PartyPopper },
];

const STORAGE_KEY = "alsaif:family-occasions";

function getTypeMeta(type: OccasionType) {
  return TYPE_OPTIONS.find((item) => item.key === type) ?? TYPE_OPTIONS[0];
}

function buildDefaultTitle(type: OccasionType) {
  const labels: Record<OccasionType, string> = {
    wedding: "دعوة زواج",
    newborn: "بشارة مولود",
    condolence: "تعزية",
    graduation: "حفل تخرج",
    birthday: "عيد ميلاد",
    gathering: "عزيمة عائلية",
    eid: "مناسبة موسمية",
    engagement: "دعوة خطوبة",
    other: "مناسبة عائلية",
  };
  return labels[type];
}

function TemplatePreview({ type, design, selected = false }: { type: OccasionType; design: number; selected?: boolean }) {
  const meta = getTypeMeta(type);
  const Icon = meta.icon;
  const variant = design === 1 ? "light" : design === 2 ? "dark" : "botanical";

  return (
    <div
      className={`relative aspect-[3/5] w-full overflow-hidden rounded-[22px] border shadow-sm transition-all ${
        selected ? "border-primary ring-2 ring-primary/20" : "border-border"
      } ${variant === "dark" ? "bg-[var(--nav-bg,var(--primary))] text-white" : "bg-[#fffdf8] text-foreground"}`}
    >
      {variant === "light" && (
        <>
          <div className="absolute inset-[10px] rounded-[16px] border border-[color:var(--gold-primary)]/40" />
          <div className="absolute -right-8 -top-8 size-24 rounded-full border border-[color:var(--gold-primary)]/20" />
          <div className="absolute -bottom-10 -left-10 size-28 rounded-full border border-[color:var(--gold-primary)]/20" />
        </>
      )}
      {variant === "dark" && (
        <>
          <div className="absolute inset-[9px] rounded-[16px] border border-[color:var(--gold-primary)]/65" />
          <div className="absolute inset-x-5 top-5 h-px bg-[color:var(--gold-primary)]/40" />
          <div className="absolute inset-x-5 bottom-5 h-px bg-[color:var(--gold-primary)]/40" />
        </>
      )}
      {variant === "botanical" && (
        <>
          <div className="absolute -right-7 -top-5 size-24 rounded-full border-[12px] border-[color:var(--primary)]/10" />
          <div className="absolute -left-8 -bottom-7 size-28 rounded-full border-[14px] border-[color:var(--gold-primary)]/12" />
        </>
      )}

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-3 text-center">
        <Icon className={`mb-3 size-6 ${variant === "dark" ? "text-gold-primary" : "text-primary"}`} strokeWidth={1.5} />
        <span className={`text-[9px] font-bold ${variant === "dark" ? "text-gold-primary" : "text-muted-foreground"}`}>{meta.title}</span>
        <strong className="mt-2 text-base font-black leading-tight">{buildDefaultTitle(type)}</strong>
        <div className={`my-3 h-px w-10 ${variant === "dark" ? "bg-gold-primary/50" : "bg-primary/20"}`} />
        <span className="text-[8px] opacity-70">اسم المناسبة</span>
        <span className="mt-1 text-[8px] opacity-60">التاريخ • الوقت</span>
        <span className="mt-1 text-[8px] opacity-60">الموقع</span>
      </div>

      {selected && (
        <div className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg">
          <Check className="size-4" />
        </div>
      )}
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const labels = ["نوع المناسبة", "التصميم", "التفاصيل", "المراجعة"];
  return (
    <div className="grid grid-cols-4 gap-2">
      {labels.map((label, index) => {
        const value = index + 1;
        const active = step >= value;
        return (
          <div key={label} className="relative flex flex-col items-center gap-2">
            {index < labels.length - 1 && (
              <div className={`absolute top-4 right-1/2 h-px w-full ${step > value ? "bg-primary" : "bg-border"}`} />
            )}
            <div className={`relative z-10 grid size-8 place-items-center rounded-full border text-xs font-black ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}>
              {step > value ? <Check className="size-4" /> : value}
            </div>
            <span className={`text-[10px] font-bold ${active ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function FamilyOccasionsPage() {
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [type, setType] = useState<OccasionType>("wedding");
  const [design, setDesign] = useState(2);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [details, setDetails] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setOccasions(JSON.parse(raw));
    } catch {
      setOccasions([]);
    }
  }, []);

  const selectedMeta = useMemo(() => getTypeMeta(type), [type]);

  function persist(next: Occasion[]) {
    setOccasions(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function startCreate() {
    setEditingId(null);
    setStep(1);
    setType("wedding");
    setDesign(2);
    setTitle("");
    setDate("");
    setTime("");
    setLocation("");
    setDetails("");
    setOpen(true);
  }

  function startEdit(occasion: Occasion) {
    setEditingId(occasion.id);
    setType(occasion.type);
    setDesign(occasion.design);
    setTitle(occasion.title);
    setDate(occasion.date);
    setTime(occasion.time);
    setLocation(occasion.location);
    setDetails(occasion.details);
    setStep(3);
    setOpen(true);
  }

  function chooseType(next: OccasionType) {
    setType(next);
    if (!editingId) setTitle(buildDefaultTitle(next));
  }

  function deleteOccasion(occasion: Occasion) {
    if (!window.confirm(`حذف مناسبة «${occasion.title}»؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
    persist(occasions.filter((item) => item.id !== occasion.id));
  }

  function saveOccasion() {
    const next: Occasion = {
      id: editingId ?? crypto.randomUUID(),
      type,
      design,
      title: title.trim() || buildDefaultTitle(type),
      date,
      time,
      location,
      details,
    };

    const updated = editingId
      ? occasions.map((item) => (item.id === editingId ? next : item))
      : [next, ...occasions];

    persist(updated);
    setEditingId(null);
    setOpen(false);
  }

  return (
    <AppShell>
      <main dir="rtl" className="mx-auto w-full max-w-7xl px-4 pb-28 pt-5 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[32px] border border-border bg-card shadow-sm">
          <div className="grid min-h-[340px] items-center gap-8 p-7 md:grid-cols-[1fr_0.9fr] md:p-10">
            <div className="order-2 md:order-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--gold-primary)]/25 bg-[color:var(--gold-primary)]/10 px-3 py-1.5 text-xs font-black text-gold-primary">
                <Sparkles className="size-4" /> مناسبات العائلة
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-primary sm:text-4xl">مناسبات العائلة</h1>
              <p className="mt-3 text-sm font-medium leading-7 text-muted-foreground sm:text-base">أضف وشارك أجمل لحظاتكم العائلية</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button onClick={startCreate} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-primary-foreground shadow-lg">
                  <Plus className="size-4" /> إضافة مناسبة جديدة
                </button>
              </div>
            </div>

            <div className="order-1 flex justify-center md:order-2">
              <div className="relative grid size-48 place-items-center rounded-[40px] bg-gradient-to-br from-[color:var(--gold-primary)]/15 via-card to-[color:var(--primary)]/10 sm:size-56">
                <CalendarDays className="size-24 text-gold-primary" strokeWidth={1.1} />
                <div className="absolute -left-4 bottom-5 size-16 rounded-full bg-[color:var(--gold-primary)]/10 blur-xl" />
              </div>
            </div>
          </div>
        </section>

        {occasions.length === 0 ? (
          <section className="mt-6 rounded-[30px] border border-border bg-card px-6 py-12 text-center shadow-sm">
            <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[color:var(--gold-primary)]/10 text-gold-primary">
              <CalendarDays className="size-8" />
            </div>
            <h2 className="mt-5 text-xl font-black text-foreground">لا توجد مناسبات حتى الآن</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">أضف مناسبة جديدة واختر لها التصميم الذي يعجبك.</p>
            <button onClick={startCreate} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-primary-foreground">
              <Plus className="size-4" /> إضافة مناسبة جديدة
            </button>
          </section>
        ) : (
          <section className="mt-7">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-foreground">المناسبات</h2>
                <p className="mt-1 text-sm text-muted-foreground">المناسبات المضافة مؤخرًا</p>
              </div>
              <button onClick={startCreate} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-black text-primary-foreground">
                <Plus className="size-4" /> إضافة
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {occasions.map((occasion) => {
                const meta = getTypeMeta(occasion.type);
                return (
                  <article key={occasion.id} className="overflow-hidden rounded-[28px] border border-border bg-card p-4 shadow-sm">
                    <div className="grid grid-cols-[92px_1fr] gap-4">
                      <TemplatePreview type={occasion.type} design={occasion.design} />
                      <div className="flex min-w-0 flex-col justify-center">
                        <span className="text-[10px] font-black text-gold-primary">{meta.title}</span>
                        <h3 className="mt-1 truncate text-lg font-black text-foreground">{occasion.title}</h3>
                        <div className="mt-3 space-y-2 text-xs font-medium text-muted-foreground">
                          {occasion.date && <div className="flex items-center gap-2"><CalendarDays className="size-3.5" />{occasion.date}{occasion.time ? ` • ${occasion.time}` : ""}</div>}
                          {occasion.location && <div className="flex items-center gap-2"><MapPin className="size-3.5" />{occasion.location}</div>}
                        </div>
                        <div className="mt-4 flex gap-2 border-t border-border pt-3">
                          <button onClick={() => startEdit(occasion)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-black text-primary">
                            <Pencil className="size-3.5" /> تعديل
                          </button>
                          <button onClick={() => deleteOccasion(occasion)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs font-black text-red-600">
                            <Trash2 className="size-3.5" /> حذف
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <button onClick={startCreate} className="fixed bottom-24 left-5 z-30 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-xl sm:hidden" aria-label="إضافة مناسبة">
          <Plus className="size-6" />
        </button>
      </main>

      {open && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-5" dir="rtl">
          <div className="max-h-[94dvh] w-full max-w-3xl overflow-y-auto rounded-t-[32px] bg-card shadow-2xl sm:rounded-[32px]">
            <div className="sticky top-0 z-20 border-b border-border bg-card/95 px-5 pb-4 pt-5 backdrop-blur sm:px-7">
              <div className="mb-5 flex items-center justify-between">
                <button onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-full bg-muted text-foreground"><X className="size-5" /></button>
                <h2 className="text-lg font-black text-foreground">{editingId ? "تعديل المناسبة" : "إضافة مناسبة جديدة"}</h2>
                <div className="size-10" />
              </div>
              <Stepper step={step} />
            </div>

            <div className="p-5 sm:p-7">
              {step === 1 && (
                <div>
                  <h3 className="text-center text-xl font-black text-foreground">اختر نوع المناسبة</h3>
                  <div className="mt-6 grid grid-cols-3 gap-3">
                    {TYPE_OPTIONS.map((item) => {
                      const Icon = item.icon;
                      const selected = type === item.key;
                      return (
                        <button key={item.key} onClick={() => chooseType(item.key)} className={`relative flex min-h-[118px] flex-col items-center justify-center gap-3 rounded-[22px] border p-3 transition-all ${selected ? "border-primary bg-primary/5 ring-1 ring-primary/15" : "border-border bg-background/50"}`}>
                          <Icon className={`size-8 ${selected ? "text-gold-primary" : "text-primary"}`} strokeWidth={1.5} />
                          <span className="text-xs font-black text-foreground">{item.title}</span>
                          {selected && <span className="absolute bottom-2 left-2 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-3" /></span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <h3 className="text-center text-xl font-black text-foreground">اختر تصميم بطاقة المناسبة</h3>
                  <p className="mt-2 text-center text-sm text-muted-foreground">اختر التصميم الذي يعجبك لـ {selectedMeta.title}</p>
                  <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-5">
                    {[1, 2, 3].map((value) => (
                      <button key={value} onClick={() => setDesign(value)} className="text-center">
                        <TemplatePreview type={type} design={value} selected={design === value} />
                        <span className={`mt-3 block text-xs font-black ${design === value ? "text-primary" : "text-muted-foreground"}`}>تصميم {value}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="grid gap-6 md:grid-cols-[170px_1fr]">
                  <div>
                    <p className="mb-3 text-xs font-black text-muted-foreground">التصميم المختار</p>
                    <TemplatePreview type={type} design={design} selected />
                    <button onClick={() => setStep(2)} className="mt-3 w-full rounded-xl border border-border px-3 py-2 text-xs font-black text-primary">تغيير التصميم</button>
                    {editingId && <button onClick={() => setStep(1)} className="mt-2 w-full rounded-xl border border-border px-3 py-2 text-xs font-black text-primary">تغيير نوع المناسبة</button>}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-foreground">تفاصيل المناسبة</h3>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-black text-foreground">عنوان المناسبة</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={buildDefaultTitle(type)} className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary" /></label>
                      <label><span className="mb-1.5 block text-xs font-black text-foreground">التاريخ</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary" /></label>
                      <label><span className="mb-1.5 block text-xs font-black text-foreground">الوقت</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary" /></label>
                      <label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-black text-foreground">الموقع</span><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="مثال: قاعة ..." className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary" /></label>
                      <label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-black text-foreground">تفاصيل إضافية</span><textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={4} className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary" /></label>
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="grid gap-6 md:grid-cols-[220px_1fr]">
                  <TemplatePreview type={type} design={design} selected />
                  <div className="rounded-[24px] border border-border bg-background/50 p-5">
                    <span className="text-xs font-black text-gold-primary">{selectedMeta.title}</span>
                    <h3 className="mt-2 text-2xl font-black text-foreground">{title || buildDefaultTitle(type)}</h3>
                    <div className="mt-5 space-y-3 text-sm font-medium text-muted-foreground">
                      <div className="flex items-center gap-2"><CalendarDays className="size-4" />{date || "لم يحدد التاريخ"}{time ? ` • ${time}` : ""}</div>
                      <div className="flex items-center gap-2"><MapPin className="size-4" />{location || "لم يحدد الموقع"}</div>
                    </div>
                    {details && <p className="mt-5 border-t border-border pt-4 text-sm leading-7 text-muted-foreground">{details}</p>}
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 flex gap-3 border-t border-border bg-card/95 p-5 backdrop-blur sm:px-7">
              {step > 1 && <button onClick={() => setStep((value) => value - 1)} className="inline-flex min-w-28 items-center justify-center gap-2 rounded-2xl border border-border px-5 py-3 text-sm font-black text-foreground"><ChevronRight className="size-4" /> السابق</button>}
              {step < 4 ? (
                <button onClick={() => setStep((value) => Math.min(4, value + 1))} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-primary-foreground">التالي <ChevronLeft className="size-4" /></button>
              ) : (
                <button onClick={saveOccasion} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-primary-foreground"><Check className="size-4" /> {editingId ? "حفظ التعديلات" : "حفظ المناسبة"}</button>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}