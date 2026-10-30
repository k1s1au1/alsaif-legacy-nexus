export type WordCategory = "general" | "animals" | "foods" | "cities";
export type WordTopic = WordCategory | "varied";
export type WordEntry = { word: string; key: string; category: WordCategory };
export const WORD_CATEGORIES: Record<WordCategory, string> = {
  general: "كلمات متنوعة",
  animals: "حيوانات",
  foods: "أكلات",
  cities: "مدن",
};
export const WORD_TOPICS: { id: WordTopic; label: string }[] = [
  { id: "general", label: "السجال العادي" },
  { id: "varied", label: "فئة مختلفة كل جولة" },
  { id: "animals", label: "حيوانات" },
  { id: "foods", label: "أكلات" },
  { id: "cities", label: "مدن" },
];
export function cleanArabicWord(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640\u200b-\u200f\ufeff]/g, "")
    .replace(/[ک]/g, "ك")
    .replace(/[ی]/g, "ي")
    .trim()
    .replace(/\s+/g, " ");
}
// Spelling tolerance is shared by lookup, chaining and duplicate detection.
// It is intentionally independent of edit distance: arbitrary text is not a word.
export function spellingKey(value: string) {
  const key = cleanArabicWord(value)
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/[ئىي]/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ء\s]/g, "");
  return (
    ({ بطيي: "بطي", مسئول: "مسوول", المسيول: "المسوول", مسيول: "مسوول" } as Record<string, string>)[
      key
    ] ?? key
  );
}
// Original, hand-selected everyday words for bots and useful hints. The larger
// spelling dictionary is loaded only when this game is selected.
const SEEDS: Record<WordCategory, string> = {
  general: `أمل|أمان|أثر|أرض|أدب|أداة|إبرة|إيمان|أخلاق|أفق|أمانة|إنسان|أسرة|إجازة|إبداع|باب|بحر|بيت|برق|بستان|بريد|بلاد|بطيء|بطل|بلبل|بساط|بخور|بداية|بركة|تاج|تمر|تاريخ|تفاح|تراب|تلميذ|تعاون|تذكرة|تسامح|تجربة|تطوير|ثلج|ثعلب|ثوب|ثمرة|ثريا|ثقافة|ثقة|ثروة|ثبات|ثانية|جبل|جسر|جميل|جمال|جرس|جدار|جزيرة|جناح|جوار|جائزة|جريدة|حلم|حياة|حديقة|حب|حبل|حطب|حجر|حكاية|حقيبة|حصن|حكمة|حصان|خيل|خير|خيمة|خريف|خيط|خريطة|خزانة|خاتم|خاطر|خطأ|خبز|دار|درب|دليل|دفتر|دائرة|درس|دلو|دب|دجاج|درع|دقيقة|دراجة|ذهب|ذرة|ذراع|ذئب|ذيل|ذكرى|ذكاء|ذوق|ذكر|ذهن|ذخيرة|ذهاب|ربيع|رمان|رمل|رسالة|رسم|ريح|روح|رحلة|رفيق|رؤية|رئيس|رغيف|رواق|زهرة|زيت|زيتون|زجاج|زرافة|زورق|زمن|زينة|زائر|زميل|زراعة|سماء|سلام|سيف|سحاب|سعادة|سور|سلم|سؤال|سفر|ساحة|سيرة|سراج|سنجاب|شمس|شجرة|شراع|شوق|شعور|شاطئ|شاي|شلال|شمعة|شرفة|شجاعة|شعار|صباح|صقر|صبر|صورة|صديق|صندوق|صحراء|صخرة|صوت|صوف|صابون|صناعة|ضوء|ضيف|ضفدع|ضرس|ضحك|ضحكة|ضمير|ضباب|ضجيج|ضياء|ضفة|طائر|طريق|طاولة|طين|طعام|طفل|طبيب|طموح|طبيعة|طائرة|طاووس|طابع|ظل|ظبي|ظرف|ظلام|ظاهر|ظهور|ظفر|ظمأ|ظريف|ظهر|عسل|عائلة|علم|عالم|عين|عطر|عمل|عمر|عنب|عصفور|عطاء|عقل|علماء|غزال|غيمة|غصن|غرفة|غد|غروب|غار|غابة|غبار|غرس|غلاف|فجر|فخر|فرح|فيل|فراشة|فكرة|فصل|فستان|فنجان|فريق|فانوس|فناء|قمر|قهوة|قلب|قلم|قصر|قارب|قماش|قرية|قصة|قفل|قطار|قطة|كتاب|كرم|كنز|كرسي|كوكب|كيس|كوب|كرة|كلمة|كف|كهف|كعك|ليل|لؤلؤ|لحن|لوحة|لغة|لعبة|لوز|ليمون|لبن|لمسة|لقاء|لحظة|مجلس|مطر|مجد|مدرسة|مسؤول|مدينة|مفتاح|منزل|ماء|مكتبة|موعد|مساء|مظلة|مسجد|نجم|نخلة|نور|نهر|نار|نسيم|نبات|نعمة|نافذة|نظافة|نسر|نحلة|هدية|هلال|هواء|هاتف|هدف|همس|هدوء|هندسة|هوية|هداية|هدهد|هضبة|وطن|ورد|وعد|وقت|وجه|وادي|ورق|وليمة|وثيقة|وسادة|وفاء|وزير|ولد|وحدة|يد|ياسمين|ينبوع|ياقوت|يمامة|يسار|يقطين|يوم|يقين|يمين|يسر|يراعة|يكتب|يلعب|يقرأ|يمشي|يشرب|يزرع|يسافر|ينظر|يبيع|يضحك|يفكر|يستمع`,
  animals: `أسد|أرنب|أفعى|إبل|أخطبوط|بقرة|بط|بطة|بوم|بومة|بلبل|ببغاء|بعوض|باز|تمساح|تيس|ثعلب|ثور|ثعبان|جمل|جاموس|جراد|جرذ|جربوع|حمار|حصان|حوت|حمام|حلزون|حرباء|خروف|خيل|خفاش|خنفساء|دب|دجاجة|دلفين|ديك|دودة|ذئب|ذبابة|ذباب|روبيان|ريم|رنة|زرافة|زبابة|سنجاب|سمكة|سمك|سلحفاة|سلطعون|سحلية|سمور|شبل|شمبانزي|شاهين|صقر|صرصور|ضبع|ضفدع|ضب|طائر|طاووس|ظبي|عصفور|عقرب|عنكبوت|عجل|غزال|غوريلا|غنم|غراب|فيل|فراشة|فأر|فقمة|فهد|فرس|قطة|قط|قرد|قنفذ|قندس|كلب|كوالا|كبش|لاما|لقلق|ماعز|مهر|نسر|نمر|نحلة|نعامة|نعجة|هدهد|هامستر|هرة|وطواط|وعل|وحيد القرن|ورل|يمامة|يعسوب`,
  foods: `أرز|إدام|أقط|باذنجان|بامية|بطيخ|بصل|برتقال|بسبوسة|بسكويت|بطاطس|بطاطا|بيتزا|برجر|برياني|بروستد|بقدونس|بلح|تمر|تفاح|توت|تبولة|تونة|تميس|ترمس|تين|ثريد|ثوم|جبن|جريش|جوافة|جرجير|جزر|جوز|جلجلان|حليب|حمص|حساء|حلاوة|حنطة|حريرة|حبوب|حبحب|خبز|خيار|خس|خل|خبيزة|خوخ|خضار|دجاج|دقيق|دبس|دخن|دونات|دولمة|ذرة|رمان|رز|روبيان|روب|رقاق|رشوف|رطب|زبيب|زيت|زيتون|زعتر|زنجبيل|زبدة|سمك|سليق|سمبوسة|سلطة|سمن|سمسم|سحلب|سكر|شاي|شوربة|شاورما|شعيرية|شوفان|شكشوكة|شبت|صامولي|صنوبر|صالونة|ضأن|طماطم|طحينة|طرشي|طعام|عسل|عنب|عدس|عصيدة|عرقسوس|عريكة|عصير|غريبة|غوزي|فول|فلافل|فطيرة|فستق|فاصوليا|فلفل|فراولة|فشار|قهوة|قرصان|قشطة|قرع|قرفة|قوزي|قلقاس|كبسة|كنافة|كعك|كبدة|كوسة|كرك|كرواسون|كباب|كشري|لحم|لبن|لبنة|لوز|ليمون|لقيمات|لوبيا|مندي|مرقوق|مطبق|موز|مكرونة|مربى|ملح|معمول|مهلبية|مقلوبة|مانجو|نعناع|نودلز|نخي|هريس|هريسة|هامور|هوت دوغ|ورق عنب|ويكة|وجبة|يقطين|يوسفي|يغمش|ياغورت`,
  cities: `أبها|أبو ظبي|أملج|أمستردام|إسطنبول|بريدة|بيشة|بيروت|بغداد|باريس|برلين|بكين|بقيق|بورتسودان|تبوك|تونس|تربة|تمير|تيماء|تطوان|ثادق|جدة|جازان|جنيف|جلاسكو|جوبا|جرش|حائل|حفر الباطن|حلب|حمص|حماة|حريملاء|خميس مشيط|خيبر|خبر|خرطوم|خرمة|دبي|دمشق|دوحة|دمام|دبلن|دومة الجندل|درعية|ذمار|ذهبان|رياض|رابغ|رفحاء|رأس تنورة|روما|رنية|روتردام|زلفي|زحلة|زبيد|زنجبار|سكاكا|سنغافورة|سيدني|سراة عبيدة|ستوكهولم|سمرقند|شقراء|شرورة|شينزن|شنغهاي|شرم الشيخ|صنعاء|صامطة|صلالة|صيدا|صفوى|ضباء|ضمد|طائف|طوكيو|طرابلس|طريف|طنجة|ظهران|ظفار|عمان|عنيزة|عرعر|عدن|عفيف|علا|غزة|غلاسكو|غرداية|فاس|فيفاء|فلورنسا|فرانكفورت|قاهرة|قطيف|قنفذة|قريات|قرطبة|قلقيلية|كويت|كوالالمبور|كربلاء|كابل|كراكوف|لندن|لشبونة|لوس أنجلوس|لوزان|لندن|مكة|مدينة|مكة المكرمة|المدينة المنورة|مسقط|مراكش|مدريد|موسكو|نجران|نابلس|نيويورك|نيروبي|نيس|هفوف|هلسنكي|هونغ كونغ|هرات|واشنطن|وارسو|وهران|ينبع|ياوندي|يافا|الرياض|الدمام|الخبر|الظهران|الطائف|القطيف|الجبيل|الأحساء|الهفوف|الباحة|الدرعية|الخرج|الدوادمي|الزلفي|القنفذة|العلا|المدينة`,
};
const curated = new Map<string, WordEntry>();
const memberships = new Map<string, Set<WordCategory>>();
for (const [category, words] of Object.entries(SEEDS)) {
  for (const word of words.split("|")) {
    const key = spellingKey(word);
    if (!curated.has(key)) curated.set(key, { word, key, category: category as WordCategory });
    const member = memberships.get(key) ?? new Set<WordCategory>();
    member.add(category as WordCategory);
    memberships.set(key, member);
  }
}
let dictionary: Set<string> | null = null;
let loading: Promise<void> | null = null;
export function ensureWordDictionary(): Promise<void> {
  if (dictionary) return Promise.resolve();
  loading ??= import("../../data/sijal-arabic-words")
    .then(({ SIJAL_DICTIONARY_KEYS }) => {
      dictionary = new Set(SIJAL_DICTIONARY_KEYS.split("\n"));
    })
    .catch((error) => {
      loading = null;
      throw error;
    });
  return loading;
}
export function wordDictionaryReady() {
  return dictionary !== null;
}
export function lookupArabicWord(input: string): WordEntry | null {
  const word = cleanArabicWord(input);
  if (word.length > 40 || !/^[\u0621-\u064a\u0671]+(?: [\u0621-\u064a\u0671]+)*$/.test(word))
    return null;
  const key = spellingKey(word);
  if (key.length < 2) return null;
  const entry = curated.get(key) ?? (key.startsWith("ال") ? curated.get(key.slice(2)) : undefined);
  return entry
    ? { ...entry, word, key }
    : dictionary?.has(key)
      ? { word, key, category: "general" }
      : null;
}
export function wordInCategory(key: string, category: WordCategory) {
  return (
    category === "general" ||
    Boolean(memberships.get(key)?.has(category)) ||
    (key.startsWith("ال") && Boolean(memberships.get(key.slice(2))?.has(category)))
  );
}
export function eligibleWords(
  letter: string,
  used: Set<string>,
  category: WordCategory,
): WordEntry[] {
  const prefix = spellingKey(letter);
  if (prefix.length !== 1) return [];
  return [...curated.values()].filter(
    (entry) =>
      entry.key.startsWith(prefix) && !used.has(entry.key) && wordInCategory(entry.key, category),
  );
}
export function availableLetters(used: Set<string>, category: WordCategory): string[] {
  return [
    ...new Set(
      [...curated.values()]
        .filter((entry) => !used.has(entry.key) && wordInCategory(entry.key, category))
        .map((entry) => entry.key[0]),
    ),
  ];
}
export function chooseWordLetter(used: Set<string>, category: WordCategory): string {
  const letters = availableLetters(used, category);
  return letters[Math.floor(Math.random() * letters.length)] ?? "ا";
}
export function wordHint(entry: WordEntry) {
  const letters = cleanArabicWord(entry.word).replace(/ /g, "");
  return `كلمة من ${letters.length} أحرف، حرفها الثاني «${letters[1]}».`;
}
