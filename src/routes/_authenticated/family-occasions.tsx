import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import {
  Baby,
  Cake,
  CalendarDays,
  Flower2,
  GraduationCap,
  Heart,
  MapPin,
  MoonStar,
  PartyPopper,
  Plus,
  Sparkles,
  Users,
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

type OccasionTemplate = {
  key: string;
  title: string;
  description: string;
  icon: typeof Heart;
  treatment: string;
  accent: string;
};

const templates: OccasionTemplate[] = [
  {
    key: "wedding",
    title: "زواج وملكة",
    description: "دعوة فاخرة بطابع رسمي وزخارف هادئة.",
    icon: Heart,
    treatment: "دعوة ملكية",
    accent: "from-[color:var(--gold-primary)]/28 via-[color:var(--primary)]/10 to-transparent",
  },
  {
    key: "newborn",
    title: "مولود",
    description: "بطاقة ناعمة للاحتفاء بالمولود وتفاصيل الاستقبال.",
    icon: Baby,
    treatment: "بشارة مولود",
    accent: "from-[color:var(--gold-soft)]/25 via-[color:var(--primary)]/8 to-transparent",
  },
  {
    key: "condolence",
    title: "عزاء",
    description: "تصميم رسمي ومحترم لمعلومات الصلاة وموقع العزاء.",
    icon: Flower2,
    treatment: "تعزية",
    accent: "from-[color:var(--foreground)]/8 via-[color:var(--primary)]/6 to-transparent",
  },
  {
    key: "graduation",
    title: "تخرج",
    description: "احتفال أنيق بالخريج مع الجامعة والتخصص.",
    icon: GraduationCap,
    treatment: "تهنئة تخرج",
    accent: "from-[color:var(--gold-primary)]/22 via-[color:var(--primary)]/12 to-transparent",
  },
  {
    key: "birthday",
    title: "عيد ميلاد",
    description: "بطاقة مرحة لكن محافظة على فخامة هوية العائلة.",
    icon: Cake,
    treatment: "احتفال",
    accent: "from-[color:var(--gold-soft)]/24 via-[color:var(--primary)]/10 to-transparent",
  },
  {
    key: "gathering",
    title: "عزيمة ولمّة",
    description: "دعوة مجلس أو لقاء عائلي مع الوقت والموقع.",
    icon: Users,
    treatment: "دعوة عائلية",
    accent: "from-[color:var(--primary)]/18 via-[color:var(--gold-primary)]/12 to-transparent",
  },
  {
    key: "eid",
    title: "عيد ومناسبة موسمية",
    description: "طابع موسمي متوازن يتغير مع ألوان الهوية.",
    icon: MoonStar,
    treatment: "مناسبة موسمية",
    accent: "from-[color:var(--gold-primary)]/26 via-[color:var(--primary)]/12 to-transparent",
  },
  {
    key: "other",
    title: "مناسبة أخرى",
    description: "قالب مرن لأي مناسبة خاصة داخل العائلة.",
    icon: PartyPopper,
    treatment: "مناسبة خاصة",
    accent: "from-[color:var(--primary)]/16 via-[color:var(--gold-soft)]/12 to-transparent",
  },
];

function FamilyOccasionsPage() {
  return (
    <AppShell>
      <main dir="rtl" className="mx-auto w-full max-w-7xl px-4 pb-28 pt-5 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[32px] border border-border bg-card px-5 py-7 shadow-sm sm:px-8 sm:py-9">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-[color:var(--primary)]/12 via-transparent to-[color:var(--gold-primary)]/12" />
          <div className="relative flex items-start justify-between gap-5">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[color:var(--gold-primary)]/25 bg-[color:var(--gold-primary)]/10 px-3 py-1.5 text-xs font-bold text-gold-primary">
                <Sparkles className="size-4" />
                مناسبات العائلة
              </div>
              <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">كل مناسبة لها بطاقتها</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                قسم مستقل لمناسبات العائلة، بتصميم مختلف تلقائيًا حسب نوع المناسبة، مع المحافظة على ألوان الهوية الحالية.
              </p>
            </div>
            <button
              type="button"
              className="hidden shrink-0 items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-primary-foreground shadow-lg shadow-black/10 sm:inline-flex"
            >
              <Plus className="size-4" />
              إضافة مناسبة
            </button>
          </div>
        </section>

        <section className="mt-7">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-foreground sm:text-2xl">أنواع المناسبات</h2>
              <p className="mt-1 text-sm text-muted-foreground">اختر النوع، والبطاقة تتكيّف تلقائيًا مع هوية الموقع.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {templates.map((template) => {
              const Icon = template.icon;
              return (
                <article
                  key={template.key}
                  className="group relative min-h-[210px] overflow-hidden rounded-[28px] border border-border bg-card p-5 shadow-sm transition-transform duration-300 hover:-translate-y-1"
                >
                  <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${template.accent}`} />
                  <div className="pointer-events-none absolute -left-8 -top-8 size-32 rotate-12 rounded-[30px] border border-[color:var(--gold-primary)]/15" />
                  <div className="relative flex h-full flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid size-12 place-items-center rounded-2xl border border-[color:var(--gold-primary)]/20 bg-background/80 text-gold-primary shadow-sm backdrop-blur">
                        <Icon className="size-6" strokeWidth={1.8} />
                      </div>
                      <span className="rounded-full border border-border bg-background/70 px-3 py-1 text-[11px] font-bold text-muted-foreground backdrop-blur">
                        {template.treatment}
                      </span>
                    </div>
                    <div className="mt-auto pt-8">
                      <h3 className="text-xl font-black text-foreground">{template.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{template.description}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-7 rounded-[28px] border border-dashed border-[color:var(--gold-primary)]/25 bg-card/65 p-7 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[color:var(--gold-primary)]/10 text-gold-primary">
            <CalendarDays className="size-7" />
          </div>
          <h2 className="mt-4 text-lg font-black text-foreground">لا توجد مناسبات مضافة بعد</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            عند إضافة أول مناسبة ستظهر هنا كبطاقة كاملة تشمل التاريخ والوقت والموقع ونوع المناسبة.
          </p>
          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" /> التاريخ والوقت</span>
            <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" /> الموقع</span>
          </div>
        </section>

        <button
          type="button"
          className="fixed bottom-24 left-5 z-30 inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl sm:hidden"
          aria-label="إضافة مناسبة"
        >
          <Plus className="size-6" />
        </button>
      </main>
    </AppShell>
  );
}
