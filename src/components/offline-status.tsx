import { useRouter } from "@tanstack/react-router";
import { CloudCheck, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUserRole } from "@/hooks/use-user-role";
import { supabase } from "@/integrations/supabase/client";
import {
  getAuthorizedOfflineRoutes,
  scheduleAuthorizedOfflineWarmup,
} from "@/lib/offline-route-warmup";

const WORKER_PATH = "/firebase-messaging-sw.js";
const PROBE_INTERVAL_MS = 30_000;
const PROBE_TIMEOUT_MS = 4_000;

function formatLastSync(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("ar-SA", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/**
 * Android's navigator.onLine can report false even when the device is online.
 * A unique, uncached request to our own origin is the reliable source of truth.
 */
async function canReachAppServer() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(
      `/manifest.json?__alsaif_network_probe=${Date.now()}`,
      {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      },
    );
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function warmCurrentApp(registration: ServiceWorkerRegistration) {
  const resourceUrls = performance
    .getEntriesByType("resource")
    .map((entry) => entry.name)
    .filter((value) => {
      try {
        const url = new URL(value);
        return (
          (url.protocol === "https:" || url.protocol === "http:") &&
          !url.pathname.includes("/rest/v1/") &&
          !url.pathname.includes("/auth/v1/") &&
          !url.searchParams.has("__alsaif_network_probe")
        );
      } catch {
        return false;
      }
    })
    .slice(0, 100);

  const urls = Array.from(
    new Set(["/", window.location.pathname, "/manifest.json", "/logo-home.png", ...resourceUrls]),
  );

  const worker =
    navigator.serviceWorker.controller ??
    registration.active ??
    registration.waiting ??
    registration.installing;

  worker?.postMessage({ type: "WARM_OFFLINE_CACHE", urls });
}

export function OfflineStatus() {
  // Start silently and confirm the real connection before showing anything.
  const [online, setOnline] = useState(true);
  const [connectionRestored, setConnectionRestored] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem("alsaif:last-online-sync"),
  );
  const [guestAllowedSections, setGuestAllowedSections] = useState<string[]>([]);
  const [guestPermissionsUserId, setGuestPermissionsUserId] = useState<string | null>(null);

  const router = useRouter();
  const roleAccess = useUserRole();
  const onlineRef = useRef(true);
  const restoredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const probeSequenceRef = useRef(0);

  const applyConnectionState = useCallback((reachable: boolean, announceRecovery = true) => {
    const wasOnline = onlineRef.current;
    onlineRef.current = reachable;
    setOnline(reachable);

    if (!reachable) {
      setConnectionRestored(false);
      if (restoredTimerRef.current) clearTimeout(restoredTimerRef.current);
      restoredTimerRef.current = null;
      return;
    }

    if (!wasOnline && announceRecovery) {
      setConnectionRestored(true);
      if (restoredTimerRef.current) clearTimeout(restoredTimerRef.current);
      restoredTimerRef.current = setTimeout(() => {
        setConnectionRestored(false);
        restoredTimerRef.current = null;
      }, 3500);
    }
  }, []);

  const verifyConnection = useCallback(
    async (announceRecovery = true) => {
      const sequence = ++probeSequenceRef.current;
      const reachable = await canReachAppServer();
      if (sequence !== probeSequenceRef.current) return;
      applyConnectionState(reachable, announceRecovery);
    },
    [applyConnectionState],
  );

  useEffect(() => {
    const handleNetworkChange = () => {
      void verifyConnection(true);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void verifyConnection(true);
    };
    const handleSync = (event: Event) => {
      const timestamp = (event as CustomEvent<string>).detail;
      setLastSync(timestamp);
      // A successful API response is stronger evidence than navigator.onLine.
      applyConnectionState(true, true);
    };

    void verifyConnection(false);

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void verifyConnection(true);
    }, PROBE_INTERVAL_MS);

    window.addEventListener("offline", handleNetworkChange);
    window.addEventListener("online", handleNetworkChange);
    window.addEventListener("focus", handleNetworkChange);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("alsaif:online-sync", handleSync);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("offline", handleNetworkChange);
      window.removeEventListener("online", handleNetworkChange);
      window.removeEventListener("focus", handleNetworkChange);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("alsaif:online-sync", handleSync);
      if (restoredTimerRef.current) clearTimeout(restoredTimerRef.current);
    };
  }, [applyConnectionState, verifyConnection]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register(WORKER_PATH, { scope: "/" });
        await navigator.serviceWorker.ready;
        await warmCurrentApp(registration);
      } catch (error) {
        console.warn("[Offline] Service worker registration failed", error);
      }
    };

    if (document.readyState === "complete") {
      void register();
      return;
    }

    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  // Guest visibility is stored on the profile, while all role/section-head access
  // comes from the same authoritative hook used by the authenticated app shell.
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

  // Once authentication/permissions settle, preload every route this user can
  // actually reach. preloadRoute loads route chunks/loaders without changing URL.
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
        await (router.preloadRoute as (options: { to: string }) => Promise<unknown>)({ to: route });
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

  if (online && !connectionRestored) return null;

  const syncTime = formatLastSync(lastSync);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-[10000] mx-auto flex w-fit max-w-[calc(100vw-1.5rem)] items-center gap-3 rounded-2xl border border-white/15 bg-[#073f31]/95 px-4 py-3 text-right text-white shadow-2xl backdrop-blur-xl md:bottom-6"
      dir="rtl"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 text-[#e2bd68]">
        {online ? <CloudCheck size={19} /> : <WifiOff size={19} />}
      </span>
      <span className="min-w-0">
        <strong className="block text-sm font-black">
          {online ? "عاد الاتصال بالإنترنت" : "أنت الآن دون اتصال"}
        </strong>
        <span className="block text-[11px] font-bold text-white/70">
          {online
            ? "سيتم تحديث البيانات تلقائياً"
            : syncTime
              ? `نعرض آخر بيانات محفوظة · آخر تحديث ${syncTime}`
              : "نعرض الصفحات والبيانات المحفوظة على هذا الجهاز"}
        </span>
      </span>
    </div>
  );
}
