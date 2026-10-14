import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * Hook to request essential permissions at app startup.
 * Android will show the dialog for each requested permission if not already granted.
 */
export function useAppPermissions() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const requestAllPermissions = async () => {
      try {
        // 1. Camera & Photos
        const { Camera } = await import("@capacitor/camera");
        const cameraStatus = await Camera.checkPermissions();
        if (cameraStatus.camera !== 'granted' || cameraStatus.photos !== 'granted') {
          await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
        }

        // Location is requested by the prayer section when the member chooses
        // “تحديد موقعي”, avoiding a second permission flow at startup.

        // 3. Notifications (Usually handled by useFcm, but we can ensure it here)
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const pushStatus = await PushNotifications.checkPermissions();
        if (pushStatus.receive !== 'granted') {
          await PushNotifications.requestPermissions();
        }

        console.log("[Permissions] Essential permissions requested/checked.");
      } catch (error) {
        console.error("[Permissions] Error requesting permissions:", error);
      }
    };

    // We can delay it slightly to let the UI settle
    const timer = setTimeout(() => {
      void requestAllPermissions();
    }, 2000);

    return () => clearTimeout(timer);
  }, []);
}
