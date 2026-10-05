import { useLayoutEffect, useRef } from "react";

/** Fit chat between the existing navigation bars, including the mobile keyboard. */
export function useChatViewport() {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const shell = ref.current?.closest<HTMLElement>(".app-shell-main");
    if (!shell) return;

    const header = shell.querySelector<HTMLElement>(":scope > .app-shell-header-wrap");
    const dock = shell.querySelector<HTMLElement>(":scope > .app-shell-bottom-dock");
    const viewport = window.visualViewport;
    let frame = 0;

    const measure = () => {
      const rect = shell.getBoundingClientRect();
      const visibleTop = viewport?.offsetTop ?? 0;
      const visibleBottom = Math.min(
        window.innerHeight,
        visibleTop + (viewport?.height ?? window.innerHeight),
      );
      const headerBottom = header?.getBoundingClientRect().bottom ?? rect.top;
      let bottom = visibleBottom - 10;

      if (dock && getComputedStyle(dock).display !== "none") {
        // Use the fixed dock's layout position, independent of its entrance animation.
        const dockTop =
          window.innerHeight - parseFloat(getComputedStyle(dock).bottom || "0") - dock.offsetHeight;
        if (dockTop > visibleTop && dockTop < visibleBottom)
          bottom = Math.min(bottom, dockTop - 10);
      }

      shell.style.setProperty(
        "--chat-shell-top",
        `${Math.max(visibleTop, headerBottom) - rect.top + 10}px`,
      );
      shell.style.setProperty("--chat-shell-bottom", `${Math.max(0, rect.bottom - bottom)}px`);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(shell);
    if (header) observer.observe(header);
    if (dock) observer.observe(dock);
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    measure();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      shell.style.removeProperty("--chat-shell-top");
      shell.style.removeProperty("--chat-shell-bottom");
    };
  }, []);

  return ref;
}
