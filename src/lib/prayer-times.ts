export const PRAYER_NAMES = { Fajr: "الفجر", Dhuhr: "الظهر", Asr: "العصر", Maghrib: "المغرب", Isha: "العشاء" } as const;
export type PrayerKey = keyof typeof PRAYER_NAMES;
export const PRAYER_KEYS = Object.keys(PRAYER_NAMES) as PrayerKey[];
export const PRAYER_CITIES = [
  { id: "riyadh", name: "الرياض", query: "Riyadh" },
  { id: "makkah", name: "مكة المكرمة", query: "Makkah" },
  { id: "madinah", name: "المدينة المنورة", query: "Madinah" },
  { id: "jeddah", name: "جدة", query: "Jeddah" },
  { id: "dammam", name: "الدمام", query: "Dammam" },
  { id: "khobar", name: "الخبر", query: "Al Khobar" },
  { id: "taif", name: "الطائف", query: "Taif" },
  { id: "abha", name: "أبها", query: "Abha" },
  { id: "tabuk", name: "تبوك", query: "Tabuk" },
  { id: "hail", name: "حائل", query: "Hail" },
  { id: "buraydah", name: "بريدة", query: "Buraydah" },
  { id: "najran", name: "نجران", query: "Najran" },
  { id: "jazan", name: "جازان", query: "Jazan" },
  { id: "baha", name: "الباحة", query: "Al Baha" },
  { id: "hofuf", name: "الهفوف", query: "Al Hofuf" },
  { id: "qatif", name: "القطيف", query: "Al Qatif" },
  { id: "sakaka", name: "سكاكا", query: "Sakaka" },
  { id: "arar", name: "عرعر", query: "Arar" },
  { id: "qurayyat", name: "القريات", query: "Al Qurayyat" },
  { id: "ula", name: "العلا", query: "Al Ula" },
] as const;
export type PrayerCity = (typeof PRAYER_CITIES)[number];
export type PrayerDay = { date: string; timings: Record<PrayerKey, string> };
export type PrayerCalendar = { cityId: string; year: number; month: number; method: 4; days: PrayerDay[] };
export const PRAYER_CITY_KEY = "alsaif:prayer-city:v1";
export const PRAYER_CITY_EVENT = "alsaif:prayer-city-changed";

export function saudiDateParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = (key: string) => parts.find((part) => part.type === key)?.value || "";
  return { year: Number(value("year")), month: Number(value("month")), date: `${value("year")}-${value("month")}-${value("day")}` };
}

export function prayerCalendarUrl(city: PrayerCity, year: number, month: number) {
  const params = new URLSearchParams({ city: city.query, country: "Saudi Arabia", method: "4", iso8601: "true" });
  return `https://api.aladhan.com/v1/calendarByCity/${year}/${month}?${params}`;
}

export function normalizePrayerCalendar(payload: unknown, city: PrayerCity, year: number, month: number): PrayerCalendar {
  const response = payload as { code?: number; data?: Array<{ timings?: Record<string, string>; date?: { gregorian?: { date?: string } }; meta?: { method?: { id?: number }; timezone?: string } }> };
  const expectedDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (response?.code !== 200 || !Array.isArray(response.data) || response.data.length !== expectedDays) throw new Error("تعذر التحقق من مواقيت هذا الشهر");
  const days = response.data.map((item, index) => {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`;
    const suppliedDate = item.date?.gregorian?.date?.split("-").reverse().join("-");
    if (suppliedDate !== date || item.meta?.method?.id !== 4 || item.meta?.timezone !== "Asia/Riyadh") throw new Error("تعذر التحقق من المدينة وطريقة الحساب");
    const timings = {} as Record<PrayerKey, string>;
    for (const key of PRAYER_KEYS) {
      const value = item.timings?.[key];
      if (typeof value !== "string" || !value.startsWith(`${date}T`) || !value.endsWith("+03:00") || !Number.isFinite(Date.parse(value))) throw new Error("ورد وقت غير صالح للصلاة");
      timings[key] = value;
    }
    return { date, timings };
  });
  return { cityId: city.id, year, month, method: 4, days };
}

export function nextPrayer(days: PrayerDay[], now: Date) {
  const timestamp = now.getTime();
  const candidates = days.flatMap((day) => PRAYER_KEYS.map((key) => ({ key, name: PRAYER_NAMES[key], at: new Date(day.timings[key]), date: day.date })))
    .filter((prayer) => Number.isFinite(prayer.at.getTime()) && prayer.at.getTime() >= timestamp)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  return candidates[0] || null;
}

export function prayerCountdown(at: Date, now: Date) {
  const minutes = Math.max(0, Math.ceil((at.getTime() - now.getTime()) / 60000));
  if (!minutes) return "حان وقت الصلاة";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  const fmt = new Intl.NumberFormat("ar-SA");
  return `باقي ${[hours ? `${fmt.format(hours)} ${hours >= 3 && hours <= 10 ? "ساعات" : "ساعة"}` : "", remainder ? `${fmt.format(remainder)} دقيقة` : ""].filter(Boolean).join(" و")}`;
}

export function formatPrayerTime(value: string | Date) {
  return new Intl.DateTimeFormat("ar-SA", { timeZone: "Asia/Riyadh", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(value));
}

export function prayerCacheKey(cityId: string, year: number, month: number) { return `alsaif:prayer-calendar:v1:${cityId}:${year}:${month}`; }

export function readPrayerCalendar(city: PrayerCity, year: number, month: number): PrayerCalendar | undefined {
  if (typeof localStorage === "undefined") return undefined;
  try {
    const saved = JSON.parse(localStorage.getItem(prayerCacheKey(city.id, year, month)) || "null") as PrayerCalendar | null;
    if (!saved || saved.cityId !== city.id || saved.year !== year || saved.month !== month || saved.method !== 4) return undefined;
    // Validate cached data by the same rules as the network response.
    return normalizePrayerCalendar({ code: 200, data: saved.days.map((day) => ({ timings: day.timings, date: { gregorian: { date: day.date.split("-").reverse().join("-") } }, meta: { method: { id: 4 }, timezone: "Asia/Riyadh" } })) }, city, year, month);
  } catch { return undefined; }
}
