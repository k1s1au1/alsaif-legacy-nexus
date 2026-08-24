import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { RoutePendingScreen } from "./components/route-pending-screen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    // Built-in scroll restoration is disabled: RouteScrollManager handles all
    // route-change scrolling pre-paint (single handler, no duplicates).
    scrollRestoration: false,
    // Replace stale route content immediately while the destination route is
    // loading. Without this, the router's default delay leaves the previous
    // page visible for a moment and makes it appear to flash or reopen.
    defaultPendingComponent: RoutePendingScreen,
    defaultPendingMs: 0,
    defaultPendingMinMs: 180,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });

  return router;
};
