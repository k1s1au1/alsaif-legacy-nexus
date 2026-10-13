import index from "@/data/mushaf-index.json";

export const MUSHAF_SOURCE = {
  name: "مشروع المصحف الإلكتروني — جامعة الملك سعود",
  url: "https://quran.ksu.edu.sa/",
  readerUrl: "https://quran.ksu.edu.sa/index.php?l=ar",
  pagesBase: "https://quran.ksu.edu.sa/safahat/png_big/",
  narration: "مصحف المدينة — رواية حفص عن عاصم",
} as const;
export const MUSHAF_PAGE_COUNT = 604;
export const MUSHAF_SURAHS = index.surahs;
export const MUSHAF_JUZ = index.juz;
export const MUSHAF_BOOKMARK_EVENT = "alsaif:mushaf-reading-changed";

export function validMushafPage(value: unknown): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 && page <= MUSHAF_PAGE_COUNT ? page : 1;
}
export function mushafPageUrl(page: number) {
  if (!Number.isInteger(page) || page < 1 || page > MUSHAF_PAGE_COUNT) throw new RangeError("صفحة غير صالحة للمصحف");
  return `${MUSHAF_SOURCE.pagesBase}${page}.png`;
}
export function mushafSpread(page: number, double: boolean) {
  const current = validMushafPage(page);
  if (!double) return [current];
  const first = current % 2 === 0 ? current - 1 : current;
  return first < MUSHAF_PAGE_COUNT ? [first, first + 1] : [first];
}
export function mushafPageLabel(page: number) {
  const current = validMushafPage(page);
  const start = index.pages[current - 1].start;
  const end = index.pages[current]?.start ?? 6236;
  return MUSHAF_SURAHS.filter((surah) => surah.start < end && surah.start + surah.ayahs > start).map((surah) => surah.name).join("، ");
}
export function normalizedSurahSearch(value: string) {
  return value.normalize("NFKD").replace(/[\u064b-\u065f\u0670\u0640]/g, "").replace(/[أإآٱ]/g, "ا").trim();
}
export function mushafBookmarkKey(userId: string) { return `alsaif:mushaf:last-page:v1:${userId}`; }
export function readMushafBookmark(userId: string | undefined) {
  if (!userId || typeof localStorage === "undefined") return null;
  try {
    const stored = JSON.parse(localStorage.getItem(mushafBookmarkKey(userId)) || "null") as { page?: unknown } | null;
    if (!stored || Number(stored.page) !== validMushafPage(stored.page)) return null;
    return validMushafPage(stored.page);
  } catch { return null; }
}
