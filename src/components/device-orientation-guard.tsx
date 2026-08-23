import { useEffect, useMemo, useState } from "react";
import { Smartphone, Tablet, RotateCw } from "lucide-react";

type DeviceKind = "mobile" | "tablet" | "desktop";

declare global {
  interface Window {
    __ALSAIF_DESKTOP_SITE__?: boolean;
  }
}

function smallestPhysicalSide() {
  if (typeof window === "undefined") return 9999;
  return Math.min(
    window.screen?.width || window.innerWidth,
    window.screen?.height || window.innerHeight,
  );
}

function isBrowserDesktopSiteRequest() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  if (window.__ALSAIF_DESKTOP_SITE__ || document.documentElement.dataset.desktopSite === "true") return true;

  const ua = navigator.userAgent || "";
  const phoneHardware = smallestPhysicalSide() <= 600;
  const mobileUa = /iPhone|iPod|Android.*Mobile|Windows Phone|IEMobile|Opera Mini/i.test(ua);
  const desktopUaOnPhone = phoneHardware && !mobileUa;

  // Older Chrome variants expose a wide desktop viewport while keeping touch hints.
  const touchPoints = navigator.maxTouchPoints || 0;
  const touch = touchPoints > 0 || "ontouchstart" in window;
  const wideDesktopViewport = touch && phoneHardware && window.innerWidth >= 900;

  return desktopUaOnPhone || wideDesktopViewport;
}

function detectDeviceKind(): DeviceKind {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "desktop";
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
  } catch {}
}

function forceDesktopViewport() {
  const content = "width=1440, initial-scale=1, viewport-fit=cover";
  let metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="viewport"]'));
  if (!metas.length) {
    const meta = document.createElement("meta");
    meta.name = "viewport";
    document.head.appendChild(meta);
    metas = [meta];
  }
  metas.forEach((meta) => meta.setAttribute("content", content));
}

export function DeviceOrientationGuard() {
  const initialDesktopRequest = useMemo(() => isBrowserDesktopSiteRequest(), []);
  const [desktopRequest, setDesktopRequest] = useState(initialDesktopRequest);
  const device = useMemo(() => detectDeviceKind(), [desktopRequest]);
  const [portrait, setPortrait] = useState(true);

  useEffect(() => {
    const syncDesktopRequest = () => {
      const requested = isBrowserDesktopSiteRequest();
      setDesktopRequest(requested);
      if (requested) {
        window.__ALSAIF_DESKTOP_SITE__ = true;
        document.documentElement.dataset.desktopSite = "true";
        forceDesktopViewport();
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

  if (desktopRequest || device === "desktop") return null;
  const wrongOrientation = device === "mobile" ? !portrait : portrait;
  if (!wrongOrientation) return null;
  const mobile = device === "mobile";
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#f6f4ec] px-8 text-center" dir="rtl" role="dialog" aria-modal="true" aria-label="يرجى تدوير الجهاز">
      <div className="w-full max-w-md rounded-[36px] border border-[#0f5a3a]/10 bg-white/90 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.16)] backdrop-blur-xl">
        <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-[26px] bg-[#0f5a3a] text-white shadow-xl">{mobile ? <Smartphone size={38} strokeWidth={1.8} /> : <Tablet size={42} strokeWidth={1.8} />}</div>
        <div className="mb-3 flex items-center justify-center gap-2 text-[#b99755]"><RotateCw size={19} /><span className="text-sm font-black">اتجاه الشاشة</span></div>
        <h2 className="text-2xl font-black text-[#0b4939]">{mobile ? "دوّر الجوال للوضع الطولي" : "دوّر الجهاز للوضع العرضي"}</h2>
        <p className="mt-3 text-sm font-medium leading-7 text-slate-500">{mobile ? "صُممت واجهة الجوال لتعمل بالطول حتى تبقى العناصر مرتبة وواضحة." : "صُممت واجهة الأجهزة اللوحية والآيباد لتعمل بالعرض حتى تظهر الخدمات والمحتوى بالشكل الصحيح."}</p>
      </div>
    </div>
  );
}
