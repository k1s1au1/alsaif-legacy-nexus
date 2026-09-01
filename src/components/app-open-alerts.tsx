import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isFamilyOccasionEvent } from "@/lib/family-occasion-events";
import {
  isFamilyOccasionActive,
  startOfLocalTodayIso,
} from "@/lib/day-lifecycle";

const SESSION_KEY = "alsaif:app-open-alerts";

/**
 * Shows a short summary alert once per app-open (session):
 * - pending membership requests (admins / chairman only)
 * - upcoming family occasions within the next 14 days
 */
export function AppOpenAlerts() {
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        if (sessionStorage.getItem(SESSION_KEY)) return;

        const { data: u } = await supabase.auth.getUser();
        if (!u?.user || cancelled) return;
        sessionStorage.setItem(SESSION_KEY, "1");

        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", u.user.id);
        const isPriv = (roles ?? []).some((r: any) => ["admin", "chairman"].includes(r.role));

        if (isPriv) {
          const { count } = await supabase
            .from("account_requests")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending");
          if (!cancelled && (count ?? 0) > 0) {
            toast.info(`لديك ${count} طلب عضوية بانتظار المراجعة`, {
              description: "افتح لوحة الإدارة › إشعارات العضوية",
              duration: 8000,
              action: {
                label: "مراجعة",
                onClick: () => {
                  window.location.href = "/admin";
                },
              },
            });
          }
        }

        const now = new Date();
        const until = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        const { data: occasionRows } = await supabase
          .from("events")
          .select("id,title,starts_at,ends_at,event_type,status,description")
          .eq("status", "scheduled")
          .gte("starts_at", startOfLocalTodayIso(now))
          .lte("starts_at", until.toISOString())
          .order("starts_at")
          .limit(30);

        const occasions = (occasionRows || [])
          .filter(
            (occasion: any) =>
              isFamilyOccasionEvent(occasion) &&
              isFamilyOccasionActive(occasion, now),
          )
          .slice(0, 3);

        if (!cancelled && occasions.length > 0) {
          const first = occasions[0];
          const when = new Intl.DateTimeFormat("ar-SA", {
            weekday: "long",
            day: "numeric",
            month: "long",
          }).format(new Date(first.starts_at));
          toast.success(
            occasions.length > 1
              ? `${occasions.length} مناسبات عائلية قادمة`
              : "مناسبة عائلية قادمة",
            {
              description: `${first.title} — ${when}`,
              duration: 8000,
              action: {
                label: "عرض",
                onClick: () => {
                  window.location.href = "/family-occasions";
                },
              },
            },
          );
        }
      } catch (e) {
        console.warn("AppOpenAlerts error", e);
      }
    };

    const timer = setTimeout(run, 1800);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return null;
}
