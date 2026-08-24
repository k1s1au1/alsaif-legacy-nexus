import { Loader2 } from "lucide-react";

/**
 * Replaces the previous route immediately while the next route chunk and its
 * guards are loading. This prevents stale page content from flashing during
 * client-side navigation.
 */
export function RoutePendingScreen() {
  return (
    <div
      className="grid min-h-[calc(100dvh-8rem)] w-full place-items-center bg-background"
      role="status"
      aria-label="جارٍ فتح الصفحة"
    >
      <div className="flex flex-col items-center gap-3 text-primary">
        <Loader2 className="size-7 animate-spin text-gold-primary" aria-hidden="true" />
        <span className="text-sm font-bold text-muted-foreground">جارٍ فتح الصفحة…</span>
      </div>
    </div>
  );
}