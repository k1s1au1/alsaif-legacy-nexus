import { getDisplayMode, getDisplayScale, getDisplayViewport, subscribeDisplayMode } from "./display-preference";
import { desktopMediaQuery, desktopViewportValues } from "./desktop-media";

/**
 * Use the existing styles, in their existing order, for the desktop canvas.
 * Chrome's own desktop-site switch can ignore viewport meta tags, so a meta
 * tag alone cannot implement an explicit layout preference.
 */
export function mountDisplayLayout() {
  const root = document.documentElement;
  const media = new Map<MediaList, string>();
  const declarations = new Map<CSSStyleDeclaration, string>();
  let frame = 0;

  const restore = () => {
    media.forEach((original, list) => { list.mediaText = original; });
    declarations.forEach((original, style) => { style.cssText = original; });
    media.clear();
    declarations.clear();
    delete root.dataset.displayMode;
    for (const name of ["width", "height", "scale", "inverse-scale", "vw", "vh", "vmin", "vmax"]) {
      root.style.removeProperty(`--display-${name}`);
    }
  };

  const walk = (rules: CSSRuleList, width: number) => {
    for (const rule of Array.from(rules)) {
      const list = (rule as CSSMediaRule).media;
      if (list) {
        const original = media.get(list) ?? list.mediaText;
        const next = desktopMediaQuery(original, width);
        if (next !== original) media.set(list, original);
        if (list.mediaText !== next) list.mediaText = next;
      }
      const style = (rule as CSSStyleRule).style;
      if (style) {
        const original = declarations.get(style) ?? style.cssText;
        const next = desktopViewportValues(original);
        if (next !== original) declarations.set(style, original);
        if (style.cssText !== next) style.cssText = next;
      }
      const nested = (rule as CSSGroupingRule).cssRules;
      if (nested) walk(nested, width);
    }
  };

  const sync = () => {
    if (getDisplayMode() !== "desktop") {
      if (media.size || declarations.size || root.dataset.displayMode) restore();
      return;
    }
    const { width } = getDisplayViewport();
    const scale = getDisplayScale();
    const height = window.innerHeight / scale;
    root.dataset.displayMode = "desktop";
    root.style.setProperty("--display-width", `${width}px`);
    root.style.setProperty("--display-height", `${height}px`);
    root.style.setProperty("--display-scale", String(scale));
    root.style.setProperty("--display-inverse-scale", String(1 / scale));
    root.style.setProperty("--display-vw", `${width / 100}px`);
    root.style.setProperty("--display-vh", `${height / 100}px`);
    root.style.setProperty("--display-vmin", `${Math.min(width, height) / 100}px`);
    root.style.setProperty("--display-vmax", `${Math.max(width, height) / 100}px`);
    for (const sheet of Array.from(document.styleSheets)) {
      // Font/CDN styles may be cross-origin; they do not own our layout.
      try { walk(sheet.cssRules, width); } catch { /* Inaccessible external sheet. */ }
    }
  };
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(sync);
  };
  const unsubscribe = subscribeDisplayMode(sync);
  const observer = new MutationObserver(schedule);
  observer.observe(document.head, { childList: true, subtree: true, characterData: true });
  document.addEventListener("load", schedule, true);
  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
  sync();
  return () => {
    unsubscribe();
    observer.disconnect();
    document.removeEventListener("load", schedule, true);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("orientationchange", schedule);
    cancelAnimationFrame(frame);
    restore();
  };
}
