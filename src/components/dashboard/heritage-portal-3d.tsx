import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import gateAsset from "@/assets/diwan-gate.png.asset.json";

type HeritagePortal3DProps = {
  logoUrl?: string | null;
  className?: string;
};

type Point = {
  x: number;
  y: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function HeritagePortal3D({
  logoUrl,
  className = "",
}: HeritagePortal3DProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<Point>({ x: 0, y: 0 });
  const currentRef = useRef<Point>({ x: 0, y: 0 });
  const animationFrameRef = useRef<number | null>(null);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => {
      reducedMotionRef.current = media.matches;
    };

    syncPreference();
    media.addEventListener?.("change", syncPreference);

    return () => {
      media.removeEventListener?.("change", syncPreference);
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const applyParallax = () => {
    const element = rootRef.current;
    if (!element) {
      animationFrameRef.current = null;
      return;
    }

    const current = currentRef.current;
    const target = targetRef.current;
    current.x += (target.x - current.x) * 0.14;
    current.y += (target.y - current.y) * 0.14;

    element.style.setProperty("--gate-rx", `${(-current.y * 7).toFixed(2)}deg`);
    element.style.setProperty("--gate-ry", `${(current.x * 9).toFixed(2)}deg`);
    element.style.setProperty("--gate-shift-x", `${(current.x * 7).toFixed(2)}px`);
    element.style.setProperty("--gate-shift-y", `${(current.y * 4).toFixed(2)}px`);
    element.style.setProperty("--gate-light-x", `${(50 + current.x * 24).toFixed(1)}%`);
    element.style.setProperty("--gate-light-y", `${(30 + current.y * 16).toFixed(1)}%`);

    const settled =
      Math.abs(target.x - current.x) < 0.001 &&
      Math.abs(target.y - current.y) < 0.001;

    if (settled) {
      current.x = target.x;
      current.y = target.y;
      animationFrameRef.current = null;
      return;
    }

    animationFrameRef.current = requestAnimationFrame(applyParallax);
  };

  const scheduleParallax = () => {
    if (animationFrameRef.current === null) {
      animationFrameRef.current = requestAnimationFrame(applyParallax);
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      reducedMotionRef.current ||
      (event.pointerType !== "mouse" && event.pointerType !== "pen")
    ) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    targetRef.current = {
      x: clamp(((event.clientX - bounds.left) / bounds.width - 0.5) * 2, -1, 1),
      y: clamp(((event.clientY - bounds.top) / bounds.height - 0.5) * 2, -1, 1),
    };
    event.currentTarget.dataset.interacting = "true";
    scheduleParallax();
  };

  const resetParallax = () => {
    targetRef.current = { x: 0, y: 0 };
    if (rootRef.current) {
      rootRef.current.dataset.interacting = "false";
    }
    scheduleParallax();
  };

  return (
    <div
      ref={rootRef}
      className={`heritage-portal-3d ${className}`.trim()}
      role="img"
      aria-label="بوابة ديوان السيف ثلاثية الأبعاد"
      data-interacting="false"
      onPointerMove={handlePointerMove}
      onPointerLeave={resetParallax}
    >
      <div className="heritage-portal-glow" aria-hidden="true" />

      <div className="heritage-portal-float">
        <div className="heritage-portal-scene">
          <img
            className="heritage-portal-depth heritage-portal-depth-far"
            src={gateAsset.url}
            alt=""
            aria-hidden="true"
            decoding="async"
          />
          <img
            className="heritage-portal-depth heritage-portal-depth-near"
            src={gateAsset.url}
            alt=""
            aria-hidden="true"
            decoding="async"
          />

          <div className="heritage-portal-frame">
            <img
              className="heritage-portal-gate"
              src={gateAsset.url}
              alt=""
              aria-hidden="true"
              decoding="async"
              loading="eager"
            />
            <div className="heritage-portal-door-light" aria-hidden="true" />
            <div className="heritage-portal-sheen" aria-hidden="true" />
            <div className="heritage-portal-sweep" aria-hidden="true" />

            {logoUrl ? (
              <span className="heritage-portal-crest" aria-hidden="true">
                <img src={logoUrl} alt="" />
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="heritage-portal-ground" aria-hidden="true" />
    </div>
  );
}
