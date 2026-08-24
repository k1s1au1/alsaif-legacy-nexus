import { useEffect, useLayoutEffect, useRef } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";

/**
 * Global route scroll manager (single source of truth for scroll on navigation).
 *
 * - Runs pre-paint (useLayoutEffect) so the destination page is never painted
 *   at the previous page's scroll position — no visible jump or flicker.
 * - PUSH/REPLACE navigations start instantly at the top (no smooth scrolling).
 * - POP (browser Back/Forward) restores the entry's saved scroll position.
 * - Real hash links (e.g. /page#section) are left untouched so anchors work.
 * - Replaces the router's built-in scroll restoration (disabled in router.tsx)
 *   so there is exactly one route-change scroll handler.
 */

type Pos = { x: number; y: number };
const positions = new Map<unknown, Pos>();

export function RouteScrollManager() {
  const router = useRouter();
  const location = useRouterState({ select: (s) => s.location });
  const state = (location.state ?? {}) as Record<string, unknown>;
  const key = state["__TSR_key"] ?? location.href;
  const keyRef = useRef(key);
  keyRef.current = key;

  // Continuously record the scroll position of the active history entry so
  // Back/Forward can restore it later.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    let raf = 0;
    const save = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        positions.set(keyRef.current, { x: window.scrollX, y: window.scrollY });
      });
    };
    window.addEventListener("scroll", save, { passive: true });
    return () => {
      window.removeEventListener("scroll", save);
      cancelAnimationFrame(raf);
      positions.set(keyRef.current, { x: window.scrollX, y: window.scrollY });
    };
  }, []);

  // Pre-paint scroll correction on every location change.
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    // Preserve intentional anchor navigation only.
    if (location.hash) return;

    const html = document.documentElement;
    const prevBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto"; // never smooth-scroll during route changes

    const isPop = router.history.action === "POP";
    const saved = isPop ? positions.get(key) : undefined;

    if (saved) {
      window.scrollTo(saved.x, saved.y);
    } else {
      window.scrollTo(0, 0);
      // Reset any inner scroll-owning containers as well.
      document
        .querySelectorAll<HTMLElement>("[data-scroll-owner]")
        .forEach((el) => {
          el.scrollTop = 0;
          el.scrollLeft = 0;
        });
    }

    html.style.scrollBehavior = prevBehavior;
  }, [key, location.hash, router]);

  return null;
}
