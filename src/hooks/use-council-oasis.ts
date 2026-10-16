import { useEffect, useState } from "react";
import { councilOasisClock } from "@/lib/council-oasis";
import { usePrayerTimes } from "./use-prayer-times";

export function useCouncilOasis() {
  const { today, timeZone } = usePrayerTimes();
  const [now, setNow] = useState(() => new Date());
  const zone = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    let timer: number;
    const update = () => {
      const current = new Date();
      setNow(current);
      const { nextChangeAt } = councilOasisClock(current, today, zone);
      window.clearTimeout(timer);
      timer = window.setTimeout(update, Math.max(25, Math.min(15_000, (nextChangeAt ?? current.getTime() + 15_000) - current.getTime() + 25)));
    };
    const onVisible = () => { if (document.visibilityState === "visible") update(); };
    update();
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [today?.date, today?.sunrise, today?.sunset, zone]);

  return councilOasisClock(now, today, zone);
}
