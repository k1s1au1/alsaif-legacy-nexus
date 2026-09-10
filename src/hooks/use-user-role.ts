import { useEffect, useState } from "react";
import { getCurrentUser, supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "chairman"
  | "vice_chairman"
  | "technical_admin"
  | "member"
  | "guest"
  // legacy values kept for backward compatibility with old rows
  | "admin"
  | "manager";

export type Section =
  | "meetings"
  | "trips"
  | "occasions"
  | "tasks"
  | "news"
  | "community"
  | "faith"
  | "heritage"
  | "finance";

export const SECTIONS: Section[] = [
  "meetings",
  "trips",
  "occasions",
  "tasks",
  "news",
  "community",
  "faith",
  "heritage",
  "finance",
];

/** Maps legacy/DB section aliases to the official section keys. */
export function normalizeSection(section: string): Section {
  const s = (section || "").trim().toLowerCase();
  if (s === "events" || s === "occasion") return "occasions";
  if (s === "majlis") return "news";
  if (s === "family_tree" || s === "legacy") return "heritage";
  return s as Section;
}

export function sectionLabel(section: Section | string): string {
  switch (normalizeSection(String(section))) {
    case "meetings":
      return "الاجتماعات";
    case "trips":
      return "الرحلات";
    case "occasions":
      return "المناسبات";
    case "tasks":
      return "المهام";
    case "news":
      return "الأخبار";
    case "community":
      return "ركن الأعضاء";
    case "faith":
      return "نفحات إيمانية";
    case "heritage":
      return "نسب وأثر";
    case "finance":
      return "المالية";
    default:
      return String(section);
  }
}

export function sectionHeadLabel(section: Section | string): string {
  const s = normalizeSection(String(section));
  if (s === "heritage") return "مسؤول قسم نسب وأثر";
  return `مسؤول ${sectionLabel(s)}`;
}

export function roleLabel(role: AppRole | string | null): string {
  switch (role) {
    case "chairman":
      return "رئيس المجلس";
    case "vice_chairman":
      return "نائب رئيس المجلس";
    case "technical_admin":
    case "admin":
      return "المسؤول التقني";
    case "guest":
      return "ضيف المجلس";
    case "manager":
      return "عضو";
    default:
      return "عضو";
  }
}

export type PrivateRequestLike = {
  author_id: string;
  visibility: "leadership" | "chairman_only";
};

export function useUserRole() {
  const [userId, setUserId] = useState<string | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [sectionHeads, setSectionHeads] = useState<Section[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    let uid: string | null = null;
    (async () => {
      const { data: u } = await getCurrentUser();
      if (!active) return;
      if (!u.user) {
        setIsLoading(false);
        return;
      }
      uid = u.user.id;
      setUserId(u.user.id);

      const [{ data: r }, { data: sh }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
        supabase
          .from("section_heads" as any)
          .select("section")
          .eq("user_id", u.user.id),
      ]);
      if (!active) return;

      setRoles(((r ?? []) as { role: AppRole }[]).map((x) => x.role));
      setSectionHeads(
        ((sh ?? []) as unknown as { section: string }[]).map((x) => normalizeSection(x.section)),
      );
      setIsLoading(false);
    })();

    // Live permission updates: no sign-out needed after a rank change.
    const channel = supabase
      .channel(`role-sync-${reloadKey}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_roles" },
        (payload: any) => {
          const row = (payload.new ?? payload.old) as { user_id?: string } | null;
          if (uid && row?.user_id === uid) setReloadKey((k) => k + 1);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "section_heads" },
        (payload: any) => {
          const row = (payload.new ?? payload.old) as { user_id?: string } | null;
          if (uid && row?.user_id === uid) setReloadKey((k) => k + 1);
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [reloadKey]);

  const isChairman = roles.includes("chairman");
  const isViceChairman = roles.includes("vice_chairman");
  const isTechnicalAdmin = roles.includes("technical_admin") || roles.includes("admin");
  const isCouncilLeadership = isChairman || isViceChairman;
  const isGuest = roles.includes("guest");

  /** Is this user explicitly assigned as head of the given section? */
  const managesSection = (section: Section | string) =>
    sectionHeads.includes(normalizeSection(String(section)));

  /** Can this user manage the section content (leadership or its section head)? */
  const canManageSection = (section: Section | string) =>
    isCouncilLeadership || managesSection(section);

  const canManageRoles = isChairman;
  const canManageSectionHeads = isCouncilLeadership;
  const canCreateOfficialOccasion = isCouncilLeadership || managesSection("occasions");
  const canViewAuditLog = isCouncilLeadership;

  const canViewPrivateRequest = (request: PrivateRequestLike | null | undefined) => {
    if (!request) return false;
    if (userId && request.author_id === userId) return true;
    if (request.visibility === "chairman_only") return isChairman;
    return isCouncilLeadership;
  };

  const primaryRole: AppRole | null = isChairman
    ? "chairman"
    : isViceChairman
      ? "vice_chairman"
      : isTechnicalAdmin
        ? "technical_admin"
        : isGuest
          ? "guest"
          : roles.length
            ? "member"
            : null;

  return {
    userId,
    roles,
    sectionHeads,
    isLoading,
    isChairman,
    isViceChairman,
    isTechnicalAdmin,
    isCouncilLeadership,
    isGuest,
    managesSection,
    canManageSection,
    canManageRoles,
    canManageSectionHeads,
    canCreateOfficialOccasion,
    canViewAuditLog,
    canViewPrivateRequest,
    primaryRole,
    // ---- legacy aliases (kept so existing screens keep working) ----
    isAdmin: isChairman,
    isManager: sectionHeads.length > 0,
    isPrivileged: isCouncilLeadership,
    canManage: canManageSection,
  };
}
