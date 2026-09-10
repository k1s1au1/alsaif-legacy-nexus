import { useQuery } from "@tanstack/react-query";
import { getCurrentUser, getSupabase } from "@/integrations/supabase/client";
import { useDayBoundaryKey } from "@/hooks/use-day-boundary";
import {
  isMeetingActive,
  isTaskActive,
  isTripActive,
  startOfLocalTodayIso,
} from "@/lib/day-lifecycle";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const supabase = getSupabase();
      const { data: { user } } = await getCurrentUser();
      if (!user) throw new Error("Not authenticated");

      const { data: p, error: pErr } = await supabase
        .from("profiles")
        .select("arabic_name, full_name, avatar_url, bottom_nav_prefs, allowed_sections")
        .eq("id", user.id)
        .maybeSingle();

      let profileData = p;
      if (pErr || !p) {
        const { data: coreP } = await supabase
          .from("profiles")
          .select("arabic_name, full_name, avatar_url")
          .eq("id", user.id)
          .maybeSingle();
        profileData = coreP;
      }

      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const rs = (r ?? []).map((x) => x.role as string);
      const profileName = profileData?.arabic_name || profileData?.full_name;

      const role = rs.includes("chairman")
        ? "رئيس المجلس"
        : rs.includes("admin")
          ? "مسؤول تقني"
          : rs.includes("manager")
            ? "مسؤول قسم"
            : "عضو المجلس";

      return {
        id: user.id,
        name: profileName || "عضو العائلة",
        realName: profileName,
        email: user.email,
        role,
        initial: (profileName?.[0] || user.email?.[0] || "ع").toUpperCase(),
        avatarPath: profileData?.avatar_url ?? null,
        bottomNavPrefs: (profileData?.bottom_nav_prefs as any[]) || null,
        allowedSections: (profileData?.allowed_sections as string[]) || [],
      };
    },
    staleTime: 0,
    gcTime: 1000 * 60 * 10,
  });
}

export function useDashboardCounts() {
  const activeDayKey = useDayBoundaryKey();

  return useQuery({
    queryKey: ["dashboard-counts", activeDayKey],
    queryFn: async () => {
      const supabase = getSupabase();
      const { data: { user } } = await getCurrentUser();
      if (!user) return null;

      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [{ count: memberCount }, { data: taskRows }, { count: newsCount }] =
        await Promise.all([
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase
            .from("tasks")
            .select("id,due_date,status,assignee_id"),
          supabase
            .from("majlis_posts")
            .select("id", { count: "exact", head: true })
            .gt("created_at", yesterday),
        ]);

      const activeTasks = (taskRows || []).filter((task: any) => isTaskActive(task));

      return {
        members: memberCount || 0,
        tasks: activeTasks.filter((task: any) => task.status !== "done").length,
        myTasks: activeTasks.filter(
          (task: any) => task.assignee_id === user.id && task.status !== "done",
        ).length,
        newNews: newsCount || 0,
      };
    },
    refetchInterval: 1000 * 60 * 2,
  });
}

export function useUpcomingEvents() {
  const activeDayKey = useDayBoundaryKey();

  return useQuery({
    queryKey: ["upcoming-events", activeDayKey],
    queryFn: async () => {
      const supabase = getSupabase();
      const now = new Date();
      const todayStartIso = startOfLocalTodayIso(now);

      const [{ data: meetings }, { data: trips }, { data: tasks }] = await Promise.all([
        supabase
          .from("meetings")
          .select("*")
          .neq("status", "cancelled")
          .gte("scheduled_at", todayStartIso)
          .order("scheduled_at")
          .limit(20),
        supabase
          .from("trips")
          .select("*")
          .order("start_date")
          .limit(50),
        supabase
          .from("tasks")
          .select("id, title, description, progress, priority, due_date, assignee_id, status, created_at")
          .neq("status", "done")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      return {
        meetings: (meetings || []).filter((item: any) => isMeetingActive(item, now)).slice(0, 5),
        trips: (trips || []).filter((item: any) => isTripActive(item, now)).slice(0, 5),
        tasks: (tasks || [])
          .filter((item: any) => isTaskActive(item, now))
          .slice(0, 5)
          .map((task: any) => ({
            ...task,
            progress: task.progress ?? (task.status === "in_progress" ? 40 : 0),
          })),
      };
    },
    // The dashboard must reflect newly added trips immediately instead of
    // keeping the previous one-trip result cached for five minutes.
    staleTime: 0,
    refetchInterval: 30 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
}

export function useDashboardAnnouncements() {
  return useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const supabase = getSupabase();
      const { data: posts } = await supabase
        .from("majlis_posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);

      if (!posts) return [];

      const annList = posts
        .filter(
          (p) =>
            (p.kind === "announcement" || p.body?.includes("---kind:announcement")) &&
            !p.body?.includes("---poll:"),
        )
        .slice(0, 5);

      return Promise.all(
        annList.map(async (a) => {
          const imgMatch = (a.body || "").match(/^---image:(.*)\n/);
          let url = null;
          if (imgMatch) {
            const { data } = await supabase.storage
              .from("trip-images")
              .createSignedUrl(imgMatch[1].trim(), 3600);
            url = data?.signedUrl;
          }
          return {
            ...a,
            imageUrl: url,
            cleanBody: (a.body || "")
              .replace(/^---image:.*\n/, "")
              .replace(/^---kind:.*\n/, "")
              .trim(),
            _label: a.kind === "announcement" ? "إعلان المجلس" : "أخبار السيف",
          };
        }),
      );
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useFundBalance() {
  return useQuery({
    queryKey: ["fund-balance"],
    queryFn: async () => {
      const supabase = getSupabase();
      const { data: tx } = await supabase.from("fund_transactions").select("amount, type");
      if (!tx) return 0;
      return tx.reduce(
        (acc, t) => (t.type === "contribution" ? acc + Number(t.amount) : acc - Number(t.amount)),
        0,
      );
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useHeritageSnippet() {
  return useQuery({
    queryKey: ["heritage-snippet"],
    queryFn: async () => {
      const supabase = getSupabase();
      const { data: posts } = await supabase
        .from("majlis_posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);

      const heritage = (posts ?? []).find((p) => p.title?.includes("[إرث]"));
      if (!heritage) return null;

      return {
        ...heritage,
        title: heritage.title.replace("[إرث]", "").trim(),
        cleanBody: (heritage.body || "")
          .replace(/---kind:.*\n/, "")
          .replace(/---image:.*\n/, "")
          .trim(),
      };
    },
    staleTime: 1000 * 60 * 10,
  });
}
