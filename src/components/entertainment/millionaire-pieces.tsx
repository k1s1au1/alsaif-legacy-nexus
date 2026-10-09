import { useId, type CSSProperties } from "react";
import type { MillionaireSpace } from "./millionaire-board";
import { MILLIONAIRE_LEVELS } from "./millionaire-presentation";

export function OwnershipFlag({ color, number }: { color: string; number: number }) {
  return (
    <svg className="millionaire-flag" viewBox="0 0 40 48" aria-hidden="true">
      <ellipse cx="8" cy="44" rx="8" ry="3" fill="#8e622d" opacity=".45" />
      <path d="M7 44V5" stroke="#d9aa4b" strokeWidth="3" />
      <circle cx="7" cy="4" r="3" fill="#f3d585" />
      <path d="M9 7Q20 3 36 9V30Q22 24 9 29Z" fill={color} stroke="#fff9" strokeWidth=".8" />
      <path d="M10 8Q22 5 35 10" fill="none" stroke="#fff7" />
      <text
        x="23"
        y="24"
        fill="white"
        fontFamily="system-ui"
        fontWeight="800"
        fontSize="18"
        textAnchor="middle"
      >
        {number}
      </text>
    </svg>
  );
}

/** Small vector miniatures remain sharp at every board size. */
export function MiniatureBuilding({
  level,
  space,
  className = "",
}: {
  level: number;
  space?: MillionaireSpace;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const landmark = level >= 4 || space?.kind === "tourism";
  const tower = landmark && /برج|ذا لاين/.test(space?.landmark ?? "");
  const height = tower ? 65 : level >= 3 ? 52 : level === 2 ? 40 : 24;
  if (level < 1)
    return (
      <span className={`millionaire-miniature is-empty ${className}`} aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    );
  return (
    <svg
      className={`millionaire-miniature level-${level} ${landmark ? "is-landmark" : ""} ${className}`}
      viewBox="0 0 100 100"
      role="img"
      aria-label={
        space?.kind === "tourism" ? space.landmark : MILLIONAIRE_LEVELS[Math.min(4, level)]
      }
    >
      <defs>
        <linearGradient id={`${id}wall`} x1="0" x2="1">
          <stop stopColor="#e9d1a0" />
          <stop offset="1" stopColor="#c69b5a" />
        </linearGradient>
        <linearGradient id={`${id}roof`} x1="0" x2="1">
          <stop stopColor="#fff2d3" />
          <stop offset="1" stopColor="#e1c68f" />
        </linearGradient>
      </defs>
      <ellipse cx="54" cy="86" rx="34" ry="8" fill="#6d4e29" opacity=".2" />
      <path d="M10 81L49 63L89 80L50 99Z" fill="#bcad79" stroke="#e6dab6" strokeWidth="1" />
      {tower ? (
        <>
          <path d="M34 81V17Q50 -3 67 17V80L50 90Z" fill={`url(#${id}wall)`} />
          <path d="M50 90V14Q58 8 67 17V80Z" fill="#ae854a" />
          <path d="M37 18Q50 34 64 18V8Q50 22 37 8Z" fill="#faeac2" />
          <path d="M40 25Q50 31 60 25L59 12Q50 18 41 12Z" fill="#186650" />
          {[40, 47, 54, 61].map((x) => (
            <path key={x} d={`M${x} 39V76`} stroke="#6c938b" strokeWidth="3" />
          ))}
        </>
      ) : (
        <>
          <path d={`M22 80V${80 - height}L50 ${68 - height}V92Z`} fill={`url(#${id}wall)`} />
          <path d={`M50 92V${68 - height}L78 ${80 - height}V80Z`} fill="#b98c51" />
          <path
            d={`M22 ${80 - height}L50 ${68 - height}L78 ${80 - height}L50 ${92 - height}Z`}
            fill={`url(#${id}roof)`}
            stroke="#f7e9ca"
            strokeWidth="1.3"
          />
          <path d="M40 87V71Q43 65 47 71V90Z" fill="#574e39" />
          {Array.from({ length: level >= 3 ? 4 : level === 2 ? 3 : 1 }, (_, row) => (
            <g key={row}>
              <path d={`M28 ${73 - row * 11}v-6l6 -2v6Z`} fill="#416759" />
              <path d={`M58 ${78 - row * 11}v-6l6 2v6Z`} fill="#d8b56c" />
              <path d={`M69 ${73 - row * 11}v-6l4 2v6Z`} fill="#416759" />
            </g>
          ))}
          {level === 1 && <path d="M17 59L50 44L82 59L50 75Z" fill="#c89149" stroke="#f2ce8c" />}
          {landmark && (
            <>
              <path d="M18 78V32L30 26L30 80L24 85Z" fill="#e5c58f" />
              <path d="M70 80V26L83 32V78L76 84Z" fill="#c79d60" />
              <path d="M17 32v-7h4v4h4v-4h5v7M70 26v-6h4v3h4v-3h5v12" fill="#f1ddae" />
            </>
          )}
          {level >= 3 && (
            <path
              d={`M39 ${67 - height}v-10l12 -5l12 5v10l-12 6Z`}
              fill="#e8cc99"
              stroke="#fff0d0"
            />
          )}
        </>
      )}
      <path d="M16 77v-15M85 79V64" stroke="#8a6e3a" strokeWidth="2" />
      <path
        d="M16 63q-13 -11 -9 -1q8 1 9 1q-4 -13 4 -7q0 5 -4 7q11 -7 10 0q-6 3 -10 0M85 64q-12 -10 -9 -1q5 1 9 1q-3 -12 4 -7q0 5 -4 7q11 -6 8 1q-4 2 -8 -1"
        fill="#477550"
      />
    </svg>
  );
}

export function MillionairePawn({ color, number }: { color: string; number: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className="millionaire-pawn" viewBox="0 0 60 78" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}pawn`} cx=".28" cy=".18" r=".85">
          <stop stopColor="#ffffff" stopOpacity=".65" />
          <stop offset=".28" stopColor={color} />
          <stop offset="1" stopColor="#06352b" />
        </radialGradient>
      </defs>
      <ellipse cx="31" cy="73" rx="25" ry="4" fill="#382409" opacity=".28" />
      <ellipse cx="30" cy="65" rx="22" ry="10" fill={color} stroke="#fff8" strokeWidth="1" />
      <path d="M10 63Q12 48 24 34H36Q48 48 50 63Q30 77 10 63Z" fill={`url(#${id}pawn)`} />
      <path
        d="M22 37Q30 42 38 37"
        fill="none"
        stroke="#dff3d9"
        strokeOpacity=".6"
        strokeWidth="2"
      />
      <circle cx="30" cy="24" r="14" fill={`url(#${id}pawn)`} stroke="#fff4" />
      <text
        x="30"
        y="30"
        textAnchor="middle"
        fontFamily="system-ui"
        fill="white"
        fontSize="17"
        fontWeight="800"
      >
        {number}
      </text>
    </svg>
  );
}

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};
const ROTATIONS: Record<number, [number, number]> = {
  1: [0, 0],
  2: [-90, 0],
  3: [0, -90],
  4: [0, 90],
  5: [90, 0],
  6: [0, 180],
};

export function PhysicalDice({
  value,
  rolling,
  index,
  viewerSeat,
}: {
  value: number;
  rolling: boolean;
  index: number;
  viewerSeat: number;
}) {
  const [x, y] = ROTATIONS[value] ?? ROTATIONS[1];
  return (
    <span className={`millionaire-die-throw die-${index} ${rolling ? "is-rolling" : ""}`}>
      <span className="millionaire-die-shadow" />
      <span
        className="millionaire-die"
        style={
          {
            "--dice-x": x + "deg",
            "--dice-y": y + "deg",
            "--dice-view": -90 * viewerSeat + (index ? 11 : -8) + "deg",
          } as CSSProperties
        }
      >
        {[1, 6, 3, 4, 2, 5].map((face, side) => (
          <span key={face} className={`millionaire-die-face face-${side}`}>
            {Array.from({ length: 9 }, (_, pip) => (
              <i key={pip} className={PIPS[face].includes(pip) ? "is-pip" : ""} />
            ))}
          </span>
        ))}
      </span>
    </span>
  );
}
