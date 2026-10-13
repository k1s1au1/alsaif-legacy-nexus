import { useEffect, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { PRAYER_CITIES, PRAYER_CITY_EVENT, PRAYER_CITY_KEY, normalizePrayerCalendar, nextPrayer, prayerCacheKey, prayerCalendarUrl, prayerCountdown, readPrayerCalendar, saudiDateParts, type PrayerCity } from "@/lib/prayer-times";

let cityInMemory: string | null = null;
function readCityId(): string {
  if (cityInMemory !== null) return cityInMemory;
  try { return localStorage.getItem(PRAYER_CITY_KEY) || ""; } catch { return ""; }
}
function subscribeCity(listener: () => void) {
  const storage = (event: StorageEvent) => { if (event.key === PRAYER_CITY_KEY || event.key === null) { cityInMemory = null; listener(); } };
  window.addEventListener("storage", storage);
  window.addEventListener(PRAYER_CITY_EVENT, listener);
  return () => { window.removeEventListener("storage", storage); window.removeEventListener(PRAYER_CITY_EVENT, listener); };
}
export function setPrayerCity(id: string) {
  if (!PRAYER_CITIES.some((city) => city.id === id)) return;
  cityInMemory = id;
  try { localStorage.setItem(PRAYER_CITY_KEY, id); } catch { /* Stored preferences are optional. */ }
  window.dispatchEvent(new Event(PRAYER_CITY_EVENT));
}

function useMonth(city: PrayerCity | undefined, year: number, month: number) {
  return useQuery({
    queryKey: ["prayer-calendar", city?.id, year, month],
    enabled: !!city,
    staleTime: 24 * 60 * 60 * 1000,
    initialData: () => city ? readPrayerCalendar(city, year, month) : undefined,
    queryFn: async ({ signal }) => {
      if (!city) throw new Error("اختر مدينتك أولاً");
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal.addEventListener("abort", abort, { once: true });
      const timeout = setTimeout(abort, 15000);
      try {
        const response = await fetch(prayerCalendarUrl(city, year, month), { signal: controller.signal });
        if (!response.ok) throw new Error("تعذر تحميل المواقيت");
        const calendar = normalizePrayerCalendar(await response.json(), city, year, month);
        try { localStorage.setItem(prayerCacheKey(city.id, year, month), JSON.stringify(calendar)); } catch { /* Keep the verified in-memory result. */ }
        return calendar;
      } finally { clearTimeout(timeout); signal.removeEventListener("abort", abort); }
    },
  });
}

export function usePrayerTimes() {
  const id = useSyncExternalStore(subscribeCity, readCityId, () => "");
  const city = PRAYER_CITIES.find((item) => item.id === id);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = setInterval(update, 15000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => { clearInterval(timer); window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", update); };
  }, []);
  const today = saudiDateParts(now);
  const tomorrow = saudiDateParts(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const current = useMonth(city, today.year, today.month);
  const following = useMonth(tomorrow.month !== today.month ? city : undefined, tomorrow.year, tomorrow.month);
  const days = [...(current.data?.days || []), ...(following.data?.days || [])];
  const prayer = nextPrayer(days, now);
  return { city, now, date: today.date, today: days.find((day) => day.date === today.date), prayer, countdown: prayer ? prayerCountdown(prayer.at, now) : "", loading: !!city && (current.isPending || (tomorrow.month !== today.month && following.isPending)), error: current.error || following.error, refreshing: current.isFetching || (tomorrow.month !== today.month && following.isFetching), refresh: () => { void current.refetch(); if (tomorrow.month !== today.month) void following.refetch(); } };
}
