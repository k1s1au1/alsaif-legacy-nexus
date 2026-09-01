import { useEffect, useState } from "react";
import { localDayKey } from "@/lib/day-lifecycle";

/**
 * Re-renders consumers at local midnight and after the app returns to focus.
 * This makes active lists roll over without a reload or a database mutation.
 */
export function useDayBoundaryKey() {
  const [key, setKey] = useState(() => localDayKey());

  useEffect(() => {
    let timer: number | undefined;

    const refresh = () => setKey(localDayKey());
    const schedule = () => {
      window.clearTimeout(timer);
      const now = new Date();
      const nextDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        0,
        75,
      );
      timer = window.setTimeout(() => {
        refresh();
        schedule();
      }, Math.max(250, nextDay.getTime() - now.getTime()));
    };

    const onWake = () => {
      refresh();
      schedule();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") onWake();
    };

    schedule();
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return key;
}
