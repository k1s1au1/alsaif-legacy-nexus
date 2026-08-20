import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  Baby, Cake, CalendarDays, Check, ChevronLeft, ChevronRight, Flower2,
  GraduationCap, Heart, MapPin, MoonStar, PartyPopper, Pencil, Plus,
  Sparkles, Trash2, Trophy, Users, X, ShieldPlus,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/family-occasions")({
  ssr: false,
  head: () => ({ meta: [
    { title: "مناسبات العائلة — السيف" },
    { name: "description", content: "مناسبات العائلة ودعواتها في مكان واحد." },
  ] }),
  component: FamilyOccasionsPage,
});

type OccasionType = "wedding" | "newborn" | "condolence" | "graduation" | "birthday" | "promotion" | "recovery" | "gathering" | "ramadan" | "eid_fitr" | "eid_adha";
type BirthdayAudience = "adult" | "child";

type Occasion = {
  id: string; type: OccasionType; design: number; title: string; date: string;
  time: string; location: string; details: string; birthDate?: string;
  birthdayAudience?: BirthdayAudience;
};

type OccasionTypeMeta = { key: OccasionType; title: string; icon: typeof Heart; designs: number };

const TYPE_OPTIONS: OccasionTypeMeta[] = [
  { key: "wedding", title: "زواج / ملكة", icon: Heart, designs: 3 },
  { key: "newborn", title: "مولود", icon: Baby, designs: 3 },
  { key: "graduation", title: "تخرج", icon: GraduationCap, designs: 3 },
  { key: "condolence", title: "عزاء", icon: Flower2, designs: 1 },
  { key: "birthday", title: "يوم ميلاد", icon: Cake, designs: 3 },
  { key: "promotion", title: "ترقية / إنجاز", icon: Trophy, designs: 3 },
  { key: "recovery", title: "شفاء / سلامة", icon: ShieldPlus, designs: 3 },
  { key: "gathering", title: "عزيمة / لمة عائلية", icon: Users, designs: 3 },
  { key: "ramadan", title: "رمضان", icon: MoonStar, designs: 3 },
  { key: "eid_fitr", title: "عيد الفطر", icon: Sparkles, designs: 3 },
  { key: "eid_adha", title: "عيد الأضحى", icon: MoonStar, designs: 3 },
];

const STORAGE_KEY = "alsaif:family-occasions";
const FAMILY_MARK = "السيف";

function getTypeMeta(type: OccasionType) { return TYPE_OPTIONS.find((x) => x.key === type) ?? TYPE_OPTIONS[0]; }
function designCount(type: OccasionType) { return getTypeMeta(type).designs; }
function buildDefaultTitle(type: OccasionType) {
  const labels: Record<OccasionType, string> = {
    wedding: "دعوة زواج", newborn: "بشارة مولود", condolence: "تعزية",
    graduation: "حفل تخرج", birthday: "يوم ميلاد", promotion: "مبارك الترقية والإنجاز",
    recovery: "سلامتك هي فرحتنا", gathering: "لمتنا سر السعادة", ramadan: "رمضان مبارك",
    eid_fitr: "عيد فطر مبارك", eid_adha: "عيد أضحى مبارك",
  };
  return labels[type];
}

function calcAge(birthDate?: string, eventDate?: string) {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T12:00:00`);
  const at = eventDate ? new Date(`${eventDate}T12:00:00`) : new Date();
  if (Number.isNaN(birth.getTime()) || Number.isNaN(at.getTime())) return null;
  let age = at.getFullYear() - birth.getFullYear();
  const m = at.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < birth.getDate())) age--;
  return Math.max(0, age);
}

function FamilyLogo({ dark = false }: { dark?: boolean }) {
  return <div className={`grid size-9 place-items-center rounded-full border text-[10px] font-black ${dark ? "border-[#c8a85b]/60 text-[#e0c47a]" : "border-primary/20 text-primary"}`}>{FAMILY_MARK}</div>;
}

function TemplatePreview({ type, design, selected = false, birthDate, eventDate, birthdayAudience = "adult" }: {
  type: OccasionType; design: number; selected?: boolean; birthDate?: string; eventDate?: string; birthdayAudience?: BirthdayAudience;
}) {
  const meta = getTypeMeta(type); const Icon = meta.icon; const age = calcAge(birthDate, eventDate);
  const isCondolence = type === "condolence";
  const dark = isCondolence || ["wedding:2","promotion:1","promotion:3","ramadan:1","ramadan:3","eid_adha:3","gathering:3"].includes(`${type}:${design}`);
  const softBlue = type === "birthday" && birthdayAudience === "child" && design === 3;
  const blush = type === "newborn" && design === 2;
  const sand = type === "eid_adha" && design === 2;
  const bg = isCondolence ? "bg-[#090909] text-white" : softBlue ? "bg-[#eaf3f7] text-[#17435a]" : blush ? "bg-[#fff4ef] text-foreground" : sand ? "bg-[#f3e5c9] text-foreground" : dark ? "bg-[var(--nav-bg,var(--primary))] text-white" : "bg-[#fffdf8] text-foreground";

  const symbol = (() => {
    if (type === "wedding") return design === 1 ? "💍" : design === 2 ? "◇" : "♡";
    if (type === "newborn") return design === 1 ? "🧸" : design === 2 ? "☁" : "♙";
    if (type === "graduation") return design === 1 ? "✦" : design === 2 ? "▣" : "🎓";
    if (type === "birthday") return birthdayAudience === "child" ? (design === 1 ? "🧸" : design === 2 ? String(age ?? 5) : "☆") : (design === 1 ? "♨" : design === 2 ? String(age ?? "•") : "◯");
    if (type === "promotion") return design === 1 ? "🏆" : design === 2 ? "✦" : "◆";
    if (type === "recovery") return design === 1 ? "❧" : design === 2 ? "✧" : "♡";
    if (type === "gathering") return design === 1 ? "☕" : design === 2 ? "❧" : "✦";
    if (type === "ramadan") return "☾";
    if (type === "eid_fitr") return design === 1 ? "✦" : design === 2 ? "🎁" : "☾";
    if (type === "eid_adha") return design === 1 ? "🐑" : design === 2 ? "🐏" : "🐑";
    return "•";
  })();

  return (
    <div className={`relative aspect-[3/5] w-full overflow-hidden rounded-[22px] border shadow-sm ${selected ? "border-primary ring-2 ring-primary/20" : "border-border"} ${bg}`}>
      {!isCondolence && <div className="absolute inset-[9px] rounded-[16px] border border-[color:var(--gold-primary)]/35" />}
      {!dark && !isCondolence && <><div className="absolute -right-10 -top-10 size-28 rounded-full border-[14px] border-primary/5"/><div className="absolute -bottom-12 -left-12 size-32 rounded-full border-[16px] border-[color:var(--gold-primary)]/10"/></>}
      {dark && !isCondolence && <><div className="absolute inset-x-5 top-5 h-px bg-[color:var(--gold-primary)]/35"/><div className="absolute inset-x-5 bottom-5 h-px bg-[color:var(--gold-primary)]/35"/></>}
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-3 text-center">
        {!isCondolence && <FamilyLogo dark={dark}/>} 
        {isCondolence && <div className="mb-3 text-lg text-white/70">إنا لله وإنا إليه راجعون</div>}
        <div className={`my-3 text-3xl font-black ${dark ? "text-gold-primary" : "text-primary"}`}>{symbol}</div>
        <span className={`text-[9px] font-bold ${dark ? "text-gold-primary" : "text-muted-foreground"}`}>{meta.title}</span>
        <strong className="mt-2 text-sm font-black leading-tight">{buildDefaultTitle(type)}</strong>
        {type === "birthday" && age !== null && <strong className="mt-2 text-2xl font-black">{age}</strong>}
        <div className={`my-3 h-px w-10 ${dark ? "bg-gold-primary/50" : "bg-primary/20"}`}/>
        <span className="text-[8px] opacity-70">اسم المناسبة</span><span className="mt-1 text-[8px] opacity-60">التاريخ • الوقت</span><span className="mt-1 text-[8px] opacity-60">الموقع</span>
      </div>
      {selected && <div className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg"><Check className="size-4"/></div>}
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const labels = ["نوع المناسبة", "التصميم", "التفاصيل", "المراجعة"];
  return <div className="grid grid-cols-4 gap-2">{labels.map((label, i) => { const n=i+1, active=step>=n; return <div key={label} className="relative flex flex-col items-center gap-2">{i<3&&<div className={`absolute top-4 right-1/2 h-px w-full ${step>n?"bg-primary":"bg-border"}`}/>}<div className={`relative z-10 grid size-8 place-items-center rounded-full border text-xs font-black ${active?"border-primary bg-primary text-primary-foreground":"border-border bg-card text-muted-foreground"}`}>{step>n?<Check className="size-4"/>:n}</div><span className={`text-[10px] font-bold ${active?"text-primary":"text-muted-foreground"}`}>{label}</span></div>})}</div>;
}

function FamilyOccasionsPage() {
  const [occasions,setOccasions]=useState<Occasion[]>([]); const [open,setOpen]=useState(false); const [editingId,setEditingId]=useState<string|null>(null); const [step,setStep]=useState(1);
  const [type,setType]=useState<OccasionType>("wedding"); const [design,setDesign]=useState(1); const [title,setTitle]=useState(""); const [date,setDate]=useState(""); const [time,setTime]=useState(""); const [location,setLocation]=useState(""); const [details,setDetails]=useState(""); const [birthDate,setBirthDate]=useState(""); const [birthdayAudience,setBirthdayAudience]=useState<BirthdayAudience>("adult");
  useEffect(()=>{try{const raw=localStorage.getItem(STORAGE_KEY); if(raw)setOccasions(JSON.parse(raw));}catch{setOccasions([])}},[]);
  const selectedMeta=useMemo(()=>getTypeMeta(type),[type]);
  function persist(next:Occasion[]){setOccasions(next);localStorage.setItem(STORAGE_KEY,JSON.stringify(next));}
  function reset(){setEditingId(null);setStep(1);setType("wedding");setDesign(1);setTitle("");setDate("");setTime("");setLocation("");setDetails("");setBirthDate("");setBirthdayAudience("adult");}
  function startCreate(){reset();setOpen(true)}
  function startEdit(o:Occasion){setEditingId(o.id);setType(o.type);setDesign(o.design);setTitle(o.title);setDate(o.date);setTime(o.time);setLocation(o.location);setDetails(o.details);setBirthDate(o.birthDate??"");setBirthdayAudience(o.birthdayAudience??"adult");setStep(3);setOpen(true)}
  function chooseType(next:OccasionType){setType(next);setDesign(1);if(!editingId)setTitle(buildDefaultTitle(next));}
  function deleteOccasion(o:Occasion){if(window.confirm(`حذف مناسبة «${o.title}»؟ لا يمكن التراجع عن هذا الإجراء.`))persist(occasions.filter(x=>x.id!==o.id));}
  function saveOccasion(){const next:Occasion={id:editingId??crypto.randomUUID(),type,design,title:title.trim()||buildDefaultTitle(type),date,time,location,details,birthDate:type==="birthday"?birthDate:undefined,birthdayAudience:type==="birthday"?birthdayAudience:undefined};persist(editingId?occasions.map(x=>x.id===editingId?next:x):[next,...occasions]);setOpen(false);setEditingId(null)}
  const previews=Array.from({length:designCount(type)},(_,i)=>i+1);

  return <AppShell><main dir="rtl" className="mx-auto w-full max-w-7xl px-4 pb-28 pt-5 sm:px-6 lg:px-8">
    <section className="overflow-hidden rounded-[32px] border border-border bg-card shadow-sm"><div className="grid min-h-[300px] items-center gap-8 p-7 md:grid-cols-[1fr_.8fr] md:p-10"><div className="order-2 md:order-1"><div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--gold-primary)]/25 bg-[color:var(--gold-primary)]/10 px-3 py-1.5 text-xs font-black text-gold-primary"><Sparkles className="size-4"/> مناسبات العائلة</div><h1 className="mt-4 text-3xl font-black text-primary sm:text-4xl">مناسبات العائلة</h1><p className="mt-3 text-sm font-medium leading-7 text-muted-foreground sm:text-base">اختر المناسبة، ثم اختر أحد التصاميم المعتمدة الخاصة بها.</p><button onClick={startCreate} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-primary-foreground shadow-lg"><Plus className="size-4"/> إضافة مناسبة جديدة</button></div><div className="order-1 flex justify-center md:order-2"><div className="relative grid size-48 place-items-center rounded-[40px] bg-gradient-to-br from-[color:var(--gold-primary)]/15 via-card to-primary/10"><CalendarDays className="size-24 text-gold-primary" strokeWidth={1.1}/></div></div></div></section>
    {occasions.length===0?<section className="mt-6 rounded-[30px] border border-border bg-card px-6 py-12 text-center shadow-sm"><CalendarDays className="mx-auto size-10 text-gold-primary"/><h2 className="mt-5 text-xl font-black">لا توجد مناسبات حتى الآن</h2><p className="mt-2 text-sm text-muted-foreground">أضف مناسبة واختر تصميمها المعتمد.</p></section>:<section className="mt-7"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-black">المناسبات</h2><p className="mt-1 text-sm text-muted-foreground">المناسبات المضافة مؤخرًا</p></div><button onClick={startCreate} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-black text-primary-foreground"><Plus className="size-4"/> إضافة</button></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{occasions.map(o=><article key={o.id} className="overflow-hidden rounded-[28px] border border-border bg-card p-4 shadow-sm"><div className="grid grid-cols-[92px_1fr] gap-4"><TemplatePreview type={o.type} design={o.design} birthDate={o.birthDate} eventDate={o.date} birthdayAudience={o.birthdayAudience}/><div className="flex min-w-0 flex-col justify-center"><span className="text-[10px] font-black text-gold-primary">{getTypeMeta(o.type).title}</span><h3 className="mt-1 truncate text-lg font-black">{o.title}</h3>{o.date&&<div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="size-3.5"/>{o.date}{o.time?` • ${o.time}`:""}</div>}{o.location&&<div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="size-3.5"/>{o.location}</div>}<div className="mt-4 flex gap-2 border-t border-border pt-3"><button onClick={()=>startEdit(o)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-primary/5 px-2 py-2 text-xs font-black text-primary"><Pencil className="size-3.5"/> تعديل</button><button onClick={()=>deleteOccasion(o)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-red-500/5 px-2 py-2 text-xs font-black text-red-600"><Trash2 className="size-3.5"/> حذف</button></div></div></div></article>)}</div></section>}
    <button onClick={startCreate} className="fixed bottom-24 left-5 z-30 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-xl sm:hidden"><Plus className="size-6"/></button>
  </main>
  {open&&<div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-5" dir="rtl"><div className="max-h-[94dvh] w-full max-w-3xl overflow-y-auto rounded-t-[32px] bg-card shadow-2xl sm:rounded-[32px]"><div className="sticky top-0 z-20 border-b border-border bg-card/95 px-5 pb-4 pt-5 backdrop-blur"><div className="mb-5 flex items-center justify-between"><button onClick={()=>setOpen(false)} className="grid size-10 place-items-center rounded-full bg-muted"><X className="size-5"/></button><h2 className="text-lg font-black">{editingId?"تعديل المناسبة":"إضافة مناسبة جديدة"}</h2><div className="size-10"/></div><Stepper step={step}/></div><div className="p-5 sm:p-7">
    {step===1&&<div><h3 className="text-center text-xl font-black">اختر نوع المناسبة</h3><div className="mt-6 grid grid-cols-3 gap-3">{TYPE_OPTIONS.map(item=>{const I=item.icon,sel=type===item.key;return <button key={item.key} onClick={()=>chooseType(item.key)} className={`relative flex min-h-[112px] flex-col items-center justify-center gap-3 rounded-[22px] border p-3 ${sel?"border-primary bg-primary/5":"border-border bg-background/50"}`}><I className={`size-8 ${sel?"text-gold-primary":"text-primary"}`} strokeWidth={1.5}/><span className="text-xs font-black">{item.title}</span>{item.designs===1&&<span className="text-[9px] text-muted-foreground">تصميم واحد</span>}</button>})}</div></div>}
    {step===2&&<div><h3 className="text-center text-xl font-black">اختر تصميم بطاقة المناسبة</h3><p className="mt-2 text-center text-sm text-muted-foreground">{selectedMeta.title} — {designCount(type)===1?"التصميم الرسمي المعتمد":"اختر من 3 تصاميم خاصة بالمناسبة"}</p>{type==="birthday"&&<div className="mx-auto mt-5 flex max-w-sm rounded-2xl bg-muted p-1"><button onClick={()=>setBirthdayAudience("adult")} className={`flex-1 rounded-xl px-3 py-2 text-xs font-black ${birthdayAudience==="adult"?"bg-card text-primary shadow":"text-muted-foreground"}`}>كبار / رسمي</button><button onClick={()=>setBirthdayAudience("child")} className={`flex-1 rounded-xl px-3 py-2 text-xs font-black ${birthdayAudience==="child"?"bg-card text-primary shadow":"text-muted-foreground"}`}>طفل</button></div>}<div className={`mx-auto mt-6 grid gap-3 sm:gap-5 ${previews.length===1?"max-w-[220px] grid-cols-1":"grid-cols-3"}`}>{previews.map(v=><button key={v} onClick={()=>setDesign(v)}><TemplatePreview type={type} design={v} selected={design===v} birthDate={birthDate} eventDate={date} birthdayAudience={birthdayAudience}/><span className={`mt-3 block text-xs font-black ${design===v?"text-primary":"text-muted-foreground"}`}>تصميم {v}</span></button>)}</div></div>}
    {step===3&&<div className="grid gap-6 md:grid-cols-[170px_1fr]"><div><TemplatePreview type={type} design={design} selected birthDate={birthDate} eventDate={date} birthdayAudience={birthdayAudience}/><button onClick={()=>setStep(2)} className="mt-3 w-full rounded-xl border border-border px-3 py-2 text-xs font-black text-primary">تغيير التصميم</button></div><div><h3 className="text-xl font-black">تفاصيل المناسبة</h3><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-black">عنوان المناسبة</span><input value={title} onChange={e=>setTitle(e.target.value)} placeholder={buildDefaultTitle(type)} className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"/></label>{type==="birthday"&&<label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-black">تاريخ الميلاد <span className="font-medium text-muted-foreground">— يحسب العمر تلقائيًا داخل التصاميم التي تعرض العمر</span></span><input type="date" value={birthDate} onChange={e=>setBirthDate(e.target.value)} className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"/></label>}<label><span className="mb-1.5 block text-xs font-black">التاريخ</span><input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"/></label><label><span className="mb-1.5 block text-xs font-black">الوقت</span><input type="time" value={time} onChange={e=>setTime(e.target.value)} className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"/></label><label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-black">الموقع</span><input value={location} onChange={e=>setLocation(e.target.value)} className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"/></label><label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-black">تفاصيل إضافية</span><textarea value={details} onChange={e=>setDetails(e.target.value)} rows={4} className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm"/></label></div></div></div>}
    {step===4&&<div className="grid gap-6 md:grid-cols-[220px_1fr]"><TemplatePreview type={type} design={design} selected birthDate={birthDate} eventDate={date} birthdayAudience={birthdayAudience}/><div className="rounded-[24px] border border-border bg-background/50 p-5"><span className="text-xs font-black text-gold-primary">{selectedMeta.title}</span><h3 className="mt-2 text-2xl font-black">{title||buildDefaultTitle(type)}</h3>{type==="birthday"&&birthDate&&<p className="mt-2 text-sm font-bold text-primary">العمر: {calcAge(birthDate,date)??"—"}</p>}<div className="mt-5 space-y-3 text-sm text-muted-foreground"><div className="flex items-center gap-2"><CalendarDays className="size-4"/>{date||"لم يحدد التاريخ"}{time?` • ${time}`:""}</div><div className="flex items-center gap-2"><MapPin className="size-4"/>{location||"لم يحدد الموقع"}</div></div>{details&&<p className="mt-5 border-t border-border pt-4 text-sm leading-7 text-muted-foreground">{details}</p>}</div></div>}
    </div><div className="sticky bottom-0 flex gap-3 border-t border-border bg-card/95 p-5 backdrop-blur">{step>1&&<button onClick={()=>setStep(v=>v-1)} className="inline-flex min-w-28 items-center justify-center gap-2 rounded-2xl border border-border px-5 py-3 text-sm font-black"><ChevronRight className="size-4"/> السابق</button>}{step<4?<button onClick={()=>setStep(v=>Math.min(4,v+1))} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-primary-foreground">التالي <ChevronLeft className="size-4"/></button>:<button onClick={saveOccasion} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-primary-foreground"><Check className="size-4"/> {editingId?"حفظ التعديلات":"حفظ المناسبة"}</button>}</div></div></div>}
  </AppShell>;
}
