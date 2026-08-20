import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "alsaif:family-occasions";
const RELOAD_GUARD = "alsaif:family-occasions:supabase-hydrated";

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

const mergeById = (remote: LocalOccasion[], local: LocalOccasion[]) => {
  const merged = new Map<string, LocalOccasion>();
  remote.forEach((x) => merged.set(x.id, x));
  local.forEach((x) => {
    if (!merged.has(x.id)) merged.set(x.id, x);
  });
  return [...merged.values()].sort((a, b) => {
    const ad = new Date(a.date || "9999-12-31").getTime();
    const bd = new Date(b.date || "9999-12-31").getTime();
    return ad - bd;
  });
};

export function FamilyOccasionsSync() {
  useEffect(() => {
    let disposed = false;
    let lastLocalSignature = "";
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

    const pull = async (allowReload = false) => {
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

        if (localOnly.length) {
          const { data: auth } = await supabase.auth.getUser();
          const { error: upsertError } = await (supabase as any)
            .from("family_occasions")
            .upsert(localOnly.map((x) => toDb(x, auth.user?.id)), { onConflict: "id" });
          if (upsertError) console.warn("Family occasions migration upsert failed", upsertError);
        }

        const merged = mergeById(remote, localOnly);
        const changed = writeLocal(merged);
        if (
          changed &&
          allowReload &&
          window.location.pathname === "/family-occasions" &&
          !window.sessionStorage.getItem(RELOAD_GUARD)
        ) {
          window.sessionStorage.setItem(RELOAD_GUARD, "1");
          window.location.reload();
        }
      } finally {
        syncing = false;
      }
    };

    const pushLocal = async () => {
      if (disposed || syncing) return;
      const local = readLocal();
      const signature = stable(local);
      if (signature === lastLocalSignature) return;
      syncing = true;
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (local.length > 0) {
          const { error } = await (supabase as any)
            .from("family_occasions")
            .upsert(local.map((x) => toDb(x, auth.user?.id)), { onConflict: "id" });
          if (error) {
            console.warn("Family occasions Supabase upsert failed", error);
            return;
          }
        }
        lastLocalSignature = signature;
      } finally {
        syncing = false;
      }
    };

    void pull(true);
    const timer = window.setInterval(() => {
      void pushLocal().then(() => pull(false));
    }, 2000);

    const onFocus = () => void pull(false);
    const onUpdated = () => void pushLocal();
    window.addEventListener("focus", onFocus);
    window.addEventListener("family-occasions:updated", onUpdated as EventListener);

    const channel = (supabase as any)
      .channel("family-occasions-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "family_occasions" },
        () => void pull(false),
      )
      .subscribe();

    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("family-occasions:updated", onUpdated as EventListener);
      void (supabase as any).removeChannel(channel);
    };
  }, []);

  return null;
}
