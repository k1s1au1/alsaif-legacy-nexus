import {
  MessageCircle, Ticket, CalendarDays, ListChecks, Newspaper, Trees, Wallet,
  History, Archive, Users, Lock, ChevronDown, ChevronUp, PartyPopper,
} from "lucide-react";
import { cn } from "@/lib/utils";
import React, { useState } from "react";
import { Link } from "@tanstack/react-router";

interface QuickActionProps { to: string; label: string; icon: any; color?: string; description?: string; }

function QuickAction({ to, label, icon, color, description }: QuickActionProps) {
  return (
    <Link to={to} className="family-service-card group flex flex-col items-center text-center focus:outline-none">
      <div className={cn("family-service-icon flex items-center justify-center text-white transition-transform duration-300 group-hover:-translate-y-1", color)}>
        {React.cloneElement(icon, { size: 24, strokeWidth: 1.8 })}
      </div>
      <span className="family-service-label font-black text-foreground">{label}</span>
      {description && <span className="family-service-description text-muted-foreground">{description}</span>}
    </Link>
  );
}

const services = [
  { to: "/finance", label: "الصندوق المالي", description: "إدارة الموارد المالية للعائلة", icon: <Wallet /> },
  { to: "/tasks", label: "المهام", description: "إدارة ومتابعة المهام", icon: <ListChecks /> },
  { to: "/trips", label: "الرحلات", description: "تنظيم الرحلات العائلية", icon: <Ticket /> },
  { to: "/meetings", label: "الاجتماعات", description: "جدولة اجتماعات العائلة", icon: <Users /> },
  { to: "/family-occasions", label: "مناسبات العائلة", description: "أفراح ومناسبات وذكريات العائلة", icon: <PartyPopper /> },
  { to: "/majlis", label: "المستندات", description: "أخبار ووثائق العائلة", icon: <Newspaper /> },
  { to: "/archive", label: "الألبومات", description: "ذكرياتنا في صور جميلة", icon: <Archive /> },
  { to: "/calendar", label: "تقويم العائلة", description: "المواعيد والمناسبات", icon: <CalendarDays /> },
  { to: "/chat", label: "المحادثات", description: "تواصل خاص بالعائلة", icon: <MessageCircle /> },
  { to: "/community", label: "ركن الأعضاء", description: "مجتمع أفراد العائلة", icon: <Users /> },
  { to: "/heritage", label: "الإرث", description: "تاريخ وإرث العائلة", icon: <History /> },
  { to: "/family-tree", label: "شجرة العائلة", description: "أجيال العائلة وروابطها", icon: <Trees /> },
  { to: "/vault", label: "الخزنة", description: "المحتوى العائلي الخاص", icon: <Lock /> },
];

export function QuickActionsBanner() {
  const [expanded, setExpanded] = useState(false);
  const visibleServices = expanded ? services : services.slice(0, 4);

  return (
    <>
      <style>{`
        /* Hide the services banner entirely on desktop / wide screens */
        @media (min-width: 1200px) {
          .family-services-section { display: none !important; }
        }

        .family-service-icon-primary {
          background: var(--nav-bg, var(--primary)) !important;
          color: white !important;
        }
        .family-service-icon-gold {
          background: linear-gradient(145deg, color-mix(in srgb,var(--gold-primary) 88%,white), color-mix(in srgb,var(--gold-primary) 75%,#725b2f)) !important;
          color: white !important;
        }

        @media (max-width: 1199px) {
          .family-services-section {
            background: var(--nav-bg, var(--primary)) !important;
            padding: 18px !important;
          }
          .family-services-panel {
            background: transparent !important;
            border: 0 !important;
            border-radius: 0 !important;
            padding: 4px 0 10px !important;
            box-shadow: none !important;
          }
          .family-services-heading h3 {
            color: color-mix(in srgb, var(--nav-fg, white) 94%, var(--gold-primary)) !important;
          }
          .family-services-top-toggle { color: var(--gold-primary) !important; }
          .family-service-card {
            background: color-mix(in srgb, var(--nav-bg, var(--primary)) 7%, white 93%) !important;
            border: 1px solid color-mix(in srgb, var(--nav-bg, var(--primary)) 18%, transparent) !important;
            border-radius: 28px !important;
            box-shadow: 0 12px 28px -20px rgba(0,0,0,.34) !important;
            justify-content: center !important;
          }
          .family-service-label { color: color-mix(in srgb, var(--nav-bg, var(--primary)) 78%, black) !important; }
          .family-service-description { color: color-mix(in srgb, var(--nav-bg, var(--primary)) 52%, #6b7280) !important; }
          .family-services-toggle {
            background: color-mix(in srgb, var(--nav-bg, var(--primary)) 88%, black 12%) !important;
            border-color: color-mix(in srgb, var(--gold-primary) 25%, transparent) !important;
            color: var(--nav-fg, white) !important;
            box-shadow: none !important;
          }
          .family-services-section + section,
          .family-services-section ~ section { margin-top: 0 !important; }
        }

        /* iPad / tablet: exactly four compact, tall service cards per row like the mobile reference. */
        @media (min-width: 768px) and (max-width: 1199px) {
          .family-services-section { padding: 24px clamp(24px,3.5vw,44px) 30px !important; }
          .family-services-panel { padding: 6px 0 12px !important; }
          .family-services-heading { margin-bottom: 18px !important; }
          .family-services-heading h3 { font-size: 25px !important; }
          .family-services-grid {
            display: grid !important;
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            gap: 16px !important;
            align-items: stretch !important;
          }
          .family-service-card {
            width: 100% !important;
            min-width: 0 !important;
            min-height: 215px !important;
            padding: 24px 14px 20px !important;
            gap: 10px !important;
          }
          .family-service-icon {
            width: 64px !important;
            height: 64px !important;
            border-radius: 20px !important;
            margin-bottom: 4px !important;
            box-shadow: 0 10px 18px -12px rgba(0,0,0,.55) !important;
          }
          .family-service-icon svg { width: 31px !important; height: 31px !important; }
          .family-service-label { font-size: 18px !important; line-height: 1.35 !important; }
          .family-service-description { font-size: 13px !important; line-height: 1.65 !important; max-width: 190px !important; }
          .family-services-toggle { margin-top: 18px !important; min-height: 58px !important; border-radius: 20px !important; }
        }
      `}</style>
      <section className="family-services-section animate-fade-up w-full" dir="rtl">
        <div className="family-services-panel">
          <div className="family-services-heading flex items-center justify-between">
            <h3>خدمات العائلة</h3>
            <button type="button" onClick={() => setExpanded(!expanded)} className="family-services-top-toggle">
              {expanded ? "إخفاء" : "عرض الكل"}
            </button>
          </div>

          <div className="family-services-grid">
            {visibleServices.map((service, index) => (
              <QuickAction key={`${service.to}-${service.label}`} {...service} color={index % 2 === 0 ? "family-service-icon-primary" : "family-service-icon-gold"} />
            ))}
          </div>

          <button type="button" onClick={() => setExpanded(!expanded)} className="family-services-toggle">
            <span>{expanded ? "إخفاء الخدمات" : "عرض جميع الخدمات"}</span>
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </section>
    </>
  );
}