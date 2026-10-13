import { useSyncExternalStore } from "react";
import { getDisplayMode, subscribeDisplayMode } from "@/lib/display-preference";

export function useDisplayMode() {
  return useSyncExternalStore(subscribeDisplayMode, getDisplayMode, () => "auto" as const);
}
