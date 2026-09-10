import { NAV_REGISTRY, type NavItemDef, type NavItemKey } from "@/lib/navigation-registry";

const ACTIVE_OFFLINE_USER_KEY = "alsaif:offline:active-user";
const PUBLIC_GUEST_KEYS = new Set<NavItemKey>(["dashboard", "profile", "settings", "members"]);
const MAX_CONCURRENT_PRELOADS = 3;

export type OfflineRoutePermissions = {
  isGuest: boolean;
  allowedSections: string[];
  canAccessAdmin: boolean;
};

type WarmOfflineRoutesOptions = {
  userId: string;
  routes: string[];
  preloadRoute?: (route: string) => Promise<unknown>;
};

function canUseNavigationItem(item: NavItemDef, permissions: OfflineRoutePermissions): boolean {
  if (item.adminOnly) return permissions.canAccessAdmin;
  if (!permissions.isGuest) return true;
  if (PUBLIC_GUEST_KEYS.has(item.id)) return true;
  return permissions.allowedSections.includes(item.id);
}

function uniqueRoutes(routes: string[]): string[] {
  return [...new Set(routes.filter((route) => route.startsWith("/")))];
}

export function getAuthorizedOfflineRoutes(permissions: OfflineRoutePermissions): string[] {
  return uniqueRoutes(
    NAV_REGISTRY.filter((item) => canUseNavigationItem(item, permissions)).map((item) => item.to),
  );
}

async function activeServiceWorker(): Promise<ServiceWorker | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  if (navigator.serviceWorker.controller) return navigator.serviceWorker.controller;
  const registration = await navigator.serviceWorker.ready.catch(() => null);
  return registration?.active ?? null;
}

async function preloadInBatches(
  routes: string[],
  preloadRoute: (route: string) => Promise<unknown>,
): Promise<void> {
  for (let index = 0; index < routes.length; index += MAX_CONCURRENT_PRELOADS) {
    const batch = routes.slice(index, index + MAX_CONCURRENT_PRELOADS);
    await Promise.allSettled(batch.map((route) => preloadRoute(route)));
  }
}

/**
 * Warms route modules first, then asks the service worker to cache the authorized
 * navigation documents in a per-user cache. The caller should invoke this after
 * the authenticated shell is visible so login is never blocked.
 */
export async function warmAuthorizedOfflineRoutes({
  userId,
  routes,
  preloadRoute,
}: WarmOfflineRoutesOptions): Promise<void> {
  if (typeof window === "undefined" || !userId) return;

  const safeRoutes = uniqueRoutes(routes);
  if (!safeRoutes.length) return;

  try {
    localStorage.setItem(ACTIVE_OFFLINE_USER_KEY, userId);
  } catch {
    // Storage availability must never affect normal navigation.
  }

  if (preloadRoute) {
    await preloadInBatches(safeRoutes, preloadRoute);
  }

  const worker = await activeServiceWorker();
  worker?.postMessage({ type: "SET_OFFLINE_USER", userId });
  worker?.postMessage({ type: "WARM_OFFLINE_ROUTES", userId, urls: safeRoutes });
}

/**
 * Schedule the warm-up after first paint and return a cancellation callback.
 * A short delay keeps authentication and the initial dashboard render responsive.
 */
export function scheduleAuthorizedOfflineWarmup(options: WarmOfflineRoutesOptions): () => void {
  if (typeof window === "undefined") return () => undefined;

  let cancelled = false;
  let idleId: number | null = null;
  let timeoutId: number | null = null;

  const run = () => {
    if (cancelled) return;
    void warmAuthorizedOfflineRoutes(options);
  };

  const requestIdle = (
    window as typeof window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    }
  ).requestIdleCallback;

  if (requestIdle) {
    idleId = requestIdle(run, { timeout: 2500 });
  } else {
    timeoutId = window.setTimeout(run, 900);
  }

  return () => {
    cancelled = true;
    const cancelIdle = (
      window as typeof window & { cancelIdleCallback?: (handle: number) => void }
    ).cancelIdleCallback;
    if (idleId !== null) cancelIdle?.(idleId);
    if (timeoutId !== null) window.clearTimeout(timeoutId);
  };
}

export function getActiveOfflineUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACTIVE_OFFLINE_USER_KEY);
  } catch {
    return null;
  }
}

export function clearActiveOfflineUserId(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ACTIVE_OFFLINE_USER_KEY);
  } catch {
    // Best-effort cleanup only.
  }
}
