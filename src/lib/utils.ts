import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

declare global {
  var QuickActionsBanner: () => null;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

if (typeof window !== "undefined") {
  (window as any).cn = cn;
  globalThis.QuickActionsBanner ??= () => null;
}
