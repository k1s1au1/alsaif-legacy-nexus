import { useId } from "react";
import councilSandyGround from "@/assets/council-sandy-ground-v1.webp";
import councilTerrainWide from "@/assets/council-terrain-wide-v1.webp";
import councilTerrainPortrait from "@/assets/council-terrain-portrait-v2.webp";
import { councilTowers } from "@/assets/najdi-council-towers-v1";
import "./heritage-portal-3d.css";
import "@/dashboard-reference-exact.css";

type HeritagePortal3DProps = {
  logoUrl?: string | null;
  greeting: string;
  name: string;
  message: string;
  className?: string;
  welcomeIntro?: boolean;
};

export function HeritagePortal3D({
  greeting,
  name,
  message,
  className = "",
  welcomeIntro = false,
}: HeritagePortal3DProps) {
  const colorFilterId = `council-portal-colors-${useId().replace(/:/g, "")}`;
  const terrainFilterId = `${colorFilterId}-terrain`;
  const groundFilterId = `${colorFilterId}-ground`;

  return (
    <div
      className={[
        "heritage-portal-3d",
        "heritage-pavilion-reference",
        "council-terrain-scene",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      dir="rtl"
      role="img"
      aria-label={[
        greeting,
        welcomeIntro ? `أهلًا بك في ${name}` : `حياك الله، ${name}`,
        message,
        "مجلس السيف",
        "تأسس عام ١٤٤٨ هجري",
      ].join(". ")}
    >
      <svg
        className="council-terrain-definitions"
        width="0"
        height="0"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <filter
            id={terrainFilterId}
            x="0%"
            y="0%"
            width="100%"
            height="100%"
            colorInterpolationFilters="sRGB"
          >
            {/* Keep the relief's light and texture while following the chosen identity. */}
            <feFlood
              style={{ floodColor: "var(--council-portal-background)" }}
              result="terrain-identity"
            />
            <feBlend
              in="SourceGraphic"
              in2="terrain-identity"
              mode="luminosity"
              result="terrain-shading"
            />
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="0 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0 0
                      6 -5 -1 0 0"
              result="terrain-contours"
            />
            <feFlood
              style={{ floodColor: "var(--council-portal-accent)" }}
              floodOpacity="0.8"
              result="terrain-gold"
            />
            <feComposite
              in="terrain-gold"
              in2="terrain-contours"
              operator="in"
              result="terrain-lit-edges"
            />
            <feBlend in="terrain-lit-edges" in2="terrain-shading" mode="normal" />
          </filter>
          <filter
            id={groundFilterId}
            x="0%"
            y="0%"
            width="100%"
            height="100%"
            colorInterpolationFilters="sRGB"
          >
            {/* Retain the soil grain and alpha while matching the dark terrain. */}
            <feComponentTransfer in="SourceGraphic" result="ground-shade">
              <feFuncR type="linear" slope="0.46" />
              <feFuncG type="linear" slope="0.46" />
              <feFuncB type="linear" slope="0.46" />
            </feComponentTransfer>
            <feFlood
              style={{ floodColor: "var(--council-portal-background)" }}
              result="ground-identity"
            />
            <feBlend
              in="ground-shade"
              in2="ground-identity"
              mode="luminosity"
              result="ground-surface"
            />
            <feComposite in="ground-surface" in2="SourceAlpha" operator="in" />
          </filter>
        </defs>
      </svg>
      <picture className="council-terrain-art" aria-hidden="true">
        <source
          media="(max-width: 699px), (max-width: 969.98px) and (orientation: portrait)"
          srcSet={councilTerrainPortrait}
        />
        <img
          src={councilTerrainWide}
          width="2098"
          height="749"
          alt=""
          draggable={false}
          decoding="async"
          style={{ filter: `url(#${terrainFilterId})` }}
        />
      </picture>
      <span className="council-portal-ambient" aria-hidden="true" />
      <span className="council-portal-sheen" aria-hidden="true" />

      <div className="council-portal-copy" aria-hidden="true">
        <p className="council-portal-greeting">{greeting}</p>

        <div className="council-portal-identity">
          <span>{welcomeIntro ? "أهلًا بك في" : "حياك الله،"}</span>
          <strong>{name}</strong>
        </div>

        <p className="council-portal-message" key={message}>
          {message}
        </p>
      </div>

      <div className="council-portal-model" aria-hidden="true">
        <div className="council-portal-model-visual">
          <img
            className="council-portal-ground council-portal-ground-back"
            src={councilSandyGround}
            alt=""
            draggable={false}
            style={{ filter: `url(#${groundFilterId})` }}
          />
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
                {/* Tint cooler stone gently while retaining the warm brass pixels. */}
                <feColorMatrix
                  in="SourceGraphic"
                  type="matrix"
                  values="0 0 0 0 0
                          0 0 0 0 0
                          0 0 0 0 0
                         -2 1 1 0 0.5"
                  result="stone-mask"
                />
                <feFlood
                  style={{ floodColor: "var(--council-portal-material)" }}
                  floodOpacity="0.35"
                  result="identity-tint"
                />
                <feComposite
                  in="identity-tint"
                  in2="stone-mask"
                  operator="in"
                  result="stone-tint"
                />
                <feBlend
                  in="stone-tint"
                  in2="SourceGraphic"
                  mode="soft-light"
                  result="harmonized-stone"
                />
                <feComposite
                  in="harmonized-stone"
                  in2="SourceGraphic"
                  operator="atop"
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

          <span className="council-portal-contact-shadow" />
          <img
            className="council-portal-ground council-portal-ground-front"
            src={councilSandyGround}
            alt=""
            draggable={false}
            style={{ filter: `url(#${groundFilterId})` }}
          />

          {welcomeIntro && <span className="council-portal-entry-light" />}
          <div className="council-tower-inscription">
            <strong
              className="council-tower-inscription-text"
              lang="ar"
              dir="rtl"
            >
              مجلس السيف
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
