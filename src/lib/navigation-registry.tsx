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
  BookImage,
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
  { id: "archive", to: "/archive", label: "الألبوم", icon: BookImage },
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
  const stored = isPreferenceRecord(value) ? value.bottom : value;
  const requested = validNavKeys(stored);

  const customKeys: NavItemKey[] = [];
  for (const key of [...requested, ...DEFAULT_CUSTOM_NAV_KEYS]) {
    if (key === "dashboard" || customKeys.includes(key)) continue;
    customKeys.push(key);
    if (customKeys.length === 2) break;
  }

  return ["dashboard", ...customKeys];
}

export interface NavigationAccess {
  canAccessAdmin: boolean;
  isGuest?: boolean;
  allowedSections?: readonly string[];
}

type NavigationPreferences = NavItemKey[] | {
  v: 1;
  bottom: NavItemKey[];
  header?: NavItemKey[];
};

function isPreferenceRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validNavKeys(value: unknown): NavItemKey[] {
  return Array.isArray(value)
    ? value.filter(
        (key): key is NavItemKey => typeof key === "string" && NAV_ITEM_KEYS.has(key as NavItemKey),
      )
    : [];
}

/** An absent header preference follows the user's current permissions. */
export function getStoredHeaderNavKeys(value: unknown): NavItemKey[] | undefined {
  return isPreferenceRecord(value) && Array.isArray(value.header)
    ? validNavKeys(value.header)
    : undefined;
}

export function canAccessNavItem(item: NavItemDef, access: NavigationAccess): boolean {
  if (item.adminOnly && !access.canAccessAdmin) return false;
  if (!access.isGuest) return true;
  return ["dashboard", "profile", "settings", "members"].includes(item.id) ||
    !!access.allowedSections?.includes(item.id);
}

export function normalizeHeaderNavKeys(value: unknown, access: NavigationAccess): NavItemKey[] {
  const defaults: NavItemKey[] = ["calendar", access.canAccessAdmin ? "admin" : "chat"];
  const result: NavItemKey[] = [];
  for (const key of [...validNavKeys(value), ...defaults, ...NAV_REGISTRY.map((item) => item.id)]) {
    const item = NAV_REGISTRY.find((entry) => entry.id === key);
    if (!item || key === "dashboard" || result.includes(key) || !canAccessNavItem(item, access)) continue;
    result.push(key);
    if (result.length === 2) break;
  }
  return result;
}

/** Keep legacy arrays readable and preserve the other bar when one is edited. */
export function updateNavigationPreferences(
  current: unknown,
  change: { bottom?: NavItemKey[]; header?: NavItemKey[] | null },
): NavigationPreferences {
  const bottom = normalizeBottomNavKeys(change.bottom ?? current);
  const header = change.header === null
    ? undefined
    : change.header === undefined
      ? getStoredHeaderNavKeys(current)
      : validNavKeys(change.header);
  return header === undefined ? bottom : { v: 1, bottom, header };
}
