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

const encodeDescription = (occasion: LocalOccasion) =>
  JSON.stringify({ [MARKER]: true, occasion });

const decodeOccasion = (row: EventRow): LocalOccasion | null => {
  try {
    const payload = row.description ? JSON.parse(row.description) : null;
    if (!payload || payload[MARKER] !== true || !payload.occasion) return null;
    const o = payload.occasion as LocalOccasion;
    return {
      ...o,
      id: row.id,
      title: o.title ?? row.title ?? "",
      location: o.location ?? row.location ?? "",
    };
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
    let lastLocalSignature = stable(readLocal());
    let lastCloudIds = new Set<string>();

    const writeLocal = (items: LocalOccasion[]) => {
      const sorted = [...items].sort((a, b) => {
        const ad = new Date(a.date || "9999-12-31").getTime();
        const bd = new Date(b.date || "9999-12-31").getTime();
        return ad - bd;
      });
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
      const occasions = ((data || []) as EventRow[])
        .map(decodeOccasion)
        .filter((x): x is LocalOccasion => Boolean(x));
      lastCloudIds = new Set(occasions.map((x) => x.id));
      return occasions;
    };

    const pushSnapshot = async (items: LocalOccasion[], removedIds: string[] = []) => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw authError || new Error("No authenticated user");

      if (items.length) {
        const { error } = await supabase
          .from("events")
          .upsert(items.map((x) => toEventRow(x, auth.user.id)), { onConflict: "id" });
        if (error) throw error;
      }

      if (removedIds.length) {
        const { error } = await supabase.from("events").delete().in("id", removedIds);
        if (error) throw error;
      }
    };

    const bootstrap = async () => {
      if (disposed || syncing) return;
      syncing = true;
      try {
        const remote = await fetchRemote();
        const local = readLocal();

        if (remote.length === 0 && local.length > 0) {
          await pushSnapshot(local);
          lastCloudIds = new Set(local.map((x) => x.id));
          lastLocalSignature = stable(local);
        } else {
          writeLocal(remote);
        }
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
        const localSignature = stable(local);

        if (localSignature !== lastLocalSignature) {
          const localIds = new Set(local.map((x) => x.id));
          const removed = [...lastCloudIds].filter((id) => !localIds.has(id));
          await pushSnapshot(local, removed);
          lastLocalSignature = localSignature;
          lastCloudIds = new Set(localIds);
        }

        const remote = await fetchRemote();
        writeLocal(remote);
      } catch (error) {
        console.warn("Family occasions Supabase events sync failed", error);
      } finally {
        syncing = false;
      }
    };

    void bootstrap();

    const timer = window.setInterval(() => void syncNow(), 1200);
    const onFocus = () => void syncNow();
    const onVisible = () => {
      if (document.visibilityState === "visible") void syncNow();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    const channel = supabase
      .channel("family-occasions-events-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => void syncNow())
      .subscribe();

    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
