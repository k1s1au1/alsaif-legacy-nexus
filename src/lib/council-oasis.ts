import { prayerDateParts, validTimeZone, type PrayerDay } from "./prayer-times";

export type OasisPeriod = "day" | "night";

/** Uses solar instants from the existing GPS calendar, never another location request. */
export function councilOasisClock(now: Date, day?: Pick<PrayerDay, "date" | "sunrise" | "sunset">, timeZone = "Asia/Riyadh") {
  const zone = validTimeZone(timeZone) ? timeZone : "Asia/Riyadh";
  const hour = Number(new Intl.DateTimeFormat("en", { timeZone: zone, hour: "2-digit", hourCycle: "h23" }).format(now));
  const sunrise = Date.parse(day?.sunrise || "");
  const sunset = Date.parse(day?.sunset || "");
  const timestamp = now.getTime();
  const solar = day?.date === prayerDateParts(now, zone).date
    && Number.isFinite(sunrise) && Number.isFinite(sunset) && sunrise < sunset
    && prayerDateParts(new Date(sunrise), zone).date === day.date
    && prayerDateParts(new Date(sunset), zone).date === day.date;
  const period: OasisPeriod = solar
    ? timestamp >= sunrise && timestamp < sunset ? "day" : "night"
    : hour >= 6 && hour < 18 ? "day" : "night";
  const nextChangeAt = solar && timestamp < sunrise ? sunrise : solar && timestamp < sunset ? sunset : undefined;
  return {
    period,
    greeting: hour < 12 ? "صباح الخير" : hour < 17 ? "مساء النور" : "مساء الخير",
    nextChangeAt,
    source: solar ? "solar" as const : "clock" as const,
  };
}
