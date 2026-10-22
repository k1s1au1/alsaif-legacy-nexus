import { useRouterState } from "@tanstack/react-router";
import { FamilyServicesPaper } from "@/components/dashboard/family-services-paper";

export function QuickActionsBanner() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isDashboardHome = pathname === "/dashboard" || pathname === "/dashboard/";

  if (!isDashboardHome) return null;

  return <FamilyServicesPaper className="family-services-section" />;
}
