import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DAILY_VISITS_QUERY_KEY,
  fetchTodayVisitCount,
  millisecondsUntilSaudiMidnight,
  saudiVisitDay,
} from "@/lib/daily-site-visits";

/** Saudi midnight, even if the member's device uses a different time zone. */
function useSaudiVisitDay() {
  const [day, setDay] = useState(() => saudiVisitDay());
  useEffect(() => {
    let timer: number;
    const refresh = () => {
      setDay(saudiVisitDay());
      window.clearTimeout(timer);
      timer = window.setTimeout(refresh, millisecondsUntilSaudiMidnight());
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return day;
}

const refreshOptions = {
  staleTime: 10_000,
  refetchInterval: 30_000,
  refetchOnWindowFocus: "always" as const,
  refetchOnReconnect: "always" as const,
  retry: 1,
};

export function useTodayVisitorCount(): number | null {
  const day = useSaudiVisitDay();
  const query = useQuery({
    queryKey: [...DAILY_VISITS_QUERY_KEY, "count", day],
    queryFn: fetchTodayVisitCount,
    ...refreshOptions,
  });
  // A separate key for every day prevents yesterday's successful result lingering
  // while the new day's request is pending or the device is offline.
  return query.data?.visit_date === day ? query.data.visitor_count : null;
}
