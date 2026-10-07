import { registerPlugin } from "@capacitor/core";

export const RichNotifications = registerPlugin<{
  show(options: { title: string; body: string; image: string; url: string }): Promise<void>;
}>("RichNotifications");