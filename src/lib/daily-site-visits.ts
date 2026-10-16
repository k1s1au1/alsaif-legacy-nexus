import { supabase } from "@/integrations/supabase/client";

export const DAILY_VISITS_QUERY_KEY = ["daily-site-visits"] as const;
export const SAUDI_VISIT_TIME_ZONE = "Asia/Riyadh";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SAUDI_VISIT_TIME_ZONE,
  year: "numeric", month: "2-digit", day: "2-digit",
});

export function saudiVisitDay(now = new Date()): string {
  const parts = dayFormatter.formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function millisecondsUntilSaudiMidnight(now = new Date()): number {
  const midnight = Date.parse(`${saudiVisitDay(now)}T00:00:00+03:00`);
  return Math.max(50, midnight + 86_400_000 - now.getTime() + 50);
}

export type DailyVisitSummary = { visit_date: string; visitor_count: number };
function summary(data: any): DailyVisitSummary {
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data.visit_date)
    || !Number.isSafeInteger(data.visitor_count) || data.visitor_count < 0) {
    throw new Error("تعذر قراءة عدد زوار اليوم");
  }
  return { visit_date: data.visit_date, visitor_count: data.visitor_count };
}

export async function fetchTodayVisitCount(): Promise<DailyVisitSummary> {
  // POST RPC reads are deliberately not served from yesterday's offline cache.
  const { data, error } = await supabase.rpc("get_today_site_visit_count");
  if (error) throw error;
  return summary(data);
}
