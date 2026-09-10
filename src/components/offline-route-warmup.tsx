import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useUserRole } from "@/hooks/use-user-role";
import { supabase } from "@/integrations/supabase/client";
import {
  getAuthorizedOfflineRoutes,
  scheduleAuthorizedOfflineWarmup,
} from "@/lib/offline-route-warmup";

/**
 * Authenticated-only route warmer. It preloads permitted TanStack routes after
 * the shell has rendered, without navigating or changing the current URL.
 */
export function OfflineRouteWarmup() {
  const router = useRouter();
  const roleAccess = useUserRole();
  const [guestAllowedSections, setGuestAllowedSections] = useState<string[]>([]);
  const [guestPermissionsUserId, setGuestPermissionsUserId] = useState<string | null>(null);

  useEffect(() => {
    const userId = roleAccess.userId;
    if (!userId || !roleAccess.isGuest) {
      setGuestAllowedSections([]);
      setGuestPermissionsUserId(userId ?? null);
      return;
    }

    let active = true;
    setGuestPermissionsUserId(null);

    void supabase
      .from("profiles")
      .select("allowed_sections")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setGuestAllowedSections((data?.allowed_sections as string[] | null) ?? []);
        setGuestPermissionsUserId(userId);
      });

    return () => {
      active = false;
    };
  }, [roleAccess.isGuest, roleAccess.userId]);

  useEffect(() => {
    const userId = roleAccess.userId;
    if (!userId || roleAccess.isLoading) return;
    if (roleAccess.isGuest && guestPermissionsUserId !== userId) return;

    const canAccessAdmin =
      roleAccess.isCouncilLeadership ||
      roleAccess.isTechnicalAdmin ||
      roleAccess.sectionHeads.length > 0;

    const routes = getAuthorizedOfflineRoutes({
      isGuest: roleAccess.isGuest,
      allowedSections: guestAllowedSections,
      canAccessAdmin,
    });

    return scheduleAuthorizedOfflineWarmup({
      userId,
      routes,
      preloadRoute: async (route) => {
        await (router as any).preloadRoute({ to: route });
      },
    });
  }, [
    guestAllowedSections,
    guestPermissionsUserId,
    roleAccess.isCouncilLeadership,
    roleAccess.isGuest,
    roleAccess.isLoading,
    roleAccess.isTechnicalAdmin,
    roleAccess.sectionHeads,
    roleAccess.userId,
    router,
  ]);

  return null;
}
