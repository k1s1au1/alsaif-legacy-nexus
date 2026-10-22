import { useId, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import {
  BookImage,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Handshake,
  ListChecks,
  Lock,
  MessageCircle,
  Newspaper,
  PartyPopper,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import { LineageLegacyIcon } from "@/components/icons/lineage-legacy-icon";
import "@/dashboard-reference-exact.css";

const services = [
  {
    to: "/finance",
    label: "الصندوق المالي",
    description: "إدارة الموارد المالية للعائلة",
    icon: Wallet,
  },
  { to: "/tasks", label: "المهام", description: "إدارة ومتابعة المهام", icon: ListChecks },
  { to: "/trips", label: "الرحلات", description: "تنظيم الرحلات العائلية", icon: Ticket },
  { to: "/meetings", label: "الاجتماعات", description: "جدولة اجتماعات العائلة", icon: Users },
  {
    to: "/family-occasions",
    label: "مناسبات العائلة",
    description: "أفراح ومناسبات وذكريات العائلة",
    icon: PartyPopper,
  },
  { to: "/majlis", label: "الأخبار", description: "آخر أخبار العائلة", icon: Newspaper },
  { to: "/archive", label: "الألبومات", description: "ذكرياتنا في صور جميلة", icon: BookImage },
  {
    to: "/calendar",
    label: "تقويم العائلة",
    description: "المواعيد والمناسبات",
    icon: CalendarDays,
  },
  { to: "/chat", label: "المحادثات", description: "تواصل خاص بالعائلة", icon: MessageCircle },
  { to: "/community", label: "ركن الأعضاء", description: "مجتمع أفراد العائلة", icon: Handshake },
  {
    to: "/family-tree",
    label: "نسب وأثر",
    description: "أنساب العائلة وإرثها",
    icon: LineageLegacyIcon,
  },
  { to: "/vault", label: "الخزنة", description: "المحتوى العائلي الخاص", icon: Lock },
  { to: "/faith", label: "الصلاة ومصحفي", description: "مواقيت الصلاة ومصحفك", icon: BookOpen },
];

const foldedServices = Array.from({ length: 3 }, (_, index) =>
  services.slice(4 + index * 3, 7 + index * 3),
);

function ServiceLink({ service }: { service: (typeof services)[number] }) {
  const Icon = service.icon;
  return (
    <Link
      to={service.to}
      className="family-services-paper__service"
      aria-label={`${service.label}، ${service.description}`}
    >
      <span className="family-services-paper__icon" aria-hidden="true">
        <Icon size={23} strokeWidth={1.8} />
      </span>
      <span className="family-services-paper__label">{service.label}</span>
    </Link>
  );
}

/** One paper directory shared by phone, tablet and desktop dashboard layouts. */
export function FamilyServicesPaper({ className = "" }: { className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const headingId = useId();
  const foldsId = useId();
  return (
    <section
      className={`family-services-paper ${className}`}
      dir="rtl"
      aria-labelledby={headingId}
      data-expanded={expanded}
    >
      <div className="family-services-paper__heading">
        <div>
          <h2 id={headingId}>خدمات العائلة</h2>
          <p>دليل المجلس، في ورقة واحدة</p>
        </div>
        <button
          type="button"
          className="family-services-paper__toggle"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={foldsId}
        >
          <span>{expanded ? "إخفاء الكل" : "عرض الكل"}</span>
          <ChevronDown size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="family-services-paper__sheet">
        <div className="family-services-paper__masthead">
          <strong>دليل خدمات العائلة</strong>
          <span>مـجـلـس السيف</span>
        </div>
        <div className="family-services-paper__primary">
          {services.slice(0, 4).map((service) => (
            <ServiceLink key={service.to} service={service} />
          ))}
        </div>
        <div
          id={foldsId}
          className="family-services-paper__folds"
          aria-hidden={!expanded}
          inert={!expanded}
        >
          {foldedServices.map((group, index) => (
            <div
              className="family-services-paper__fold"
              key={group[0].to}
              style={{ "--sheet-fold-order": index } as CSSProperties}
            >
              <div className="family-services-paper__fold-clip">
                <div className="family-services-paper__fold-face">
                  {group.map((service) => (
                    <ServiceLink key={service.to} service={service} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="family-services-paper__rules" aria-hidden="true" />
      </div>
    </section>
  );
}
