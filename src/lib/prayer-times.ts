export const PRAYER_NAMES = { Fajr: "الفجر", Dhuhr: "الظهر", Asr: "العصر", Maghrib: "المغرب", Isha: "العشاء" } as const;
export type PrayerKey = keyof typeof PRAYER_NAMES;
export const PRAYER_KEYS = Object.keys(PRAYER_NAMES) as PrayerKey[];
export type PrayerLocation = { latitude: number; longitude: number; accuracy: number; obtainedAt: number; timeZone?: string };
export type PrayerDay = { date: string; timings: Record<PrayerKey, string>; sunrise?: string; sunset?: string };
export type PrayerCalendar = { locationKey: string; year: number; month: number; method: 4; timeZone: string; days: PrayerDay[] };

export function validTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: value }).format(); return true; } catch { return false; }
}

export function normalizePrayerLocation(value: unknown): PrayerLocation | undefined {
  if (!value || typeof value !== "object") return undefined;
  const item = value as PrayerLocation;
  if (!Number.isFinite(item.latitude) || Math.abs(item.latitude) > 90 || !Number.isFinite(item.longitude) || Math.abs(item.longitude) > 180 || !Number.isFinite(item.accuracy) || item.accuracy < 0 || !Number.isFinite(item.obtainedAt) || item.obtainedAt <= 0 || item.obtainedAt > Date.now() + 60000) return undefined;
  // About 100 m resolution is sufficient for prayer calculation; do not keep
  // altitude, heading, speed or the device's full-precision coordinates.
  return { latitude: Number(item.latitude.toFixed(3)), longitude: Number(item.longitude.toFixed(3)), accuracy: item.accuracy, obtainedAt: item.obtainedAt, ...(validTimeZone(item.timeZone) ? { timeZone: item.timeZone } : {}) };
}

export function prayerLocationKey(location: Pick<PrayerLocation, "latitude" | "longitude">) {
  return `${location.latitude.toFixed(3)},${location.longitude.toFixed(3)}`;
}

export function prayerDateParts(now = new Date(), timeZone = "Asia/Riyadh") {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = (key: string) => parts.find((part) => part.type === key)?.value || "";
  return { year: Number(value("year")), month: Number(value("month")), date: `${value("year")}-${value("month")}-${value("day")}` };
}
export const saudiDateParts = (now = new Date()) => prayerDateParts(now, "Asia/Riyadh");

export function nextPrayerDate(date: string) {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return prayerDateParts(next, "UTC");
}

export function prayerCalendarUrl(location: PrayerLocation, year: number, month: number) {
  const params = new URLSearchParams({ latitude: location.latitude.toFixed(3), longitude: location.longitude.toFixed(3), method: "4", iso8601: "true" });
  // The provider resolves timezone from these coordinates, including travel.
  return `https://api.aladhan.com/v1/calendar/${year}/${month}?${params}`;
}

export function normalizePrayerCalendar(payload: unknown, location: PrayerLocation, year: number, month: number): PrayerCalendar {
  const response = payload as { code?: number; data?: Array<{ timings?: Record<string, string>; date?: { gregorian?: { date?: string } }; meta?: { latitude?: number; longitude?: number; method?: { id?: number }; timezone?: string } }> };
  const expectedDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (response?.code !== 200 || !Array.isArray(response.data) || response.data.length !== expectedDays) throw new Error("تعذر التحقق من مواقيت هذا الشهر");
  const timeZone = response.data[0]?.meta?.timezone;
  if (!validTimeZone(timeZone)) throw new Error("تعذر التحقق من توقيت الموقع");
  const localTime = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const days = response.data.map((item, index) => {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`;
    const suppliedDate = item.date?.gregorian?.date?.split("-").reverse().join("-");
    const meta = item.meta;
    if (suppliedDate !== date || meta?.method?.id !== 4 || meta?.timezone !== timeZone || !Number.isFinite(meta.latitude) || !Number.isFinite(meta.longitude) || Math.abs(meta.latitude! - location.latitude) > 0.0001 || Math.abs(meta.longitude! - location.longitude) > 0.0001) throw new Error("تعذر التحقق من الموقع وطريقة الحساب");
    const timings = {} as Record<PrayerKey, string>;
    for (const key of PRAYER_KEYS) {
      const value = item.timings?.[key];
      if (typeof value !== "string" || !new RegExp(`^${date}T\\d{2}:\\d{2}:\\d{2}[+-]\\d{2}:\\d{2}$`).test(value) || !Number.isFinite(Date.parse(value))) throw new Error("ورد وقت غير صالح للصلاة");
      const parts = localTime.formatToParts(new Date(value));
      const part = (name: string) => parts.find(item => item.type === name)?.value;
      if (`${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}` !== value.slice(0, 16)) throw new Error("ورد توقيت لا يطابق موقعك");
      timings[key] = value;
    }
    // Solar metadata is optional: older caches and missing fields must not
    // prevent the five verified prayer times from loading.
    const solarTime = (value: unknown): value is string => {
      if (typeof value !== "string" || !new RegExp(`^${date}T\\d{2}:\\d{2}:\\d{2}[+-]\\d{2}:\\d{2}$`).test(value) || !Number.isFinite(Date.parse(value))) return false;
      const parts = localTime.formatToParts(new Date(value));
      const part = (name: string) => parts.find(item => item.type === name)?.value;
      return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}` === value.slice(0, 16);
    };
    const sunrise = item.timings?.Sunrise;
    const sunset = item.timings?.Sunset;
    const daylight = solarTime(sunrise) && solarTime(sunset) && Date.parse(sunrise) < Date.parse(sunset) ? { sunrise, sunset } : {};
    return { date, timings, ...daylight };
  });
  return { locationKey: prayerLocationKey(location), year, month, method: 4, timeZone, days };
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

export function formatPrayerTime(value: string | Date, timeZone = "Asia/Riyadh") {
  return new Intl.DateTimeFormat("ar-SA", { timeZone, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(value));
}

export function prayerCacheKey(location: PrayerLocation, year: number, month: number) { return `alsaif:prayer-calendar:v2:${prayerLocationKey(location)}:${year}:${month}`; }

export function readPrayerCalendar(location: PrayerLocation, year: number, month: number): PrayerCalendar | undefined {
  if (typeof localStorage === "undefined") return undefined;
  try {
    const saved = JSON.parse(localStorage.getItem(prayerCacheKey(location, year, month)) || "null") as PrayerCalendar | null;
    if (!saved || saved.locationKey !== prayerLocationKey(location) || saved.year !== year || saved.month !== month || saved.method !== 4 || !validTimeZone(saved.timeZone)) return undefined;
    return normalizePrayerCalendar({ code: 200, data: saved.days.map((day) => ({ timings: { ...day.timings, ...(day.sunrise ? { Sunrise: day.sunrise } : {}), ...(day.sunset ? { Sunset: day.sunset } : {}) }, date: { gregorian: { date: day.date.split("-").reverse().join("-") } }, meta: { latitude: location.latitude, longitude: location.longitude, method: { id: 4 }, timezone: saved.timeZone } })) }, location, year, month);
  } catch { return undefined; }
}
