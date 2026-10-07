import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

/**
 * When a page is opened from a notification with `?focus=<id>`, scroll to the
 * element marked `data-focus-id="<id>"` and briefly highlight it.
 */
export function NotificationFocus() {
  const href = useRouterState({ select: (s) => s.location.href });

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("focus");
    if (!id) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      const el = document.querySelector<HTMLElement>(`[data-focus-id="${CSS.escape(id)}"]`);
      if (el) {
        clearInterval(timer);
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("notification-focus-ring");
        if (el.tagName === "BUTTON") el.click();
        setTimeout(() => el.classList.remove("notification-focus-ring"), 4000);
      } else if (tries > 40) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [href]);

  return null;
}
