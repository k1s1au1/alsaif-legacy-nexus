import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  decodeFamilyOccasionEventDescription,
  encodeFamilyOccasionEventDescription,
} from "@/lib/family-occasion-events";

const STORAGE_KEY = "alsaif:family-occasions";
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

type RemoteSnapshot = {
  active: LocalOccasion[];
  knownIds: Set<string>;
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

const itemSignature = (item: LocalOccasion) => JSON.stringify(item);

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

const encodeDescription = (occasion: LocalOccasion) =>
  encodeFamilyOccasionEventDescription(occasion);

const decodeOccasion = (row: EventRow): LocalOccasion | null => {
  const occasion = decodeFamilyOccasionEventDescription<LocalOccasion>(row.description);
  if (!occasion) return null;

  return {
    ...occasion,
    id: row.id,
    title: occasion.title ?? row.title ?? "",
    location: occasion.location ?? row.location ?? "",
  };
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
    let lastLocalById = new Map<string, string>();

    const rememberLocal = (items: LocalOccasion[]) => {
      lastLocalSignature = stable(items);
      lastLocalById = new Map(items.map((item) => [item.id, itemSignature(item)]));
    };

    const writeLocal = (items: LocalOccasion[]) => {
      const sorted = mergeById(items);
      const next = JSON.stringify(sorted);
      const changed = window.localStorage.getItem(STORAGE_KEY) !== next;
      if (changed) {
        window.localStorage.setItem(STORAGE_KEY, next);
        window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: next }));
        window.dispatchEvent(new CustomEvent("family-occasions:updated"));

        // The occasions route currently owns its own React state and only reads
        // localStorage on mount. When another device changes Supabase, refresh this
        // route once so remote deletions/edits are reflected immediately instead of
        // leaving stale cards visible until the user navigates away and back.
        if (window.location.pathname === "/family-occasions") {
          // Soft refresh: the page listens for this event and re-reads storage —
          // never reload the whole application.
          window.setTimeout(() => window.dispatchEvent(new CustomEvent("family-occasions:updated")), 0);
        }
      }
      rememberLocal(sorted);
      return changed;
    };

    const fetchRemote = async (): Promise<RemoteSnapshot> => {
      const { data, error } = await supabase
        .from("events")
        .select("id,title,description,event_type,location,starts_at,status,created_by")
        .order("starts_at", { ascending: true });
      if (error) throw error;

      const active: LocalOccasion[] = [];
      const knownIds = new Set<string>();

      for (const row of (data || []) as EventRow[]) {
        const occasion = decodeOccasion(row);
        if (!occasion) continue;
        knownIds.add(row.id);
        if (row.status !== "cancelled") active.push(occasion);
      }

      return { active, knownIds };
    };

    const getCurrentUserId = async () => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw authError || new Error("No authenticated user");
      return auth.user.id;
    };

    const pushItems = async (items: LocalOccasion[]) => {
      if (!items.length) return;
      const userId = await getCurrentUserId();
      const { error } = await supabase
        .from("events")
        .upsert(items.map((x) => toEventRow(x, userId)), { onConflict: "id" });
      if (error) throw error;
    };

    const cancelItems = async (ids: string[]) => {
      if (!ids.length) return;
      const { error } = await supabase
        .from("events")
        .update({ status: "cancelled" })
        .in("id", ids);
      if (error) throw error;
    };

    const bootstrap = async () => {
      if (disposed || syncing) return;
      syncing = true;
      try {
        const remote = await fetchRemote();
        const local = readLocal();
        const localOnly = local.filter((x) => !remote.knownIds.has(x.id));
        if (localOnly.length) await pushItems(localOnly);

        const finalRemote = localOnly.length ? await fetchRemote() : remote;
        writeLocal(finalRemote.active);
        lastCloudIds = new Set(finalRemote.active.map((x) => x.id));
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
        const localChanged = localSignature !== lastLocalSignature;

        if (localChanged) {
          const localIds = new Set(local.map((x) => x.id));
          const deletedIds = [...lastCloudIds].filter((id) => !localIds.has(id));
          const changedItems = local.filter(
            (item) => lastLocalById.get(item.id) !== itemSignature(item),
          );

          if (deletedIds.length) await cancelItems(deletedIds);
          if (changedItems.length) await pushItems(changedItems);
        }

        const remote = await fetchRemote();
        writeLocal(remote.active);
        lastCloudIds = new Set(remote.active.map((x) => x.id));
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
