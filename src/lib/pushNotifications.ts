import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Sets up native push notifications (Android via Capacitor).
 */
export async function setupPushNotifications(navigate?: (options: { to: string }) => void) {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    console.log("[Push] Checking permissions...");
    let perm = await PushNotifications.checkPermissions();
    console.log("[Push] Initial permission state:", perm.receive);

    if (perm.receive === "prompt") {
      perm = await PushNotifications.requestPermissions();
      console.log("[Push] Permission state after request:", perm.receive);
    }

    if (perm.receive !== "granted") {
      console.warn("[Push] Permissions not granted by user.");
      // Optional: don't toast here to avoid annoyance on every boot
      return;
    }

    // 0. Create Notification Channel (Required for Android 8+)
    try {
      await PushNotifications.createChannel({
        id: "alsaif_notifications",
        name: "إشعارات المجلس",
        description: "إشعارات الاجتماعات والرسائل والفعاليات العائلية",
        importance: 5, // high
        visibility: 1, // public
        sound: "default",
        vibration: true,
      });
      console.log("[Push] Channel created successfully");
    } catch (e) {
      console.warn("[Push] Channel creation failed:", e);
    }

    // 1. Clear existing listeners to avoid duplicates on re-init
    await PushNotifications.removeAllListeners();

    // 2. Add listeners
    await PushNotifications.addListener("registration", async (token) => {
      console.log("[Push] Registration successful, token:", token.value);
      localStorage.setItem("fcm_token", token.value);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        console.log("[Push] No user logged in, token stored locally for later.");
        return;
      }

      const { error } = await supabase.from("push_tokens").upsert(
        {
          user_id: auth.user.id,
          token: token.value,
          platform: Capacitor.getPlatform(),
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,token" },
      );

      if (!error) {
        console.log("[Push] Token saved successfully to Supabase.");
      } else {
        console.error("[Push] Error saving token to Supabase:", error);
      }
    });

    await PushNotifications.addListener("registrationError", (err) => {
      console.error("[Push] FCM Registration error:", err);
    });

    await PushNotifications.addListener("pushNotificationReceived", async (notification) => {
      console.log("[Push] Notification received in foreground:", notification);
      const title = notification.title || (notification.data as any)?.title || "تنبيه جديد";
      const body = notification.body || (notification.data as any)?.body || "";

      // Android does not display push payloads while the app is in the
      // foreground, so mirror it as a real system notification.
      try {
        const { LocalNotifications } = await import("@capacitor/local-notifications");
        let lp = await LocalNotifications.checkPermissions();
        if (lp.display !== "granted") lp = await LocalNotifications.requestPermissions();
        if (lp.display === "granted") {
          await LocalNotifications.createChannel({
            id: "alsaif_notifications",
            name: "إشعارات المجلس",
            importance: 5,
            visibility: 1,
            sound: "default",
            vibration: true,
          });
          await LocalNotifications.schedule({
            notifications: [
              {
                id: Math.floor(Math.random() * 100000),
                title,
                body,
                channelId: "alsaif_notifications",
                smallIcon: "ic_launcher",
                extra: notification.data || {},
              },
            ],
          });
        }
      } catch (e) {
        console.warn("[Push] Local mirror failed:", e);
      }

      toast.info(title, {
        description: body,
        duration: 5000,
        action: {
          label: "فتح",
          onClick: () => {
            const url = (notification.data as any)?.url;
            if (url && navigate) navigate({ to: url as any });
          }
        }
      });
    });

    // Tapping the mirrored local notification should also deep-link
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      await LocalNotifications.removeAllListeners();
      await LocalNotifications.addListener("localNotificationActionPerformed", (ev: any) => {
        const url = ev?.notification?.extra?.url;
        if (url && navigate) navigate({ to: url as any });
      });
    } catch (e) {
      console.warn("[Push] Local listener failed:", e);
    }


    await PushNotifications.addListener("pushNotificationActionPerformed", async (notification: any) => {
      console.log("[Push] Notification action performed:", notification);
      const { actionId, notification: data } = notification;
      const meetingId = data.data?.meeting_id;
      const url = data.data?.url;

      // Handle RSVP buttons from notification
      if (meetingId && (actionId === "going" || actionId === "not_going")) {
        try {
          const { data: auth } = await supabase.auth.getUser();
          if (!auth.user) return;

          const rsvp = actionId === "going" ? "going" : "not_going";
          await supabase
            .from("meeting_attendees")
            .upsert(
              { meeting_id: meetingId, user_id: auth.user.id, rsvp },
              { onConflict: "meeting_id,user_id" },
            );

          if (rsvp === "going") toast.success("تم تأكيد حضورك ✨");
          else toast.info("تم تسجيل اعتذارك.");
        } catch (e) {
          console.error("[Push] Background RSVP error:", e);
        }
      }

      // Handle Deep Linking (Redirection)
      if (url && navigate) {
        navigate({ to: url as any });
      }
    });

    // 3. Register Action Types (The buttons)
    await (PushNotifications as any).registerActionTypes({
      types: [
        {
          id: "MEETING_INVITE",
          actions: [
            { id: "going", title: "سأحضر ✅", foreground: false },
            { id: "not_going", title: "أعتذر ❌", foreground: false, destructive: true },
          ],
        },
      ],
    });

    // 4. Register with FCM
    console.log("[Push] Triggering final registration...");
    await PushNotifications.register();
    console.log("[Push] Registration triggered successfully.");
  } catch (e: any) {
    console.error("[Push] setup failed completely:", e);
    toast.error("فشل إعداد الإشعارات: " + (e.message || "خطأ غير معروف"));
  }
}
