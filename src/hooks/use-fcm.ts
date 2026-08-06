import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { setupPushNotifications } from "@/lib/pushNotifications";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { FCM_VAPID_KEY, FIREBASE_CONFIG } from "@/lib/fcm-config";
import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";

/**
 * Hook to initialize push notifications for both Web and Mobile.
 */
export function useFcm() {
  const navigate = useNavigate();

  useEffect(() => {
    let unsubscribeForeground: (() => void) | undefined;

    const initPush = async () => {
      // 1. Native Platform (Mobile App)
      if (Capacitor.isNativePlatform()) {
        try {
          console.log("[Push] Initiating Native Push setup...");
          await setupPushNotifications(navigate);
        } catch (err) {
          console.error("[Push] Native setup failed hook:", err);
        }
      }
      // 2. Web Platform (Browser)
      else if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        try {
          if (!(await isSupported())) return;

          // Browsers require a direct user gesture before showing the prompt.
          // The settings button handles first-time permission requests; here we
          // only restore registration when permission was already granted.
          if (Notification.permission !== "granted") return;

          const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
            scope: "/",
          });
          await navigator.serviceWorker.ready;

          const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
          const messaging = getMessaging(app);

           // Firebase does not display notification payloads automatically while
           // the web app is in the foreground. Listen explicitly and display a
           // real browser notification so a successful test is visible at once.
           unsubscribeForeground = onMessage(messaging, (payload) => {
             const title = payload.notification?.title || payload.data?.title || "إشعار جديد";
             const body = payload.notification?.body || payload.data?.body || "";
             const targetUrl = payload.data?.url || "/";

             if (Notification.permission !== "granted") return;

             const notification = new Notification(title, {
               body,
               icon: "/logo.png",
               badge: "/logo.png",
               data: { url: targetUrl },
             });

             notification.onclick = () => {
               window.focus();
               notification.close();
               if (targetUrl.startsWith("/")) navigate({ to: targetUrl });
             };
           });

          const token = await getToken(messaging, {
            vapidKey: FCM_VAPID_KEY,
            serviceWorkerRegistration: registration,
          });

          if (token) {
            const { data: auth } = await supabase.auth.getUser();
            if (auth.user) {
              await supabase.from("push_tokens").upsert(
                {
                  user_id: auth.user.id,
                  token,
                  platform: "web",
                  is_active: true,
                },
                { onConflict: "user_id,token" }
              );
            }
          }
        } catch (err) {
          console.warn("[Push] Web initialization failed:", err);
        }
      }
    };

    void initPush();
    return () => unsubscribeForeground?.();
  }, [navigate]);
}
