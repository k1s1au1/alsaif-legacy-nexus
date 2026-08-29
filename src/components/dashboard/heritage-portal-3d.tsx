import {
  useEffect,
  useId,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import "./heritage-portal-3d.css";

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
  const instanceId = useId().replace(/:/g, "");
  const goldId = "najdi-gold-" + instanceId;
  const jadeId = "najdi-jade-" + instanceId;
  const glassId = "najdi-glass-" + instanceId;
  const cutoutId = "najdi-cutout-" + instanceId;

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
    current.x += (target.x - current.x) * 0.12;
    current.y += (target.y - current.y) * 0.12;

    element.style.setProperty(
      "--pavilion-rx",
      (-current.y * 4.2).toFixed(2) + "deg",
    );
    element.style.setProperty(
      "--pavilion-ry",
      (current.x * 6.2).toFixed(2) + "deg",
    );
    element.style.setProperty(
      "--pavilion-shift-x",
      (current.x * 7).toFixed(2) + "px",
    );
    element.style.setProperty(
      "--pavilion-shift-y",
      (current.y * 4).toFixed(2) + "px",
    );
    element.style.setProperty(
      "--pavilion-light-x",
      (50 + current.x * 30).toFixed(1) + "%",
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
      className={[
        "heritage-portal-3d",
        "heritage-pavilion",
        "heritage-pavilion-v2",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-interacting="false"
      data-pavilion="najdi-v2"
      role="img"
      aria-label={[greeting, "حياك الله " + name, message].join(". ")}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetParallax}
    >
      <div className="najdi-pavilion-aura" aria-hidden="true" />

      <div className="najdi-pavilion-float">
        <div className="najdi-pavilion-scene">
          <svg
            className="najdi-pavilion-architecture"
            viewBox="0 0 1200 530"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={goldId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fff0b0" />
                <stop offset="18%" stopColor="#c99a43" />
                <stop offset="48%" stopColor="#f1cd78" />
                <stop offset="72%" stopColor="#8b6227" />
                <stop offset="100%" stopColor="#e4bc65" />
              </linearGradient>

              <linearGradient id={jadeId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#123f33" />
                <stop offset="42%" stopColor="#082d25" />
                <stop offset="100%" stopColor="#031a16" />
              </linearGradient>

              <radialGradient id={glassId} cx="50%" cy="40%" r="72%">
                <stop offset="0%" stopColor="#126249" stopOpacity="0.82" />
                <stop offset="48%" stopColor="#073d30" stopOpacity="0.94" />
                <stop offset="100%" stopColor="#021c17" />
              </radialGradient>

              <pattern
                id={cutoutId}
                width="34"
                height="31"
                patternUnits="userSpaceOnUse"
              >
                <path d="M17 2 31 27H3Z" fill={"url(#" + goldId + ")"} opacity="0.92" />
                <path d="M17 8 24.8 22H9.2Z" fill="#021712" />
              </pattern>

            </defs>

            <ellipse
              className="najdi-pavilion-floor-shadow"
              cx="600"
              cy="500"
              rx="470"
              ry="25"
            />

            <g className="najdi-pavilion-depth">
              <polygon
                points="75,76 1125,76 1084,170 116,170"
                fill="#01130f"
                transform="translate(0 13)"
              />
              <polygon
                points="72,423 1128,423 1091,497 109,497"
                fill="#010e0c"
                transform="translate(0 13)"
              />
              <polygon points="76,78 1124,78 1085,160 115,160" fill={"url(#" + jadeId + ")"} />
              <polygon points="87,89 1113,89 1080,145 120,145" fill="#0b332a" opacity="0.94" />

              <polygon points="105,151 287,151 238,438 42,438" fill="#01130f" transform="translate(-8 10)" />
              <polygon points="913,151 1095,151 1158,438 962,438" fill="#01130f" transform="translate(8 10)" />
              <polygon points="112,151 288,151 239,430 51,430" fill={"url(#" + jadeId + ")"} />
              <polygon points="912,151 1088,151 1149,430 961,430" fill={"url(#" + jadeId + ")"} />

              <polygon points="280,151 920,151 958,427 242,427" fill={"url(#" + glassId + ")"} />
              <polygon
                points="298,171 902,171 932,406 268,406"
                fill="none"
                stroke="#167358"
                strokeOpacity="0.55"
                strokeWidth="2"
              />
              <polygon
                points="314,187 886,187 911,390 289,390"
                fill="none"
                stroke={"url(#" + goldId + ")"}
                strokeOpacity="0.28"
                strokeWidth="1.4"
              />

              <polygon points="135,183 253,183 214,405 92,405" fill={"url(#" + cutoutId + ")"} opacity="0.86" />
              <polygon points="947,183 1065,183 1108,405 986,405" fill={"url(#" + cutoutId + ")"} opacity="0.86" />

              <polygon points="52,421 1148,421 1112,490 88,490" fill={"url(#" + jadeId + ")"} />
              <polygon points="72,432 1128,432 1118,454 82,454" fill="#123d31" opacity="0.96" />
              <polygon points="105,490 1095,490 1078,510 122,510" fill="#010f0d" />

              <g
                className="najdi-pavilion-gold-frame"
                fill="none"
                stroke={"url(#" + goldId + ")"}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="76,78 1124,78 1085,160 115,160" strokeWidth="4" />
                <polygon points="89,91 1111,91 1077,145 123,145" strokeWidth="1.5" opacity="0.8" />
                <polygon points="112,151 288,151 239,430 51,430" strokeWidth="3" />
                <polygon points="912,151 1088,151 1149,430 961,430" strokeWidth="3" />
                <polygon points="280,151 920,151 958,427 242,427" strokeWidth="2.5" opacity="0.75" />
                <polygon points="52,421 1148,421 1112,490 88,490" strokeWidth="3" />
                <path d="M126 153H1074" strokeWidth="3" />
                <path d="M83 438H1117" strokeWidth="2" opacity="0.8" />
              </g>

              <g fill={"url(#" + goldId + ")"} opacity="0.88">
                <path d="M96 112 104 120 96 128 88 120Z" />
                <path d="M1104 112 1112 120 1104 128 1096 120Z" />
                <path d="M142 445 150 453 142 461 134 453Z" />
                <path d="M1058 445 1066 453 1058 461 1050 453Z" />
                <path d="M170 445 178 453 170 461 162 453Z" />
                <path d="M1030 445 1038 453 1030 461 1022 453Z" />
              </g>

              <path
                className="najdi-pavilion-highlight"
                d="M132 153H1068"
                fill="none"
                stroke="#ffe09a"
                strokeWidth="5"
                strokeOpacity="0.8"
              />
            </g>
          </svg>

          <div className="najdi-pavilion-roof-copy" aria-hidden="true">
            <span>{greeting}</span>
            <span>يا أهل الوفاء</span>
          </div>

          <div className="najdi-pavilion-crest" aria-hidden="true">
            <div className="najdi-pavilion-crest-ring">
              {logoUrl ? <img src={logoUrl} alt="" /> : <span>س</span>}
            </div>
          </div>

          <div className="najdi-pavilion-content">
            <span className="najdi-pavilion-welcome">حيّاك الله،</span>
            <strong className="najdi-pavilion-name">{name}</strong>
            <span className="najdi-pavilion-name-depth" aria-hidden="true">
              {name}
            </span>
          </div>

          <div className="najdi-pavilion-message-rail">
            <span key={message}>{message}</span>
          </div>

          <span className="najdi-pavilion-plaque">بوابة السيف</span>
          <span className="najdi-pavilion-light-sweep" aria-hidden="true" />
        </div>
      </div>

      <div className="najdi-pavilion-ground" aria-hidden="true" />
    </div>
  );
}
