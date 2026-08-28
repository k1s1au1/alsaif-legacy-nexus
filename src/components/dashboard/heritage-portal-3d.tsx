import {
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { MoveHorizontal, Users } from "lucide-react";

type HeritagePortal3DProps = {
  logoUrl?: string | null;
  className?: string;
};

type Rotation = {
  x: number;
  y: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function HeritagePortal3D({
  logoUrl,
  className = "",
}: HeritagePortal3DProps) {
  const svgId = useId().replace(/:/g, "");
  const greenGradientId = `portal-green-${svgId}`;
  const goldGradientId = `portal-gold-${svgId}`;
  const glowId = `portal-glow-${svgId}`;
  const [rotation, setRotation] = useState<Rotation>({ x: -4, y: -7 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ pointerId: number; x: number; y: number } | null>(null);

  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 8 : 4;
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    setRotation((current) => {
      if (event.key === "Home") return { x: -4, y: -7 };
      if (event.key === "ArrowLeft") return { ...current, y: current.y - step };
      if (event.key === "ArrowRight") return { ...current, y: current.y + step };
      if (event.key === "ArrowUp") {
        return { ...current, x: clamp(current.x - step, -14, 10) };
      }
      return { ...current, x: clamp(current.x + step, -14, 10) };
    });
  };

  const portalStyle = {
    "--portal-rx": `${rotation.x}deg`,
    "--portal-ry": `${rotation.y}deg`,
  } as CSSProperties;

  return (
    <div
      className={`heritage-portal-3d ${className}`.trim()}
      data-dragging={dragging ? "true" : "false"}
      style={portalStyle}
      role="img"
      aria-label="بوابة السيف ثلاثية الأبعاد، اسحب لتدويرها"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        drag.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
        };
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (drag.current?.pointerId !== event.pointerId) return;
        const dx = event.clientX - drag.current.x;
        const dy = event.clientY - drag.current.y;
        drag.current.x = event.clientX;
        drag.current.y = event.clientY;
        setRotation((current) => ({
          x: clamp(current.x - dy * 0.12, -14, 10),
          y: current.y + dx * 0.2,
        }));
      }}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
    >
      <div className="heritage-portal-aura" aria-hidden="true" />
      <div className="heritage-portal-stage">
        <div className="heritage-portal-orbit heritage-portal-orbit-one" aria-hidden="true" />
        <div className="heritage-portal-orbit heritage-portal-orbit-two" aria-hidden="true" />

        <svg
          className="heritage-portal-arch heritage-portal-arch-back"
          viewBox="0 0 520 500"
          aria-hidden="true"
        >
          <path d="M98 438V210Q260 22 422 210V438H347V241Q260 139 173 241V438Z" />
        </svg>

        <svg
          className="heritage-portal-arch heritage-portal-arch-mid"
          viewBox="0 0 520 500"
          aria-hidden="true"
        >
          <path d="M98 438V210Q260 22 422 210V438H347V241Q260 139 173 241V438Z" />
        </svg>

        <svg
          className="heritage-portal-arch heritage-portal-arch-front"
          viewBox="0 0 520 500"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={greenGradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#0d5a45" />
              <stop offset="0.46" stopColor="#073b30" />
              <stop offset="1" stopColor="#021c17" />
            </linearGradient>
            <linearGradient id={goldGradientId} x1="0" y1="0" x2="0.9" y2="1">
              <stop offset="0" stopColor="#f2d38d" />
              <stop offset="0.45" stopColor="#b99755" />
              <stop offset="1" stopColor="#6e4f1e" />
            </linearGradient>
            <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <path
            d="M98 438V210Q260 22 422 210V438H347V241Q260 139 173 241V438Z"
            fill={`url(#${greenGradientId})`}
            stroke={`url(#${goldGradientId})`}
            strokeWidth="8"
          />
          <path
            d="M122 426V219Q260 61 398 219V426"
            fill="none"
            stroke="rgba(235,205,133,.48)"
            strokeWidth="2"
            strokeDasharray="4 9"
          />
          <path
            d="M111 427V212Q260 40 409 212V427"
            fill="none"
            stroke="rgba(255,255,255,.1)"
            strokeWidth="2"
          />

          <g
            fill="none"
            stroke={`url(#${goldGradientId})`}
            strokeLinecap="round"
            filter={`url(#${glowId})`}
          >
            <path d="M260 401C260 353 259 320 260 274" strokeWidth="9" />
            <path d="M260 348C226 323 211 300 205 271" strokeWidth="5" />
            <path d="M260 334C294 306 307 283 312 254" strokeWidth="5" />
            <path d="M260 372C223 364 196 367 171 383" strokeWidth="4" />
            <path d="M260 372C298 361 326 365 350 384" strokeWidth="4" />
            <path d="M260 401C236 407 217 418 201 437" strokeWidth="4" />
            <path d="M260 401C286 407 307 419 324 438" strokeWidth="4" />
          </g>

          <g fill="#d7b66f">
            <circle cx="205" cy="270" r="6" />
            <circle cx="312" cy="254" r="6" />
            <circle cx="171" cy="383" r="5" />
            <circle cx="350" cy="384" r="5" />
          </g>
        </svg>

        <div className="heritage-portal-medallion" aria-hidden="true">
          <div className="heritage-portal-medallion-inner">
            {logoUrl ? (
              <img src={logoUrl} alt="" />
            ) : (
              <Users size={42} strokeWidth={1.7} />
            )}
          </div>
        </div>

        <div className="heritage-portal-plinth" aria-hidden="true">
          <div className="heritage-portal-plinth-top" />
          <div className="heritage-portal-plinth-name">بوابة السيف</div>
        </div>
      </div>

      <div className="heritage-portal-hint" aria-hidden="true">
        <MoveHorizontal size={16} />
        <span>اسحب لتدوير البوابة</span>
      </div>
    </div>
  );
}
