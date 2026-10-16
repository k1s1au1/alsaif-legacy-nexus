import { useRef, type CSSProperties, type MouseEvent, type TouchEvent } from "react";

/** A horizontal RTL swipe turns a page; vertical scrolling and pinch zoom stay native. */
export function useRtlSwipeNavigation(enabled: boolean, onStep: (step: number) => void) {
  const origin = useRef<{ id: number; x: number; y: number } | null>(null);
  const suppressClickUntil = useRef(0);

  return {
    style: enabled ? ({ touchAction: "pan-y pinch-zoom" } satisfies CSSProperties) : undefined,
    onTouchStart(event: TouchEvent) {
      // A new deliberate tap must work immediately after a swipe.
      suppressClickUntil.current = 0;
      const touch = event.touches[0];
      origin.current =
        enabled && event.touches.length === 1
          ? { id: touch.identifier, x: touch.clientX, y: touch.clientY }
          : null;
    },
    onTouchMove(event: TouchEvent) {
      const start = origin.current;
      if (!start) return;
      const touch = Array.from(event.touches).find((item) => item.identifier === start.id);
      if (!enabled || event.touches.length !== 1 || !touch) {
        origin.current = null;
        return;
      }
      const dx = Math.abs(touch.clientX - start.x);
      const dy = Math.abs(touch.clientY - start.y);
      // Lock an established vertical scroll instead of turning a card at its end.
      if (dy > 12 && dy > dx) origin.current = null;
    },
    onTouchEnd(event: TouchEvent) {
      const start = origin.current;
      origin.current = null;
      if (!enabled || !start || event.touches.length) return;
      const touch = Array.from(event.changedTouches).find((item) => item.identifier === start.id);
      if (!touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) < 42 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      suppressClickUntil.current = Date.now() + 400;
      onStep(dx > 0 ? 1 : -1);
    },
    onTouchCancel() {
      origin.current = null;
    },
    onClickCapture(event: MouseEvent) {
      if (enabled && Date.now() < suppressClickUntil.current) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
  };
}
