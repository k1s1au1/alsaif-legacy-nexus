import {
  Home,
  Newspaper,
  MessageCircle,
  CalendarDays,
  ListChecks,
  Users,
  UsersRound,
  Handshake,
  Lock,
  Wallet,
  Archive,
  User,
  Settings,
  ShieldCheck,
  Ticket,
  PartyPopper,
} from "lucide-react";
import { LineageLegacyIcon } from "@/components/icons/lineage-legacy-icon";

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
  { id: "members", to: "/community", label: "الأعضاء", icon: Handshake },
  { id: "vault", to: "/vault", label: "الخزنة", icon: Lock },
  { id: "finance", to: "/finance", label: "الصندوق", icon: Wallet },
  { id: "archive", to: "/archive", label: "الألبوم", icon: Archive },
  { id: "family-occasions", to: "/family-occasions", label: "مناسبات العائلة", icon: PartyPopper },
  { id: "profile", to: "/profile", label: "ملفي", icon: User },
  { id: "settings", to: "/settings", label: "إعدادات", icon: Settings },
  { id: "admin", to: "/admin", label: "الإدارة", icon: ShieldCheck, adminOnly: true },
  { id: "trips", to: "/trips", label: "ترفيه", icon: Ticket },
  { id: "family-tree", to: "/family-tree", label: "نسب وأثر", icon: LineageLegacyIcon },
];

/**
 * Stored bottom-nav preferences keep the dashboard key first for backwards
 * compatibility. Only indexes 1 and 2 are user configurable; the rendered
 * dock always inserts Family Services in the middle and More at the end.
 */
export const DEFAULT_NAV_KEYS: NavItemKey[] = ["dashboard", "chat", "finance"];

const NAV_ITEM_KEYS = new Set<NavItemKey>(NAV_REGISTRY.map((item) => item.id));
const DEFAULT_CUSTOM_NAV_KEYS: NavItemKey[] = DEFAULT_NAV_KEYS.slice(1);

export function normalizeBottomNavKeys(value: unknown): NavItemKey[] {
  const requested = Array.isArray(value)
    ? value.filter(
        (key): key is NavItemKey => typeof key === "string" && NAV_ITEM_KEYS.has(key as NavItemKey),
      )
    : [];

  const customKeys: NavItemKey[] = [];
  for (const key of [...requested, ...DEFAULT_CUSTOM_NAV_KEYS]) {
    if (key === "dashboard" || customKeys.includes(key)) continue;
    customKeys.push(key);
    if (customKeys.length === 2) break;
  }

  return ["dashboard", ...customKeys];
}
