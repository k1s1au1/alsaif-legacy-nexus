import { normalizePrayerLocation, prayerLocationKey, validTimeZone, type PrayerLocation } from "./prayer-times";

export const PRAYER_LOCATION_KEY = "alsaif:prayer-location:v1";
export type LocationPermission = "granted" | "denied" | "prompt" | "unavailable";
export type LocationAdapter = { permission: () => Promise<LocationPermission>; position: (requestPermission: boolean) => Promise<PrayerLocation> };
export type LocationSnapshot = { location?: PrayerLocation; status: "idle" | "locating" | "ready" | "saved" | "error"; error: string | null };
type LocationStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function prayerLocationError(error: unknown) {
  const code = (error as { code?: string | number })?.code;
  if (code === 1 || code === "OS-PLUG-GLOC-0003" || code === "OS-PLUG-GLOC-0008") return { denied: true, message: "إذن الموقع غير مفعّل. اسمح بالموقع من إعدادات المتصفح أو التطبيق ثم أعد المحاولة." };
  if (["OS-PLUG-GLOC-0007", "OS-PLUG-GLOC-0009", "OS-PLUG-GLOC-0017"].includes(String(code))) return { denied: false, message: "خدمات الموقع متوقفة. فعّل الموقع في جهازك ثم أعد المحاولة." };
  if (code === 3 || code === "OS-PLUG-GLOC-0010") return { denied: false, message: "استغرق تحديد موقعك وقتًا طويلًا. جرّب قرب نافذة أو في مكان مفتوح ثم أعد المحاولة." };
  if (code === "unsupported") return { denied: false, message: "تحديد الموقع غير متاح في هذا المتصفح. افتح الموقع عبر متصفح يدعم الموقع واتصال آمن." };
  return { denied: false, message: "تعذر تحديد موقعك. تأكد من تفعيل خدمات الموقع وأعد المحاولة." };
}

// One shared request for all mounted shortcuts/panels. No background tracking.
export function createPrayerLocationStore(adapter: LocationAdapter, storage: LocationStorage, now = () => Date.now()) {
  const read = () => { try { return normalizePrayerLocation(JSON.parse(storage.getItem(PRAYER_LOCATION_KEY) || "null")); } catch { return undefined; } };
  const stored = read();
  let snapshot: LocationSnapshot = { location: stored, status: stored ? "saved" : "idle", error: null };
  let inFlight: Promise<void> | undefined;
  let checking: Promise<void> | undefined;
  let lastCheck = 0;
  const listeners = new Set<() => void>();
  const publish = (state: LocationSnapshot) => { snapshot = state; listeners.forEach(listener => listener()); };
  const save = (location?: PrayerLocation) => { try { if (location) storage.setItem(PRAYER_LOCATION_KEY, JSON.stringify(location)); else storage.removeItem(PRAYER_LOCATION_KEY); } catch { /* In-memory location still works when storage is blocked. */ } };
  const fail = (error: unknown) => {
    const failure = prayerLocationError(error);
    if (failure.denied) save();
    publish({ location: failure.denied ? undefined : snapshot.location, status: snapshot.location && !failure.denied ? "saved" : "error", error: failure.message });
  };
  const request = (requestPermission = true): Promise<void> => {
    if (inFlight) return inFlight;
    publish({ ...snapshot, status: "locating", error: null });
    lastCheck = now();
    inFlight = Promise.resolve().then(() => adapter.position(requestPermission)).then(value => {
      const location = normalizePrayerLocation(value);
      if (!location) throw new Error("Invalid device location");
      if (snapshot.location && prayerLocationKey(snapshot.location) === prayerLocationKey(location)) location.timeZone = snapshot.location.timeZone;
      save(location);
      publish({ location, status: "ready", error: null });
    }).catch(fail).finally(() => { inFlight = undefined; });
    return inFlight;
  };
  const refreshIfGranted = (): Promise<void> => {
    if (inFlight) return inFlight;
    if (checking) return checking;
    if (now() - lastCheck < 60000) return Promise.resolve();
    lastCheck = now();
    checking = adapter.permission().then(permission => {
      if (permission === "granted") return request(false);
      if (permission === "denied") fail({ code: 1 });
    }).catch(fail).finally(() => { checking = undefined; });
    return checking;
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    request,
    refreshIfGranted,
    reload: () => { const location = read(); publish({ location, status: location ? "saved" : "idle", error: null }); },
    setTimeZone: (locationKey: string, timeZone: string) => {
      if (!snapshot.location || prayerLocationKey(snapshot.location) !== locationKey || snapshot.location.timeZone === timeZone || !validTimeZone(timeZone)) return;
      const location = { ...snapshot.location, timeZone }; save(location); publish({ ...snapshot, location });
    },
  };
}
