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

export function FamilyOccasionsSync() {
  useEffect(() => {
    let disposed = false;
    let lastLocalSignature = "";
    let syncing = false;

    const writeLocal = (items: LocalOccasion[]) => {
      const next = JSON.stringify(items);
      if (window.localStorage.getItem(STORAGE_KEY) === next) return false;
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

        // First device after the migration: preserve existing mobile/local occasions by uploading them.
        if (remote.length === 0 && local.length > 0) {
          const { data: auth } = await supabase.auth.getUser();
          await (supabase as any).from("family_occasions").upsert(
            local.map((x) => toDb(x, auth.user?.id)),
            { onConflict: "id" },
          );
          lastLocalSignature = stable(local);
          return;
        }

        const changed = writeLocal(remote);
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
        const { data: remoteRows, error: remoteError } = await (supabase as any)
          .from("family_occasions")
          .select("id");
        if (remoteError) {
          console.warn("Family occasions Supabase read-before-sync failed", remoteError);
          return;
        }

        if (local.length > 0) {
          const { error } = await (supabase as any).from("family_occasions").upsert(
            local.map((x) => toDb(x, auth.user?.id)),
            { onConflict: "id" },
          );
          if (error) {
            console.warn("Family occasions Supabase upsert failed", error);
            return;
          }
        }

        const localIds = new Set(local.map((x) => x.id));
        const deletedIds = (remoteRows || []).map((x: { id: string }) => x.id).filter((id: string) => !localIds.has(id));
        if (deletedIds.length) {
          const { error } = await (supabase as any).from("family_occasions").delete().in("id", deletedIds);
          if (error) console.warn("Family occasions Supabase delete sync failed", error);
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
