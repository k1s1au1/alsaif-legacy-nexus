import * as Dialog from "@radix-ui/react-dialog";
import { useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Download, Trash2, X } from "lucide-react";
import { albumCaption, albumDate } from "@/lib/family-album";
import type { AlbumItem } from "@/lib/family-album";
import "./family-album-book.css";

export function FamilyAlbumViewer({
  item,
  sectionLabel,
  onClose,
  onDelete,
  onDownload,
}: {
  item: AlbumItem;
  sectionLabel: string;
  onClose: () => void;
  onDelete?: () => void;
  onDownload: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const opener = useRef(
    typeof document === "undefined" ? null : (document.activeElement as HTMLElement),
  );
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Content
          asChild
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
          }}
        >
          <motion.section
            className="family-album-viewer"
            dir="rtl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
          >
            <header className="album-viewer-header">
              <div className="album-viewer-heading">
                <Dialog.Title>{albumCaption(item)}</Dialog.Title>
                <Dialog.Description>
                  {item.media_type === "video" ? "فيديو" : "صورة"} من {sectionLabel}
                </Dialog.Description>
              </div>
              <div className="album-viewer-actions">
                <button type="button" onClick={onDownload} aria-label="تحميل الذكرى">
                  <Download size={20} />
                </button>
                {onDelete && (
                  <button type="button" onClick={onDelete} aria-label="حذف الذكرى">
                    <Trash2 size={20} />
                  </button>
                )}
                <Dialog.Close asChild>
                  <button type="button" aria-label="إغلاق المعاينة">
                    <X size={24} />
                  </button>
                </Dialog.Close>
              </div>
            </header>
            <div className="album-viewer-media">
              {item.media_type === "image" ? (
                <img src={item.url} alt={albumCaption(item)} />
              ) : (
                <video
                  src={item.url}
                  controls
                  autoPlay
                  playsInline
                  aria-label={albumCaption(item)}
                />
              )}
            </div>
            <footer className="album-viewer-footer">
              <span>بواسطة {item.uploaderName}</span>
              <time dateTime={item.created_at}>{albumDate(item.created_at)}</time>
              {item.expires_at && <span>ذكرى مؤقتة</span>}
            </footer>
          </motion.section>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
