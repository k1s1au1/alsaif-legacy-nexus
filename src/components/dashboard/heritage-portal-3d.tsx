import {
  useEffect,
  useId,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { councilTowers } from "@/assets/najdi-council-towers-v1";
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
  greeting,
  name,
  message,
  className = "",
}: HeritagePortal3DProps) {
  const colorFilterId = `council-portal-colors-${useId().replace(/:/g, "")}`;
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
      `${(72 + current.x * 12).toFixed(1)}%`,
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
      aria-label={[
        greeting,
        `حياك الله، ${name}`,
        message,
        "مجلس السيف",
        "تأسس عام ١٤٤٨ هجري",
        "بوابة السيف",
      ].join(". ")}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetParallax}
    >
      <span className="council-portal-ambient" aria-hidden="true" />
      <span className="council-portal-sheen" aria-hidden="true" />

      <div className="council-portal-copy" aria-hidden="true">
        <p className="council-portal-greeting">{greeting}</p>

        <div className="council-portal-identity">
          <span>حياك الله،</span>
          <strong>{name}</strong>
        </div>

        <p className="council-portal-message" key={message}>
          {message}
        </p>

        <span className="council-portal-plaque">بوابة السيف</span>
      </div>

      <div className="council-portal-model" aria-hidden="true">
        <div className="council-portal-model-visual">
          <svg
            className="council-portal-towers"
            viewBox="0 0 1065 1477"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <filter
                id={colorFilterId}
                x="0%"
                y="0%"
                width="100%"
                height="100%"
                colorInterpolationFilters="sRGB"
              >
                <feColorMatrix
                  in="SourceGraphic"
                  type="saturate"
                  values="0"
                  result="stone-detail"
                />
                <feColorMatrix
                  in="stone-detail"
                  type="luminanceToAlpha"
                  result="highlight-mask"
                />
                <feFlood
                  style={{ floodColor: "var(--council-portal-material)" }}
                  result="stone-color"
                />
                <feFlood
                  style={{ floodColor: "var(--council-portal-metal)" }}
                  result="metal-color"
                />
                <feComposite
                  in="metal-color"
                  in2="highlight-mask"
                  operator="in"
                  result="colored-highlights"
                />
                <feBlend
                  in="colored-highlights"
                  in2="stone-color"
                  mode="normal"
                  result="identity-colors"
                />
                <feBlend
                  in="identity-colors"
                  in2="stone-detail"
                  mode="color"
                  result="colored-stone"
                />
                <feComposite
                  in="colored-stone"
                  in2="SourceGraphic"
                  operator="in"
                />
              </filter>
            </defs>
            <image
              href={councilTowers}
              width="1065"
              height="1477"
              filter={`url(#${colorFilterId})`}
              preserveAspectRatio="xMidYMid meet"
            />
          </svg>

          <div className="council-tower-inscription">
            <strong>
              <span>مجلس</span>
              <span>السيف</span>
            </strong>
            <bdi className="council-tower-year" dir="rtl">
              ١٤٤٨هـ
            </bdi>
          </div>
        </div>
      </div>
    </div>
  );
}
