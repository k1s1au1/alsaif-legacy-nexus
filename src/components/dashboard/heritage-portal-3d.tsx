import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

type HeritagePortal3DProps = {
  logoUrl?: string | null;
  greeting: string;
  name: string;
  message: string;
  className?: string;
};

type Point = {
  x: number;
  y: number;
};

const CUTOUTS = Array.from({ length: 12 }, (_, index) => index);

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
    current.x += (target.x - current.x) * 0.13;
    current.y += (target.y - current.y) * 0.13;

    element.style.setProperty(
      "--pavilion-rx",
      `${(-current.y * 4.8).toFixed(2)}deg`,
    );
    element.style.setProperty(
      "--pavilion-ry",
      `${(current.x * 6.5).toFixed(2)}deg`,
    );
    element.style.setProperty(
      "--pavilion-shift-x",
      `${(current.x * 6).toFixed(2)}px`,
    );
    element.style.setProperty(
      "--pavilion-shift-y",
      `${(current.y * 3.5).toFixed(2)}px`,
    );
    element.style.setProperty(
      "--pavilion-light-x",
      `${(50 + current.x * 28).toFixed(1)}%`,
    );
    element.style.setProperty(
      "--pavilion-light-y",
      `${(34 + current.y * 18).toFixed(1)}%`,
    );

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
      className={`heritage-portal-3d heritage-pavilion ${className}`.trim()}
      data-interacting="false"
      data-pavilion="najdi"
      onPointerMove={handlePointerMove}
      onPointerLeave={resetParallax}
    >
      <div className="heritage-pavilion-aura" aria-hidden="true" />

      <div className="heritage-pavilion-float">
        <div className="heritage-pavilion-scene">
          <div className="heritage-pavilion-backplate" aria-hidden="true" />

          <div className="heritage-pavilion-roof">
            <span className="heritage-pavilion-roof-copy heritage-pavilion-roof-greeting">
              {greeting}
            </span>
            <span className="heritage-pavilion-roof-copy heritage-pavilion-roof-loyalty">
              يا أهل الوفاء
            </span>
          </div>

          <div className="heritage-pavilion-crest" aria-hidden="true">
            {logoUrl ? <img src={logoUrl} alt="" /> : <span>س</span>}
          </div>

          <div className="heritage-pavilion-pillar heritage-pavilion-pillar-start" aria-hidden="true">
            <div className="heritage-pavilion-cutouts">
              {CUTOUTS.map((cutout) => (
                <span key={cutout} />
              ))}
            </div>
          </div>

          <div className="heritage-pavilion-glass">
            <span className="heritage-pavilion-welcome">حيّاك الله،</span>
            <strong className="heritage-pavilion-name">{name}</strong>
            <span className="heritage-pavilion-name-reflection" aria-hidden="true">
              {name}
            </span>
            <span className="heritage-pavilion-glass-line" aria-hidden="true" />
            <span className="heritage-pavilion-light-sweep" aria-hidden="true" />
          </div>

          <div className="heritage-pavilion-pillar heritage-pavilion-pillar-end" aria-hidden="true">
            <div className="heritage-pavilion-cutouts">
              {CUTOUTS.map((cutout) => (
                <span key={cutout} />
              ))}
            </div>
          </div>

          <div className="heritage-pavilion-lower-beam">
            <span key={message} className="heritage-pavilion-message">
              {message}
            </span>
          </div>

          <span className="heritage-pavilion-plaque">بوابة السيف</span>
          <span className="heritage-pavilion-edge-light" aria-hidden="true" />
        </div>
      </div>

      <div className="heritage-pavilion-ground" aria-hidden="true" />
    </div>
  );
}
