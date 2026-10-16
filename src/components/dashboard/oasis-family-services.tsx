import { useId, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  BookImage, BookOpen, CalendarDays, ChevronDown, ChevronUp, Handshake,
  ListChecks, Lock, MessageCircle, Newspaper, PartyPopper, Plane, Users, Wallet,
} from "lucide-react";
import { LineageLegacyIcon } from "@/components/icons/lineage-legacy-icon";
import "@/dashboard-reference-exact.css";

const services = [
  { to: "/finance", label: "الصندوق المالي", desc: "إدارة الموارد المالية للعائلة", icon: Wallet },
  { to: "/tasks", label: "المهام", desc: "إدارة ومتابعة المهام", icon: ListChecks },
  { to: "/trips", label: "الرحلات", desc: "تنظيم الرحلات العائلية", icon: Plane },
  { to: "/meetings", label: "الاجتماعات", desc: "جدولة اجتماعات العائلة", icon: Users },
  { to: "/family-occasions", label: "مناسبات العائلة", desc: "أفراح ومناسبات وذكريات العائلة", icon: PartyPopper },
  { to: "/majlis", label: "الأخبار", desc: "آخر أخبار العائلة", icon: Newspaper },
  { to: "/archive", label: "الألبومات", desc: "ذكرياتنا في صور جميلة", icon: BookImage },
  { to: "/calendar", label: "تقويم العائلة", desc: "المواعيد والمناسبات", icon: CalendarDays },
  { to: "/chat", label: "المحادثات", desc: "تواصل خاص بالعائلة", icon: MessageCircle },
  { to: "/community", label: "ركن الأعضاء", desc: "مجتمع أفراد العائلة", icon: Handshake },
  { to: "/family-tree", label: "نسب وأثر", desc: "أنساب العائلة وإرثها", icon: LineageLegacyIcon },
  { to: "/vault", label: "الخزنة", desc: "المحتوى العائلي الخاص", icon: Lock },
  { to: "/faith", label: "الصلاة ومصحفي", desc: "مواقيت الصلاة ومصحفك", icon: BookOpen },
];

function ServiceLink({ item }: { item: (typeof services)[number] }) {
  const Icon = item.icon;
  return (
    <Link to={item.to} className="oasis-service-link">
      <span className="oasis-service-medallion" aria-hidden="true">
        <Icon className="oasis-service-icon" strokeWidth={1.65} />
      </span>
      <strong>{item.label}</strong>
      <span className="oasis-service-description">{item.desc}</span>
    </Link>
  );
}

/** One responsive services panel; its surrounding oasis supplies day/night colors. */
export function OasisFamilyServices({ desktop = false }: { desktop?: boolean }) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const extraId = `${id}-extra-services`;

  return (
    <section
      className={`oasis-family-services ${desktop ? "desktop-services-panel" : "family-services-section"}`}
      dir="rtl"
      aria-labelledby={`${id}-heading`}
    >
      <div className="oasis-services-glass">
        <h2 id={`${id}-heading`} className="oasis-services-heading">خدمات العائلة</h2>
        <div className="oasis-services-grid oasis-services-primary">
          {services.slice(0, 4).map(item => <ServiceLink key={item.to} item={item} />)}
        </div>
        <button
          type="button"
          className="oasis-services-toggle"
          aria-expanded={expanded}
          aria-controls={extraId}
          onClick={() => setExpanded(value => !value)}
        >
          <span>{expanded ? "إخفاء الخدمات الإضافية" : "عرض جميع الخدمات"}</span>
          {expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
        </button>
        {/* Additional rows follow the trigger, so expansion is always downwards. */}
        <div id={extraId} className="oasis-services-grid oasis-services-extra" hidden={!expanded}>
          {services.slice(4).map(item => <ServiceLink key={item.to} item={item} />)}
        </div>
      </div>
    </section>
  );
}
