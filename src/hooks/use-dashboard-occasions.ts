import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDayBoundaryKey } from "@/hooks/use-day-boundary";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { listOccasions } from "@/lib/api/occasions";
import { selectUpcomingOccasions } from "@/lib/upcoming-occasions";

export const DASHBOARD_OCCASIONS_QUERY_KEY = ["upcoming-occasions"] as const;

export function useDashboardOccasions(enabled = true) {
  const queryClient = useQueryClient();
  const activeDayKey = useDayBoundaryKey();
  const query = useQuery({
    queryKey: [...DASHBOARD_OCCASIONS_QUERY_KEY, activeDayKey],
    queryFn: async () => {
      // Supabase applies the signed-in member's visibility rules. These options
      // only control edit buttons, which the dashboard does not render.
      const rows = await listOccasions({ userId: null, canManageOccasions: false });
      return selectUpcomingOccasions(rows);
    },
    enabled,
    staleTime: 0,
    refetchInterval: 30_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  useRealtimeSync(
    ["events", "event_invitees"],
    () => void queryClient.invalidateQueries({ queryKey: DASHBOARD_OCCASIONS_QUERY_KEY }),
    enabled,
  );

  return query;
}
