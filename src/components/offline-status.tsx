import { CloudCheck, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

const WORKER_PATH = "/firebase-messaging-sw.js";

function formatLastSync(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("ar-SA", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
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
          !url.pathname.includes("/auth/v1/")
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
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [connectionRestored, setConnectionRestored] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem("alsaif:last-online-sync"),
  );

  useEffect(() => {
    let restoredTimer: ReturnType<typeof setTimeout> | undefined;

    const handleOffline = () => {
      setOnline(false);
      setConnectionRestored(false);
    };
    const handleOnline = () => {
      setOnline(true);
      setConnectionRestored(true);
      restoredTimer = setTimeout(() => setConnectionRestored(false), 3500);
    };
    const handleSync = (event: Event) => {
      const timestamp = (event as CustomEvent<string>).detail;
      setLastSync(timestamp);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    window.addEventListener("alsaif:online-sync", handleSync);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("alsaif:online-sync", handleSync);
      if (restoredTimer) clearTimeout(restoredTimer);
    };
  }, []);

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
