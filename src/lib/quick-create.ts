export type QuickCreateTarget =
  | "occasion"
  | "meeting"
  | "trip"
  | "task"
  | "community";

export function consumeQuickCreate(target: QuickCreateTarget): boolean {
  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);
  if (params.get("create") !== target) return false;

  params.delete("create");
  const nextSearch = params.toString();
  const nextUrl =
    window.location.pathname +
    (nextSearch ? `?${nextSearch}` : "") +
    window.location.hash;

  window.history.replaceState(window.history.state, "", nextUrl);
  return true;
}
