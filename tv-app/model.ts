export type TvView = "home" | "events" | "members" | "news" | "heritage" | "trips" | "meetings" | "tasks" | "albums" | "services" | "settings";
export type TvItem = {
  id: string;
  title: string;
  subtitle?: string;
  body?: string;
  image?: string;
  images?: string[];
  date?: string;
  time?: string;
  place?: string;
  authorId?: string;
  progress?: number;
  archived?: boolean;
  raw: Record<string, any>;
};

export type TvRect = { left: number; right: number; top: number; bottom: number; width: number; height: number };
export type Direction = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

/** Physical screen directions stay physical in the RTL interface. */
export function nearestInDirection(rects: TvRect[], current: number, direction: Direction) {
  const from = rects[current];
  if (!from) return rects.length ? 0 : -1;
  const horizontal = direction === "ArrowLeft" || direction === "ArrowRight";
  const positive = direction === "ArrowRight" || direction === "ArrowDown";
  const x = (from.left + from.right) / 2, y = (from.top + from.bottom) / 2;
  let best = -1, score = Infinity;
  rects.forEach((rect, i) => {
    if (i === current || !rect.width || !rect.height) return;
    const dx = (rect.left + rect.right) / 2 - x, dy = (rect.top + rect.bottom) / 2 - y;
    const along = horizontal ? dx : dy, across = horizontal ? dy : dx;
    if ((positive ? along : -along) < 3) return;
    const overlap = horizontal
      ? Math.min(from.bottom, rect.bottom) - Math.max(from.top, rect.top)
      : Math.min(from.right, rect.right) - Math.max(from.left, rect.left);
    const candidate = Math.abs(along) + Math.abs(across) * 2.5 + (overlap > 0 ? 0 : 150);
    if (candidate < score) { score = candidate; best = i; }
  });
  return best;
}

export const tvDate = (value?: string, options: Intl.DateTimeFormatOptions = {}) => {
  if (!value) return "الموعد يحدد لاحقًا";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00+03:00` : value);
  return Number.isNaN(date.getTime()) ? "الموعد يحدد لاحقًا" : new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
    day: "numeric", month: "long", timeZone: "Asia/Riyadh", ...options,
  }).format(date);
};

export const tvTime = (date?: string, time?: string) => !date ? "" : tvDate(time ? `${date.slice(0, 10)}T${time.slice(0, 5)}:00+03:00` : date, {
  day: undefined, month: undefined, hour: "numeric", minute: "2-digit", hour12: true,
});

export function parsePost(body: string | null | undefined) {
  const value = body || "";
  return {
    image: value.match(/(?:^|\n)---image:([^\n]+)/)?.[1]?.trim() || "",
    body: value.replace(/^---(?:image|kind):[^\n]*(?:\n|$)/gm, "").trim(),
  };
}

export function safeImageUrl(value: string | null | undefined) {
  if (!value) return "";
  try { const url = new URL(value); return url.protocol === "https:" ? url.href : ""; } catch { return ""; }
}

export function lineageIds(rows: { id: string; parent_id?: string | null }[], id: string) {
  const byId = new Map(rows.map(row => [row.id, row]));
  const result: string[] = [], seen = new Set<string>();
  let next: string | null | undefined = id;
  while (next && byId.has(next) && !seen.has(next)) {
    seen.add(next); result.push(next); next = byId.get(next)?.parent_id;
  }
  return result;
}

export const taskStage = (progress: number) => progress >= 100 ? "done" : progress > 0 ? "doing" : "new";
