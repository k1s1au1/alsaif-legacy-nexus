import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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

type DbOccasion = {
  id: string;
  type: string;
  design: number | null;
  title: string | null;
  event_date: string | null;
  event_time: string | null;
  location: string | null;
  details: unknown;
  birth_date: string | null;
  birthday_audience: string | null;
};

const readLocal = (): LocalOccasion[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const value = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value.filter((x) => x?.id) : [];
  } catch {
    return [];
  }
};

const detailsToObject = (value?: string) => {
  try {
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
};

const detailsToString = (value: unknown) => {
  if (!value) return "{}";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return "{}";
  }
};

const toDb = (o: LocalOccasion, userId?: string | null) => ({
  id: o.id,
  type: o.type,
  design: o.design ?? 1,
  title: o.title ?? "",
  event_date: o.date || null,
  event_time: o.time || null,
  location: o.location ?? "",
  details: detailsToObject(o.details),
  birth_date: o.birthDate || null,
  birthday_audience: o.birthdayAudience || null,
  created_by: userId ?? null,
});

const fromDb = (o: DbOccasion): LocalOccasion => ({
  id: o.id,
  type: o.type,
  design: o.design ?? 1,
  title: o.title ?? "",
  date: o.event_date ?? "",
  time: o.event_time ?? "",
  location: o.location ?? "",
  details: detailsToString(o.details),
  birthDate: o.birth_date ?? undefined,
  birthdayAudience: o.birthday_audience ?? undefined,
});

const stable = (items: LocalOccasion[]) =>
  JSON.stringify([...items].sort((a, b) => a.id.localeCompare(b.id)));

const mergeById = (remote: LocalOccasion[], localOnly: LocalOccasion[]) => {
  const merged = new Map<string, LocalOccasion>();
  remote.forEach((x) => merged.set(x.id, x));
  localOnly.forEach((x) => merged.set(x.id, x));
  return [...merged.values()].sort((a, b) => {
    const ad = new Date(a.date || "9999-12-31").getTime();
    const bd = new Date(b.date || "9999-12-31").getTime();
    return ad - bd;
  });
};

export function FamilyOccasionsSync() {
  useEffect(() => {
    let disposed = false;
    let lastLocalSignature = stable(readLocal());
    let syncing = false;

    const writeLocal = (items: LocalOccasion[]) => {
      const next = JSON.stringify(items);
      if (window.localStorage.getItem(STORAGE_KEY) === next) {
        lastLocalSignature = stable(items);
        return false;
      }

      window.localStorage.setItem(STORAGE_KEY, next);
      lastLocalSignature = stable(items);
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: next }));
      window.dispatchEvent(new CustomEvent("family-occasions:updated"));
      return true;
    };

    const pushLocal = async () => {
      if (disposed || syncing) return;
      const local = readLocal();
      const signature = stable(local);
      if (signature === lastLocalSignature) return;

      syncing = true;
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return;

        const { error } = await (supabase as any)
          .from("family_occasions")
          .upsert(local.map((x) => toDb(x, auth.user?.id)), { onConflict: "id" });

        if (error) {
          console.warn("Family occasions Supabase upsert failed", error);
          return;
        }

        lastLocalSignature = signature;
      } finally {
        syncing = false;
      }
    };

    const pull = async () => {
      if (disposed || syncing) return;
      syncing = true;
      try {
        const { data, error } = await (supabase as any)
          .from("family_occasions")
          .select("id,type,design,title,event_date,event_time,location,details,birth_date,birthday_audience")
          .order("event_date", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false });

        if (error) {
          console.warn("Family occasions Supabase pull failed", error);
          return;
        }

        const remote = ((data || []) as DbOccasion[]).map(fromDb);
        const local = readLocal();
        const remoteIds = new Set(remote.map((x) => x.id));
        const localOnly = local.filter((x) => !remoteIds.has(x.id));

        // Preserve occasions created on a device before cloud sync was enabled.
        if (localOnly.length) {
          const { data: auth } = await supabase.auth.getUser();
          if (auth.user) {
            const { error: migrationError } = await (supabase as any)
              .from("family_occasions")
              .upsert(localOnly.map((x) => toDb(x, auth.user?.id)), { onConflict: "id" });
            if (migrationError) console.warn("Family occasions migration upsert failed", migrationError);
          }
        }

        const changed = writeLocal(mergeById(remote, localOnly));

        // The occasions page keeps its own React state. Reload only when remote data
        // really changed so an already-open phone page immediately reflects laptop edits.
        if (changed && window.location.pathname === "/family-occasions") {
          window.location.reload();
        }
      } finally {
        syncing = false;
      }
    };

    const syncNow = async () => {
      await pushLocal();
      await pull();
    };

    void syncNow();

    // Polling is intentional as a fallback for installed PWAs/backgrounded tabs where
    // realtime delivery can be delayed by the browser.
    const timer = window.setInterval(() => void syncNow(), 1000);

    const onFocus = () => void syncNow();
    const onVisible = () => {
      if (document.visibilityState === "visible") void syncNow();
    };
    const onUpdated = () => void pushLocal().then(() => pull());

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("family-occasions:updated", onUpdated as EventListener);

    const channel = (supabase as any)
      .channel("family-occasions-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "family_occasions" },
        () => void pull(),
      )
      .subscribe();

    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("family-occasions:updated", onUpdated as EventListener);
      void (supabase as any).removeChannel(channel);
    };
  }, []);

  return null;
}
