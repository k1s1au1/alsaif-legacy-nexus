export type DisplayMode = "auto" | "desktop";

export const DISPLAY_MODE_KEY = "alsaif-display-mode";
export const DISPLAY_MODE_EVENT = "alsaif:display-mode-change";
export const DESKTOP_LAYOUT_WIDTH = 1440;
let sessionMode: DisplayMode | null = null;

export function getDisplayMode(): DisplayMode {
  if (typeof window === "undefined") return "auto";
  if (sessionMode) return sessionMode;
  try {
    return localStorage.getItem(DISPLAY_MODE_KEY) === "desktop" ? "desktop" : "auto";
  } catch {
    return "auto";
  }
}

export function saveDisplayMode(mode: DisplayMode) {
  const next = mode === "desktop" ? "desktop" : "auto";
  let saved = true;
  try {
    if (next === "auto") localStorage.removeItem(DISPLAY_MODE_KEY);
    else localStorage.setItem(DISPLAY_MODE_KEY, next);
    sessionMode = null;
  } catch {
    saved = false;
    sessionMode = next;
  }
  window.dispatchEvent(new Event(DISPLAY_MODE_EVENT));
  return saved;
}

export function subscribeDisplayMode(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === DISPLAY_MODE_KEY || event.key === null) {
      sessionMode = null;
      listener();
    }
  };
  window.addEventListener(DISPLAY_MODE_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(DISPLAY_MODE_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getDisplayViewport() {
  if (getDisplayMode() === "desktop") {
    return { width: Math.max(DESKTOP_LAYOUT_WIDTH, window.innerWidth), height: 900, touch: false };
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    touch: navigator.maxTouchPoints > 0 || window.matchMedia("(pointer: coarse)").matches,
  };
}

export function getDisplayScale() {
  if (getDisplayMode() !== "desktop") return 1;
  const width = document.documentElement.clientWidth || window.innerWidth;
  return Math.min(1, width / getDisplayViewport().width);
}
