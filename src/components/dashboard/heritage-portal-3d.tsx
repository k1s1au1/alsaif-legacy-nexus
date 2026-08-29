import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import pavilionBackdrop from "@/assets/najdi-pavilion-reference.webp";
import "./heritage-portal-3d.css";

type HeritagePortal3DProps = {
  logoUrl?: string | null;
  greeting: string;
  name: string;
  message: string;
  className?: string;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function HeritagePortal3D({
  logoUrl,
  greeting,
  name,
  message,
  className = "",
}: HeritagePortal3DProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
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
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const renderParallax = () => {
    const root = rootRef.current;
    if (!root) {
      frameRef.current = null;
      return;
    }

    const current = currentRef.current;
    const target = targetRef.current;
    current.x += (target.x - current.x) * 0.1;
    current.y += (target.y - current.y) * 0.1;

    root.style.setProperty("--portal-x", `${(current.x * 7).toFixed(2)}px`);
    root.style.setProperty("--portal-y", `${(current.y * 5).toFixed(2)}px`);
    root.style.setProperty(
      "--portal-light-x",
      `${(50 + current.x * 22).toFixed(1)}%`,
    );

    if (
      Math.abs(target.x - current.x) < 0.001 &&
      Math.abs(target.y - current.y) < 0.001
    ) {
      frameRef.current = null;
      return;
    }

    frameRef.current = requestAnimationFrame(renderParallax);
  };

  const scheduleParallax = () => {
    if (frameRef.current === null) {
      frameRef.current = requestAnimationFrame(renderParallax);
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
    if (rootRef.current) rootRef.current.dataset.interacting = "false";
    scheduleParallax();
  };

  return (
    <div
      ref={rootRef}
      className={[
        "heritage-portal-3d",
        "heritage-pavilion-reference",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-interacting="false"
      dir="rtl"
      role="img"
      aria-label={[greeting, `حياك الله، ${name}`, message, "بوابة السيف"].join(
        ". ",
      )}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetParallax}
    >
      <div className="pavilion-reference-stage" aria-hidden="true">
        <img
          className="pavilion-reference-backdrop"
          src={pavilionBackdrop}
          alt=""
          draggable={false}
        />
        <span className="pavilion-reference-ambient" />
        <span className="pavilion-reference-beam pavilion-reference-beam-right" />
        <span className="pavilion-reference-beam pavilion-reference-beam-left" />
        <span className="pavilion-reference-sheen" />
      </div>

      <div className="pavilion-reference-logo" aria-hidden="true">
        {logoUrl ? (
          <img src={logoUrl} alt="" draggable={false} />
        ) : (
          <span>السيف</span>
        )}
      </div>

      <p className="pavilion-reference-greeting">{greeting}</p>

      <div className="pavilion-reference-identity">
        <span>حياك الله،</span>
        <strong>{name}</strong>
      </div>

      <p className="pavilion-reference-message" key={message}>
        {message}
      </p>

      <span className="pavilion-reference-plaque">بوابة السيف</span>
    </div>
  );
}
