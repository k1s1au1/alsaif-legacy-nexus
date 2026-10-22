import { useEffect } from "react";

const lenses = [
  "[data-interface-control]", "[data-interface-surface]", ".btn-gold",
  ".family-seal-wing", ".family-seal-utility", ".family-services-paper__service",
  ".family-services-paper__toggle", ".card-surface",
].join(",");

/* One delegated, frame-limited highlight; no animation loop or per-card listeners. */
export function LiquidGlassEffects() {
  useEffect(() => {
    const root = document.documentElement;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = matchMedia("(hover: hover) and (pointer: fine)");
    let active: HTMLElement | null = null;
    let frame = 0;
    let enabled = false;
    let x = 0;
    let y = 0;
    const clear = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      active?.style.removeProperty("--liquid-x");
      active?.style.removeProperty("--liquid-y");
      active = null;
    };
    const update = () => {
      frame = 0;
      if (!active?.isConnected) { clear(); return; }
      const box = active.getBoundingClientRect();
      if (!box.width || !box.height) return;
      active.style.setProperty("--liquid-x", `${Math.max(0, Math.min(100, (x - box.left) / box.width * 100)).toFixed(1)}%`);
      active.style.setProperty("--liquid-y", `${Math.max(0, Math.min(100, (y - box.top) / box.height * 100)).toFixed(1)}%`);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>(lenses) : null;
      if (target !== active) { clear(); active = target; }
      if (!active) return;
      x = event.clientX; y = event.clientY;
      if (!frame) frame = requestAnimationFrame(update);
    };
    const sync = () => {
      const next = root.dataset.interfaceMaterial === "crystal" && !motion.matches && pointer.matches;
      if (next === enabled) return;
      enabled = next;
      if (next) document.addEventListener("pointermove", move, { passive: true });
      else { document.removeEventListener("pointermove", move); clear(); }
    };
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-interface-material"] });
    motion.addEventListener("change", sync);
    pointer.addEventListener("change", sync);
    document.addEventListener("pointerleave", clear);
    window.addEventListener("blur", clear);
    sync();
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", sync);
      pointer.removeEventListener("change", sync);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", clear);
      window.removeEventListener("blur", clear);
      clear();
    };
  }, []);
  return null;
}
