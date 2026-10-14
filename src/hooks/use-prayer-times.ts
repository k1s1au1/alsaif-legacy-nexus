import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { normalizePrayerCalendar, nextPrayer, nextPrayerDate, prayerCacheKey, prayerCalendarUrl, prayerCountdown, prayerDateParts, prayerLocationKey, readPrayerCalendar, type PrayerLocation } from "@/lib/prayer-times";
import { usePrayerLocation } from "./use-prayer-location";

function useMonth(location: PrayerLocation | undefined, year: number, month: number) {
  return useQuery({
    queryKey: ["prayer-calendar-gps", location ? prayerLocationKey(location) : "", year, month],
    enabled: !!location,
    staleTime: 24 * 60 * 60 * 1000,
    initialData: () => location ? readPrayerCalendar(location, year, month) : undefined,
    queryFn: async ({ signal }) => {
      if (!location) throw new Error("حدد موقعك أولاً");
      const controller = new AbortController();
      const abort = () => controller.abort();
      if (signal.aborted) abort();
      signal.addEventListener("abort", abort, { once: true });
      const timeout = setTimeout(abort, 15000);
      try {
        const response = await fetch(prayerCalendarUrl(location, year, month), { signal: controller.signal });
        if (!response.ok) throw new Error("تعذر تحميل المواقيت");
        const calendar = normalizePrayerCalendar(await response.json(), location, year, month);
        try { localStorage.setItem(prayerCacheKey(location, year, month), JSON.stringify(calendar)); } catch { /* Keep the verified in-memory result. */ }
        return calendar;
      } finally { clearTimeout(timeout); signal.removeEventListener("abort", abort); }
    },
  });
}

export function usePrayerTimes() {
  const gps = usePrayerLocation();
  const location = gps.location;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = setInterval(update, 15000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => { clearInterval(timer); window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", update); };
  }, []);
  // Once verified, the location's timezone takes priority over device settings.
  const timeZone = location?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = prayerDateParts(now, timeZone);
  const tomorrow = nextPrayerDate(today.date);
  const current = useMonth(location, today.year, today.month);
  const following = useMonth(tomorrow.month !== today.month ? location : undefined, tomorrow.year, tomorrow.month);
  const verifiedZone = current.data?.timeZone;
  const locationKey = location ? prayerLocationKey(location) : "";
  useEffect(() => { if (verifiedZone) gps.setTimeZone(locationKey, verifiedZone); }, [locationKey, verifiedZone]);
  const days = [...(current.data?.days || []), ...(following.data?.days || [])];
  const prayer = location ? nextPrayer(days, now) : null;
  const locating = gps.status === "locating";
  const currentLocation = gps.status === "ready" && !!location && now.getTime() - location.obtainedAt < 30 * 60000;
  return { location, locationLabel: currentLocation ? "موقعك الحالي" : "آخر موقع محدد", locating, locationError: gps.error, locate: gps.locate, timeZone: verifiedZone || timeZone, now, date: today.date, today: location ? days.find(day => day.date === today.date) : undefined, prayer, countdown: prayer ? prayerCountdown(prayer.at, now) : "", loading: !!location && (current.isPending || (tomorrow.month !== today.month && following.isPending)), error: current.error || following.error, refreshing: current.isFetching || (tomorrow.month !== today.month && following.isFetching), refresh: () => { if (!location) return; void current.refetch(); if (tomorrow.month !== today.month) void following.refetch(); } };
}
