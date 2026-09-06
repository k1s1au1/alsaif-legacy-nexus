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
  Pencil,
  Plus,
  Search,
  ShieldPlus,
  Sparkles,
  Trash2,
  Trophy,
  Users,
  X,
  Share2,
} from "lucide-react";
import { FamilySharing } from "@/lib/native-bridge";
import { consumeQuickCreate } from "@/lib/quick-create";
import { isPastLocalDay } from "@/lib/day-lifecycle";

type OccasionType =
  | "wedding"
  | "newborn"
  | "condolence"
  | "graduation"
  | "birthday"
  | "promotion"
  | "recovery"
  | "gathering"
  | "ramadan"
  | "eid_fitr"
  | "eid_adha";

type BirthdayAudience = "adult" | "child";
type InviteMode = "public" | "private";
type OccasionFont = "ibm" | "tajawal" | "amiri" | "reem-kufi";

type Extra = {
  inviteMode?: InviteMode;
  guestName?: string;
  showLogo?: boolean;
  fontFamily?: OccasionFont;
  fontScale?: number;
  textColor?: string;
  groomFamily?: string;
  brideFamily?: string;
  groomName?: string;
  brideName?: string;
  venue?: string;
  city?: string;
  groomFather?: string;
  brideFather?: string;
  dayName?: string;
  hijriDate?: string;
};

type Occasion = {
  id: string;
  type: OccasionType;
  design: number;
  title: string;
  date: string;
  time: string;
  location: string;
  details: string;
  birthDate?: string;
  birthdayAudience?: BirthdayAudience;
};

type Meta = { key: OccasionType; title: string; icon: any; designs: number };

const TYPES: Meta[] = [
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

const COPY: Record<
  OccasionType,
  { heading: string; body: string; nameLabel: string; optional?: boolean }
> = {
  wedding: {
    heading: "دعوة زواج",
    body: "بسم الله الرحمن الرحيم\n﴿وَمِنْ آيَاتِهِ أَنْ خَلَقَ لَكُم مِّنْ أَنفُسِكُمْ أَزْوَاجًا لِّتَسْكُنُوا إِلَيْهَا وَجَعَلَ بَيْنَكُم مَّوَدَّةً وَرَحْمَةً﴾\nالسلام عليكم ورحمة الله وبركاته،\nيغمرنا السرور ويملأ الفرح قلوبنا، ويشرّفنا أن نشارككم فرحتنا المباركة، سائلين الله أن يبارك للعروسين ويبارك عليهما ويجمع بينهما في خير. حضوركم يزيدنا شرفًا وتكتمل به فرحتنا.",
    nameLabel: "اسم العريس",
  },
  newborn: {
    heading: "بشارة مولود",
    body: "بسم الله الرحمن الرحيم\nالحمد لله الذي بنعمته تتم الصالحات، وبفضله تكتمل الأفراح. منّ الله علينا بمولود أضاء دنيانا وزاد بيتنا فرحًا وسرورًا. نسأل الله أن ينبته نباتًا حسنًا، ويقرّ به أعين والديه، ويحفظه بعينه التي لا تنام، ويجعله من الصالحين المباركين، ويرزقه عمرًا مديدًا في طاعته وصحةً وعافية.",
    nameLabel: "اسم المولود",
  },
  graduation: {
    heading: "مبارك التخرج",
    body: "بسم الله الرحمن الرحيم\nالحمد لله الذي بنعمته تتم الصالحات. بعد رحلةٍ من الجد والاجتهاد، جاء يوم الحصاد واكتملت فرحة الإنجاز. بكل فخر واعتزاز نبارك هذا التخرج، ونسأل الله أن يجعل العلم نورًا والطموح طريقًا والنجاح رفيقًا، وأن تكون هذه الخطوة بدايةً لمستقبلٍ أجمل وإنجازاتٍ أعظم.",
    nameLabel: "اسم الخريج / الخريجة",
  },
  condolence: {
    heading: "إنا لله وإنا إليه راجعون",
    body: "بقلوبٍ مؤمنة بقضاء الله وقدره، وببالغ الحزن والأسى، ننعى فقيدنا الغالي. نسأل المولى عز وجل أن يتغمّده بواسع رحمته ومغفرته، وأن يجعل قبره روضةً من رياض الجنة، ويرفع درجته في المهديين، ويلهم أهله وذويه الصبر والسلوان. اللهم اغفر له وارحمه واعفُ عنه وأكرم نزله واجمعنا به في جنات النعيم.",
    nameLabel: "اسم المتوفى",
  },
  birthday: {
    heading: "كل عام وأنت بخير",
    body: "في هذا اليوم الجميل نحتفل بعامٍ جديد من العمر وصفحةٍ جديدة من الذكريات والأمنيات. كل عام والقلب أسعد، والأيام أجمل، والطموحات أقرب. نسأل الله أن يجعل العام القادم عام خير وبركة، وأن يرزق صاحبه الصحة والعافية والسعادة، ويحقق له ما يتمنى ويكتب له أجمل الأقدار.",
    nameLabel: "الاسم",
  },
  promotion: {
    heading: "مبارك الإنجاز",
    body: "الحمد لله على تمام الفضل والإنجاز. لكل مجتهد نصيب، ولكل طريق من العمل والمثابرة لحظة جميلة تُتوّج بالنجاح. نبارك هذا الإنجاز المستحق وهذه الخطوة المميزة، ونسأل الله أن يجعلها بدايةً لمراحل أكبر من التوفيق والتقدم، وأن يبارك في الجهد والعطاء ويكتب مزيدًا من النجاح والتميّز.",
    nameLabel: "الاسم",
  },
  recovery: {
    heading: "الحمد لله على السلامة",
    body: "الحمد لله حمدًا كثيرًا على تمام العافية والسلامة. نسأل الله أن يجعل ما مضى طهورًا وأجرًا، وأن يتمّ الشفاء على خير، ويلبس صاحب المناسبة لباس الصحة والعافية، ويحفظه من كل سوء، ويديم عليه نعمه وفضله، ويملأ أيامه القادمة راحةً وطمأنينةً وسعادة.",
    nameLabel: "الاسم",
  },
  gathering: {
    heading: "دعوة للّمة العائلية",
    body: "بسم الله وعلى المحبة نلتقي. لأن لَمّة الأهل لها في القلب مكان لا يشبهه شيء، ولأن أجمل الأوقات هي التي تجمعنا بمن نحب، يسعدنا دعوتكم إلى لَمّة عائلية دافئة نلتقي فيها على المودة والفرح والحديث الجميل. حضوركم يكمّل جمعتنا ويزيدها بهجة، فأهلًا وسهلًا بكم بين أهلكم وأحبابكم.",
    nameLabel: "اسم صاحب الدعوة",
    optional: true,
  },
  ramadan: {
    heading: "رمضان مبارك",
    body: "بسم الله الرحمن الرحيم\nبمناسبة حلول شهر رمضان المبارك، شهر الرحمة والمغفرة والعتق من النار، نرفع لكم أصدق التهاني وأطيب الدعوات. نسأل الله أن يبلغنا وإياكم رمضان، وأن يعيننا فيه على الصيام والقيام وصالح الأعمال، ويتقبّل منا ومنكم، ويجعله شهر خير وبركة وطمأنينة ورحمة وقبول.",
    nameLabel: "الاسم",
    optional: true,
  },
  eid_fitr: {
    heading: "عيد فطر مبارك",
    body: "تقبّل الله منا ومنكم صالح الأعمال. بعد أيامٍ مباركة من الصيام والقيام، أقبل عيد الفطر بفرحته الجميلة وبهجته التي تجمع القلوب. نسأل الله أن يجعل عيدكم فرحًا لا ينتهي، وأن يملأ بيوتكم سعادةً وطمأنينة، ويحفظ لكم أحبابكم، ويعيده عليكم أعوامًا عديدة وأنتم بخير وعافية.",
    nameLabel: "الاسم",
    optional: true,
  },
  eid_adha: {
    heading: "عيد أضحى مبارك",
    body: "تقبّل الله منا ومنكم صالح الأعمال والطاعات. بمناسبة عيد الأضحى المبارك نتقدّم إليكم بأصدق التهاني وأجمل الأمنيات، سائلين الله أن يجعل أيام العيد فرحًا وسرورًا وبركة، وأن يعيده علينا وعليكم وعلى من تحبون بالصحة والعافية والأمن والإيمان، وكل عام وأنتم بخير.",
    nameLabel: "الاسم",
    optional: true,
  },
};

const STORAGE = "alsaif:family-occasions";
const ROOT = "/occasion-templates";
const OCCASION_FONTS: Array<{ id: OccasionFont; label: string; family: string }> = [
  {
    id: "ibm",
    label: "IBM Plex عربي",
    family: '"IBM Plex Sans Arabic", "Tajawal", sans-serif',
  },
  { id: "tajawal", label: "تجوال", family: '"Tajawal", sans-serif' },
  { id: "amiri", label: "أميري", family: '"Amiri", serif' },
  { id: "reem-kufi", label: "ريم كوفي", family: '"Reem Kufi", sans-serif' },
];
const OCCASION_TEXT_COLORS = ["#183F36", "#0F5A3A", "#171717", "#8E7745", "#FFFFFF"];

const meta = (t: OccasionType) => TYPES.find((x) => x.key === t) ?? TYPES[0];

function occasionFontFamily(font?: OccasionFont) {
  return OCCASION_FONTS.find((option) => option.id === font)?.family ?? OCCASION_FONTS[0].family;
}

function occasionFontScale(value?: number) {
  return Math.min(1.4, Math.max(0.75, Number.isFinite(value) ? Number(value) : 1));
}

function occasionTextColor(type: OccasionType, value?: string) {
  return /^#[0-9a-f]{6}$/i.test(value ?? "")
    ? value!
    : type === "condolence"
      ? "#FFFFFF"
      : "#183F36";
}

function extra(s?: string): Extra {
  try {
    return s ? JSON.parse(s) : {};
  } catch {
    return {};
  }
}

function age(b?: string, d?: string) {
  if (!b) return null;
  const x = new Date(`${b}T12:00:00`),
    y = d ? new Date(`${d}T12:00:00`) : new Date();
  if (Number.isNaN(x.getTime())) return null;
  let a = y.getFullYear() - x.getFullYear(),
    m = y.getMonth() - x.getMonth();
  if (m < 0 || (m === 0 && y.getDate() < x.getDate())) a--;
  return Math.max(0, a);
}

function path(t: OccasionType, n: number, a: BirthdayAudience = "adult") {
  if (t === "condolence") return `${ROOT}/condolence-1.png.png`;
  if (t === "wedding") return `${ROOT}/wedding-${n}.png.jpg`;
  if (t === "birthday" && a === "child") return `${ROOT}/kids-birthday-${n}.png`;
  if (t === "gathering") return `${ROOT}/family-gathering-${n}.png`;
  if (t === "eid_fitr") return `${ROOT}/eid-fitr-${n}.png`;
  if (t === "eid_adha") return `${ROOT}/eid-adha-${n}.png`;
  return `${ROOT}/${t}-${n}.png`;
}

async function shareOccasion(o: Occasion) {
  const x = extra(o.details);

  await FamilySharing.shareInvitation({
    title: o.title || COPY[o.type].heading,
    date: o.date || "قريباً",
    location: x.venue || o.location || "مجلس العائلة",
    templatePath: path(o.type, o.design, o.birthdayAudience),
    layout: {
      occasionType: o.type,
      heading: COPY[o.type].heading,
      body: COPY[o.type].body,
      name: o.title,
      eventDate: o.date,
      time: o.time,
      location: o.location,
      age: o.type === "birthday" ? age(o.birthDate, o.date) : null,
      ...x,
      showLogo: o.type === "condolence" ? false : (x.showLogo ?? true),
    },
  });
}

function Preview({
  type,
  design,
  birthDate,
  eventDate,
  birthdayAudience = "adult",
  name,
  time,
  location,
  show = false,
  selected = false,
  x = {},
}: {
  type: OccasionType;
  design: number;
  birthDate?: string;
  eventDate?: string;
  birthdayAudience?: BirthdayAudience;
  name?: string;
  time?: string;
  location?: string;
  show?: boolean;
  selected?: boolean;
  x?: Extra;
}) {
  const c = COPY[type];
  const a = age(birthDate, eventDate);
  const cond = type === "condolence";
  const logo = !cond && (x.showLogo ?? true);
  const parts = c.body.split("\n");
  const selectedFontScale = occasionFontScale(x.fontScale);
  const selectedTextColor = occasionTextColor(type, x.textColor);
  const fontGrowth = Math.max(0, selectedFontScale - 1);
  const scaledText = (minimum: number, viewport: number, maximum: number) =>
    `clamp(${(minimum * selectedFontScale).toFixed(2)}px, ${(viewport * selectedFontScale).toFixed(2)}vw, ${(maximum * selectedFontScale).toFixed(2)}px)`;

  return (
    <div
      className={`relative aspect-[3/5] w-full overflow-hidden rounded-[24px] bg-muted shadow-md ${selected ? "ring-2 ring-primary ring-offset-2" : "border border-border"}`}
    >
      <img
        src={path(type, design, birthdayAudience)}
        className="absolute inset-0 h-full w-full object-cover"
        alt="قالب المناسبة"
      />
      {logo && (
        <div className="absolute left-1/2 top-[4%] z-10 -translate-x-1/2">
          <div className="grid size-10 place-items-center overflow-hidden rounded-full bg-white/90 p-1 shadow-sm sm:size-12">
            <img src="/logo-home.png" className="h-full w-full object-contain" alt="شعار العائلة" />
          </div>
        </div>
      )}
      {show && (
        <div
          className="absolute inset-x-[10%] z-10 flex flex-col items-center justify-center overflow-hidden px-4 py-4 text-center"
          style={{
            top: `${18 - fontGrowth * 10}%`,
            bottom: `${12 - fontGrowth * 7.5}%`,
            color: selectedTextColor,
            fontFamily: occasionFontFamily(x.fontFamily),
          }}
        >
          <div className="w-full max-w-[92%] space-y-[clamp(6px,1.5vw,14px)]">
            <h3
              className="font-black leading-tight tracking-wide drop-shadow-sm"
              style={{ fontSize: scaledText(14, 3.8, 24) }}
            >
              {c.heading}
            </h3>
            {parts[0] && (
              <p
                className="font-black leading-relaxed opacity-90"
                style={{ fontSize: scaledText(10, 2.4, 15) }}
              >
                {parts[0]}
              </p>
            )}
            {parts[1] && (
              <p
                className="mx-auto max-w-[95%] font-bold leading-[1.75] opacity-85"
                style={{ fontSize: scaledText(9, 2.1, 14) }}
              >
                {parts[1]}
              </p>
            )}
            {x.inviteMode === "private" && x.guestName && (
              <div
                className="my-1 border-y border-current/10 py-1 font-black"
                style={{ fontSize: scaledText(11, 2.6, 17) }}
              >
                المكرم/ {x.guestName}
              </div>
            )}
            {parts.slice(2).map((p, i) => (
              <p
                key={i}
                className="font-semibold leading-[1.85] opacity-80"
                style={{ fontSize: scaledText(9, 2, 14) }}
              >
                {p}
              </p>
            ))}
            {type === "wedding" ? (
              <div className="space-y-2 pt-1">
                {x.groomFamily && x.brideFamily && (
                  <p
                    className="font-black leading-relaxed"
                    style={{ fontSize: scaledText(10, 2.2, 15) }}
                  >
                    تتشرف عائلتا {x.groomFamily} و {x.brideFamily}
                    <br />
                    بدعوتكم لحضور حفل زواج
                  </p>
                )}
                <div
                  className="font-black leading-tight"
                  style={{ fontSize: scaledText(15, 3.6, 25) }}
                >
                  {x.groomName || name}
                  {x.brideName ? ` و ${x.brideName}` : ""}
                </div>
              </div>
            ) : (
              name?.trim() && (
                <div
                  className="pt-1 font-black leading-tight"
                  style={{ fontSize: scaledText(15, 3.4, 24) }}
                >
                  {name}
                </div>
              )
            )}
            {type === "birthday" && a !== null && (
              <div
                className="font-black leading-none"
                style={{ fontSize: scaledText(30, 8, 48) }}
              >
                {a}
                <span className="mr-1" style={{ fontSize: scaledText(10, 2.2, 15) }}>
                  عامًا
                </span>
              </div>
            )}
            {(eventDate || time || x.dayName || x.hijriDate) && (
              <div
                className={`mx-auto mt-2 w-full rounded-xl px-2 py-2 font-black leading-relaxed ${cond ? "bg-white/10" : "bg-[#183f36]/7"}`}
                style={{ fontSize: scaledText(9, 2.1, 14) }}
              >
                {x.dayName && <div>{x.dayName}</div>}
                <div>
                  {eventDate || ""}
                  {x.hijriDate ? ` • ${x.hijriDate}` : ""}
                  {time ? ` • ${time}` : ""}
                </div>
              </div>
            )}
            {(x.venue || location || x.city) && (
              <div
                className="font-black leading-relaxed"
                style={{ fontSize: scaledText(9, 2.1, 14) }}
              >
                {x.venue || location}
                {x.city ? ` — ${x.city}` : ""}
              </div>
            )}
            {type === "wedding" && (x.groomFather || x.brideFather) && (
              <div
                className="border-t border-current/20 pt-2 font-bold leading-relaxed"
                style={{ fontSize: scaledText(8, 1.9, 13) }}
              >
                <strong className="block" style={{ fontSize: scaledText(9, 2.1, 14) }}>
                  الداعيان
                </strong>
                {x.groomFather && <span className="block">والد العريس: {x.groomFather}</span>}
                {x.brideFather && <span className="block">والد العروس: {x.brideFather}</span>}
              </div>
            )}
          </div>
        </div>
      )}
      {selected && (
        <div className="absolute right-2 top-2 z-20 grid size-7 place-items-center rounded-full bg-primary text-white">
          <Check className="size-4" />
        </div>
      )}
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {["نوع المناسبة", "التصميم", "البيانات", "المراجعة"].map((l, i) => {
        const v = i + 1;
        const a = step >= v;
        return (
          <div key={l} className="flex flex-col items-center gap-2">
            <div
              className={`grid size-8 place-items-center rounded-full border text-xs font-black ${a ? "border-primary bg-primary text-white" : "border-border"}`}
            >
              {step > v ? <Check className="size-4" /> : v}
            </div>
            <span className="text-[11px] font-bold">{l}</span>
          </div>
        );
      })}
    </div>
  );
}

function FamilyOccasionsPage() {
  const { userId, canManageSection, canCreateOfficialOccasion } = useUserRole();
  const canManageOccasions = canManageSection("occasions");
  const [items, setItems] = useState<StoredOccasion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [visibility, setVisibility] = useState<OccasionVisibility>("public");
  const [invitees, setInvitees] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [viewingOccasion, setViewingOccasion] = useState<Occasion | null>(null);
  const [step, setStep] = useState(1);
  const [type, setType] = useState<OccasionType>("wedding");
  const [design, setDesign] = useState(1);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [audience, setAudience] = useState<BirthdayAudience>("adult");
  const [x, setX] = useState<Extra>({
    inviteMode: "public",
    showLogo: true,
    fontFamily: "ibm",
    fontScale: 1,
  });

  const refresh = useCallback(async () => {
    try {
      const rows = await listOccasions({ userId, canManageOccasions });
      setItems(rows as StoredOccasion[]);
    } catch (error) {
      console.warn("occasions load failed", error);
      toast.error("تعذّر تحميل المناسبات");
    } finally {
      setLoading(false);
    }
  }, [userId, canManageOccasions]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useRealtimeSync(["events", "event_invitees", "event_attendees"], () => void refresh());

  useEffect(() => {
    void (async () => {
      try {
        setMembers(await listFamilyMembers());
      } catch {
        setMembers([]);
      }
    })();
  }, []);

  const selected = useMemo(() => meta(type), [type]);
  const previews = Array.from({ length: selected.designs }, (_, i) => i + 1);
  const set = (k: keyof Extra, v: string | boolean | number) =>
    setX((q) => ({ ...q, [k]: v }));

  function reset() {
    setEditing(null);
    setStep(1);
    setType("wedding");
    setDesign(1);
    setName("");
    setDate("");
    setTime("");
    setLocation("");
    setBirthDate("");
    setAudience("adult");
    setVisibility("public");
    setInvitees([]);
    setX({ inviteMode: "public", showLogo: true, fontFamily: "ibm", fontScale: 1 });
  }

  function start() {
    reset();
    setOpen(true);
  }

  useEffect(() => {
    if (consumeQuickCreate("occasion")) start();
  }, []);

  function edit(o: StoredOccasion) {
    setEditing(o.id);
    setType(o.type);
    setDesign(o.design);
    setName(o.title || "");
    setDate(o.date);
    setTime(o.time);
    setLocation(o.location);
    setBirthDate(o.birthDate || "");
    setAudience(o.birthdayAudience || "adult");
    setVisibility(o.visibility);
    setInvitees([]);
    if (o.visibility === "private") {
      void listOccasionInvitees(o.id)
        .then((ids) => setInvitees(ids.filter((id) => id !== o.createdBy)))
        .catch(() => setInvitees([]));
    }
    setX({ inviteMode: "public", showLogo: true, ...extra(o.details) });
    setStep(3);
    setOpen(true);
  }

  async function save() {
    if (visibility === "official" && !canCreateOfficialOccasion) {
      toast.error("مناسبة عائلة السيف تحتاج صلاحية القيادة أو مسؤول المناسبات");
      return;
    }
    if (visibility === "private" && invitees.length === 0) {
      toast.error("اختر المدعوين للمناسبة الخاصة");
      return;
    }
    setSaving(true);
    try {
      await saveOccasion({
        id: editing,
        visibility,
        inviteeIds: invitees,
        payload: {
          id: editing ?? "",
          type,
          design,
          title: name.trim(),
          date,
          time,
          location,
          details: JSON.stringify({
            ...x,
            inviteMode: visibility === "private" ? "private" : "public",
            showLogo: type === "condolence" ? false : x.showLogo,
          }),
          birthDate: type === "birthday" ? birthDate : undefined,
          birthdayAudience: type === "birthday" ? audience : undefined,
        },
      });
      toast.success(editing ? "تم تحديث المناسبة" : "تم نشر المناسبة");
      setOpen(false);
      await refresh();
    } catch (error: any) {
      toast.error(error?.message || "تعذّر حفظ المناسبة، حاول مرة أخرى");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("حذف المناسبة؟")) return;
    try {
      await deleteOccasion(id);
      await refresh();
      toast.success("تم حذف المناسبة");
    } catch {
      toast.error("تعذّر حذف المناسبة");
    }
  }


  const field = (label: string, key: keyof Extra, span = false) => (
    <label className={span ? "sm:col-span-2" : ""}>
      <span className="mb-1.5 block text-xs font-black">{label}</span>
      <input
        value={String(x[key] ?? "")}
        onChange={(e) => set(key, e.target.value)}
        className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
      />
    </label>
  );

  return (
    <AppShell title="مناسبات العائلة" user={{ name: "", role: "", initial: "س" }}>
      <main dir="rtl" className="mx-auto w-full max-w-7xl px-4 pb-28 pt-5 sm:px-6">
        <section className="rounded-[32px] border border-border bg-card p-7 shadow-sm">
          <Sparkles className="size-8 text-gold-primary" />
          <h1 className="mt-3 text-3xl font-black text-primary">مناسبات العائلة</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            دعوات جاهزة بصياغة كاملة؛ اختر القالب ثم أدخل البيانات المتغيرة فقط.
          </p>
          <button
            onClick={start}
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white"
          >
            <Plus className="size-4" /> إضافة مناسبة جديدة
          </button>
        </section>

        {items.length === 0 ? (
          <section className="mt-6 rounded-[30px] border border-border bg-card p-10 text-center">
            <CalendarDays className="mx-auto size-10" />
            <h2 className="mt-4 text-xl font-black">لا توجد مناسبات حتى الآن</h2>
          </section>
        ) : (
          <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((o) => {
              const ex = extra(o.details);
              return (
                <article
                  key={o.id}
                  className="rounded-[28px] border border-border bg-card p-4 transition-all hover:shadow-md"
                >
                  <div className="grid grid-cols-[92px_1fr] gap-4">
                    <button
                      onClick={() => setViewingOccasion(o)}
                      className="relative group overflow-hidden rounded-[20px] transition-transform active:scale-95"
                    >
                      <Preview
                        type={o.type}
                        design={o.design}
                        birthDate={o.birthDate}
                        eventDate={o.date}
                        birthdayAudience={o.birthdayAudience}
                        name={o.title}
                        time={o.time}
                        location={o.location}
                        x={ex}
                        show
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <Search className="size-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                      </div>
                    </button>
                    <div>
                      <span className="text-[11px] font-black text-gold-primary">
                        {meta(o.type).title}
                      </span>
                      <h3 className="mt-1 truncate text-lg font-black">
                        {o.title || COPY[o.type].heading}
                      </h3>
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => edit(o)}
                          className="flex-1 rounded-xl bg-primary/5 py-2"
                          title="تعديل"
                        >
                          <Pencil className="mx-auto size-4" />
                        </button>
                        <button
                          onClick={() => void shareOccasion(o)}
                          className="flex-1 rounded-xl bg-gold-primary/10 py-2 text-gold-primary"
                          title="مشاركة"
                        >
                          <Share2 className="mx-auto size-4" />
                        </button>
                        <button
                          onClick={() =>
                            window.confirm("حذف المناسبة؟") &&
                            persist(items.filter((v) => v.id !== o.id))
                          }
                          className="flex-1 rounded-xl bg-red-500/5 py-2 text-red-600"
                          title="حذف"
                        >
                          <Trash2 className="mx-auto size-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>

      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 sm:items-center sm:p-5"
          dir="rtl"
        >
          <div className="max-h-[96dvh] w-full max-w-4xl overflow-y-auto rounded-t-[32px] bg-card sm:rounded-[32px]">
            <div className="sticky top-0 z-20 border-b border-border bg-card/95 px-5 pb-4 pt-5">
              <div className="mb-5 flex items-center justify-between">
                <button
                  onClick={() => setOpen(false)}
                  className="grid size-10 place-items-center rounded-full bg-muted"
                >
                  <X className="size-5" />
                </button>
                <h2 className="text-lg font-black">
                  {editing ? "تعديل المناسبة" : "إضافة مناسبة جديدة"}
                </h2>
                <div className="size-10" />
              </div>
              <Stepper step={step} />
            </div>
            <div className="p-5 sm:p-7">
              {step === 1 && (
                <div>
                  <h3 className="text-center text-xl font-black">اختر نوع المناسبة</h3>
                  <div className="mt-6 grid grid-cols-3 gap-3">
                    {TYPES.map((v) => {
                      const I = v.icon;
                      return (
                        <button
                          key={v.key}
                          onClick={() => {
                            setType(v.key);
                            setDesign(1);
                            if (v.key === "condolence") setX((q) => ({ ...q, showLogo: false }));
                          }}
                          className={`flex min-h-[112px] flex-col items-center justify-center gap-3 rounded-[22px] border p-3 ${type === v.key ? "border-primary bg-primary/5" : "border-border"}`}
                        >
                          <I className="size-8" />
                          <span className="text-xs font-black">{v.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {step === 2 && (
                <div>
                  <h3 className="text-center text-xl font-black">اختر التصميم</h3>
                  {type === "birthday" && (
                    <div className="mx-auto mt-5 flex max-w-sm rounded-2xl bg-muted p-1">
                      <button
                        onClick={() => setAudience("adult")}
                        className={`flex-1 rounded-xl p-2 text-xs font-black ${audience === "adult" ? "bg-card shadow" : ""}`}
                      >
                        كبار / رسمي
                      </button>
                      <button
                        onClick={() => setAudience("child")}
                        className={`flex-1 rounded-xl p-2 text-xs font-black ${audience === "child" ? "bg-card shadow" : ""}`}
                      >
                        طفل
                      </button>
                    </div>
                  )}
                  <div
                    className={`mx-auto mt-6 grid gap-5 ${previews.length === 1 ? "max-w-[240px]" : "grid-cols-3"}`}
                  >
                    {previews.map((n) => (
                      <button key={n} onClick={() => setDesign(n)}>
                        <Preview
                          type={type}
                          design={n}
                          selected={design === n}
                          birthdayAudience={audience}
                        />
                        <span className="mt-2 block text-xs font-black">تصميم {n}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {step === 3 && (
                <div className="grid gap-7 md:grid-cols-[minmax(300px,360px)_1fr]">
                  <div className="mx-auto w-full max-w-[360px]">
                    <Preview
                      type={type}
                      design={design}
                      selected
                      birthDate={birthDate}
                      eventDate={date}
                      birthdayAudience={audience}
                      name={type === "wedding" ? (x.groomName as string) || name : name}
                      time={time}
                      location={location}
                      x={x}
                      show
                    />
                  </div>
                  <div>
                    <h3 className="text-xl font-black">بيانات الدعوة</h3>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => set("inviteMode", "public")}
                        className={`rounded-2xl border p-3 text-xs font-black ${x.inviteMode !== "private" ? "border-primary bg-primary/5" : "border-border"}`}
                      >
                        دعوة عامة
                      </button>
                      <button
                        onClick={() => set("inviteMode", "private")}
                        className={`rounded-2xl border p-3 text-xs font-black ${x.inviteMode === "private" ? "border-primary bg-primary/5" : "border-border"}`}
                      >
                        دعوة خاصة
                      </button>
                    </div>
                    {x.inviteMode === "private" && x.guestName && (
                      <div className="mt-4">{field("اسم الضيف / المدعو", "guestName", true)}</div>
                    )}
                    {type !== "condolence" && (
                      <label className="mt-4 flex items-center justify-between rounded-2xl border border-border p-4">
                        <span className="text-sm font-black">إظهار شعار العائلة</span>
                        <input
                          type="checkbox"
                          checked={x.showLogo ?? true}
                          onChange={(e) => set("showLogo", e.target.checked)}
                          className="size-5"
                        />
                      </label>
                    )}
                    <div className="mt-4 rounded-[22px] border border-border bg-background p-4">
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-sm font-black">تنسيق خط البطاقة</strong>
                        <button
                          type="button"
                          onClick={() =>
                            setX((current) => ({
                              ...current,
                              fontFamily: "ibm",
                              fontScale: 1,
                              textColor: undefined,
                            }))
                          }
                          className="rounded-xl bg-muted px-3 py-2 text-xs font-black"
                        >
                          إعادة الضبط
                        </button>
                      </div>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <label>
                          <span className="mb-1.5 block text-xs font-black">نوع الخط</span>
                          <select
                            value={x.fontFamily ?? "ibm"}
                            onChange={(e) => set("fontFamily", e.target.value)}
                            className="min-h-12 w-full rounded-2xl border border-border bg-card px-4 text-sm font-bold"
                          >
                            {OCCASION_FONTS.map((font) => (
                              <option key={font.id} value={font.id} style={{ fontFamily: font.family }}>
                                {font.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <div>
                          <span className="mb-1.5 block text-xs font-black">لون الخط</span>
                          <div className="flex min-h-12 items-center gap-2 rounded-2xl border border-border bg-card px-3">
                            {OCCASION_TEXT_COLORS.map((color) => {
                              const active =
                                occasionTextColor(type, x.textColor).toUpperCase() === color;
                              return (
                                <button
                                  key={color}
                                  type="button"
                                  onClick={() => set("textColor", color)}
                                  aria-label={`اختيار لون الخط ${color}`}
                                  className={`size-7 shrink-0 rounded-full border transition-transform ${active ? "scale-110 ring-2 ring-primary ring-offset-2" : "border-black/15"}`}
                                  style={{ backgroundColor: color }}
                                />
                              );
                            })}
                            <input
                              type="color"
                              value={occasionTextColor(type, x.textColor)}
                              onChange={(e) => set("textColor", e.target.value.toUpperCase())}
                              aria-label="اختيار لون خط مخصص"
                              className="mr-auto size-8 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between text-xs font-black">
                          <span>حجم الخط</span>
                          <output>{Math.round(occasionFontScale(x.fontScale) * 100)}٪</output>
                        </div>
                        <div className="flex items-center gap-3" dir="ltr">
                          <button
                            type="button"
                            onClick={() =>
                              set(
                                "fontScale",
                                Math.max(0.75, occasionFontScale(x.fontScale) - 0.05),
                              )
                            }
                            aria-label="تصغير الخط"
                            className="grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-card text-xl font-black"
                          >
                            −
                          </button>
                          <input
                            type="range"
                            min="0.75"
                            max="1.4"
                            step="0.05"
                            value={occasionFontScale(x.fontScale)}
                            onChange={(e) => set("fontScale", Number(e.target.value))}
                            aria-label="حجم خط البطاقة"
                            className="h-2 min-w-0 flex-1 cursor-pointer accent-[#0F5A3A]"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              set(
                                "fontScale",
                                Math.min(1.4, occasionFontScale(x.fontScale) + 0.05),
                              )
                            }
                            aria-label="تكبير الخط"
                            className="grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-card text-xl font-black"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 rounded-2xl bg-primary/5 p-4">
                      <strong className="text-sm font-black">{COPY[type].heading}</strong>
                      <p className="mt-2 whitespace-pre-line text-xs leading-6 text-muted-foreground">
                        {COPY[type].body}
                      </p>
                    </div>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      {type === "wedding" ? (
                        <>
                          {field("اسم عائلة العريس", "groomFamily")}
                          {field("اسم عائلة العروس", "brideFamily")}
                          {field("اسم العريس", "groomName")}
                          {field("اسم العروس", "brideName")}
                          {field("اسم والد العريس", "groomFather")}
                          {field("اسم والد العروس", "brideFather")}
                          {field("اسم القاعة أو الفندق", "venue")}
                          {field("المدينة", "city")}
                          {field("اليوم (مثال: الخميس)", "dayName")}
                          <div className="sm:col-span-2 relative">
                            <span className="mb-1.5 block text-xs font-black">التاريخ الهجري</span>
                            <input
                              value={String(x.hijriDate ?? "")}
                              onChange={(e) => set("hijriDate", e.target.value)}
                              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                              placeholder="مثال: ١٥ رمضان ١٤٤٥هـ"
                            />
                            <a
                              href="https://www.google.com/search?q=تاريخ+اليوم+هجري"
                              target="_blank"
                              rel="noreferrer"
                              className="absolute left-3 top-9 text-[10px] text-gold-primary hover:underline font-bold"
                            >
                              محول التاريخ
                            </a>
                          </div>
                        </>
                      ) : (
                        <label className="sm:col-span-2">
                          <span className="mb-1.5 block text-xs font-black">
                            {COPY[type].nameLabel}
                            {COPY[type].optional ? " (اختياري)" : ""}
                          </span>
                          <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full rounded-2xl border border-border bg-background px-4 py-3"
                          />
                        </label>
                      )}
                      {type === "birthday" && (
                        <label className="sm:col-span-2">
                          <span className="mb-1.5 block text-xs font-black">
                            تاريخ الميلاد — يحسب العمر تلقائيًا
                          </span>
                          <input
                            type="date"
                            value={birthDate}
                            onChange={(e) => setBirthDate(e.target.value)}
                            className="w-full rounded-2xl border border-border bg-background px-4 py-3"
                          />
                        </label>
                      )}
                      <label>
                        <span className="mb-1.5 block text-xs font-black">التاريخ الميلادي</span>
                        <input
                          type="date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          className="w-full rounded-2xl border border-border bg-background px-4 py-3"
                        />
                      </label>
                      <label>
                        <span className="mb-1.5 block text-xs font-black">الوقت</span>
                        <input
                          type="time"
                          value={time}
                          onChange={(e) => setTime(e.target.value)}
                          className="w-full rounded-2xl border border-border bg-background px-4 py-3"
                        />
                      </label>
                      {type !== "wedding" && (
                        <label className="sm:col-span-2">
                          <span className="mb-1.5 block text-xs font-black">الموقع</span>
                          <input
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            className="w-full rounded-2xl border border-border bg-background px-4 py-3"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {step === 4 && (
                <div className="grid gap-7 md:grid-cols-[minmax(320px,390px)_1fr]">
                  <div className="mx-auto w-full max-w-[390px]">
                    <Preview
                      type={type}
                      design={design}
                      selected
                      birthDate={birthDate}
                      eventDate={date}
                      birthdayAudience={audience}
                      name={type === "wedding" ? (x.groomName as string) || name : name}
                      time={time}
                      location={location}
                      x={x}
                      show
                    />
                  </div>
                  <div className="rounded-[24px] border border-border p-5">
                    <span className="text-xs font-black text-gold-primary">
                      {selected.title} • {x.inviteMode === "private" ? "دعوة خاصة" : "دعوة عامة"}
                    </span>
                    <h3 className="mt-2 text-2xl font-black">{COPY[type].heading}</h3>
                    {x.inviteMode === "private" && x.guestName && (
                      <p className="mt-3 font-black">المكرم/ {x.guestName}</p>
                    )}
                    <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                      {COPY[type].body}
                    </p>
                    {type === "birthday" && birthDate && (
                      <p className="mt-3 font-black">العمر: {age(birthDate, date) ?? "—"}</p>
                    )}
                    <div className="mt-5 space-y-2 text-sm">
                      <div>
                        <CalendarDays className="ml-2 inline size-4" />
                        {date || "لم يحدد التاريخ"}
                        {time ? ` • ${time}` : ""}
                      </div>
                      <div>
                        <MapPin className="ml-2 inline size-4" />
                        {x.venue || location || "لم يحدد الموقع"}
                        {x.city ? ` — ${x.city}` : ""}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="sticky bottom-0 flex gap-3 border-t border-border bg-card/95 p-5">
              {step > 1 && (
                <button
                  onClick={() => setStep((v) => v - 1)}
                  className="inline-flex min-w-28 items-center justify-center gap-2 rounded-2xl border border-border px-5 py-3 text-sm font-black"
                >
                  <ChevronRight className="size-4" /> السابق
                </button>
              )}
              {step < 4 ? (
                <button
                  onClick={() => setStep((v) => Math.min(4, v + 1))}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white"
                >
                  التالي <ChevronLeft className="size-4" />
                </button>
              ) : (
                <button
                  onClick={save}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white"
                >
                  <Check className="size-4" /> حفظ المناسبة
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {viewingOccasion && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-10"
          dir="rtl"
          onClick={() => setViewingOccasion(null)}
        >
          <div
            className="relative w-full max-w-md animate-in fade-in zoom-in duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute -top-14 left-1/2 -translate-x-1/2 flex gap-4">
              <button
                onClick={() => setViewingOccasion(null)}
                className="size-11 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 text-white flex items-center justify-center hover:bg-red-500 transition-all shadow-xl"
              >
                <X size={22} />
              </button>
              <button
                onClick={() => void shareOccasion(viewingOccasion)}
                className="size-11 rounded-full bg-gold-primary text-emerald-950 flex items-center justify-center hover:scale-110 transition-all shadow-xl"
              >
                <Share2 size={20} />
              </button>
            </div>
            <Preview
              type={viewingOccasion.type}
              design={viewingOccasion.design}
              birthDate={viewingOccasion.birthDate}
              eventDate={viewingOccasion.date}
              birthdayAudience={viewingOccasion.birthdayAudience}
              name={viewingOccasion.title}
              time={viewingOccasion.time}
              location={viewingOccasion.location}
              x={extra(viewingOccasion.details)}
              show
              selected
            />
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default FamilyOccasionsPage;
