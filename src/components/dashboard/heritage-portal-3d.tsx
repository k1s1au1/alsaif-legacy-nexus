import gateAsset from "@/assets/diwan-gate.png.asset.json";

type HeritagePortal3DProps = {
  logoUrl?: string | null;
  className?: string;
};

export function HeritagePortal3D({
  logoUrl,
  className = "",
}: HeritagePortal3DProps) {
  return (
    <div
      className={`heritage-portal-3d ${className}`.trim()}
      role="img"
      aria-label="بوابة ديوان السيف ثلاثية الأبعاد"
    >
      <div className="heritage-portal-glow" aria-hidden="true" />

      <div className="heritage-portal-float">
        <div className="heritage-portal-frame">
          <img
            className="heritage-portal-gate"
            src={gateAsset.url}
            alt=""
            aria-hidden="true"
            decoding="async"
            loading="eager"
          />
          <div className="heritage-portal-sheen" aria-hidden="true" />
          {logoUrl ? (
            <span className="heritage-portal-crest" aria-hidden="true">
              <img src={logoUrl} alt="" />
            </span>
          ) : null}
        </div>
      </div>

      <div className="heritage-portal-ground" aria-hidden="true" />
    </div>
  );
}
