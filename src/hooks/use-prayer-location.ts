import { useEffect, useSyncExternalStore } from "react";
import { createPrayerLocationStore, PRAYER_LOCATION_KEY, type LocationSnapshot } from "@/lib/prayer-location";
import { prayerGeolocation } from "@/lib/prayer-geolocation";

const serverSnapshot: LocationSnapshot = { status: "idle", error: null };
let store: ReturnType<typeof createPrayerLocationStore> | undefined;
function getStore() {
  if (!store) store = createPrayerLocationStore(prayerGeolocation, { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value), removeItem: key => localStorage.removeItem(key) });
  return store;
}
function subscribe(listener: () => void) {
  const current = getStore();
  const unsubscribe = current.subscribe(listener);
  const storage = (event: StorageEvent) => { if (event.key === PRAYER_LOCATION_KEY || event.key === null) current.reload(); };
  window.addEventListener("storage", storage);
  return () => { unsubscribe(); window.removeEventListener("storage", storage); };
}
export function usePrayerLocation() {
  const snapshot = useSyncExternalStore(subscribe, () => getStore().getSnapshot(), () => serverSnapshot);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState !== "hidden") void getStore().refreshIfGranted(); };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  return { ...snapshot, locate: () => { void getStore().request(); }, setTimeZone: (locationKey: string, timeZone: string) => getStore().setTimeZone(locationKey, timeZone) };
}
