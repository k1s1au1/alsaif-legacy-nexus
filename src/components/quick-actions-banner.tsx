import { useRouterState } from "@tanstack/react-router";
import { OasisFamilyServices } from "@/components/dashboard/oasis-family-services";

export function QuickActionsBanner() {
  const pathname = useRouterState({ select: state => state.location.pathname });
  if (pathname !== "/dashboard" && pathname !== "/dashboard/") return null;
  return <OasisFamilyServices />;
}
