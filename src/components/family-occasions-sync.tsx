import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "alsaif:family-occasions";
const MARKER = "__familyOccasion";

type LocalOccasion = {
  id: string;
  type: string;
  design?: number;
  title?: string;
  date?: string;
  time?: string;
  location?: string;
  details?: string;
  birthDate?: string;
  birthdayAudience?: string;
};

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  event_type: "wedding" | "birthday" | "graduation" | "religious" | "social" | "other";
  location: string | null;
  starts_at: string;
  status: "scheduled" | "cancelled" | "completed";
  created_by: string;
};

const readLocal = (): LocalOccasion[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => x?.id) : [];
  } catch {
    return [];
  }
};

const stable = (items: LocalOccasion[]) =>
  JSON.stringify([...items].sort((a, b) => a.id.localeCompare(b.id)));

const mergeById = (...groups: LocalOccasion[][]) => {
  const map = new Map<string, LocalOccasion>();
  groups.forEach((group) => group.forEach((item) => map.set(item.id, item)));
  return [...map.values()].sort((a, b) => {
    const ad = new Date(a.date || "9999-12-31").getTime();
    const bd = new Date(b.date || "9999-12-31").getTime();
    return ad - bd;
  });
};

const eventTypeFor = (type: string): EventRow["event_type"] => {
  if (type === "wedding") return "wedding";
  if (type === "birthday") return "birthday";
  if (type === "graduation") return "graduation";
  if (["ramadan", "eid_fitr", "eid_adha", "condolence"].includes(type)) return "religious";
  if (["gathering", "newborn", "promotion", "recovery"].includes(type)) return "social";
  return "other";
};

const startIso = (occasion: LocalOccasion) => {
  const date = occasion.date || new Date().toISOString().slice(0, 10);
  const time = occasion.time || "12:00";
  const value = new Date(`${date}T${time}:00`);
  return Number.isNaN(value.getTime()) ? new Date().toISOString() : value.toISOString();
};

const encodeDescription = (occasion: LocalOccasion) => JSON.stringify({ [MARKER]: true, occasion });

const decodeOccasion = (row: EventRow): LocalOccasion | null => {
  try {
    const payload = row.description ? JSON.parse(row.description) : null;
    if (!payload || payload[MARKER] !== true || !payload.occasion) return null;
    const o = payload.occasion as LocalOccasion;
    return { ...o, id: row.id, title: o.title ?? row.title ?? "", location: o.location ?? row.location ?? "" };
  } catch {
    return null;
  }
};

const toEventRow = (occasion: LocalOccasion, userId: string) => ({
  id: occasion.id,
  title: occasion.title?.trim() || "مناسبة عائلية",
  description: encodeDescription(occasion),
  event_type: eventTypeFor(occasion.type),
  location: occasion.location || null,
  location_url: null,
  starts_at: startIso(occasion),
  ends_at: null,
  status: "scheduled" as const,
  created_by: userId,
});

export function FamilyOccasionsSync() {
  useEffect(() => {
    let disposed = false;
    let syncing = false;
    let bootstrapped = false;
    let lastLocalSignature = "";
    let lastCloudIds = new Set<string>();

    const writeLocal = (items: LocalOccasion[]) => {
      const sorted = mergeById(items);
      const next = JSON.stringify(sorted);
      const changed = window.localStorage.getItem(STORAGE_KEY) !== next;
      if (changed) {
        window.localStorage.setItem(STORAGE_KEY, next);
        window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: next }));
        window.dispatchEvent(new CustomEvent("family-occasions:updated"));
      }
      lastLocalSignature = stable(sorted);
      return changed;
    };

    const fetchRemote = async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id,title,description,event_type,location,starts_at,status,created_by")
        .order("starts_at", { ascending: true });
      if (error) throw error;
      const occasions = ((data || []) as EventRow[]).map(decodeOccasion).filter((x): x is LocalOccasion => Boolean(x));
      lastCloudIds = new Set(occasions.map((x) => x.id));
      return occasions;
    };

    const pushItems = async (items: LocalOccasion[]) => {
      if (!items.length) return;
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw authError || new Error("No authenticated user");
      const { error } = await supabase.from("events").upsert(items.map((x) => toEventRow(x, auth.user.id)), { onConflict: "id" });
      if (error) throw error;
    };

    const bootstrap = async () => {
      if (disposed || syncing) return;
      syncing = true;
      try {
        const remote = await fetchRemote();
        const local = readLocal();
        const remoteIds = new Set(remote.map((x) => x.id));
        const localOnly = local.filter((x) => !remoteIds.has(x.id));

        // Important: every device may already contain occasions created before cloud sync.
        // Upload those first instead of overwriting them with whatever another device has.
        if (localOnly.length) await pushItems(localOnly);

        const merged = mergeById(remote, localOnly);
        writeLocal(merged);
        lastCloudIds = new Set(merged.map((x) => x.id));
        bootstrapped = true;
      } catch (error) {
        console.warn("Family occasions bootstrap sync failed", error);
      } finally {
        syncing = false;
      }
    };

    const syncNow = async () => {
      if (disposed || syncing || !bootstrapped) return;
      syncing = true;
      try {
        const local = readLocal();
        const remote = await fetchRemote();
        const remoteIds = new Set(remote.map((x) => x.id));
        const localOnly = local.filter((x) => !remoteIds.has(x.id));

        if (localOnly.length) await pushItems(localOnly);

        // Cloud wins for matching IDs; local-only records are migrated, never discarded.
        const merged = mergeById(localOnly, remote);
        writeLocal(merged);
        lastCloudIds = new Set(merged.map((x) => x.id));
      } catch (error) {
        console.warn("Family occasions Supabase events sync failed", error);
      } finally {
        syncing = false;
      }
    };

    void bootstrap();

    const timer = window.setInterval(() => void syncNow(), 1200);
    const onFocus = () => void syncNow();
    const onVisible = () => { if (document.visibilityState === "visible") void syncNow(); };
    const onUpdated = () => void syncNow();

    window.addEventListener("focus", onFocus);
    window.addEventListener("family-occasions:updated", onUpdated as EventListener);
    document.addEventListener("visibilitychange", onVisible);

    const channel = supabase
      .channel("family-occasions-events-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => void syncNow())
      .subscribe();

    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("family-occasions:updated", onUpdated as EventListener);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
