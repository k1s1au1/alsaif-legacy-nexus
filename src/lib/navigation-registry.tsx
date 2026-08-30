import {
  Home,
  Newspaper,
  MessageCircle,
  CalendarDays,
  ListChecks,
  Users,
  UsersRound,
  Lock,
  Wallet,
  Archive,
  User,
  Settings,
  ShieldCheck,
  Ticket,
  Trees,
  History,
  PartyPopper,
} from "lucide-react";

export type NavItemKey =
  | "dashboard"
  | "news"
  | "chat"
  | "meetings"
  | "calendar"
  | "tasks"
  | "members"
  | "vault"
  | "finance"
  | "archive"
  | "profile"
  | "settings"
  | "admin"
  | "trips"
  | "family-tree"
  | "heritage"
  | "family-occasions";

export interface NavItemDef {
  id: NavItemKey;
  to: string;
  label: string;
  icon: any;
  adminOnly?: boolean;
}

export const NAV_REGISTRY: NavItemDef[] = [
  { id: "dashboard", to: "/dashboard", label: "الرئيسية", icon: Home },
  { id: "news", to: "/majlis", label: "الأخبار", icon: Newspaper },
  { id: "chat", to: "/chat", label: "محادثة", icon: MessageCircle },
  { id: "meetings", to: "/meetings", label: "اجتماعات", icon: UsersRound },
  { id: "calendar", to: "/calendar", label: "التقويم", icon: CalendarDays },
  { id: "tasks", to: "/tasks", label: "مهامي", icon: ListChecks },
  { id: "members", to: "/community", label: "الأعضاء", icon: Users },
  { id: "vault", to: "/vault", label: "الخزنة", icon: Lock },
  { id: "finance", to: "/finance", label: "الصندوق", icon: Wallet },
  { id: "archive", to: "/archive", label: "الألبوم", icon: Archive },
  { id: "family-occasions", to: "/family-occasions", label: "مناسبات العائلة", icon: PartyPopper },
  { id: "profile", to: "/profile", label: "ملفي", icon: User },
  { id: "settings", to: "/settings", label: "إعدادات", icon: Settings },
  { id: "admin", to: "/admin", label: "الإدارة", icon: ShieldCheck, adminOnly: true },
  { id: "trips", to: "/trips", label: "ترفيه", icon: Ticket },
  { id: "family-tree", to: "/family-tree", label: "الشجرة", icon: Trees },
  { id: "heritage", to: "/heritage", label: "الإرث", icon: History },
];

export const DEFAULT_NAV_KEYS: NavItemKey[] = ["dashboard", "news", "chat"];
