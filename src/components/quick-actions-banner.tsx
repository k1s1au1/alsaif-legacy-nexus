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
  { to: "/meetings", label: "التقويم", description: "المواعيد والمناسبات", icon: <CalendarDays /> },
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
        @media (max-width: 1023px) {
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
          .family-services-top-toggle {
            color: var(--gold-primary) !important;
          }
          .family-service-card {
            background: color-mix(in srgb, var(--nav-bg, var(--primary)) 9%, white 91%) !important;
            border-color: color-mix(in srgb, var(--nav-bg, var(--primary)) 20%, transparent) !important;
            box-shadow: 0 10px 24px -18px color-mix(in srgb, var(--nav-bg, var(--primary)) 55%, transparent) !important;
          }
          .family-service-label {
            color: color-mix(in srgb, var(--nav-bg, var(--primary)) 76%, black) !important;
          }
          .family-service-description {
            color: color-mix(in srgb, var(--nav-bg, var(--primary)) 55%, #6b7280) !important;
          }
          .family-services-toggle {
            background: color-mix(in srgb, var(--nav-bg, var(--primary)) 88%, black 12%) !important;
            border-color: color-mix(in srgb, var(--gold-primary) 25%, transparent) !important;
            color: var(--nav-fg, white) !important;
            box-shadow: none !important;
          }
          .family-services-section + section,
          .family-services-section ~ section {
            margin-top: 0 !important;
          }
        }
        @media (min-width: 600px) and (max-width: 1023px) {
          .family-services-section { padding: 24px 30px !important; }
          .family-services-panel { padding: 6px 0 12px !important; }
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