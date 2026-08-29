import { useEffect, useLayoutEffect, useRef } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";

/**
 * Global route scroll and transition manager.
 *
 * - Keeps the application header and mobile bottom navigation mounted and still.
 * - Animates only .app-shell-content when the active page changes.
 * - Reveals page sections as they enter the viewport, including dynamic tab panels.
 * - Restores browser Back/Forward positions and keeps real hash links intact.
 * - Respects prefers-reduced-motion for accessibility.
 */

type Pos = { x: number; y: number };
const positions = new Map<unknown, Pos>();

const SECTION_SELECTOR = [
  ".app-shell-content section",
  '.app-shell-content [role="tabpanel"]',
  ".app-shell-content [data-transition-section]",
].join(", ");

const isHistoryReturn = (action: string | undefined) =>
  action === "POP" || action === "BACK" || action === "FORWARD";

export function RouteScrollManager() {
  const router = useRouter();
  const location = useRouterState({ select: (s) => s.location });
  const state = (location.state ?? {}) as unknown as Record<string, unknown>;
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

  // Correct scroll and apply the page entrance before the destination paints.
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    const action = (router.history as unknown as { action?: string }).action;
    const goingBack = isHistoryReturn(action);
    const content = document.querySelector<HTMLElement>(".app-shell-content");
    let transitionTimer = 0;

    if (!location.hash) {
      const html = document.documentElement;
      const previousBehavior = html.style.scrollBehavior;
      html.style.scrollBehavior = "auto";

      const saved = goingBack ? positions.get(key) : undefined;
      if (saved) {
        window.scrollTo(saved.x, saved.y);
      } else {
        window.scrollTo(0, 0);
        document
          .querySelectorAll<HTMLElement>("[data-scroll-owner]")
          .forEach((element) => {
            element.scrollTop = 0;
            element.scrollLeft = 0;
          });
      }

      html.style.scrollBehavior = previousBehavior;
    }

    if (content) {
      content.classList.remove("route-transition-enter");
      content.dataset.routeDirection = goingBack ? "back" : "forward";

      // Restart the animation even when the same shell node is reused by Router.
      void content.offsetWidth;
      content.classList.add("route-transition-enter");

      transitionTimer = window.setTimeout(() => {
        content.classList.remove("route-transition-enter");
      }, 560);
    }

    return () => {
      window.clearTimeout(transitionTimer);
      content?.classList.remove("route-transition-enter");
    };
  }, [key, location.hash, router]);

  // Reveal semantic sections and tab panels as they become visible.
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    const content = document.querySelector<HTMLElement>(".app-shell-content");
    if (!content) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const registered = new WeakSet<HTMLElement>();
    let order = 0;

    const reveal = (element: HTMLElement) => {
      element.dataset.sectionReveal = "visible";
    };

    const observer =
      !reduceMotion && "IntersectionObserver" in window
        ? new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const element = entry.target as HTMLElement;
                requestAnimationFrame(() => reveal(element));
                observer?.unobserve(element);
              });
            },
            {
              root: null,
              rootMargin: "0px 0px -8% 0px",
              threshold: 0.06,
            },
          )
        : null;

    const register = (element: HTMLElement) => {
      if (registered.has(element)) return;
      if (
        element.closest(
          '[role="dialog"], [data-no-section-transition="true"]',
        )
      ) {
        return;
      }

      registered.add(element);
      element.style.setProperty(
        "--section-order",
        String(Math.min(order, 5)),
      );
      order += 1;

      if (!observer) {
        reveal(element);
        return;
      }

      element.dataset.sectionReveal = "pending";
      observer.observe(element);
    };

    const scan = (root: ParentNode) => {
      if (
        root instanceof HTMLElement &&
        root.matches(
          'section, [role="tabpanel"], [data-transition-section]',
        )
      ) {
        register(root);
      }

      root
        .querySelectorAll<HTMLElement>(SECTION_SELECTOR)
        .forEach(register);
    };

    scan(content);

    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) scan(node);
        });

        if (
          mutation.type === "attributes" &&
          mutation.target instanceof HTMLElement
        ) {
          const element = mutation.target;
          const isTransitionTarget = element.matches(
            'section, [role="tabpanel"], [data-transition-section]',
          );
          const isNowVisible =
            !element.hidden && element.getAttribute("aria-hidden") !== "true";

          if (isTransitionTarget && isNowVisible) {
            if (!observer) {
              reveal(element);
              return;
            }

            // Re-run the reveal when a tab or collapsible section is activated.
            element.dataset.sectionReveal = "pending";
            void element.offsetWidth;
            observer.observe(element);
          }
        }
      });
    });

    mutationObserver.observe(content, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "aria-hidden", "data-state"],
    });

    return () => {
      mutationObserver.disconnect();
      observer?.disconnect();
    };
  }, [key]);

  return null;
}
