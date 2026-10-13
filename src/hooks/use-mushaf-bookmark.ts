import { useCallback, useEffect, useState } from "react";
import { MUSHAF_BOOKMARK_EVENT, mushafBookmarkKey, readMushafBookmark, validMushafPage } from "@/lib/mushaf";

export function useMushafBookmark(userId: string | undefined) {
  const [lastPage, setLastPage] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setLastPage(readMushafBookmark(userId));
    update();
    window.addEventListener("storage", update);
    window.addEventListener(MUSHAF_BOOKMARK_EVENT, update);
    return () => { window.removeEventListener("storage", update); window.removeEventListener(MUSHAF_BOOKMARK_EVENT, update); };
  }, [userId]);
  const savePage = useCallback((page: number) => {
    if (!userId || validMushafPage(page) !== page) return;
    setLastPage(page);
    try {
      localStorage.setItem(mushafBookmarkKey(userId), JSON.stringify({ page, updatedAt: new Date().toISOString() }));
      window.dispatchEvent(new Event(MUSHAF_BOOKMARK_EVENT));
    } catch { /* Reading still works if local persistence is unavailable. */ }
  }, [userId]);
  return { lastPage, savePage };
}
