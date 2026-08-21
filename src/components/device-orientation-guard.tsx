import { useEffect, useMemo, useState } from "react";
import { Smartphone, Tablet, RotateCw } from "lucide-react";

type DeviceKind = "mobile" | "tablet" | "desktop";

function detectDeviceKind(): DeviceKind {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "desktop";

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
  const smallestScreenSide = Math.min(window.screen?.width || window.innerWidth, window.screen?.height || window.innerHeight);
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
  const device = useMemo(() => detectDeviceKind(), []);
  const [portrait, setPortrait] = useState(true);

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
