import { useCallback, useEffect, useState } from "react";

const SIMPLE_MODE_STORAGE_KEY = "alsaif-simple-mode";
const SIMPLE_MODE_EVENT = "alsaif:simple-mode-change";

const readSimpleMode = () => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SIMPLE_MODE_STORAGE_KEY) === "true";
};

const applySimpleModeMarker = (enabled: boolean) => {
  if (typeof document === "undefined") return;
  document.documentElement.toggleAttribute("data-simple-mode", enabled);
};

export function setSimpleModePreference(enabled: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SIMPLE_MODE_STORAGE_KEY, String(enabled));
  applySimpleModeMarker(enabled);
  window.dispatchEvent(
    new CustomEvent(SIMPLE_MODE_EVENT, {
      detail: { enabled },
    }),
  );
}

export function useSimpleMode() {
  const [simpleMode, setSimpleModeState] = useState(readSimpleMode);

  useEffect(() => {
    applySimpleModeMarker(simpleMode);

    const syncFromStorage = (event: StorageEvent) => {
      if (event.key && event.key !== SIMPLE_MODE_STORAGE_KEY) return;
      const enabled = readSimpleMode();
      applySimpleModeMarker(enabled);
      setSimpleModeState(enabled);
    };

    const syncFromEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled?: boolean }>).detail;
      const enabled = typeof detail?.enabled === "boolean" ? detail.enabled : readSimpleMode();
      applySimpleModeMarker(enabled);
      setSimpleModeState(enabled);
    };

    window.addEventListener("storage", syncFromStorage);
    window.addEventListener(SIMPLE_MODE_EVENT, syncFromEvent);

    return () => {
      window.removeEventListener("storage", syncFromStorage);
      window.removeEventListener(SIMPLE_MODE_EVENT, syncFromEvent);
    };
  }, []);

  const setSimpleMode = useCallback((enabled: boolean) => {
    setSimpleModeState(enabled);
    setSimpleModePreference(enabled);
  }, []);

  return {
    simpleMode,
    setSimpleMode,
    enableSimpleMode: () => setSimpleMode(true),
    disableSimpleMode: () => setSimpleMode(false),
  };
}
