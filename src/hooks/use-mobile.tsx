import * as React from "react";
import { useDisplayMode } from "@/hooks/use-display-mode";
import { getDisplayViewport } from "@/lib/display-preference";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const displayMode = useDisplayMode();
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(getDisplayViewport().width < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(getDisplayViewport().width < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, [displayMode]);

  return !!isMobile;
}
