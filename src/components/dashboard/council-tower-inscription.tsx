import { useId } from "react";

export const COUNCIL_INSCRIPTION = "مـجـلـس السيف";

// Share actual Arabic glyphs across both periods and both artwork crops.
// The small stone patch covers the old lettering baked into the artwork.
export function CouncilTowerInscription({
  portrait,
  source,
}: {
  portrait: boolean;
  source: string;
}) {
  const id = useId();
  const stoneId = `${id}-stone`;
  const textureId = `${id}-texture`;
  const featherId = `${id}-edge`;
  const maskId = `${id}-mask`;
  const box = portrait
    ? { x: 718, y: 822, width: 73, height: 250, cx: 754, cy: 945, length: 226 }
    : { x: 1447, y: 257, width: 78, height: 239, cx: 1486, cy: 373, length: 218 };

  return (
    <svg
      className={`council-oasis-inscription council-oasis-inscription--${portrait ? "portrait" : "wide"}`}
      viewBox={portrait ? "0 0 1086 1448" : "0 0 1939 811"}
      preserveAspectRatio="xMaxYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern
          id={stoneId}
          patternUnits="userSpaceOnUse"
          x={box.x}
          y={box.y}
          width="8"
          height={box.height}
          viewBox={`${portrait ? 780 : 1514} ${box.y} 8 ${box.height}`}
          preserveAspectRatio="none"
        >
          <image href={source} width={portrait ? 1086 : 1939} height={portrait ? 1448 : 811} />
        </pattern>
        <filter id={textureId} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="1.6 0.6" />
        </filter>
        <filter id={featherId} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          x={box.x - 8}
          y={box.y - 8}
          width={box.width + 16}
          height={box.height + 16}
        >
          <rect
            x={box.x}
            y={box.y}
            width={box.width}
            height={box.height}
            fill="white"
            filter={`url(#${featherId})`}
          />
        </mask>
      </defs>
      <rect
        x={box.x - 8}
        y={box.y - 8}
        width={box.width + 16}
        height={box.height + 16}
        fill={`url(#${stoneId})`}
        filter={`url(#${textureId})`}
        mask={`url(#${maskId})`}
      />
      <text
        x={box.cx}
        y={box.cy}
        transform={`rotate(-90 ${box.cx} ${box.cy})`}
        textAnchor="middle"
        dominantBaseline="central"
        direction="rtl"
        unicodeBidi="isolate"
        textLength={box.length}
        lengthAdjust="spacingAndGlyphs"
      >
        {COUNCIL_INSCRIPTION}
      </text>
    </svg>
  );
}
