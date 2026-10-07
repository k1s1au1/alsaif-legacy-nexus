export type RichPushPayload = {
  notification?: { title?: string; body?: string; image?: string };
  data?: Record<string, string>;
};

export function richNotificationContent(payload: RichPushPayload) {
  const candidate = payload.notification?.image || payload.data?.image || "";
  let image: string | undefined;
  try {
    const url = new URL(candidate);
    if (url.protocol === "https:") image = url.href;
  } catch {
    // Missing or invalid images must never prevent the text notification.
  }
  return {
    title: payload.notification?.title || payload.data?.title || "إشعار جديد",
    body: payload.notification?.body || payload.data?.body || "",
    image,
    url: payload.data?.url || "/",
  };
}