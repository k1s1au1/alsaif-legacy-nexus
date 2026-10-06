export type BuiltinAlbumKey = "family" | "meetings" | "events" | "trips";
export type AlbumSectionKey = BuiltinAlbumKey | `custom:${string}`;

export type CustomAlbum = {
  id: string;
  title: string;
  created_by: string | null;
  created_at: string;
};

export type AlbumAccess = {
  userId: string | null;
  roles: readonly string[];
  sectionHeads: readonly string[];
};

export type ArchiveItem = {
  id: string;
  uploader_id: string;
  media_type: "image" | "video";
  storage_path: string;
  caption: string | null;
  pinned: boolean;
  expires_at: string | null;
  created_at: string;
  section: BuiltinAlbumKey;
  album_id?: string | null;
};

export type AlbumItem = ArchiveItem & {
  url: string;
  uploaderName: string;
  avatar_url?: string | null;
};

export type AlbumLayout = "book" | "page" | "phone";
export type TurnDirection = "right" | "left";

export function albumItemKey(item: Pick<ArchiveItem, "section" | "album_id">): AlbumSectionKey {
  return item.album_id ? `custom:${item.album_id}` : item.section;
}

export function albumDestination(key: AlbumSectionKey) {
  if (["family", "meetings", "events", "trips"].includes(key)) {
    return { section: key as BuiltinAlbumKey, album_id: null };
  }
  const id = key.slice("custom:".length);
  if (
    !key.startsWith("custom:") ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    throw new Error("الألبوم المحدد غير صالح");
  }
  return { section: "family" as const, album_id: id };
}

export function canCreateFamilyAlbums(access: AlbumAccess) {
  return (
    !!access.userId &&
    (access.roles.includes("chairman") ||
      access.roles.includes("vice_chairman") ||
      access.sectionHeads.includes("archive"))
  );
}

export function canUploadToAlbum(access: AlbumAccess, key: AlbumSectionKey) {
  if (!access.userId) return false;
  if (key.startsWith("custom:")) return access.roles.length > 0;
  if (key === "family" || canCreateFamilyAlbums(access)) return true;
  return access.sectionHeads.includes(key === "events" ? "occasions" : key);
}

export function canManageAlbumItem(access: AlbumAccess, item: ArchiveItem) {
  if (!access.userId) return false;
  if (canCreateFamilyAlbums(access)) return true;
  if (item.album_id || item.section === "family") return item.uploader_id === access.userId;
  return access.sectionHeads.includes(item.section === "events" ? "occasions" : item.section);
}

export const ALBUM_MAX_BYTES = 50 * 1024 * 1024;

export function albumMediaError(file: Pick<File, "type" | "size">) {
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/"))
    return "اختر صورة أو مقطع فيديو.";
  if (file.size === 0) return "الملف فارغ؛ اختر ملفاً آخر.";
  if (file.size > ALBUM_MAX_BYTES) return "حجم الملف يتجاوز 50 ميجابايت.";
  return null;
}

export function albumNameError(title: string, existingTitles: readonly string[]) {
  const trimmed = title.trim();
  if (!trimmed) return "اكتب اسم الألبوم.";
  if (Array.from(trimmed).length > 60) return "اسم الألبوم لا يتجاوز 60 حرفاً.";
  const normalized = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ar");
  if (existingTitles.some((value) => normalized(value) === normalized(trimmed)))
    return "يوجد ألبوم بهذا الاسم؛ اختر اسماً آخر.";
  return null;
}

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
