import { forwardRef } from "react";
import type { LucideProps } from "lucide-react";

/**
 * Unified icon for the combined “نسب وأثر” section:
 * a family tree growing from an open heritage book.
 */
export const LineageLegacyIcon = forwardRef<SVGSVGElement, LucideProps>(
  (
    {
      color = "currentColor",
      size = 24,
      strokeWidth = 2,
      absoluteStrokeWidth,
      ...props
    },
    ref,
  ) => {
    const numericSize = typeof size === "number" ? size : Number.parseFloat(size);
    const resolvedStrokeWidth =
      absoluteStrokeWidth && Number.isFinite(numericSize) && numericSize > 0
        ? (Number(strokeWidth) * 24) / numericSize
        : strokeWidth;

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={resolvedStrokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        <path d="M3.5 11.8c2.8-.8 5.6-.2 8.5 1.7V21c-2.9-1.9-5.7-2.5-8.5-1.7Z" />
        <path d="M20.5 11.8c-2.8-.8-5.6-.2-8.5 1.7V21c2.9-1.9 5.7-2.5 8.5-1.7Z" />
        <path d="M12 13.5V21" />
        <path d="M12 13.5V8.6" />
        <path d="M12 8.6 7.5 6" />
        <path d="M12 8.6 16.5 6" />
        <path d="M12 8.6V4.7" />
        <circle cx="7" cy="5.5" r="1.5" />
        <circle cx="12" cy="3.2" r="1.5" />
        <circle cx="17" cy="5.5" r="1.5" />
      </svg>
    );
  },
);

LineageLegacyIcon.displayName = "LineageLegacyIcon";
