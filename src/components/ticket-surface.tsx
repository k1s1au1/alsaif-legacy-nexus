import { useEffect, useRef, useState, type ReactNode } from "react";
import { ticketContour } from "@/lib/ticket-contour";
import "./upcoming-trip-ticket.css";

/** The clipped paper and its border use the same contour, with real transparent cuts. */
export function TicketSurface({
  header,
  children,
  className = "",
  status,
}: {
  header: ReactNode;
  children: ReactNode;
  className?: string;
  status?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0, seam: 0 });

  useEffect(() => {
    const measure = () => {
      if (!panel.current || !head.current) return;
      const next = {
        width: panel.current.offsetWidth,
        height: panel.current.offsetHeight,
        seam: head.current.offsetHeight,
      };
      if (next.width < 70 || next.height < 70) return;
      setSize((current) =>
        current.width === next.width && current.height === next.height && current.seam === next.seam
          ? current
          : next,
      );
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (panel.current) observer?.observe(panel.current);
    if (head.current) observer?.observe(head.current);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const contour = size.width ? ticketContour(size.width, size.height, size.seam) : null;

  return (
    <article
      className={`ticket-surface ${className}`}
      data-ticket-design="2"
      data-trip-status={status}
      dir="rtl"
    >
      <div
        ref={panel}
        className="ticket-surface__paper"
        style={contour ? { clipPath: `path("${contour.path}")` } : undefined}
      >
        <div ref={head} className="ticket-surface__header">
          {header}
        </div>
        {children}
      </div>
      {contour && (
        <svg
          className="ticket-surface__outline"
          width={size.width}
          height={size.height}
          viewBox={`0 0 ${size.width} ${size.height}`}
          aria-hidden="true"
          focusable="false"
        >
          <path d={contour.path} fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path
            d={`M 14.75 ${contour.seam} H ${size.width - 14.75}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeDasharray="5 5"
          />
        </svg>
      )}
    </article>
  );
}
