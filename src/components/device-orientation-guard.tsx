import { useEffect, useMemo, useState } from "react";
import { Smartphone, Tablet, RotateCw } from "lucide-react";
import { DesktopDashboardExtras } from "@/components/dashboard/desktop-dashboard-extras";

type DeviceKind = "mobile" | "tablet" | "desktop";

function smallestPhysicalSide() {
  if (typeof window === "undefined") return 9999;
  return Math.min(
    window.screen?.width || window.innerWidth,
    window.screen?.height || window.innerHeight,
  );
}

/**
 * Chrome/Android's "Desktop site" keeps the device physically phone-sized but
 * exposes a desktop-like CSS viewport (normally ~980px). Detect that combination
 * instead of relying on UA alone, because modern Chrome may keep a mobile UA hint.
 */
function isBrowserDesktopSiteRequest() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const touchPoints = navigator.maxTouchPoints || 0;
  const touch = touchPoints > 0 || "ontouchstart" in window;
  const phoneHardware = smallestPhysicalSide() <= 600;
  const desktopLikeViewport = window.innerWidth >= 900;
  return touch && phoneHardware && desktopLikeViewport;
}

function detectDeviceKind(): DeviceKind {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "desktop";

  // If the user explicitly requested the browser's desktop-site mode, respect it.
  if (isBrowserDesktopSiteRequest()) return "desktop";

  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const touchPoints = navigator.maxTouchPoints || 0;

  const isIPad = /iPad/i.test(ua) || (platform === "MacIntel" && touchPoints > 1);
  const isAndroidTablet = /Android/i.test(ua) && !/Mobile/i.test(ua);
  const isKnownTablet = isIPad || isAndroidTablet || /Tablet|PlayBook|Silk/i.test(ua);
  if (isKnownTablet) return "tablet";

  const isPhoneUa = /iPhone|iPod|Android.*Mobile|Windows Phone|IEMobile|Opera Mini/i.test(ua);
  if (isPhoneUa) return "mobile";

  // Fallback for touch devices with phone/tablet-like dimensions. Use the smallest
  // screen side so rotating a phone does not suddenly reclassify it as a tablet.
  const smallestScreenSide = smallestPhysicalSide();
  const isTouchDevice = touchPoints > 0 || "ontouchstart" in window;
  if (isTouchDevice && smallestScreenSide <= 600) return "mobile";
  if (isTouchDevice && smallestScreenSide > 600 && smallestScreenSide <= 1100) return "tablet";

  return "desktop";
}

function isPortrait() {
  if (typeof window === "undefined") return true;
  return window.matchMedia?.("(orientation: portrait)").matches ?? window.innerHeight >= window.innerWidth;
}

async function tryOrientationLock(device: DeviceKind) {
  if (device === "desktop" || typeof screen === "undefined") return;
  const orientation = (screen as Screen & { orientation?: ScreenOrientation & { lock?: (value: string) => Promise<void> } }).orientation;
  if (!orientation?.lock) return;
  try {
    await orientation.lock(device === "mobile" ? "portrait-primary" : "landscape-primary");
  } catch {
    // Browsers commonly reject orientation.lock outside fullscreen/installed PWA.
    // The visual guard below is the reliable fallback.
  }
}

export function DeviceOrientationGuard() {
  const initialDesktopRequest = useMemo(() => isBrowserDesktopSiteRequest(), []);
  const [desktopRequest, setDesktopRequest] = useState(initialDesktopRequest);
  const device = useMemo(() => detectDeviceKind(), [desktopRequest]);
  const [portrait, setPortrait] = useState(true);

  // Browser desktop-site compatibility: promote the CSS viewport to a real desktop
  // width so Tailwind lg/xl breakpoints and the desktop dashboard are both activated.
  useEffect(() => {
    const syncDesktopRequest = () => {
      const requested = isBrowserDesktopSiteRequest();
      setDesktopRequest(requested);

      const viewport = document.querySelector('meta[name="viewport"]');
      if (requested) {
        document.documentElement.dataset.desktopSite = "true";
        viewport?.setAttribute("content", "width=1440, initial-scale=1, viewport-fit=cover");
      } else {
        delete document.documentElement.dataset.desktopSite;
      }
    };

    syncDesktopRequest();
    window.addEventListener("resize", syncDesktopRequest);
    window.addEventListener("orientationchange", syncDesktopRequest);
    return () => {
      window.removeEventListener("resize", syncDesktopRequest);
      window.removeEventListener("orientationchange", syncDesktopRequest);
    };
  }, []);

  useEffect(() => {
    if (device === "desktop") return;

    const sync = () => setPortrait(isPortrait());
    sync();
    void tryOrientationLock(device);

    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    const mq = window.matchMedia?.("(orientation: portrait)");
    mq?.addEventListener?.("change", sync);

    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      mq?.removeEventListener?.("change", sync);
    };
  }, [device]);

  // Desktop-site mode on a phone should behave like a real desktop, including the
  // desktop-only dashboard additions that otherwise depend on window.innerWidth.
  if (desktopRequest) {
    return typeof window !== "undefined" && window.location.pathname === "/dashboard"
      ? <DesktopDashboardExtras />
      : null;
  }

  if (device === "desktop") return null;

  const wrongOrientation = device === "mobile" ? !portrait : portrait;
  if (!wrongOrientation) return null;

  const mobile = device === "mobile";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#f6f4ec] px-8 text-center"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label="يرجى تدوير الجهاز"
    >
      <div className="w-full max-w-md rounded-[36px] border border-[#0f5a3a]/10 bg-white/90 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.16)] backdrop-blur-xl">
        <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-[26px] bg-[#0f5a3a] text-white shadow-xl">
          {mobile ? <Smartphone size={38} strokeWidth={1.8} /> : <Tablet size={42} strokeWidth={1.8} />}
        </div>
        <div className="mb-3 flex items-center justify-center gap-2 text-[#b99755]">
          <RotateCw size={19} />
          <span className="text-sm font-black">اتجاه الشاشة</span>
        </div>
        <h2 className="text-2xl font-black text-[#0b4939]">
          {mobile ? "دوّر الجوال للوضع الطولي" : "دوّر الجهاز للوضع العرضي"}
        </h2>
        <p className="mt-3 text-sm font-medium leading-7 text-slate-500">
          {mobile
            ? "صُممت واجهة الجوال لتعمل بالطول حتى تبقى العناصر مرتبة وواضحة."
            : "صُممت واجهة الأجهزة اللوحية والآيباد لتعمل بالعرض حتى تظهر الخدمات والمحتوى بالشكل الصحيح."}
        </p>
      </div>
    </div>
  );
}
