import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    // Built-in scroll restoration is disabled: RouteScrollManager handles all
    // route-change scrolling pre-paint (single handler, no duplicates).
    scrollRestoration: false,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
