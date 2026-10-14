import { Capacitor } from "@capacitor/core";
import type { LocationAdapter, LocationPermission } from "./prayer-location";

const permissionError = () => Object.assign(new Error("Location permission denied"), { code: 1 });
export const prayerGeolocation: LocationAdapter = {
  async permission() {
    if (Capacitor.isNativePlatform()) {
      const { Geolocation } = await import("@capacitor/geolocation");
      const status = await Geolocation.checkPermissions();
      if (status.location === "granted" || status.coarseLocation === "granted") return "granted";
      return status.location === "denied" ? "denied" : "prompt";
    }
    if (!navigator.geolocation || !window.isSecureContext) return "unavailable";
    try { return (await navigator.permissions.query({ name: "geolocation" })).state as LocationPermission; } catch { return "prompt"; }
  },
  async position(requestPermission) {
    const options = { enableHighAccuracy: true, timeout: 15000, maximumAge: requestPermission ? 0 : 60000 };
    if (Capacitor.isNativePlatform()) {
      const { Geolocation } = await import("@capacitor/geolocation");
      let permission = await Geolocation.checkPermissions();
      if (permission.location !== "granted" && permission.coarseLocation !== "granted") {
        if (!requestPermission) throw permissionError();
        permission = await Geolocation.requestPermissions({ permissions: ["location"] });
      }
      if (permission.location !== "granted" && permission.coarseLocation !== "granted") throw permissionError();
      const position = await Geolocation.getCurrentPosition(options);
      return { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, obtainedAt: position.timestamp };
    }
    if (!navigator.geolocation || !window.isSecureContext) throw Object.assign(new Error("Geolocation unavailable"), { code: "unsupported" });
    if (!requestPermission && await prayerGeolocation.permission() !== "granted") throw permissionError();
    return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, obtainedAt: position.timestamp }), reject, options));
  },
};
