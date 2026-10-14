import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { CalendarDays, Users, ListChecks, Wallet } from "lucide-react";

const items = [
  { to: "/family-occasions", label: "المناسبات", icon: CalendarDays },
  { to: "/meetings", label: "الاجتماعات", icon: Users },
  { to: "/tasks", label: "المهام", icon: ListChecks },
  { to: "/finance", label: "الصندوق المالي", icon: Wallet },
] as const;

export function DesktopSidebarQuickAccess() {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth < 1200) return;

    const findTarget = () => {
      const nav = document.querySelector<HTMLElement>("aside.fixed.inset-y-0.right-0.z-\\[120\\] > nav");
      setTarget(nav);
    };

    findTarget();
    const observer = new MutationObserver(findTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", findTarget);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", findTarget);
    };
  }, []);

  if (!target) return null;

  return createPortal(
    <section className="desktop-sidebar-quick-access" aria-label="الوصول السريع" dir="rtl">
      <div className="desktop-sidebar-quick-access-title">الوصول السريع</div>
      <div className="desktop-sidebar-quick-access-grid">
        {items.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="desktop-sidebar-quick-access-item">
            <span className="desktop-sidebar-quick-access-icon"><Icon size={20} strokeWidth={2.2} /></span>
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </section>,
    target,
  );
}
