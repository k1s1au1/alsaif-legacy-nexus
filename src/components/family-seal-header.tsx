import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  ChevronDown,
  Home,
  LayoutGrid,
  Menu,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { NavItemDef } from "@/lib/navigation-registry";
import "@/family-seal-header.css";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface FamilySealService extends NavItemDef {
  description?: string;
}

interface FamilySealHeaderProps {
  logo: string | null;
  title: string;
  path: string;
  isAdmin: boolean;
  services: FamilySealService[];
  onOpenMenu: () => void;
  account: ReactNode;
  notifications: ReactNode;
}

export function FamilySealHeader({
  logo,
  title,
  path,
  isAdmin,
  services,
  onOpenMenu,
  account,
  notifications,
}: FamilySealHeaderProps) {
  const serviceActive = services.some((service) => path === service.to);

  return (
    <header className="family-seal-header" dir="rtl" aria-label="شريط العائلة">
      <div className="family-seal-utilities">
        <button
          type="button"
          className="family-seal-utility"
          aria-label="فتح القائمة"
          onClick={onOpenMenu}
        >
          <Menu size={21} aria-hidden="true" />
        </button>
        <Link
          to="/settings"
          className="family-seal-utility"
          aria-label="الإعدادات"
          aria-current={path === "/settings" ? "page" : undefined}
        >
          <Settings size={20} aria-hidden="true" />
        </Link>
      </div>

      <nav className="family-seal-wing family-seal-wing-start" aria-label="الرئيسية والخدمات">
        <Link
          to="/dashboard"
          className="family-seal-link"
          aria-current={path === "/dashboard" ? "page" : undefined}
        >
          <Home size={20} aria-hidden="true" />
          <span>الرئيسية</span>
        </Link>
        <DropdownMenu dir="rtl">
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="family-seal-link"
              data-active={serviceActive || undefined}
              aria-label="فتح قائمة الخدمات"
            >
              <LayoutGrid size={20} aria-hidden="true" />
              <span>الخدمات</span>
              <ChevronDown size={12} className="family-seal-chevron" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="center"
            sideOffset={12}
            collisionPadding={16}
            className="family-seal-service-menu"
          >
            <DropdownMenuLabel className="family-seal-service-heading">
              خدمات العائلة
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="family-seal-service-grid">
              {services.map((service) => {
                const Icon = service.icon;
                return (
                  <Link key={service.id} to={service.to}>
                    <DropdownMenuItem
                      className="family-seal-service-item"
                      data-active={path === service.to || undefined}
                    >
                      <Icon size={20} aria-hidden="true" />
                      <div>
                        <span>{service.label}</span>
                        {service.description && <small>{service.description}</small>}
                      </div>
                    </DropdownMenuItem>
                  </Link>
                );
              })}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      <div className="family-seal-medallion">
        <div className="family-seal-logo">
          {logo ? <img src={logo} alt="شعار العائلة" /> : <Sparkles size={22} aria-hidden="true" />}
        </div>
        <span className="family-seal-title">لوحة العائلة</span>
        <span className="family-seal-caption" title={title}>
          {path === "/dashboard" ? "الرئيسية" : title}
        </span>
      </div>

      <nav className="family-seal-wing family-seal-wing-end" aria-label="التقويم والإدارة">
        <Link
          to="/calendar"
          className="family-seal-link"
          aria-current={path === "/calendar" ? "page" : undefined}
        >
          <CalendarDays size={20} aria-hidden="true" />
          <span>التقويم</span>
        </Link>
        {isAdmin && (
          <Link
            to="/admin"
            className="family-seal-link"
            aria-current={path.startsWith("/admin") ? "page" : undefined}
          >
            <ShieldCheck size={20} aria-hidden="true" />
            <span>الإدارة</span>
          </Link>
        )}
      </nav>

      <div className="family-seal-utilities family-seal-account-controls">
        <div className="family-seal-account">{account}</div>
        <div className="family-seal-notifications">{notifications}</div>
      </div>
    </header>
  );
}
