export type AlbumSectionKey = "family" | "meetings" | "events" | "trips";

export type ArchiveItem = {
  id: string;
  uploader_id: string;
  media_type: "image" | "video";
  storage_path: string;
  caption: string | null;
  pinned: boolean;
  expires_at: string | null;
  created_at: string;
  section: AlbumSectionKey;
};

export type AlbumItem = ArchiveItem & {
  url: string;
  uploaderName: string;
  avatar_url?: string | null;
};

export type AlbumLayout = "book" | "page" | "phone";
export type TurnDirection = "right" | "left";

// A fine-pointer desktop gets a spread even on a tall window. Touch devices
// get two pages only in landscape with enough height to read both pages.
export const ALBUM_BOOK_QUERY =
  "(min-width: 900px) and (hover: hover) and (pointer: fine), (min-width: 900px) and (min-height: 600px) and (orientation: landscape)";

export function albumPageSize(layout: AlbumLayout) {
  return layout === "book" ? 5 : 3;
}

export function albumPosition(itemCount: number, pageSize: number, anchor: number) {
  const pages = Math.max(1, Math.ceil(itemCount / pageSize));
  const safeAnchor = Math.min(Math.max(0, anchor), Math.max(0, itemCount - 1));
  return { page: Math.min(pages - 1, Math.floor(safeAnchor / pageSize)), pages };
}

export function albumTurnTarget(page: number, pages: number, direction: TurnDirection) {
  const target = page + (direction === "right" ? 1 : -1);
  return target >= 0 && target < pages ? target : null;
}

export function albumSpread<T>(items: T[], page: number) {
  const photos = items.slice(page * 5, page * 5 + 5);
  const rightCount = Math.min(2, Math.ceil(photos.length / 2));
  return { right: photos.slice(0, rightCount), left: photos.slice(rightCount) };
}

function searchText(value: string) {
  return value
    .toLocaleLowerCase("ar")
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .trim();
}

export function filterAlbumItems<
  T extends Pick<AlbumItem, "caption" | "uploaderName" | "created_at">,
>(items: T[], query: string, year: string) {
  const terms = searchText(query).split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    if (year !== "all" && String(new Date(item.created_at).getFullYear()) !== year) return false;
    const text = searchText(`${item.caption ?? ""} ${item.uploaderName}`);
    return terms.every((term) => text.includes(term));
  });
}

export function albumYears(items: Pick<AlbumItem, "created_at">[]) {
  return [
    ...new Set(
      items.map((item) => new Date(item.created_at).getFullYear()).filter(Number.isFinite),
    ),
  ]
    .sort((a, b) => b - a)
    .map(String);
}

const albumDateFormatter = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
export function albumDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? albumDateFormatter.format(date) : "";
}

export function albumCaption(item: Pick<AlbumItem, "caption" | "uploaderName">) {
  return item.caption?.trim() || `ذكرى من ${item.uploaderName}`;
}
