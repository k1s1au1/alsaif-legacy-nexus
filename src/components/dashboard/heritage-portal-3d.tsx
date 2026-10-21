import { CouncilVisitorCounter, visitorCountLabel } from "./council-visitor-counter";
import { useCouncilOasis } from "@/hooks/use-council-oasis";
import { CouncilTowerInscription } from "./council-tower-inscription";
import oasisDayWide from "@/assets/council-oasis-day-wide-v2.webp";
import oasisNightWide from "@/assets/council-oasis-night-wide-v2.webp";
import oasisDayPortrait from "@/assets/council-oasis-day-portrait-v2.webp";
import oasisNightPortrait from "@/assets/council-oasis-night-portrait-v2.webp";
import "./heritage-portal-3d.css";
import "@/dashboard-reference-exact.css";

type HeritagePortal3DProps = {
  logoUrl?: string | null;
  greeting: string;
  name: string;
  message: string;
  className?: string;
  welcomeIntro?: boolean;
  visitorCount?: number | null;
};

export function HeritagePortal3D({ greeting, name, message, className = "", welcomeIntro = false, visitorCount }: HeritagePortal3DProps) {
  const clock = useCouncilOasis();
  const liveGreeting = greeting.replace(/^(صباح الخير|مساء النور|مساء الخير)/, clock.greeting);

  return (
    <div
      className={["heritage-portal-3d", "heritage-pavilion-reference", "council-terrain-scene", "council-oasis-scene", visitorCount !== undefined && "has-council-visitor-counter", className].filter(Boolean).join(" ")}
      data-oasis-period={clock.period}
      data-oasis-clock={clock.source}
      dir="rtl"
      role="img"
      aria-label={[liveGreeting, welcomeIntro ? `أهلًا بك في ${name}` : `حياك الله، ${name}`, message, "مجلس السيف", "تأسس عام ١٤٤٨ هجري", clock.period === "day" ? "واحة السيف صباحًا" : "واحة السيف ليلًا", visitorCount === undefined ? "" : visitorCountLabel(visitorCount)].filter(Boolean).join(". ")}
    >
      <div className="council-portal-copy" aria-hidden="true">
        <p className="council-portal-greeting">{liveGreeting}</p>
        <div className="council-portal-identity">
          <span>{welcomeIntro ? "أهلًا بك في" : "حياك الله،"}</span>
          <strong>{name}</strong>
        </div>
        <p className="council-portal-message" key={message}>{message}</p>
        {visitorCount !== undefined && <CouncilVisitorCounter count={visitorCount} />}
      </div>

      {/* Composited artwork keeps the model, terrace and reflection in the same
          perspective. All welcome text and faith links remain live HTML. */}
      <div className="council-portal-model council-oasis-art" aria-hidden="true">
        {[
          { period: "day", wide: oasisDayWide, portrait: oasisDayPortrait },
          { period: "night", wide: oasisNightWide, portrait: oasisNightPortrait },
        ].map(art => (
          <div key={art.period} className="council-oasis-layer" data-period={art.period}>
            <picture className="council-oasis-picture">
              <source media="(max-width: 699px), (max-width: 969.98px) and (orientation: portrait)" srcSet={art.portrait} />
              <img src={art.wide} width="1939" height="811" alt="" draggable={false} decoding="async" />
            </picture>
            <CouncilTowerInscription source={art.wide} portrait={false} />
            <CouncilTowerInscription source={art.portrait} portrait />
          </div>
        ))}
      </div>
    </div>
  );
}
